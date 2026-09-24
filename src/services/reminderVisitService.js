'use strict';
const {prisma}=require('../prismaClient'),writes=require('./fieldWriteRequestService'),targets=require('./expenseMaintenanceTargets');
const history=require('./reminderVisitJournal'),{rules}=history,{roleMatches}=require('../utils/roles');
const json=v=>JSON.parse(JSON.stringify(v)),refuse=(code,message)=>({available:false,code,message});
const sourceSelect=Object.fromEntries(rules.sourceFields.map(k=>[k,true]));
const visitSelect=Object.fromEntries(rules.parentFields.filter(k=>k!=='type').map(k=>[k,true]));
const parentFacts=(type,row)=>row?{type,...json(row),status:String(row.status).trim().toUpperCase()}:null;
const id=v=>{const n=Number(v);if(!rules.positive(n)||typeof v!=='number'&&String(n)!==v)writes.fail('Identificador de lembrete inválido.');return n;};
function admin(actor){if(!roleMatches(actor?.role,'ADMIN'))writes.fail('Só a administração pode associar lembretes a visitas.',403);return writes.owner(actor);}
function parse(body,command=false){try{command?rules.command(body):rules.input(body);}catch(_){writes.fail('Escolha a visita ou associação original, indique o motivo e confirme a operação.');}}
async function parent(db,type,visitId,lock=false){
  if(lock){if(type==='REGULAR')await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${visitId} FOR SHARE`;else await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${visitId} FOR SHARE`;}
  return parentFacts(type,await db[type==='REGULAR'?'serviceVisit':'extraVisit'].findUnique({where:{id:visitId},select:visitSelect}));
}
async function context(db,reminderId,lock=false,selection=null){
  if(lock){
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'expense-valuation:MAINTENANCE_REMINDER:'+reminderId }))::text`;
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'reminder-resources:'+reminderId }))::text`;
    await targets.get(db,'MAINTENANCE_REMINDER',reminderId,true);
    await db.$queryRaw`SELECT id FROM "ReminderResourceDeclaration" WHERE "reminderId"=${reminderId} FOR SHARE`;
    await db.$queryRaw`SELECT id FROM "FieldWriteRequest" WHERE scope IN ('REMINDER_VISIT_ASSOCIATION','REMINDER_RESOURCES','REMINDER_MATERIAL_CONSUMPTION') AND "resourceId"=${reminderId} FOR SHARE`;
    const movements=(await require('./reminderMaterialService').journal(db,reminderId)).movementIds;
    for(const movementId of [...movements].sort((a,b)=>a-b))await db.$queryRaw`SELECT id FROM "StockMovement" WHERE id=${movementId} FOR SHARE`;
  }
  const [journal,resource,materials,reminder,costs]=await Promise.all([
    history.journal(db,reminderId),require('./reminderResourceService').context(db,reminderId),require('./reminderMaterialService').journal(db,reminderId),
    db.generalReminder.findUnique({where:{id:reminderId},select:sourceSelect}),
    db.expenseAllocation.findMany({where:{targetType:'MAINTENANCE_REMINDER',serviceReminderId:reminderId,voidedAt:null},orderBy:{id:'asc'}})
  ]);
  if(!reminder&&!journal.records.length&&!resource.records?.length)return refuse('NOT_FOUND','Lembrete ou histórico não encontrado.');
  const source=reminder?json(reminder):null,original=journal.active?.result||null,originalParent=original?.event.preview.parent;
  const chosen=selection?.action==='LINK'?{type:selection.visitType,id:selection.visitId}:originalParent;
  const selectedParent=chosen?await parent(db,chosen.type,chosen.id,lock):null;
  if(lock&&selectedParent?.technicianId)await db.$queryRaw`SELECT id FROM "Technician" WHERE id=${selectedParent.technicianId} FOR SHARE`;
  const technician=selectedParent?.technicianId?await db.technician.findUnique({where:{id:selectedParent.technicianId},select:{id:true,name:true}}):null;
  const associated=await require('./reminderVisitResourceJournal').journal(db,reminderId);
  const blockers=[];
  if(!associated.valid)blockers.push({code:'HISTORY_REVIEW',message:'Reveja os comprovativos das parcelas associadas.'});
  if(associated.active)blockers.push({code:'ACTIVE_ASSOCIATED_RESOURCES',message:'Anule primeiro as parcelas próprias do lembrete associado.',href:'/reminder-resources?associated=1&reminderId='+reminderId});
  const shares=!associated.active?await require('./reminderVisitCostSource').activeShares(db,reminderId):{valid:true,rows:[]};
  if(!shares.valid)blockers.push({code:'HISTORY_REVIEW',message:'Reveja os comprovativos das parcelas financeiras.'});
  for(const s of shares.rows)blockers.push({code:'ACTIVE_VISIT_COST',message:'Anule expressamente a parcela financeira antes de alterar a associação.',...s,href:'/admin-expenses?expenseId='+s.expenseId});
  if(!journal.valid||resource.available&&!resource.journalValid||!materials.valid)blockers.push({code:'HISTORY_REVIEW',message:'Reveja os comprovativos das associações, dos recursos e dos movimentos de materiais.'});
  if(materials.active)blockers.push({code:'ACTIVE_MATERIALS',message:'Reveja e anule o consumo próprio, confirmando primeiro a reposição no stock.',href:'/reminder-materials?reminderId='+reminderId});
  if(resource.active?.length)blockers.push({code:'ACTIVE_RESOURCES',message:'Reveja e anule a declaração de recursos próprios antes de associar o lembrete.',href:'/reminder-resources?reminderId='+reminderId});
  for(const a of costs)blockers.push({code:'ACTIVE_COST',message:'Anule expressamente o custo próprio #'+a.id+' antes de associar o lembrete.',allocationId:a.id,expenseId:a.expenseId,amountCents:a.amountCents,groupId:a.valuationSnapshot?.composition?.groupId||null,href:'/admin-expenses?expenseId='+a.expenseId});
  const target=resource.target||null,targetHash=resource.targetHash||null;
  const contextHash=writes.hash({source,targetHash,headHash:journal.headHash,journalValid:journal.valid,resources:resource.contextHash||null,materialHash:materials.headHash,materialValid:materials.valid,costs:costs.map(a=>writes.hash(json(a))),...(associated.headHash||!associated.valid?{associated:{hash:associated.headHash,valid:associated.valid}}:{})});
  for(const row of journal.records){if(row.voidResult)continue;const p=row.result.event.preview,reasons=[];
    if(!journal.valid)reasons.push('ASSOCIATION_EVIDENCE_CHANGED');
    if(writes.hash(source)!==p.sourceHash)reasons.push('REMINDER_CHANGED');
    if(target?.clientId!==p.origin.clientId||target?.poolId!==p.origin.poolId||target?.decisionFingerprint!==p.target.decisionFingerprint)reasons.push('COMMERCIAL_DECISION_CHANGED');
    if(writes.hash(selectedParent)!==p.parentHash)reasons.push('VISIT_CHANGED');
    if(!technician)reasons.push('TECHNICIAN_MISSING');
    if(blockers.some(b=>!['HISTORY_REVIEW','ACTIVE_ASSOCIATED_RESOURCES'].includes(b.code)))reasons.push('INDEPENDENT_RESOURCES_OR_COSTS');
    row.reasons=reasons;row.state=reasons.length?'REVIEW':'CONFIRMED';
  }
  const canLink=!blockers.length&&!journal.active&&resource.canDeclare===true;
  return {available:true,reminderId,source,sourceHash:writes.hash(source),target,targetHash,contextHash,title:resource.title||source?.title||'Lembrete removido — histórico preservado',clientName:resource.clientName||'',poolName:resource.poolName||'',records:journal.records,active:journal.active,journalValid:journal.valid,previousHash:journal.headHash,blockers,canLink,canUnlink:!blockers.length&&journal.valid&&!!journal.active,selectedParent,technician};
}
async function calculate(db,reminderId,body,lock=false){
  parse(body);const c=await context(db,reminderId,lock,body);if(!c.available)return c;
  if(c.blockers.length)return refuse(c.blockers[0].code,c.blockers[0].message);
  let source=null,sourceHash=null,target=null,targetHash=null,visit=null,parentHash=null,original=null,origin;
  if(body.action==='UNLINK'){
    if(!c.canUnlink||c.active.id!==body.associationId)return refuse('ASSOCIATION_CHANGED','A associação já foi anulada ou mudou. Consulte o histórico.');
    original=c.active.result;origin=original.event.preview.origin;
  }else{
    if(!c.canLink)return refuse('REMINDER_REVIEW','Confirme a execução e a decisão comercial do lembrete e reveja a associação ativa.');
    visit=c.selectedParent;
    if(!rules.parent(visit)||!c.technician||Date.parse(visit.endAt)>Date.now())return refuse('VISIT_REVIEW','Escolha uma visita concluída, com técnico, início e fim confirmados.');
    if(visit.clientId!==c.source.clientId||visit.poolId!==c.source.poolId||c.source.technicianId!==null&&visit.technicianId!==c.source.technicianId)return refuse('VISIT_ORIGIN_MISMATCH','A visita tem de pertencer ao mesmo cliente e piscina históricos e ao técnico atribuído ao lembrete.');
    if(Date.parse(c.source.completedAt)>Date.now())return refuse('REMINDER_REVIEW','A conclusão do lembrete não pode estar no futuro.');
    source=c.source;sourceHash=c.sourceHash;target=c.target;targetHash=c.targetHash;parentHash=writes.hash(visit);
    origin={reminderId,clientId:source.clientId,poolId:source.poolId,technicianId:visit.technicianId};
  }
  const value={schema:1,basis:rules.basis,reminderId,selection:body,previousHash:c.previousHash,contextHash:c.contextHash,origin,source,sourceHash,target,targetHash,parent:visit,parentHash,original};
  return rules.preview({available:true,...value,hash:writes.hash(value)},writes.hash);
}
async function detail(actor,value){admin(actor);const reminderId=id(value);return prisma.$transaction(async db=>({ok:true,detail:await context(db,reminderId)}),{isolationLevel:'RepeatableRead',maxWait:15000,timeout:25000});}
async function candidates(actor,value,query){
  admin(actor);const reminderId=id(value);
  if(!rules.fields(query,['visitType','page','q'])||!['REGULAR','EXTRA'].includes(query.visitType)||typeof query.page!=='string'||!rules.positive(Number(query.page))||String(Number(query.page))!==query.page||typeof query.q!=='string'||query.q!==''&&(!rules.positive(Number(query.q))||String(Number(query.q))!==query.q))writes.fail('Reveja o tipo, o número e a página das visitas.');
  return prisma.$transaction(async db=>{
    const c=await context(db,reminderId);if(!c.available)return {ok:true,candidates:c};
    const s=c.source,rows=c.canLink?(await db[query.visitType==='REGULAR'?'serviceVisit':'extraVisit'].findMany({where:{clientId:s.clientId,poolId:s.poolId,...(s.technicianId?{technicianId:s.technicianId}:{}),...(query.q?{id:Number(query.q)}:{})},select:visitSelect,orderBy:[{endAt:'desc'},{id:'desc'}]})).map(r=>parentFacts(query.visitType,r)).filter(r=>rules.parent(r)&&Date.parse(r.endAt)<=Date.now()):[];
    const technicianIds=[...new Set(rows.map(r=>r.technicianId))],known=new Set((await db.technician.findMany({where:{id:{in:technicianIds}},select:{id:true}})).map(t=>t.id));
    const valid=rows.filter(r=>known.has(r.technicianId)),page=Number(query.page);
    return {ok:true,candidates:{available:true,reminderId,visitType:query.visitType,q:query.q,page,pageSize:10,total:valid.length,contextHash:c.contextHash,sourceHash:c.sourceHash,rows:valid.slice((page-1)*10,page*10)}};
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:25000});
}
async function preview(actor,value,body){admin(actor);const reminderId=id(value);parse(body);return prisma.$transaction(async db=>({ok:true,preview:await calculate(db,reminderId,body)}),{isolationLevel:'RepeatableRead',maxWait:15000,timeout:25000});}
async function command(actor,value,body){
  const owner=admin(actor),reminderId=id(value);parse(body,true);const {requestId,...payload}=body,request=writes.context(actor,rules.scope,reminderId,requestId,payload);
  return prisma.$transaction(async db=>{
    const old=await writes.recover(db,request);if(old)return old;
    const p=await calculate(db,reminderId,Object.fromEntries(rules.selectionFields.map(k=>[k,body[k]])),true);
    if(!p.available||p.hash!==body.previewHash)return writes.confirm(db,request,{ok:true,applied:false,envelope:body,code:p.code||'PREVIEW_CHANGED',message:p.message||'A visita, o lembrete ou o histórico mudou. Atualize e confirme novamente.'});
    const createdAt=new Date(),event={schema:1,basis:rules.basis,id:requestId,owner,reminderId,reason:body.reason,createdAt:createdAt.toISOString(),preview:p};
    const result=await writes.confirm(db,request,{ok:true,applied:true,envelope:body,event,eventHash:writes.hash(event)});await rules.response(result,body,owner,reminderId,writes.hash);
    await db.technicalHistory.create({data:{poolId:p.origin.poolId,type:rules.scope,status:body.action==='LINK'?'CONFIRMED':'VOIDED',message:'Associação do lembrete #'+reminderId+': '+body.reason,description:JSON.stringify({requestId,eventHash:result.eventHash}),performedAt:createdAt}});
    await db.userAuditLog.create({data:{actor:owner,action:rules.scope,entity:'GeneralReminder',entityId:String(reminderId),metadata:{requestId,action:body.action,eventHash:result.eventHash}}});return result;
  },{isolationLevel:'ReadCommitted',maxWait:15000,timeout:25000});
}
async function recover(actor,requestId){const owner=admin(actor);if(!rules.uuid(requestId))writes.fail('Identificador de pedido inválido.');const row=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner,requestId}}});if(!row||row.scope!==rules.scope)writes.fail('Não existe confirmação deste pedido para esta conta.',404);return row.response;}
module.exports={detail,candidates,preview,command,recover,context,calculate,parent,parentFacts,sourceSelect,visitSelect,rules};
