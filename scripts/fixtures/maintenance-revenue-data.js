'use strict';
const {randomUUID}=require('node:crypto'),{prisma}=require('../../src/prismaClient'),billing=require('../../src/business/equipment/MaintenanceBillingBusiness');
module.exports=async function create({admin,clientId,poolId,month,kind='EQUIPMENT',visitType='REGULAR',sourceId,amountCents=1234,mode='EXTRA',completedAt,title='Historical maintenance '+randomUUID()}){
  if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false')throw Error('Isolated QA required');
  const date=completedAt||new Date(month+'-12T12:00:00Z');let row,visit,plan;
  if(kind==='EQUIPMENT'){
    plan=await prisma.equipmentMaintenancePlan.create({data:{poolId,component:'FILTER',title,instructions:'Historical intervention',intervalUnit:'MONTHS',intervalCount:3,nextDue:new Date(month+'-01Z')}});
    visit=await prisma[visitType==='EXTRA'?'extraVisit':'serviceVisit'].create({data:{clientId,poolId,status:'IN_PROGRESS',startAt:new Date(+date-3600000)}});
    row=await prisma.equipmentMaintenanceCompletion.create({data:{...(sourceId?{id:sourceId}:{}),planId:plan.id,version:1,[visitType==='EXTRA'?'extraVisitId':'visitId']:visit.id,requestId:randomUUID(),actor:'ADMIN:'+admin.id,fingerprint:randomUUID(),notes:'Historical execution confirmed',completedAt:date,result:{ok:true,plan:{id:plan.id,poolId,title,version:2},completedAt:date.toISOString()}}});
  }else row=await prisma.generalReminder.create({data:{...(sourceId?{id:sourceId}:{}),poolId,clientId,title,description:'Completed historical service',category:'POOL_SERVICE_REMINDER',status:'DONE',completedAt:date,dueAt:date}});
  const source=(await billing.list(admin,poolId,{kind})).rows.find(r=>r.sourceId===row.id);
  const decision=await billing.review(admin,kind,row.id,{expectedVersion:source.expectedVersion,expectedClientId:clientId,expectedPoolId:poolId,mode,amount:mode==='INCLUDED'?'0.00':(amountCents/100).toFixed(2),note:'Confirmed explicit historical maintenance price',confirmed:true});
  const invoice=decision.invoiceId?await prisma.invoice.update({where:{id:decision.invoiceId},data:{monthRef:null,month,year:Number(month.slice(0,4)),status:'PENDING'},include:{lines:true}}):null;
  const proof=await prisma.operationalReminder.findUniqueOrThrow({where:{sourceKey:'maintenance-billing:'+kind+':'+row.id}});
  return {kind,row,visit,plan,source,decision,invoice,line:invoice?.lines[0]||null,proof};
};
