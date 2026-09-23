'use strict';
const r = require('./expenseLedgerRules'), data = require('./expenseValuationSources'), targets = require('./expenseCostTargets'), sources = require('./expenseSourceService');
const { sum } = require('./monthlyFinancialProjection');
const json = value => JSON.parse(JSON.stringify(value));
const refused = (code, message) => ({ applied: false, code, message });
function selection(value, query = false) {
  if (!['MATERIAL', 'LABOR'].includes(value.kind) || !['REGULAR', 'EXTRA', 'REPAIR'].includes(value.targetType)) r.fail('Escolha materiais ou trabalho num serviço com execução confirmada.');
  const id = v => query ? r.queryId(v) : r.id(v);
  const purchaseItemId = value.kind === 'MATERIAL' ? id(value.purchaseItemId) : null;
  if (value.kind === 'LABOR' && value.purchaseItemId !== null && value.purchaseItemId !== undefined) r.fail('O trabalho não tem uma linha de compra de materiais.');
  const repairLabor = value.targetType === 'REPAIR' && value.kind === 'LABOR';
  const workIntervalId = repairLabor ? id(value.workIntervalId) : null;
  if (!repairLabor && value.workIntervalId !== undefined && value.workIntervalId !== null) r.fail('O intervalo de reparação só pode ser usado no trabalho dessa reparação.');
  const quantity = value.quantity === undefined || value.quantity === null || value.quantity === '' ? null : value.quantity;
  if (quantity !== null && (typeof quantity !== 'string' || data.quantity(quantity) === null || data.quantity(quantity) <= 0n)) r.fail('Indique uma quantidade positiva com até seis casas decimais.');
  return { kind: value.kind, targetType: value.targetType, targetId: id(value.targetId), purchaseItemId, quantity, ...(repairLabor ? { workIntervalId } : {}) };
}
async function preview(db, expense, choice, lock = false) {
  if (expense.cancelledAt) r.fail('A despesa está anulada.', 409);
  if (lock) {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'expense-valuation:' + choice.targetType + ':' + choice.targetId }))::text`;
    // Serialize source edits and FK-linked movement inserts through the service row.
    if (choice.targetType === 'REGULAR') await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${choice.targetId} FOR UPDATE`;
    else if (choice.targetType === 'EXTRA') await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${choice.targetId} FOR UPDATE`;
    if (choice.targetType !== 'REPAIR') await db.$queryRaw`SELECT id FROM "StockMovement" WHERE "visitId"=${choice.targetType === 'REGULAR' ? choice.targetId : null} OR "extraVisitId"=${choice.targetType === 'EXTRA' ? choice.targetId : null} FOR SHARE`;
  }
  if (lock && choice.targetType === 'REPAIR' && choice.kind === 'LABOR') await db.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', 'repair-work:' + choice.targetId);
  // Repair targets lock historical client -> repair -> proof -> movements,
  // matching authenticated completion; they never borrow a visit's consumption.
  const target = await targets.get(db, choice.targetType, choice.targetId, lock);
  if (!target?.valid) r.fail('Reveja o serviço e o cliente antes de valorizar.', 409);
  if (lock && choice.targetType === 'REPAIR' && choice.kind === 'LABOR') {
    const work = await db.repairWorkInterval.findUnique({ where: { id: choice.workIntervalId }, select: { technicianId: true, repairId: true } });
    if (!work || work.repairId !== choice.targetId) r.fail('Intervalo de trabalho não encontrado nesta reparação.', 409);
    await db.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', 'repair-work-technician:' + work.technicianId);
    await db.$queryRawUnsafe('SELECT id FROM "Technician" WHERE id=$1 FOR SHARE', work.technicianId);
    await db.$queryRawUnsafe('SELECT id FROM "RepairWorkInterval" WHERE id=$1 FOR SHARE', choice.workIntervalId);
  }
  if (expense.sourceType !== 'MANUAL') {
    const source = await sources.source(db, expense.sourceType, expense.stockPurchaseId || expense.maintenanceId, lock);
    if (!source || source.hash !== expense.sourceHash || source.suggested.amountCents !== expense.amountCents) r.fail('Reveja o documento, as linhas e o total da origem da despesa.', 409);
  }
  const prepared = await data.prepare(db, [], [{ ...choice, expenseId: expense.id }]), source = data.build(prepared, expense, choice);
  if (!source.valid) r.fail(source.errors.join(' '), 409);
  const reserved = data.reservations(prepared, expense, source, choice.purchaseItemId), { measured, pool } = reserved;
  if (!reserved.basisMatches) r.fail('A base de custo mudou. Anule e recalcule as valorizações anteriores desta base antes de atribuir novos custos.', 409);
  if (!measured || !pool || measured.units > source.units || pool.units > source.totalQuantity || pool.cents > source.totalCents) r.fail('As quantidades ou custos já valorizados precisam de revisão.', 409);
  if (choice.kind === 'LABOR' && measured.units > 0n) r.fail('Este intervalo ou serviço já tem trabalho valorizado. Anule a valorização anterior antes de corrigir.', 409);
  const available = source.units - measured.units < source.totalQuantity - pool.units ? source.units - measured.units : source.totalQuantity - pool.units;
  const q = choice.quantity === null ? choice.kind === 'LABOR' ? source.units : available : data.quantity(choice.quantity);
  if (choice.kind === 'LABOR' && q !== source.units) r.fail('O tempo do serviço mudou. Calcule e reveja novamente a duração completa.', 409);
  if (!q || q <= 0n || q > available) r.fail('A quantidade ultrapassa o consumo, a compra ou o tempo pago disponível.', 409);
  const finalRemainder = q === source.totalQuantity - pool.units;
  const amount = finalRemainder ? BigInt(source.totalCents - pool.cents) : data.round(q * BigInt(source.totalCents), source.totalQuantity);
  const amountCents = Number(amount);
  if (amount <= 0n || amountCents > source.totalCents - pool.cents) r.fail('Esta quantidade não permite confirmar um custo positivo em cêntimos dentro da base disponível.', 409);
  r.money(amountCents);
  const already = sum(expense.expenseAllocations.filter(a => !a.voidedAt).map(a => a.amountCents));
  if (already === null || already + amountCents > expense.amountCents) r.fail('O custo excede o valor ainda por atribuir desta despesa. Reveja as atribuições existentes.', 409);
  const calculation = { quantity: data.decimal(q), quantityUnit: source.unit, amountCents, method: source.method, rounding: finalRemainder ? 'FINAL_POOL_REMAINDER' : 'NEAREST_CENT', poolQuantityBefore: data.decimal(pool.units), poolAmountBeforeCents: pool.cents, measuredQuantityBefore: data.decimal(measured.units), baseQuantity: data.decimal(source.totalQuantity), baseAmountCents: source.totalCents };
  const result = { version: 1, ...(choice.workIntervalId ? { workIntervalId: choice.workIntervalId } : {}), expenseId: expense.id, expenseVersion: expense.version, kind: choice.kind, targetType: choice.targetType, targetId: choice.targetId, targetHash: target.hash, clientId: target.clientId, monthRef: source.monthRef, purchaseItemId: choice.purchaseItemId, valuationKey: source.key, valuationHash: source.hash, quantity: calculation.quantity, quantityUnit: source.unit, amountCents, availableQuantity: data.decimal(available), label: source.label, calculation, source: source.snapshot };
  return { ...result, hash: r.hash(result) };
}
async function apply(db, who, env, expense) {
  const d = env.data;
  if (env.command === 'SET_LABOR_BASIS') {
    r.object(d, ['technicianId', 'periodStart', 'periodEnd', 'paidMinutes', 'reason', 'confirmed']);
    r.id(d.technicianId); r.id(d.paidMinutes); const reason = r.text(d.reason, 500, true), from = r.date(d.periodStart), until = r.date(d.periodEnd);
    if (d.confirmed !== true || from > until || d.paidMinutes > (until - from) / 60000 + 1440) r.fail('Confirme o período e os minutos efetivamente pagos ou abrangidos pelo documento.');
    if (expense.sourceType !== 'MANUAL' || expense.category !== 'LABOR') return refused('LABOR_EXPENSE_REQUIRED', 'Use uma despesa confirmada de trabalho ou salários.');
    if (expense.expenseAllocations.some(a => !a.voidedAt && a.valuationType !== 'MANUAL')) return refused('ACTIVE_VALUATIONS', 'Anule as valorizações ativas antes de corrigir a base de trabalho.');
    await db.$queryRaw`SELECT id FROM "Technician" WHERE id=${d.technicianId} FOR SHARE`;
    const technician = await db.technician.findUnique({ where: { id: d.technicianId }, select: { id: true } });
    if (!technician) return refused('TECHNICIAN_MISSING', 'Técnico não encontrado.');
    const values = { technicianId: d.technicianId, periodStart: from, periodEnd: until, paidMinutes: d.paidMinutes, reason };
    const basis = await db.expenseLaborBasis.upsert({ where: { expenseId: expense.id }, create: { ...values, expenseId: expense.id, createdById: who.id }, update: values });
    const updated = await db.companyExpense.update({ where: { id: expense.id }, data: { version: { increment: 1 } } });
    return { applied: true, expenseId: expense.id, version: updated.version, laborBasis: data.laborBasis(basis), previousLaborBasis: data.laborBasis(expense.laborBasis), reason };
  }
  r.object(d, ['kind', 'targetType', 'targetId', 'workIntervalId', 'targetHash', 'monthRef', 'purchaseItemId', 'quantity', 'amountCents', 'valuationHash', 'previewHash', 'reason', 'confirmed']);
  if (d.kind !== (env.command === 'VALUE_MATERIAL' ? 'MATERIAL' : 'LABOR') || d.confirmed !== true || ![d.targetHash, d.valuationHash, d.previewHash].every(s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s))) r.fail('Reveja e confirme a valorização antes de guardar.');
  r.money(d.amountCents); const reason = r.text(d.reason, 500, true), choice = selection(d);
  let current;
  try { current = await preview(db, expense, choice, true); } catch (error) { if (error.status === 409) return refused('VALUATION_REVIEW', error.message); throw error; }
  if (current.hash !== d.previewHash || current.valuationHash !== d.valuationHash || current.targetHash !== d.targetHash || current.monthRef !== d.monthRef || current.amountCents !== d.amountCents || current.quantity !== d.quantity) return refused('VALUATION_CHANGED', 'O consumo, tempo, custo ou orçamento mudou. Calcule e reveja novamente.');
  const activeKey = r.hash({ expenseId: expense.id, monthRef: current.monthRef, type: choice.targetType, id: choice.targetId, valuationType: choice.kind, purchaseItemId: choice.purchaseItemId, ...(choice.workIntervalId ? { workIntervalId: choice.workIntervalId } : {}) });
  if (expense.expenseAllocations.some(a => !a.voidedAt && a.activeKey === activeKey)) return refused('ALLOCATION_EXISTS', 'Já existe uma valorização desta origem para o serviço. Anule a anterior antes de corrigir.');
  const snapshot = require('./expenseCostAllocationService').expenseSnapshot(expense);
  const allocation = await db.expenseAllocation.create({ data: { expenseId: expense.id, monthRef: current.monthRef, amountCents: current.amountCents, targetType: choice.targetType, clientId: current.clientId, visitId: choice.targetType === 'REGULAR' ? choice.targetId : null, extraVisitId: choice.targetType === 'EXTRA' ? choice.targetId : null, repairId: choice.targetType === 'REPAIR' ? choice.targetId : null, targetHash: current.targetHash, targetSnapshot: (await targets.get(db, choice.targetType, choice.targetId)).snapshot, expenseHash: r.hash(snapshot), expenseSnapshot: snapshot, activeKey, reason, createdById: who.id,
    valuationType: choice.kind, valuationKey: current.valuationKey, valuationHash: current.valuationHash, valuationSnapshot: { source: current.source, calculation: current.calculation }, quantity: current.quantity, quantityUnit: current.quantityUnit, purchaseItemId: current.purchaseItemId, activeMeasurementKey: choice.kind === 'LABOR' ? 'LABOR:' + choice.targetType + ':' + choice.targetId + (choice.workIntervalId ? ':INTERVAL:' + choice.workIntervalId : '') : null } });
  const updated = await db.companyExpense.update({ where: { id: expense.id }, data: { version: { increment: 1 } } });
  return json({ applied: true, expenseId: expense.id, version: updated.version, allocation, calculation: current.calculation, previewHash: current.hash, reason });
}
async function decorate(db, expenses) {
  const prepared = await data.prepare(db, expenses.flatMap(e => e.allocations));
  const decorated = expenses.map(expense => {
    const allocations = expense.allocations.map(a => {
      if (a.valuationType === 'MANUAL') return { ...a, quantity: null };
      const source = data.build(prepared, expense, data.selected(a)), reasons = [...a.reviewReasons];
      if (!a.voidedAt) {
        const calculation = a.valuationSnapshot?.calculation; if (!calculation || !a.valuationSnapshot?.source || r.hash(a.valuationSnapshot.source) !== a.valuationHash || a.quantity?.toString() !== calculation.quantity || a.quantityUnit !== calculation.quantityUnit || a.amountCents !== calculation.amountCents || source.valid && (source.key !== a.valuationKey || a.valuationType === 'LABOR' && data.quantity(a.quantity) !== source.units)) reasons.push('VALUATION_RECORD_CHANGED');
        if (!source.valid || source.hash !== a.valuationHash || source.unit !== a.quantityUnit || source.visit?.clientId !== a.clientId) reasons.push('VALUATION_SOURCE_CHANGED');
        if (source.valid) { const { measured, pool, basisMatches } = data.reservations(prepared, expense, source, a.purchaseItemId); if (!basisMatches) reasons.push('VALUATION_BASIS_CHANGED'); if (!measured || !pool || measured.units > source.units || pool.units > source.totalQuantity || pool.cents > source.totalCents) reasons.push('VALUATION_BUDGET_CHANGED'); }
      }
      return { ...a, quantity: a.quantity?.toString() || null, needsReview: !!reasons.length, reviewReasons: reasons, valuationLabel: a.valuationSnapshot?.source.kind === 'MATERIAL' ? a.valuationSnapshot.source.item.productName : 'Tempo de trabalho', valuationMethod: a.valuationSnapshot?.calculation.method || null };
    });
    return { ...expense, allocations, laborBasis: expense.laborBasis ? { ...data.laborBasis(expense.laborBasis), technician: expense.laborBasis.technician, reason: expense.laborBasis.reason } : null, allocationReviewCount: allocations.filter(a => a.needsReview).length };
  });
  return require('./laborCostCompositionIntegrity').decorate(db, decorated);
}
function summary(rows) {
  const valued = rows.filter(a => a.valuationType !== 'MANUAL'), total = kind => { const selected = valued.filter(a => a.valuationType === kind); return selected.some(a => a.needsReview) ? null : sum(selected.map(a => a.amountCents)); };
  return { version: 3, coverage: 'CONFIRMED_EXPENSE_MEASUREMENTS', includedInExpenseAttribution: true, completeOperatingCosts: false, materialAmountCents: total('MATERIAL'), laborAmountCents: total('LABOR'), count: valued.length, reviewCount: valued.filter(a => a.needsReview).length, basis: { material: 'CONFIRMED_PURCHASE_LINE_SERVICE_CONSUMPTION', repairMaterial: 'AUTHENTICATED_REPAIR_PROOF_MOVEMENTS', repairLabor: 'CONFIRMED_DECLARED_REPAIR_INTERVAL_PAID_TIME', labor: 'CONFIRMED_EXPENSE_PAID_TIME', month: 'CONFIRMED_SERVICE_EXECUTION_UTC' } };
}
async function workIntervals(db, expense, repairId) {
  if (expense.cancelledAt || expense.category !== 'LABOR' || expense.sourceType !== 'MANUAL' || !expense.laborBasis) r.fail('Confirme primeiro a base de trabalho desta despesa.', 409);
  const target = await targets.get(db, 'REPAIR', repairId);
  if (!target?.valid) r.fail('Reveja a execução e o cliente da reparação.', 409);
  const prepared = await data.prepare(db, [], [{ kind: 'LABOR', expenseId: expense.id, targetType: 'REPAIR', targetId: repairId }]);
  const rows = [...prepared.workIntervals.values()].map(work => {
    const source = data.build(prepared, expense, { kind: 'LABOR', targetType: 'REPAIR', targetId: repairId, workIntervalId: work.id });
    return { id: work.id, state: work.state, eligible: source.valid, errors: source.errors, workInterval: { id: work.id, fingerprint: work.fingerprint, snapshot: work.snapshot } };
  });
  return { version: 1, expenseId: expense.id, expenseVersion: expense.version, repairId, targetHash: target.hash, basis: data.laborBasis(expense.laborBasis), rows };
}
module.exports = { selection, preview, apply, decorate, summary, workIntervals, data };
