'use strict';
// Existing start aliases coordinate with reviewed transport creation. Reading stock never calls this service.
const {prisma}=require('../prismaClient'),{lockVehicle}=require('./transportGuideCreationService'),R=require('../../frontend/cw-transport-guide-rules');
const fail=(message,statusCode=409)=>{throw Object.assign(Error(message),{statusCode});};
const include={vehicle:true,technician:true,guide:{include:{items:true,vehicle:true}},items:true};
async function start(actor,body,db=prisma){
 const vehicleId=R.id(String(body.vehicleId||'')),technicianId=body.technicianId?R.id(String(body.technicianId)):null,guideId=body.transportGuideId?R.id(String(body.transportGuideId)):null;
 const startKm=body.startKm===undefined||body.startKm===null||body.startKm===''?null:Number(body.startKm);
 if(!vehicleId||body.technicianId&&!technicianId||body.transportGuideId&&!guideId||startKm!==null&&(!Number.isFinite(startKm)||startKm<0))fail('Reveja os identificadores e quilómetros.',400);
 if(!['ADMIN','TECHNICIAN','TEAM_LEADER'].includes(actor?.role))fail('Sem permissão.',403);
 return db.$transaction(async tx=>{
  await lockVehicle(tx,vehicleId);await tx.$queryRaw`SELECT id FROM "WorkGuide" WHERE "vehicleId"=${vehicleId} AND status='OPEN' ORDER BY id FOR UPDATE`;
  if(technicianId)await tx.$queryRaw`SELECT id FROM "Technician" WHERE id=${technicianId} FOR SHARE`;
  const technician=technicianId?await tx.technician.findUnique({where:{id:technicianId},select:{id:true,vehicleId:true,active:true,deletedAt:true}}):null;
  if(technicianId&&(!technician?.active||technician.deletedAt||technician.vehicleId!==vehicleId))fail('O técnico não está atribuído a esta viatura.');
  if(actor.role!=='ADMIN'&&technicianId!==Number(actor.technicianId||actor.id))fail('Acesso apenas à atribuição atual.',403);
  await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id=${vehicleId} FOR UPDATE`;
  const vehicle=await tx.vehicle.findUnique({where:{id:vehicleId}});if(!vehicle?.active||vehicle.deletedAt)fail('Viatura indisponível.');
  const active=await tx.transportGuide.findMany({where:{vehicleId,status:'ACTIVE'},orderBy:{id:'desc'},include:{items:true},take:2});if(active.length>1)fail('Existem várias guias ativas. Reveja-as na administração.');
  const guide=active[0]||null;if(guideId&&guide?.id!==guideId)fail('A guia indicada não está ativa nesta viatura.');
  const open=await tx.workGuide.findMany({where:{vehicleId,status:'OPEN'},include,orderBy:{id:'desc'},take:2});if(open.length>1)fail('Existem várias guias de obra abertas. Reveja-as na administração.');
  if(open[0]){if(open[0].guideId!==(guide?.id||null)||actor.role!=='ADMIN'&&open[0].technicianId!==technicianId)fail('A associação existente precisa de revisão.');return {workGuide:open[0],reused:true,missingTransportGuide:!guide};}
  if(guide&&await tx.workGuide.findFirst({where:{guideId:guide.id},select:{id:true}}))fail('A obra desta guia já foi fechada. Não será reaberta automaticamente.');
  let items=guide?.items||[],source=guide?'TRANSPORT_GUIDE':'EMPTY',inheritedFromId=guide?.id||null;
  if(!guide){const preset=await tx.systemSetting.findUnique({where:{key:'vehicle_preset_'+vehicleId}});if(preset){try{items=JSON.parse(preset.value);if(!Array.isArray(items))throw Error();}catch(_){fail('O preset de materiais precisa de revisão.');}source='VEHICLE_PRESET';}else{const last=await tx.transportGuide.findFirst({where:{vehicleId},orderBy:{createdAt:'desc'},include:{items:true}});if(last){items=last.items;inheritedFromId=last.id;source='LAST_GUIDE';}}}
  if(items.length>100||items.some(i=>!R.text(i.name,300)||!i.name.trim()||!R.text(i.unit,30)||!i.unit.trim()||R.units(i.quantity)===null))fail('Os materiais de origem precisam de revisão.');
  const workGuide=await tx.workGuide.create({data:{vehicleId,guideId:guide?.id||null,technicianId,startKm,notes:typeof body.notes==='string'?body.notes:null,status:'OPEN',isDraft:!guide,inheritedFromId,items:{create:items.map(i=>({name:i.name,type:i.type||null,unit:i.unit,quantity:i.quantity,initialQty:i.quantity,usedQty:0}))}},include});
  if(startKm!==null)await tx.vehicle.update({where:{id:vehicleId},data:{currentKm:startKm}});
  const auditActor=actor.role==='ADMIN'?'ADMIN:'+Number(actor.userId||actor.id):'TECH:'+Number(actor.technicianId||actor.id);
  await tx.userAuditLog.create({data:{actor:auditActor,action:'WORK_GUIDE_START',entity:'WorkGuide',entityId:String(workGuide.id),metadata:{vehicleId,technicianId,guideId:guide?.id||null,source}}});
  return {workGuide,reused:false,missingTransportGuide:!guide,provisionalSource:source};
 },{maxWait:15000,timeout:20000});
}
module.exports={start};
