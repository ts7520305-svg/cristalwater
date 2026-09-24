import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),rules=require('../frontend/cw-reminder-visit-rules'),writes=require('../src/services/fieldWriteRequestService'),history=require('../src/services/reminderVisitJournal');
const hash=writes.hash,clone=v=>JSON.parse(JSON.stringify(v)),owner='ADMIN:1',sha='a'.repeat(64);
function fixture(action='LINK',original=null){
  const source={id:1,title:'Serviço <img src=x>',description:null,category:'POOL_SERVICE_REMINDER',status:'DONE',completedAt:'2008-07-12T12:00:00.000Z',clientId:2,poolId:4,technicianId:null};
  const parent={type:'EXTRA',id:1,clientId:2,poolId:4,technicianId:3,status:'DONE',startAt:'2008-07-11T10:00:00.000Z',endAt:'2008-07-11T11:00:00.000Z'};
  const target={type:'MAINTENANCE_REMINDER',id:1,clientId:2,poolId:4,status:'CONFIRMED',startAt:null,endAt:source.completedAt,executionBasis:'CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION',decisionId:5,decisionFingerprint:sha,executionFingerprint:sha,originVisitType:null,originVisitId:null};
  const link=action==='LINK',selection={action,associationId:link?null:original.event.id,visitType:link?'EXTRA':null,visitId:link?1:null};
  const value={schema:1,basis:rules.basis,reminderId:1,selection,previousHash:link?null:original.eventHash,contextHash:sha,origin:{reminderId:1,clientId:2,poolId:4,technicianId:3},source:link?source:null,sourceHash:link?hash(source):null,target:link?target:null,targetHash:link?hash(target):null,parent:link?parent:null,parentHash:link?hash(parent):null,original};
  const preview={available:true,...value,hash:hash(value)},body={requestId:link?'d145d52b-922a-40eb-936f-9b8bc0a0ee11':'d145d52b-922a-40eb-936f-9b8bc0a0ee22',...selection,previewHash:preview.hash,reason:'Visita e origem histórica conferidas',confirmed:true};
  const event={schema:1,basis:rules.basis,id:body.requestId,owner,reminderId:1,reason:body.reason,createdAt:'2008-07-13T12:00:00.000Z',preview},receipt={...writes.context({id:1,role:'ADMIN'},rules.scope,1,body.requestId,(({requestId,...p})=>p)(body)),confirmedAt:event.createdAt};
  return {ok:true,applied:true,envelope:body,event,eventHash:hash(event),receipt};
}
function rehash(r){const p=r.event.preview;if(p.source)p.sourceHash=hash(p.source);if(p.parent)p.parentHash=hash(p.parent);if(p.target)p.targetHash=hash(p.target);p.hash=hash(rules.facts(p));r.envelope.previewHash=p.hash;r.eventHash=hash(r.event);r.receipt.payloadHash=writes.context({id:1,role:'ADMIN'},rules.scope,1,r.envelope.requestId,(({requestId,...v})=>v)(r.envelope)).payloadHash;return r;}
const verify=r=>rules.response(r,r.envelope,owner,1,hash);
describe('explicit reminder visit association',()=>{
  it('validates the same complete typed receipt in Node and browser without inheriting resources',async()=>{
    const c=vm.createContext({});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-reminder-resource-rules','cw-reminder-visit-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);
    const r=fixture();expect(clone(await c.CWReminderVisitRules.response(r,r.envelope,owner,1,hash))).toEqual(await verify(r));expect(r.event.preview.parent.id).toBe(r.event.reminderId);expect(r.event.preview.parent.type).toBe('EXTRA');expect(r.event.preview.target.originVisitId).toBeNull();
  });
  it('rejects unknown fields, unbounded ids, mixed visit types and missing explicit consent',async()=>{
    for(const change of [r=>r.envelope.visitId=2147483648,r=>r.envelope.visitType='REPAIR',r=>r.envelope.associationId=r.event.id,r=>r.envelope.confirmed=false,r=>r.envelope.auto=true,r=>r.envelope.requestId=r.envelope.requestId.toUpperCase(),r=>r.envelope.reason='  Motivo  ']){const r=fixture();change(r);await expect(verify(rehash(r))).rejects.toThrow();}
  });
  it('rejects rehashed mismatched historical identities, times and commercial origins',async()=>{
    for(const change of [p=>p.parent.clientId=6,p=>p.parent.poolId=5,p=>p.parent.technicianId=7,p=>p.parent.type='REGULAR',p=>p.parent.status='IN_PROGRESS',p=>p.parent.endAt=p.parent.startAt,p=>p.parent.startAt=null,p=>p.parent.price=100,p=>p.source.technicianId=9,p=>p.target.originVisitType='EXTRA',p=>p.target.originVisitId=1,p=>p.target.endAt=p.parent.endAt,p=>p.source.id=2,p=>p.origin.technicianId=7]){const r=fixture();change(r.event.preview);await expect(verify(rehash(r))).rejects.toThrow();}
  });
  it('keeps the complete original when unlinking and rejects nested or substituted history',async()=>{
    const original=fixture(),r=fixture('UNLINK',original);await expect(verify(r)).resolves.toEqual(r);
    for(const change of [p=>p.previousHash=sha,p=>p.selection.associationId='d145d52b-922a-40eb-936f-9b8bc0a0ee33',p=>p.source=original.event.preview.source,p=>p.origin.poolId=3,p=>p.original=clone(r)]){const changed=clone(r);change(changed.event.preview);await expect(verify(rehash(changed))).rejects.toThrow();}
    expect(original).toEqual(fixture());
  });
  it('binds author, decision date, original body and confirmation date',async()=>{
    for(const change of [r=>r.event.owner='ADMIN:2',r=>r.event.createdAt='2008-07-01T00:00:00.000Z',r=>r.receipt.confirmedAt='2008-07-12T12:00:00.000Z',r=>r.receipt.resourceId=2,r=>r.receipt.scope='REMINDER_RESOURCES',r=>r.event.reason='Motivo alterado']){const r=fixture();change(r);await expect(verify(rehash(r))).rejects.toThrow();}
  });
  it('checks the complete journal and blocks duplicate, reordered, orphan and changed receipts',async()=>{
    const a=fixture(),b=fixture('UNLINK',a),row=(r,id)=>({id,scope:rules.scope,resourceId:1,owner,requestId:r.envelope.requestId,payloadHash:r.receipt.payloadHash,response:r});
    async function read(rows){return history.journal({fieldWriteRequest:{findMany:async()=>rows}},1);}
    const valid=await read([row(a,1),row(b,2)]);expect(valid.valid).toBe(true);expect(valid.active).toBeNull();expect(valid.records[0].result).toEqual(a);expect(valid.records[0].state).toBe('VOIDED');
    for(const rows of [[row(a,1),row(a,2)],[row(b,1)],[row(b,1),row(a,2)],[{...row(a,1),payloadHash:sha}],[{...row(a,1),requestId:b.envelope.requestId}]])expect((await read(rows)).valid).toBe(false);
    expect((await read([row(a,1)])).active.id).toBe(a.event.id);
  });
});
