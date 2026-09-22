'use strict';
const {prisma}=require('../prismaClient');
const writes=require('./fieldWriteRequestService');
const execution=require('./repairExecutionService');
const scope='REPAIR_EXECUTION';
const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function id(value){const n=Number(value);if(!positive(n)||typeof value!=='number'&&String(n)!==value)fail('Identificador de reparação inválido.');return n;}
const select={id:true,poolId:true,problem:true,quantity:true,status:true,createdAt:true,doneAt:true,pool:{select:{id:true,name:true,clientId:true}}};
const row=r=>({id:r.id,poolId:r.poolId,poolName:r.pool.name,problem:r.problem,quantity:r.quantity,status:r.status});
async function inspect(tx,repairId){
  let prepared;
  try{prepared=await execution.prepare(tx,repairId,{allowNoMaterials:true});}catch(e){if(e.status!==409)throw e;}
  const repair=await tx.repair.findUnique({where:{id:repairId},select});if(!repair)fail('Reparação não encontrada.',404);
  const proof=execution.evaluate(await execution.load(tx,[repairId]),repair,repair.pool.clientId);
  const view={...row(repair),execution:proof,canConfirm:false,materialMode:null,version:null,items:[],message:proof.state==='CONFIRMED'?'Execução já declarada e confirmada.':'Confirme o estado, a origem e a reserva com a administração. Históricos e reservas incoerentes exigem revisão própria.'};
  if(prepared?.noMaterials&&proof.state==='UNCONFIRMED')return {...view,canConfirm:true,materialMode:'NONE',version:writes.hash(JSON.parse(JSON.stringify({v:2,repair,reservation:null}))),message:'Esta reparação não tem reserva de materiais. Confirme apenas se o trabalho foi realizado sem utilizar materiais e descreva a intervenção. A data guardada é a do registo atual.'};
  if(!prepared?.reservation||proof.state!=='UNCONFIRMED')return view;
  const reservation=prepared.reservation,p=reservation.payload;
  const items=p.items.map(item=>({productName:item.productName.trim().toUpperCase(),unit:item.unit.trim().toUpperCase(),quantity:item.quantity,scope:String(item.scope||p.scope||'CENTRAL').trim().toUpperCase(),vehicleId:item.vehicleId??p.vehicleId??null}));
  if(items.some(i=>!['CENTRAL','VEHICLE'].includes(i.scope)||i.scope==='VEHICLE'&&!positive(i.vehicleId)||i.scope==='CENTRAL'&&i.vehicleId!==null))return view;
  return {...view,canConfirm:true,materialMode:'RESERVED',version:writes.hash(JSON.parse(JSON.stringify({v:1,repair,reservation}))),items,message:'Confirme apenas se esta reparação foi executada e estes materiais foram utilizados. A confirmação regista a data atual e consome a reserva indicada.'};
}
async function list(query){
  const q=typeof query.q==='string'?query.q.trim():'',page=query.page===undefined?1:id(query.page);
  if(q.length>160||page>100000)fail('Pesquisa inválida.');
  const number=/^#?[1-9]\d*$/.test(q)?Number(q.replace('#','')):null;
  const where=q?{OR:[{problem:{contains:q,mode:'insensitive'}},{pool:{name:{contains:q,mode:'insensitive'}}},...(positive(number)?[{id:number},{poolId:number}]:[])]}:{};
  return prisma.$transaction(async tx=>{const total=await tx.repair.count({where}),rows=await tx.repair.findMany({where,select,orderBy:{id:'desc'},skip:(page-1)*10,take:10});return {ok:true,q,page,pageSize:10,total,rows:rows.map(row)};},{isolationLevel:'RepeatableRead'});
}
async function detail(value){const repairId=id(value);return prisma.$transaction(async tx=>({ok:true,detail:await inspect(tx,repairId)}),{maxWait:15000,timeout:15000});}
function command(actor,value,body){
  const repairId=id(value);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==(body.noMaterials===undefined?4:5)||Object.keys(body).some(k=>!['requestId','poolId','expectedVersion','confirmed','noMaterials'].includes(k))||!positive(body.poolId)||!sha(body.expectedVersion)||body.confirmed!==true||body.noMaterials!==undefined&&!execution.validNoMaterials(body.noMaterials))fail('Reveja a reparação e confirme os materiais ou descreva a intervenção sem materiais.');
  const payload={poolId:body.poolId,expectedVersion:body.expectedVersion,confirmed:true,...(body.noMaterials?{noMaterials:body.noMaterials}:{})};
  return {request:writes.context(actor,scope,repairId,body.requestId,payload),payload};
}
async function apply(tx,actor,value,body,complete){
  const {request,payload}=command(actor,value,body),saved=await writes.recover(tx,request);if(saved)return saved;
  let view;try{view=await inspect(tx,request.resourceId);}catch(e){if(e.status!==404)throw e;}
  if(!view?.canConfirm||view.poolId!==payload.poolId||view.version!==payload.expectedVersion||(view.materialMode==='NONE')!==!!payload.noMaterials)return writes.confirm(tx,request,{ok:true,applied:false,context:payload,code:'REPAIR_EXECUTION_CHANGED',message:'A reparação, a reserva ou a confirmação mudou. O pedido não foi aplicado. Consulte novamente antes de preparar outra confirmação.'});
  const result=await complete();
  if(!result.ok)fail(result.error||'Conclusão não confirmada.',result.status||409);
  const response=await writes.confirm(tx,request,{ok:true,applied:true,context:payload,repair:{id:result.repair.id,poolId:result.repair.poolId,status:result.repair.status,doneAt:result.repair.doneAt},execution:result.execution});
  return {...response,event:result.event,eventRepair:result.repair};
}
async function lookup(actor,value,requestId,payloadHash){
  const repairId=id(value);if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)||!sha(payloadHash))fail('Pedido de recuperação inválido.');
  const saved=await prisma.fieldWriteRequest.findUnique({where:{owner_requestId:{owner:writes.owner(actor),requestId:requestId.toLowerCase()}}});
  if(!saved)return {ok:true,found:false};
  if(saved.scope!==scope||saved.resourceId!==repairId||saved.payloadHash!==payloadHash)fail('O pedido não corresponde à reparação guardada.',409);
  return {ok:true,found:true,result:saved.response};
}
module.exports={list,detail,apply,lookup};
