'use strict';
// This reader does not call the ledger decorator: individual and composed costs
// use the same sources without creating a recursive report dependency.
const r = require('./expenseLedgerRules'), data = require('./expenseValuationSources'), targets = require('./expenseCostTargets');
const json = v => JSON.parse(JSON.stringify(v)), hash = v => r.hash(json(v));
const include = { laborBasis: { include: { technician: { select: { id: true, name: true } } } }, expenseAllocations: true };
const ids = snapshot => snapshot?.components?.map(c => c.expenseId) || [];
const same = (a, b) => hash(a) === hash(b);
function facts(expenses) {
  if (expenses.length < 2 || expenses.length > 20) r.fail('Escolha entre duas e vinte despesas de trabalho.', 409);
  const first = data.laborBasis(expenses[0].laborBasis);
  if (!first) r.fail('Confirme primeiro a base de trabalho de cada despesa.', 409);
  const components = expenses.map(e => {
    const b = data.laborBasis(e.laborBasis);
    if (e.cancelledAt || e.sourceType !== 'MANUAL' || e.category !== 'LABOR' || !b || !['technicianId', 'periodStart', 'periodEnd', 'paidMinutes'].every(k => b[k] === first[k])) r.fail('As despesas têm de confirmar o mesmo técnico, período e tempo pago.', 409);
    if (!e.laborBasis.technician) r.fail('Técnico não encontrado.', 409);
    r.money(e.amountCents);
    return { expenseId: e.id, expense: require('./expenseCostAllocationService').expenseSnapshot(e), laborBasis: b };
  });
  const amountCents = components.reduce((n, c) => n + c.expense.amountCents, 0); r.money(amountCents);
  return { version: 1, kind: 'CONFIRMED_LABOR_COST_COMPOSITION', technicianId: first.technicianId, periodStart: first.periodStart, periodEnd: first.periodEnd, paidMinutes: first.paidMinutes, amountCents, components };
}
async function expensesFor(db, snapshot, lock = false) {
  const selected = ids(snapshot);
  if (!Array.isArray(selected) || selected.length < 2 || selected.length > 20 || selected.some((id, i) => !Number.isSafeInteger(id) || id <= 0 || i && id <= selected[i - 1])) r.fail('Composição inválida. Conserve o histórico para revisão.', 409);
  // All expense rows precede target locks, including shared components.
  if (lock) for (const id of selected) await db.$queryRaw`SELECT id FROM "CompanyExpense" WHERE id=${id} FOR UPDATE`;
  const rows = await db.companyExpense.findMany({ where: { id: { in: selected } }, include, orderBy: { id: 'asc' } });
  if (rows.length !== selected.length) r.fail('Uma despesa da composição já não está disponível.', 409);
  return rows;
}
async function inspectBasis(db, basis, expenses) {
  if (!basis) return { state: 'REVIEW', reviewReasons: ['BASIS_MISSING'] };
  if (basis.voidedAt) return { state: 'VOIDED', reviewReasons: [] };
  try {
    const current = facts(expenses || await expensesFor(db, basis.snapshot));
    const good = hash(basis.snapshot) === basis.fingerprint && same(current, basis.snapshot) && basis.activeKey === r.hash(ids(basis.snapshot));
    return { state: good ? 'CONFIRMED' : 'REVIEW', reviewReasons: good ? [] : ['COMPOSITION_SOURCE_CHANGED'] };
  } catch (e) { if (e.status !== 409) throw e; return { state: 'REVIEW', reviewReasons: ['COMPOSITION_SOURCE_CHANGED'] }; }
}
const allocationFields = ['id','expenseId','monthRef','amountCents','targetType','clientId','visitId','extraVisitId','repairId','targetHash','targetSnapshot','expenseHash','expenseSnapshot','activeKey','reason','createdById','createdAt','valuationType','valuationKey','valuationHash','valuationSnapshot','quantity','quantityUnit','purchaseItemId','activeMeasurementKey'];
function allocationFacts(a) { return json(Object.fromEntries(allocationFields.map(k => [k, k === 'quantity' ? a[k]?.toString() : a[k]]))); }
async function inspectGroups(db, groups) {
  const status = new Map();
  for (const group of groups) {
    if (group.voidedAt) { status.set(group.id, { state: 'VOIDED', reviewReasons: [] }); continue; }
    let good = hash(group.snapshot) === group.fingerprint;
    const basis = await db.laborCostBasis.findUnique({ where: { id: group.basisId } });
    good = good && basis?.fingerprint === group.snapshot.basisFingerprint && (await inspectBasis(db, basis)).state === 'CONFIRMED';
    const saved = Array.isArray(group.snapshot.parts) ? group.snapshot.parts : [];
    const preview = group.snapshot.preview, components = Array.isArray(preview?.components) ? preview.components : [];
    good = good && group.snapshot.version === 1 && group.snapshot.basisId === group.basisId && preview?.basisId === group.basisId && preview.basisFingerprint === basis.fingerprint && same(preview.basisSnapshot, basis.snapshot) && preview.hash === hash(Object.fromEntries(Object.entries(preview).filter(([k]) => k !== 'hash'))) && saved.length === components.length;
    good = good && saved.length >= 2 && saved.length <= 20 && same(group.parts.map(p => ({ allocationId: p.allocationId, expenseId: p.expenseId })).sort((a,b) => a.expenseId-b.expenseId), saved.map(p => ({ allocationId: p.id, expenseId: p.expenseId })));
    const allocations = await db.expenseAllocation.findMany({ where: { id: { in: group.parts.map(p => p.allocationId) } } });
    const expenses = await db.companyExpense.findMany({ where: { id: { in: group.parts.map(p => p.expenseId) } }, include });
    const prepared = await data.prepare(db, allocations), targetMap = await targets.current(db, allocations);
    for (const expected of saved) {
      const a = allocations.find(a => a.id === expected.id), e = expenses.find(e => e.id === expected.expenseId);
      if (!a || !e || a.voidedAt || e.cancelledAt || !same(allocationFacts(a), expected)) { good = false; continue; }
      const source = data.build(prepared, e, data.selected(a)), target = targetMap.get(a.targetType + ':' + targets.targetId(a));
      const budget = e.expenseAllocations.filter(x => !x.voidedAt).reduce((n,x) => n+x.amountCents,0);
      if (!source.valid || source.hash !== a.valuationHash || a.expenseHash !== hash(require('./expenseCostAllocationService').expenseSnapshot(e)) || !target?.valid || target.hash !== a.targetHash || target.clientId !== a.clientId || !Number.isSafeInteger(budget) || budget > e.amountCents) { good = false; continue; }
      const { measured, pool, basisMatches } = data.reservations(prepared, e, source, null);
      if (!basisMatches || !measured || !pool || measured.units > source.units || pool.units > source.totalQuantity || pool.cents > source.totalCents) good = false;
      const component = components.find(p => p.expenseId === a.expenseId), c = a.valuationSnapshot?.calculation;
      const marker = { version: 1, basisId: group.basisId, basisFingerprint: group.snapshot.basisFingerprint, groupId: group.id, primaryExpenseId: components[0]?.expenseId, expenseIds: components.map(p => p.expenseId) };
      if (!component || !same(a.valuationSnapshot.composition, marker) || !same(component.source, a.valuationSnapshot.source) || !same(component.calculation, c) || !['amountCents','monthRef','quantityUnit','targetType','clientId','targetHash','valuationHash','valuationKey'].every(k => a[k] === component[k]) || a.quantity.toString() !== component.quantity || targets.targetId(a) !== component.targetId || !['targetType','targetId','clientId','monthRef','quantity','quantityUnit'].every(k => component[k] === preview[k])) { good = false; continue; }
      const q = data.quantity(c?.quantity), before = data.quantity(c?.poolQuantityBefore), beforeCents = c?.poolAmountBeforeCents;
      if (!q || q !== source.units || before === null || q > source.totalQuantity - before || data.quantity(c.baseQuantity) !== source.totalQuantity || c.baseAmountCents !== source.totalCents || !Number.isSafeInteger(beforeCents) || beforeCents < 0 || beforeCents > source.totalCents || c.measuredQuantityBefore !== '0') { good = false; continue; }
      const final = q === source.totalQuantity - before, expectedAmount = final ? BigInt(source.totalCents - beforeCents) : data.round(q * BigInt(source.totalCents), source.totalQuantity);
      if (a.amountCents !== Number(expectedAmount) || c.rounding !== (final ? 'FINAL_POOL_REMAINDER' : 'NEAREST_CENT')) good = false;
    }
    if (saved.reduce((n,a) => n+a.amountCents,0) !== preview?.amountCents) good = false;
    status.set(group.id, { state: good ? 'CONFIRMED' : 'REVIEW', reviewReasons: good ? [] : ['COMPOSITION_VALUATION_CHANGED'] });
  }
  return status;
}
async function decorate(db, expenses) {
  const allocations = expenses.flatMap(e => e.allocations), activeIds = allocations.filter(a => !a.voidedAt).map(a => a.id);
  if (!activeIds.length) return expenses;
  const membership = await db.laborCostValuationPart.findMany({ where: { allocationId: { in: activeIds } } });
  const groupIds = [...new Set([...membership.map(p => p.groupId), ...allocations.map(a => a.valuationSnapshot?.composition?.groupId).filter(id => Number.isSafeInteger(id) && id > 0)])];
  if (!groupIds.length) return expenses;
  const groups = await db.laborCostValuation.findMany({ where: { id: { in: groupIds } }, include: { parts: true } }), states = await inspectGroups(db, groups);
  return expenses.map(e => {
    const rows = e.allocations.map(a => {
      const member = membership.find(p => p.allocationId === a.id), marker = a.valuationSnapshot?.composition;
      const groupId = member?.groupId || marker?.groupId, state = states.get(groupId);
      const reasons = [...a.reviewReasons];
      if (!a.voidedAt && (member || marker) && (!member || marker?.groupId !== member.groupId || state?.state !== 'CONFIRMED')) reasons.push('COMPOSITION_VALUATION_CHANGED');
      return { ...a, ...(groupId ? { laborCostGroupId: groupId, laborCostBasisId: groups.find(g => g.id === groupId)?.basisId || null } : {}), needsReview: !!reasons.length, reviewReasons: [...new Set(reasons)] };
    });
    return { ...e, allocations: rows, allocationReviewCount: rows.filter(a => a.needsReview).length };
  });
}
module.exports = { json, hash, same, include, ids, facts, expensesFor, inspectBasis, allocationFacts, inspectGroups, decorate };
