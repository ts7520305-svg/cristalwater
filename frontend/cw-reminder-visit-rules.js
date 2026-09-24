(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cw-reminder-resource-rules'));
  else root.CWReminderVisitRules = factory(root.CWReminderResourceRules);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (resources) {
  'use strict';
  const { fields, sha, iso, owner, reason } = resources;
  const positive = n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647;
  const uuid = s => resources.uuid(s) && s === s.toLowerCase();
  const scope = 'REMINDER_VISIT_ASSOCIATION', basis = 'ADMIN_EXPLICIT_REMINDER_VISIT';
  const sourceFields = ['id','title','description','category','status','completedAt','clientId','poolId','technicianId'];
  const parentFields = ['type','id','clientId','poolId','technicianId','status','startAt','endAt'];
  const targetFields = ['type','id','clientId','poolId','status','startAt','endAt','executionBasis','decisionId','decisionFingerprint','executionFingerprint','originVisitType','originVisitId'];
  const selectionFields = ['action','associationId','visitType','visitId'];
  const fail = () => { throw Error('A associação à visita ou o comprovativo precisa de revisão. Conserve o pedido original.'); };
  function input(v) {
    if (!fields(v,selectionFields) || !['LINK','UNLINK'].includes(v.action)) fail();
    if (v.action === 'LINK' ? v.associationId !== null || !['REGULAR','EXTRA'].includes(v.visitType) || !positive(v.visitId) : !uuid(v.associationId) || v.visitType !== null || v.visitId !== null) fail();
    return v;
  }
  function command(v) {
    if (!fields(v,['requestId',...selectionFields,'previewHash','reason','confirmed']) || !uuid(v.requestId) || !sha(v.previewHash) || !reason(v.reason) || v.confirmed !== true) fail();
    input(Object.fromEntries(selectionFields.map(k=>[k,v[k]]))); return v;
  }
  const facts = p => { const { available,hash,...value } = p; return value; };
  const origin = v => fields(v,['reminderId','clientId','poolId','technicianId']) && Object.values(v).every(positive);
  const parent = v => fields(v,parentFields) && ['REGULAR','EXTRA'].includes(v.type) && ['id','clientId','poolId','technicianId'].every(k=>positive(v[k])) && ['DONE','COMPLETED','CONCLUIDA','CONCLUIDO'].includes(v.status) && iso(v.startAt) && iso(v.endAt) && Date.parse(v.startAt)<Date.parse(v.endAt);
  async function preview(p,hash) {
    if (!fields(p,['available','schema','basis','reminderId','selection','previousHash','contextHash','origin','source','sourceHash','target','targetHash','parent','parentHash','original','hash']) || p.available!==true || p.schema!==1 || p.basis!==basis || !positive(p.reminderId) || !origin(p.origin) || p.origin.reminderId!==p.reminderId || !sha(p.contextHash) || p.previousHash!==null&&!sha(p.previousHash) || !sha(p.hash) || await hash(facts(p))!==p.hash) fail();
    input(p.selection);
    if (p.selection.action==='UNLINK') {
      if (p.original?.event?.preview?.selection?.action!=='LINK') fail();
      await response(p.original,p.original.envelope,p.original.event.owner,p.reminderId,hash);
      if (!p.original.applied || p.original.event.id!==p.selection.associationId || p.previousHash!==p.original.eventHash || await hash(p.origin)!==await hash(p.original.event.preview.origin) || ['source','sourceHash','target','targetHash','parent','parentHash'].some(k=>p[k]!==null)) fail();
      return p;
    }
    const s=p.source,t=p.target,v=p.parent;
    if (p.original!==null || !fields(s,sourceFields) || s.id!==p.reminderId || s.clientId!==p.origin.clientId || s.poolId!==p.origin.poolId || s.technicianId!==null&&s.technicianId!==p.origin.technicianId || typeof s.title!=='string' || s.description!==null&&typeof s.description!=='string' || !['POOL_SERVICE_REMINDER','TECHNICAL_PERIODIC_SERVICE'].includes(s.category) || !['DONE','COMPLETED','CONCLUIDA','CONCLUIDO'].includes(String(s.status).trim().toUpperCase()) || !iso(s.completedAt) || await hash(s)!==p.sourceHash) fail();
    if (!parent(v) || v.type!==p.selection.visitType || v.id!==p.selection.visitId || v.clientId!==s.clientId || v.poolId!==s.poolId || v.technicianId!==p.origin.technicianId || await hash(v)!==p.parentHash) fail();
    if (!fields(t,targetFields) || t.type!=='MAINTENANCE_REMINDER' || t.id!==s.id || t.clientId!==s.clientId || t.poolId!==s.poolId || t.status!=='CONFIRMED' || t.startAt!==null || t.endAt!==s.completedAt || t.executionBasis!=='CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION' || !positive(t.decisionId) || !sha(t.decisionFingerprint) || !sha(t.executionFingerprint) || t.originVisitType!==null || t.originVisitId!==null || await hash(t)!==p.targetHash) fail();
    return p;
  }
  async function response(v,body,actor,reminderId,hash) {
    command(body); const {requestId,...payload}=body,r=v?.receipt;
    if (v?.ok!==true || typeof v.applied!=='boolean' || !owner(actor) || !positive(reminderId) || !fields(r,['owner','requestId','scope','resourceId','payloadHash','confirmedAt']) || r.owner!==actor || r.requestId!==requestId || r.scope!==scope || r.resourceId!==reminderId || !iso(r.confirmedAt) || r.payloadHash!==await hash({v:1,scope,resourceId:reminderId,payload}) || await hash(v.envelope)!==await hash(body)) fail();
    if (!v.applied) { if (typeof v.code!=='string' || typeof v.message!=='string' || v.event!==undefined || v.eventHash!==undefined) fail(); return v; }
    const e=v.event,p=await preview(e?.preview,hash);
    if (!fields(e,['schema','basis','id','owner','reminderId','reason','createdAt','preview']) || e.schema!==1 || e.basis!==basis || e.id!==requestId || e.owner!==actor || e.reminderId!==reminderId || !iso(e.createdAt) || Date.parse(r.confirmedAt)<Date.parse(e.createdAt) || e.reason!==body.reason || p.reminderId!==reminderId || p.hash!==body.previewHash || await hash(p.selection)!==await hash(Object.fromEntries(selectionFields.map(k=>[k,body[k]]))) || await hash(e)!==v.eventHash) fail();
    const dates=body.action==='LINK'?[p.source.completedAt,p.parent.endAt]:[p.original.event.createdAt];
    if (dates.some(d=>Date.parse(e.createdAt)<Date.parse(d))) fail(); return v;
  }
  return {scope,basis,fields,positive,uuid,sha,iso,owner,reason,sourceFields,parentFields,targetFields,selectionFields,input,command,facts,origin,parent,preview,response};
});
