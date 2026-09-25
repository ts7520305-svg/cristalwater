'use strict';
const {createHmac}=require('node:crypto'),{prisma}=require('../prismaClient'),{getJwtSecret}=require('../utils/jwtSecret');
const writes=require('./fieldWriteRequestService'),R=require('../../frontend/cw-pool-calculator-rules'),chemistry=require('../business/pool/PoolChemistryBusiness');
const fail=(message,status=400,code='INVALID_CALCULATOR_REQUEST')=>writes.fail(message,status,code);
const clean=value=>JSON.parse(JSON.stringify(value));
function admin(actor){if(actor?.role!=='ADMIN'||!R.positive(Number(actor.userId||actor.id)))fail('Acesso reservado à administração.',403);return writes.owner(actor);}
function id(raw){if(!['number','string'].includes(typeof raw)||typeof raw==='string'&&!/^[1-9]\d*$/.test(raw)||!R.positive(Number(raw)))fail('Piscina inválida.');return Number(raw);}
const include={calculationProfile:true,client:{select:{id:true,name:true}}};
function version(row){const {client,...original}=row;return 'pool-calculator-v2:'+createHmac('sha256',getJwtSecret()).update(R.scope+'\0'+writes.hash(clean(original))).digest('hex');}
function snapshot(row){
  const p=row.calculationProfile,profile=p?Object.fromEntries(['id','poolId',...R.modelKeys].map(key=>[key,p[key]])):null;
  if(profile)profile.lastResultJson=R.object(p.lastResultJson)?{chemistry:Object.fromEntries(R.chemistry.map(key=>[key,typeof p.lastResultJson.chemistry?.[key]==='number'&&Number.isFinite(p.lastResultJson.chemistry[key])?p.lastResultJson.chemistry[key]:null]))}:null;
  const pool={id:row.id,clientId:row.clientId,name:row.name,type:row.type,volumeM3:row.volumeM3,client:row.client};
  return {ok:true,scope:R.scope,poolId:row.id,version:version(row),pool,profile,fields:R.form(pool,profile)};
}
async function read(actor,rawId,database=prisma){admin(actor);const poolId=id(rawId);return database.$transaction(async tx=>{const row=await tx.pool.findUnique({where:{id:poolId},include});if(!row)fail('Piscina não encontrada.',404);return snapshot(row);},{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});}
async function lock(tx,poolId){await tx.$queryRaw`SELECT id FROM "Pool" WHERE id=${poolId} FOR UPDATE`;await tx.$queryRaw`SELECT id FROM "PoolCalculationProfile" WHERE "poolId"=${poolId} FOR UPDATE`;}
function validateChanges(changed,fields){
  const choices={shape:['RECTANGULAR','OVAL','ROUND','CIRCULAR','KIDNEY','FREEFORM'],poolLoad:['NORMAL','LOW','HIGH'],heatPumpPhase:['','MONOFASICA','TRIFASICA']};
  return changed.every(key=>!choices[key]||choices[key].includes(fields[key]));
}
const finite=value=>typeof value==='number'?Number.isFinite(value):Array.isArray(value)?value.every(finite):R.object(value)?Object.values(value).every(finite):true;
async function write(actor,rawId,body,database=prisma){
  const owner=admin(actor),poolId=id(rawId);
  if(!body?.requestId)fail('Reveja a ficha e conserve o pedido antes de guardar.',428,'CALCULATOR_REVIEW_REQUIRED');
  if(!R.command(body))fail('Conserve os campos e a versão revista do pedido.');
  const context=R.intent(body),request=writes.context(actor,R.scope,poolId,body.requestId,context);
  return database.$transaction(async tx=>{
    const recovered=await writes.recover(tx,request);if(recovered)return recovered;
    await lock(tx,poolId);const before=await tx.pool.findUnique({where:{id:poolId},include});
    const reject=(code,message)=>writes.confirm(tx,request,{ok:true,applied:false,context,code,message});
    if(!before)return reject('CALCULATOR_NOT_FOUND','A piscina já não está disponível. Nenhuma alteração aplicada.');
    if(version(before)!==body.expectedVersion)return reject('CALCULATOR_STALE','A ficha mudou. Conserve os campos e carregue a versão atual antes de preparar outro pedido.');
    const patch=R.patch(before,before.calculationProfile,body.fields);
    if(!validateChanges(patch.changed,body.fields))return reject('CALCULATOR_INVALID','Reveja as opções alteradas. O valor histórico foi conservado.');
    const {calculation}=chemistry.buildOptimization(body.fields);
    if(!finite(calculation)||!['surfaceM2','volumeM3','volumeLitres'].every(key=>typeof calculation.geometry[key]==='number'))return reject('CALCULATOR_INVALID','Os valores indicados não permitem confirmar o cálculo. Nenhuma alteração aplicada.');
    await tx.poolCalculationProfile.upsert({where:{poolId},update:{...patch.profile,lastResultJson:calculation},create:{poolId,...patch.profile,lastResultJson:calculation}});
    const data={updatedAt:new Date(Math.max(Date.now(),before.updatedAt.getTime()+1))};
    if(patch.changed.some(key=>R.geometryKeys.includes(key))&&calculation.geometry.volumeM3>0)data.volumeM3=calculation.geometry.volumeM3;
    if(patch.changed.includes('shape'))data.type=patch.profile.shape;
    await tx.pool.update({where:{id:poolId},data});
    const after=await tx.pool.findUnique({where:{id:poolId},include}),state=snapshot(after);state.profile.lastResultJson=calculation;
    const history=await tx.technicalHistory.create({data:{poolId,type:'POOL_CALCULATOR_CHANGE',component:'Calculadora da piscina',message:'Cálculo revisto e confirmado',description:JSON.stringify({schema:1,owner,requestId:body.requestId,expectedVersion:body.expectedVersion,version:state.version,changedFields:patch.changed,before:clean({...before,client:undefined}),after:clean({...after,client:undefined})}),performedAt:new Date(),status:'DONE'}});
    return writes.confirm(tx,request,{ok:true,applied:true,context,state,calculation,changedFields:patch.changed,historyId:history.id});
  },{maxWait:15000,timeout:20000});
}
async function recover(actor,requestId,database=prisma){
  const owner=admin(actor);if(!R.uuid(requestId))fail('Pedido inválido.');
  const saved=await database.fieldWriteRequest.findUnique({where:{owner_requestId:{owner,requestId:requestId.toLowerCase()}}});
  if(!saved)return {ok:true,found:false};if(saved.scope!==R.scope)fail('O pedido pertence a outra operação.',409);
  return {ok:true,found:true,result:saved.response};
}
module.exports={read,write,recover,lock,snapshot};
