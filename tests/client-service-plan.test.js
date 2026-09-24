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

describe('anchored seasonal recurrence',()=>{
  const recurring=(frequency,interval,anchorOn,slots)=>{
    const input=fixture();input.servicePlan.seasons[0].schedules[0]={...rule([1]),frequency,interval,anchorOn,slots,count:slots.length};
    return rates.validate(input).servicePlan.seasons[0].schedules[0];
  };
  it('keeps alternate weeks continuous across year and season boundaries',()=>{
    const r=recurring('WEEKLY',2,'2027-12-20',[{day:1,at:'08:00'},{day:5,at:'16:00'}]);
    const dates=['2027-12-20','2027-12-24','2027-12-27','2027-12-31','2028-01-03','2028-01-07','2028-01-10'];
    expect(dates.map(d=>calendar.due(r,d).length)).toEqual([1,1,0,0,1,1,0]);
    expect(calendar.due(r,'2027-12-06')).toEqual([]);
  });
  it('starts on the reference date and uses Monday weeks even when it is a Sunday',()=>{
    const r=recurring('WEEKLY',2,'2028-01-02',[{day:0,at:'09:00'},{day:1,at:'09:00'}]);
    expect(['2027-12-27','2028-01-02','2028-01-03','2028-01-10','2028-01-16'].map(d=>calendar.due(r,d).length)).toEqual([0,1,0,1,1]);
  });
  it('supports quarterly visits and leap-month end without resetting at January',()=>{
    const r=recurring('MONTHLY',3,'2027-11-15',[{day:31,at:'09:00'}]);
    expect(['2027-08-31','2027-11-30','2027-12-31','2028-01-31','2028-02-29','2028-05-31','2028-11-30'].map(d=>calendar.due(r,d).length)).toEqual([0,1,0,0,1,1,1]);
  });
  it('preserves old snapshots and the agreed monthly price',()=>{
    const input=fixture(),old=rates.validate(input);input.servicePlan.seasons[0].schedules[0].interval=1;
    expect(rates.validate(input)).toEqual(old);
    Object.assign(input.servicePlan.seasons[0].schedules[0],{interval:2,anchorOn:'2027-01-01'});
    expect(rates.calculate(rates.validate(input),'2028-02').amount).toBe(100);
  });
  it('validates interval, reference dates, and count per active cycle',()=>{
    for(const [interval,anchor] of [[0,'2027-01-01'],[true,'2027-01-01'],[1.5,'2027-01-01'],[53,'2027-01-01'],[2,null],[2,'2027-02-29'],[1,'2027-01-01']])expect(()=>recurring('WEEKLY',interval,anchor,[{day:1,at:'08:00'}])).toThrow();
    expect(()=>recurring('MONTHLY',25,'2027-01-01',[{day:1,at:'08:00'}])).toThrow();
  });
  it('matches an independent two-year alternate-week count',()=>{
    const r=recurring('WEEKLY',2,'2027-01-04',[{day:1,at:'08:00'}]);let found=0;
    for(let n=0;n<730;n++){const d=new Date(Date.UTC(2027,0,4+n)).toISOString().slice(0,10);if(calendar.due(r,d).length)found++;}
    expect(found).toBe(53);
  });
});

describe('dated service exceptions',()=>{
  const exception=(changes={})=>({poolId:1,day:'2028-02-29',action:'REPLACE',reason:'Horário combinado',slots:[{at:'10:00'},{at:'15:00'}],technicianId:2,...changes});
  const plan=exceptions=>{const f=fixture();f.servicePlan.exceptions=exceptions;return rates.validate(f).servicePlan;};
  it('replaces only the selected installation/date and retains the following recurring dates',()=>{
    const p=plan([exception()]);expect(calendar.rulesForDay(p,'2028-02-29')[0].slots.map(s=>s.at)).toEqual(['10:00','15:00']);
    expect(calendar.rulesForDay(p,'2028-02-28')[0].technicianId).toBe(1);expect(calendar.rulesForDay(p,'2028-02-29')[0].technicianId).toBe(2);
    expect(calendar.rulesForDay(p,'2029-02-28')).toEqual([]);
  });
  it('allows a day without visits and a replacement outside an active recurrence cycle',()=>{
    const p=plan([exception({day:'2028-02-28',action:'SKIP',slots:[],technicianId:null})]);expect(calendar.rulesForDay(p,'2028-02-28')).toEqual([]);
    p.seasons[0].schedules[0].interval=2;p.seasons[0].schedules[0].anchorOn='2028-03-01';p.exceptions=[exception()];
    const r=calendar.rulesForDay(p,'2028-02-29')[0];expect(calendar.due(r,'2028-02-29')).toHaveLength(2);
  });
  it('validates unique dates, real dates, owner IDs, times and explicit intent',()=>{
    for(const e of [exception({day:'2027-02-29'}),exception({day:'2029-01-01'}),exception({poolId:true}),exception({reason:''}),exception({action:'SKIP'}),exception({slots:[]}),exception({slots:[{at:'25:00'}]}),exception({slots:[{at:'10:00'},{at:'10:00'}]}),exception({roundId:1}),exception({billing:'FREE'})])expect(()=>plan([e])).toThrow();
    expect(()=>plan([exception(),exception()])).toThrow();expect(()=>plan(null)).toThrow();
  });
  it('preserves old snapshots and monthly billing, including all skipped days',()=>{
    const f=fixture(),original=rates.validate(f);f.servicePlan.exceptions=[];expect(rates.validate(f)).toEqual(original);
    f.servicePlan.exceptions=calendar.daysOfMonth('2028-02').map(day=>exception({day,action:'SKIP',slots:[],technicianId:null}));
    expect(rates.calculate(rates.validate(f),'2028-02').amount).toBe(100);
  });
  it('includes exception-only installations and keeps the original reason in visit provenance',()=>{
    const e=exception({poolId:7}),p=plan([e]),r=calendar.rulesForDay(p,e.day).find(r=>r.poolId===7);
    expect(calendar.allRules(p).some(r=>r.poolId===7)).toBe(true);
    const data=calendar.serviceData({id:2,version:3},p.seasons[0],e.day,{},r.exception);expect(data.exception).toEqual({...e,roundId:null});expect(data.billing).toBe('INCLUDED_MONTHLY');expect(data).not.toHaveProperty('monthlyCents');
  });
});


describe('seasonal price normalization and legacy compatibility',()=>{
  const shared=require('../frontend/cw-client-service-pricing');
  const mixed=()=>{const f=fixture();Object.assign(f.servicePlan.seasons[1],{billing:'PER_VISIT',monthlyAmount:0,visitAmount:'17.23'});return f;};
  it('uses identical monthly and unit amounts in backend and browser for a mixed agreement',()=>{
    const input=mixed(),snapshot=rates.validate(input);expect(snapshot.servicePlan.schema).toBe(2);expect(snapshot.servicePlan.billing).toBe('BY_SEASON');expect(rates.calculate(snapshot,'2028-02').amount).toBe(100);
    for(const month of ['2028-02','2028-06'])expect(shared.calculate(shared.fromInput(input.servicePlan),month)).toEqual(rates.calculate(snapshot,month));
    const june=rates.calculate(snapshot,'2028-06');expect(june.amount).toBe(0);expect(june.perVisitRates).toEqual([{period:'SEASON_2',label:'Junho a agosto',unitAmount:17.23}]);
  });
  it('rejects contradictory charges, absent unit prices, fractions of cents and unsupported modes',()=>{
    for(const change of [s=>s.monthlyAmount=1,s=>delete s.visitAmount,s=>s.visitAmount='1.005',s=>s.visitAmount=true,s=>s.visitAmount=-1,s=>s.visitAmount='10000000.01',s=>s.billing='HOURLY']){const input=mixed();change(input.servicePlan.seasons[1]);expect(()=>rates.validate(input)).toThrow();}
    const input=fixture();input.servicePlan.seasons[0].visitAmount=1;expect(()=>rates.validate(input)).toThrow();
  });
  it('preserves normalized legacy snapshots when the monthly choice is explicit',()=>{
    const old=rates.validate(fixture()),input=fixture();input.servicePlan.seasons.forEach(s=>Object.assign(s,{billing:'INCLUDED_MONTHLY',visitAmount:0}));expect(rates.validate(input)).toEqual(old);
  });
});
