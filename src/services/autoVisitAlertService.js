const { prisma } = require('../prismaClient');
const roundSchedule = require('./roundScheduleService');

const OPEN = ['PLANNED', 'SCHEDULED', 'ASSIGNED', 'PENDING', 'IN_PROGRESS', 'STARTED', 'INCOMPLETE'];
const DONE = ['DONE', 'COMPLETED', 'CONCLUIDA'];
function localDay(value) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
function calendarDays(a, b) {
  const utc = value => { const d = new Date(value); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  return Math.floor((utc(a) - utc(b)) / 86400000);
}
function activePool(pool) {
  return pool.active && !pool.deletedAt && pool.archiveStatus === 'ATIVO' && pool.client?.active && !pool.client.deletedAt && pool.client.archiveStatus === 'ATIVO' && !['PAUSED', 'PAUSA', 'INACTIVE', 'ARCHIVED'].includes(String(pool.client.status).toUpperCase());
}
function cadenceDays(days) {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (!sorted.length) return 8;
  return Math.max(...sorted.map((day, i) => (sorted[(i + 1) % sorted.length] - day + 7) % 7 || 7)) + 1;
}
function cadenceForRounds(rounds){if(rounds.some(r=>r.recurrence==='DAILY'))return 2;const weekly=rounds.filter(r=>!r.recurrence||r.recurrence==='WEEKLY');return weekly.length?cadenceDays(weekly.map(r=>r.dayOfWeek)):rounds.some(r=>r.recurrence==='MONTHLY')?32:8;}
async function getCoverage(db = prisma, now = new Date()) {
  const today = localDay(now), tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const [allPools, rounds, openVisits, todayVisits, technicians, followups] = await Promise.all([
    db.pool.findMany({where:{active:true,deletedAt:null,archiveStatus:'ATIVO'},include:{client:{select:{name:true,active:true,deletedAt:true,archiveStatus:true,status:true}},serviceVisits:{where:{status:{in:DONE},endAt:{not:null}},orderBy:{endAt:'desc'},take:1,select:{id:true,endAt:true}}}}),
    db.round.findMany({where:{active:true},include:{pools:true}}),
    db.serviceVisit.findMany({where:{status:{in:OPEN},endAt:null},include:{technician:{select:{name:true,active:true,archiveStatus:true}}},orderBy:[{plannedDate:'asc'},{id:'asc'}]}),
    db.serviceVisit.findMany({where:{OR:[{plannedDate:{gte:today,lt:tomorrow}},{plannedDate:null,date:{gte:today,lt:tomorrow}}],status:{notIn:['CANCELLED','CANCELED','SKIPPED','ARCHIVED']}},select:{poolId:true}}),
    db.technician.findMany({where:{active:true,archiveStatus:'ATIVO'},select:{id:true,name:true},orderBy:{name:'asc'}}),
    db.operationalReminder.findMany({where:{sourceKey:{startsWith:'incomplete:'}},select:{metadata:true,isCompleted:true}})
  ]);
  const activeVisitIds = new Set(openVisits.map(visit=>visit.id));
  const handledIncompleteIds = new Set(followups.filter(row=>(row.isCompleted&&row.metadata?.resolvedByReturnVisitId)||activeVisitIds.has(row.metadata?.returnPlan?.visitId)).map(row=>row.metadata?.visitId));
  const roundsByPool = new Map(), visitsByPool = new Map();
  const todayPoolIds = new Set(todayVisits.map(visit=>visit.poolId));
  const activeRoundIds = new Set(rounds.filter(round=>roundSchedule.inWindow(round,today)).map(round=>round.id));
  for (const round of rounds) {
    for (const poolId of new Set(round.pools.map(item=>item.poolId))) {
      if (!roundsByPool.has(poolId)) roundsByPool.set(poolId, []);
      roundsByPool.get(poolId).push(round);
    }
  }
  for (const visit of openVisits) {
    if (visit.status === 'INCOMPLETE' && handledIncompleteIds.has(visit.id)) continue;
    if (!visitsByPool.has(visit.poolId)) visitsByPool.set(visit.poolId, []);
    visitsByPool.get(visit.poolId).push(visit);
  }
  const pools = allPools.filter(activePool), rows = [];
  for (const pool of pools) {
    const configuredRounds=roundsByPool.get(pool.id)||[];
    const poolRounds=configuredRounds.filter(round=>activeRoundIds.has(round.id));
    const lastCompleted = pool.serviceVisits[0]?.endAt || null;
    const daysWithoutCompletion = calendarDays(today, lastCompleted || pool.createdAt);
    const threshold = cadenceForRounds(poolRounds);
    const flags = [];
    if (!configuredRounds.length) flags.push('NO_ROUND');
    if ((poolRounds.length||!configuredRounds.length)&&daysWithoutCompletion >= threshold) flags.push(lastCompleted ? 'STALE_COMPLETION' : 'NEVER_COMPLETED');
    if (poolRounds.some(round => roundSchedule.matches(round,today)) && !todayPoolIds.has(pool.id)) flags.push('NOT_SCHEDULED_TODAY');
    const visits = (visitsByPool.get(pool.id)||[]).map(visit => {
      const issues = [];
      if (visit.plannedDate && localDay(visit.plannedDate) < today) issues.push('OVERDUE');
      if (!visit.plannedDate) issues.push('NO_DATE');
      if (!visit.technician?.active || visit.technician.archiveStatus !== 'ATIVO') issues.push('UNASSIGNED');
      if (visit.status === 'INCOMPLETE') issues.push('INCOMPLETE');
      return {id:visit.id,status:visit.status,plannedDate:visit.plannedDate,technicianId:visit.technicianId,technicianName:visit.technician?.name||null,updatedAt:visit.updatedAt,issues,canTransfer:!visit.startAt&&['PLANNED','SCHEDULED','ASSIGNED','PENDING'].includes(visit.status)};
    });
    if (flags.length || visits.some(visit => visit.issues.length)) rows.push({poolId:pool.id,poolName:pool.name||`Piscina #${pool.id}`,clientName:pool.client.name,flags,lastCompleted,daysWithoutCompletion,threshold,rounds:poolRounds.map(round=>({id:round.id,name:round.name})),visits});
  }
  rows.sort((a,b)=>Number(b.visits.some(v=>v.issues.includes('OVERDUE')))-Number(a.visits.some(v=>v.issues.includes('OVERDUE')))||b.daysWithoutCompletion-a.daysWithoutCompletion||a.poolId-b.poolId);
  return {ok:true,checkedAt:now.toISOString(),rows,technicians,automaticAlertsEnabled:process.env.NODE_ENV!=='test'&&process.env.CW_VISIT_COVERAGE_ENABLED!=='false',scope:'Piscinas e clientes ativos; visitas regulares. Cadência pelas rondas atuais, com um dia de tolerância; sem ronda, revisão após 8 dias.'};
}
async function runAutoVisitAlerts() {
  // One stable office notification per pool; scheduled or started work never counts as completed.
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(73194041::bigint)::text`;
    const coverage = await getCoverage(tx), current = new Set();
    for (const row of coverage.rows) {
      const actionable = row.flags.some(flag => ['STALE_COMPLETION','NEVER_COMPLETED'].includes(flag)) || row.visits.some(visit => visit.issues.some(issue=>['OVERDUE','UNASSIGNED','NO_DATE'].includes(issue)));
      if (!actionable) continue;
      current.add(row.poolId);
      const where = {eventType:'VISIT_COVERAGE',role:'ADMIN',metadata:{path:['poolId'],equals:row.poolId}};
      const existing = await tx.notification.findFirst({where,orderBy:{id:'desc'}});
      const data = {type:'VISIT_ALERT',eventType:'VISIT_COVERAGE',role:'ADMIN',status:'PENDING',severity:'WARNING',title:`Manutenção por verificar — ${row.poolName}`,message:`${row.poolName}: reveja visitas em atraso, atribuições e última manutenção concluída nas Rondas.`,metadata:{poolId:row.poolId,flags:row.flags,checkedAt:coverage.checkedAt,href:'/admin-rounds#coveragePanel'}};
      if (existing) await tx.notification.update({where:{id:existing.id},data:{...data,...(existing.status==='RESOLVED'?{isRead:false,readAt:null}:{})}});
      else await tx.notification.create({data});
    }
    const previous = await tx.notification.findMany({where:{eventType:'VISIT_COVERAGE',role:'ADMIN',status:'PENDING'},select:{id:true,metadata:true}});
    const resolved = previous.filter(row=>!current.has(row.metadata?.poolId)).map(row=>row.id);
    if (resolved.length) await tx.notification.updateMany({where:{id:{in:resolved}},data:{status:'RESOLVED'}});
    const receiptsPending=await require('./visitReceiptService').escalatePending(tx);
    return {ok:true,pending:current.size,resolved:resolved.length,receiptsPending};
  }, {timeout:30000});
}
let timer=null,running=false;
function startScheduler(){
  if(timer||process.env.NODE_ENV==='test'||process.env.CW_VISIT_COVERAGE_ENABLED==='false')return;
  const tick=async()=>{if(running)return;running=true;try{await runAutoVisitAlerts();}catch(error){console.error('VISIT_COVERAGE_ERROR',error.message);}finally{running=false;}};
  timer=setInterval(tick,60*60*1000);timer.unref();void tick();
}
module.exports = {runAutoVisitAlerts,startScheduler,getCoverage,calendarDays,cadenceDays,cadenceForRounds,activePool};
