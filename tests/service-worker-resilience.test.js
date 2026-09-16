import {describe,it,expect,vi} from 'vitest';
const fs=require('node:fs'),vm=require('node:vm');
function worker({cache={},open,fetch=async()=>new Response('current')}={}){
 const handlers={},pending=[];
 const context={URL,Response,fetch,caches:{open:open||(async()=>cache)},location:{origin:'https://field.test'},importScripts:()=>{},skipWaiting:vi.fn(),addEventListener:(type,handler)=>handlers[type]=handler};
 context.self=context;
 vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/sw.js'),'utf8'),context);
 function request(path='/technician-field-mode',method='GET'){
  let result;
  handlers.fetch({request:{url:new URL(path,context.location.origin).href,method,mode:'navigate'},respondWith:p=>result=p,waitUntil:p=>pending.push(p)});
  return result;
 }
 return {context,handlers,pending,request};
}
describe('field service worker storage resilience',()=>{
 it('returns fresh network content even when cache writes fail',async()=>{
  const w=worker({cache:{put:async()=>{throw Error('Quota');},match:async()=>new Response('stale')}});
  expect(await (await w.request()).text()).toBe('current');await Promise.all(w.pending);
 });
 it('keeps working online when CacheStorage cannot open',async()=>{
  const w=worker({open:async()=>{throw Error('Storage unavailable');}});
  expect(await (await w.request()).text()).toBe('current');await Promise.all(w.pending);
 });
 it('does not hold a network response behind a slow cache write',async()=>{
  let finish;const held=new Promise(r=>finish=r);
  const w=worker({cache:{put:()=>held}});
  expect(await (await w.request()).text()).toBe('current');finish();await Promise.all(w.pending);
 });
 it('serves the stored page offline, ignoring navigation query parameters',async()=>{
  const match=vi.fn(async()=>new Response('offline page'));
  const w=worker({cache:{match},fetch:async()=>{throw Error('Offline');}});
  expect(await (await w.request('/technician-field-mode?visit=3')).text()).toBe('offline page');
  expect(match.mock.calls[0][1]).toEqual({ignoreSearch:true});
 });
 it.each(['open','match'])('provides a clear offline response when %s fails',async failure=>{
  const fail=async()=>{throw Error('Unavailable');};
  const w=worker({open:failure==='open'?fail:undefined,cache:{match:fail},fetch:fail});
  const response=await w.request();expect(response.status).toBe(503);expect(await response.text()).toContain('sem ligação');
 });
 it('preserves server errors instead of masking them with a cached success',async()=>{
  const put=vi.fn(),w=worker({cache:{put,match:async()=>new Response('stale')},fetch:async()=>new Response('Unavailable',{status:503})});
  expect((await w.request()).status).toBe(503);expect(put).not.toHaveBeenCalled();
 });
 it('leaves operational API requests, uploads and writes outside the public cache',()=>{
  const w=worker();
  for(const [url,method] of [['/api/visits','GET'],['/uploads/photo.jpg','GET'],['/technician-field-mode','POST'],['https://external.test/','GET']])expect(w.request(url,method)).toBeUndefined();
 });
 it('does not activate a replacement worker with an incomplete offline shell',async()=>{
  const w=worker({cache:{add:async url=>{if(url==='/cw-auth.js')throw Error('Download failed');}}});let install;
  w.handlers.install({waitUntil:p=>install=p});await expect(install).rejects.toThrow('Download failed');expect(w.context.skipWaiting).not.toHaveBeenCalled();
 });
 it('activates the replacement after the whole shell is available',async()=>{
  const add=vi.fn(async()=>{}),w=worker({cache:{add}});let install;
  w.handlers.install({waitUntil:p=>install=p});await install;
  expect(add).toHaveBeenCalledWith('/cw-field-offline.js');expect(add).toHaveBeenCalledWith('/cw-field-write-store.js');expect(add).toHaveBeenCalledWith('/logo-cristalwater.png');expect(w.context.skipWaiting).toHaveBeenCalledOnce();
 });
});
