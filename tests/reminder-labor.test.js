import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),writes=require('../src/services/fieldWriteRequestService'),resource=require('../frontend/cw-reminder-resource-rules'),rules=require('../frontend/cw-reminder-labor-rules'),sources=require('../src/services/expenseValuationSources');
const clone=v=>JSON.parse(JSON.stringify(v)),hash=writes.hash,sha='a'.repeat(64),requestId='d145d52b-922a-40eb-936f-9b8bc0a0ee11',owner='ADMIN:1';
function fixture(){
  const source={id:1,title:'Serviço',description:null,category:'POOL_SERVICE_REMINDER',status:'DONE',completedAt:'2008-07-11T12:00:00.000Z',clientId:2,poolId:4,technicianId:null},target={type:'MAINTENANCE_REMINDER',id:1,clientId:2,poolId:4,status:'CONFIRMED',startAt:null,endAt:source.completedAt,executionBasis:'CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION',decisionId:5,decisionFingerprint:sha,executionFingerprint:sha,originVisitType:null,originVisitId:null};
  const proposed={technicianId:3,materials:{mode:'NONE',items:[]},workTime:{startedAt:'2008-07-11T10:00:00.000Z',endedAt:'2008-07-11T10:01:00.000Z'}},p={schema:1,basis:resource.basis,reminderId:1,action:'DECLARE',recordId:null,recordHash:null,origin:{reminderId:1,clientId:2,poolId:4,technicianId:3},contextHash:sha,source,sourceHash:hash(source),target,targetHash:hash(target),proposed,durationSeconds:60};
  const preview={available:true,...p,hash:hash(p)},body={requestId,action:'DECLARE',recordId:null,data:proposed,previewHash:preview.hash,reason:'Recursos conferidos',confirmed:true},event={schema:1,basis:resource.basis,id:requestId,owner,reminderId:1,recordId:9,reason:body.reason,createdAt:'2008-07-12T00:00:00.000Z',preview},request=writes.context({id:1,role:'ADMIN'},resource.scope,1,requestId,(({requestId,...v})=>v)(body)),declaration={ok:true,applied:true,envelope:body,event,eventHash:hash(event),receipt:{...request,confirmedAt:event.createdAt}};
  const row={id:9,reminderId:1,clientId:2,poolId:4,technicianId:3,startedAt:proposed.workTime.startedAt,endedAt:proposed.workTime.endedAt,snapshot:event,result:declaration},snapshot=require('../src/services/reminderLaborSourceService').snapshot(row),work={id:9,fingerprint:hash(snapshot),snapshot},basis={id:7,expenseId:8,technicianId:3,periodStart:'2008-07-01',periodEnd:'2008-07-31',paidMinutes:3};
  const value={version:6,kind:'LABOR',service:target,basis,expenseAmountCents:100,workBasis:rules.basis,workInterval:work};
  return {row,work,target,basis,value,preview};
}
const calculated=(before='0',cents=0,amount=33)=>({quantity:'60',quantityUnit:'SECOND',availableQuantity:'60',amountCents:amount,calculation:{quantity:'60',quantityUnit:'SECOND',amountCents:amount,method:'CONFIRMED_EXPENSE_PAID_TIME',rounding:before==='120'?'FINAL_POOL_REMAINDER':'NEAREST_CENT',poolQuantityBefore:before,poolAmountBeforeCents:cents,measuredQuantityBefore:'0',baseQuantity:'180',baseAmountCents:100}});
describe('independent reminder labor valuation',()=>{
  it('uses identical original-declaration validation in Node and the browser',async()=>{
    const c=vm.createContext({});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-reminder-resource-rules','cw-reminder-labor-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);
    const f=fixture();expect(clone(await c.CWReminderLaborRules.work(f.work,f.target,hash))).toEqual(await rules.work(f.work,f.target,hash));await expect(rules.source(f.value,f.target,9,f.basis,hash)).resolves.toEqual(f.work.snapshot);
  });
  it('binds the derived interval to the exact original declaration, technician, origin and time',async()=>{
    for(const change of [s=>s.durationSeconds=59,s=>s.technicianId=5,s=>s.reminderId=5,s=>s.poolId=7,s=>s.clientId=7,s=>s.startedAt='2008-07-11T09:59:00.000Z',s=>s.createdBy='ADMIN:2',s=>s.reason='Outro motivo',s=>s.createdAt='2008-07-11T00:00:00.000Z',s=>s.technicianName='Nome atual inventado como histórico',s=>s.declaration.event.reason='Outro comprovativo']){const f=fixture();change(f.work.snapshot);f.work.fingerprint=hash(f.work.snapshot);await expect(rules.work(f.work,f.target,hash)).rejects.toThrow();}
  });
  it('rejects an invalid original duration even when every surrounding hash is recomputed',async()=>{
    const f=fixture(),d=f.work.snapshot.declaration,p=d.event.preview;p.durationSeconds=59;p.hash=hash(resource.facts(p));d.envelope.previewHash=p.hash;d.receipt.payloadHash=writes.context({id:1,role:'ADMIN'},resource.scope,1,requestId,(({requestId,...v})=>v)(d.envelope)).payloadHash;d.eventHash=hash(d.event);f.work.snapshot.durationSeconds=59;f.work.fingerprint=hash(f.work.snapshot);await expect(rules.work(f.work,f.target,hash)).rejects.toThrow();
  });
  it('requires the same technician and complete interval within the paid period',async()=>{
    for(const change of [v=>v.basis.technicianId=4,v=>v.basis.periodEnd='2008-07-10',v=>v.basis.periodStart='2008-07-12',v=>v.basis.paidMinutes=0,v=>v.basis.expenseId=0,v=>v.version=3,v=>v.service.type='REPAIR',v=>v.workInterval.id=10]){const f=fixture();change(f.value);await expect(rules.source(f.value,f.target,9,f.basis,hash)).rejects.toThrow();}
  });
  it('preserves exact cents and shared seconds including the final pool remainder',()=>{
    const f=fixture();for(const p of [calculated(),calculated('60',33),calculated('120',66,34)])expect(rules.calculation(p,f.work.snapshot,f.basis,100)).toBe(p.calculation);
    for(const mutate of [p=>p.amountCents=34,p=>p.calculation.amountCents=34,p=>p.calculation.poolQuantityBefore='121',p=>p.calculation.poolAmountBeforeCents=100,p=>p.calculation.measuredQuantityBefore='60',p=>p.calculation.baseQuantity='181',p=>p.quantity='30',p=>p.calculation.rounding='FINAL_POOL_REMAINDER']){const p=calculated();mutate(p);expect(()=>rules.calculation(p,f.work.snapshot,f.basis,100)).toThrow();}
    const wrong=calculated('120',66,33);expect(()=>rules.calculation(wrong,f.work.snapshot,f.basis,100)).toThrow();
  });
  it('keeps numeric reminder/repair identities separate and uses the independent recorded interval',()=>{
    const f=fixture(),expense={id:8,category:'LABOR',sourceType:'MANUAL',amountCents:100,laborBasis:{...f.basis,periodStart:new Date('2008-07-01Z'),periodEnd:new Date('2008-07-31Z')},laborDistributions:[]};
    const prepared={reminders:new Map([[1,{valid:true,clientId:2,hash:hash(f.target),snapshot:f.target}]]),reminderIntervals:new Map([[9,{...f.work,reminderId:1,clientId:2,technicianId:3,startedAt:f.work.snapshot.startedAt,endedAt:f.work.snapshot.endedAt,sourceHash:hash(f.target),state:'CONFIRMED'}]]),workIntervals:new Map([[9,{repairId:1,technicianId:99,state:'CONFIRMED'}]]),active:[]};
    const choice={kind:'LABOR',targetType:'MAINTENANCE_REMINDER',targetId:1,workIntervalId:9,purchaseItemId:null};const result=sources.build(prepared,expense,choice);expect(result.valid).toBe(true);expect(result.units).toBe(60000000n);expect(result.snapshot).toEqual(f.value);expect(result.key).toBe(hash({kind:'LABOR',targetType:'MAINTENANCE_REMINDER',id:1,workIntervalId:9}));expect(result.key).not.toBe(hash({kind:'LABOR',targetType:'REPAIR',id:1,workIntervalId:9}));
    for(const state of ['VOIDED','REVIEW']){prepared.reminderIntervals.get(9).state=state;expect(sources.build(prepared,expense,choice).valid).toBe(false);}
    expect(sources.build(prepared,expense,{...choice,kind:'MATERIAL'}).valid).toBe(false);
  });
  it('retains historical void previews and validates optional explicit cost impacts',async()=>{
    const f=fixture(),p={...f.preview,action:'VOID',recordId:9,recordHash:sha,source:null,sourceHash:null,target:null,targetHash:null,proposed:null,durationSeconds:null};p.hash=hash(resource.facts(p));await expect(resource.preview(p,hash)).resolves.toBe(p);
    const cost={allocationId:5,expenseId:8,amountCents:33,workIntervalId:9,groupId:null,allocationHash:sha};p.affectedCosts=[cost];p.hash=hash(resource.facts(p));await expect(resource.preview(p,hash)).resolves.toBe(p);
    for(const changed of [[{...cost,workIntervalId:10}],[cost,cost],[{...cost,amountCents:0}],[{...cost,allocationHash:null}]]){p.affectedCosts=changed;p.hash=hash(resource.facts(p));await expect(resource.preview(p,hash)).rejects.toThrow();}
  });
  it('does not add null reminder fields to prior composed-cost receipt projections',()=>{
    const {allocationFacts}=require('../src/services/laborCostCompositionIntegrity');expect(allocationFacts({targetType:'REPAIR',serviceReminderId:null})).not.toHaveProperty('serviceReminderId');expect(allocationFacts({targetType:'MAINTENANCE_REMINDER',serviceReminderId:1})).toHaveProperty('serviceReminderId',1);
  });
});
