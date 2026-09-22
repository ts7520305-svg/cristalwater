'use strict';
const {randomUUID}=require('node:crypto'),{prisma}=require('../../src/prismaClient'),finance=require('../../src/business/finance/FinanceOsBusiness');
module.exports=async function create({admin,clientId,poolId,month,amountCents=2345,status='APPROVED',title='Historical repair '+randomUUID()}){
  if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true'||process.env.EXTERNAL_NOTIFICATIONS_ENABLED!=='false')throw Error('Isolated QA required');
  const repair=await prisma.repair.create({data:{poolId,problem:title,status,quantity:2,unitPrice:12,totalPrice:24}});
  const result=await finance.createDraftInvoice({clientId,standalone:true,lines:[{type:'REPAIR',lineType:'REPAIR',referenceId:repair.id,description:title,quantity:1,unitPrice:amountCents/100,total:amountCents/100,notes:'Confirmed invoice price'}]},'ADMIN:'+admin.id);
  if(!result.ok)throw Error(JSON.stringify(result));
  const invoice=await prisma.invoice.update({where:{id:result.invoice.id},data:{month,year:Number(month.slice(0,4)),status:'PENDING'},include:{lines:true}}),line=invoice.lines[0];
  const proof=await prisma.auditTrail.findFirstOrThrow({where:{eventType:'REPAIR_DOCUMENT_ORIGIN_RECORDED',entity:'InvoiceLine',entityId:line.id}});
  return {repair,invoice,line,proof};
};
