'use strict';
const {randomUUID,randomInt}=require('node:crypto'),{prisma}=require('../../src/prismaClient'),ledger=require('../../src/services/expenseLedgerService');
module.exports=async function({admin,extra=0}){
  if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false')throw Error('Isolated QA required');
  const tag='Maintenance cost '+randomUUID(),month='2008-07',documentMonth='2008-09',mismatchMonth='2008-08',sameId=randomInt(900000000,990000000);
  const client=await prisma.client.create({data:{name:tag+' <img src=x>'}}),other=await prisma.client.create({data:{name:tag+' new owner'}}),pool=await prisma.pool.create({data:{clientId:client.id,name:tag}}),sources=[],expenseIds=[];
  async function create(more={}){const value=await require('./maintenance-revenue-data')({admin,clientId:client.id,poolId:pool.id,month,title:tag+' '+sources.length+' <img src=x>',...more});sources.push(value);return value;}
  const equipment=await create({sourceId:sameId}),reminder=await create({sourceId:sameId,kind:'REMINDER',mode:'INCLUDED'}),extraEquipment=await create({visitType:'EXTRA',mode:'INCLUDED'}),extraReminder=await create({kind:'REMINDER'});
  for(let i=0;i<extra;i++)await create({kind:'REMINDER',mode:'INCLUDED'});
  const manual=more=>({title:tag,supplierId:null,supplierName:'QA supplier',documentNumber:'',expenseDate:documentMonth+'-01',dueDate:null,amountCents:10000,category:'GENERAL',notes:'',sourceType:'MANUAL',sourceId:null,sourceHash:null,reason:'',confirmed:true,...more});
  async function expense(more={}){const result=await ledger.command(admin,{requestId:randomUUID(),command:'CREATE',expenseId:null,expectedVersion:null,data:manual(more)});if(!result.applied)throw Error(JSON.stringify(result));expenseIds.push(result.expenseId);return result;}
  async function send(command,expenseId,data){const row=await prisma.companyExpense.findUniqueOrThrow({where:{id:expenseId}});return ledger.command(admin,{requestId:randomUUID(),command,expenseId,expectedVersion:row.version,data});}
  async function cleanup(){
    for(const model of ['expenseEvent','expensePayment','expenseAllocation'])await prisma[model].deleteMany({where:{expenseId:{in:expenseIds}}});await prisma.companyExpense.deleteMany({where:{id:{in:expenseIds}}});
    await prisma.operationalReminder.deleteMany({where:{id:{in:sources.map(s=>s.proof.id)}}});
    const invoices=sources.filter(s=>s.invoice).map(s=>s.invoice.id);await prisma.invoiceLine.deleteMany({where:{invoiceId:{in:invoices}}});await prisma.invoice.deleteMany({where:{id:{in:invoices}}});
    await prisma.equipmentMaintenanceCompletion.deleteMany({where:{id:{in:sources.filter(s=>s.kind==='EQUIPMENT').map(s=>s.row.id)}}});await prisma.generalReminder.deleteMany({where:{id:{in:sources.filter(s=>s.kind==='REMINDER').map(s=>s.row.id)}}});
    await prisma.equipmentMaintenancePlan.deleteMany({where:{id:{in:sources.filter(s=>s.plan).map(s=>s.plan.id)}}});
    for(const [model,type] of [['serviceVisit','REGULAR'],['extraVisit','EXTRA']])await prisma[model].deleteMany({where:{id:{in:sources.filter(s=>s.source.visitType===type).map(s=>s.visit.id)}}});
  }
  return {tag,month,documentMonth,mismatchMonth,sameId,client,other,pool,sources,equipment,reminder,extraEquipment,extraReminder,expenseIds,manual,expense,send,cleanup};
};
