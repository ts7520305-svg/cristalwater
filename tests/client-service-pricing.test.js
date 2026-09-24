import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),pricing=require('../src/services/clientServicePricing'),calendar=require('../src/services/clientServicePlan'),{hash}=require('../src/services/fieldWriteRequestService');
function fixture({exception=false}={}){
 const day='2032-02-29',origin={plannedDate:calendar.localDate(day,'09:00').toISOString(),technicianId:3,roundId:null};
 const season={key:'SEASON_1',label:'Todo o ano',services:'Manutenção',fromMonth:1,toMonth:12,monthlyCents:0,billing:'PER_VISIT',visitCents:8000,schedules:[{poolId:23,frequency:'MONTHLY',count:1,slots:[{day:31,at:'09:00'}],technicianId:3,roundId:null}]};
 const plan={id:7,clientId:11,version:1,createdBy:'ADMIN:1',snapshot:{currency:'EUR',baseCents:0,periods:[],method:'CALENDAR_DAY_PRORATA',servicePlan:{schema:2,startsOn:'2031-01-01',endsOn:null,billing:'BY_SEASON',seasons:[season]}}};
 if(exception){season.schedules=[];plan.snapshot.servicePlan.exceptions=[{poolId:23,day,action:'REPLACE',reason:'Visita combinada',slots:[{at:'09:00'}],technicianId:3,roundId:null}];}
 const row={scope:'CLIENT_SERVICE_PLAN',resourceId:11,owner:'ADMIN:1',requestId:'e7d2b53e-00a2-40ec-b3b3-c0a7e2ba986a'},reviewToken='a'.repeat(64),monthRef='2032-02';
 row.payloadHash=hash({v:1,scope:row.scope,resourceId:11,payload:{expectedVersion:0,monthRef,snapshot:plan.snapshot,reviewToken}});
 row.response={ok:true,clientId:11,planVersion:1,planId:7,monthRef,pricingProof:{schema:1,planHash:hash(plan.snapshot),reviewToken},receipt:{owner:row.owner,scope:row.scope,resourceId:11,requestId:row.requestId,payloadHash:row.payloadHash,confirmedAt:'2031-01-01T12:00:00Z'}};
 const visit={id:101,clientId:11,poolId:23,reason:'AUTO_CLIENT_SERVICE',revenue:80,contractService:calendar.serviceData(plan,season,day,origin,plan.snapshot.servicePlan.exceptions?.[0])};
 return {plan,row,visit,sources:()=>new Map([[plan.id,{plan,valid:pricing.confirmed(plan,[row])}]])};
}
describe('immutable agreed visit pricing',()=>{
 it('requires the exact confirmed agreement and returns its original unit price',()=>{const f=fixture();expect(pricing.confirmed(f.plan,[f.row])).toBe(true);expect(pricing.price(f.visit,f.sources())).toBe(8000);expect(pricing.price({...f.visit,technicianId:99},f.sources())).toBe(8000);});
 it('rejects changed amounts, receipts, owners and duplicate agreement confirmations',()=>{
  for(const mutate of [f=>f.plan.snapshot.servicePlan.seasons[0].visitCents=9000,f=>f.row.response.pricingProof.planHash='b'.repeat(64),f=>f.row.response.receipt.requestId='other',f=>f.row.owner='ADMIN:9',f=>f.row.payloadHash='c'.repeat(64)]){const f=fixture();mutate(f);expect(pricing.confirmed(f.plan,[f.row])).toBe(false);expect(()=>pricing.price(f.visit,f.sources())).toThrow();}
  const f=fixture();expect(pricing.confirmed(f.plan,[f.row,structuredClone(f.row)])).toBe(false);
 });
 it('binds the visit to its client, original slot, assignment, season and revenue',()=>{
  for(const mutate of [v=>v.clientId=12,v=>v.revenue=90,v=>v.contractService.origin.plannedDate='2032-02-29T10:00:00.000Z',v=>v.contractService.origin.technicianId=9,v=>v.contractService.billing='INCLUDED_MONTHLY',v=>v.contractService.period='SEASON_2',v=>v.contractService.services='Changed',v=>v.reason='MANUAL']){const f=fixture();mutate(f.visit);expect(()=>pricing.price(f.visit,f.sources())).toThrow();}
 });
 it('supports explicitly priced dated exceptions and rejects a changed exception reason',()=>{const f=fixture({exception:true});expect(pricing.price(f.visit,f.sources())).toBe(8000);f.visit.contractService.exception.reason='Unconfirmed';expect(()=>pricing.price(f.visit,f.sources())).toThrow();});
 it('keeps monthly visits outside unit charging and does not embed amounts in technician provenance',()=>{const f=fixture();expect(pricing.price({contractService:{schema:1,billing:'INCLUDED_MONTHLY'}},new Map())).toBe(null);expect(JSON.stringify(f.visit.contractService)).not.toMatch(/visitCents|monthlyCents|8000|revenue/);});
 it('refuses an impossible slot even if the amount and plan receipt are unchanged',()=>{const f=fixture();f.visit.contractService.day='2032-02-28';f.visit.contractService.origin.plannedDate='2032-02-28T09:00:00.000Z';expect(()=>pricing.price(f.visit,f.sources())).toThrow();});
});
