import {it,expect} from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/services/currentNotificationScope.js',import.meta.url),'utf8');
function fixture(fail=false){
 const queried=[],checked=[],scope={role:'TECHNICIAN',principal:'scope-marker'};
 const rows=Array.from({length:501},(_,i)=>({id:i+1}));
 const dependencies={
  '../prismaClient':{prisma:{notification:{async findMany(q){queried.push(q);return rows.filter(r=>r.id>q.where.AND[1].id.gt).slice(0,q.take);}}}},
  './notificationScopeService':{activeFor:()=>scope},
  '../business/equipment/EquipmentMaintenanceReminderBusiness':{TYPE:'EQUIPMENT_MAINTENANCE_DUE',async isCurrentNotification(row){checked.push(row.id);if(fail)throw Error('database unavailable');return row.id===501;}}
 };
 const sandbox={require:k=>dependencies[k],module:{exports:{}}};vm.runInNewContext(source,sandbox);
 return {service:sandbox.module.exports,queried,checked,scope};
}
it('validates beyond the first 500 notices and retains original role scope',async()=>{
 const f=fixture(),where=await f.service.currentNotificationScope({id:7});
 expect(f.checked).toHaveLength(501);expect(f.queried).toHaveLength(2);
 expect(f.queried.every(q=>q.where.AND[0]===f.scope)).toBe(true);
 expect(where.AND[0]).toBe(f.scope);expect(where.AND[1].OR).toEqual([{eventType:null},{eventType:{not:'EQUIPMENT_MAINTENANCE_DUE'}},{id:{in:[501]}}]);
});
it('does not return an unvalidated scope on a database failure',async()=>{
 await expect(fixture(true).service.currentNotificationScope({id:7})).rejects.toThrow('database unavailable');
});
