'use strict';
const {Prisma}=require('@prisma/client');
const {prisma}=require('../prismaClient');
const calendar=require('./clientServicePlan'),pricing=require('./clientServicePricing');
const requests=require('./fieldWriteRequestService');
const {requestReceipt}=require('./visitReceiptService');
const {getPoolRoundReadiness}=require('../utils/poolReadiness');
const {roleMatches}=require('../utils/roles');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const rates=()=>require('../business/finance/ClientRateBusiness');
const active=tech=>tech?.active&&tech.archiveStatus==='ATIVO';
const id=value=>{const n=Number(value);if(!['string','number'].includes(typeof value)||!Number.isSafeInteger(n)||n<1||n>2147483647)fail('Cliente inválido.');return n;};
const iso=date=>date?.toISOString()||null;
const slotKey=(poolId,date)=>poolId+':'+iso(date);
const dayKey=(poolId,date)=>poolId+':'+calendar.localDay(date);
const actorName=actor=>requests.owner(actor);
const authorize=actor=>{if(!roleMatches(actor?.role,'ADMIN'))fail('Apenas a administração pode alterar o acordo.',403);};
const publicAction=action=>({action:action.action,visitId:action.visit?.id||null,poolId:action.poolId,poolName:action.poolName,day:action.day,at:action.at||null,technicianName:action.technician?.name||action.visit?.technicianName||null,reason:action.reason,...(action.season?.billing==='PER_VISIT'?{billing:'PER_VISIT',unitAmount:action.season.visitCents/100}:{})});
function version(value){if(!Number.isSafeInteger(value)||value<0)fail('Versão inválida.');return value;}
function requestInput(body,editing){
  const monthRef=body.monthRef;calendar.daysOfMonth(monthRef);
  return {expectedVersion:version(body.expectedVersion),monthRef,...(editing?{snapshot:rates().validate(body)}:{})};
}
function untouched(visit){
  const origin=visit.contractService?.origin;
  return visit.reason==='AUTO_CLIENT_SERVICE'&&['PLANNED','SCHEDULED','ASSIGNED'].includes(visit.status)&&!visit.startAt&&!visit.endAt&&!visit.billed&&origin&&
    origin.plannedDate===iso(visit.plannedDate)&&origin.technicianId===visit.technicianId&&origin.roundId===visit.roundId;
}
async function read(clientId){
  clientId=id(clientId);
  const current=await rates().read(clientId);
  const pools=await prisma.pool.findMany({where:{clientId},orderBy:{id:'asc'},select:{id:true,name:true,active:true,archiveStatus:true}});
  const technicians=await prisma.technician.findMany({where:{active:true,archiveStatus:'ATIVO'},orderBy:{name:'asc'},select:{id:true,name:true}});
  const rounds=await prisma.round.findMany({where:{active:true,pools:{some:{poolId:{in:pools.map(p=>p.id)}}}},orderBy:{name:'asc'},select:{id:true,name:true,pools:{select:{poolId:true}}}});
  return {...current,pools,technicians,rounds,timeZone:'Europe/Lisbon'};
}
async function context(tx,clientId,snapshot){
  await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${clientId} FOR NO KEY UPDATE`;
  const client=await tx.client.findUnique({where:{id:clientId}});if(!client)fail('Cliente não encontrado.',404);
  const previous=await rates().latest(clientId,tx),plan=snapshot||previous?.snapshot;
  if(!plan?.servicePlan)fail('Este cliente ainda não tem um acordo de serviços sazonais.',409);
  if(!snapshot)await pricing.verify(tx,previous);
  const pools=await tx.pool.findMany({where:{clientId},orderBy:{id:'asc'}}),poolMap=new Map(pools.map(p=>[p.id,p]));
  const rules=calendar.allRules(plan.servicePlan);
  const roundIds=[...new Set(rules.map(r=>r.roundId).filter(Boolean))].sort((a,b)=>a-b);
  if(roundIds.length)await tx.$queryRaw`SELECT id FROM "Round" WHERE id IN (${Prisma.join(roundIds)}) ORDER BY id FOR UPDATE`;
  const rounds=await tx.round.findMany({where:{id:{in:roundIds}},include:{pools:true,technicians:{include:{technician:true}},assignments:{include:{technician:true},orderBy:{id:'desc'}}}});
  for(const pool of pools)await tx.$queryRaw`SELECT pg_advisory_xact_lock(${pool.id}::bigint)::text`;
  const technicians=await tx.technician.findMany({where:{id:{in:[...new Set(rules.map(r=>r.technicianId).filter(Boolean))]}}});
  const techMap=new Map(technicians.map(t=>[t.id,t])),roundMap=new Map(rounds.map(r=>[r.id,r]));
  for(const rule of rules){
    if(!poolMap.has(rule.poolId))fail('Uma instalação do acordo não pertence a este cliente.');
    if(rule.technicianId&&!techMap.has(rule.technicianId))fail('Técnico não encontrado.');
    if(rule.roundId&&!roundMap.get(rule.roundId)?.pools.some(p=>p.poolId===rule.poolId))fail('A ronda escolhida não inclui esta instalação.');
  }
  const readiness=new Map();for(const pool of pools)readiness.set(pool.id,await getPoolRoundReadiness(tx,pool.id));
  return {client,previous,snapshot:plan,pools,poolMap,techMap,roundMap,readiness};
}
function assignment(rule,ctx,date){
  if(rule.technicianId)return {technician:active(ctx.techMap.get(rule.technicianId))?ctx.techMap.get(rule.technicianId):null,roundId:null};
  const round=ctx.roundMap.get(rule.roundId);
  if(!round?.active)return {technician:null,roundId:rule.roundId};
  const day=calendar.localDay(date);
  if(round.startsOn&&day<iso(round.startsOn).slice(0,10)||round.endsOn&&day>iso(round.endsOn).slice(0,10))return {technician:null,roundId:rule.roundId};
  const override=round.assignments.find(a=>a.startsAt<=date&&(!a.endsBefore||a.endsBefore>date));
  const candidates=override?[override.technician]:round.technicians.map(t=>t.technician).filter(active);
  return {technician:candidates.length===1&&active(candidates[0])?candidates[0]:null,roundId:round.id};
}
async function inspect(tx,ctx,{monthRef,editing=false,onlyDays=null,now=new Date()}){
  const today=calendar.localDay(now),monthDays=calendar.daysOfMonth(monthRef);
  const from=calendar.localDate(today,'00:00'),endDay=new Date(monthRef+'-01T12:00:00Z');endDay.setUTCMonth(endDay.getUTCMonth()+1);
  const where={OR:[{clientId:ctx.client.id},{poolId:{in:ctx.pools.map(p=>p.id)}}],plannedDate:{gte:from,...(!editing?{lt:calendar.localDate(endDay.toISOString().slice(0,10),'00:00')}:{})},status:{notIn:['CANCELLED','CANCELED','SKIPPED','ARCHIVED']}};
  if(!editing&&monthDays[0]>today)where.plannedDate.gte=calendar.localDate(monthDays[0],'00:00');
  let visits=await tx.serviceVisit.findMany({where,orderBy:{id:'asc'},take:10001});
  if(visits.length>10000)fail('O calendário é demasiado extenso para esta revisão. Contacte a administração.',409);
  if(visits.length){await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id IN (${Prisma.join(visits.map(v=>v.id))}) ORDER BY id FOR UPDATE`;visits=await tx.serviceVisit.findMany({where:{...where,id:{in:visits.map(v=>v.id)}},orderBy:{id:'asc'}});}
  if(onlyDays)visits=visits.filter(v=>onlyDays.includes(calendar.localDay(v.plannedDate)));
  const days=[...new Set([...(onlyDays||monthDays).filter(d=>d>=today),...(editing?visits.map(v=>calendar.localDay(v.plannedDate)):[])])].sort();
  const desired=new Map(),pending=[],uncertain=new Set();
  for(const day of days){
    const season=calendar.onDay(ctx.snapshot.servicePlan,day);if(!season)continue;
    for(const rule of calendar.rulesForDay(ctx.snapshot.servicePlan,day)){
      if(!calendar.activeCycle(rule,day))continue;
      const pool=ctx.poolMap.get(rule.poolId),base={poolId:pool.id,poolName:pool.name||'Piscina '+pool.id,day,period:season.label};
      if(rule.slots.length!==rule.count){uncertain.add(pool.id+':'+day);pending.push({...base,reason:`Faltam horários: ${rule.slots.length} de ${rule.count} visitas por ${calendar.cadenceLabel(rule)}.`});continue;}
      for(const slot of calendar.due(rule,day)){
        const date=calendar.localDate(day,slot.at),assigned=date?assignment(rule,ctx,date):{technician:null};
        const readiness=ctx.readiness.get(pool.id);
        if(!date||!assigned.technician||!readiness.ok){uncertain.add(pool.id+':'+day);pending.push({...base,at:slot.at,reason:!date?'Hora inexistente na mudança de hora.':!readiness.ok?readiness.message:'Técnico ou atribuição da ronda por definir/indisponível.'});continue;}
        desired.set(slotKey(pool.id,date),{...base,at:slot.at,date,season,exception:rule.exception,technician:assigned.technician,roundId:assigned.roundId||null});
      }
    }
  }
  const priceSources=await pricing.plans(tx,visits.filter(calendar.perVisit));
  const actions=[],occupied=new Set(),blockedDays=new Set();
  for(const visit of visits){
    const key=slotKey(visit.poolId,visit.plannedDate),day=calendar.localDay(visit.plannedDate),target=desired.get(key);
    const base={visit,poolId:visit.poolId,poolName:ctx.poolMap.get(visit.poolId)?.name||'Piscina '+visit.poolId,day};
    occupied.add(key);
    if(visit.clientId&&visit.clientId!==ctx.client.id){blockedDays.add(dayKey(visit.poolId,visit.plannedDate));actions.push({...base,action:'REVIEW',reason:'Associação de cliente contraditória; visita preservada.'});continue;}
    if(calendar.perVisit(visit)){try{pricing.price(visit,priceSources);}catch(_){blockedDays.add(dayKey(visit.poolId,visit.plannedDate));actions.push({...base,action:'REVIEW',reason:'O preço original ou o comprovativo do acordo precisa de revisão; visita preservada.'});continue;}}
    if(!untouched(visit)){
      if(!calendar.included(visit)||!target)blockedDays.add(dayKey(visit.poolId,visit.plannedDate));
      actions.push({...base,action:'PRESERVE',reason:'Visita manual, atribuída/reagendada, iniciada, concluída ou histórica: preservada.'});continue;
    }
    if(uncertain.has(dayKey(visit.poolId,visit.plannedDate))){actions.push({...base,action:'REVIEW',reason:'Calendário pendente: visita existente preservada para revisão.'});continue;}
    if(!target){const exception=ctx.snapshot.servicePlan.exceptions?.find(e=>e.poolId===visit.poolId&&e.day===day);actions.push({...base,action:'CANCEL',reason:exception?'Exceção nesta data: '+exception.reason:'Fora dos dias/horários ou vigência do acordo revisto.'});continue;}
    const same=!editing&&visit.contractService.planVersion===ctx.previous?.version&&visit.technicianId===target.technician.id&&visit.roundId===target.roundId;
    actions.push({...base,...target,action:same?'KEEP':'UPDATE',reason:same?'Visita contratada já agendada.':'Atualizar a versão, serviços e atribuição da visita futura.'});
  }
  for(const [key,target] of desired){
    if(occupied.has(key))continue;
    // Saving also reviews all previously generated future work, but only adds
    // new dates within the explicitly simulated month (or the weekly window).
    if(!(onlyDays||monthDays).includes(target.day))continue;
    if(blockedDays.has(dayKey(target.poolId,target.date)))actions.push({...target,action:'REVIEW',reason:'Já existe trabalho manual/histórico neste dia. Reveja-o antes de acrescentar visitas.'});
    else actions.push({...target,action:'CREATE',reason:(target.season.billing==='PER_VISIT'?'Visita com preço unitário acordado; cobrança apenas após conclusão.':'Visita incluída no contrato mensal.')+(target.exception?' Exceção nesta data: '+target.exception.reason:'')});
  }
  actions.sort((a,b)=>a.day.localeCompare(b.day)||a.poolId-b.poolId||(a.at||'').localeCompare(b.at||'')||(a.visit?.id||0)-(b.visit?.id||0));
  const summary={create:0,update:0,cancel:0,keep:0,preserve:0,review:0,pending:pending.length};for(const a of actions)summary[a.action.toLowerCase()]++;
  const token=requests.hash({schema:1,clientId:ctx.client.id,today,monthRef,editing,version:ctx.previous?.version||0,snapshot:ctx.snapshot,visits:visits.map(v=>({id:v.id,updatedAt:iso(v.updatedAt)})),actions:actions.map(a=>({...publicAction(a),technicianId:a.technician?.id,roundId:a.roundId})),pending});
  return {ok:true,clientId:ctx.client.id,expectedVersion:ctx.previous?.version||0,monthRef,reviewToken:token,summary,pending,actions,pricing:rates().calculate(ctx.snapshot,monthRef),timeZone:'Europe/Lisbon'};
}
function exposed(result){return {...result,actions:result.actions.map(publicAction)};}
async function preview(clientId,body,editing){
  clientId=id(clientId);const input=requestInput(body,editing);
  return prisma.$transaction(async tx=>{
    const ctx=await context(tx,clientId,input.snapshot);
    if((ctx.previous?.version||0)!==input.expectedVersion)fail('O acordo mudou. Recarregue e reveja a simulação.',409);
    const result=exposed(await inspect(tx,ctx,{monthRef:input.monthRef,editing}));
    if(editing&&input.snapshot.servicePlan.schema===2)result.planHash=requests.hash(input.snapshot);
    result.payloadHash=requests.hash({v:1,scope:editing?'CLIENT_SERVICE_PLAN':'CLIENT_SERVICE_GENERATION',resourceId:clientId,payload:{...input,reviewToken:result.reviewToken}});
    return result;
  },{maxWait:15000,timeout:30000});
}
async function apply(tx,plan,inspection,{addOnly=false}={}){
  const results=[];
  for(const action of inspection.actions){
    if(!['CREATE','UPDATE','CANCEL'].includes(action.action)||addOnly&&action.action!=='CREATE')continue;
    const v=action.visit;
    if(action.action==='CANCEL'){
      await tx.serviceVisit.update({where:{id:v.id},data:{status:'CANCELLED'}});
      await tx.operationalReminder.updateMany({where:{sourceKey:{startsWith:`visit-receipt:${v.id}:`},isCompleted:false},data:{isCompleted:true}});
      results.push({action:'CANCEL',id:v.id});continue;
    }
    const origin={plannedDate:iso(action.date),technicianId:action.technician.id,roundId:action.roundId};
    const data={technicianId:action.technician.id,technicianName:action.technician.name,roundId:action.roundId,contractService:calendar.serviceData(plan,action.season,action.day,origin,action.exception),...(action.season.billing==='PER_VISIT'?{revenue:action.season.visitCents/100}:calendar.perVisit(v)?{revenue:0}:{}),...(v&&v.notes===v.contractService?.services?{notes:action.season.services}:{})};
    const saved=v?await tx.serviceVisit.update({where:{id:v.id},data}):await tx.serviceVisit.create({data:{...data,clientId:inspection.clientId,poolId:action.poolId,plannedDate:action.date,status:'PLANNED',reason:'AUTO_CLIENT_SERVICE',revenue:action.season.billing==='PER_VISIT'?action.season.visitCents/100:0,notes:action.season.services}});
    if(!v||v.technicianId!==saved.technicianId)await requestReceipt(tx,saved,`client-service-${plan.id}-${saved.id}`,'CLIENT_SERVICE');
    results.push({action:action.action,id:saved.id});
  }
  return results;
}
async function write(clientId,body,actor,editing){
  authorize(actor);clientId=id(clientId);const input=requestInput(body,editing);
  if(typeof body.reviewToken!=='string'||!/^[0-9a-f]{64}$/.test(body.reviewToken))fail('Simule e reveja o impacto antes de confirmar.');
  const request=requests.context(actor,editing?'CLIENT_SERVICE_PLAN':'CLIENT_SERVICE_GENERATION',clientId,body.requestId,{...input,reviewToken:body.reviewToken});
  return prisma.$transaction(async tx=>{
    const recovered=await requests.recover(tx,request);if(recovered)return recovered;
    const ctx=await context(tx,clientId,input.snapshot);
    if((ctx.previous?.version||0)!==input.expectedVersion)fail('O acordo mudou. Recarregue e reveja a simulação.',409);
    const inspection=await inspect(tx,ctx,{monthRef:input.monthRef,editing});
    if(inspection.reviewToken!==body.reviewToken)fail('O calendário ou a atribuição mudou. Simule novamente antes de confirmar.',409);
    const plan=editing?await tx.clientRatePlan.create({data:{clientId,version:input.expectedVersion+1,snapshot:input.snapshot,createdBy:actorName(actor)}}):ctx.previous;
    const applied=await apply(tx,plan,inspection);
    await tx.userAuditLog.create({data:{action:editing?'CLIENT_SERVICE_PLAN_SAVED':'CLIENT_SERVICE_CALENDAR_APPLIED',actor:actorName(actor),entity:'ClientRatePlan',entityId:String(plan.id),metadata:{clientId,version:plan.version,monthRef:input.monthRef,applied,pending:inspection.pending,review:inspection.actions.filter(a=>a.action==='REVIEW').map(publicAction)}}});
    return requests.confirm(tx,request,{ok:true,clientId,planVersion:plan.version,planId:plan.id,monthRef:input.monthRef,...(editing&&input.snapshot.servicePlan.schema===2?{pricingProof:{schema:1,planHash:requests.hash(plan.snapshot),reviewToken:body.reviewToken}}:{}),applied,summary:inspection.summary,pending:inspection.pending});
  },{maxWait:15000,timeout:30000});
}
async function generateWeek(weekStart){
  const days=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return calendar.localDay(d);});
  const clients=await prisma.client.findMany({where:{active:true,archiveStatus:'ATIVO',deletedAt:null},select:{id:true}});
  const result={created:0,pending:0,review:0};
  for(const client of clients){
    if(!(await rates().latest(client.id))?.snapshot?.servicePlan)continue;
    const outcome=await prisma.$transaction(async tx=>{
      const ctx=await context(tx,client.id);
      // A week can cross a month or a season boundary. Each day resolves its own rule.
      let created=0,pending=0,review=0;
      for(const monthRef of [...new Set(days.map(day=>day.slice(0,7)))]){
        const inspection=await inspect(tx,ctx,{monthRef,onlyDays:days.filter(day=>day.startsWith(monthRef))});
        created+=(await apply(tx,ctx.previous,inspection,{addOnly:true})).length;pending+=inspection.pending.length;
        review+=inspection.summary.review+inspection.summary.cancel+inspection.summary.update;
      }
      return {created,pending,review};
    },{maxWait:15000,timeout:30000});
    for(const key of Object.keys(result))result[key]+=outcome[key];
  }
  return result;
}
module.exports={read,preview,write,generateWeek,untouched};
