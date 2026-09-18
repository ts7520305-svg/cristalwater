const {Prisma}=require('@prisma/client');
const {requestReceipt}=require('../../services/visitReceiptService');
const {prisma}=require('../../prismaClient');
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function day(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))fail('Indique uma data válida');
  const date=new Date(`${value}T00:00:00`);
  if(!Number.isFinite(date.getTime())||date.getFullYear()!==Number(value.slice(0,4))||date.getMonth()+1!==Number(value.slice(5,7))||date.getDate()!==Number(value.slice(8,10)))fail('Data inválida');
  return date;
}
function interval(body){
  const startsAt=day(body.startsOn),period=String(body.period||'RANGE');
  let endsBefore=null;
  if(period==='RANGE'){endsBefore=day(body.endsOn);if(endsBefore<startsAt)fail('O fim não pode ser anterior ao início');endsBefore.setDate(endsBefore.getDate()+1);}
  else if(period==='DAY'||period==='WEEK'){endsBefore=new Date(startsAt);endsBefore.setDate(endsBefore.getDate()+(period==='DAY'?1:7));}
  else if(period==='MONTH'){
    endsBefore=new Date(startsAt);const originalDay=endsBefore.getDate();endsBefore.setDate(1);endsBefore.setMonth(endsBefore.getMonth()+1);
    const lastDay=new Date(endsBefore.getFullYear(),endsBefore.getMonth()+1,0).getDate();endsBefore.setDate(Math.min(originalDay,lastDay));
  }else if(period!=='PERMANENT')fail('Período inválido');
  return {startsAt,endsBefore};
}
async function resolveTechnician(tx,round,date){
  const rule=await tx.roundAssignment.findFirst({where:{roundId:round.id,startsAt:{lte:date},OR:[{endsBefore:null},{endsBefore:{gt:date}}]},orderBy:{id:'desc'},include:{technician:true}});
  return rule?.technician || round.technicians?.[0]?.technician || null;
}
async function assign(roundId,body,actor){
  roundId=Number(roundId);const technicianId=Number(body.technicianId),reason=String(body.reason||'').trim();
  if(!Number.isSafeInteger(roundId)||roundId<=0||!Number.isSafeInteger(technicianId)||technicianId<=0)fail('Ronda e técnico obrigatórios');
  if(reason.length<3||reason.length>1000)fail('Indique o motivo (3–1000 caracteres)');
  const dates=interval(body),today=new Date();today.setHours(0,0,0,0);
  if(dates.startsAt<today)fail('A atribuição não pode alterar dias passados');
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Round" WHERE id = ${roundId} FOR UPDATE`;
    const round=await tx.round.findUnique({where:{id:roundId}}),technician=await tx.technician.findUnique({where:{id:technicianId}});
    if(!round?.active||!technician?.active||technician.archiveStatus!=='ATIVO')fail('Ronda ou técnico inexistente/inativo',404);
    const periodWhere={roundId,plannedDate:{gte:dates.startsAt,...(dates.endsBefore?{lt:dates.endsBefore}:{})}};
    const eligible={...periodWhere,status:{in:['PLANNED','SCHEDULED','ASSIGNED']},startAt:null,endAt:null};
    const total=await tx.serviceVisit.count({where:periodWhere}),count=await tx.serviceVisit.count({where:eligible});
    if(body.preview===true)return {ok:true,preview:true,eligible:count,preserved:total-count,...dates,technicianName:technician.name};
    const candidates=await tx.serviceVisit.findMany({where:eligible,select:{id:true}});
    if(candidates.length)await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id IN (${Prisma.join(candidates.map(v=>v.id).sort((a,b)=>a-b))}) ORDER BY id FOR UPDATE`;
    const visits=await tx.serviceVisit.findMany({where:{...eligible,id:{in:candidates.map(v=>v.id)}},orderBy:{id:'asc'}});
    const assignment=await tx.roundAssignment.create({data:{roundId,technicianId,...dates,reason,createdBy:`${actor?.role||'ADMIN'}:${actor?.userId||actor?.id||'unknown'}`}});
    for(const visit of visits){
      const updated=await tx.serviceVisit.update({where:{id:visit.id},data:{technicianId,technicianName:technician.name}});
      if(visit.technicianId!==technicianId)await requestReceipt(tx,updated,`round-assignment-${assignment.id}`,'ROUND_ASSIGNMENT');
    }
    return {ok:true,assignment,updated:visits.length,preserved:total-visits.length};
  });
}
async function generateVisit(round,roundPool,plannedDate){
  const pool=roundPool.pool,from=new Date(plannedDate);from.setHours(0,0,0,0);
  const to=new Date(from);to.setDate(to.getDate()+1);
  return prisma.$transaction(async tx=>{
    const currentPool=await tx.pool.findUnique({where:{id:pool.id},select:{clientId:true}});
    if(!currentPool)return null;
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${currentPool.clientId} FOR NO KEY UPDATE`;
    // Seasonal contracts own the total calendar, including periods with no
    // visits. Never add the old pool/round frequency on top of that agreement.
    if((await require('../finance/ClientRateBusiness').latest(currentPool.clientId,tx))?.snapshot?.servicePlan)return null;
    if(round?.id)await tx.$queryRaw`SELECT id FROM "Round" WHERE id = ${round.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${Number(pool.id)}::bigint)::text`;
    let activeRound=round;
    if(round?.id){
      const currentRound=await tx.round.findUnique({where:{id:round.id},include:{technicians:{include:{technician:true}}}});
      if(!currentRound?.active||!await tx.roundPool.findFirst({where:{roundId:round.id,poolId:pool.id}}))return null;
      if(!require('../../services/roundScheduleService').matches(currentRound,plannedDate))return null;
      activeRound=currentRound;
    }
    const readiness=await require('../../utils/poolReadiness').getPoolRoundReadiness(tx,pool.id);
    if(!readiness.ok)return null;
    if(await tx.serviceVisit.findFirst({where:{poolId:pool.id,plannedDate:{gte:from,lt:to},status:{notIn:['CANCELLED','SKIPPED']}}}))return null;
    const candidate=activeRound?await resolveTechnician(tx,activeRound,plannedDate):null;
    const technician=candidate?.active&&candidate.archiveStatus==='ATIVO'?candidate:null;
    const visit=await tx.serviceVisit.create({data:{clientId:pool.clientId||null,poolId:pool.id,roundId:round?.id||null,technicianId:technician?.id||null,technicianName:technician?.name||null,plannedDate,status:'PLANNED',reason:round?'AUTO_ROUND':'AUTO_POOL_FALLBACK',notes:round?`Gerado automaticamente pela ronda ${round.name}`:'Gerado automaticamente por fallback de piscinas ativas'}});
    await requestReceipt(tx,visit,`round-generation-${visit.id}`,'ROUND_GENERATION');
    return visit;
  });
}
async function applyWeeklyAssignments(plan){
  const ids=[...new Set(plan.days.flatMap(day=>day.rounds.map(round=>round.id)))];
  const rules=await prisma.roundAssignment.findMany({where:{roundId:{in:ids},startsAt:{lt:new Date(plan.weekEnd)},OR:[{endsBefore:null},{endsBefore:{gt:new Date(plan.weekStart)}}]},include:{technician:true},orderBy:{id:'desc'}});
  for(const day of plan.days){
    const date=new Date(day.date);date.setHours(8,0,0,0);
    for(const round of day.rounds){
      const rule=rules.find(rule=>rule.roundId===round.id&&rule.startsAt<=date&&(!rule.endsBefore||rule.endsBefore>date));
      if(rule)round.technicians=[{id:rule.technician.id,name:rule.technician.name,vehicleId:rule.technician.vehicleId}];
    }
    day.summary.technicians=day.rounds.reduce((count,round)=>count+round.technicians.length,0);
  }
  return plan;
}
module.exports={assign,resolveTechnician,interval,generateVisit,applyWeeklyAssignments};
