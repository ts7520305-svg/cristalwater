'use strict';
const {prisma}=require('../prismaClient'),{normalizeRole}=require('../utils/roles'),R=require('../../frontend/cw-live-map-rules');
const fail=(message,statusCode)=>{throw Object.assign(Error(message),{statusCode});};
const locationSelect={id:true,latitude:true,longitude:true,updatedAt:true};
function project(kind,person,location,now){
 const l=location?{id:location.id,latitude:Number.isFinite(location.latitude)?location.latitude:null,longitude:Number.isFinite(location.longitude)?location.longitude:null,updatedAt:location.updatedAt.toISOString()}:null;
 return {key:kind+':'+person.id,kind,id:person.id,name:person.name,location:l,state:R.positionState(l,now)};
}
async function read(actor,query={},database=prisma){
 const id=Number(actor?.userId||actor?.id);if(actor?.role!=='ADMIN'||!R.positive(id))fail('Consulta reservada à administração.',403);const filters=R.filters(query);if(!filters)fail('Reveja os filtros e a página.',400);
 return database.$transaction(async tx=>{
  const now=new Date(),owner='ADMIN:'+id;
  // Explicit foreign keys own a position. Email/name similarity never changes ownership.
  const technicians=await tx.technician.findMany({where:{active:true,deletedAt:null},orderBy:{id:'asc'},select:{id:true,name:true,locations:{orderBy:[{updatedAt:'desc'},{id:'desc'}],take:1,select:locationSelect}}});
  const legacy=await tx.technicianLocation.findMany({where:{technicianId:null,userId:{not:null},user:{is:{active:true}}},orderBy:{userId:'asc'},select:{...locationSelect,user:{select:{id:true,name:true,role:true}}}});
  const all=[...technicians.map(t=>project('TECHNICIAN',t,t.locations[0],now.getTime())),...legacy.filter(l=>['TECHNICIAN','TEAM_LEADER'].includes(normalizeRole(l.user.role))).map(l=>project('USER',l.user,l,now.getTime()))].sort(R.compare);
  const matching=all.filter(r=>R.matches(r,filters)),total=matching.length,pages=Math.max(1,Math.ceil(total/R.pageSize));
  const result={ok:true,version:1,owner,asOf:now.toISOString(),timeZone:'UTC',freshMs:R.freshMs,basis:'LATEST_EXPLICIT_IDENTITY',filters,pageSize:R.pageSize,total,pages,hasPrevious:filters.page>1,hasNext:filters.page<pages,totals:R.totals(matching),rows:matching.slice((filters.page-1)*R.pageSize,filters.page*R.pageSize)};
  if(!R.packet(result,filters,owner))throw Error('Invalid live map projection');return result;
 },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
}
module.exports={read,project};
