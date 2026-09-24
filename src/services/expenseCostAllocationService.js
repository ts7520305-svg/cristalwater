'use strict';
const r = require('./expenseLedgerRules'), targets = require('./expenseCostTargets'), sources = require('./expenseSourceService');
const { sum } = require('./monthlyFinancialProjection');
const { period } = require('./operationalValueReportService');
const valuation = require('./expenseValuationService');
const json = value => JSON.parse(JSON.stringify(value));
const refused = (code, message) => ({ applied: false, code, message });
const live = expense => (expense.expenseAllocations || expense.allocations || []).filter(a => !a.voidedAt);
const allocated = expense => sum(live(expense).map(a => a.amountCents));
function expenseSnapshot(e) { return { id: e.id, amountCents: e.amountCents, expenseDate: r.day(e.expenseDate), category: e.category, supplierName: e.supplierName, documentNumber: e.documentNumber, sourceType: e.sourceType, sourceId: e.stockPurchaseId || e.maintenanceId || null, sourceHash: e.sourceHash }; }
async function decorate(db, expenses) {
  const current = await targets.current(db, expenses.flatMap(e => e.expenseAllocations));
  return require('./maintenanceCostShareService').decorate(db, await valuation.decorate(db, expenses.map(expense => {
    const { expenseAllocations, ...e } = expense, budget = allocated(expense), expenseHash = r.hash(expenseSnapshot(e));
    const budgetValid = budget !== null && budget >= 0 && budget <= e.amountCents;
    const allocations = expenseAllocations.map(a => {
      const target = current.get(a.targetType + ':' + targets.targetId(a));
      const reasons = !a.voidedAt ? [e.cancelledAt && 'EXPENSE_CANCELLED', e.needsReview && 'EXPENSE_SOURCE_REVIEW', !budgetValid && 'BUDGET_INVALID', a.expenseHash !== expenseHash && 'EXPENSE_CHANGED', (!target?.valid || target.hash !== a.targetHash || target.clientId !== a.clientId) && 'TARGET_CHANGED'].filter(Boolean) : [];
      return { ...a, targetId: targets.targetId(a), targetLabel: a.targetSnapshot.label, clientName: target?.clientId === a.clientId ? target.clientName : a.targetSnapshot.clientName, needsReview: reasons.length > 0, reviewReasons: reasons, stockPurchase: a.expenseSnapshot.sourceType === 'STOCK_PURCHASE' || a.expenseSnapshot.category === 'STOCK' };
    });
    return { ...e, allocations, allocatedCents: budgetValid ? budget : null, unallocatedCents: e.cancelledAt ? 0 : budgetValid && !e.needsReview ? e.amountCents - budget : null, allocationReviewCount: allocations.filter(a => a.needsReview).length };
  })));
}
function entries(expenses, monthRef) { return expenses.filter(e => !e.cancelledAt).flatMap(e => require('./maintenanceCostShareService').project(e.allocations).filter(a => !a.voidedAt && a.monthRef === monthRef).map(a => ({ ...a, expenseTitle: e.title, expenseDocument: e.documentNumber }))); }
function group(rows, byTarget = false) {
  const groups = new Map();
  for (const a of rows) {
    const key = byTarget ? a.targetType + ':' + a.targetId : 'CLIENT:' + a.clientId;
    if (!groups.has(key)) groups.set(key, { key, clientId: a.clientId, ...(byTarget ? { targetType: a.targetType, targetId: a.targetId } : {}), label: byTarget ? a.targetLabel : a.clientId === null ? 'Custos gerais da empresa' : (a.clientName || 'Cliente') + ' · #' + a.clientId, values: [], valuationRows: [], allocationCount: 0, reviewCount: 0, stockPurchaseCount: 0 });
    const g = groups.get(key); g.values.push(a.amountCents); g.valuationRows.push(a); g.allocationCount++; if (a.needsReview) g.reviewCount++; if (a.stockPurchase) g.stockPurchaseCount++;
  }
  return [...groups.values()].map(({ values, valuationRows, ...g }) => ({ ...g, valuations: valuation.summary(valuationRows), amountCents: g.reviewCount ? null : sum(values) })).sort((a, b) => (b.amountCents ?? -1) - (a.amountCents ?? -1) || a.key.localeCompare(b.key));
}
function summary(expenses, monthRef, generatedAt) {
  const rows = entries(expenses, monthRef), clients = group(rows), active = expenses.filter(e => !e.cancelledAt), reviewCount = rows.filter(a => a.needsReview).length;
  const unallocatedReviewCount = active.filter(e => e.unallocatedCents === null).length;
  const total = list => list.some(a => a.needsReview) ? null : sum(list.map(a => a.amountCents));
  return { valuations: valuation.summary(rows), version: 1, monthRef, currency: 'EUR', generatedAt: generatedAt.toISOString(), state: reviewCount || unallocatedReviewCount ? 'REVIEW' : 'READY', coverage: 'REGISTERED_EXPENSE_ATTRIBUTION', completeOperatingCosts: false, profit: null,
    allocatedAmountCents: total(rows), clientAmountCents: total(rows.filter(a => a.clientId !== null)), companyAmountCents: total(rows.filter(a => a.clientId === null)), stockPurchaseAmountCents: total(rows.filter(a => a.stockPurchase)), allocationCount: rows.length, reviewCount,
    unallocatedAmountCents: sum(active.map(e => e.unallocatedCents)), unallocatedExpenseCount: active.filter(e => e.unallocatedCents > 0).length, unallocatedReviewCount,
    clientCount: clients.filter(c => c.clientId !== null).length, topClients: clients.filter(c => c.clientId !== null).slice(0, 10), topLimit: 10, sampleOnly: clients.filter(c => c.clientId !== null).length > 10, limitApplied: null,
    basis: { allocated: 'EXPLICIT_ALLOCATION_MONTH', unallocated: 'CURRENT_EXPENSE_REMAINDER_ALL_MONTHS', stock: 'PURCHASE_ATTRIBUTION_NOT_CONSUMPTION' } };
}
function report(expenses, query, generatedAt = new Date()) {
  r.object(query, ['monthRef', 'mode', 'clientId', 'targetType', 'targetId', 'q', 'page']);
  const monthRef = period({ monthRef: query.monthRef }).monthRef, mode = query.mode || 'CLIENTS', q = r.text(query.q || '', 160), page = r.queryId(query.page === undefined ? '1' : query.page);
  if (!['CLIENTS', 'TARGETS', 'ALLOCATIONS'].includes(mode)) r.fail('Vista de custos inválida.');
  if (mode === 'CLIENTS' && (query.clientId !== undefined || query.targetType !== undefined || query.targetId !== undefined)) r.fail('Contexto de custos inválido.');
  if (mode !== 'CLIENTS' && query.clientId !== 'COMPANY') r.queryId(query.clientId);
  if (mode === 'TARGETS' && (query.targetType !== undefined || query.targetId !== undefined)) r.fail('Contexto de destino inválido.');
  if (mode === 'ALLOCATIONS') {
    if (!targets.types.includes(query.targetType)) r.fail('Destino inválido.');
    if (query.targetType === 'COMPANY') { if (query.targetId !== '0' || query.clientId !== 'COMPANY') r.fail('Contexto da empresa inválido.'); }
    else { r.queryId(query.targetId); if (query.clientId === 'COMPANY' || query.targetType === 'CLIENT' && query.targetId !== query.clientId) r.fail('Contexto do cliente inválido.'); }
  }
  const all = entries(expenses, monthRef), clientId = query.clientId === 'COMPANY' ? null : Number(query.clientId), selected = mode === 'CLIENTS' ? all : all.filter(a => a.clientId === clientId);
  const result = mode === 'CLIENTS' ? group(selected) : mode === 'TARGETS' ? group(selected, true) : selected.filter(a => a.targetType === query.targetType && (a.targetId || 0) === Number(query.targetId)).map(a => ({ id: a.id, expenseId: a.expenseId, clientId: a.clientId, targetType: a.targetType, targetId: a.targetId, label: a.expenseTitle, documentNumber: a.expenseDocument, targetLabel: a.targetLabel, amountCents: a.amountCents, monthRef: a.monthRef, needsReview: a.needsReview, reviewReasons: a.reviewReasons, stockPurchase: a.stockPurchase, valuationType: a.valuationType, quantity: a.quantity, quantityUnit: a.quantityUnit, reason: a.reason, ...(a.sourceAllocationId ? {sourceAllocationId:a.sourceAllocationId,costAttributionBasis:a.costAttributionBasis,maintenanceShareId:a.maintenanceShareId||null} : {}) }));
  const filtered = result.filter(row => !q || r.normalized(row.label + ' ' + (row.documentNumber || '')).includes(r.normalized(q)));
  return { ok: true, selection: { monthRef, mode, clientId: query.clientId || null, targetType: query.targetType || null, targetId: query.targetId || null, q, page }, pageSize: 10, total: filtered.length, summary: summary(expenses, monthRef, generatedAt), rows: filtered.slice((page - 1) * 10, page * 10) };
}
async function apply(db, who, env, expense) {
  const d = env.data, command = env.command;
  if (command === 'VOID_COST') {
    r.object(d, ['allocationId', 'reason']); r.id(d.allocationId); const reason = r.text(d.reason, 500, true);
    const a = live(expense).find(a => a.id === d.allocationId); if (!a) return refused('ALLOCATION_STATE', 'Atribuição inexistente nesta despesa ou já anulada.');
    if (await require('./maintenanceCostShareService').hasActive(db, [a])) return refused('ACTIVE_MAINTENANCE_SHARES', 'Anule primeiro as parcelas deste custo atribuídas a manutenções.');
    if (a.valuationSnapshot?.composition || await db.laborCostValuationPart.findUnique({ where: { allocationId: a.id } })) return refused('COMPOSITE_VOID_REQUIRED', 'Anule todas as parcelas na base composta de trabalho.');
    if (a.valuationType !== 'MANUAL') await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'expense-valuation:' + a.targetType + ':' + targets.targetId(a) }))::text`;
    const after = await db.expenseAllocation.update({ where: { id: a.id }, data: { voidedAt: new Date(), voidReason: reason, activeKey: null, activeMeasurementKey: null } });
    const updated = await db.companyExpense.update({ where: { id: expense.id }, data: { version: { increment: 1 } } });
    return { applied: true, expenseId: expense.id, version: updated.version, allocation: after, allocationBefore: a, reason };
  }
  const review = command === 'REVIEW_COST';
  r.object(d, review ? ['allocationId', 'targetHash', 'reason', 'confirmed'] : ['monthRef', 'amountCents', 'targetType', 'targetId', 'targetHash', 'reason', 'confirmed']);
  if (d.confirmed !== true || typeof d.targetHash !== 'string' || !/^[a-f0-9]{64}$/.test(d.targetHash)) r.fail('Reveja e confirme o destino da atribuição.');
  if (review) r.id(d.allocationId);
  const reason = r.text(d.reason, 500, true), before = review ? live(expense).find(a => a.id === d.allocationId) : null;
  if (review && !before) return refused('ALLOCATION_STATE', 'Atribuição inexistente nesta despesa ou já anulada.');
  if (review && before.valuationType !== 'MANUAL') return refused('REVALUE_REQUIRED', 'Anule esta valorização e calcule novamente com as fontes atuais. O montante anterior fica no histórico.');
  const monthRef = review ? before.monthRef : period({ monthRef: d.monthRef }).monthRef;
  if (!review && (typeof d.monthRef !== 'string' || monthRef !== d.monthRef)) r.fail('Indique o mês da atribuição.');
  const amountCents = review ? before.amountCents : r.money(d.amountCents), type = review ? before.targetType : d.targetType, id = review ? targets.targetId(before) : d.targetId;
  if (!targets.types.includes(type)) r.fail('Destino inválido.');
  if (expense.sourceType !== 'MANUAL') { const source = await sources.source(db, expense.sourceType, expense.stockPurchaseId || expense.maintenanceId, true); if (!source || source.hash !== expense.sourceHash) return refused('SOURCE_STALE', 'Reveja primeiro a origem alterada da despesa.'); }
  const target = await targets.get(db, type, id, true);
  if (!target?.valid || target.hash !== d.targetHash || before && target.clientId !== before.clientId) return refused('TARGET_STALE', 'O cliente ou serviço mudou. Reveja o destino; uma mudança de cliente exige anular a atribuição anterior.');
  const budget = allocated(expense); if (budget === null || budget > expense.amountCents || !review && budget + amountCents > expense.amountCents) return refused('OVERALLOCATION', 'O montante excede o valor ainda por atribuir desta despesa, incluindo todos os meses.');
  const activeKey = r.hash({ expenseId: expense.id, monthRef, type, id });
  if (!review && live(expense).some(a => a.activeKey === activeKey)) return refused('ALLOCATION_EXISTS', 'Já existe uma atribuição ativa desta despesa a este destino e mês. Reveja ou anule a anterior antes de corrigir o valor.');
  const snapshot = expenseSnapshot(expense), values = { expenseHash: r.hash(snapshot), expenseSnapshot: snapshot, targetHash: target.hash, targetSnapshot: target.snapshot, reason };
  const allocation = review ? await db.expenseAllocation.update({ where: { id: before.id }, data: { ...values, reviewedAt: new Date() } }) : await db.expenseAllocation.create({ data: { ...values, expenseId: expense.id, monthRef, amountCents, targetType: type, clientId: target.clientId, visitId: type === 'REGULAR' ? id : null, extraVisitId: type === 'EXTRA' ? id : null, repairId: type === 'REPAIR' ? id : null, maintenanceCompletionId: type === 'MAINTENANCE_EQUIPMENT' ? id : null, serviceReminderId: type === 'MAINTENANCE_REMINDER' ? id : null, activeKey, createdById: who.id } });
  const updated = await db.companyExpense.update({ where: { id: expense.id }, data: { version: { increment: 1 } } });
  return json({ applied: true, expenseId: expense.id, version: updated.version, allocation, allocationBefore: before, reason });
}
module.exports = { targets, allocated, live, decorate, summary, report, apply, entries, group, expenseSnapshot };
