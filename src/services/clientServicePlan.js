'use strict';
const fail = message => { throw Object.assign(new Error(message), {status:400}); };
function integer(value, min, max, label) {
  if (typeof value === 'boolean' || value === '' || value === null || !Number.isInteger(Number(value)) || Number(value)<min || Number(value)>max) fail(label);
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
      const count=frequency==='MONTHLY'?1:integer(rule.count,1,7,'Indique uma a sete visitas por semana.');
      if(!Array.isArray(rule.days))fail('Indique os dias das visitas.');
      const days=rule.days.map(day=>integer(day,frequency==='WEEKLY'?0:1,frequency==='WEEKLY'?6:31,'Dia de visita inválido.')).sort((a,b)=>a-b);
      if(new Set(days).size!==days.length||(days.length&&days.length!==count))fail('O número de dias deve corresponder à frequência indicada.');
      const at=rule.at;
      if(typeof at!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(at))fail('Indique uma hora válida para as visitas.');
      const technicianId=rule.technicianId==null||rule.technicianId===''?null:integer(rule.technicianId,1,2147483647,'Técnico inválido.');
      return {poolId,frequency,count,days,at,technicianId};
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
  if(rule.frequency==='WEEKLY')return rule.days.includes(date.getUTCDay());
  const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  return rule.days.some(value=>Math.min(value,last)===date.getUTCDate());
}
function daysOfMonth(ref) {
  civil(ref+'-01');const result=[],date=new Date(ref+'-01T12:00:00Z');
  while(date.toISOString().slice(0,7)===ref){result.push(date.toISOString().slice(0,10));date.setUTCDate(date.getUTCDate()+1);}return result;
}
function localDate(day,at='12:00') {
  civil(day);const [year,month,date]=day.split('-').map(Number),[hour,minute]=at.split(':').map(Number);
  return new Date(year,month-1,date,hour,minute,0,0);
}
const localDay=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function serviceData(plan,season,day) {return {schema:1,planId:plan.id,planVersion:plan.version,period:season.key,label:season.label,services:season.services,day,billing:'INCLUDED_MONTHLY'};}
module.exports={validate,onDay,due,daysOfMonth,localDate,localDay,serviceData,civil};
