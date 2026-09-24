import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { createHash, webcrypto } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),rules=require('../frontend/cw-equipment-history-rules'),r=require('../src/services/fieldWriteRequestService');
const at='2009-04-02T12:00:00.000Z',later='2009-04-03T12:00:00.000Z',uuid='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002';
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(){
  const source={id:1,planId:2,version:1,visitId:3,extraVisitId:null,requestId:uuid,actor:'ADMIN:5',fingerprint:createHash('sha256').update(JSON.stringify({pid:2,vid:3,expected:1,notes:'Histórico original',confirmed:true})).digest('hex'),notes:'Histórico original',completedAt:at,result:{ok:true,idempotent:false,plan:{id:2,poolId:6,version:2,title:'Revisão antiga'},completedAt:at}};
  const origin={visitType:'REGULAR',visitId:3,clientId:7,poolId:6,technicianId:4},original={id:1,planId:2,requestId:uuid,fingerprint:source.fingerprint,completedAt:at,resultHash:r.hash(source.result),receiptHash:r.hash([]),record:null};
  const facts={type:'MAINTENANCE_EQUIPMENT',id:1,clientId:7,poolId:6,status:'CONFIRMED',startAt:null,endAt:at,executionBasis:'CONFIRMED_MAINTENANCE_EXECUTION_AND_DECISION',decisionId:9,decisionFingerprint:'a'.repeat(64),executionFingerprint:'b'.repeat(64),originVisitType:'REGULAR',originVisitId:3};
  const target={type:facts.type,id:1,clientId:7,valid:true,hash:r.hash(facts),snapshot:{...facts,label:'Histórico',clientName:'Cliente'}};
  const parent={type:'REGULAR',id:3,clientId:7,poolId:6,technicianId:4,status:'DONE',startAt:'2009-04-02T11:00:00.000Z',endAt:'2009-04-02T13:00:00.000Z'},record={schema:1,basis:rules.recordBasis,origin,evidence:'Ordem de serviço n.º 10 conferida no arquivo.'};
  const value={schema:1,basis:rules.basis,completionId:1,origin,original,baseHash:r.hash(original),source,sourceHash:r.hash(source),parent,target,targetHash:target.hash,previous:{headHash:null,action:'ORIGINAL',record:null},proposed:{action:'REPLACE',record},beforeState:'MISSING',afterState:'ATTESTED',afterReasons:[],affectedShares:[]};
  const p={available:true,...value,hash:r.hash(value)},body={requestId,action:'REPLACE',originReview:rules.asInput(record),previewHash:p.hash,reason:'Conferência explícita do arquivo',confirmed:true},revision={schema:1,id:requestId,owner:'ADMIN:5',completionId:1,reason:body.reason,createdAt:later,preview:p},request=r.context({id:5,role:'ADMIN'},rules.scope,1,requestId,(({requestId,...v})=>v)(body));
  const response={ok:true,applied:true,envelope:body,revision,revisionHash:r.hash(revision),receipt:{...request,confirmedAt:later}};return {source,p,body,response};
}
function rehash(p){p.baseHash=r.hash(p.original);p.sourceHash=r.hash(p.source);p.hash=r.hash(rules.facts(p));return p;}
describe('explicit administrative equipment historical review',()=>{
  it('recognizes the exact original legacy fingerprint without manufacturing a technical receipt',async()=>{
    const f=fixture();expect(await rules.legacy(f.source)).toBe(true);expect(await rules.preview(f.p,r.hash)).toBe(f.p);expect(await rules.response(f.response,f.body,'ADMIN:5',1,r.hash)).toBe(f.response);expect(f.p.original.receiptHash).toBe(r.hash([]));expect(f.response.receipt.scope).not.toBe('EQUIPMENT_MAINTENANCE');
  });
  it('refuses modern or damaged records, mismatching typed origins and invalid original fingerprints',async()=>{
    for(const change of [s=>s.result.applied=true,s=>s.result.receipt={},s=>s.result.completion={},s=>s.fingerprint='f'.repeat(64),s=>s.visitId=4,s=>s.extraVisitId=3,s=>s.result.plan.version=1,s=>s.result.completedAt=later,s=>s.notes='Outro histórico',s=>s.result.idempotent=true]){const f=fixture();change(f.source);expect(await rules.legacy(f.source)).toBe(false);}
  });
  it('requires evidence and an explicit technician, refusing empty or excessive declarations',()=>{
    for(const input of [{technicianId:0,evidence:'Evidência suficiente'},{technicianId:4,evidence:'curto'},{technicianId:4,evidence:' texto com espaço '},{technicianId:'4',evidence:'Evidência suficiente'},{technicianId:4,evidence:'x'.repeat(2001)},{technicianId:4,evidence:'Evidência suficiente',extra:true}])expect(()=>rules.input(input)).toThrow();
    expect(()=>rules.command({...fixture().body,confirmed:false})).toThrow();
  });
  it('rejects rehashed contradictions in the original, recipient, evidence and parent source',async()=>{
    for(const change of [p=>p.original.receiptHash='a'.repeat(64),p=>p.original.record={},p=>p.original.id=2,p=>p.origin.technicianId=9,p=>p.proposed.record.origin.clientId=9,p=>p.proposed.record.evidence='',p=>p.parent.status='CANCELLED',p=>p.parent.endAt=p.parent.startAt,p=>p.target.valid=false,p=>p.previous.action='REPLACE',p=>p.affectedShares=[{}],p=>p.afterState='RECORDED']){const p=clone(fixture().p);change(p);await expect(rules.preview(rehash(p),r.hash)).rejects.toThrow();}
  });
  it('binds every administrative receipt to its account, operation and original preview',async()=>{
    const f=fixture();for(const [owner,id] of [['ADMIN:6',1],['ADMIN:5',2]])await expect(rules.response(f.response,f.body,owner,id,r.hash)).rejects.toThrow();
    const v=clone(f.response);v.revision.reason='Outro motivo';v.revisionHash=r.hash(v.revision);await expect(rules.response(v,f.body,'ADMIN:5',1,r.hash)).rejects.toThrow();
    const saved=clone(f.response);saved.revision.createdAt='2008-01-01T00:00:00.000Z';saved.revisionHash=r.hash(saved.revision);await expect(rules.response(saved,f.body,'ADMIN:5',1,r.hash)).rejects.toThrow();
  });
  it('uses the same source and response verifier in browser and Node',async()=>{
    const c=vm.createContext({crypto:webcrypto,TextEncoder});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-equipment-history-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);
    const f=fixture();expect(await c.CWEquipmentHistoryRules.legacy(f.source)).toBe(true);expect(clone(await c.CWEquipmentHistoryRules.response(f.response,f.body,'ADMIN:5',1,r.hash))).toEqual(f.response);
  });
});

const materialReview=require('../frontend/cw-equipment-material-review-rules'),materials=require('../src/services/equipmentMaterialsService');
function materialFixture(){
  const f=fixture(),originReview={revision:f.response.revision,hash:f.response.revisionHash},input={mode:'DECLARED',items:[{productName:'CLORO',unit:'KG',quantity:'0.1'}]};
  const proposed=materials.create(input,{id:3,clientId:7,poolId:6,technicianId:4},'REGULAR',originReview.hash);
  const value={schema:2,basis:materialReview.basis,completionId:1,origin:proposed.origin,original:f.p.original,baseHash:f.p.baseHash,originReview,previous:{headHash:null,action:'ORIGINAL',record:null},proposed:{action:'REPLACE',record:proposed},targetHash:f.p.targetHash,sourceHash:'c'.repeat(64),beforeState:'MISSING',afterState:'MATCHED',afterReasons:[],affectedShares:[]};
  return {...value,available:true,hash:r.hash(value)};
}
const materialHash=p=>({...p,hash:r.hash(materialReview.facts(p))});
describe('historical equipment material dependency proofs',()=>{
  it('binds the later declaration to a separate administrative origin without altering its original',async()=>{
    const p=materialFixture(),original=clone(p.original);expect(await materialReview.preview(p,r.hash)).toBe(p);expect(materials.sound(p.proposed.record)).toBe(true);expect(p.original).toEqual(original);expect(p.original.record).toBe(null);expect(p.original.receiptHash).toBe(r.hash([]));
  });
  it('rejects missing or incompatible attestation and record bindings even after rehashing',async()=>{
    for(const change of [p=>delete p.originReview,p=>p.schema=1,p=>p.proposed.record.schema=1,p=>delete p.proposed.record.originReviewHash,p=>p.proposed.record.originReviewHash='a'.repeat(64),p=>p.targetHash='e'.repeat(64),p=>p.origin.technicianId=99,p=>p.originReview.revision.preview.proposed.record.evidence='']){const p=materialFixture();change(p);await expect(materialReview.preview(materialHash(p),r.hash)).rejects.toThrow();}
  });
  it('allows explicit withdrawal with the previous origin proof after the current technician changes',async()=>{
    const p=materialFixture();p.previous={headHash:'d'.repeat(64),action:'REPLACE',record:p.proposed.record};p.proposed={action:'WITHDRAW',record:null};p.origin={...p.origin,technicianId:99};p.beforeState='REVIEW';p.afterState='WITHDRAWN';expect(await materialReview.preview(materialHash(p),r.hash)).toBeTruthy();p.previous.record.originReviewHash='f'.repeat(64);await expect(materialReview.preview(materialHash(p),r.hash)).rejects.toThrow();
  });
  it('keeps modern declarations on their original schema without a historical marker',async()=>{
    const p=materialFixture();p.schema=1;delete p.originReview;delete p.proposed.record.originReviewHash;p.proposed.record.schema=1;expect(await materialReview.preview(materialHash(p),r.hash)).toBeTruthy();expect(materials.sound(p.proposed.record)).toBe(true);p.proposed.record.extra=true;expect(materials.sound(p.proposed.record)).toBe(false);
  });
  it('requires a new resource record when the origin evidence changes even with identical quantities',async()=>{
    const p=materialFixture(),old=clone(p.proposed.record);p.originReview.revision.reason='Consulta suplementar do arquivo';p.originReview.hash=r.hash(p.originReview.revision);p.previous={headHash:'d'.repeat(64),action:'REPLACE',record:old};p.proposed.record.originReviewHash=p.originReview.hash;p.beforeState='REVIEW';const checked=await materialReview.preview(materialHash(p),r.hash);expect(checked.previous.record.items).toEqual(checked.proposed.record.items);expect(checked.previous.record.originReviewHash).not.toBe(checked.proposed.record.originReviewHash);
  });
  it('verifies the full nested historical material proof in the browser too',async()=>{
    const c=vm.createContext({crypto:webcrypto,TextEncoder});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-equipment-history-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);const p=materialFixture();expect(clone(await c.CWEquipmentMaterialReviewRules.preview(p,r.hash))).toEqual(p);
  });
});

const timeReview=require('../frontend/cw-equipment-time-review-rules'),timeSource=require('../src/services/equipmentWorkTimeService');
function historicalTimeFixture(multiple=true){
  const f=fixture(),originReview={revision:f.response.revision,hash:f.response.revisionHash},visit={id:3,clientId:7,poolId:6,technicianId:4,startAt:new Date(f.p.parent.startAt)},one={startAt:f.p.parent.startAt,endAt:'2009-04-02T11:00:00.001Z'},record=timeSource.create(multiple?{intervals:[one,{startAt:'2009-04-02T11:00:00.003Z',endAt:'2009-04-02T11:00:00.005Z'}]}:one,visit,'REGULAR',originReview.hash);
  const value={schema:2,basis:timeReview.basis,completionId:1,origin:f.p.origin,original:f.p.original,baseHash:f.p.baseHash,originReview,previous:{headHash:null,action:'ORIGINAL',record:null},proposed:{action:'REPLACE',record},targetHash:f.p.targetHash,sourceHash:'c'.repeat(64),beforeState:'MISSING',afterState:'RECORDED',afterReasons:[],affectedShares:[]};return {...value,available:true,hash:r.hash(value)};
}
const timeHash=p=>({...p,hash:r.hash(timeReview.facts(p))});
describe('historical equipment own work proof',()=>{
  it('conserves single/multiple input shapes and positive milliseconds with a separate origin proof',async()=>{
    for(const multi of [true,false]){const p=historicalTimeFixture(multi),w=p.proposed.record;expect(await timeReview.preview(p,r.hash)).toBe(p);expect(timeSource.sound(w)).toBe(true);expect(w.schema).toBe(3);expect(w.durationMs).toBe(multi?3:1);expect(Object.hasOwn(timeReview.asInput(w),'intervals')).toBe(multi);expect(p.original.record).toBe(null);}
  });
  it('refuses missing or substituted origin proofs and time outside the original completion',async()=>{
    for(const change of [p=>delete p.originReview,p=>p.schema=1,p=>p.proposed.record.originReviewHash='a'.repeat(64),p=>p.proposed.record.origin.technicianId=99,p=>p.targetHash='e'.repeat(64),p=>p.proposed.record.intervals[0].durationMs=2,p=>p.proposed.record.durationMs=4,p=>p.proposed.record.intervals[1].endAt='2009-04-03T11:00:00.005Z']){const p=historicalTimeFixture();change(p);await expect(timeReview.preview(timeHash(p),r.hash)).rejects.toThrow();}
  });
  it('allows a proved withdrawal after a technician change without manufacturing a zero-time record',async()=>{
    const p=historicalTimeFixture();p.previous={headHash:'d'.repeat(64),action:'REPLACE',record:p.proposed.record};p.proposed={action:'WITHDRAW',record:null};p.origin={...p.origin,technicianId:99};p.beforeState='REVIEW';p.afterState='WITHDRAWN';expect(await timeReview.preview(timeHash(p),r.hash)).toBeTruthy();p.previous.record.originReviewHash='f'.repeat(64);await expect(timeReview.preview(timeHash(p),r.hash)).rejects.toThrow();
  });
  it('binds the financial proof to both the time declaration and its commercial target',async()=>{
    const p=historicalTimeFixture(),e={schema:1,id:requestId,owner:'ADMIN:5',completionId:1,reason:'Conferência dos intervalos históricos',createdAt:later,preview:p},value={completionId:1,workTime:p.proposed.record,workTimeRevision:{revision:e,hash:r.hash(e)},target:{hash:p.targetHash}};expect(await timeReview.share(value,r.hash)).toBe(value);await expect(timeReview.share({...value,target:{hash:'f'.repeat(64)}},r.hash)).rejects.toThrow();e.createdAt=at;value.workTimeRevision.hash=r.hash(e);await expect(timeReview.share(value,r.hash)).rejects.toThrow();
  });
  it('reserves historical times conservatively when their origin is no longer current',()=>{
    const p=historicalTimeFixture(),row={id:1,result:{}},state={valid:true,headHash:'a'.repeat(64),action:'REPLACE',record:p.proposed.record,history:[{revision:{preview:p}}],originReview:p.originReview,originReviewValid:false,originOriginalValid:true};const view=timeSource.effective(row,{proofs:new Map(),revisions:new Map([[1,state]])});expect(view.valid).toBe(false);expect(view.had).toBe(true);expect(view.record.durationMs).toBe(3);state.originReviewValid=true;expect(timeSource.effective(row,{proofs:new Map(),revisions:new Map([[1,state]])}).valid).toBe(true);
  });
  it('uses the same historical time verifier in browser and Node',async()=>{
    const c=vm.createContext({crypto:webcrypto,TextEncoder});for(const name of ['cw-maintenance-material-rules','cw-equipment-material-review-rules','cw-equipment-history-rules','cw-equipment-time-review-rules'])vm.runInContext(fs.readFileSync(new URL('../frontend/'+name+'.js',import.meta.url),'utf8'),c);const p=historicalTimeFixture();expect(clone(await c.CWEquipmentTimeReviewRules.preview(p,r.hash))).toEqual(p);
  });
});
