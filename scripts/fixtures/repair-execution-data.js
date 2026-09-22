'use strict';
const {randomUUID}=require('node:crypto'),{prisma}=require('../../src/prismaClient');
module.exports=async function prepare({repair,clientId,admin,complete=false,reservationStatus='APPROVED'}){
  if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false')throw Error('Isolated QA required');
  const productName='REPAIR EXECUTION QA '+randomUUID().toUpperCase();
  const items=[{scope:'CENTRAL',vehicleId:null,productName,unit:'UN',quantity:2,category:'EQUIPMENT'}];
  const balance=await prisma.stockBalance.create({data:{scope:'CENTRAL',productName,unit:'UN',quantity:8,category:'EQUIPMENT'}});
  const reservation=await prisma.operationalLock.create({data:{lockType:'REPAIR_STOCK_RESERVATION',severity:'WARNING',status:reservationStatus,entity:'Repair',entityId:repair.id,poolId:repair.poolId,clientId,title:'Reserva QA',message:'Reserva QA',payload:{repairId:repair.id,poolId:repair.poolId,clientId,scope:'CENTRAL',vehicleId:null,items,actor:'QA',reservedAt:new Date().toISOString()}}});
  const result=complete?await require('../../src/business/repair/RepairBusiness').completeRepair(repair.id,prisma,'QA explicit completion',{id:admin.id,role:'ADMIN'}):null;
  if(complete&&!result.ok)throw Error(JSON.stringify(result));
  return {balance,reservation,items,result};
};
