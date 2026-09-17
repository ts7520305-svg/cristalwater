'use strict';
const requests = require('./fieldWriteRequestService');
const withdrawn = ['CANCELLED','CANCELED','SKIPPED','ARCHIVED'];
const closed = [...withdrawn,'DONE','COMPLETED','CONCLUIDA','CONCLUIDO'];
const type = metadata => metadata?.visitType === 'EXTRA' ? 'EXTRA' : 'REGULAR';
const key = (visitType, id) => `${visitType}:${id}`;
const prefix = (visitType, id, source = 'incomplete') => `${source}:${visitType === 'EXTRA' ? 'EXTRA:' : ''}${id}:`;
const model = (db, visitType) => visitType === 'EXTRA' ? db.extraVisit : db.serviceVisit;
async function lock(tx, visitType, id) {
  if (visitType === 'EXTRA') await tx.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${id} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR UPDATE`;
}
async function locked(tx, actor, visitType, id) {
  if (visitType === 'EXTRA') return require('./extraVisitExecutionService').locked(tx, actor, id);
  await lock(tx, visitType, id);
  const visit = await tx.serviceVisit.findUnique({where:{id},include:{pool:{select:{name:true}}}});
  requests.authorize(actor, visit); return visit;
}
function project(visitType, visit) {
  if (!visit) return null;
  return {id:visit.id,visitType,poolId:visit.poolId,clientId:visit.clientId,technicianId:visit.technicianId,technicianName:visit.technicianName||visit.technician?.name||null,status:visit.status,startAt:visit.startAt,endAt:visit.endAt,plannedDate:visitType==='EXTRA'?visit.scheduledAt:visit.plannedDate};
}
async function state(db, visitType, visit) {
  const reminders = await db.operationalReminder.findMany({where:{sourceKey:{startsWith:prefix(visitType,visit.id)}},orderBy:{id:'asc'}});
  const ids = [...new Set(reminders.map(row=>row.metadata?.returnPlan?.visitId).filter(Number.isSafeInteger))];
  const returns = ids.length ? await model(db,visitType).findMany({where:{id:{in:ids}},orderBy:{id:'asc'}}) : [];
  // Appending unrelated safety notes must not invalidate a report that preserves those notes.
  const versionVisit=row=>Object.fromEntries(['id','poolId','clientId','technicianId','status','startAt','endAt','plannedDate','scheduledAt','date','billingMode','commercialRule','isBillable','price','unitPrice','totalPrice','includedInPackage','billed','billingStatus'].filter(f=>row[f]!==undefined).map(f=>[f,row[f]]));
  const baseVersion = requests.hash(JSON.parse(JSON.stringify({visitType,visit:versionVisit(visit),reminders,returns:returns.map(versionVisit)})));

  return {reminders,returns,baseVersion};
}
async function assertNoReturn(tx, visitType, visit) {
  const reminders = await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:prefix(visitType,visit.id)}}});
  const ids = reminders.map(row=>row.metadata?.returnPlan?.visitId).filter(Number.isSafeInteger);
  if (ids.length && await model(tx,visitType).findFirst({where:{id:{in:ids},status:{notIn:withdrawn}}})) requests.fail('O escritório agendou um regresso. Conclua a visita de regresso ou confirme com o escritório.',409,'RETURN_ALREADY_SCHEDULED');
}
async function settle(tx, visitType, visitId) {
  const own = await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:prefix(visitType,visitId)},isCompleted:false}});
  const reviewed = new Set(); let ids=[visitId], rows=own;
  while (ids.length) {
    ids.forEach(id=>reviewed.add(id));
    const ancestors=await tx.operationalReminder.findMany({where:{sourceKey:{startsWith:'incomplete:'},isCompleted:false,OR:ids.map(id=>({metadata:{path:['returnPlan','visitId'],equals:id}}))}});
    rows=[...new Map([...rows,...ancestors.filter(row=>type(row.metadata)===visitType)].map(row=>[row.id,row])).values()];
    const next=[];
    for(const row of rows){
      await tx.operationalReminder.update({where:{id:row.id},data:{isCompleted:true,metadata:{...row.metadata,resolvedByReturnVisitId:visitId,resolvedByReturnVisitType:visitType,resolvedAt:new Date().toISOString()}}});
      await tx.notification.updateMany({where:{eventType:'VISIT_INCOMPLETE',metadata:{path:['reminderId'],equals:row.id},status:'PENDING'},data:{status:'RESOLVED'}});
      const parent=row.metadata?.visitId;if(Number.isSafeInteger(parent)&&!reviewed.has(parent))next.push(parent);
    }
    ids=[...new Set(next)]; rows=[];
  }
}
async function collect(db, reminders) {
  const visits=new Map();
  for(const visitType of ['REGULAR','EXTRA']) {
    const ids=[...new Set(reminders.filter(row=>type(row.metadata)===visitType).flatMap(row=>[row.metadata?.visitId,row.metadata?.returnPlan?.visitId]).filter(Number.isSafeInteger))];
    if(!ids.length)continue;
    const rows=await model(db,visitType).findMany({where:{id:{in:ids}},include:{pool:{select:{name:true}},technician:{select:{name:true,vehicleId:true,vehicle:{select:{plate:true}}}}}});
    for(const visit of rows)visits.set(key(visitType,visit.id),{...visit,visitType,plannedDate:visitType==='EXTRA'?visit.scheduledAt:visit.plannedDate});
  }
  return visits;
}
module.exports={withdrawn,closed,type,key,prefix,model,lock,locked,project,state,assertNoReturn,settle,collect};
