import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),rules=require('../src/services/equipmentWorkTimeService'),writes=require('../src/services/fieldWriteRequestService');
const clone=v=>JSON.parse(JSON.stringify(v)),date=n=>new Date(Date.UTC(2008,0,1)+n),span=(a,b)=>({startAt:date(a).toISOString(),endAt:date(b).toISOString()}),visit={id:1,poolId:2,clientId:3,technicianId:4,startAt:date(0),endAt:date(10000)};
function store(){const window={};vm.runInNewContext(fs.readFileSync(new URL('../frontend/cw-field-write-store.js',import.meta.url),'utf8'),{window});return window.CWFieldWriteStore;}
describe('multiple own equipment work intervals',()=>{
  it('keeps millisecond precision and old inputs identical in Node and browser',()=>{
    for(const input of [span(1,1001),{intervals:[span(1,1001),span(3001,5001)]},{intervals:[span(0,1),span(1,2)]}])expect(clone(store().equipmentTime(input))).toEqual(rules.parse(input));
    expect(rules.create(span(1,1001),visit,'REGULAR')).toEqual({schema:1,basis:'DECLARED_EQUIPMENT_WORK_INTERVAL',...span(1,1001),durationMs:1000,origin:{visitType:'REGULAR',visitId:1,poolId:2,clientId:3,technicianId:4,visitStartAt:date(0).toISOString()}});
  });
  it('requires at most 20 ordered positive intervals and one exclusive input shape',()=>{
    const twenty={intervals:Array.from({length:20},(_,i)=>span(i*2,i*2+1))};expect(rules.parse(twenty)).toEqual(twenty);
    for(const input of [null,{},[],{intervals:[]},{intervals:[null]},{intervals:Array(21).fill(span(0,1))},{intervals:[span(2,3),span(0,1)]},{intervals:[span(0,2),span(1,3)]},{intervals:[span(0,0)]},{intervals:[span(0,1)],...span(0,1)},{intervals:[{...span(0,1),durationMs:1}]}]){expect(()=>rules.parse(input)).toThrow();expect(()=>store().equipmentTime(input)).toThrow();}
  });
  it('conserves an open last draft without allowing it into a confirmed request',()=>{
    const input={intervals:[span(0,1000),{startAt:date(3000).toISOString(),endAt:null}]};expect(clone(store().equipmentTime(input,true))).toEqual(input);expect(()=>store().equipmentTime(input)).toThrow();expect(()=>rules.parse(input)).toThrow();expect(()=>store().equipmentTime({intervals:[input.intervals[1],span(4000,5000)]},true)).toThrow();
  });
  it('records exactly the sum and rejects fabricated continuous bounds or per-interval durations',()=>{
    const input={intervals:[span(0,1000),span(3000,5000)]},record=rules.create(input,visit,'EXTRA');expect(record.schema).toBe(2);expect(record.durationMs).toBe(3000);expect(record.startAt).toBeUndefined();expect(rules.sound(record)).toBe(true);
    for(const mutate of [r=>r.durationMs=5000,r=>r.intervals[1].durationMs=3000,r=>r.intervals.reverse(),r=>r.intervals=[],r=>r.intervals[1]=null,r=>r.schema=1,r=>r.startAt=date(0).toISOString(),r=>r.origin.technicianId=0]){const changed=clone(record);mutate(changed);expect(rules.sound(changed)).toBe(false);}
  });
  it('binds the browser acknowledgement to every original interval and its typed origin',()=>{
    const payload={visitType:'REGULAR',visitId:1,poolId:2,expectedVersion:1,notes:'Tempo explicitamente conferido',confirmed:true,workTime:{intervals:[span(0,1000),span(3000,5000)]}},requestId='d145d52b-922a-40eb-936f-9b8bc0a0ee11',record={...writes.context({id:4,role:'TECHNICIAN'},'EQUIPMENT_MAINTENANCE',7,requestId,payload),payload},completedAt=date(6000).toISOString();
    const response={ok:true,applied:true,context:{planId:7,visitType:'REGULAR',visitId:1,poolId:2,expectedVersion:1},completedAt,completion:{id:9,planId:7,visitType:'REGULAR',visitId:1,poolId:2,version:1,requestId,notes:payload.notes,completedAt,workTime:rules.create(payload.workTime,visit,'REGULAR')},plan:{id:7,poolId:2,version:2,nextDue:'2008-02-01',lastCompletedAt:completedAt},receipt:{...record,confirmedAt:completedAt}};
    expect(store().confirmation(response,record)).toBe(response);
    for(const mutate of [r=>r.completion.workTime.durationMs=5000,r=>r.completion.workTime.intervals[1].startAt=date(2000).toISOString(),r=>r.completion.workTime.intervals.reverse(),r=>r.completion.workTime.origin.visitType='EXTRA',r=>r.completion.workTime.origin.technicianId=5,r=>delete r.completion.workTime]){const changed=clone(response);mutate(changed);expect(()=>store().confirmation(changed,record)).toThrow();}
  });
  it('reserves each equipment segment for reminder comparisons without charging its gaps',()=>{
    const compare=require('../frontend/cw-reminder-visit-resource-rules').compare,parent={type:'REGULAR',id:1,clientId:3,poolId:2,technicianId:4,status:'DONE',startAt:date(0).toISOString(),endAt:date(10000).toISOString()},peer={type:'EQUIPMENT',id:8,reminderId:null,hash:'a'.repeat(64),materials:null,workIntervals:[{startedAt:date(1).toISOString(),endedAt:date(1001).toISOString()},{startedAt:date(4001).toISOString(),endedAt:date(5001).toISOString()}]},data={technicianId:4,materials:null,workTime:{startedAt:date(2000).toISOString(),endedAt:date(4000).toISOString()}};
    expect(compare(data,parent,[peer],[]).durationSeconds).toBe(2);expect(()=>compare({...data,workTime:{startedAt:date(4000).toISOString(),endedAt:date(5000).toISOString()}},parent,[peer],[])).toThrow();
  });
});
