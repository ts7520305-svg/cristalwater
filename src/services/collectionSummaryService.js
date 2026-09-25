'use strict';
const {prisma}=require('../prismaClient');
const R=require('../../frontend/cw-collection-summary-rules');
const {invoiceOpen}=require('./clientCreditService');
const fail=(message,statusCode)=>{throw Object.assign(Error(message),{statusCode});};
function project(client,now){
  const open=client.invoices.map(invoice=>({invoice,cents:Math.round(invoiceOpen(invoice)*100)})).filter(item=>item.cents>0);
  if(!open.length)return null;
  const overdue=open.filter(({invoice})=>String(invoice.status??'').trim().toUpperCase()==='OVERDUE'||invoice.dueDate&&invoice.dueDate.getTime()<now);
  const sum=items=>items.reduce((n,item)=>{const value=n+item.cents;if(!R.count(value))throw Error('Invalid collection amount');return value;},0);
  const result={id:client.id,name:client.name,clientStatus:client.status,paymentStatus:overdue.length?'OVERDUE':'PENDING',email:client.paymentReminderEmailAddress||client.email||null,phone:client.paymentReminderWhatsappNumber||client.phone||null,lastReminderAt:client.lastReminderAt?.toISOString()??null,openInvoices:open.length,overdueInvoices:overdue.length,amountCents:sum(open),overdueCents:sum(overdue)};
  if(!R.row(result))throw Error('Invalid collection source');
  return result;
}
async function read(actor,query={},database=prisma){
  const actorId=Number(actor?.userId||actor?.id);
  if(actor?.role!=='ADMIN'||!R.positive(actorId))fail('Consulta reservada à administração.',403);
  const filters=R.filters(query);if(!filters)fail('Reveja os filtros e a página.',400);
  return database.$transaction(async tx=>{
    const asOf=new Date(),owner='ADMIN:'+actorId;
    // The same snapshot supplies rows and totals. No ACTIVE-only scope and no guessed invoice counts.
    const records=await tx.client.findMany({where:{invoices:{some:{}}},orderBy:{id:'asc'},select:{id:true,name:true,status:true,email:true,phone:true,paymentReminderEmailAddress:true,paymentReminderWhatsappNumber:true,lastReminderAt:true,invoices:{select:{id:true,status:true,amount:true,total:true,totalAmount:true,amountPaid:true,amountOpen:true,dueDate:true}}}});
    const matching=records.map(c=>project(c,asOf.getTime())).filter(c=>c&&R.matches(c,filters)),total=matching.length,pages=Math.max(1,Math.ceil(total/R.pageSize));
    const result={ok:true,version:1,owner,asOf:asOf.toISOString(),timeZone:'UTC',basis:'RECEIVABLE_DOCUMENT_BALANCES_ALL_CLIENT_STATUSES',filters,pageSize:R.pageSize,total,pages,hasPrevious:filters.page>1,hasNext:filters.page<pages,totals:R.totals(matching),clients:matching.slice((filters.page-1)*R.pageSize,filters.page*R.pageSize)};
    if(!R.packet(result,filters,owner))throw Error('Invalid collection projection');
    return result;
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
}
module.exports={read,project};
