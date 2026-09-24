(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cw-reminder-visit-resource-rules'), require('./cw-maintenance-material-rules'));
  else root.CWReminderVisitCostRules = factory(root.CWReminderVisitResourceRules, root.CWMaintenanceMaterialRules);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (resources, material) {
  'use strict';
  const { positive, count, sha, iso, quantity, decimal, parentId, sameProduct, productOf, allocationFacts } = material;
  const targetFields = ['type','id','clientId','poolId','status','startAt','endAt','executionBasis','decisionId','decisionFingerprint','executionFingerprint','originVisitType','originVisitId'];
  const fail = () => { throw Error('A parcela do lembrete ou o comprovativo da visita precisa de revisão.'); };
  const value = p => { const { available, hash, ...rest } = p; return rest; };
  const identity = p => p.reminderId === undefined ? 'MAINTENANCE_EQUIPMENT:' + p.completionId : 'MAINTENANCE_REMINDER:' + p.reminderId;
  const selection = p => p.reminderId === undefined ? { completionId: p.completionId } : { reminderId: p.reminderId };
  const matchesRequest = (s, d) => s.reminderId === undefined ? d.reminderId === undefined && s.completionId === d.completionId : s.completionId === null && d.completionId === undefined && s.reminderId === d.reminderId;
  function workRecord(data, origin) {
    const intervals = resources.intervals(data).map(w => ({ startAt:w.startedAt, endAt:w.endedAt, durationMs:Date.parse(w.endedAt)-Date.parse(w.startedAt) }));
    if (!intervals.length) return null;
    return data.workIntervals === undefined
      ? { schema:1, basis:'DECLARED_REMINDER_VISIT_WORK_INTERVAL', ...intervals[0], origin }
      : { schema:2, basis:'DECLARED_REMINDER_VISIT_WORK_INTERVALS', intervals, durationMs:intervals.reduce((sum,w)=>sum+w.durationMs,0), origin };
  }
  async function target(resource, hash, clientName) {
    const p = resource.event.preview, a = p.association.event.preview, facts = {
      ...a.target, originVisitType: p.origin.visitType, originVisitId: p.origin.visitId,
      executionFingerprint: await hash({ execution: a.target.executionFingerprint, resource: resource.eventHash })
    };
    const label = 'Lembrete de serviço #' + p.reminderId + ' · ' + a.source.title + ' · ' + a.source.completedAt.slice(0, 10);
    return { type: 'MAINTENANCE_REMINDER', id: p.reminderId, clientId: p.origin.clientId, clientName, label, valid: true, hash: await hash(facts), snapshot: { ...facts, label, clientName } };
  }
  function timeCalculation(totalCents, totalMs, used, ownMs) {
    if (!positive(totalCents) || !positive(totalMs) || !positive(ownMs) || !count(used?.durationMs) || !count(used.amountCents) || used.durationMs + ownMs > totalMs || used.amountCents > totalCents) return null;
    const final = used.durationMs + ownMs === totalMs;
    const amountCents = final ? totalCents - used.amountCents : Number((2n * BigInt(totalCents) * BigInt(ownMs) + BigInt(totalMs)) / (2n * BigInt(totalMs)));
    if (!positive(amountCents) || used.amountCents + amountCents > totalCents) return null;
    return { amountCents, rounding: final ? 'FINAL_PARENT_REMAINDER' : 'NEAREST_CENT', remainingAmountCents: totalCents - used.amountCents - amountCents, remainingDurationMs: totalMs - used.durationMs - ownMs };
  }
  async function verify(p, hash, allocation) {
    const a = p?.allocationBefore, t = p?.target, proof = p?.resources, c = p?.resourceSource;
    if (p?.available !== true || !positive(p.expenseId) || !positive(p.expenseVersion) || !positive(p.allocationId) || !positive(p.reminderId) || p.completionId !== null || !a || a.id !== p.allocationId || a.expenseId !== p.expenseId || !['MATERIAL','LABOR'].includes(a.valuationType) || !['REGULAR','EXTRA'].includes(a.targetType) || !positive(parentId(a)) || a.voidedAt !== null || !positive(a.clientId) || !positive(a.amountCents) || !iso(a.targetSnapshot?.startAt) || !iso(a.targetSnapshot.endAt) || !sha(p.hash) || !sha(p.allocationHash) || !Array.isArray(p.used?.shares) || p.used.shares.some(s => !resources.uuid(s.id) || !sha(s.hash))) fail();
    await resources.response(proof, proof?.envelope, proof?.receipt?.owner, p.reminderId, hash);
    const original = proof.event.preview, origin = original.origin, data = original.selection.data;
    material.verifyPeriod(p, original.schema + 1);
    if (proof.applied !== true || original.selection.action !== 'DECLARE' || origin.visitType !== a.targetType || origin.visitId !== parentId(a) || origin.clientId !== a.clientId || origin.technicianId !== a.valuationSnapshot?.source?.service?.technicianId || proof.eventHash !== p.resourcesHash || c?.schema !== 1 || c.basis !== 'CURRENT_ASSOCIATED_REMINDER_RESOURCES' || c.resourceId !== proof.event.id || c.resourceHash !== proof.eventHash || await hash(c.parent) !== await hash(original.parent) || c.parent.startAt !== a.targetSnapshot.startAt || c.parent.endAt !== a.targetSnapshot.endAt || !Array.isArray(c.peers) || !Array.isArray(c.movements) || c.peers.some(peer => peer.type === 'REMINDER' && peer.reminderId === p.reminderId) || await hash(resources.compare(data, c.parent, c.peers, c.movements)) !== await hash(c.comparison) || await hash(c) !== p.resourceSourceHash) fail();
    const expectedTarget = await target(proof, hash, t?.clientName);
    if (!t || typeof t.clientName !== 'string' || await hash(t) !== await hash(expectedTarget) || t.snapshot.poolId !== origin.poolId || t.snapshot.status !== 'CONFIRMED') fail();
    let calculation;
    if (a.valuationType === 'MATERIAL') {
      const m = data.materials, item = p.material, lines = m?.items?.filter(row => sameProduct(row, productOf(a))) || [];
      if (p.basis !== material.basis || m?.mode !== 'DECLARED' || lines.length !== 1 || !item || !sameProduct(item, productOf(a)) || item.productName !== productOf(a).productName || item.unit !== productOf(a).unit || item.declaredQuantity !== lines[0].quantity || a.quantityUnit !== item.unit || a.purchaseItemId !== a.valuationSnapshot.source.item.id || !positive(a.purchaseItemId) || quantity(a.quantity) === null || p.parentQuantity !== decimal(quantity(a.quantity)) || quantity(p.quantity) === null || p.quantity !== decimal(quantity(p.quantity)) || !Array.isArray(p.maintenanceUsed?.shares) || p.maintenanceUsed.shares.some(s => !resources.uuid(s.id) || !sha(s.hash)) || await hash(m) !== p.materialsHash || await hash(p.materials) !== p.materialsHash) fail();
      calculation = material.calculation(a.amountCents, p.parentQuantity, p.used, p.maintenanceUsed, item.declaredQuantity, p.quantity);
    } else {
      const measured = quantity(String(a.quantity)), record = workRecord(data, origin);
      if (p.basis !== 'CONFIRMED_PARENT_COST_TIME_SHARE' || !record || a.quantityUnit !== 'SECOND' || measured === null || measured !== BigInt(p.parentDurationMs) * 1000n || await hash(record) !== p.workTimeHash || await hash(p.workTime) !== p.workTimeHash) fail();
      calculation = timeCalculation(a.amountCents, p.parentDurationMs, p.used, record.durationMs);
    }
    if (!calculation || Object.entries(calculation).some(([k, v]) => p[k] !== v) || await hash(value(p)) !== p.hash || await hash(a) !== p.allocationHash || allocation && await hash(allocationFacts(allocation)) !== p.allocationHash) fail();
    return p;
  }
  return { targetFields, identity, selection, matchesRequest, target, workRecord, timeCalculation, verify };
});
