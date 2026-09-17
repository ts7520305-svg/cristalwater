import { describe, it, expect } from 'vitest';
const fs = require('node:fs'), vm = require('node:vm');
function harness() {
  const data = new Map(), session = { owner: 'TECH:7', technicianId: 7, token: 'not-persisted' }; let active = true;
  const window = { CWFieldWriteStore: { same: captured => active && captured === session } };
  vm.runInNewContext(fs.readFileSync('frontend/cw-legacy-route-cache.js','utf8'), { window, localStorage: { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) } });
  const value = { v:3,owner:session.owner,technicianId:7,day:'2026-09-16',serverConfirmedAt:'2026-09-16T10:00:00.000Z',visits:[{id:9,technicianId:7,status:'PLANNED'}],activeVisitId:9,pendingSyncVisitIds:[] };
  return { cache:window.CWLegacyRouteCache,data,session,value,change:()=>{active=false;} };
}
describe('Legacy route identity and preservation',()=>{
  it('keeps user-linked and native technician cache identities separate',()=>{const h=harness();expect(h.cache.key(h.session,h.value.day)).not.toBe(h.cache.key({owner:'USER:7:TECH:7'},h.value.day));h.cache.save(h.value,h.session);expect(h.cache.read(h.session,h.value.day)).toEqual(h.value);expect([...h.data.values()].join('')).not.toContain(h.session.token);});
  it.each([{owner:'TECH:8'},{technicianId:8},{day:'2026-09-17'},{visits:[{id:9,technicianId:8,status:'PLANNED'}]},{activeVisitId:77},{pendingSyncVisitIds:[77]}])('preserves and refuses a mismatching cache %j',change=>{const h=harness(),key=h.cache.key(h.session,h.value.day),raw=JSON.stringify({...h.value,...change});h.data.set(key,raw);expect(()=>h.cache.read(h.session,h.value.day)).toThrow();expect(()=>h.cache.save(h.value,h.session)).toThrow();expect(h.data.get(key)).toBe(raw);});
  it('does not import a global or numeric-owner historical route',()=>{const h=harness(),raw='[{"private":"other account"}]';h.data.set('offline_visits',raw);expect(()=>h.cache.read(h.session,h.value.day)).toThrow(/antiga/);h.cache.save(h.value,h.session);expect(h.cache.read(h.session,h.value.day)).toEqual(h.value);expect(h.data.get('offline_visits')).toBe(raw);});
  it('preserves invalid JSON and rejects a changed session before writes',()=>{const h=harness(),key=h.cache.key(h.session,h.value.day);h.data.set(key,'{bad');expect(()=>h.cache.save(h.value,h.session)).toThrow();expect(h.data.get(key)).toBe('{bad');h.change();expect(()=>h.cache.read(h.session,h.value.day)).toThrow(/sessão/);});
});
