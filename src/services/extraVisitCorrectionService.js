'use strict';
const { prisma } = require('../prismaClient');
const requests = require('./fieldWriteRequestService');
const executionService = require('./extraVisitExecutionService');
const readings = ['ph','chlorine','alkalinity','salt','temperature','orpMv'];
const checks = ['cleaned','brushed','vacuumed','basketCleaned','waterlineClean','backwashDone'];
const editable = [...readings,...checks,'notes','products'];
const own = (row,key) => Object.hasOwn(row,key);
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const round = value => Math.round(value * 1e6) / 1e6;
const productKey = row => JSON.stringify([normalize(row.name ?? row.itemName),normalize(row.unit)]);
function version(row) {
  return requests.hash({id:row.id,poolId:row.poolId,clientId:row.clientId,technicianId:row.technicianId,status:row.status,startAt:row.startAt?.toISOString(),endAt:row.endAt?.toISOString(),completionRequestId:row.completionRequestId,execution:row.execution});
}
function visitId(value) { const id = Number(value); if(!Number.isSafeInteger(id)||id<=0||id>2147483647)requests.fail('Visita extra inválida.'); return id; }
async function view(actor,value) {
  const row = await prisma.extraVisit.findUnique({where:{id:visitId(value)},include:{photos:true}});
  requests.authorize(actor,row);
  if(row.status!=='DONE'||!row.endAt)requests.fail('Escolha uma visita extra concluída.',409);
  return {ok:true,version:version(row),visit:executionService.project(row)};
}
function products(rows) {
  if(!Array.isArray(rows))requests.fail('O consumo anterior precisa de revisão do escritório.',409);
  const result = new Map();
  for(const row of rows){
    if(!row||typeof row.name!=='string'||typeof row.unit!=='string'||!Number.isFinite(row.quantity)||row.quantity<=0)requests.fail('O consumo anterior precisa de revisão do escritório.',409);
    const key=productKey(row);result.set(key,{...row,quantity:round((result.get(key)?.quantity||0)+row.quantity)});
  }
  return result;
}
async function reconcile(tx,visit,desiredRows,request) {
  const previous=products(visit.execution?.chemicalsJson || []),desired=products(desiredRows);
  const deltas=[...new Set([...previous.keys(),...desired.keys()])].map(key=>({key,row:desired.get(key)||previous.get(key),delta:round((desired.get(key)?.quantity||0)-(previous.get(key)?.quantity||0))})).filter(row=>row.delta);
  if(!deltas.length)return;
  const movements=await tx.vehicleStockMovement.findMany({where:{extraVisitId:visit.id,movementType:{in:['CONSUMPTION','RETURN']}},orderBy:{id:'asc'}});
  const actual=new Map();
  for(const row of movements){if(!Number.isFinite(row.quantity)||row.quantity<=0||!row.unit)requests.fail('O histórico de stock precisa de revisão do escritório.',409);const key=productKey(row);actual.set(key,round((actual.get(key)||0)+(row.movementType==='RETURN'?-row.quantity:row.quantity)));}
  for(const key of new Set([...actual.keys(),...previous.keys()]))if(Math.abs((actual.get(key)||0)-(previous.get(key)?.quantity||0))>0.000001)requests.fail('O histórico de stock diverge do consumo da visita. Peça revisão ao escritório.',409);
  const originalGuides=[...new Set(movements.map(row=>row.workGuideId))];
  let initialGuide;
  if(!movements.length){
    const tech=await tx.technician.findUnique({where:{id:visit.technicianId},select:{vehicleId:true}});
    initialGuide=tech?.vehicleId ? await tx.workGuide.findFirst({where:{vehicleId:tech.vehicleId,status:'OPEN',OR:[{technicianId:visit.technicianId},{technicianId:null}]},orderBy:{id:'desc'}}) : null;
  }
  for(const item of deltas){
    const matches=[...new Set(movements.filter(row=>productKey(row)===item.key).map(row=>row.workGuideId))];
    const guides=matches.length?matches:originalGuides.length?originalGuides:[initialGuide?.id];
    if(guides.length!==1||!Number.isSafeInteger(guides[0]))requests.fail('A guia original não está identificada de forma única. Peça revisão do stock ao escritório.',409);
    item.guideId=guides[0];
  }
  const guides=new Map();
  for(const id of [...new Set(deltas.map(row=>row.guideId))].sort((a,b)=>a-b)){
    await tx.$queryRaw`SELECT id FROM "WorkGuide" WHERE id=${id} FOR UPDATE`;
    const guide=await tx.workGuide.findUnique({where:{id},include:{items:true}});
    if(!guide||guide.status!=='OPEN'||(guide.technicianId&&guide.technicianId!==visit.technicianId))requests.fail('A guia original está encerrada ou mudou de responsável. Peça revisão do stock ao escritório.',409);
    guides.set(id,guide);
  }
  for(const {row,delta,guideId} of deltas){
    const guide=guides.get(guideId),matches=guide.items.filter(item=>productKey(item)===productKey(row));
    if(matches.length!==1)requests.fail('Confirme o produto e a unidade na guia original: '+row.name,409);
    const item=matches[0];
    const changed=await tx.workGuideItem.updateMany({where:{id:item.id,...(delta>0?{quantity:{gte:delta}}:{usedQty:{gte:-delta}})},data:{quantity:{decrement:delta},usedQty:{increment:delta}}});
    if(changed.count!==1)requests.fail('Saldo insuficiente para corrigir '+row.name+'. Peça revisão ao escritório.',409);
    const movementType=delta>0?'CONSUMPTION':'RETURN',quantity=Math.abs(delta),notes=JSON.stringify({visitType:'EXTRA',extraVisitId:visit.id,requestId:request.requestId,owner:request.owner});
    await tx.vehicleStockMovement.create({data:{vehicleId:guide.vehicleId,workGuideId:guide.id,transportGuideId:guide.guideId,extraVisitId:visit.id,technicianId:visit.technicianId,itemName:item.name,itemType:item.type,unit:item.unit,quantity,movementType,source:'EXTRA_VISIT_CORRECTION',notes}});
    await tx.stockMovement.create({data:{vehicleId:guide.vehicleId,workGuideId:guide.id,transportGuideId:guide.guideId,extraVisitId:visit.id,poolId:visit.poolId,clientId:visit.clientId,technicianId:visit.technicianId,productName:item.name,category:item.type,unit:item.unit,quantity,movementType,...(delta>0?{scopeFrom:'VEHICLE'}:{scopeTo:'VEHICLE'}),createdBy:request.owner,notes}});
  }
}
async function correct(actor,value,body) {
  const id=visitId(value);
  if(!body||Array.isArray(body)||Object.keys(body).some(key=>!['requestId','visitType','poolId','baseVersion','reason',...editable].includes(key))||!editable.some(key=>own(body,key))||typeof body.baseVersion!=='string'||!/^[a-f0-9]{64}$/.test(body.baseVersion)||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>1000)requests.fail('Indique o motivo e conserve a versão consultada antes de corrigir.');
  const {baseVersion,reason,...completion}=body;
  const validated=executionService.validate(completion,true);
  const {requestId,...payload}=body,request=requests.context(actor,'EXTRA_VISIT_CORRECTION',id,requestId,payload);
  return prisma.$transaction(async tx=>{
    const saved=await requests.recover(tx,request);if(saved)return saved;
    const current=await executionService.locked(tx,actor,id,body.poolId);
    const rejected=(message,code)=>requests.confirm(tx,request,{ok:true,applied:false,message,code,visit:executionService.project(current),version:version(current)});
    if(current.status!=='DONE'||!current.endAt)return rejected('A visita deixou de estar concluída. Atualize a ronda.','EXTRA_CORRECTION_STATE');
    if(version(current)!==baseVersion)return rejected('O registo mudou desde a consulta. Reveja os valores atuais antes de preparar outra correção.','EXTRA_CORRECTION_STALE');
    const execution={...(current.execution||{})};
    for(const field of [...readings,...checks])if(own(body,field))execution[field]=validated[field]??(checks.includes(field)?body[field]:null);
    if(own(body,'notes'))execution.notes=body.notes;
    if(own(body,'products')){execution.products=validated.productsText||'[]';execution.chemicalsJson=validated.chemicalsJson||[];}
    await tx.$executeRawUnsafe('SAVEPOINT extra_correction_stock');
    try{if(own(body,'products'))await reconcile(tx,current,execution.chemicalsJson,request);}
    catch(error){
      if(error.statusCode!==409)throw error;
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT extra_correction_stock');
      return rejected(error.message,'EXTRA_CORRECTION_STOCK');
    }
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT extra_correction_stock');
    const updated=await tx.extraVisit.update({where:{id},data:{execution},include:{photos:true}});
    const metadata={visitType:'EXTRA',owner:request.owner,requestId:request.requestId,reason:reason.trim(),before:current.execution,after:execution};
    await tx.auditTrail.create({data:{eventType:'EXTRA_VISIT_CORRECTED',entity:'ExtraVisit',entityId:id,action:'EXTRA_VISIT_CORRECTED',message:'Registo técnico da visita extra corrigido.',technicianId:current.technicianId,poolId:current.poolId,clientId:current.clientId,metadata}});
    await tx.technicalHistory.create({data:{poolId:current.poolId,type:'EXTRA_VISIT_CORRECTED',component:'Extra Visit',message:'Registo técnico corrigido: '+reason.trim(),description:JSON.stringify(metadata),status:'DONE',performedAt:new Date()}});
    await tx.notification.create({data:{role:'ADMIN',type:'EXTRA_VISIT_CORRECTED',eventType:'EXTRA_VISIT_CORRECTED',title:'Visita extra corrigida',message:`${current.pool?.name || 'Piscina'}: ${reason.trim()}`,metadata:{extraVisitId:id,poolId:current.poolId,technicianId:current.technicianId,requestId:request.requestId}}});
    return requests.confirm(tx,request,{ok:true,applied:true,visit:executionService.project(updated),version:version(updated)});
  },{maxWait:15000,timeout:20000});
}
module.exports={view,correct};
