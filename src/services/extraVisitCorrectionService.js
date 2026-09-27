'use strict';
const { prisma } = require('../prismaClient');
const requests = require('./fieldWriteRequestService');
const executionService = require('./extraVisitExecutionService');
const readings = ['ph','chlorine','alkalinity','salt','temperature','orpMv'];
const checks = ['cleaned','brushed','vacuumed','basketCleaned','waterlineClean','backwashDone'];
const editable = [...readings,...checks,'notes','products'];
const own = (row,key) => Object.hasOwn(row,key);
function version(row) {
  return requests.hash({id:row.id,poolId:row.poolId,clientId:row.clientId,technicianId:row.technicianId,status:row.status,startAt:row.startAt?.toISOString(),endAt:row.endAt?.toISOString(),completionRequestId:row.completionRequestId,execution:row.execution});
}
function visitId(value) { const id = Number(value); if(!Number.isSafeInteger(id)||id<=0||id>2147483647)requests.fail('Visita extra inválida.'); return id; }
async function view(actor,value) {
  return prisma.$transaction(async tx => {
    const row = await tx.extraVisit.findUnique({where:{id:visitId(value)},include:{photos:true}});
    requests.authorize(actor,row);
    if(row.status!=='DONE'||!row.endAt)requests.fail('Escolha uma visita extra concluída.',409);
    const baseVersion=version(row), productCatalogue={version:1,owner:requests.owner(actor),visitId:row.id,poolId:row.poolId,baseVersion,asOf:new Date().toISOString(),state:'NO_ORIGINAL_GUIDE',guides:[]};
    const movements=await tx.vehicleStockMovement.findMany({where:{extraVisitId:row.id,movementType:{in:['CONSUMPTION','RETURN']}},select:{workGuideId:true,vehicleId:true}});
    if(movements.length){
      productCatalogue.state='REVIEW_REQUIRED';
      const ids=[...new Set(movements.map(m=>m.workGuideId))];
      if(ids.every(id=>Number.isSafeInteger(id)&&id>0)){
        const guides=await tx.workGuide.findMany({where:{id:{in:ids}},orderBy:{id:'asc'},select:{id:true,vehicleId:true,technicianId:true,status:true,items:{orderBy:{id:'asc'},select:{id:true,workGuideId:true,name:true,unit:true,quantity:true,initialQty:true,usedQty:true}}}});
        if(guides.length===ids.length&&guides.every(g=>g.status==='OPEN'&&(!g.technicianId||g.technicianId===row.technicianId)&&movements.filter(m=>m.workGuideId===g.id).every(m=>m.vehicleId===g.vehicleId))){
          productCatalogue.state='AVAILABLE';productCatalogue.guides=guides.map(g=>({...g,itemCount:g.items.length}));
        }
      }
    }
    return {ok:true,version:baseVersion,visit:executionService.project(row),productCatalogue};
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
}
async function reconcile(tx, visit, desiredRows, request) {
  return require('./visitProductStockReconciliation').reconcile(tx, visit, visit.execution?.chemicalsJson || [], desiredRows, { visitType: 'EXTRA', owner: request.owner, requestId: request.requestId });
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
