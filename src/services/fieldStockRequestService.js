'use strict';
const { prisma } = require('../prismaClient');
const requests = require('./fieldWriteRequestService');
const validId = value => Number.isSafeInteger(value) && value > 0;
const optionalId = value => value === null || validId(value);
function validate(payload) {
  const fields=['visitType','visitId','poolId','requestType','priority','productName','quantity','unit','message'];
  if (!payload || Object.keys(payload).length!==fields.length || Object.keys(payload).some(key=>!fields.includes(key)) || payload.visitType!=='REGULAR' || !optionalId(payload.visitId) || !optionalId(payload.poolId) || (!payload.visitId&&payload.poolId) || !['STOCK_REQUEST','PURCHASE_REMINDER','ADMIN_NOTE'].includes(payload.requestType) || !['NORMAL','HIGH'].includes(payload.priority)) requests.fail('Confirme o tipo de pedido, a prioridade e a visita original.');
  for(const [key,max] of [['productName',200],['quantity',40],['unit',40],['message',5000]])if(typeof payload[key]!=='string'||payload[key].length>max)requests.fail('Os campos do pedido de material são inválidos.');
  if(!payload.productName.trim()&&!payload.message.trim())requests.fail('Indique o material ou uma nota para a administração.');
  if(payload.quantity!==''&&(!/^\d+(?:[.,]\d{1,6})?$/.test(payload.quantity)||!Number.isFinite(Number(payload.quantity.replace(',','.')))||Number(payload.quantity.replace(',','.'))<=0||Number(payload.quantity.replace(',','.'))>1000000||!payload.unit.trim()))requests.fail('Indique uma quantidade positiva e a respetiva unidade, ou deixe a quantidade vazia.');
  return payload;
}
async function create(actor, body={}) {
  if(!body||typeof body!=='object'||Array.isArray(body))requests.fail('Pedido inválido.');
  const owner=requests.owner(actor),technicianId=Number(actor?.technicianId||actor?.id);
  if(owner.startsWith('ADMIN:'))requests.fail('Este envio requer uma sessão de técnico.',403);
  const modern=body.requestId!==undefined;
  if(!modern&&body.visitType!==undefined&&body.visitType!=='REGULAR')requests.fail('Este pedido requer uma visita regular.');
  if(modern&&Object.keys(body).some(key=>!['requestId','visitType','visitId','poolId','requestType','priority','productName','quantity','unit','message'].includes(key)))requests.fail('Conserve apenas os campos do pedido original.');
  const legacyId=value=>value===undefined||value===null||value===''?null:Number(value);
  if(!modern&&body.technicianId!==undefined&&body.technicianId!==''&&legacyId(body.technicianId)!==technicianId)requests.fail('Não pode enviar pedidos em nome de outro técnico.',403);
  const payload=validate(modern?Object.fromEntries(Object.entries(body).filter(([key])=>key!=='requestId')):{
    visitType:'REGULAR',visitId:legacyId(body.visitId),poolId:legacyId(body.poolId),requestType:String(body.requestType||'STOCK_REQUEST').toUpperCase(),priority:String(body.priority||'NORMAL').toUpperCase(),productName:String(body.productName||''),quantity:body.quantity===undefined||body.quantity===null?'':String(body.quantity),unit:String(body.unit||''),message:String(body.message||'')
  });
  const request=modern?requests.context(actor,'FIELD_STOCK_REQUEST',technicianId,body.requestId,payload):null;
  return prisma.$transaction(async tx=>{
    if(request){const saved=await requests.recover(tx,request);if(saved)return saved;}
    const technician=await tx.technician.findUnique({where:{id:technicianId},select:{id:true,name:true,active:true,vehicleId:true}});
    if(!technician?.active)requests.fail('Técnico indisponível. Preserve o pedido.',403);
    let visit=null;
    if(payload.visitId!==null){
      await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${payload.visitId} FOR UPDATE`;
      visit=await tx.serviceVisit.findUnique({where:{id:payload.visitId},select:{id:true,technicianId:true,poolId:true,clientId:true,pool:{select:{name:true}},client:{select:{name:true}}}});
      requests.authorize(actor,visit);
      if(modern&&visit.poolId!==payload.poolId)requests.fail('A piscina da visita mudou. Preserve o pedido e confirme o contexto com o escritório.',409,'STOCK_REQUEST_CONTEXT_CHANGED');
    }
    if(!modern){
      if((payload.poolId!==null&&payload.poolId!==visit?.poolId)||(legacyId(body.clientId)!==null&&legacyId(body.clientId)!==visit?.clientId)||(legacyId(body.vehicleId)!==null&&legacyId(body.vehicleId)!==technician.vehicleId))requests.fail('O contexto do aviso não corresponde à visita e ao técnico autenticado.',403);
    }
    const {requestType,priority,productName,quantity,unit,message}=payload;
    const title=requestType==='ADMIN_NOTE'?'Nota do técnico para a administração':requestType==='PURCHASE_REMINDER'?'Comprar material: '+(productName.trim()||'material'):'Stock em falta: '+(productName.trim()||'material');
    const description=[productName?`Material: ${productName}`:'',quantity?`Quantidade: ${quantity} ${unit}`:'',message?`Nota: ${message}`:'',visit?.pool?.name?`Piscina: ${visit.pool.name}`:'',visit?.client?.name?`Cliente: ${visit.client.name}`:'',`Técnico: ${technician.name} (#${technicianId})`].filter(Boolean).join('\n');
    const metadata={...payload,owner,requestId:request?.requestId||null,technicianId,technicianName:technician.name,poolId:visit?.poolId||null,clientId:visit?.clientId||null,vehicleId:technician.vehicleId,recipientRole:'ADMIN',source:'technician-field-mode'};
    const reminder=await tx.operationalReminder.create({data:{sourceKey:request?`stock-request:${owner}:${request.requestId}`:null,title,description,dueDate:new Date(),clientId:visit?.clientId||null,poolId:visit?.poolId||null,metadata}});
    // One internal ADMIN notification, independent of configurable audience rules.
    const notification=await tx.notification.create({data:{type:priority==='HIGH'?'STOCK_CRITICAL':'STOCK',eventType:'TECHNICIAN_STOCK_REQUEST',title,message:description||title,role:'ADMIN',severity:priority,status:'PENDING',metadata:{...metadata,reminderId:reminder.id}}});
    await tx.auditTrail.create({data:{eventType:'TECHNICIAN_STOCK_REQUEST',entity:'Notification',entityId:notification.id,technicianId,visitId:visit?.id||null,poolId:visit?.poolId||null,clientId:visit?.clientId||null,vehicleId:technician.vehicleId,action:'FIELD_STOCK_REQUEST_CREATE',message:'Pedido de material registado para a administração.',metadata:{...metadata,reminderId:reminder.id}}});
    const result={ok:true,stockRequest:{...payload,technicianId,clientId:visit?.clientId||null,vehicleId:technician.vehicleId,notificationId:notification.id,reminderId:reminder.id,recipientRole:'ADMIN',createdAt:notification.createdAt}};
    if(request)return requests.confirm(tx,request,result);
    return {...result,reminder,notification,confirmationMode:'LEGACY_NO_REQUEST_ID'};
  },{maxWait:15000,timeout:20000});
}
module.exports={create,validate};
