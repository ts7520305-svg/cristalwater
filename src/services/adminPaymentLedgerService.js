'use strict';
const {prisma}=require('../prismaClient');
const R=require('../../frontend/cw-payment-ledger-rules');
const {isCashPayment}=require('./cashReceiptReportService');
const fail=(message,statusCode)=>{throw Object.assign(Error(message),{statusCode});};
const literal=value=>value.replace(/[\\%_]/g,'\\$&');
async function read(actor,query={},database=prisma){
  const actorId=Number(actor?.userId||actor?.id);
  if(actor?.role!=='ADMIN'||!R.positive(actorId))fail('Consulta reservada à administração.',403);
  const filters=R.filters(query);if(!filters)fail('Reveja os filtros e a página.',400);
  const where={},and=[];
  if(filters.clientId)where.invoice={clientId:filters.clientId};
  if(filters.method)where.method={equals:filters.method,mode:'insensitive'};
  if(filters.from||filters.to)where.paidAt={...(filters.from?{gte:new Date(filters.from+'T00:00:00.000Z')} : {}),...(filters.to?{lte:new Date(filters.to+'T23:59:59.999Z')} : {})};
  if(filters.q){
    const contains={contains:literal(filters.q),mode:'insensitive'},numeric=filters.q.match(/^(?:CW-0*|#)?([1-9]\d*)$/i),id=numeric?Number(numeric[1]):null;
    and.push({OR:[{invoice:{client:{name:contains}}},{invoice:{invoiceNumber:contains}},{method:contains},{notes:contains},...(R.positive(id)?[{id},{invoiceId:id},{invoice:{clientId:id}}]:[])]});
  }
  if(and.length)where.AND=and;
  return database.$transaction(async tx=>{
    if(filters.clientId&&!await tx.client.findUnique({where:{id:filters.clientId},select:{id:true}}))fail('Cliente não encontrado.',404);
    const total=await tx.payment.count({where});
    const records=await tx.payment.findMany({where,skip:(filters.page-1)*R.pageSize,take:R.pageSize,orderBy:[{paidAt:'desc'},{id:'desc'}],select:{id:true,invoiceId:true,amount:true,amountCents:true,method:true,notes:true,paidAt:true,invoice:{select:{id:true,clientId:true,invoiceNumber:true,monthRef:true,status:true,client:{select:{id:true,name:true}}}}}});
    const payments=records.map(p=>({id:p.id,invoiceId:p.invoiceId,clientId:p.invoice.clientId,clientName:p.invoice.client.name,documentReference:p.invoice.invoiceNumber,documentStatus:p.invoice.status,monthRef:p.invoice.monthRef,method:p.method,notes:p.notes,paidAt:p.paidAt.toISOString(),internalCredit:!isCashPayment(p),amountRaw:String(p.amount),storedAmountCents:p.amountCents,...R.money(String(p.amount),p.amountCents)}));
    const pages=Math.max(1,Math.ceil(total/R.pageSize)),owner='ADMIN:'+actorId;
    const result={ok:true,version:1,owner,asOf:new Date().toISOString(),timeZone:'UTC',basis:'PAYMENT_RECORDS_INCLUDING_INTERNAL_CREDIT',filters,pageSize:R.pageSize,total,pages,hasPrevious:filters.page>1,hasNext:filters.page<pages,payments};
    if(!R.packet(result,filters,owner))throw Error('Invalid payment ledger source');
    return result;
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
}
module.exports={read};
