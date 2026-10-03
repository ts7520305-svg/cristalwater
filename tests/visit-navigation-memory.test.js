import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../frontend/ui/core/navigation-context.js', import.meta.url), 'utf8');
const legacy = 'cw:ctx:/technician-visit';
const ownerA = 'TECHNICIAN:TECH:12:TECH:12', ownerB = 'TECHNICIAN:USER:12:TECH:12';
const key = (owner = ownerA, visitId = '7') => legacy + ':v1:' + encodeURIComponent(owner) + ':' + visitId;
const snapshot = (owner = ownerA, visitId = '7') => JSON.stringify({version:1,owner,visitId,fields:{notes:'private A',cleaned:true,photo:'forbidden',password:'forbidden'},scrollY:120});
function harness(storage = new Map(), pathname = '/technician-visit') {
  const listeners = {}, frames = [], scrolls = [];
  let current = {owner:ownerA,visitId:'7'}, ready = false;
  const nodes = Object.fromEntries(['notes','cleaned','photo','password','managed','cwLanguageSelect'].map(id => [id,{id,name:id,type:id==='cleaned'?'checkbox':id==='photo'?'file':id==='password'?'password':'text',value:'',checked:false,closest:selector=>id==='managed'||(id==='cwLanguageSelect'&&selector.includes('.cw-lang-switch'))?{}:null,addEventListener(event, fn){this[event]=()=>fn({target:this});}}]));
  const listen = (event,fn) => (listeners[event] ||= []).push(fn);
  const window = {location:{pathname,origin:'https://qa.local'},history:{length:1},scrollY:0,addEventListener:listen,CWVisitNavigationMemory:{scope:()=>ready?current:null},scrollTo:value=>scrolls.push(value)};
  const document = {referrer:'',addEventListener:listen,querySelectorAll:()=>Object.values(nodes),getElementById:id=>nodes[id]};
  vm.runInNewContext(source,{window,document,sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame:fn=>frames.push(fn),Date,Set,Number,encodeURIComponent});
  const fire = event => (listeners[event] || []).forEach(fn=>fn({target:{closest:()=>null}}));
  return {nodes,storage,fire,frames,scrolls,ready(){ready=true;fire('cw:visit-context-ready');},change(owner,visitId='7'){current={owner,visitId};},unready(){ready=false;},start(){fire('DOMContentLoaded');}};
}
describe('legacy visit navigation memory',()=>{
  it('waits for authorized visit data before recovering fields and scroll',()=>{
    const h=harness(new Map([[key(),snapshot()]]));h.start();expect(h.nodes.notes.value).toBe('');h.ready();expect(h.nodes.notes.value).toBe('private A');expect(h.nodes.cleaned.checked).toBe(true);h.frames.forEach(fn=>fn());expect(h.scrolls).toEqual([{top:120,behavior:'auto'}]);
  });
  it('does not adopt or rewrite unowned legacy bytes',()=>{
    const raw=' {"fields":{"notes":"previous account"}} ';const h=harness(new Map([[legacy,raw]]));h.start();h.ready();expect(h.nodes.notes.value).toBe('');h.nodes.notes.value='new';h.nodes.notes.input();expect(h.storage.get(legacy)).toBe(raw);expect(JSON.parse(h.storage.get(key())).fields.notes).toBe('new');
  });
  it('separates PIN and USER principals with the same numeric id after reload',()=>{
    const store=new Map([[key(),snapshot()]]);const h=harness(store);h.change(ownerB);h.start();h.ready();expect(h.nodes.notes.value).toBe('');h.nodes.notes.value='private B';h.nodes.notes.input();expect(store.get(key())).toBe(snapshot());const a=harness(store);a.start();a.ready();expect(a.nodes.notes.value).toBe('private A');
  });
  it('isolates visits while retaining each original draft',()=>{
    const store=new Map([[key(),snapshot()]]);const h=harness(store);h.change(ownerA,'8');h.start();h.ready();expect(h.nodes.notes.value).toBe('');h.nodes.notes.value='visit 8';h.nodes.notes.input();expect(JSON.parse(store.get(key(ownerA,'8'))).fields.notes).toBe('visit 8');expect(store.get(key())).toBe(snapshot());
  });
  it.each(['not json','null',JSON.stringify({version:1,owner:ownerB,visitId:'7',fields:{notes:'wrong'}}),JSON.stringify({version:1,owner:ownerA,visitId:'8',fields:{notes:'wrong'}}),JSON.stringify({version:1,owner:ownerA,visitId:'7',fields:[]})])('preserves invalid scoped bytes without recovery: %s',raw=>{
    const h=harness(new Map([[key(),raw]]));h.start();h.ready();expect(h.nodes.notes.value).toBe('');expect(h.storage.get(key())).toBe(raw);h.nodes.notes.value='new edit';h.nodes.notes.input();expect(h.storage.get(key()+':unreadable:0')).toBe(raw);expect(JSON.parse(h.storage.get(key())).fields.notes).toBe('new edit');
  });
  it('never writes before loading or while session is unavailable',()=>{
    const h=harness();h.start();h.nodes.notes.value='early';h.nodes.notes.input();h.fire('pagehide');expect(h.storage.size).toBe(0);h.ready();h.unready();h.nodes.notes.input();expect(h.storage.size).toBe(0);
  });
  it('keeps newer editing on a repeated refresh and skips late scrolling after account change',()=>{
    const h=harness(new Map([[key(),snapshot()]]));h.start();h.ready();h.nodes.notes.value='latest';h.ready();expect(h.nodes.notes.value).toBe('latest');h.change(ownerB);h.frames.forEach(fn=>fn());expect(h.scrolls).toEqual([]);
  });
  it('omits files, credentials and managed fields from save and recovery',()=>{
    const h=harness(new Map([[key(),snapshot()]]));h.start();h.ready();expect(h.nodes.photo.value).toBe('');expect(h.nodes.password.value).toBe('');h.nodes.notes.input();const fields=JSON.parse(h.storage.get(key())).fields;expect(Object.keys(fields).sort()).toEqual(['cleaned','notes']);
  });
  it('preserves generic unmanaged form memory on other pages',()=>{
    const generic='cw:ctx:/dashboard',h=harness(new Map([[generic,JSON.stringify({fields:{notes:'generic',password:'secret',managed:'skip'},scrollY:0})]]),'/dashboard');h.start();expect(h.nodes.notes.value).toBe('generic');expect(JSON.parse(h.storage.get(generic)).fields).toEqual({notes:'generic'});h.nodes.notes.value='edited';h.nodes.notes.input();expect(JSON.parse(h.storage.get(generic)).fields.notes).toBe('edited');
  });
  it('does not restore a generic pathname language over the owned language selector',()=>{
    const generic='cw:ctx:/dashboard',h=harness(new Map([[generic,JSON.stringify({fields:{notes:'generic',cwLanguageSelect:'de'},scrollY:0})]]),'/dashboard');
    h.nodes.cwLanguageSelect.value='en';h.start();
    expect(h.nodes.cwLanguageSelect.value).toBe('en');
    expect(h.nodes.notes.value).toBe('generic');
    expect(JSON.parse(h.storage.get(generic)).fields).toEqual({notes:'generic'});
  });
  it('does not collect or save generic memory on owned or excluded field events',()=>{
    const h=harness(new Map(),'/dashboard');h.start();
    for(const id of ['cwLanguageSelect','managed','photo','password']){
      h.nodes[id].input();h.nodes[id].change();
      expect(h.storage.size).toBe(0);
    }
    h.nodes.notes.value='synchronous edit';h.nodes.notes.input();
    expect(JSON.parse(h.storage.get('cw:ctx:/dashboard')).fields).toEqual({notes:'synchronous edit',cleaned:false});
  });
  it('retains lifecycle saving and scroll without remembering an owned language',()=>{
    const h=harness(new Map(),'/dashboard');h.start();
    h.nodes.notes.value='unsent edit';h.nodes.cwLanguageSelect.value='fr';
    for(const event of ['pagehide','beforeunload']){
      h.fire(event);
      const saved=JSON.parse(h.storage.get('cw:ctx:/dashboard'));
      expect(saved.fields).toEqual({notes:'unsent edit',cleaned:false});
      expect(saved.scrollY).toBe(0);
    }
  });
});
