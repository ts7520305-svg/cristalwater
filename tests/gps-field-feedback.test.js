import {describe,it,expect,vi} from 'vitest';
const fs=require('node:fs'),vm=require('node:vm');
function harness(reply){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',dataset:{},addEventListener(){},removeAttribute(){}});return nodes.get(id);};
 const fetch=vi.fn(async()=>({ok:reply.http!==false,status:reply.http===false?503:200,text:async()=>JSON.stringify(reply.body)}));
 const context=vm.createContext({window:{CristalAuth:{requireAuth:()=>true}},navigator:{},document:{getElementById:node},localStorage:{getItem:()=>JSON.stringify({id:41,technicianId:41})},fetch,console});
 vm.runInContext(fs.readFileSync(require.resolve('../frontend/technician-gps.js'),'utf8'),context);
 return {node,fetch,send:()=>vm.runInContext('sendPoint({timestamp:1700000000000,coords:{latitude:37,longitude:-8,accuracy:8}})',context)};
}
describe('field GPS confirmation',()=>{
 it('sends measurement time and confirms only accepted live readings',async()=>{
  const h=harness({body:{ok:true,success:true}});await h.send();const payload=JSON.parse(h.fetch.mock.calls[0][1].body);expect(payload.recordedAt).toBe('2023-11-14T22:13:20.000Z');expect(h.node('syncKpi').textContent).toBe('Sincronizado');
 });
 it('does not present an ignored old reading as live GPS',async()=>{
  const h=harness({body:{ok:true,ignored:true,message:'Leitura antiga ignorada'}});await h.send();expect(h.node('syncKpi').textContent).toBe('A atualizar');expect(h.node('gpsStatus').textContent).toContain('antiga');
 });
 it.each([true,false])('does not claim saved GPS for a rejected response (HTTP failure: %s)',async failure=>{
  const h=harness({http:!failure,body:{ok:false,success:false,message:'Não confirmado'}});await expect(h.send()).rejects.toThrow('Não confirmado');expect(h.node('syncKpi').textContent).not.toBe('Sincronizado');
 });
});
