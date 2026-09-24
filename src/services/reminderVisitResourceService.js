'use strict';
const {prisma}=require('../prismaClient'),writes=require('./fieldWriteRequestService'),links=require('./reminderVisitService');
const journal=require('./reminderVisitResourceJournal'),{rules}=journal,materials=require('./equipmentMaterialsService'),times=require('./equipmentWorkTimeService');
const json=v=>JSON.parse(JSON.stringify(v)),refuse=(code,message)=>({available:false,code,message});
function admin(actor){if(!require('../utils/roles').roleMatches(actor?.role,'ADMIN'))writes.fail('Só a administração pode confirmar parcelas do lembrete.',403);return writes.owner(actor);}
function id(value){const n=Number(value);if(!rules.positive(n)||typeof value!=='number'&&String(n)!==value)writes.fail('Identificador inválido.');return n;}
function parse(body,command=false){try{command?rules.command(body):rules.input(body);}catch(_){writes.fail('Reveja a declaração, os recursos e o motivo.');}}
async function context(db,reminderId,lock=false){
  let own=await journal.journal(db,reminderId),association=await require('./reminderVisitJournal').journal(db,reminderId);
  const selected=association.active?.result.event.preview.parent||own.active?.result.event.preview.parent;
  if(lock&&selected)await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'maintenance-material-share:'+selected.type+':'+selected.id }))::text`;
  const link=await links.context(db,reminderId,lock);
  if(lock){await db.$queryRaw`SELECT id FROM "FieldWriteRequest" WHERE scope=${rules.scope} AND "resourceId"=${reminderId} FOR SHARE`;own=await journal.journal(db,reminderId);}
  const current=link.active?.result.event.preview.parent||own.active?.result.event.preview.parent;
  if(lock&&writes.hash(current||null)!==writes.hash(selected||null))return refuse('ASSOCIATION_CHANGED','A associação mudou. Atualize a origem.');
  const p=current;
  if(lock&&p){
    if(p.type==='REGULAR')await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${p.id} FOR UPDATE`;else await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${p.id} FOR UPDATE`;
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'repair-work-technician:'+p.technicianId }))::text`;
    await db.$queryRaw`SELECT id FROM "EquipmentMaintenanceCompletion" WHERE "visitId"=${p.type==='REGULAR'?p.id:null} OR "extraVisitId"=${p.type==='EXTRA'?p.id:null} FOR SHARE`;
    await db.$queryRaw`SELECT id FROM "StockMovement" WHERE "visitId"=${p.type==='REGULAR'?p.id:null} OR "extraVisitId"=${p.type==='EXTRA'?p.id:null} FOR SHARE`;
  }
  const parent=p?await links.parent(db,p.type,p.id):null,visit=parent?{...parent,startAt:new Date(parent.startAt),endAt:parent.endAt?new Date(parent.endAt):null}:null;
  if(visit)delete visit.type;
  const rows=visit?await db.equipmentMaintenanceCompletion.findMany({where:{[p.type==='REGULAR'?'visitId':'extraVisitId']:p.id},select:materials.selection,orderBy:{id:'asc'}}):[];
  const inputs=visit?await materials.readInputs(db,rows,visit,p.type):null;
  if(lock)for(const row of rows)await db.$queryRaw`SELECT id FROM "FieldWriteRequest" WHERE (scope='EQUIPMENT_MAINTENANCE' AND "requestId"=${row.requestId}) OR (scope='EQUIPMENT_MATERIAL_REVIEW' AND "resourceId"=${row.id}) FOR SHARE`;
  const associated=inputs?.associated||{valid:true,records:[]},materialViews=visit?materials.assess(rows,visit,p.type,inputs.receipts,inputs.movements,inputs.revisions,associated):new Map(),timeViews=visit?await times.describe(db,rows,visit,p.type):new Map();
  let peersValid=associated.valid;
  const peers=rows.map(row=>{const m=materialViews.get(row.id),t=timeViews.get(row.id);if(m.state==='REVIEW'||t.state==='REVIEW')peersValid=false;return {type:'EQUIPMENT',id:row.id,reminderId:null,hash:writes.hash({result:row.result,revision:inputs.revisions.get(row.id)?.headHash||null}),materials:m.record?{mode:m.record.mode,items:m.record.items}:null,...(Array.isArray(t.record?.intervals)?{workIntervals:times.intervals(t.record).map(w=>({startedAt:w.startAt,endedAt:w.endAt}))}:{workTime:t.record?{startedAt:t.record.startAt,endedAt:t.record.endAt}:null})};});
  peers.push(...associated.records.filter(r=>r.reminderId!==reminderId));
  const movements=json(inputs?.movements||[]).map(m=>({...m,quantity:require('./expenseValuationSources').decimal(require('./expenseValuationSources').quantity(m.quantity))}));
  const external=await require('./recordedWorkTimeService').conflicts(db,parent?rules.intervals(own.active?.result.event.preview.selection.data).map(w=>({type:parent.type,id:parent.id,technicianId:parent.technicianId,startAt:new Date(w.startedAt),endAt:new Date(w.endedAt)})):[]);
  const origin=p?{reminderId,clientId:p.clientId,poolId:p.poolId,technicianId:p.technicianId,visitType:p.type,visitId:p.id,associationId:link.active?.id||own.active?.result.event.preview.origin.associationId}:null;
  const records=own.records.map(row=>{
    const d=row.result.event.preview.selection.data,orig=row.result.event.preview.origin;
    let confirmed=own.valid&&associated.valid&&external.size===0&&!!associated.records.find(r=>r.id===row.id);
    if(confirmed&&!row.voidResult){try{rules.compare(d,parent,peers,movements);}catch(_){confirmed=false;}}
    const event=row.result.event;return {...row,clientId:orig.clientId,poolId:orig.poolId,technicianId:orig.technicianId,intact:own.valid,snapshot:event,fingerprint:row.hash,createdAt:event.createdAt,owner:event.owner,voidedAt:row.voidResult?.event.createdAt||null,voidedBy:row.voidResult?.event.owner||null,voidReason:row.voidResult?.event.reason||null,state:row.voidResult?'VOIDED':confirmed?'CONFIRMED':'REVIEW',canVoid:own.valid&&!row.voidResult};
  });
  const contextHash=writes.hash({link:link.contextHash||null,own:own.headHash,valid:own.valid,parent,peers,peersValid,movements});
  return {available:true,reminderId,source:link.source||null,title:link.title||'Lembrete removido — histórico conservado',clientName:link.clientName||'',poolName:link.poolName||'',technicians:link.technician?[{...link.technician,active:true}]:[],parent,association:link.active?.result||null,origin,contextHash,previousHash:own.headHash,journalValid:own.valid,records,active:records.filter(r=>!r.voidedAt),canDeclare:own.valid&&!own.active&&link.active?.state==='CONFIRMED'&&peersValid&&!!visit,warning:'Associe uma visita concluída e confira os recursos e os comprovativos antes de declarar parcelas.',peers,peersValid,movements,visit};
}
async function calculate(db,reminderId,body,lock=false){
  parse(body);const c=await context(db,reminderId,lock);if(!c.available)return c;
  let original=null,association=null,parent=null,peers=null,movements=null,comparison=null,origin=c.origin;
  const active=c.active.find(r=>r.id===body.recordId);
  if(body.action==='VOID'){if(!c.journalValid||!active?.canVoid)return refuse('DECLARATION_CHANGED','A declaração mudou ou o comprovativo precisa de revisão.');original=active.result;origin=original.event.preview.origin;}
  else {
    if(!c.canDeclare)return refuse('RESOURCES_REVIEW','Confirme a associação, a execução e os recursos já atribuídos na mesma visita.');
    association=c.association;parent=c.parent;peers=c.peers;
    const products=new Set((body.data.materials?.items||[]).map(rules.key));movements=c.movements.filter(m=>products.has(rules.key(m)));
    try{comparison=rules.compare(body.data,parent,peers,movements);if(rules.intervals(body.data).some(w=>Date.parse(w.endedAt)>Date.parse(association.event.preview.source.completedAt)))throw Error('After completion');}
    catch(_){return refuse('RESOURCE_LIMIT','Os materiais excedem o consumo líquido disponível, ou o horário sobrepõe trabalho já declarado ou fica fora da visita.');}
    const conflicts=await require('./recordedWorkTimeService').conflicts(db,rules.intervals(body.data).map(w=>({type:parent.type,id:parent.id,technicianId:parent.technicianId,startAt:new Date(w.startedAt),endAt:new Date(w.endedAt)})));if(conflicts.size)return refuse('TIME_OVERLAP','O técnico tem trabalho simultâneo noutro serviço. Reveja os horários.');
  }
  let affectedShares=[];
  if((body.data||original?.event.preview.selection.data)?.materials!==null){const shares=await require('./maintenanceMaterialShareService').journal(db);if(shares.review)return refuse('COST_HISTORY_REVIEW','Reveja o histórico das parcelas de custo antes de alterar os materiais.');affectedShares=shares.records.filter(s=>!s.voidedAt&&s.share.preview.allocationBefore.targetType===origin.visitType&&require('./maintenanceMaterialShareService').rules.parentId(s.share.preview.allocationBefore)===origin.visitId).map(s=>({id:s.share.id,hash:s.hash,expenseId:s.share.expenseId,allocationId:s.share.allocationId,completionId:s.share.completionId,...(s.share.reminderId!==undefined?{reminderId:s.share.reminderId}:{}),amountCents:s.share.preview.amountCents,quantity:s.share.preview.quantity})).sort((a,b)=>a.id.localeCompare(b.id));}
  let affectedCosts;
  if(body.action==='VOID'){const costs=await require('./reminderVisitCostSource').activeShares(db,reminderId);if(!costs.valid)return refuse('COST_HISTORY_REVIEW','Reveja os comprovativos das parcelas financeiras antes de anular os recursos.');if(costs.rows.length)affectedCosts=costs.rows;}
  const schema=original?original.event.preview.schema:body.data.workIntervals===undefined?1:2;
  const value={schema,basis:rules.basis,reminderId,selection:body,contextHash:c.contextHash,previousHash:c.previousHash,origin,association,parent,peers,movements,comparison,affectedShares,...(affectedCosts?{affectedCosts}:{}),original};return rules.preview({available:true,...value,hash:writes.hash(value)},writes.hash);
}
async function detail(actor,value){admin(actor);const rid=id(value);return prisma.$transaction(async db=>{const c=await context(db,rid);if(c.available)delete c.visit;return {ok:true,detail:c};},{isolationLevel:'RepeatableRead',maxWait:15000,timeout:25000});}
async function preview(actor,value,body){admin(actor);const rid=id(value);parse(body);return prisma.$transaction(async db=>({ok:true,preview:await calculate(db,rid,body)}),{isolationLevel:'RepeatableRead',maxWait:15000,timeout:25000});}
async function command(actor,value,body){const owner=admin(actor),rid=id(value);parse(body,true);const {requestId,...payload}=body,request=writes.context(actor,rules.scope,rid,requestId,payload);return prisma.$transaction(async db=>{
  const old=await writes.recover(db,request);if(old)return old;const p=await calculate(db,rid,rules.select(body),true);
  if(!p.available||p.hash!==body.previewHash)return writes.confirm(db,request,{ok:true,applied:false,envelope:body,code:p.code||'PREVIEW_CHANGED',message:p.message||'A origem ou as reservas mudaram. Atualize e confirme novamente.'});
  const createdAt=new Date(),event={schema:p.schema,basis:rules.basis,id:requestId,owner,reminderId:rid,reason:body.reason,createdAt:createdAt.toISOString(),preview:p};
  const result=await writes.confirm(db,request,{ok:true,applied:true,envelope:body,event,eventHash:writes.hash(event)});await rules.response(result,body,owner,rid,writes.hash);
  await db.technicalHistory.create({data:{poolId:p.origin.poolId,type:rules.scope,status:body.action==='DECLARE'?'CONFIRMED':'VOIDED',message:'Parcelas do lembrete #'+rid+': '+body.reason,description:JSON.stringify({requestId,eventHash:result.eventHash}),performedAt:createdAt}});
  await db.userAuditLog.create({data:{actor:owner,action:rules.scope,entity:'GeneralReminder',entityId:String(rid),metadata:{requestId,eventHash:result.eventHash,action:body.action}}});return result;
},{isolationLevel:'ReadCommitted',maxWait:15000,timeout:30000});}
async function recover(actor,requestId){const owner=admin(actor);if(!rules.uuid(requestId))writes.fail('Identificador inválido.');const row=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner,requestId}}});if(!row||row.scope!==rules.scope)writes.fail('Não existe confirmação deste pedido para esta conta.',404);return row.response;}
module.exports={rules,context,calculate,detail,preview,command,recover};
