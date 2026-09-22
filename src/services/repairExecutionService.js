'use strict';
const {hash,owner}=require('./fieldWriteRequestService');
const eventType='REPAIR_EXECUTION_CONFIRMED';
const basis='EXPLICIT_AUTHENTICATED_REPAIR_COMPLETION';
const positive=v=>Number.isSafeInteger(v)&&v>0&&v<=2147483647;
const json=v=>JSON.parse(JSON.stringify(v));
const iso=v=>v instanceof Date&&Number.isFinite(v.getTime())?v.toISOString():null;
const normalize=v=>String(v||'').trim().toUpperCase();
const validNoMaterials=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&typeof v.reason==='string'&&v.reason===v.reason.trim()&&v.reason.length>=5&&v.reason.length<=1000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v.reason);
const source=r=>json({id:r.id,poolId:r.poolId,problem:r.problem,quantity:r.quantity,createdAt:r.createdAt});
const reservationSnapshot=r=>json({id:r.id,lockType:r.lockType,entity:r.entity,entityId:r.entityId,clientId:r.clientId,poolId:r.poolId,status:r.status,payload:r.payload,resolvedAt:r.resolvedAt});
const movementSnapshot=r=>json({id:r.id,movementType:r.movementType,scopeFrom:r.scopeFrom,scopeTo:r.scopeTo,vehicleId:r.vehicleId,productName:r.productName,category:r.category,unit:r.unit,quantity:r.quantity,poolId:r.poolId,clientId:r.clientId,createdBy:r.createdBy,createdAt:r.createdAt});
function fail(message='A execução ou a reserva da reparação precisa de revisão.',status=409){throw Object.assign(Error(message),{status});}
const pending=(state='UNCONFIRMED')=>({state,reason:state==='UNCONFIRMED'?'NO_EXPLICIT_COMPLETION':'EXECUTION_EVIDENCE_CHANGED',confirmedAt:null,completedMonth:null});
async function load(db,ids){
  const proofs=await db.auditTrail.findMany({where:{eventType,entity:'Repair',entityId:{in:ids}},select:{id:true,action:true,entityId:true,clientId:true,poolId:true,metadata:true,createdAt:true}});
  const reservationIds=[...new Set(proofs.map(p=>p.metadata?.reservation?.id).filter(positive))];
  const movementIds=[...new Set(proofs.flatMap(p=>Array.isArray(p.metadata?.movements)?p.metadata.movements.map(m=>m?.id):[]).filter(positive))];
  const noMaterialIds=proofs.filter(p=>p.metadata?.schema===2).map(p=>p.entityId);
  const [reservations,movements]=await Promise.all([db.operationalLock.findMany({where:{OR:[{id:{in:reservationIds}},{lockType:'REPAIR_STOCK_RESERVATION',entity:'Repair',entityId:{in:noMaterialIds}}]}}),db.stockMovement.findMany({where:{id:{in:movementIds}}})]);
  const byRepair=new Map();for(const p of proofs){const rows=byRepair.get(p.entityId)||[];rows.push(p);byRepair.set(p.entityId,rows);}
  return {proofs:byRepair,reservations:new Map(reservations.map(r=>[r.id,r])),movements:new Map(movements.map(m=>[m.id,m]))};
}
function evaluate(context,repair,clientId,asOf=new Date()){
  const proofs=context.proofs.get(repair.id)||[];if(!proofs.length)return pending();
  const p=proofs[0],s=p?.metadata,bad=()=>pending('REVIEW');
  if(proofs.length!==1||!s||![1,2].includes(s.schema)||s.basis!==basis||p.action!==eventType||s.repairId!==repair.id||!positive(s.clientId)||s.clientId!==clientId||p.clientId!==s.clientId||s.poolId!==repair.poolId||p.poolId!==s.poolId||!s.source||hash(s.source)!==hash(source(repair))||!/^ADMIN:[1-9]\d*$|^TECH:[1-9]\d*$|^USER:[1-9]\d*:TECH:[1-9]\d*$/.test(s.actor?.owner||'')||typeof s.actor?.label!=='string')return bad();
  const {fingerprint,...snapshot}=s;if(hash(snapshot)!==fingerprint||s.completedAt!==iso(p.createdAt)||s.completedAt!==iso(repair.doneAt)||!['DONE','INVOICED','CLOSED'].includes(normalize(repair.status))||p.createdAt>asOf||p.createdAt<repair.createdAt)return bad();
  if(s.schema===2){
    if(s.materialMode!=='NONE'||!validNoMaterials(s.noMaterials)||s.reservation!==null||!Array.isArray(s.movements)||s.movements.length||[...context.reservations.values()].some(r=>r.lockType==='REPAIR_STOCK_RESERVATION'&&r.entity==='Repair'&&r.entityId===repair.id))return bad();
    return {state:'CONFIRMED',reason:null,confirmedAt:s.completedAt,completedMonth:s.completedAt.slice(0,7)};
  }
  const reservation=context.reservations.get(s.reservation?.id);
  if(!reservation||reservation.status!=='RESOLVED'||hash(s.reservation)!==hash(reservationSnapshot(reservation))||reservation.entity!=='Repair'||reservation.entityId!==repair.id||reservation.clientId!==clientId||reservation.poolId!==repair.poolId||!Array.isArray(s.movements)||!s.movements.length||new Set(s.movements.map(m=>m?.id)).size!==s.movements.length)return bad();
  for(const m of s.movements){const current=context.movements.get(m?.id);if(!current||m.movementType!=='CONSUMPTION'||m.scopeTo!=='REPAIR'||m.clientId!==clientId||m.poolId!==repair.poolId||!Number.isFinite(m.quantity)||m.quantity<=0||hash(m)!==hash(movementSnapshot(current)))return bad();}
  return {state:'CONFIRMED',reason:null,confirmedAt:s.completedAt,completedMonth:s.completedAt.slice(0,7)};
}
async function prepare(db,repairId,{allowNoMaterials=false}={}){
  const id=Number(repairId);if(!positive(id)||typeof repairId!=='number'&&String(id)!==repairId)fail('Identificador de reparação inválido.',400);
  const initial=await db.repair.findUnique({where:{id},include:{pool:{select:{id:true,clientId:true}}}});if(!initial)fail('Reparação não encontrada.',404);
  // Match invoicing's client -> repair -> pool lock order. Recheck after locking.
  const clientId=initial.pool.clientId;await db.$queryRaw`SELECT id FROM "Client" WHERE id=${clientId} FOR UPDATE`;
  await db.$queryRaw`SELECT id FROM "Repair" WHERE id=${id} FOR UPDATE`;
  await db.$queryRaw`SELECT id FROM "Pool" WHERE id=${initial.poolId} FOR SHARE`;
  const repair=await db.repair.findUnique({where:{id},include:{pool:{select:{id:true,clientId:true}}}});
  if(!repair||repair.poolId!==initial.poolId||repair.pool.clientId!==clientId||repair.createdAt>new Date()||!positive(repair.quantity)||!repair.problem.trim())fail();
  const context=await load(db,[id]),existing=evaluate(context,repair,clientId);
  if(existing.state==='CONFIRMED')return {repair,clientId,existing};
  if(context.proofs.has(id)||!['SCHEDULED','APPROVED','INVOICED'].includes(normalize(repair.status)))fail();
  const locks=await db.operationalLock.findMany({where:{lockType:'REPAIR_STOCK_RESERVATION',entity:'Repair',entityId:id},select:{id:true}});
  if(!locks.length&&allowNoMaterials&&!repair.doneAt){
    if(await db.auditTrail.count({where:{entity:'Repair',entityId:id,eventType:{in:['REPAIR_COMPLETED','REPAIR_STOCK_CONSUMED']}}}))fail();
    return {repair,clientId,noMaterials:true};
  }
  if(locks.length!==1)fail();await db.$queryRaw`SELECT id FROM "OperationalLock" WHERE id=${locks[0].id} FOR UPDATE`;
  const reservation=await db.operationalLock.findUnique({where:{id:locks[0].id}}),p=reservation?.payload;
  if(!reservation||reservation.status!=='APPROVED'||reservation.clientId!==clientId||reservation.poolId!==repair.poolId||p?.repairId!==id||p?.clientId!==clientId||p?.poolId!==repair.poolId||!Array.isArray(p.items)||!p.items.length||p.items.some(i=>!i||typeof i.productName!=='string'||!i.productName.trim()||!Number.isFinite(i.quantity)||i.quantity<1||typeof i.unit!=='string'||!i.unit.trim()))fail();
  return {repair,clientId,reservation};
}
async function record(db,{repair,clientId,reservation,movements,actor,principal,noMaterials}){
  // Internal legacy callers retain their existing completion path. Only an
  // explicitly authenticated completion creates financial execution evidence.
  if(!principal)return pending();
  const actorOwner=owner(principal),completedAt=iso(repair.doneAt);
  if(noMaterials&&!validNoMaterials(noMaterials))fail('Indique o trabalho realizado sem materiais.',400);
  const snapshot={schema:noMaterials?2:1,basis,repairId:repair.id,clientId,poolId:repair.poolId,source:source(repair),completedAt,actor:{owner:actorOwner,label:String(actor)},reservation:noMaterials?null:reservationSnapshot(reservation),movements:movements.map(movementSnapshot),...(noMaterials?{materialMode:'NONE',noMaterials}: {})};
  await db.auditTrail.create({data:{eventType,action:eventType,entity:'Repair',entityId:repair.id,clientId,poolId:repair.poolId,createdAt:repair.doneAt,message:'Execução declarada na conclusão autenticada da reparação.',metadata:{...snapshot,fingerprint:hash(snapshot)}}});
  return {state:'CONFIRMED',reason:null,confirmedAt:completedAt,completedMonth:completedAt.slice(0,7)};
}
module.exports={eventType,basis,prepare,record,load,evaluate,validNoMaterials};
