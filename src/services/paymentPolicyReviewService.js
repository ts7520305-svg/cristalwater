'use strict';
const {prisma}=require('../prismaClient'),R=require('../../frontend/cw-payment-policy-rules'),{normalizeBool}=require('./systemSettingService');
const fail=(message,statusCode)=>{throw Object.assign(Error(message),{statusCode});};
function project(key,rows){const row=rows.find(r=>r.key===key),raw=row?row.value:null;return {key,source:row?'SAVED':'MISSING',raw,updatedAt:row?row.updatedAt.toISOString():null,recognized:R.recognized(key,raw)};}
async function read(actor,query={},database=prisma){
 const id=Number(actor?.userId||actor?.id);if(actor?.role!=='ADMIN'||!R.positive(id))fail('Consulta reservada à administração.',403);
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).length)fail('Esta consulta não aceita filtros.',400);
 return database.$transaction(async tx=>{
  const rows=await tx.systemSetting.findMany({where:{key:{in:[R.portalKey,...R.legacyKeys]}},select:{key:true,value:true,updatedAt:true}}),setting=project(R.portalKey,rows),owner='ADMIN:'+id;
  const result={ok:true,version:1,owner,asOf:new Date().toISOString(),timeZone:'UTC',readOnly:true,legacyApplied:false,portal:{setting,enabled:normalizeBool(setting.raw,false),defaultEnabled:false},legacy:R.legacyKeys.map(key=>project(key,rows))};
  if(!R.packet(result,owner))throw Error('Invalid payment policy projection');return result;
 },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:15000});
}
module.exports={read,project};
