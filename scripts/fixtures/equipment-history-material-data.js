'use strict';
const {randomUUID}=require('node:crypto'),{prisma}=require('../../src/prismaClient');
const equipment=require('../../src/business/equipment/EquipmentMaintenanceBusiness'),billing=require('../../src/business/equipment/MaintenanceBillingBusiness');
module.exports=async admin=>{
  const f=await require('./maintenance-material-data')(admin);
  const plan=(await equipment.create(admin,f.pool.id,{component:'FILTER',title:'Materiais históricos '+randomUUID(),instructions:'Consultar evidência histórica',intervalUnit:'MONTHS',intervalCount:1,nextDue:f.month+'-01'})).plan;
  await prisma.serviceVisit.update({where:{id:f.sameId},data:{status:'IN_PROGRESS',endAt:null}});
  const body={requestId:randomUUID(),visitId:f.sameId,expectedVersion:plan.version,notes:'Documento histórico conservado sem comprovativo técnico.',confirmed:true},result=await equipment.complete(admin,plan.id,body);
  const row=await prisma.equipmentMaintenanceCompletion.findUniqueOrThrow({where:{requestId:body.requestId}});
  await prisma.serviceVisit.update({where:{id:f.sameId},data:{status:'DONE',endAt:new Date(Math.max(Date.now(),+f.endAt))}});
  const source=(await billing.list(admin,f.pool.id,{kind:'EQUIPMENT'})).rows.find(s=>s.sourceId===row.id);
  await billing.review(admin,'EQUIPMENT',row.id,{expectedVersion:source.expectedVersion,expectedClientId:f.client.id,expectedPoolId:f.pool.id,mode:'INCLUDED',amount:'0.00',note:'Origem comercial histórica revista',confirmed:true});
  return {...f,legacy:row,legacyBody:body,legacyResult:result,async cleanup(){
    await prisma.fieldWriteRequest.deleteMany({where:{resourceId:row.id,scope:{in:['EQUIPMENT_HISTORY_REVIEW','EQUIPMENT_MATERIAL_REVIEW']}}});
    await prisma.technicalHistory.deleteMany({where:{poolId:f.pool.id,type:{in:['EQUIPMENT_HISTORY_REVIEW','EQUIPMENT_MATERIAL_REVIEW']}}});
    await prisma.userAuditLog.deleteMany({where:{entityId:String(row.id),action:{in:['EQUIPMENT_HISTORY_REVIEW','EQUIPMENT_MATERIAL_REVIEW']}}});
    await prisma.operationalReminder.deleteMany({where:{sourceKey:'maintenance-billing:EQUIPMENT:'+row.id}});
    await prisma.equipmentMaintenanceCompletion.delete({where:{id:row.id}});
    await prisma.equipmentMaintenancePlan.delete({where:{id:plan.id}});await f.cleanup();
  }};
};
