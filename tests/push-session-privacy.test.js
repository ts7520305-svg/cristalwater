import {afterEach,describe,it,expect,vi} from 'vitest';
const service=require('../frontend/cw-push-session');
const data={owner:'TECHNICIAN:41',title:'Piscina confidencial',body:'Cliente e código privados'};
describe('push privacy after account changes',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('shows detail only for the matching local account',()=>{expect(service.presentation(data,{known:true,owner:'TECHNICIAN:41'})).toEqual({title:data.title,body:data.body});});
 it.each([null,'TECHNICIAN:42','ADMIN:41'])('suppresses old notifications for local owner %s',owner=>{expect(service.presentation(data,{known:true,owner})).toBeNull();});
 it('uses generic content for missing identity or legacy payloads',()=>{
  for(const message of [service.presentation(data,{known:false}),service.presentation({...data,owner:undefined},{known:true,owner:'TECHNICIAN:41'})]){expect(message.body).not.toContain('Cliente');expect(message.title).not.toContain('confidencial');}
 });
 it('removes a stale identity if a local write fails',async()=>{
  let stored={known:true,owner:'TECHNICIAN:41'};
  vi.stubGlobal('caches',{open:async()=>({put:async()=>{throw new Error('Quota');},delete:async()=>{stored=null;},match:async()=>stored?{json:async()=>stored}:null})});
  await expect(service.sync(()=>null)).rejects.toThrow('Quota');expect(await service.read()).toEqual({known:false});expect(service.presentation(data,await service.read()).body).not.toContain('privados');
 });
 it('falls back to generic content when the local store cannot be read',async()=>{
  vi.stubGlobal('caches',{open:async()=>{throw new Error('Unavailable');}});expect(await service.read()).toEqual({known:false});expect(service.presentation(data,await service.read()).title).not.toContain('confidencial');
 });
});

describe('service worker notification filtering',()=>{
 it('applies recipient filtering before showing a notification',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  for(const [state,expected] of [[{known:true,owner:'TECHNICIAN:41'},'detail'],[{known:true,owner:'TECHNICIAN:42'},'none'],[{known:true,owner:null},'none'],[{known:false},'generic']]){
   const handlers={},shown=[];let work;
   const context={URL,location:{origin:'https://field.example.test'},registration:{showNotification:async(title,options)=>shown.push({title,...options})},addEventListener:(type,handler)=>{handlers[type]=handler;},importScripts:()=>{context.CWPushSession={read:async()=>state,presentation:service.presentation};}};
   context.self=context;
   vm.runInNewContext(fs.readFileSync(require.resolve('../frontend/sw.js'),'utf8'),context);
   handlers.push({data:{json:()=>({...data,url:'/technician-field-mode'})},waitUntil:promise=>{work=promise;}});await work;
   expect(shown.length).toBe(expected==='none'?0:1);
   if(expected==='detail')expect(shown[0].body).toBe(data.body);
   if(expected==='generic'){expect(shown[0].body).not.toContain('privados');expect(shown[0].data.url).toBe('https://field.example.test/login');}
  }
 });
});
