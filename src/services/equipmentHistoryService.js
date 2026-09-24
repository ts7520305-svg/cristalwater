'use strict';
// An administrative attestation has its own evidence, author and date. It never
// manufactures the missing technical receipt or rewrites the original record.
const {prisma}=require('../prismaClient'),r=require('./fieldWriteRequestService'),rules=require('../../frontend/cw-equipment-history-rules'),targets=require('./expenseMaintenanceTargets');
const journal=require('./equipmentMaterialReviewJournal').create(rules,'originReview'),json=v=>JSON.parse(JSON.stringify(v)),refuse=(code,message)=>({available:false,code,message});
const sourceSelect=Object.fromEntries(rules.sourceFields.map(k=>[k,true]));
const id=v=>{const n=Number(v);if(!rules.positive(n)||n>2147483647||String(n)!==String(v))r.fail('Identificador inválido.');return n;};
function admin(user){if(!require('../utils/roles').roleMatches(user?.role,'ADMIN'))r.fail('Só a administração pode rever origens históricas.',403);return r.owner(user);}
function parse(body,command=false){try{if(command)rules.command(body);else {if(!rules.fields(body,['action','originReview'])||!['REPLACE','WITHDRAW'].includes(body.action))throw Error();if(body.action==='WITHDRAW'){if(body.originReview!==null)throw Error();}else rules.input(body.originReview);}}catch(_){r.fail('Confirme o técnico histórico, a evidência, o motivo e a origem selecionada.');}}
const parentOf=row=>row&&!!row.visitId!==!!row.extraVisitId?{type:row.visitId?'REGULAR':'EXTRA',id:row.visitId||row.extraVisitId}:null;
async function context(db,completionId,lock=false){
  let row=await db.equipmentMaintenanceCompletion.findUnique({where:{id:completionId},select:sourceSelect});if(!row)return refuse('NOT_FOUND','Revisão não encontrada.');const p=parentOf(row);if(!p)return refuse('ORIGIN_REVIEW','A visita de origem precisa de revisão.');
  if(lock){
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'maintenance-material-share:'+p.type+':'+p.id }))::text`;
    await targets.get(db,'MAINTENANCE_EQUIPMENT',completionId,true);
    if(p.type==='REGULAR')await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${p.id} FOR UPDATE`;else await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${p.id} FOR UPDATE`;
    await db.$queryRaw`SELECT id FROM "FieldWriteRequest" WHERE (scope='EQUIPMENT_MAINTENANCE' AND "requestId"=${row.requestId}) OR (scope=${rules.scope} AND "resourceId"=${completionId}) FOR SHARE`;
    row=await db.equipmentMaintenanceCompletion.findUnique({where:{id:completionId},select:sourceSelect});if(r.hash(parentOf(row))!==r.hash(p))return refuse('ORIGIN_CHANGED','A visita de origem mudou. Atualize a revisão.');
  }
  const [parent,target,receipts]=await Promise.all([require('./reminderVisitService').parent(db,p.type,p.id),targets.get(db,'MAINTENANCE_EQUIPMENT',completionId),db.fieldWriteRequest.findMany({where:{scope:'EQUIPMENT_MAINTENANCE',requestId:row.requestId},select:{owner:true,requestId:true,resourceId:true,payloadHash:true,response:true}})]);
  if(!parent)return refuse('ORIGIN_REVIEW','Visita de origem indisponível.');
  const origin={visitType:p.type,visitId:p.id,poolId:parent.poolId,clientId:parent.clientId,technicianId:parent.technicianId};if(!rules.origin(origin))return refuse('ORIGIN_REVIEW','Confirme primeiro o cliente, a piscina e o técnico da visita.');
  const [pool,technician]=await Promise.all([db.pool.findUnique({where:{id:origin.poolId},select:{name:true}}),db.technician.findUnique({where:{id:origin.technicianId},select:{name:true}})]);
  const source=json(row),original=journal.original(row,receipts),state=(await journal.read(db,[row],receipts)).get(completionId),legacy=receipts.length===0&&await rules.legacy(source),last=state.history.at(-1)?.revision.preview;
  const eligible=legacy&&!!target?.valid&&!!technician&&require('./operationalValueReportService').isCompletedVisitStatus(parent.status)&&rules.iso(parent.startAt)&&rules.iso(parent.endAt)&&Date.parse(parent.endAt)>Date.parse(parent.startAt)&&Date.parse(source.completedAt)>=Date.parse(parent.startAt)&&Date.parse(source.completedAt)<=Date.now();
  const matches=eligible&&(!last||r.hash(source)===last.sourceHash&&r.hash(parent)===r.hash(last.parent)&&target.hash===last.targetHash),current={state:!state.valid?'REVIEW':state.action==='WITHDRAW'?'WITHDRAWN':state.record?matches?'ATTESTED':'REVIEW':'MISSING',record:state.record};
  const editable=legacy&&state.valid&&(eligible||!!state.record),message=!legacy?'Este registo não é um original antigo verificável sem recibo. Consulte os tempos e materiais; comprovativos modernos danificados exigem revisão própria.':!state.valid?'O histórico administrativo está danificado. Novas confirmações estão bloqueadas.':!eligible?'A origem atual precisa de revisão. Uma declaração anterior pode ser anulada, mantendo o seu comprovativo.':'Escolha o técnico e indique a evidência histórica consultada. A confirmação fica atribuída à administração, não constitui um recibo técnico original e não regista tempos, consumos ou valores.';
  return {available:true,completionId,title:source.result?.plan?.title||'Revisão #'+completionId,origin,clientName:target?.clientName||'',poolName:pool?.name||'',technicianName:technician?.name||'',original,originalHash:r.hash(original),source,sourceHash:r.hash(source),current,history:state.history,journalValid:state.valid,editable:!!editable,message,legacy,eligible,technicalReceiptAvailable:receipts.length>0,row,parent,target,receipts,state};
}
function publicContext(c){if(!c.available)return c;const{row,parent,target,receipts,state,...v}=c;return v;}
async function calculate(db,completionId,body,lock=false){
  parse(body);const c=await context(db,completionId,lock);if(!c.available)return c;if(!c.editable)return refuse('HISTORY_SOURCE_REVIEW',c.message);
  if(body.action==='REPLACE'&&(!c.eligible||body.originReview.technicianId!==c.origin.technicianId))return refuse('HISTORY_ORIGIN_REVIEW','O técnico indicado tem de corresponder à visita histórica confirmada. Reveja a origem antes de guardar.');
  const previous={headHash:c.state.headHash,action:c.state.action,record:c.state.record},proposed={action:body.action,record:body.action==='WITHDRAW'?null:{schema:1,basis:rules.recordBasis,origin:c.origin,evidence:body.originReview.evidence}};
  if(r.hash(previous.record)===r.hash(proposed.record))return refuse('NO_CHANGE','A declaração proposta coincide com o registo atual.');
  const value={schema:1,basis:rules.basis,completionId,origin:c.origin,original:c.original,baseHash:c.originalHash,source:c.source,sourceHash:c.sourceHash,parent:c.parent,target:c.target,targetHash:c.target.hash,previous,proposed,beforeState:c.current.state,afterState:body.action==='WITHDRAW'?'WITHDRAWN':'ATTESTED',afterReasons:[],affectedShares:[]};return rules.preview({available:true,...value,hash:r.hash(value)},r.hash);
}
async function detail(user,value){admin(user);const cid=id(value);return prisma.$transaction(async db=>({ok:true,declaration:publicContext(await context(db,cid))}),{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});}
async function preview(user,value,body){admin(user);const cid=id(value);parse(body);return prisma.$transaction(async db=>({ok:true,preview:await calculate(db,cid,body)}),{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});}
async function command(user,value,body){
  const owner=admin(user),cid=id(value);parse(body,true);const{requestId,...payload}=body,request=r.context(user,rules.scope,cid,requestId,payload);
  return prisma.$transaction(async db=>{
    const old=await r.recover(db,request);if(old)return old;const p=await calculate(db,cid,{action:body.action,originReview:body.originReview},true);
    if(!p.available||p.hash!==body.previewHash)return r.confirm(db,request,{ok:true,applied:false,envelope:body,code:p.code||'PREVIEW_CHANGED',message:p.message||'A origem, a evidência ou o histórico mudou. Atualize e confirme novamente.'});
    const revision={schema:1,id:requestId,owner,completionId:cid,reason:body.reason,createdAt:new Date().toISOString(),preview:p},response=await r.confirm(db,request,{ok:true,applied:true,envelope:body,revision,revisionHash:r.hash(revision)});await rules.response(response,body,owner,cid,r.hash);
    await db.technicalHistory.create({data:{poolId:p.origin.poolId,type:rules.scope,status:body.action==='WITHDRAW'?'WITHDRAWN':'ATTESTED',message:'Origem histórica da revisão #'+cid+': '+body.reason,description:JSON.stringify({requestId,revisionHash:response.revisionHash,previousHash:p.previous.headHash,technicalReceiptRecreated:false}),performedAt:new Date(revision.createdAt)}});
    await db.userAuditLog.create({data:{actor:owner,action:rules.scope,entity:'EquipmentMaintenanceCompletion',entityId:String(cid),metadata:{requestId,revisionHash:response.revisionHash,action:body.action,sourceHash:p.sourceHash,technicianId:p.origin.technicianId,technicalReceiptRecreated:false}}});return response;
  },{isolationLevel:'ReadCommitted',maxWait:15000,timeout:25000});
}
async function recover(user,requestId){const owner=admin(user);if(!rules.uuid(requestId))r.fail('Identificador inválido.');const saved=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner,requestId}}});if(!saved||saved.scope!==rules.scope)r.fail('Não existe confirmação deste pedido para esta conta.',404);return saved.response;}
module.exports={rules,journal,detail,preview,command,recover,context,calculate};
