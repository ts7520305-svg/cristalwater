'use strict';
const {prisma}=require('../prismaClient'),writes=require('./fieldWriteRequestService'),rules=require('../../frontend/cw-visit-report-origin-rules');
const json=v=>JSON.parse(JSON.stringify(v)),fail=(message,statusCode=400)=>writes.fail(message,statusCode,'REPORT_ORIGIN_REVIEW'),iso=v=>v?.toISOString()||null;
const include=type=>({client:{select:{id:true,name:true}},pool:{select:{id:true,name:true,clientId:true,client:{select:{name:true}}}},...(type==='EXTRA'?{technician:{select:{name:true}}}:{chemicals:{orderBy:{id:'asc'}}}),photos:{orderBy:{id:'asc'}}});
function identity(type,value){if(!rules.types.includes(type)||!rules.positive(Number(value))||String(Number(value))!==String(value))fail('Visita inválida.');return {type,id:Number(value),model:type==='EXTRA'?'extraVisit':'serviceVisit'};}
function admin(actor){if(!require('../utils/roles').roleMatches(actor?.role,'ADMIN'))fail('Só a administração pode rever a origem do relatório.',403);return writes.owner(actor);}
function technicalSource(type,v){
 const keys=type==='EXTRA'?['scheduledAt','execution','internalNote','notes']:['plannedDate','technicianName','ph','chlorine','alkalinity','salt','temperature','orpMv','cleaned','brushed','vacuumed','basketCleaned','waterlineClean','backwashDone','notes','internalNotes'];
 const content=Object.fromEntries(keys.map(k=>[k,v[k]??null]));if(type==='EXTRA')content.technicianName=v.technician?.name||null;else content.chemicals=(v.chemicals||[]).map(c=>({id:c.id,name:c.name,quantity:c.quantity,unit:c.unit}));
 content.photos=(v.photos||[]).map(p=>({id:p.id,type:p.type,url:p.url}));
 return json({visitType:type,visitId:v.id,clientId:v.clientId,poolId:v.poolId,technicianId:v.technicianId,status:v.status,startAt:iso(v.startAt),endAt:iso(v.endAt),content});
}
async function journal(db,type,id){
 const rows=await db.fieldWriteRequest.findMany({where:{scope:rules.scope(type),resourceId:id},orderBy:{id:'asc'},take:1001}),state={valid:rows.length<=1000,previous:{hash:null,action:'ORIGINAL',details:null},active:null,records:[]};
 for(const row of rows){try{
  const r=await rules.response(row.response,row.response?.envelope,row.owner,type,id,writes.hash);if(row.payloadHash!==r.receipt.payloadHash||row.requestId!==r.receipt.requestId)throw Error('Stored receipt changed');if(!r.applied)continue;
  const p=r.event.preview;if(writes.hash(p.previous)!==writes.hash(state.previous))throw Error('History changed');
  state.previous={hash:r.eventHash,action:p.selection.action,details:p.selection.details};state.active=p.selection.action==='REPLACE'?r:null;state.records.push(r);
 }catch(_){state.valid=false;}}
 return state;
}
async function context(db,type,id,lock=false){
 const key=identity(type,id);
 if(lock){if(type==='EXTRA')await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${key.id} FOR UPDATE`;else await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${key.id} FOR UPDATE`;}
 let visit=await db[key.model].findUnique({where:{id:key.id},include:include(type)});if(!visit)fail('Visita não encontrada.',404);
 if(lock){if(visit.poolId)await db.$queryRaw`SELECT id FROM "Pool" WHERE id=${visit.poolId} FOR SHARE`;if(visit.clientId)await db.$queryRaw`SELECT id FROM "Client" WHERE id=${visit.clientId} FOR SHARE`;visit=await db[key.model].findUniqueOrThrow({where:{id:key.id},include:include(type)});}
 const history=await journal(db,type,key.id),source=technicalSource(type,visit),sourceHash=writes.hash(source),client=visit.client?{id:visit.client.id,name:visit.client.name||''}:null,currentPool=visit.pool?{id:visit.pool.id,clientId:visit.pool.clientId,name:visit.pool.name||'',clientName:visit.pool.client?.name||''}:null;
 let eligible=true;try{rules.source(source);if(Date.parse(source.endAt)>Date.now())eligible=false;}catch(_){eligible=false;}
 const current=history.active,state=!history.valid?'REVIEW':current?(current.event.preview.sourceHash===sourceHash?'CONFIRMED':'REVIEW'):history.previous.action==='WITHDRAW'?'WITHDRAWN':'MISSING';
 const facts={sourceHash,client,currentPool,previous:history.previous},contextHash=writes.hash(facts);
 return {visit,history,source,sourceHash,client,currentPool,contextHash,state,canReplace:history.valid&&!!client&&!!currentPool&&eligible,canWithdraw:history.valid&&!!current&&!!client&&!!currentPool};
}
async function calculate(db,type,id,body,lock=false){
 try{rules.selection(body);}catch(_){fail('Reveja os dados históricos indicados.');}
 const c=await context(db,type,id,lock);if(body.action==='REPLACE'?!c.canReplace:!c.canWithdraw)return {available:false,code:'ORIGIN_NOT_REVIEWABLE',message:'Reveja a conclusão, o cliente histórico e os comprovativos originais antes de confirmar.'};
 if(body.action==='REPLACE'&&c.state==='CONFIRMED'&&writes.hash(c.history.previous.details)===writes.hash(body.details))return {available:false,code:'NO_CHANGE',message:'Os dados históricos já estão confirmados sem alterações.'};
 const value={schema:1,basis:rules.basis,source:c.source,sourceHash:c.sourceHash,client:c.client,currentPool:c.currentPool,selection:body,previous:c.history.previous,contextHash:c.contextHash};return rules.preview({available:true,...value,hash:writes.hash(value)},writes.hash);
}
async function detail(actor,type,id){admin(actor);identity(type,id);return prisma.$transaction(async db=>{const c=await context(db,type,id);return {ok:true,detail:{visitType:type,visitId:Number(id),source:c.source,sourceHash:c.sourceHash,client:c.client,currentPool:c.currentPool,contextHash:c.contextHash,state:c.state,canReplace:c.canReplace,canWithdraw:c.canWithdraw,previous:c.history.previous,current:c.history.active,history:c.history.records.slice(-20),historyTotal:c.history.records.length,historyLimit:20,journalValid:c.history.valid}};},{isolationLevel:'RepeatableRead',maxWait:15000,timeout:25000});}
async function preview(actor,type,id,body){admin(actor);identity(type,id);return prisma.$transaction(async db=>({ok:true,preview:await calculate(db,type,id,body)}),{isolationLevel:'RepeatableRead',maxWait:15000,timeout:25000});}
async function command(actor,type,id,body){
 const owner=admin(actor),key=identity(type,id);try{rules.command(body);}catch(_){fail('Confirme a proposta e o motivo da revisão.');}const{requestId,...payload}=body,request=writes.context(actor,rules.scope(type),key.id,requestId,payload);
 return prisma.$transaction(async db=>{
  const old=await writes.recover(db,request);if(old)return rules.response(old,body,owner,type,key.id,writes.hash);const p=await calculate(db,type,key.id,rules.select(body),true);
  if(!p.available||p.hash!==body.previewHash)return writes.confirm(db,request,{ok:true,applied:false,envelope:body,code:p.code||'PREVIEW_CHANGED',message:p.message||'O relatório ou a revisão mudou. Consulte e reveja a proposta.'});
  const createdAt=new Date(),event={schema:1,id:requestId,owner,visitType:type,visitId:key.id,reason:body.reason,createdAt:createdAt.toISOString(),preview:p},eventHash=writes.hash(event),result=await writes.confirm(db,request,{ok:true,applied:true,envelope:body,event,eventHash});
  await rules.response(result,body,owner,type,key.id,writes.hash);
  const metadata={visitType:type,visitId:key.id,requestId,eventHash,sourceHash:p.sourceHash,action:body.action};
  await db.technicalHistory.create({data:{poolId:p.source.poolId,type:'VISIT_REPORT_ORIGIN',status:body.action==='REPLACE'?'CONFIRMED':'WITHDRAWN',message:'Revisão administrativa da origem do relatório '+type+' #'+key.id,description:JSON.stringify(metadata),performedAt:createdAt}});
  await db.userAuditLog.create({data:{actor:owner,action:rules.scope(type),entity:type==='EXTRA'?'ExtraVisit':'ServiceVisit',entityId:String(key.id),metadata}});return result;
 },{isolationLevel:'ReadCommitted',maxWait:15000,timeout:30000});
}
async function recover(actor,type,id,requestId){const owner=admin(actor),key=identity(type,id);if(!rules.uuid(requestId))fail('Identificador de envio inválido.');const row=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner,requestId}}});if(!row||row.scope!==rules.scope(type)||row.resourceId!==key.id)fail('Não existe confirmação deste pedido para esta conta e visita.',404);return rules.response(row.response,row.response?.envelope,owner,type,key.id,writes.hash);}
async function reportReview(db,type,visit){
 const state=await journal(db,type,visit.id);if(!state.valid)fail('O histórico de revisão do relatório precisa de conferência.',409);if(!state.active)return null;
 const p=state.active.event.preview;
 // The report reader limits photographs to 24. Load complete metadata only
 // for reviewed reports so changes beyond that display limit cannot go unseen.
 let complete=visit;if((visit._count?.photos||0)>(visit.photos||[]).length)complete={...visit,photos:await db[type==='EXTRA'?'extraVisitPhoto':'visitPhoto'].findMany({where:type==='EXTRA'?{extraVisitId:visit.id}:{visitId:visit.id},orderBy:{id:'asc'}})};
 if(writes.hash(technicalSource(type,complete))!==p.sourceHash)fail('O registo da visita mudou depois da revisão histórica. Peça nova conferência.',409);
 return {hash:state.active.eventHash,createdAt:state.active.event.createdAt,owner:state.active.event.owner,reason:state.active.event.reason,client:p.client,details:p.selection.details};
}
module.exports={rules,identity,technicalSource,journal,context,detail,preview,command,recover,reportReview};
