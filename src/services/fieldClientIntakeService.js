'use strict';
const {prisma}=require('../prismaClient');
const requests=require('./fieldWriteRequestService');
const {createHmac}=require('node:crypto');
const {getJwtSecret}=require('../utils/jwtSecret');
const fields=['clientName','phone','email','address','zone','poolName','poolType','volumeM3','latitude','longitude','notes'];
const limits={clientName:200,phone:60,email:254,address:1000,zone:120,poolName:200,poolType:80,volumeM3:40,latitude:40,longitude:40,notes:5000};
const settingKeys=['TECHNICIANS_CAN_CREATE_CLIENTS_POOLS','TECHNICIAN_CREATED_RECORDS_REQUIRE_ADMIN_REVIEW','TECHNICIAN_CREATED_POOLS_ACTIVE_BY_DEFAULT'];
const id=value=>Number.isSafeInteger(value)&&value>0&&value<=2147483647;
const clean=value=>value.trim()||null;
const decimal=value=>value===''?null:Number(value.replace(',','.'));
const fail=requests.fail;
function payload(body,modern){
  const result=modern?Object.fromEntries(Object.entries(body).filter(([key])=>key!=='requestId')):Object.fromEntries(fields.map(key=>[key,body[key]===undefined||body[key]===null?'':String(body[key])]));
  if(!modern&&!result.clientName)result.clientName=String(body.name||'');
  if(Object.keys(result).length!==fields.length||Object.keys(result).some(key=>!fields.includes(key))||fields.some(key=>typeof result[key]!=='string'||result[key].length>limits[key])||!result.clientName.trim())fail('Confirme o nome e os campos da ficha.');
  if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email.trim()))fail('Indique um email válido ou deixe o campo vazio.');
  if(modern&&!['','Privada','Condomínio','Hotel','Jacuzzi'].includes(result.poolType))fail('Tipo de piscina inválido.');
  for(const key of ['volumeM3','latitude','longitude'])if(result[key]!==''&&(!/^-?\d+(?:[.,]\d+)?$/.test(result[key])||!Number.isFinite(decimal(result[key]))))fail('Indique números válidos, ou deixe os campos vazios.');
  const volume=decimal(result.volumeM3),lat=decimal(result.latitude),lng=decimal(result.longitude);
  if(volume!==null&&(volume<=0||volume>1000000))fail('O volume deve ser positivo e não superior a 1 000 000 m³.');
  if((lat===null)!==(lng===null)||lat!==null&&(lat < -90||lat > 90||lng < -180||lng > 180))fail('Indique latitude e longitude válidas, ou deixe ambas vazias.');
  return result;
}
async function settings(db=prisma){
  const rows=await db.systemSetting.findMany({where:{key:{in:settingKeys}},select:{key:true,value:true}}),values=Object.fromEntries(rows.map(row=>[row.key,row.value]));
  const bool=(key,fallback)=>values[key]===undefined?fallback:['true','1','yes','sim','on'].includes(String(values[key]).toLowerCase());
  return {techniciansCanCreateClientsPools:bool(settingKeys[0],false),requireAdminReview:bool(settingKeys[1],true),poolsActiveByDefault:bool(settingKeys[2],false)};
}
const clientFields=['id','name','phone','email','address','zone','latitude','longitude','notes','active','status','source','createdByTechnicianId','pendingReview','reviewStatus','reviewedAt','reviewedByUserId','createdAt','updatedAt','archiveStatus','deletedAt'];
const poolFields=['id','clientId','name','address','zone','type','volumeM3','latitude','longitude','notes','active','source','createdByTechnicianId','pendingReview','reviewStatus','reviewedAt','reviewedByUserId','createdAt','updatedAt','archiveStatus','deletedAt'];
const pick=(row,keys)=>Object.fromEntries(keys.map(key=>[key,row[key]]));
const view=state=>({client:pick(state.client,clientFields),pools:state.pools.map(row=>pick(row,poolFields))});
const version=state=>'intake-v1:'+createHmac('sha256',getJwtSecret()).update('FIELD_CLIENT_APPROVAL\0'+requests.hash(JSON.parse(JSON.stringify(state)))).digest('hex');
const targetPools=state=>state.pools.filter(row=>row.pendingReview).map(row=>row.id);
async function state(db,clientId){const client=await db.client.findUnique({where:{id:clientId}});if(!client)fail('Cliente não encontrado.',404,'INTAKE_NOT_FOUND');return {client,pools:await db.pool.findMany({where:{clientId},orderBy:{id:'asc'}})};}
async function create(actor,body={}){
  if(!body||typeof body!=='object'||Array.isArray(body))fail('Ficha inválida.');
  const owner=requests.owner(actor),admin=owner.startsWith('ADMIN:'),modern=body.requestId!==undefined,technicianId=admin?(body.technicianId?Number(body.technicianId):null):Number(actor.technicianId||actor.id);
  if(modern&&admin)fail('Use uma sessão de técnico para este cadastro.',403);
  if(!admin&&body.technicianId!==undefined&&body.technicianId!==''&&Number(body.technicianId)!==technicianId)fail('Não pode criar registos em nome de outro técnico.',403);
  if(technicianId!==null&&!id(technicianId))fail('Técnico inválido.');
  const p=payload(body,modern),request=modern?requests.context(actor,'FIELD_CLIENT_INTAKE',technicianId,body.requestId,p):null;
  const legacy={};for(const key of ['poolAddress','poolNotes']){const value=body[key];if(!modern&&value!==undefined){if(typeof value!=='string'||value.length>(key==='poolNotes'?5000:1000))fail('Dados da piscina inválidos.');legacy[key]=clean(value);}}
  return prisma.$transaction(async tx=>{
    if(request){const saved=await requests.recover(tx,request);if(saved)return saved;}
    if(technicianId!==null){const tech=await tx.technician.findUnique({where:{id:technicianId},select:{active:true}});if(!tech?.active)fail('Técnico indisponível.',403);}
    const policy=await settings(tx);if(!policy.techniciansCanCreateClientsPools)fail('O cadastro em campo está desativado. O pedido foi preservado.',403,'INTAKE_DISABLED');
    const requireReview=policy.requireAdminReview,shared={zone:clean(p.zone),latitude:decimal(p.latitude),longitude:decimal(p.longitude),notes:clean(p.notes),source:'TECHNICIAN_FIELD_INTAKE',createdByTechnicianId:technicianId,pendingReview:requireReview,reviewStatus:requireReview?'PENDING':'APPROVED'};
    const client=await tx.client.create({data:{...shared,name:p.clientName.trim(),phone:clean(p.phone),email:clean(p.email),address:clean(p.address),status:requireReview?'PENDING_REVIEW':'ACTIVE',active:!requireReview}});
    const pool=await tx.pool.create({data:{...shared,clientId:client.id,name:p.poolName.trim()||'Piscina principal',address:legacy.poolAddress??clean(p.address),notes:legacy.poolNotes??shared.notes,type:clean(p.poolType),volumeM3:decimal(p.volumeM3),active:requireReview?policy.poolsActiveByDefault:true}});
    const task=await tx.task.create({data:{title:'Completar ficha de campo: '+client.name,description:'Rever os dados e completar ficha técnica, preços, acessos e ronda. A aprovação do cadastro não conclui este trabalho.',status:'PENDING',priority:'HIGH',clientId:client.id,poolId:pool.id}});
    const audit=await tx.userAuditLog.create({data:{userId:admin||actor.principalType==='USER'?Number(actor.userId||actor.id):null,actor:owner,action:'FIELD_CLIENT_INTAKE_CREATED',entity:'Client',entityId:String(client.id),metadata:{requestId:request?.requestId||null,payload:p,policy,technicianId,clientId:client.id,poolId:pool.id,taskId:task.id}}});
    const result={ok:true,client:pick(client,clientFields),pool:pick(pool,poolFields),pendingReview:requireReview,intake:{...p,technicianId,clientId:client.id,poolId:pool.id,taskId:task.id,auditId:audit.id,policy,clientActive:client.active,poolActive:pool.active,pendingReview:requireReview,createdAt:client.createdAt}};
    return request?requests.confirm(tx,request,result):{...result,confirmationMode:'LEGACY_NO_REQUEST_ID'};
  },{maxWait:15000,timeout:20000});
}
function admin(actor){const owner=requests.owner(actor);if(!owner.startsWith('ADMIN:'))fail('A revisão requer administração.',403);return owner;}
async function pending(actor){
  admin(actor);const clients=await prisma.client.findMany({where:{OR:[{pendingReview:true},{pools:{some:{pendingReview:true}}}]},include:{pools:{orderBy:{id:'asc'}}},orderBy:[{createdAt:'desc'},{id:'desc'}]});
  return {ok:true,clients:clients.map(({pools,...client})=>{const current={client,pools};return {...view(current).client,pools:view(current).pools,approvalVersion:version(current),approvalPoolIds:targetPools(current)};})};
}
async function getState(actor,clientId){admin(actor);if(!id(clientId))fail('Cliente inválido.');const current=await state(prisma,clientId);return {ok:true,...view(current),approvalVersion:version(current),approvalPoolIds:targetPools(current)};}
async function approve(actor,clientId,body={}){
  const owner=admin(actor);if(!id(clientId)||!body||typeof body!=='object'||Array.isArray(body))fail('Aprovação inválida.');
  const modern=body.requestId!==undefined;
  if(modern&&(Object.keys(body).length!==4||Object.keys(body).some(key=>!['requestId','clientId','expectedVersion','poolIds'].includes(key))||body.clientId!==clientId||!/^intake-v1:[a-f0-9]{64}$/.test(body.expectedVersion)||!Array.isArray(body.poolIds)||body.poolIds.some((value,index)=>!id(value)||index>0&&value<=body.poolIds[index-1])))fail('Conserve a ficha, a versão e as piscinas revistas.');
  const context=modern?{clientId,expectedVersion:body.expectedVersion,poolIds:body.poolIds}:null,request=modern?requests.context(actor,'FIELD_CLIENT_APPROVAL',clientId,body.requestId,context):null;
  return prisma.$transaction(async tx=>{
    if(request){const saved=await requests.recover(tx,request);if(saved)return saved;}
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id=${clientId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Pool" WHERE "clientId"=${clientId} ORDER BY id FOR UPDATE`;
    const before=await state(tx,clientId),currentVersion=version(before),poolIds=targetPools(before);
    const reject=async(code,message)=>request?requests.confirm(tx,request,{ok:true,applied:false,context,code,message,currentVersion}):fail(message,409,code);
    if(request&&(currentVersion!==context.expectedVersion||JSON.stringify(poolIds)!==JSON.stringify(context.poolIds)))return reject('INTAKE_APPROVAL_STALE','A ficha ou as piscinas mudaram. Reveja a versão atual antes de aprovar.');
    if(before.client.source!=='TECHNICIAN_FIELD_INTAKE'||before.client.deletedAt||before.client.archiveStatus!=='ATIVO'||!before.pools.length||before.pools.some(row=>row.pendingReview&&(row.source!=='TECHNICIAN_FIELD_INTAKE'||row.deletedAt||row.archiveStatus!=='ATIVO'))||!before.client.pendingReview&&!poolIds.length)return reject('INTAKE_APPROVAL_STATE','Não há uma ficha de campo pendente disponível para esta aprovação.');
    const reviewedAt=new Date(),reviewedByUserId=Number(actor.userId||actor.id),review={active:true,pendingReview:false,reviewStatus:'APPROVED',reviewedAt,reviewedByUserId};
    const client=await tx.client.update({where:{id:clientId},data:{...review,status:'ACTIVE'}});
    await tx.pool.updateMany({where:{clientId,id:{in:poolIds},pendingReview:true},data:review});
    const after=await state(tx,clientId);
    if(after.pools.some(row=>poolIds.includes(row.id)&&(!row.active||row.pendingReview||row.reviewedByUserId!==reviewedByUserId||row.reviewedAt?.getTime()!==reviewedAt.getTime())))throw Error('Approval write unconfirmed');
    const audit=await tx.userAuditLog.create({data:{userId:reviewedByUserId,actor:owner,action:'FIELD_CLIENT_INTAKE_APPROVED',entity:'Client',entityId:String(clientId),metadata:{requestId:request?.requestId||null,before:view(before),after:view(after),poolIds}}});
    const result={ok:true,applied:true,context:context||{clientId,expectedVersion:currentVersion,poolIds},approval:{clientId,poolIds,reviewedAt,reviewedByUserId,auditId:audit.id,version:version(after)},...view(after)};
    return request?requests.confirm(tx,request,result):{...result,confirmationMode:'LEGACY_NO_REQUEST_ID'};
  },{maxWait:15000,timeout:20000});
}
module.exports={create,settings,pending,getState,approve,payload};
