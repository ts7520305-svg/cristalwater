import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,randomUUID} from 'node:crypto';
const source=fs.readFileSync(new URL('../frontend/cw-field-reminders.js',import.meta.url),'utf8');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function fixture(){
  const values=new Map(),gate=deferred(),pumpReached=deferred(),session={owner:'TECH:41',technicianId:41,token:'test-token'},key='cwFieldReminders:v1:TECH:41',posts=[];
  const payload={visitType:'REGULAR',visitId:5,poolId:9,clientId:3,dueAt:'2030-01-01T12:00:00.000Z',note:'',flowState:'FULL',openedAt:'2030-01-01T11:00:00.000Z'},localId=randomUUID(),pending={...payload,kind:'WATER_OPEN',localId,payload,payloadHash:hash({kind:'WATER_OPEN',...payload}),owner:session.owner,status:'OPEN',syncError:'Pendente'};
  values.set(key,JSON.stringify({['WATER_OPEN:'+localId]:pending}));
  let queued=true,pumpCount=0,saved,activeRequests=0,maxRequests=0,same=true;
  const c=vm.createContext({console,Date,crypto:{randomUUID},AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},Event:class{constructor(type){this.type=type;}},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},navigator:{onLine:true,locks:{request:async(name,options,callback)=>typeof options==='function'?options():callback({name})}},fetch:async(url,options)=>{
    activeRequests++;maxRequests=Math.max(maxRequests,activeRequests);
    try{
      if(options.method==='GET'){
        if(url.endsWith('/pump-reminders')&&++pumpCount===1){pumpReached.resolve();await gate.promise;}
        return {status:200,json:async()=>({ok:true,reminders:saved&&url.endsWith('/water-reminders')?[saved]:[]})};
      }
      posts.push(url);if(queued)return {status:202,json:async()=>({ok:true,offline:true})};
      if(url.endsWith('/water-reminders')){const body=JSON.parse(options.body);saved={id:7,poolId:9,clientId:3,sourceKey:'water:TECH:41:'+localId,assignedToTechnicianId:41,isCompleted:false,dueDate:payload.dueAt,createdAt:payload.openedAt,metadata:{...body,payloadHash:pending.payloadHash}};}
      if(url.endsWith('/close'))saved.isCompleted=true;
      return {status:200,json:async()=>({ok:true,reminder:saved})};
    }finally{activeRequests--;}
  }});
  c.window=c;c.addEventListener=()=>{};c.dispatchEvent=()=>{};c.CWFieldWriteStore={session:()=>session,same:()=>same,hash:async v=>hash(v)};
  vm.runInContext(source,c);await pumpReached.promise;
  return {api:c.CWFieldReminders,localId,posts,gate,online:()=>{queued=false;},invalidate:()=>{same=false;},row:()=>Object.values(JSON.parse(values.get(key)))[0],max:()=>maxRequests};
}
describe('field reminder sync requested during an active pass',()=>{
  it('drains a close requested after the water queue was already visited',async()=>{
    const f=await fixture();f.online();await f.api.mark('WATER_OPEN',f.localId,'close');const sync=f.api.sync();f.gate.resolve();await sync;
    expect(f.row().closeSyncedAt).toBeTruthy();expect(f.row().syncError).toBe('');expect(f.posts).toEqual(['/api/technician/water-reminders','/api/technician/water-reminders','/api/technician/water-reminders/7/close']);expect(f.max()).toBe(1);
  });
  it('coalesces concurrent sync callers without duplicating the close',async()=>{
    const f=await fixture();f.online();await f.api.mark('WATER_OPEN',f.localId,'close');const calls=Array.from({length:5},()=>f.api.sync());expect(calls.every(p=>p===calls[0])).toBe(true);f.gate.resolve();await Promise.all(calls);expect(f.posts.filter(p=>p.endsWith('/close'))).toHaveLength(1);expect(f.max()).toBe(1);
  });
  it('keeps the local close pending if the account changes during the active pass',async()=>{
    const f=await fixture();await f.api.mark('WATER_OPEN',f.localId,'close');const sync=f.api.sync();f.invalidate();f.gate.resolve();await expect(sync).rejects.toThrow('sessão mudou');expect(f.row().status).toBe('CLOSED');expect(f.row().closeSyncedAt).toBeUndefined();expect(f.posts.filter(p=>p.endsWith('/close'))).toHaveLength(0);
  });
});
