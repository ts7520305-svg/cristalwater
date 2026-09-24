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
