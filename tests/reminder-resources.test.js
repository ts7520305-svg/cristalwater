import { describe,it,expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),r=require('../src/services/fieldWriteRequestService'),rules=require('../frontend/cw-reminder-resource-rules');
const clone=v=>JSON.parse(JSON.stringify(v)),sha='a'.repeat(64),uuid='d145d52b-922a-40eb-936f-9b8bc0a0ee11',owner='ADMIN:1';
const data={technicianId:3,materials:{mode:'DECLARED',items:[{productName:'CLORO',unit:'KG',quantity:'0.25'}]},workTime:{startedAt:'2000-01-01T10:00:00.000Z',endedAt:'2000-01-01T11:00:00.000Z'}};
function preview(){const source={id:1,title:'Serviço',description:null,category:'POOL_SERVICE_REMINDER',status:'DONE',completedAt:'2000-01-01T12:00:00.000Z',clientId:2,poolId:4,technicianId:null},target={type:'MAINTENANCE_REMINDER',id:1,clientId:2,poolId:4,status:'CONFIRMED',startAt:null,endAt:source.completedAt,executionBasis:'CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION',decisionId:5,decisionFingerprint:sha,executionFingerprint:sha,originVisitType:null,originVisitId:null};const p={schema:1,basis:rules.basis,reminderId:1,action:'DECLARE',recordId:null,recordHash:null,origin:{reminderId:1,clientId:2,poolId:4,technicianId:3},contextHash:sha,source,sourceHash:r.hash(source),target,targetHash:r.hash(target),proposed:clone(data),durationSeconds:3600};return {available:true,...p,hash:r.hash(p)};}
function result(p=preview()){const body={requestId:uuid,action:p.action,recordId:p.recordId,data:p.proposed,previewHash:p.hash,reason:'Recursos conferidos',confirmed:true},request=r.context({id:1,role:'ADMIN'},rules.scope,1,uuid,(({requestId,...v})=>v)(body)),event={schema:1,basis:rules.basis,id:uuid,owner,reminderId:1,recordId:9,reason:body.reason,createdAt:'2000-01-02T00:00:00.000Z',preview:p};return {body,value:{ok:true,applied:true,envelope:body,event,eventHash:r.hash(event),receipt:{...request,confirmedAt:event.createdAt}}};}
describe('independent reminder resources',()=>{
  it('uses the same canonical material and work rules in Node and the browser',()=>{
    const c=vm.createContext({});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-reminder-resource-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);
    const input=clone(data);input.materials.items[0]={productName:' cloro ',unit:'kg',quantity:'0.250000'};
    expect(clone(c.CWReminderResourceRules.input(input))).toEqual(rules.input(input));expect(rules.input(input)).toEqual(data);
  });
  it('distinguishes unknown resources from explicit no materials and never invents hours',()=>{
    expect(rules.input({...data,materials:{mode:'NONE',items:[]},workTime:null})).toEqual({...data,materials:{mode:'NONE',items:[]},workTime:null});
    expect(rules.input({...data,materials:null}).materials).toBe(null);expect(()=>rules.input({...data,materials:null,workTime:null})).toThrow();
  });
  it('rejects malformed resources, excessive quantities, duplicate products and invalid intervals',()=>{
    const bad=[{...data,technicianId:0},{...data,extra:true},{...data,workTime:{startedAt:data.workTime.startedAt,endedAt:data.workTime.startedAt}},{...data,workTime:{...data.workTime,endedAt:'2000-02-30T11:00:00.000Z'}},{...data,workTime:{...data.workTime,endedAt:'2000-01-01T11:00:00.123Z'}}];
    for(const quantity of ['0','-1','100001','0.0000001','1e2'])bad.push({...data,materials:{mode:'DECLARED',items:[{productName:'X',unit:'KG',quantity}]}});
    bad.push({...data,materials:{mode:'DECLARED',items:[...data.materials.items,...data.materials.items]}});for(const v of bad)expect(()=>rules.input(v)).toThrow();
  });
  it('validates a historical execution with independently identified technician and an exact receipt',async()=>{const {body,value}=result();await expect(rules.preview(value.event.preview,r.hash)).resolves.toBe(value.event.preview);await expect(rules.response(value,body,owner,1,r.hash)).resolves.toBe(value);});
  it('rejects rehashed previews with a wrong source, assigned technician, duration, client or billing proof',async()=>{
    for(const mutate of [p=>{p.source.category='GENERAL';p.sourceHash=r.hash(p.source);},p=>{p.source.status='CANCELLED';p.sourceHash=r.hash(p.source);},p=>{p.source.technicianId=8;p.sourceHash=r.hash(p.source);},p=>{p.durationSeconds=60;},p=>{p.target.clientId=8;p.targetHash=r.hash(p.target);},p=>{p.target.decisionFingerprint='bad';p.targetHash=r.hash(p.target);},p=>{p.proposed.workTime.endedAt='2000-01-02T11:00:00.000Z';p.durationSeconds=90000;}]){const p=preview();mutate(p);p.hash=r.hash(rules.facts(p));await expect(rules.preview(p,r.hash)).rejects.toThrow();}
  });
  it('rejects forged acknowledgements even when the event is rehashed',async()=>{
    for(const mutate of [v=>{v.event.owner='ADMIN:2';},v=>{v.event.reason='Different reason';},v=>{v.event.reminderId=2;},v=>{v.receipt.payloadHash=sha;},v=>{v.receipt.resourceId=2;},v=>{v.event.preview.proposed.materials=null;}]){const {body,value}=result();mutate(value);value.eventHash=r.hash(value.event);await expect(rules.response(value,body,owner,1,r.hash)).rejects.toThrow();}
  });
  it('retains refusal receipts without accepting a fabricated declaration',async()=>{const {body,value}=result();const refusal={ok:true,applied:false,envelope:body,code:'PREVIEW_CHANGED',message:'Reveja a origem.',receipt:value.receipt};await expect(rules.response(refusal,body,owner,1,r.hash)).resolves.toBe(refusal);await expect(rules.response({...refusal,event:value.event},body,owner,1,r.hash)).rejects.toThrow();});
  it('requires an explicit preserved record for voiding, without a fabricated current source',async()=>{const original=preview(),p={...original,action:'VOID',recordId:9,recordHash:sha,source:null,sourceHash:null,target:null,targetHash:null,proposed:null,durationSeconds:null};p.hash=r.hash(rules.facts(p));const {body,value}=result(p);await expect(rules.response(value,body,owner,1,r.hash)).resolves.toBe(value);p.recordHash=null;p.hash=r.hash(rules.facts(p));await expect(rules.preview(p,r.hash)).rejects.toThrow();});
});
