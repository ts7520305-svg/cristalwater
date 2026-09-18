'use strict';
const { isCompletedVisitStatus } = require('./operationalValueReportService');

function lastMonth(now = new Date()) {
  const reference = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-1, 1));
  return reference.toISOString().slice(0,7);
}

async function read(db, clientId, { start, end }) {
  const client = await db.client.findUnique({ where: { id:clientId }, select: {
    id:true, name:true, paymentStatus:true, pools:{ select:{id:true,name:true}, orderBy:{id:'asc'} },
  } });
  if (!client) return null;
  const between = {gte:start,lt:end};
  const visits = await db.serviceVisit.findMany({ where:{clientId,OR:[
    {endAt:between}, {endAt:null,OR:[{plannedDate:between},{plannedDate:null,date:between}]},
  ]}, select:{poolId:true,status:true,endAt:true}, orderBy:{id:'asc'} });
  const row = (poolId, name, nameBasis) => ({poolId,name,nameBasis,totalVisits:0,notDone:0,unconfirmed:0});
  const pools = new Map(client.pools.map(pool => [pool.id,row(pool.id,pool.name || 'Piscina #'+pool.id,'CURRENT_CLIENT_POOL')]));
  let excludedStates = 0;
  for (const visit of visits) {
    const done = isCompletedVisitStatus(visit.status), notDone = String(visit.status || '').trim().toUpperCase() === 'NOT_DONE';
    if (!done && !notDone) { excludedStates++; continue; }
    if (!pools.has(visit.poolId)) pools.set(visit.poolId,row(visit.poolId,visit.poolId ? 'Piscina #'+visit.poolId+' (histórico)' : 'Piscina não identificada',visit.poolId ? 'HISTORICAL_VISIT_POOL_ID' : 'MISSING_POOL'));
    const target = pools.get(visit.poolId);
    if (!visit.endAt) target.unconfirmed++;
    else if (done) target.totalVisits++;
    else target.notDone++;
  }
  const rows = [...pools.values()].sort((a,b)=>(a.poolId ?? Infinity)-(b.poolId ?? Infinity));
  const totals = rows.reduce((sum,pool)=>({totalVisits:sum.totalVisits+pool.totalVisits,notDone:sum.notDone+pool.notDone,unconfirmed:sum.unconfirmed+pool.unconfirmed}),{totalVisits:0,notDone:0,unconfirmed:0});
  return {
    reportVersion:2, scope:'REGULAR', clientId, client:client.name, paymentStatus:client.paymentStatus,
    generatedAt:new Date().toISOString(), period:{start:start.toISOString(),end:end.toISOString(),timeZone:'UTC'},
    basis:{completed:'END_AT',notDone:'END_AT',client:'VISIT_CLIENT_ID',unconfirmed:'PLANNED_DATE_OR_LEGACY_DATE_WITHOUT_END_AT',paymentStatus:'CURRENT_AT_GENERATION'},
    pools:rows, totals, reviewRequired:totals.unconfirmed>0 || pools.has(null), excludedStates,
  };
}

module.exports = { lastMonth, read };
