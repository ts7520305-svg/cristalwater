'use strict';
const fail = message => { throw Object.assign(new Error(message), {status:400}); };
function integer(value, min, max, label) {
  if (!['number','string'].includes(typeof value) || String(value).trim()==='' || !Number.isInteger(Number(value)) || Number(value)<min || Number(value)>max) fail(label);
  return Number(value);
}
function civil(value) {
  if (typeof value!=='string' || !/^(20\d{2}|21\d{2})-\d{2}-\d{2}$/.test(value)) fail('Data do contrato inválida.');
  const date=new Date(value+'T12:00:00Z');
  if (!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value) fail('Data do contrato inválida.');
  return value;
}
const months = season => Array.from({length:(season.toMonth-season.fromMonth+12)%12+1},(_,i)=>(season.fromMonth-1+i)%12+1);
function validate(input, money) {
  if (!input || typeof input!=='object' || Array.isArray(input)) fail('Plano de serviços inválido.');
  const startsOn=civil(input.startsOn),endsOn=input.endsOn?civil(input.endsOn):null;
  if (endsOn&&endsOn<startsOn) fail('O fim do contrato é anterior ao início.');
  if (!Array.isArray(input.seasons)||!input.seasons.length||input.seasons.length>12) fail('Indique entre uma e doze épocas.');
  const occupied=new Set();
  const seasons=input.seasons.map((row,index)=>{
    if(!row||typeof row!=='object'||Array.isArray(row))fail('Época inválida.');
    const label=typeof row.label==='string'?row.label.trim():'';
    const services=typeof row.services==='string'?row.services.trim():'';
    if(!label||label.length>120||!services||services.length>2000)fail('Indique a designação e os serviços de cada época.');
    const season={key:'SEASON_'+(index+1),label,services,fromMonth:integer(row.fromMonth,1,12,'Mês inicial inválido.'),toMonth:integer(row.toMonth,1,12,'Mês final inválido.'),monthlyCents:money(row.monthlyAmount)};
    for(const month of months(season)){if(occupied.has(month))fail('As épocas não podem sobrepor meses.');occupied.add(month);}
    if(!Array.isArray(row.schedules)||row.schedules.length>50)fail('Indique até cinquenta instalações por época.');
    const pools=new Set();
    season.schedules=row.schedules.map(rule=>{
      if(!rule||typeof rule!=='object'||Array.isArray(rule))fail('Calendário de visitas inválido.');
      const poolId=integer(rule.poolId,1,2147483647,'Instalação inválida.');
      if(pools.has(poolId))fail('A mesma instalação não pode ter dois calendários na mesma época.');pools.add(poolId);
      const frequency=rule.frequency;
      if(!['WEEKLY','MONTHLY'].includes(frequency))fail('Escolha frequência semanal ou mensal.');
      const interval=rule.interval==null?1:integer(rule.interval,1,frequency==='WEEKLY'?52:24,'Intervalo de repetição inválido.');
      const anchorOn=interval>1?civil(rule.anchorOn):null;
      if(interval===1&&rule.anchorOn)fail('Uma data de referência exige um intervalo superior a um.');
      const count=integer(rule.count,1,168,'Indique o número de visitas contratado.');
      if(!Array.isArray(rule.slots)||rule.slots.length>count)fail('Os horários não podem exceder o número de visitas contratado.');
      if(rule.days!==undefined||rule.at!==undefined)fail('Defina cada dia e horário nos períodos de visita.');
      const slots=rule.slots.map(slot=>{
        if(!slot||typeof slot!=='object'||Array.isArray(slot))fail('Horário de visita inválido.');
        const day=integer(slot.day,frequency==='WEEKLY'?0:1,frequency==='WEEKLY'?6:31,'Dia de visita inválido.');
        if(typeof slot.at!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.at))fail('Indique uma hora válida para cada visita.');
        return {day,at:slot.at};
      }).sort((a,b)=>a.day-b.day||a.at.localeCompare(b.at));
      // Monthly dates 29–31 move to the last day of shorter months. Refuse
      // schedules that would collapse two contracted visits onto the same slot.
      for(const last of frequency==='MONTHLY'?[28,29,30,31]:[31]){
        const keys=slots.map(slot=>Math.min(slot.day,last)+':'+slot.at);
        if(new Set(keys).size!==keys.length)fail('Duas visitas não podem ter o mesmo dia e horário, incluindo meses mais curtos.');
      }
      const technicianId=rule.technicianId==null||rule.technicianId===''?null:integer(rule.technicianId,1,2147483647,'Técnico inválido.');
      const roundId=rule.roundId==null||rule.roundId===''?null:integer(rule.roundId,1,2147483647,'Ronda inválida.');
      if(technicianId&&roundId)fail('Escolha um técnico ou a atribuição da ronda.');
      return {poolId,frequency,count,slots,technicianId,roundId,...(interval>1?{interval,anchorOn}:{})};
    }).sort((a,b)=>a.poolId-b.poolId);
    return season;
  });
  if(occupied.size!==12)fail('Defina todos os meses do ano, incluindo épocas sem visitas.');
  return {schema:1,startsOn,endsOn,billing:'INCLUDED_MONTHLY',seasons};
}
function onDay(plan,day) {
  if(!plan||day<plan.startsOn||(plan.endsOn&&day>plan.endsOn))return null;
  const month=Number(day.slice(5,7));
  return plan.seasons.find(season=>months(season).includes(month))||null;
}
function due(rule,day) {
  const date=new Date(day+'T12:00:00Z');
  if(!activeCycle(rule,day))return [];
  if(rule.frequency==='WEEKLY')return rule.slots.filter(slot=>slot.day===date.getUTCDay());
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  return rule.slots.filter(slot=>Math.min(slot.day,last)===date.getUTCDate());
}
function activeCycle(rule,day) {
  if(!rule.interval||rule.interval===1)return true;
  if(day<rule.anchorOn)return false;
  const date=new Date(day+'T12:00:00Z'),anchor=new Date(rule.anchorOn+'T12:00:00Z');
  const monday=d=>+d-((d.getUTCDay()+6)%7)*86400000;
  const elapsed=rule.frequency==='WEEKLY'?(monday(date)-monday(anchor))/604800000:(date.getUTCFullYear()-anchor.getUTCFullYear())*12+date.getUTCMonth()-anchor.getUTCMonth();
  return elapsed%rule.interval===0;
}
function cadenceLabel(rule){return rule.interval>1?`ciclo de ${rule.interval} ${rule.frequency==='WEEKLY'?'semanas':'meses'}`:rule.frequency==='WEEKLY'?'semana':'mês';}
function daysOfMonth(ref) {
  civil(ref+'-01');const result=[],date=new Date(ref+'-01T12:00:00Z');
  while(date.toISOString().slice(0,7)===ref){result.push(date.toISOString().slice(0,10));date.setUTCDate(date.getUTCDate()+1);}return result;
}
function localDate(day,at='12:00') {
  civil(day);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(at))fail('Hora inválida.');
  const wall=Date.parse(day+'T'+at+':00Z');let instant=wall;
  for(let i=0;i<3;i++){
    const parts=Object.fromEntries(clock.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    const rendered=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
    const delta=wall-rendered;if(!delta)return new Date(instant);instant+=delta;
  }
  return null; // A nonexistent hour at the spring clock change needs review.
}
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function localDay(date){const p=Object.fromEntries(clock.formatToParts(date).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
function serviceData(plan,season,day,origin) {return {schema:1,planId:plan.id,planVersion:plan.version,period:season.key,label:season.label,services:season.services,day,billing:'INCLUDED_MONTHLY',origin};}
function included(visit){return visit?.contractService?.billing==='INCLUDED_MONTHLY';}
module.exports={validate,onDay,due,activeCycle,cadenceLabel,daysOfMonth,localDate,localDay,serviceData,civil,included};
