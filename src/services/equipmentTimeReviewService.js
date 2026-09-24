'use strict';
const {prisma}=require('../prismaClient'),r=require('./fieldWriteRequestService'),time=require('./equipmentWorkTimeService'),targets=require('./expenseMaintenanceTargets');
const {journal}=time,{rules}=journal,json=v=>JSON.parse(JSON.stringify(v)),refuse=(code,message)=>({available:false,code,message});
const id=v=>{const n=Number(v);if(!rules.positive(n)||n>2147483647||String(n)!==String(v))r.fail('Identificador inválido.');return n;};
function admin(user){if(!require('../utils/roles').roleMatches(user?.role,'ADMIN'))r.fail('Só a administração pode corrigir tempos de equipamento.',403);return r.owner(user);}
function parse(body,command=false){try{if(command)rules.command(body);else {if(!rules.fields(body,['action','workTime'])||!['REPLACE','WITHDRAW'].includes(body.action))throw Error();if(body.action==='WITHDRAW'){if(body.workTime!==null)throw Error();}else time.parse(body.workTime);}}catch(_){r.fail('Reveja os intervalos, o motivo e a confirmação.');}}
const parent=row=>row&&!!row.visitId!==!!row.extraVisitId?{visitType:row.visitId?'REGULAR':'EXTRA',visitId:row.visitId||row.extraVisitId}:null;
async function context(db,completionId,lock=false){
  let row=await db.equipmentMaintenanceCompletion.findUnique({where:{id:completionId}});if(!row)return refuse('NOT_FOUND','Revisão não encontrada.');const p=parent(row);if(!p)return refuse('ORIGIN_REVIEW','A visita de origem precisa de revisão.');
  if(lock){
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'maintenance-material-share:'+p.visitType+':'+p.visitId }))::text`;
    await targets.get(db,'MAINTENANCE_EQUIPMENT',completionId,true);
    if(p.visitType==='REGULAR')await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${p.visitId} FOR UPDATE`;else await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${p.visitId} FOR UPDATE`;
    row=await db.equipmentMaintenanceCompletion.findUnique({where:{id:completionId}});if(r.hash(parent(row))!==r.hash(p))return refuse('ORIGIN_CHANGED','A visita de origem mudou. Atualize a revisão.');
  }
  const [visit,rows,target]=await Promise.all([db[p.visitType==='REGULAR'?'serviceVisit':'extraVisit'].findUnique({where:{id:p.visitId},select:{id:true,poolId:true,clientId:true,technicianId:true,status:true,startAt:true,endAt:true}}),db.equipmentMaintenanceCompletion.findMany({where:{[p.visitType==='REGULAR'?'visitId':'extraVisitId']:p.visitId},select:time.selection,orderBy:{id:'asc'}}),targets.get(db,'MAINTENANCE_EQUIPMENT',completionId)]);
  if(!visit)return refuse('ORIGIN_REVIEW','Visita de origem indisponível.');
  if(lock){
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'repair-work-technician:'+visit.technicianId }))::text`;
    for(const source of rows)await db.$queryRaw`SELECT id FROM "FieldWriteRequest" WHERE (scope='EQUIPMENT_MAINTENANCE' AND "requestId"=${source.requestId}) OR (scope='EQUIPMENT_TIME_REVIEW' AND "resourceId"=${source.id}) FOR SHARE`;
  }
  const prepared=await time.prepareRead(db,[{rows,visit,visitType:p.visitType}]),state=prepared.revisions.get(completionId),original=journal.original(rows.find(v=>v.id===completionId),[...prepared.proofs.values()]),current=(await time.describe(db,rows,visit,p.visitType,prepared)).get(completionId),origin={...p,poolId:visit.poolId,clientId:visit.clientId,technicianId:visit.technicianId};
  const [pool,technician]=await Promise.all([visit.poolId?db.pool.findUnique({where:{id:visit.poolId},select:{name:true}}):null,visit.technicianId?db.technician.findUnique({where:{id:visit.technicianId},select:{name:true}}):null]);
  const anchor=original.record?.origin||row.result?.completion?.materials?.origin,originTrusted=anchor?Object.entries(origin).every(([k,v])=>anchor[k]===v)&&(anchor.visitStartAt===undefined||anchor.visitStartAt===visit.startAt?.toISOString()):new RegExp('^(?:USER:[1-9]\\d*:)?TECH:'+visit.technicianId+'$').test(row.result?.receipt?.owner);
  const editable=originTrusted&&time.effective(rows.find(v=>v.id===completionId),prepared).valid&&target?.valid&&rules.origin(origin)&&target.snapshot.originVisitType===p.visitType&&target.snapshot.originVisitId===p.visitId&&target.clientId===visit.clientId&&target.snapshot.poolId===visit.poolId&&visit.startAt instanceof Date&&+row.completedAt>=+visit.startAt;
  return {available:true,completionId,title:row.result?.plan?.title||'Revisão #'+completionId,origin,clientName:target?.clientName||'',poolName:pool?.name||'',technicianName:technician?.name||'',original,originalHash:r.hash(original),current,history:state?.history||[],journalValid:!!state?.valid,editable:!!editable,message:editable?'A correção ficará atribuída à administração. O comprovativo original e os custos existentes serão conservados.':'Confirme a execução, a decisão comercial, a origem e o recibo original antes de corrigir tempos.',row,rows,visit,target,state,prepared};
}
function publicContext(c){if(!c.available)return c;const{row,rows,visit,target,state,prepared,...v}=c;return v;}
async function calculate(db,completionId,body,lock=false){
  parse(body);const c=await context(db,completionId,lock);if(!c.available)return c;if(!c.editable)return refuse('TIME_SOURCE_REVIEW',c.message);
  const proposed={action:body.action,record:body.workTime?time.create(time.parse(body.workTime),c.visit,c.origin.visitType):null},previous={headHash:c.state.headHash,action:c.state.action,record:c.state.record};
  if(r.hash(previous.record)===r.hash(proposed.record))return refuse('NO_CHANGE','A declaração proposta coincide com o registo atual.');
  if(body.workTime){const issue=await time.check(db,body.workTime,c.visit,c.origin.visitType,c.row.completedAt,completionId);if(issue)return refuse('TIME_LIMIT',issue);}
  const allocations=await db.expenseAllocation.findMany({where:{valuationType:'LABOR',targetType:c.origin.visitType,[c.origin.visitType==='REGULAR'?'visitId':'extraVisitId']:c.origin.visitId},select:{expenseId:true}}),costs=await require('./maintenanceLaborShareService').journal(db,[...new Set(allocations.map(a=>a.expenseId))]);
  if([...costs.values()].some(s=>s.review))return refuse('TIME_COST_HISTORY_REVIEW','Reveja os comprovativos das parcelas de trabalho antes de alterar os tempos.');
  const affectedShares=[...costs.values()].flatMap(s=>s.records).filter(s=>!s.voidedAt&&s.share.reminderId===undefined&&s.share.completionId===completionId).map(s=>({id:s.share.id,hash:s.hash,expenseId:s.share.expenseId,allocationId:s.share.allocationId,completionId,amountCents:s.share.preview.amountCents,durationMs:s.share.preview.workTime.durationMs})).sort((a,b)=>a.id.localeCompare(b.id));
  const sourceHash=r.hash(json({visit:c.visit,originals:c.rows.map(row=>journal.original(row,[...c.prepared.proofs.values()])),revisions:[...c.prepared.revisions].map(([id,s])=>({id,valid:s.valid,headHash:s.headHash})),associated:c.prepared.associated.get(c.origin.visitType+':'+c.origin.visitId),conflicts:[...c.prepared.conflicts].sort()}));
  const value={schema:1,basis:rules.basis,completionId,origin:c.origin,original:c.original,baseHash:c.originalHash,previous,proposed,targetHash:c.target.hash,sourceHash,beforeState:c.current.state,afterState:body.action==='WITHDRAW'?'WITHDRAWN':'RECORDED',afterReasons:[],affectedShares};return rules.preview({available:true,...value,hash:r.hash(value)},r.hash);
}
async function detail(user,value){admin(user);const cid=id(value);return prisma.$transaction(async db=>({ok:true,declaration:publicContext(await context(db,cid))}),{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});}
async function preview(user,value,body){admin(user);const cid=id(value);parse(body);return prisma.$transaction(async db=>({ok:true,preview:await calculate(db,cid,body)}),{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});}
async function command(user,value,body){
  const owner=admin(user),cid=id(value);parse(body,true);const{requestId,...payload}=body,request=r.context(user,rules.scope,cid,requestId,payload);
  return prisma.$transaction(async db=>{
    const saved=await r.recover(db,request);if(saved)return saved;const p=await calculate(db,cid,{action:body.action,workTime:body.workTime},true);
    if(!p.available||p.hash!==body.previewHash)return r.confirm(db,request,{ok:true,applied:false,envelope:body,code:p.code||'PREVIEW_CHANGED',message:p.message||'Os tempos, as origens ou as parcelas mudaram. Atualize e confirme novamente.'});
    const revision={schema:1,id:requestId,owner,completionId:cid,reason:body.reason,createdAt:new Date().toISOString(),preview:p},response=await r.confirm(db,request,{ok:true,applied:true,envelope:body,revision,revisionHash:r.hash(revision)});await rules.response(response,body,owner,cid,r.hash);
    await db.technicalHistory.create({data:{poolId:p.origin.poolId,type:rules.scope,status:body.action==='WITHDRAW'?'WITHDRAWN':'CORRECTED',message:'Tempos da revisão #'+cid+': '+body.reason,description:JSON.stringify({requestId,revisionHash:response.revisionHash,previousHash:p.previous.headHash}),performedAt:new Date(revision.createdAt)}});
    await db.userAuditLog.create({data:{actor:owner,action:rules.scope,entity:'EquipmentMaintenanceCompletion',entityId:String(cid),metadata:{requestId,revisionHash:response.revisionHash,action:body.action,affectedShareIds:p.affectedShares.map(s=>s.id)}}});return response;
  },{isolationLevel:'ReadCommitted',maxWait:15000,timeout:25000});
}
async function recover(user,requestId){const owner=admin(user);if(!rules.uuid(requestId))r.fail('Identificador de pedido inválido.');const saved=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner,requestId}}});if(!saved||saved.scope!==rules.scope)r.fail('Não existe confirmação deste pedido para esta conta.',404);return saved.response;}
module.exports={detail,preview,command,recover,calculate,context};
