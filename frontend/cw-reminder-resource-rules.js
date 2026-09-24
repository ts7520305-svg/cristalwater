(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cw-equipment-material-review-rules'));
  else root.CWReminderResourceRules = factory(root.CWEquipmentMaterialReviewRules);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (materials) {
  'use strict';
  const { fields, positive, uuid, sha, iso } = materials;
  const scope = 'REMINDER_RESOURCES', basis = 'ADMIN_INDEPENDENT_REMINDER_RESOURCES';
  const fail = () => { throw Error('A declaração ou a confirmação do lembrete precisa de revisão. Conserve o pedido original.'); };
  const owner = value => typeof value === 'string' && /^ADMIN:[1-9]\d*$/.test(value);
  const reason = value => typeof value === 'string' && value === value.trim() && value.length >= 3 && value.length <= 500 && !/[\u0000-\u001f]/.test(value);
  const second = value => iso(value) && /\.000Z$/.test(value);
  const intervals = value => value?.workIntervals || (value?.workTime ? [value.workTime] : []);
  const duration = value => intervals(value).length ? intervals(value).reduce((n,w)=>n+(Date.parse(w.endedAt)-Date.parse(w.startedAt))/1000,0) : null;
  function input(value) {
    if(value?.workIntervals!==undefined){
      if(!fields(value,['technicianId','materials','workIntervals'])||!Array.isArray(value.workIntervals)||value.workIntervals.length<1||value.workIntervals.length>20)fail();
      const d=input({technicianId:value.technicianId,materials:value.materials,workTime:value.workIntervals[0]});
      for(const [i,w]of value.workIntervals.entries()){input({technicianId:value.technicianId,materials:null,workTime:w});if(i&&Date.parse(w.startedAt)<Date.parse(value.workIntervals[i-1].endedAt))fail();}
      return {technicianId:d.technicianId,materials:d.materials,workIntervals:value.workIntervals};
    }
    if (!fields(value, ['technicianId','materials','workTime']) || !positive(value.technicianId) || value.materials === null && value.workTime === null) fail();
    const declared = value.materials === null ? null : materials.input(value.materials);
    if (value.workTime !== null && (!fields(value.workTime, ['startedAt','endedAt']) || !second(value.workTime.startedAt) || !second(value.workTime.endedAt) || Date.parse(value.workTime.endedAt) <= Date.parse(value.workTime.startedAt))) fail();
    return { technicianId: value.technicianId, materials: declared, workTime: value.workTime };
  }
  const facts = p => { const { available, hash, ...value } = p; return value; };
  const origin = value => fields(value, ['reminderId','clientId','poolId','technicianId']) && Object.values(value).every(positive);
  async function preview(p, hash) {
    if (p?.available !== true || ![1,2].includes(p.schema) || p.basis !== basis || !positive(p.reminderId) || !origin(p.origin) || p.origin.reminderId !== p.reminderId || !sha(p.contextHash) || !sha(p.hash) || await hash(facts(p)) !== p.hash || !['DECLARE','VOID'].includes(p.action)) fail();
    if (p.action === 'VOID') {
      if (!positive(p.recordId) || !sha(p.recordHash) || p.proposed !== null || p.source !== null || p.target !== null || p.sourceHash !== null || p.targetHash !== null || p.durationSeconds !== null) fail();
      // Older receipts did not carry cost impacts. Their original hashes remain valid.
      if (p.affectedCosts !== undefined && (!Array.isArray(p.affectedCosts) || p.affectedCosts.some((c,i,a) => !fields(c,['allocationId','expenseId','amountCents','workIntervalId','groupId','allocationHash']) || !positive(c.allocationId) || !positive(c.expenseId) || !positive(c.amountCents) || c.workIntervalId !== p.recordId || c.groupId !== null && !positive(c.groupId) || !sha(c.allocationHash) || i > 0 && c.allocationId <= a[i-1].allocationId))) fail();
      return p;
    }
    if (p.affectedCosts !== undefined) fail();
    const s = p.source, t = p.target, d = input(p.proposed);
    if(p.schema!==(d.workIntervals===undefined?1:2))fail();
    if (p.recordId !== null || p.recordHash !== null || await hash(d) !== await hash(p.proposed) || d.technicianId !== p.origin.technicianId || !s || s.id !== p.reminderId || s.clientId !== p.origin.clientId || s.poolId !== p.origin.poolId || !['TECHNICAL_PERIODIC_SERVICE','POOL_SERVICE_REMINDER'].includes(s.category) || !['DONE','COMPLETED','CLOSED'].includes(s.status) || !iso(s.completedAt) || s.technicianId !== null && s.technicianId !== d.technicianId || await hash(s) !== p.sourceHash) fail();
    if (!t || t.type !== 'MAINTENANCE_REMINDER' || t.id !== p.reminderId || t.clientId !== s.clientId || t.poolId !== s.poolId || t.status !== 'CONFIRMED' || t.endAt !== s.completedAt || t.startAt !== null || t.originVisitType !== null || t.originVisitId !== null || t.executionBasis !== 'CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION' || !positive(t.decisionId) || !sha(t.decisionFingerprint) || !sha(t.executionFingerprint) || await hash(t) !== p.targetHash) fail();
    const seconds = duration(d);
    if (p.durationSeconds !== seconds || seconds !== null && (!Number.isSafeInteger(seconds) || seconds <= 0 || intervals(d).some(w=>Date.parse(w.endedAt)>Date.parse(s.completedAt)))) fail();
    return p;
  }
  async function response(value, body, actor, reminderId, hash) {
    const { requestId, ...payload } = body || {}, receipt = value?.receipt;
    if (value?.ok !== true || typeof value.applied !== 'boolean' || !uuid(requestId) || !owner(actor) || !positive(reminderId) || receipt?.scope !== scope || receipt.resourceId !== reminderId || receipt.owner !== actor || receipt.requestId !== requestId || !iso(receipt.confirmedAt) || receipt.payloadHash !== await hash({ v:1,scope,resourceId:reminderId,payload }) || await hash(value.envelope) !== await hash(body)) fail();
    if (!value.applied) { if (typeof value.code !== 'string' || typeof value.message !== 'string' || value.event !== undefined || value.eventHash !== undefined) fail(); return value; }
    const e = value.event, p = await preview(e?.preview, hash);
    if (e.schema !== p.schema || e.basis !== basis || e.id !== requestId || e.owner !== actor || e.reminderId !== reminderId || !positive(e.recordId) || !iso(e.createdAt) || e.reason !== body.reason || !reason(e.reason) || body.confirmed !== true || p.reminderId !== reminderId || p.action !== body.action || p.hash !== body.previewHash || p.recordId !== body.recordId || await hash(p.proposed) !== await hash(body.data) || body.action === 'VOID' && e.recordId !== body.recordId || await hash(e) !== value.eventHash) fail();
    return value;
  }
  return { scope,basis,fields,positive,uuid,sha,iso,owner,reason,input,intervals,duration,facts,origin,preview,response };
});
