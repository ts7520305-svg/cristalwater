import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),R=require('../frontend/cw-navigation-preferences');
const owner='ADMIN:12',at='2026-09-25T14:00:00.000Z',value=()=>({version:1,owner,preferences:{theme:'dark',density:'large'},updatedAt:at});
const claims={id:12,role:'ADMIN',principalType:'USER',exp:9999999999},values=()=>['token','token',null,JSON.stringify({id:12,role:'ADMIN'}),null];
describe('navigation preferences',()=>{
 it('accepts only complete explicit choices',()=>{for(const theme of R.themes)for(const density of R.densities)expect(R.valid({theme,density})).toBe(true);for(const p of [null,[],{}, {theme:'mid',density:'large'},{theme:'light',density:'huge'},{theme:'dark',density:'comfort',clientId:12}])expect(R.valid(p)).toBe(false);});
 it('distinguishes a missing preference from unreadable stored bytes',()=>{expect(R.record(null,owner)).toEqual({status:'default',preferences:R.defaults()});for(const raw of ['','null','[]','broken','{}'])expect(R.record(raw,owner).status).toBe('corrupt');});
 it('rejects cross-account, stale-version and extra-field records',()=>{expect(R.record(JSON.stringify(value()),owner).status).toBe('ready');for(const patch of [{owner:'ADMIN:13'},{version:2},{theme:'dark'},{preferences:{theme:'dark'}}])expect(R.record(JSON.stringify({...value(),...patch}),owner).status).toBe('corrupt');});
 it('requires an actual canonical timestamp',()=>{for(const updatedAt of ['yesterday','2026-02-30T09:00:00.000Z','2026-09-25',null,0])expect(R.record(JSON.stringify({...value(),updatedAt}),owner).status).toBe('corrupt');});
 it('binds a valid stored session to the administrator identity',()=>{const state=R.identity(values(),()=>claims,1);expect(state.owner).toBe(owner);expect(R.key(state.owner)).not.toBe(R.key('ADMIN:13'));});
 it('refuses token aliases or user aliases belonging to another session',()=>{const v=values();v[1]='other';expect(R.identity(v,()=>claims,1)).toBeNull();v[1]='token';v[4]=JSON.stringify({id:13,role:'ADMIN'});expect(R.identity(v,()=>claims,1)).toBeNull();});
 it('refuses expired, invalid, environment and non-admin identities',()=>{for(const patch of [{exp:1},{id:0},{id:2147483648},{role:'TECHNICIAN'},{role:'CLIENT'},{principalType:'ENV_ADMIN'}])expect(R.identity(values(),()=>({...claims,...patch}),2000)).toBeNull();expect(R.identity(values(),()=>{throw Error();},1)).toBeNull();});
 it('allows language changes without treating them as an account change',()=>{const a=R.identity(values(),()=>claims,1),v=values();v[3]=JSON.stringify({id:12,role:'ADMIN',language:'de',name:'Updated display name'});expect(R.identity(v,()=>claims,1).fingerprint).toBe(a.fingerprint);v[0]=v[1]='renewed';expect(R.identity(v,()=>claims,1).fingerprint).not.toBe(a.fingerprint);});
 it('follows device colour only when the selected theme is system',()=>{expect(R.effective({theme:'system'},true)).toBe('dark');expect(R.effective({theme:'system'},false)).toBe('light');expect(R.effective({theme:'light'},true)).toBe('light');expect(R.effective({theme:'dark'},false)).toBe('dark');});
 it('provides scope, choices and failure recovery in all five languages',()=>{const context={window:{}};vm.runInNewContext(fs.readFileSync('frontend/cw-appearance-copy.js','utf8'),context);const copies=context.window.CWAppearanceCopy,keys=Object.keys(copies.pt);expect(Object.keys(copies)).toHaveLength(5);for(const lang of ['pt','en','fr','es','de'])for(const key of keys)expect(typeof copies[lang][key]).toBe('string');for(const key of ['scope','local','legacy','conflict','corrupt','storage','session'])expect(keys).toContain(key);});
});
