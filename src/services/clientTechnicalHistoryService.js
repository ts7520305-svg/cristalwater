'use strict';
const {prisma}=require('../prismaClient'),{scope}=require('../utils/clientReadScope'),R=require('../../frontend/cw-client-technical-rules');
// Explicit public projection. Internal notes, alert work items, contacts and financial data never enter this read.
const publicSelect={id:true,clientId:true,poolId:true,technicianName:true,date:true,plannedDate:true,startAt:true,endAt:true,status:true,notes:true,products:true,ph:true,chlorine:true,alkalinity:true,salt:true,temperature:true,orpMv:true,pool:{select:{id:true,name:true,type:true,zone:true}},technician:{select:{name:true}},chemicals:{select:{id:true,name:true,quantity:true,unit:true},orderBy:{id:'asc'}},photos:{select:{id:true,url:true,type:true,createdAt:true},orderBy:{id:'asc'}}};
function project(v){return {id:v.id,clientId:v.clientId,poolId:v.poolId,poolName:v.pool?.name??null,technicianName:v.technicianName,date:v.date.toISOString(),plannedDate:v.plannedDate?.toISOString()??null,startAt:v.startAt?.toISOString()??null,endAt:v.endAt?.toISOString()??null,status:v.status,notes:v.notes,products:v.products,readings:Object.fromEntries(R.readingKeys.map(k=>[k,v[k]])),chemicals:v.chemicals.map(c=>({name:c.name,quantity:c.quantity,unit:c.unit}))};}
async function read(actor,rawClientId,query={},database=prisma){
 const clientId=scope(actor,rawClientId),filters=R.filters(query);
 if(!R.positive(clientId)||!filters)throw Object.assign(Error('Reveja os filtros e a página.'),{statusCode:400});
 const where={clientId};if(filters.poolId)where.poolId=filters.poolId;
 if(filters.from||filters.to)where.date={...(filters.from?{gte:new Date(filters.from+'T00:00:00.000Z')} : {}),...(filters.to?{lte:new Date(filters.to+'T23:59:59.999Z')} : {})};
 return database.$transaction(async tx=>{
  if(!await tx.client.findUnique({where:{id:clientId},select:{id:true}}))throw Object.assign(Error('Cliente não encontrado.'),{statusCode:404});
  const total=await tx.serviceVisit.count({where}),rows=await tx.serviceVisit.findMany({where,skip:(filters.page-1)*R.pageSize,take:R.pageSize,orderBy:[{date:'desc'},{id:'desc'}],select:publicSelect}),pages=Math.max(1,Math.ceil(total/R.pageSize));
  const result={ok:true,version:1,clientId,asOf:new Date().toISOString(),timeZone:'UTC',basis:'RECORDED_CLIENT_VISITS',filters,pageSize:R.pageSize,total,pages,hasPrevious:filters.page>1,hasNext:filters.page<pages,visits:rows.map(project)};
  if(!R.packet(result,filters,clientId))throw Error('Invalid technical history source');return result;
 },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
}
module.exports={read,publicSelect,project};
