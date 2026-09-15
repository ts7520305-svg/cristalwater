import {describe,it,expect} from 'vitest';
const {calendarDays,cadenceDays,cadenceForRounds,activePool}=require('../src/services/autoVisitAlertService');
describe('Maintenance coverage rules',()=>{
  it('does not treat monthly rounds as weekly overdue work',()=>{expect(cadenceForRounds([{recurrence:'MONTHLY',dayOfMonth:31}])).toBe(32);expect(cadenceForRounds([{recurrence:'DAILY'}])).toBe(2);expect(cadenceForRounds([{recurrence:'MONTHLY'},{recurrence:'WEEKLY',dayOfWeek:1}])).toBe(8);});
  it('uses longest scheduled interval with one day of tolerance',()=>{expect(cadenceDays([1])).toBe(8);expect(cadenceDays([1,4])).toBe(5);expect(cadenceDays([1,1,4])).toBe(5);expect(cadenceDays([])).toBe(8);});
  it('counts calendar boundaries rather than elapsed hours',()=>{expect(calendarDays(new Date(2026,2,30,0),new Date(2026,2,29,23))).toBe(1);expect(calendarDays(new Date(2026,0,1),new Date(2025,11,31))).toBe(1);});
  it('excludes paused, archived, deleted and inactive accounts',()=>{
    const pool={active:true,archiveStatus:'ATIVO',client:{active:true,archiveStatus:'ATIVO',status:'ACTIVE'}};expect(activePool(pool)).toBeTruthy();
    expect(activePool({...pool,active:false})).toBeFalsy();expect(activePool({...pool,archiveStatus:'PAUSA'})).toBeFalsy();expect(activePool({...pool,client:{...pool.client,status:'PAUSED'}})).toBeFalsy();expect(activePool({...pool,client:{...pool.client,deletedAt:new Date()}})).toBeFalsy();
  });
});

describe('coverage across a large daily plan',()=>{
 it('keeps visits and schedules attached to the correct pools',async()=>{
  const {getCoverage}=require('../src/services/autoVisitAlertService');
  const now=new Date(2026,8,14,12),yesterday=new Date(2026,8,13,12);
  const pools=Array.from({length:400},(_,i)=>({id:i+1,name:`Piscina ${i+1}`,createdAt:new Date(2026,0,1),active:true,archiveStatus:'ATIVO',client:{name:'Cliente',active:true,archiveStatus:'ATIVO',status:'ACTIVE'},serviceVisits:[]}));
  const rounds=pools.map(p=>({id:p.id,name:`Ronda ${p.id}`,recurrence:'DAILY',pools:[{poolId:p.id}]}));
  const visits=pools.map(p=>({id:p.id+1000,poolId:p.id,status:'PLANNED',plannedDate:yesterday,technicianId:41,technician:{name:'Técnico',active:true,archiveStatus:'ATIVO'}}));
  let visitQuery=0;
  const db={pool:{findMany:async()=>pools},round:{findMany:async()=>rounds},serviceVisit:{findMany:async()=>++visitQuery===1?visits:pools.filter(p=>p.id%2===0).map(p=>({poolId:p.id}))},technician:{findMany:async()=>[]},operationalReminder:{findMany:async()=>[]}};
  const result=await getCoverage(db,now);expect(result.rows).toHaveLength(400);
  for(const row of result.rows){expect(row.visits.map(v=>v.id)).toEqual([row.poolId+1000]);expect(row.rounds.map(r=>r.id)).toEqual([row.poolId]);expect(row.flags.includes('NOT_SCHEDULED_TODAY')).toBe(row.poolId%2!==0);expect(row.visits[0].issues).toContain('OVERDUE');}
 });
});
