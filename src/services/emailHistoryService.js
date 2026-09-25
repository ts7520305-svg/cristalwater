'use strict';
const {prisma}=require('../prismaClient'),R=require('../../frontend/cw-email-history-rules');
const fail=(message,statusCode)=>{throw Object.assign(Error(message),{statusCode});};
const literal=v=>v.replace(/[\\%_]/g,'\\$&');
async function read(actor,query={},database=prisma){
  const id=Number(actor?.userId||actor?.id);if(actor?.role!=='ADMIN'||!R.positive(id))fail('Consulta reservada à administração.',403);
  const filters=R.filters(query);if(!filters)fail('Reveja os filtros e a página.',400);
  const AND=[],f=filters;
  if(f.status)AND.push({status:f.status});if(f.type)AND.push({OR:[{type:f.type},{eventType:f.type}]});if(f.mode)AND.push({mode:f.mode});
  if(f.recipient)AND.push({OR:['to','toEmail'].map(k=>({[k]:{contains:literal(f.recipient),mode:'insensitive'}}))});
  if(f.q)AND.push({OR:['subject','error'].map(k=>({[k]:{contains:literal(f.q),mode:'insensitive'}}))});
  if(f.from)AND.push({createdAt:{gte:new Date(f.from+'T00:00:00.000Z')}});
  if(f.to)AND.push({createdAt:{lt:new Date(Date.parse(f.to+'T00:00:00.000Z')+86400000)}});
  const where=AND.length?{AND}:{};
  return database.$transaction(async tx=>{
    const asOf=new Date().toISOString(),owner='ADMIN:'+id,total=await tx.emailLog.count({where});
    const records=await tx.emailLog.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(f.page-1)*f.pageSize,take:f.pageSize,select:{id:true,to:true,toEmail:true,subject:true,eventType:true,type:true,mode:true,status:true,error:true,retryCount:true,lastRetryAt:true,createdAt:true}});
    const items=records.map(r=>({...r,createdAt:r.createdAt.toISOString(),lastRetryAt:r.lastRetryAt?.toISOString()??null})),totalPages=Math.max(1,Math.ceil(total/f.pageSize));
    const result={ok:true,version:1,owner,asOf,timeZone:'UTC',filters:f,page:f.page,pageSize:f.pageSize,total,totalPages,hasPrevious:f.page>1,hasNext:f.page<totalPages,items};
    if(!R.packet(result,f,owner))throw Error('Invalid email history projection');return result;
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
}
module.exports={read};
