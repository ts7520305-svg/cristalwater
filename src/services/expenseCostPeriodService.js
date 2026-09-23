'use strict';
const r = require('./expenseLedgerRules'), targets = require('./expenseCostTargets'), sources = require('./expenseSourceService');
const json = value => JSON.parse(JSON.stringify(value));
const refused = (code, message) => ({ applied: false, code, message });
const month = value => typeof value === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
const emptyValuation = ['valuationKey', 'valuationHash', 'valuationSnapshot', 'quantity', 'quantityUnit', 'purchaseItemId', 'activeMeasurementKey'];
async function preview(db, expense, allocationId, lock = false) {
  const costs = require('./expenseCostAllocationService');
  const a = expense.expenseAllocations.find(a => a.id === allocationId && !a.voidedAt);
  if (!a) return refused('ALLOCATION_STATE', 'A atribuição já foi anulada ou não pertence a esta despesa.');
  if (a.valuationType !== 'MANUAL' || emptyValuation.some(k => a[k] !== null) || await db.laborCostValuationPart.findUnique({ where: { allocationId } })) return refused('REVALUE_REQUIRED', 'Esta correção aplica-se a repartições manuais. Reveja a valorização na respetiva origem.');
  const type = a.targetType, id = targets.targetId(a);
  if (!targets.serviceTypes.includes(type)) return refused('SERVICE_REQUIRED', 'Escolha uma atribuição a um serviço com execução confirmada.');
  const budget = costs.allocated(expense), paid = require('./monthlyFinancialProjection').sum(expense.payments.filter(p => !p.reversedAt).map(p => p.amountCents));
  if (expense.cancelledAt || budget === null || budget < a.amountCents || budget > expense.amountCents || paid === null || paid > expense.amountCents) return refused('EXPENSE_REVIEW', 'Reveja primeiro os valores e o estado da despesa.');
  if (expense.sourceType !== 'MANUAL') {
    const source = await sources.source(db, expense.sourceType, expense.stockPurchaseId || expense.maintenanceId, lock);
    if (!source || source.hash !== expense.sourceHash) return refused('SOURCE_STALE', 'Reveja primeiro a origem alterada da despesa.');
  }
  if (a.expenseHash !== r.hash(costs.expenseSnapshot(expense)) || a.expenseHash !== r.hash(a.expenseSnapshot)) return refused('EXPENSE_STALE', 'Reveja primeiro a atribuição face ao documento atual.');
  const target = await targets.get(db, type, id, lock), facts = Object.fromEntries(targets.executionFields(type).map(k => [k, a.targetSnapshot?.[k]]));
  if (!target?.valid || target.hash !== a.targetHash || target.clientId !== a.clientId || r.hash(facts) !== a.targetHash || facts.type !== type || facts.id !== id || facts.clientId !== a.clientId) return refused('TARGET_STALE', 'O serviço ou o cliente mudou. Reveja primeiro a atribuição e a execução.');
  const endAt = target.snapshot.endAt, toMonth = endAt?.slice(0, 7);
  if (!endAt || !Number.isFinite(Date.parse(endAt)) || new Date(endAt).toISOString() !== endAt || !month(toMonth)) return refused('EXECUTION_DATE_REQUIRED', 'A execução não tem um mês confirmável.');
  if (!month(a.monthRef) || !Number.isSafeInteger(a.amountCents) || a.amountCents <= 0 || a.activeKey !== r.hash({ expenseId: expense.id, monthRef: a.monthRef, type, id })) return refused('ALLOCATION_REVIEW', 'Reveja primeiro a integridade desta atribuição.');
  if (a.monthRef === toMonth) return refused('PERIOD_ALIGNED', 'A atribuição já corresponde ao mês da execução.');
  if (costs.live(expense).some(other => other.id !== a.id && other.valuationType === 'MANUAL' && other.monthRef === toMonth && other.targetType === type && targets.targetId(other) === id)) return refused('ALLOCATION_EXISTS', 'Já existe uma repartição manual para este serviço no mês da execução. Reveja as duas atribuições antes de corrigir.');
  const allocationBefore = json(a), value = { version: 1, basis: 'CONFIRMED_SERVICE_EXECUTION_MONTH_UTC', expenseId: expense.id, expenseVersion: expense.version, allocationId, targetType: type, targetId: id, clientId: a.clientId, fromMonth: a.monthRef, toMonth, amountCents: a.amountCents, allocationBefore, beforeHash: r.hash(allocationBefore) };
  return { available: true, ...value, hash: r.hash(value) };
}
async function apply(db, who, env, expense) {
  const d = env.data;
  r.object(d, ['allocationId', 'fromMonth', 'toMonth', 'amountCents', 'previewHash', 'reason', 'confirmed']); r.id(d.allocationId); r.money(d.amountCents);
  if (!month(d.fromMonth) || !month(d.toMonth) || d.confirmed !== true || typeof d.previewHash !== 'string' || !/^[a-f0-9]{64}$/.test(d.previewHash)) r.fail('Reveja e confirme a correção do mês.');
  const reason = r.text(d.reason, 500, true), p = await preview(db, expense, d.allocationId, true);
  if (!p.available) return p;
  if (p.hash !== d.previewHash || p.fromMonth !== d.fromMonth || p.toMonth !== d.toMonth || p.amountCents !== d.amountCents) return refused('PREVIEW_CHANGED', 'A correção mudou. Consulte e confirme novamente o mês da execução.');
  const before = p.allocationBefore;
  const allocationVoided = await db.expenseAllocation.update({ where: { id: before.id }, data: { voidedAt: new Date(), voidReason: reason, activeKey: null } });
  const preserved = Object.fromEntries(['expenseId', 'amountCents', 'targetType', 'clientId', 'visitId', 'extraVisitId', 'repairId', 'maintenanceCompletionId', 'serviceReminderId', 'targetHash', 'targetSnapshot', 'expenseHash', 'expenseSnapshot'].map(k => [k, before[k]]));
  const allocation = await db.expenseAllocation.create({ data: { ...preserved, monthRef: p.toMonth, activeKey: r.hash({ expenseId: expense.id, monthRef: p.toMonth, type: p.targetType, id: p.targetId }), reason, createdById: who.id } });
  const updated = await db.companyExpense.update({ where: { id: expense.id }, data: { version: { increment: 1 } } });
  return json({ applied: true, expenseId: expense.id, version: updated.version, preview: p, allocationBefore: before, allocationVoided, allocation, reason });
}
module.exports = { preview, apply };
