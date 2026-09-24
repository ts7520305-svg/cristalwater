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

const ownRules=require('../frontend/cw-reminder-visit-resource-rules'),ownHistory=require('../src/services/reminderVisitResourceJournal');
function ownFixture(){
  const association=fixture(),p=association.event.preview;
  const selection={action:'DECLARE',recordId:null,data:{technicianId:3,materials:{mode:'DECLARED',items:[{productName:'SAL',unit:'KG',quantity:'0.333333'}]},workTime:{startedAt:'2008-07-11T10:10:00.000Z',endedAt:'2008-07-11T10:20:00.000Z'}}};
  const peers=[{type:'EQUIPMENT',id:1,reminderId:null,hash:sha,materials:{mode:'DECLARED',items:[{productName:'SAL',unit:'KG',quantity:'0.666667'}]},workTime:{startedAt:p.parent.startAt,endedAt:'2008-07-11T10:10:00.000Z'}}];
  const movements=[{id:1,productId:null,productName:'SAL',unit:'KG',quantity:'1.25',movementType:'CONSUMPTION',visitId:null,extraVisitId:1,poolId:4,clientId:2,technicianId:3,createdAt:p.parent.startAt},{id:2,productId:null,productName:'SAL',unit:'KG',quantity:'0.25',movementType:'RETURN',visitId:null,extraVisitId:1,poolId:4,clientId:2,technicianId:3,createdAt:p.parent.endAt}];
  const value={schema:1,basis:ownRules.basis,reminderId:1,selection,contextHash:sha,previousHash:null,origin:{...p.origin,visitType:'EXTRA',visitId:1,associationId:association.event.id},association,parent:p.parent,peers,movements,comparison:{materials:[{...selection.data.materials.items[0],visitQuantity:'1',reservedQuantity:'0.666667',remainingQuantity:'0'}],durationSeconds:600},affectedShares:[],original:null};
  const preview={available:true,...value,hash:hash(value)},body={requestId:'d145d52b-922a-40eb-936f-9b8bc0a0ee44',...selection,previewHash:preview.hash,reason:'Parcelas próprias conferidas',confirmed:true};
  const event={schema:1,basis:ownRules.basis,id:body.requestId,owner,reminderId:1,reason:body.reason,createdAt:'2008-07-14T12:00:00.000Z',preview},receipt={...writes.context({id:1,role:'ADMIN'},ownRules.scope,1,body.requestId,(({requestId,...v})=>v)(body)),confirmedAt:event.createdAt};
  return {ok:true,applied:true,envelope:body,event,eventHash:hash(event),receipt};
}
function ownRehash(r){const p=r.event.preview;p.hash=hash(ownRules.facts(p));r.envelope={...r.envelope,...p.selection,previewHash:p.hash};r.eventHash=hash(r.event);r.receipt.payloadHash=writes.context({id:1,role:'ADMIN'},ownRules.scope,1,r.envelope.requestId,(({requestId,...v})=>v)(r.envelope)).payloadHash;return r;}
const ownVerify=r=>ownRules.response(r,r.envelope,owner,1,hash);
const costRules=require('../frontend/cw-reminder-visit-cost-rules'),materialRules=require('../frontend/cw-maintenance-material-rules');
async function costFixture(kind='MATERIAL',resource=ownFixture()){
  const p=resource.event.preview,d=p.selection.data;
  const a={id:8,expenseId:9,monthRef:'2008-07',amountCents:100,targetType:'EXTRA',clientId:2,visitId:null,extraVisitId:1,repairId:null,maintenanceCompletionId:null,serviceReminderId:null,targetSnapshot:{startAt:p.parent.startAt,endAt:p.parent.endAt},voidedAt:null,valuationType:kind,quantity:kind==='MATERIAL'?'1':'3600',quantityUnit:kind==='MATERIAL'?'KG':'SECOND',purchaseItemId:kind==='MATERIAL'?7:null,valuationSnapshot:{source:{service:{technicianId:3},item:{id:7,productName:'SAL'}}}};
  const source={schema:1,basis:'CURRENT_ASSOCIATED_REMINDER_RESOURCES',resourceId:resource.event.id,resourceHash:resource.eventHash,parent:p.parent,peers:p.peers,movements:p.movements,comparison:ownRules.compare(d,p.parent,p.peers,p.movements)};
  const base={version:p.schema+1,basis:kind==='MATERIAL'?materialRules.basis:'CONFIRMED_PARENT_COST_TIME_SHARE',expenseId:9,expenseVersion:1,allocationId:8,completionId:null,reminderId:1,monthRef:'2008-07',allocationBefore:a,allocationHash:hash(a),resources:resource,resourcesHash:resource.eventHash,resourceSource:source,resourceSourceHash:hash(source),target:await costRules.target(resource,hash,'Cliente histórico')};
  if(kind==='MATERIAL')Object.assign(base,{parentQuantity:'1',quantity:'0.333333',material:{productName:'SAL',unit:'KG',declaredQuantity:'0.333333'},used:{quantity:'0',amountCents:0,shares:[]},maintenanceUsed:{quantity:'0',shares:[]},materials:d.materials,materialsHash:hash(d.materials)});
  else {const w=costRules.workRecord(d,p.origin);Object.assign(base,{parentDurationMs:3600000,used:{durationMs:0,amountCents:0,shares:[]},workTime:w,workTimeHash:hash(w)});}
  Object.assign(base,kind==='MATERIAL'?materialRules.calculation(100,'1',base.used,base.maintenanceUsed,'0.333333','0.333333'):costRules.timeCalculation(100,3600000,base.used,base.workTime.durationMs));
  return {available:true,...base,hash:hash(base)};
}
const costRehash=p=>{const {available,hash:signature,...v}=p;p.hash=hash(v);return p;};
describe('associated reminder financial conservation',()=>{
  it('verifies original resource receipts and both cost calculations identically in Node and browser',async()=>{
    const c=vm.createContext({});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-reminder-resource-rules','cw-reminder-visit-rules','cw-reminder-visit-resource-rules','cw-reminder-visit-cost-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);
    for(const kind of ['MATERIAL','LABOR']){const p=await costFixture(kind);expect(clone(await c.CWReminderVisitCostRules.verify(p,hash))).toEqual(await costRules.verify(p,hash));expect(p.amountCents).toBe(kind==='MATERIAL'?33:17);}
    expect(await materialRules.verify(await costFixture(),hash)).toEqual(await costFixture());
  });
  it('keeps equipment and reminder identities distinct even when numeric ids coincide',()=>{
    expect(costRules.identity({completionId:1})).not.toBe(costRules.identity({completionId:null,reminderId:1}));expect(costRules.selection({completionId:null,reminderId:1})).toEqual({reminderId:1});expect(costRules.matchesRequest({completionId:null,reminderId:1},{reminderId:'1'})).toBe(false);expect(costRules.matchesRequest({completionId:null,reminderId:1},{reminderId:1,completionId:1})).toBe(false);
  });
  it('rejects rehashed parent, recipient, technician, quantity and expense substitutions',async()=>{
    for(const change of [p=>p.reminderId=2,p=>p.completionId=1,p=>p.allocationBefore.targetType='REGULAR',p=>p.allocationBefore.valuationSnapshot.source.service.technicianId=4,p=>p.allocationBefore.clientId=3,p=>p.resourceSource.parent.endAt='2008-07-11T11:01:00.000Z',p=>p.material.declaredQuantity='1',p=>p.quantity='1',p=>p.target.snapshot.originVisitId=9,p=>p.expenseId=10]){const p=await costFixture();change(p);p.allocationHash=hash(p.allocationBefore);p.resourceSourceHash=hash(p.resourceSource);await expect(costRules.verify(costRehash(p),hash)).rejects.toThrow();}
  });
  it('rejects altered embedded originals, independent receipts, overdrawn budgets and double time inheritance',async()=>{
    for(const change of [p=>p.resources.receipt.scope='REMINDER_RESOURCES',p=>p.resources.event.preview.selection.data.workTime.endedAt=p.resourceSource.parent.endAt,p=>p.used.amountCents=100,p=>p.used.durationMs=3600000,p=>p.workTime.durationMs=3600000,p=>p.amountCents=100]){const p=await costFixture('LABOR');change(p);p.workTimeHash=hash(p.workTime);await expect(costRules.verify(costRehash(p),hash)).rejects.toThrow();}
  });
  it('conserves cents on the final shared duration and refuses non-positive and excessive parts',()=>{
    const first=costRules.timeCalculation(100,3,{durationMs:0,amountCents:0},1),second=costRules.timeCalculation(100,3,{durationMs:1,amountCents:first.amountCents},1),last=costRules.timeCalculation(100,3,{durationMs:2,amountCents:first.amountCents+second.amountCents},1);
    expect([first.amountCents,second.amountCents,last.amountCents]).toEqual([33,33,34]);expect(last.remainingAmountCents).toBe(0);expect(costRules.timeCalculation(1,100,{durationMs:0,amountCents:0},1)).toBeNull();expect(costRules.timeCalculation(100,3,{durationMs:3,amountCents:100},1)).toBeNull();
  });
});
describe('associated reminder resource conservation',()=>{
  it('conserves six decimal quantities after returns and adjacent work periods in Node and browser',async()=>{
    const r=ownFixture();await expect(ownVerify(r)).resolves.toEqual(r);
    const c=vm.createContext({});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-reminder-resource-rules','cw-reminder-visit-rules','cw-reminder-visit-resource-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);
    expect(clone(await c.CWReminderVisitResourceRules.response(r,r.envelope,owner,1,hash))).toEqual(r);
  });
  it('rejects rehashed over-allocation, wrong parent types, changed origins and duplicate movements',async()=>{
    for(const change of [p=>p.selection.data.materials.items[0].quantity='0.333334',p=>p.selection.data.materials.items[0].unit='kg',p=>p.movements[0].visitId=1,p=>p.movements[0].extraVisitId=null,p=>p.movements[1].quantity='0.5',p=>p.movements[0].clientId=9,p=>p.movements.push(clone(p.movements[0])),p=>p.origin.associationId=p.peers[0].hash,p=>p.peers.push(clone(p.peers[0])),p=>p.comparison.materials[0].remainingQuantity='1']){const r=ownFixture();change(r.event.preview);await expect(ownVerify(ownRehash(r))).rejects.toThrow();}
  });
  it('rejects overlapping work, parent overrun, different technicians and double time inheritance',async()=>{
    for(const change of [p=>p.selection.data.workTime.startedAt=p.parent.startAt,p=>p.selection.data.workTime.endedAt='2008-07-11T11:00:01.000Z',p=>p.selection.data.technicianId=4,p=>p.selection.data.workTime.startedAt='2008-07-11T10:10:00.001Z',p=>p.comparison.durationSeconds=3600]){const r=ownFixture();change(r.event.preview);await expect(ownVerify(ownRehash(r))).rejects.toThrow();}
  });
  it('retains unknown resources separately from an explicit zero-material declaration',()=>{
    const r=ownFixture(),p=r.event.preview,d={technicianId:3,materials:null,workTime:p.selection.data.workTime};expect(ownRules.compare(d,p.parent,p.peers,[])).toEqual({materials:[],durationSeconds:600});
    expect(ownRules.compare({...d,materials:{mode:'NONE',items:[]},workTime:null},p.parent,p.peers,[])).toEqual({materials:[],durationSeconds:null});expect(()=>ownRules.compare({...d,workTime:null},p.parent,[],[])).toThrow();
  });
  it('keeps reservations blocked on duplicated or corrupted original receipts',async()=>{
    const r=ownFixture(),row={resourceId:1,owner,requestId:r.event.id,payloadHash:r.receipt.payloadHash,response:r};
    for(const rows of [[row,row],[{...row,payloadHash:sha}]])expect((await ownHistory.journal({fieldWriteRequest:{findMany:async()=>rows}},1)).valid).toBe(false);
    expect((await ownHistory.journal({fieldWriteRequest:{findMany:async()=>[row]}},1)).active.id).toBe(r.event.id);
  });
});

function multiFixture(){
  const r=ownFixture(),p=r.event.preview,d=p.selection.data;
  d.workIntervals=[d.workTime,{startedAt:'2008-07-11T10:40:00.000Z',endedAt:'2008-07-11T10:50:00.000Z'}];delete d.workTime;
  p.schema=2;r.event.schema=2;p.comparison=ownRules.compare(d,p.parent,p.peers,p.movements);return ownRehash(r);
}
describe('multiple own intervals in an associated reminder',()=>{
  it('verifies the exact intervals and their material/labor proofs in Node and browser',async()=>{
    const c=vm.createContext({});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-reminder-resource-rules','cw-reminder-visit-rules','cw-reminder-visit-resource-rules','cw-reminder-visit-cost-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);
    const r=multiFixture();expect(clone(await c.CWReminderVisitResourceRules.response(r,r.envelope,owner,1,hash))).toEqual(await ownVerify(r));expect(r.event.preview.comparison.durationSeconds).toBe(1200);
    for(const kind of ['MATERIAL','LABOR']){const p=await costFixture(kind,r);expect(p.version).toBe(3);expect(clone(await c.CWReminderVisitCostRules.verify(p,hash))).toEqual(await costRules.verify(p,hash));expect(p.amountCents).toBe(33);if(kind==='MATERIAL')expect(await materialRules.verify(p,hash)).toEqual(p);else {expect(p.workTime.intervals).toHaveLength(2);expect(p.workTime.durationMs).toBe(1200000);expect(p.workTime.startAt).toBeUndefined();}}
    const legacy=ownFixture();await expect(ownVerify(legacy)).resolves.toEqual(legacy);expect((await costFixture('LABOR')).workTime.schema).toBe(1);
  });
  it('rejects mixed shapes, empty, oversized, unsorted, duplicated and overlapping intervals',()=>{
    const d=multiFixture().event.preview.selection.data;
    const twenty=Array.from({length:20},(_,i)=>({startedAt:new Date(Date.parse(d.workIntervals[0].startedAt)+2000*i).toISOString(),endedAt:new Date(Date.parse(d.workIntervals[0].startedAt)+2000*i+1000).toISOString()}));
    expect(ownRules.resourceInput({...d,workIntervals:twenty}).workIntervals).toHaveLength(20);
    for(const changed of [{...d,workTime:null},{...d,workIntervals:[]},{...d,workIntervals:null},{...d,workIntervals:[...twenty,twenty[19]]},{...d,workIntervals:[...d.workIntervals].reverse()},{...d,workIntervals:[d.workIntervals[0],d.workIntervals[0]]},{...d,workIntervals:[{...d.workIntervals[0],startedAt:'2008-07-11T10:10:00.001Z'}]},{...d,workIntervals:[{...d.workIntervals[0],endedAt:d.workIntervals[0].startedAt}]}])expect(()=>ownRules.resourceInput(changed)).toThrow();
  });
  it('checks every interval against the parent and new peers while leaving gaps available',()=>{
    const p=multiFixture().event.preview,d=p.selection.data,peer={type:'REMINDER',id:'d145d52b-922a-40eb-936f-9b8bc0a0ee55',reminderId:2,hash:sha,materials:null,workIntervals:[{startedAt:'2008-07-11T10:20:00.000Z',endedAt:'2008-07-11T10:40:00.000Z'}]};
    expect(ownRules.compare(d,p.parent,[...p.peers,peer],p.movements).durationSeconds).toBe(1200);
    for(const w of [{...peer.workIntervals[0],endedAt:'2008-07-11T10:40:01.000Z'},{...peer.workIntervals[0],startedAt:'2008-07-11T10:19:59.000Z'}])expect(()=>ownRules.compare(d,p.parent,[{...peer,workIntervals:[w]}],p.movements)).toThrow();
    expect(()=>ownRules.compare({...d,workIntervals:[d.workIntervals[0],{...d.workIntervals[1],endedAt:'2008-07-11T11:00:01.000Z'}]},p.parent,p.peers,p.movements)).toThrow();
  });
  it('refuses rehashed costs that bill pauses, change one interval or downgrade a new proof',async()=>{
    for(const change of [p=>p.workTime.durationMs=2400000,p=>p.workTime.intervals[1].startAt=p.workTime.intervals[0].endAt,p=>p.version=2,p=>p.amountCents=67,p=>p.workTime.schema=1]){const p=await costFixture('LABOR',multiFixture());change(p);p.workTimeHash=hash(p.workTime);await expect(costRules.verify(costRehash(p),hash)).rejects.toThrow();}
    for(const change of [r=>r.event.schema=1,r=>r.event.preview.schema=1,r=>r.event.preview.comparison.durationSeconds=2400]){const r=multiFixture();change(r);await expect(ownVerify(ownRehash(r))).rejects.toThrow();}
  });
  it('keeps the complete multiple-interval original in an explicit void and the verified journal',async()=>{
    const original=multiFixture(),r=clone(original),p=r.event.preview;p.selection={action:'VOID',recordId:original.event.id,data:null};p.previousHash=original.eventHash;p.original=original;for(const k of ['association','parent','peers','movements','comparison'])p[k]=null;
    r.event.id=r.envelope.requestId=r.receipt.requestId='d145d52b-922a-40eb-936f-9b8bc0a0ee66';ownRehash(r);await expect(ownVerify(r)).resolves.toEqual(r);
    const rows=[original,r].map(v=>({resourceId:1,owner,requestId:v.event.id,payloadHash:v.receipt.payloadHash,response:v}));const s=await ownHistory.journal({fieldWriteRequest:{findMany:async()=>rows}},1);expect(s.valid).toBe(true);expect(s.active).toBeNull();expect(s.records[0].result).toEqual(original);
    const broken=clone(r);broken.event.preview.original.event.preview.selection.data.workIntervals[1].startedAt=original.event.preview.selection.data.workIntervals[0].endedAt;await expect(ownVerify(ownRehash(broken))).rejects.toThrow();
  });
});
