const lifecycle=require('../../services/incompleteVisitLifecycle');
const {prisma} = require('../../prismaClient');
const {Prisma} = require('@prisma/client');
const {normalizeRole,roleMatches} = require('../../utils/roles');
const coverage = require('../../services/autoVisitAlertService');
function fail(statusCode,message){throw Object.assign(new Error(message),{statusCode});}
function admin(user){if(normalizeRole(user?.role)!=='ADMIN')fail(403,'Apenas a gestão pode redistribuir trabalho');}
async function get(user){admin(user);return {...await coverage.getCoverage(),receipts:(await receipts(user)).receipts};}
async function transfer(user,body={}){
  admin(user);
  const ids=body.visitIds,technicianId=Number(body.technicianId),reason=String(body.reason||'').trim();
  if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==ids.length)fail(400,'Selecione entre 1 e 100 visitas diferentes');
  if(!Number.isSafeInteger(technicianId)||technicianId<=0||reason.length<5||reason.length>1000)fail(400,'Escolha o técnico e indique o motivo (5–1000 caracteres)');
  if(body.preview!==true&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.requestId||'')))fail(400,'Pedido inválido');
  return prisma.$transaction(async tx=>{
    const sourceKey=`visit-transfer:${body.requestId}`;
    if(body.preview!==true){
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
      const replay=await tx.operationalReminder.findUnique({where:{sourceKey}});
      if(replay){
        const previous=replay.metadata;
        const sameVisits=Array.isArray(previous?.visitIds)&&JSON.stringify([...previous.visitIds].sort((a,b)=>a-b))===JSON.stringify([...ids].sort((a,b)=>a-b));
        if(previous?.actorId!==user.id||previous.technicianId!==technicianId||!sameVisits||replay.description!==reason)fail(409,'Pedido já utilizado com outros dados. Atualize a seleção');
        return {...previous.result,idempotent:true};
      }
    }
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id IN (${Prisma.join([...ids].sort((a,b)=>a-b))}) ORDER BY id FOR UPDATE`;
    const technician=await tx.technician.findUnique({where:{id:technicianId}});
    if(!technician?.active||technician.archiveStatus!=='ATIVO')fail(400,'Técnico inativo ou indisponível');
    const visits=await tx.serviceVisit.findMany({where:{id:{in:ids}},include:{pool:{select:{name:true}}},orderBy:{id:'asc'}});
    if(visits.length!==ids.length)fail(409,'Uma visita já não existe. Atualize a lista');
    const blocked=visits.filter(v=>v.startAt||v.endAt||!['PLANNED','SCHEDULED','ASSIGNED','PENDING'].includes(v.status));
    if(blocked.length)fail(409,`As visitas ${blocked.map(v=>'#'+v.id).join(', ')} já foram iniciadas ou alteradas. Atualize a seleção`);
    const eligible=visits.filter(v=>v.technicianId!==technicianId);
    const snapshot=visits.map(v=>({id:v.id,updatedAt:v.updatedAt.toISOString(),poolName:v.pool?.name||`Visita #${v.id}`,previousTechnicianId:v.technicianId,plannedDate:v.plannedDate}));
    if(body.preview===true)return {ok:true,preview:true,visits:snapshot,updated:eligible.length,unchanged:visits.length-eligible.length,technicianName:technician.name};
    if(!Array.isArray(body.expected)||body.expected.length!==visits.length||body.expected.some(v=>!v||!Number.isSafeInteger(v.id)||typeof v.updatedAt!=='string')||new Set(body.expected.map(v=>v.id)).size!==visits.length||visits.some(v=>!body.expected.some(before=>before.id===v.id&&before.updatedAt===v.updatedAt.toISOString())))fail(409,'O planeamento mudou após a pré-visualização. Atualize e confirme novamente');
    for(const visit of eligible){
      await tx.serviceVisit.update({where:{id:visit.id},data:{technicianId,technicianName:technician.name,internalNotes:[visit.internalNotes,`[Redistribuição ${new Date().toISOString()}] Gestão ${user.id}: técnico ${visit.technicianId||'por atribuir'} → ${technicianId}. ${reason}`].filter(Boolean).join('\n')}});
      if(visit.poolId)await tx.technicalHistory.create({data:{poolId:visit.poolId,type:'VISIT_REASSIGNED',component:'Service Visit',message:`Visita #${visit.id} atribuída a ${technician.name}`,description:JSON.stringify({visitId:visit.id,from:visit.technicianId,to:technicianId,actorId:user.id,requestId:body.requestId}),status:visit.status,performedAt:new Date()}});
    }
    for(const visit of eligible)await require('../../services/visitReceiptService').requestReceipt(tx,{...visit,technicianId},body.requestId,'BULK_TRANSFER');
    const result={ok:true,updated:eligible.length,unchanged:visits.length-eligible.length,technicianName:technician.name};
    await tx.operationalReminder.create({data:{sourceKey,title:'Redistribuição de visitas registada',description:reason,dueDate:new Date(),isCompleted:true,metadata:{actorId:user.id,visitIds:ids,technicianId,result}}});
    return result;
  });
}
function principal(user){
  const role=normalizeRole(user?.role);
  if(role!=='ADMIN'&&!roleMatches(role,'TECHNICIAN'))fail(403,'Sessão sem acesso');
  return {admin:role==='ADMIN',id:Number(user.technicianId||user.id)};
}
async function receipts(user){
  const actor=principal(user);
  const rows=await prisma.operationalReminder.findMany({where:{sourceKey:{startsWith:'visit-receipt:'},...(!actor.admin?{assignedToTechnicianId:actor.id,isCompleted:false}:{})},include:{pool:{select:{name:true}},assignedTechnician:{select:{name:true}}},orderBy:{id:'desc'}});
  const ids=[...new Set(rows.map(row=>row.metadata?.visitId).filter(Number.isSafeInteger))];
  const visits=await lifecycle.collect(prisma,rows);
  const latest=await prisma.operationalReminder.findMany({where:{sourceKey:{startsWith:'visit-receipt:'},OR:ids.map(id=>({metadata:{path:['visitId'],equals:id}}))},orderBy:{id:'desc'},select:{id:true,metadata:true}});
  const seen=new Map();for(const row of latest){const key=lifecycle.key(lifecycle.type(row.metadata),row.metadata.visitId);if(!seen.has(key))seen.set(key,row.id);}
  const result=rows.map(row=>{
    const key=lifecycle.key(lifecycle.type(row.metadata),row.metadata.visitId),visit=visits.get(key);
    const current=visit&&visit.technicianId===row.assignedToTechnicianId&&seen.get(key)===row.id;
    const closed=!visit||visit.endAt||['DONE','COMPLETED','CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(visit.status);
    const state=row.metadata.receivedAt?(current?'RECEIVED':'RECEIVED_PREVIOUS'):!current?'SUPERSEDED':closed?'CLOSED':'PENDING';
    return {id:row.id,visitType:lifecycle.type(row.metadata),visitId:row.metadata.visitId,poolName:row.pool?.name||'Piscina',technicianName:row.assignedTechnician?.name||'Técnico',assignedAt:row.metadata.assignedAt,receivedAt:row.metadata.receivedAt||null,plannedDate:visit?.plannedDate||null,state};
  });
  return {ok:true,receipts:actor.admin?result:result.filter(row=>row.state==='PENDING')};
}
async function acknowledge(user,value){
  const actor=principal(user),id=Number(value);
  if(actor.admin)fail(403,'A confirmação deve ser feita pelo técnico destinatário');
  if(!Number.isSafeInteger(id)||id<=0)fail(400,'Pedido inválido');
  const original=await prisma.operationalReminder.findUnique({where:{id}});
  if(!original?.sourceKey?.startsWith('visit-receipt:'))fail(404,'Transferência não encontrada');
  if(original.assignedToTechnicianId!==actor.id)fail(403,'Transferência atribuída a outro técnico');
  const visitId=original.metadata.visitId,visitType=lifecycle.type(original.metadata);
  return prisma.$transaction(async tx=>{
    await lifecycle.lock(tx,visitType,visitId);
    const visit=await lifecycle.model(tx,visitType).findUnique({where:{id:visitId}});
    const latest=await tx.operationalReminder.findFirst({where:{sourceKey:{startsWith:lifecycle.prefix(visitType,visitId,'visit-receipt')}},orderBy:{id:'desc'}});
    if(!visit||visit.technicianId!==actor.id||latest?.id!==id)fail(409,'A atribuição mudou. Atualize a rota');
    if(latest.metadata.receivedAt)return {ok:true,receivedAt:latest.metadata.receivedAt,idempotent:true};
    if(visit.endAt||['DONE','COMPLETED','CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(visit.status))fail(409,'A visita já foi concluída ou retirada. Atualize a rota');
    await tx.notification.updateMany({where:{eventType:'VISIT_RECEIPT_PENDING',metadata:{path:['receiptId'],equals:id},status:'PENDING'},data:{status:'RESOLVED'}});
    const receivedAt=new Date().toISOString();
    await tx.operationalReminder.update({where:{id},data:{isCompleted:true,metadata:{...latest.metadata,state:'RECEIVED',receivedAt,receivedBy:actor.id}}});
    if(visit.poolId)await tx.technicalHistory.create({data:{poolId:visit.poolId,type:'VISIT_ASSIGNMENT_RECEIVED',component:visitType==='EXTRA'?'Extra Visit':'Service Visit',message:`Técnico confirmou receção da visita #${visitId}`,description:JSON.stringify({visitId,visitType,receiptId:id,technicianId:actor.id,receivedAt}),status:visit.status,performedAt:new Date()}});
    return {ok:true,receivedAt};
  });
}
module.exports={get,transfer,receipts,acknowledge};
