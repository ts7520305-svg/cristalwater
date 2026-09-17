'use strict';
const {prisma}=require('../prismaClient');
const requests=require('./fieldWriteRequestService');
const id=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
const fields=['visitType','visitId','poolId','category','type','severity','message'];
const categories=['Servico normal','Extra / reparacao'];
const types=['Agua turva','Equipamento','Fuga','Acesso bloqueado','Cliente ausente','Outro'];
function validate(payload,modern=true){
  if(!payload||Object.keys(payload).length!==fields.length||Object.keys(payload).some(field=>!fields.includes(field))||payload.visitType!=='REGULAR'||!id(payload.visitId)||(payload.poolId!==null&&!id(payload.poolId))||(modern&&!id(payload.poolId))||!categories.includes(payload.category)||!['Normal','Urgente'].includes(payload.severity)||typeof payload.type!=='string'||!payload.type.trim()||payload.type.length>160||(modern&&!types.includes(payload.type))||typeof payload.message!=='string'||!payload.message.trim()||payload.message.length>5000)requests.fail('Confirme a visita, a classificação, o tipo, a urgência e a descrição da ocorrência.');
  return payload;
}
async function create(actor,visitId,body={}){
  if(!id(visitId)||!body||typeof body!=='object'||Array.isArray(body))requests.fail('Ocorrência inválida.');
  const owner=requests.owner(actor),admin=owner.startsWith('ADMIN:'),technicianId=admin?null:Number(actor.technicianId||actor.id),modern=body.requestId!==undefined;
  if(modern&&admin)requests.fail('Este envio requer uma sessão de técnico.',403);
  if(modern&&Object.keys(body).some(field=>!['requestId',...fields].includes(field)))requests.fail('Conserve apenas os campos da ocorrência original.');
  if(body.visitType!==undefined&&body.visitType!=='REGULAR')requests.fail('Este registo requer uma visita regular.');
  if(body.visitId!==undefined&&Number(body.visitId)!==visitId)requests.fail('A ocorrência não corresponde à visita do endereço.');
  if(!modern&&!admin&&body.technicianId!==undefined&&Number(body.technicianId)!==technicianId)requests.fail('Não pode registar uma ocorrência em nome de outro técnico.',403);
  const payload=validate(modern?Object.fromEntries(Object.entries(body).filter(([key])=>key!=='requestId')):{visitType:'REGULAR',visitId,poolId:body.poolId===undefined||body.poolId===null?null:Number(body.poolId),category:body.category||'Servico normal',type:body.type||'Problema em campo',severity:/URG|CRIT/i.test(String(body.severity||''))?'Urgente':'Normal',message:body.message||body.problem||''},modern);
  const legacyNotes=modern?'':body.notes||'';
  if(typeof legacyNotes!=='string'||legacyNotes.length>5000)requests.fail('Notas inválidas.');
  const request=modern?requests.context(actor,'FIELD_PROBLEM_REPORT',technicianId,body.requestId,payload):null;
  return prisma.$transaction(async tx=>{
    if(request){const saved=await requests.recover(tx,request);if(saved)return saved;}
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${visitId} FOR UPDATE`;
    const visit=await tx.serviceVisit.findUnique({where:{id:visitId},select:{id:true,poolId:true,clientId:true,technicianId:true,pool:{select:{name:true}},technician:{select:{name:true}}}});
    requests.authorize(actor,visit);
    if(!id(visit.poolId))requests.fail('Visita sem piscina confirmada.',409,'PROBLEM_CONTEXT_CHANGED');
    if(payload.poolId!==null&&payload.poolId!==visit.poolId)requests.fail('A piscina da visita mudou. Preserve a ocorrência e confirme o contexto com o escritório.',409,'PROBLEM_CONTEXT_CHANGED');
    let reporter=null;
    if(!admin){reporter=await tx.technician.findUnique({where:{id:technicianId},select:{id:true,name:true,active:true}});if(!reporter?.active)requests.fail('Técnico indisponível. Preserve a ocorrência.',403);}
    const priority=payload.severity==='Urgente'?'HIGH':'NORMAL',metadata={...payload,poolId:visit.poolId,clientId:visit.clientId,technicianId,technicianName:reporter?.name||null,owner,requestId:request?.requestId||null,recipientRole:'ADMIN',source:'technician-field-mode'};
    const notes=[`Ocorrência da visita REGULAR #${visitId}. Classificação: ${payload.category}. Autor: ${owner}${reporter?.name?' · '+reporter.name:''}.`,legacyNotes,'Preço por definir; requer revisão do escritório.'].filter(Boolean).join('\n');
    // Reporting a problem is neither a quote nor an approved charge.
    const repair=await tx.repair.create({data:{poolId:visit.poolId,problem:payload.type+': '+payload.message,quantity:1,unitPrice:null,totalPrice:null,priority,notes,status:'PENDING'}});
    const alert=await tx.technicalAlert.create({data:{poolId:visit.poolId,type:payload.type,message:payload.message,priority,status:'OPEN'}});
    const history=await tx.technicalHistory.create({data:{poolId:visit.poolId,type:'REPAIR_CREATED',component:'Repair',message:'Ocorrência registada para revisão do escritório',description:JSON.stringify({...metadata,repairId:repair.id,alertId:alert.id,pricingStatus:'UNQUOTED'}),status:'OPEN',performedAt:new Date()}});
    const notification=await tx.notification.create({data:{type:priority==='HIGH'?'CRITICAL':'ALERT',eventType:'FIELD_PROBLEM_REPORTED',title:'Ocorrência reportada em campo',message:`${visit.pool?.name||'Piscina'} — ${payload.type}: ${payload.message}`,role:'ADMIN',severity:priority,status:'PENDING',metadata:{...metadata,repairId:repair.id,alertId:alert.id,historyId:history.id}}});
    await tx.auditTrail.create({data:{eventType:'FIELD_PROBLEM_REPORTED',action:'FIELD_PROBLEM_CREATE',entity:'Repair',entityId:repair.id,userId:admin?Number(actor.userId||actor.id):actor.principalType==='USER'?Number(actor.userId||actor.id):null,technicianId,poolId:visit.poolId,clientId:visit.clientId,visitId,message:'Ocorrência e pedido de revisão registados sem orçamento.',metadata:{...metadata,repairId:repair.id,alertId:alert.id,historyId:history.id,notificationId:notification.id,pricingStatus:'UNQUOTED'}}});
    if(!request)return {ok:true,repair,alert,notification,next:'ADMIN_REVIEW_REPAIR',confirmationMode:'LEGACY_NO_REQUEST_ID'};
    return requests.confirm(tx,request,{ok:true,problemReport:{...payload,technicianId,repairId:repair.id,alertId:alert.id,historyId:history.id,notificationId:notification.id,recipientRole:'ADMIN',createdAt:notification.createdAt,pricingStatus:'UNQUOTED',unitPrice:null,totalPrice:null}});
  },{maxWait:15000,timeout:20000});
}
module.exports={create,validate};
