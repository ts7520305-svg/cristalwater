(function (factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else globalThis.CWMaintenanceMaterialRules = factory();
})(function () {
  'use strict';
  const basis = 'CONFIRMED_PARENT_COST_MATERIAL_SHARE';
  const commands = ['SHARE_MAINTENANCE_MATERIAL', 'VOID_MAINTENANCE_MATERIAL_SHARE'];
  const fields = ['id','expenseId','monthRef','amountCents','targetType','clientId','visitId','extraVisitId','repairId','maintenanceCompletionId','serviceReminderId','targetHash','targetSnapshot','expenseHash','expenseSnapshot','activeKey','reason','createdById','createdAt','reviewedAt','voidedAt','voidReason','valuationType','valuationKey','valuationHash','valuationSnapshot','quantity','quantityUnit','purchaseItemId','activeMeasurementKey'];
  const targetFields = ['type','id','clientId','poolId','status','startAt','endAt','executionBasis','decisionId','decisionFingerprint','executionFingerprint','originVisitType','originVisitId'];
  const positive = n => Number.isSafeInteger(n) && n > 0, count = n => Number.isSafeInteger(n) && n >= 0;
  const iso = s => typeof s === 'string' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
  const sha = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  const normalize = s => typeof s === 'string' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9\s_-]/g, '').replace(/\s+/g, ' ').trim() : '';
  function quantity(s) { if (typeof s !== 'string' || !/^\d{1,12}(\.\d{1,6})?$/.test(s)) return null; const [w, f = ''] = s.split('.'); return BigInt(w) * 1000000n + BigInt(f.padEnd(6, '0')); }
  const decimal = n => (n / 1000000n).toString() + (n % 1000000n ? '.' + (n % 1000000n).toString().padStart(6, '0').replace(/0+$/, '') : '');
  const parentId = a => a.targetType === 'REGULAR' ? a.visitId : a.extraVisitId;
  const allocationFacts = a => JSON.parse(JSON.stringify(Object.fromEntries(fields.map(k => [k, a[k]]))));
  const sameProduct = (a, b) => normalize(a?.productName) === normalize(b?.productName) && normalize(a?.unit) === normalize(b?.unit);
  const productOf = a => ({ productName: normalize(a.valuationSnapshot?.source?.item?.productName), unit: normalize(a.quantityUnit) });
  const parentKey = a => a.targetType + ':' + parentId(a);
  const materialKey = a => JSON.stringify([parentKey(a), productOf(a).productName, productOf(a).unit]);
  function calculation(totalCents, parentQuantity, used, maintenanceUsed, declaredQuantity, selectedQuantity) {
    const total = quantity(parentQuantity), consumed = quantity(used?.quantity), ownUsed = quantity(maintenanceUsed?.quantity), declared = quantity(declaredQuantity), selected = quantity(selectedQuantity);
    if (!positive(totalCents) || !count(used?.amountCents) || [total, consumed, ownUsed, declared, selected].some(q => q === null) || total <= 0n || declared <= 0n || selected <= 0n || consumed > total || ownUsed > declared || used.amountCents > totalCents) return null;
    const available = total - consumed < declared - ownUsed ? total - consumed : declared - ownUsed;
    if (selected > available) return null;
    const final = selected + consumed === total;
    const amountCents = final ? totalCents - used.amountCents : Number((2n * BigInt(totalCents) * selected + total) / (2n * total));
    if (!positive(amountCents) || used.amountCents + amountCents > totalCents) return null;
    return { amountCents, rounding: final ? 'FINAL_PARENT_REMAINDER' : 'NEAREST_CENT', availableQuantity: decimal(available), remainingAmountCents: totalCents - used.amountCents - amountCents, remainingQuantity: decimal(total - consumed - selected), remainingMaintenanceQuantity: decimal(declared - ownUsed - selected) };
  }
  function facts(p) {
    const fail = () => { throw Error('Repartição dos materiais não confirmada.'); };
    const a = p?.allocationBefore, t = p?.target, m = p?.materials, c = p?.consumptionSource, item = p?.material;
    if (!p || p.available !== true || p.version !== 1 || p.basis !== basis || !positive(p.expenseId) || !positive(p.expenseVersion) || !positive(p.allocationId) || !positive(p.completionId) || !a || a.id !== p.allocationId || a.expenseId !== p.expenseId || a.valuationType !== 'MATERIAL' || !['REGULAR','EXTRA'].includes(a.targetType) || !positive(parentId(a)) || a.voidedAt !== null || a.monthRef !== p.monthRef || !positive(a.clientId) || !positive(a.purchaseItemId) || !positive(a.amountCents) || !sha(p.hash) || !sha(p.allocationHash)) fail();
    if (!iso(a.targetSnapshot?.endAt) || a.targetSnapshot.endAt.slice(0, 7) !== p.monthRef || t?.type !== 'MAINTENANCE_EQUIPMENT' || t.id !== p.completionId || t.valid !== true || t.clientId !== a.clientId || t.snapshot?.type !== t.type || t.snapshot.id !== t.id || t.snapshot.clientId !== a.clientId || !positive(t.snapshot.poolId) || t.snapshot.status !== 'CONFIRMED' || !iso(t.snapshot.endAt) || t.snapshot.endAt.slice(0, 7) !== p.monthRef || t.snapshot.originVisitType !== a.targetType || t.snapshot.originVisitId !== parentId(a) || t.snapshot.executionBasis !== 'CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION' || !positive(t.snapshot.decisionId) || !sha(t.snapshot.decisionFingerprint) || !sha(t.snapshot.executionFingerprint) || t.label !== t.snapshot.label || t.clientName !== t.snapshot.clientName) fail();
    if (m?.schema !== 1 || m.basis !== 'DECLARED_EQUIPMENT_MATERIALS' || m.mode !== 'DECLARED' || !Array.isArray(m.items) || !m.items.length || m.items.length > 20 || m.origin?.visitType !== a.targetType || m.origin.visitId !== parentId(a) || m.origin.clientId !== a.clientId || m.origin.poolId !== t.snapshot.poolId || !positive(m.origin.technicianId) || m.origin.technicianId !== a.valuationSnapshot?.source?.service?.technicianId || !item || !sameProduct(item, productOf(a)) || item.productName !== normalize(item.productName) || item.unit !== normalize(item.unit) || !item.productName || !item.unit || a.quantityUnit !== item.unit || a.purchaseItemId !== a.valuationSnapshot?.source?.item?.id) fail();
    const line = m.items.filter(row => sameProduct(row, item));
    if (line.length !== 1 || item.declaredQuantity !== line[0].quantity || !Array.isArray(c?.declarations) || c.schema !== 1 || c.basis !== 'CURRENT_NET_VISIT_CONSUMPTION' || c.visit?.visitType !== a.targetType || c.visit.visitId !== parentId(a) || c.visit.clientId !== a.clientId || c.visit.poolId !== m.origin.poolId || c.visit.technicianId !== m.origin.technicianId || c.visit.endAt !== a.targetSnapshot.endAt || !Array.isArray(c.movements) || !c.movements.length) fail();
    const declarations = c.declarations.filter(row => row.id === p.completionId);
    if (declarations.length !== 1 || !declarations[0].materials) fail();
    if (quantity(a.quantity) === null || p.parentQuantity !== decimal(quantity(a.quantity)) || quantity(p.quantity) === null || p.quantity !== decimal(quantity(p.quantity)) || !Array.isArray(p.used?.shares) || !Array.isArray(p.maintenanceUsed?.shares) || [...p.used.shares, ...p.maintenanceUsed.shares].some(s => typeof s.id !== 'string' || !sha(s.hash))) fail();
    const calc = calculation(a.amountCents, p.parentQuantity, p.used, p.maintenanceUsed, item.declaredQuantity, p.quantity);
    if (!calc || Object.entries(calc).some(([k, v]) => p[k] !== v)) fail();
    const { available, hash, ...value } = p;
    return { value, target: Object.fromEntries(targetFields.map(k => [k, t.snapshot[k]])) };
  }
  async function verify(p, hash, allocation) {
    const f = facts(p);
    const declared = p.consumptionSource.declarations.find(row => row.id === p.completionId).materials;
    const checked = await Promise.all([hash(f.value), hash(p.allocationBefore), hash(p.materials), hash(p.consumptionSource), hash(f.target), hash(declared)]);
    if (checked.some((value, i) => value !== [p.hash, p.allocationHash, p.materialsHash, p.consumptionHash, p.target.hash, p.materialsHash][i]) || allocation && await hash(allocationFacts(allocation)) !== p.allocationHash) throw Error('O cálculo não corresponde aos materiais selecionados.');
    return p;
  }
  return { basis, commands, fields, positive, count, iso, sha, normalize, quantity, decimal, parentId, parentKey, materialKey, productOf, sameProduct, allocationFacts, calculation, facts, verify };
});
