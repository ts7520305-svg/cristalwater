'use strict';
const {prisma}=require('../prismaClient'),R=require('../../frontend/cw-admin-day-rules');
const fail=(message,statusCode)=>{throw Object.assign(Error(message),{statusCode});},named={select:{id:true,name:true}};
const shared={id:true,status:true,startAt:true,endAt:true,client:named,pool:named,technician:named};
function project(kind,v){const scheduled=kind==='REGULAR'?v.plannedDate||v.date:v.scheduledAt;return {key:kind+':'+v.id,kind,id:v.id,status:v.status,group:R.group(v.status),scheduledAt:scheduled.toISOString(),scheduleSource:kind==='REGULAR'?(v.plannedDate?'plannedDate':'date'):'scheduledAt',startAt:v.startAt?.toISOString()??null,endAt:v.endAt?.toISOString()??null,client:v.client,pool:v.pool,technician:v.technician,recordedTechnicianName:kind==='REGULAR'?v.technicianName:null,legacyUser:kind==='EXTRA'?v.user:null};}
async function read(actor,query={},database=prisma){
 const id=Number(actor?.userId||actor?.id);if(actor?.role!=='ADMIN'||!R.positive(id))fail('Consulta reservada à administração.',403);const f=R.filters(query);if(!f)fail('Reveja o dia, os filtros e a página.',400);
 return database.$transaction(async tx=>{
  const asOf=new Date().toISOString(),day=f.date||R.localDay(asOf),range=R.bounds(day),window={gte:new Date(range.start),lt:new Date(range.end)},owner='ADMIN:'+id;
  const regular=f.kind==='EXTRA'?[]:await tx.serviceVisit.findMany({where:{OR:[{plannedDate:window},{plannedDate:null,date:window}]},select:{...shared,plannedDate:true,date:true,technicianName:true}});
  const extra=f.kind==='REGULAR'?[]:await tx.extraVisit.findMany({where:{scheduledAt:window},select:{...shared,scheduledAt:true,user:named}});
  const rows=[...regular.map(v=>project('REGULAR',v)),...extra.map(v=>project('EXTRA',v))].filter(v=>R.matches(v,f)).sort(R.compare),total=rows.length,pages=Math.max(1,Math.ceil(total/R.pageSize));
  const result={ok:true,version:1,owner,asOf,timeZone:R.timeZone,basis:'SCHEDULED_DAY',day,range,filters:f,pageSize:R.pageSize,total,pages,hasPrevious:f.page>1,hasNext:f.page<pages,totals:R.totals(rows),rows:rows.slice((f.page-1)*R.pageSize,f.page*R.pageSize)};
  if(!R.packet(result,f,owner))throw Error('Invalid day visit projection');return result;
 },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
}
module.exports={read,project};
