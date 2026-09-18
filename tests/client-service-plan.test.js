import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),calendar=require('../src/services/clientServicePlan'),rates=require('../src/business/finance/ClientRateBusiness');
const rule=(days)=>({poolId:1,frequency:'WEEKLY',count:days.length,slots:days.map(day=>({day,at:'08:00'})),technicianId:1});
const fixture=()=>({baseMonthlyAmount:0,periods:[],servicePlan:{startsOn:'2027-01-01',endsOn:'2028-12-31',seasons:[{label:'Setembro a maio',services:'Limpeza e análises',fromMonth:9,toMonth:5,monthlyAmount:100,schedules:[rule([1])]},{label:'Junho a agosto',services:'Limpeza e controlo',fromMonth:6,toMonth:8,monthlyAmount:250,schedules:[rule([1,3,5])]}]}});
describe('seasonal services share calendar and agreed price',()=>{
  it('resolves every day in two full years including leap day and transition weeks',()=>{
    const plan=rates.validate(fixture());let actual=0,expected=0;
    for(let y=2027;y<=2028;y++)for(let m=1;m<=12;m++){
      const month=`${y}-${String(m).padStart(2,'0')}`,summer=m>=6&&m<=8;
      for(const day of calendar.daysOfMonth(month)){
        const season=calendar.onDay(plan.servicePlan,day);expect(season.monthlyCents).toBe(summer?25000:10000);
        actual+=calendar.due(season.schedules[0],day).length;
        if((summer?[1,3,5]:[1]).includes(new Date(day+'T12:00:00Z').getUTCDay()))expected++;
      }
      expect(rates.calculate(plan,month).amount).toBe(summer?250:100);
    }
    expect(actual).toBe(expected);expect(calendar.onDay(plan.servicePlan,'2028-02-29').label).toBe('Setembro a maio');
    expect(calendar.onDay(plan.servicePlan,'2029-01-01')).toBeNull();
  });
  it('supports more than three visits and multiple visits on the same day without multiplying price',()=>{
    const input=fixture(),s=input.servicePlan.seasons[1];s.schedules[0]={...rule([0,1,2,3,4,5,6]),count:14,slots:Array.from({length:7},(_,day)=>[{day,at:'08:00'},{day,at:'17:00'}]).flat()};
    const plan=rates.validate(input);expect(calendar.due(plan.servicePlan.seasons[1].schedules[0],'2028-06-01')).toHaveLength(2);expect(rates.calculate(plan,'2028-06').amount).toBe(250);
  });
  it('uses Lisbon wall time independent of host timezone, and identifies nonexistent spring hours',()=>{
    for(const TZ of ['UTC','America/Chicago','Pacific/Auckland']){
      const result=JSON.parse(execFileSync(process.execPath,['-e',`const c=require('./src/services/clientServicePlan');console.log(JSON.stringify([c.localDate('2028-06-01','08:00'),c.localDate('2028-02-29','08:00'),c.localDate('2028-03-26','01:30')]));`],{env:{...process.env,TZ},encoding:'utf8'}));
      expect(result).toEqual(['2028-06-01T07:00:00.000Z','2028-02-29T08:00:00.000Z',null]);
    }
  });
  it('prorates start/end only, including free seasons; never adds legacy pool fees',()=>{
    const input=fixture();input.servicePlan.startsOn='2028-02-15';input.servicePlan.endsOn='2028-06-15';
    const plan=rates.validate(input);expect(rates.calculate(plan,'2028-02').amount).toBe(51.72);expect(rates.calculate(plan,'2028-06').amount).toBe(125);expect(rates.calculate(plan,'2028-07').amount).toBe(0);
    input.servicePlan.seasons[1].monthlyAmount=0;expect(rates.calculate(rates.validate(input),'2028-06').amount).toBe(0);
    expect(()=>rates.validate({...fixture(),baseMonthlyAmount:20})).toThrow();
  });
  it('keeps incomplete schedules pending and permits seasons with no visits',()=>{
    const input=fixture();input.servicePlan.seasons[0].schedules=[];input.servicePlan.seasons[1].schedules[0].slots=[];
    const plan=rates.validate(input);expect(plan.servicePlan.seasons[1].schedules[0].count).toBe(3);expect(plan.servicePlan.seasons[1].schedules[0].slots).toEqual([]);
  });
  it('validates actual monthly counts and shorter-month collisions',()=>{
    const input=fixture(),r=input.servicePlan.seasons[0].schedules[0];Object.assign(r,{frequency:'MONTHLY',count:1,slots:[{day:31,at:'09:00'}]});
    const p=rates.validate(input);expect(calendar.due(p.servicePlan.seasons[0].schedules[0],'2028-02-29')).toHaveLength(1);expect(calendar.due(p.servicePlan.seasons[0].schedules[0],'2027-02-28')).toHaveLength(1);
    r.count=2;r.slots.push({day:30,at:'09:00'});expect(()=>rates.validate(input)).toThrow(/meses/);
    r.count=0;expect(()=>rates.validate(input)).toThrow();
  });
  it('rejects overlaps, gaps, duplicate slots, foreign shapes and contradictory calendars',()=>{
    for(const change of [p=>p.seasons[0].fromMonth=8,p=>p.seasons[0].fromMonth=10,p=>p.seasons[0].schedules[0].count=true,p=>p.seasons[0].schedules[0].days=[1],p=>p.seasons[0].schedules[0].roundId=2,p=>p.seasons[0].schedules[0].slots=[{day:1,at:'08:00'},{day:1,at:'08:00'}],p=>p.endsOn='2026-12-31']){
      const input=fixture();change(input.servicePlan);expect(()=>rates.validate(input)).toThrow();
    }
  });
});
