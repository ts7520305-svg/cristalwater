(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.CWVisitReportOriginRules=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const basis='ADMIN_HISTORICAL_VISIT_REPORT_ORIGIN',types=['REGULAR','EXTRA'];
 const fail=()=>{throw Error('A revisão histórica do relatório ou o seu comprovativo precisa de revisão. Conserve o pedido original.');};
 const fields=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647,sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
 const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
 const text=(v,min,max)=>typeof v==='string'&&v===v.trim()&&v.length>=min&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
 const owner=v=>typeof v==='string'&&/^ADMIN:[1-9]\d*$/.test(v);
 function scope(type){if(!types.includes(type))fail();return type+'_REPORT_ORIGIN';}
 function details(v){if(!fields(v,['poolName','zone','address','evidence'])||!text(v.poolName,1,200)||!text(v.zone,0,200)||!text(v.address,0,500)||!text(v.evidence,10,2000))fail();return v;}
 function selection(v){if(!fields(v,['action','details'])||!['REPLACE','WITHDRAW'].includes(v.action))fail();if(v.action==='WITHDRAW'){if(v.details!==null)fail();}else details(v.details);return v;}
 const select=v=>({action:v.action,details:v.details});
 function command(v){if(!fields(v,['requestId','action','details','previewHash','reason','confirmed'])||!uuid(v.requestId)||!sha(v.previewHash)||!text(v.reason,3,500)||v.confirmed!==true)fail();selection(select(v));return v;}
 function source(v){if(!fields(v,['visitType','visitId','clientId','poolId','technicianId','status','startAt','endAt','content'])||!types.includes(v.visitType)||![v.visitId,v.clientId,v.poolId].every(positive)||v.technicianId!==null&&!positive(v.technicianId)||!['DONE','COMPLETED','CONCLUIDA','CONCLUIDO'].includes(v.status)||!iso(v.startAt)||!iso(v.endAt)||Date.parse(v.endAt)<=Date.parse(v.startAt)||!v.content||typeof v.content!=='object'||Array.isArray(v.content))fail();return v;}
 const facts=p=>{const{available,hash,...v}=p;return v;};
 const contextFacts=p=>({sourceHash:p.sourceHash,client:p.client,currentPool:p.currentPool,previous:p.previous});
 async function preview(p,hash){
  if(!fields(p,['available','schema','basis','source','sourceHash','client','currentPool','selection','previous','contextHash','hash'])||p.available!==true||p.schema!==1||p.basis!==basis||!sha(p.sourceHash)||await hash(p.source)!==p.sourceHash||!sha(p.hash)||await hash(facts(p))!==p.hash||!sha(p.contextHash)||await hash(contextFacts(p))!==p.contextHash)fail();
  selection(p.selection);const s=p.source;if(!s||!types.includes(s.visitType)||!positive(s.visitId)||!positive(s.poolId)||!fields(p.client,['id','name'])||p.client.id!==s.clientId||!positive(p.client.id)||typeof p.client.name!=='string'||!fields(p.currentPool,['id','clientId','name','clientName'])||p.currentPool.id!==s.poolId||p.currentPool.clientId!==null&&!positive(p.currentPool.clientId)||typeof p.currentPool.name!=='string'||typeof p.currentPool.clientName!=='string')fail();
  const old=p.previous;if(!fields(old,['hash','action','details'])||old.hash!==null&&!sha(old.hash)||!['ORIGINAL','REPLACE','WITHDRAW'].includes(old.action)||(old.action==='ORIGINAL')!==(old.hash===null))fail();if(old.action==='REPLACE')details(old.details);else if(old.details!==null)fail();
  if(p.selection.action==='REPLACE')source(s);else if(old.action!=='REPLACE')fail();return p;
 }
 async function response(v,body,actor,type,id,hash){
  command(body);const{requestId,...payload}=body,r=v?.receipt;
  if(!owner(actor)||!positive(id)||v?.ok!==true||typeof v.applied!=='boolean'||!fields(r,['owner','requestId','scope','resourceId','payloadHash','confirmedAt'])||r.owner!==actor||r.scope!==scope(type)||r.resourceId!==id||r.requestId!==requestId||!iso(r.confirmedAt)||r.payloadHash!==await hash({v:1,scope:scope(type),resourceId:id,payload})||await hash(v.envelope)!==await hash(body))fail();
  if(!v.applied){if(typeof v.code!=='string'||typeof v.message!=='string'||v.event!==undefined||v.eventHash!==undefined)fail();return v;}
  const e=v.event;if(!fields(e,['schema','id','owner','visitType','visitId','reason','createdAt','preview'])||e.schema!==1||e.id!==requestId||e.owner!==actor||e.visitType!==type||e.visitId!==id||e.reason!==body.reason||!iso(e.createdAt)||!sha(v.eventHash)||await hash(e)!==v.eventHash||Date.parse(r.confirmedAt)<Date.parse(e.createdAt))fail();
  const p=await preview(e.preview,hash);if(p.source.visitType!==type||p.source.visitId!==id||p.hash!==body.previewHash||await hash(p.selection)!==await hash(select(body))||p.selection.action==='REPLACE'&&Date.parse(p.source.endAt)>Date.parse(e.createdAt))fail();return v;
 }
 return {basis,types,fields,positive,sha,uuid,iso,text,owner,scope,details,selection,select,command,source,facts,contextFacts,preview,response};
});
