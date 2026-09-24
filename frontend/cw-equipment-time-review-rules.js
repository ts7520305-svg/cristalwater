(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./cw-equipment-material-review-rules'));
  else root.CWEquipmentTimeReviewRules=factory(root.CWEquipmentMaterialReviewRules);
})(typeof globalThis!=='undefined'?globalThis:this,function(common){
  'use strict';
  const {fields,positive,uuid,sha,iso,origin}=common,scope='EQUIPMENT_TIME_REVIEW',basis='ADMIN_EQUIPMENT_TIME_REVIEW';
  const fail=()=>{throw Error('Os intervalos ou o comprovativo precisam de revisão. Conserve o pedido original.');};
  const instant=v=>iso(v)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v);
  const intervals=v=>v?.intervals|| (v?[{startAt:v.startAt,endAt:v.endAt}]:[]);
  function input(v){
    const rows=intervals(v);if(!(v?.intervals===undefined?fields(v,['startAt','endAt']):fields(v,['intervals']))||!Array.isArray(rows)||!rows.length||rows.length>20)fail();
    for(const [i,w]of rows.entries())if(!fields(w,['startAt','endAt'])||!instant(w.startAt)||!instant(w.endAt)||Date.parse(w.endAt)<=Date.parse(w.startAt)||i&&Date.parse(w.startAt)<Date.parse(rows[i-1].endAt))fail();
    return v.intervals?{intervals:rows.map(w=>({...w}))}:{startAt:v.startAt,endAt:v.endAt};
  }
  function record(v){
    if(!v||!fields(v.origin,['visitType','visitId','poolId','clientId','technicianId','visitStartAt'])||!origin(Object.fromEntries(Object.entries(v.origin).filter(([k])=>k!=='visitStartAt')))||!iso(v.origin.visitStartAt))fail();
    const rows=intervals(v),data=v.schema===2?{intervals:rows.map(w=>({startAt:w?.startAt,endAt:w?.endAt}))}:{startAt:v.startAt,endAt:v.endAt};input(data);
    if(v.schema===1){if(!fields(v,['schema','basis','startAt','endAt','durationMs','origin'])||v.basis!=='DECLARED_EQUIPMENT_WORK_INTERVAL')fail();}
    else if(v.schema!==2||!fields(v,['schema','basis','intervals','durationMs','origin'])||v.basis!=='DECLARED_EQUIPMENT_WORK_INTERVALS'||!Array.isArray(v.intervals)||rows.some(w=>!fields(w,['startAt','endAt','durationMs'])||w.durationMs!==Date.parse(w.endAt)-Date.parse(w.startAt)))fail();
    if(!positive(v.durationMs)||v.durationMs!==rows.reduce((n,w)=>n+Date.parse(w.endAt)-Date.parse(w.startAt),0)||rows.some(w=>Date.parse(w.startAt)<Date.parse(v.origin.visitStartAt)))fail();return v;
  }
  const asInput=v=>v?input(v.schema===2?{intervals:v.intervals.map(w=>({startAt:w.startAt,endAt:w.endAt}))}:{startAt:v.startAt,endAt:v.endAt}):null;
  const facts=p=>{const{available,hash,...v}=p;return v;};
  async function preview(p,hash){
    if(!fields(p,['available','schema','basis','completionId','origin','original','baseHash','previous','proposed','targetHash','sourceHash','beforeState','afterState','afterReasons','affectedShares','hash'])||p.available!==true||p.schema!==1||p.basis!==basis||!positive(p.completionId)||!origin(p.origin)||!sha(p.hash)||await hash(facts(p))!==p.hash||!sha(p.baseHash)||await hash(p.original)!==p.baseHash||p.original?.id!==p.completionId||!iso(p.original.completedAt)||!sha(p.original.resultHash)||!sha(p.original.receiptHash)||!sha(p.sourceHash)||!sha(p.targetHash)||!fields(p.previous,['headHash','action','record'])||p.previous.headHash!==null&&!sha(p.previous.headHash)||!['ORIGINAL','REPLACE','WITHDRAW'].includes(p.previous.action)||!fields(p.proposed,['action','record'])||!['REPLACE','WITHDRAW'].includes(p.proposed.action))fail();
    if(!fields(p.original,['id','planId','requestId','fingerprint','completedAt','resultHash','receiptHash','record'])||!positive(p.original.planId)||!uuid(p.original.requestId)||!sha(p.original.fingerprint)||(p.previous.action==='ORIGINAL')!==(p.previous.headHash===null)||p.previous.action==='WITHDRAW'&&p.previous.record!==null||p.previous.action==='REPLACE'&&p.previous.record===null||p.previous.action==='ORIGINAL'&&await hash(p.previous.record)!==await hash(p.original.record))fail();
    if(p.previous.record!==null)record(p.previous.record);
    if(p.proposed.action==='WITHDRAW'){if(p.proposed.record!==null||p.previous.record===null||p.afterState!=='WITHDRAWN')fail();}
    else {const w=record(p.proposed.record),o=w.origin;if(await hash(Object.fromEntries(Object.entries(o).filter(([k])=>k!=='visitStartAt')))!==await hash(p.origin)||await hash(p.previous.record)===await hash(w)||intervals(w).some(i=>Date.parse(i.endAt)>Date.parse(p.original.completedAt))||p.afterState!=='RECORDED')fail();}
    if(!['MISSING','RECORDED','REVIEW','WITHDRAWN'].includes(p.beforeState)||!Array.isArray(p.afterReasons)||p.afterReasons.length||!Array.isArray(p.affectedShares)||new Set(p.affectedShares.map(s=>s.id)).size!==p.affectedShares.length||p.affectedShares.some(s=>!fields(s,['id','hash','expenseId','allocationId','completionId','amountCents','durationMs'])||!uuid(s.id)||!sha(s.hash)||![s.expenseId,s.allocationId,s.completionId,s.amountCents,s.durationMs].every(positive)||s.completionId!==p.completionId))fail();return p;
  }
  async function revision(proof,hash){
    const e=proof?.revision;if(!fields(proof,['revision','hash'])||!fields(e,['schema','id','owner','completionId','reason','createdAt','preview'])||e.schema!==1||!uuid(e.id)||!/^ADMIN:[1-9]\d*$/.test(e.owner)||!iso(e.createdAt)||typeof e.reason!=='string'||e.reason!==e.reason.trim()||e.reason.length<3||e.reason.length>500||!sha(proof.hash)||await hash(e)!==proof.hash)fail();const p=await preview(e.preview,hash);if(e.completionId!==p.completionId||Date.parse(e.createdAt)<Date.parse(p.original.completedAt))fail();return proof;
  }
  function command(body){
    if(!fields(body,['requestId','action','workTime','previewHash','reason','confirmed'])||!uuid(body.requestId)||!sha(body.previewHash)||!['REPLACE','WITHDRAW'].includes(body.action)||typeof body.reason!=='string'||body.reason!==body.reason.trim()||body.reason.length<3||body.reason.length>500||body.confirmed!==true)fail();if(body.action==='WITHDRAW'){if(body.workTime!==null)fail();}else input(body.workTime);return body;
  }
  async function response(v,body,owner,id,hash){
    command(body);const{requestId,...payload}=body,r=v?.receipt;
    if(v?.ok!==true||typeof v.applied!=='boolean'||!/^ADMIN:[1-9]\d*$/.test(owner)||!positive(id)||!fields(r,['owner','requestId','scope','resourceId','payloadHash','confirmedAt'])||r.owner!==owner||r.scope!==scope||r.resourceId!==id||r.requestId!==requestId||!iso(r.confirmedAt)||r.payloadHash!==await hash({v:1,scope,resourceId:id,payload})||await hash(v.envelope)!==await hash(body))fail();
    if(!v.applied){if(typeof v.code!=='string'||typeof v.message!=='string'||v.revision!==undefined||v.revisionHash!==undefined)fail();return v;}
    const e=(await revision({revision:v.revision,hash:v.revisionHash},hash)).revision,p=e.preview;
    if(e.id!==requestId||e.owner!==owner||e.completionId!==id||e.reason!==body.reason||p.hash!==body.previewHash||p.proposed.action!==body.action||await hash(asInput(p.proposed.record))!==await hash(body.workTime)||Date.parse(r.confirmedAt)<Date.parse(e.createdAt))fail();return v;
  }
  async function share(p,hash){
    const e=(await revision(p.workTimeRevision,hash)).revision;if(e.completionId!==p.completionId||e.preview.proposed.action!=='REPLACE'||await hash(e.preview.proposed.record)!==await hash(p.workTime))fail();return p;
  }
  return {scope,basis,fields,positive,uuid,sha,iso,origin,input,record,intervals,asInput,facts,preview,revision,command,response,share};
});
