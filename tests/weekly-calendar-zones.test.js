import { describe, it, expect } from 'vitest';
const {spawnSync}=require('node:child_process');
const source=String.raw`
const assert=require('node:assert/strict');let reads=0;
const dateKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
global.__CRISTAL_WATER_PRISMA__={round:{findMany:async()=>{reads++;return[{id:1,name:'Leap month',active:true,recurrence:'MONTHLY',dayOfMonth:31,technicians:[],pools:[]},{id:2,name:'Daily',active:true,recurrence:'DAILY',technicians:[],pools:[]}];}},serviceVisit:{findMany:async query=>{reads++;const start=query.where.plannedDate.gte;const date=new Date(start);date.setHours(8,0,0,0);return[{id:1,plannedDate:date,status:'PLANNED'}];}}};
const {getWeeklyPlan}=require('./src/business/admin/AdminWeeklyPlanningBusiness');
(async()=>{
  for(const target of ['2032-02-29','2026-03-08','2026-03-29','2026-10-25','2026-11-01','2027-01-01']){
    const plan=await getWeeklyPlan({date:target});assert.equal(plan.referenceDate,target);assert.equal(plan.days.length,7);assert(plan.days.some(day=>day.calendarDate===target));assert.equal(plan.weekStartDate,plan.days[0].calendarDate);assert.equal(plan.weekEndDate,dateKey(new Date(plan.weekEnd)));assert.equal(new Date(plan.weekStart).getDay(),0);
    for(let index=0;index<7;index++){const day=plan.days[index],actual=new Date(day.date);assert.equal(dateKey(actual),day.calendarDate);assert.equal(actual.getHours(),0);assert.equal(actual.getDay(),index);assert(day.rounds.some(round=>round.id===2));if(index){const previous=new Date(plan.days[index-1].date);previous.setDate(previous.getDate()+1);assert.equal(dateKey(previous),day.calendarDate);}}
    assert.equal(plan.days[0].visits.length,1);assert.equal(plan.days.slice(1).flatMap(day=>day.visits).length,0);
    if(target==='2032-02-29')assert(plan.days.find(day=>day.calendarDate===target).rounds.some(round=>round.id===1));
    if((process.env.TZ==='America/Chicago'&&target==='2026-03-08')||(process.env.TZ==='Europe/Lisbon'&&target==='2026-03-29'))assert.equal((Date.parse(plan.weekEnd)-Date.parse(plan.weekStart))/3600000,167);
    if((process.env.TZ==='America/Chicago'&&target==='2026-11-01')||(process.env.TZ==='Europe/Lisbon'&&target==='2026-10-25'))assert.equal((Date.parse(plan.weekEnd)-Date.parse(plan.weekStart))/3600000,169);
  }
  const instant='2026-07-05T12:00:00.000Z';assert.equal((await getWeeklyPlan({date:instant})).referenceDate,dateKey(new Date(instant)));
  for(const date of ['',null,[],{},true,'2026-02-30','2026-13-01','2026-01-00','2026-01-01T99:00:00Z','2026-02-30T12:00:00Z','2026-01-01T12:00:00']){const before=reads;await assert.rejects(getWeeklyPlan({date}),error=>error.code==='INVALID_WEEK_DATE'&&error.status===400);assert.equal(reads,before);}
  process.stdout.write('PASS '+process.env.TZ);
})().catch(error=>{console.error(error);process.exitCode=1;});
`;
describe('Weekly planning civil dates across time zones',()=>{
  it.each(['UTC','America/Chicago','Europe/Lisbon','Asia/Tokyo','Pacific/Auckland'])('keeps selected dates, leap recurrence and DST boundaries in %s',zone=>{
    const result=spawnSync(process.execPath,['-e',source],{cwd:process.cwd(),env:{...process.env,TZ:zone},encoding:'utf8',timeout:15000});
    expect(result.status,result.stderr||String(result.error||'')).toBe(0);expect(result.stdout).toContain('PASS '+zone);
  });
});
