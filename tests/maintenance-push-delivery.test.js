import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../src/services/browserPushService.js',import.meta.url),'utf8');
function fixture(options={}){
 const state={enabled:true,configured:true,current:true,checks:0,sends:[],updates:[],warnings:[],rows:[],subscriptions:[],...options};
 state.rows=options.rows||[{id:1,userId:null,role:'TECHNICIAN',eventType:'EQUIPMENT_MAINTENANCE_DUE',status:'PENDING',isRead:false,title:'Manutenção preventiva',message:'Verificar equipamento',metadata:{planId:4,planVersion:2,technicianId:7,visitId:9,maintenanceKey:'4:2:2026-09-15'}}];
 state.subscriptions=options.subscriptions||[{id:3,role:'TECHNICIAN',principalId:7,active:true,subscription:{endpoint:'https://example.invalid/3'}},{id:4,role:'TECHNICIAN',principalId:8,active:true,subscription:{endpoint:'https://example.invalid/4'}}];
 const db={notification:{
  async findMany({where,take}){return state.rows.filter(n=>n.id>where.id.gt&&where.eventType.in.includes(n.eventType)&&where.status.in.includes(n.status)).slice(0,take);},
  async findUnique({where}){return state.rows.find(n=>n.id===where.id);},
  async updateMany(q){state.updates.push(q);const row=state.rows.find(n=>n.id===q.where.id&&q.where.status.in.includes(n.status));if(row)Object.assign(row,q.data);return {count:row?1:0};}
 },webPushSubscription:{
  async findMany({where}){return state.subscriptions.filter(s=>s.active&&(typeof where.role==='object'?where.role.in.includes(s.role):s.role===where.role)&&(!where.principalId||s.principalId===where.principalId));},
  async update({where,data}){Object.assign(state.subscriptions.find(s=>s.id===where.id),data);}
 },operationalReminder:{async findUnique(){return {id:11,sourceKey:'water:7',assignedToTechnicianId:7,isCompleted:false};}}};
 const dependencies={
  '../prismaClient':{prisma:db},
  'web-push':{setVapidDetails(){if(!state.configured)throw new Error('Missing VAPID');},async sendNotification(subscription,payload,delivery){state.sends.push({subscription,payload:JSON.parse(payload),delivery});if(state.send)await state.send(subscription);return {}; }},
  '../utils/roles':require('../src/utils/roles'),
  '../config/externalIntegrations':{areExternalNotificationsEnabled:()=>state.enabled},
  '../utils/jwtPrincipalGuard':{validateJwtPrincipal:async()=>({ok:state.principalActive!==false})},
  '../business/equipment/EquipmentMaintenanceReminderBusiness':{async isCurrentNotification(n){state.checks++;return typeof state.current==='function'?state.current(n,state.checks):state.current;}}
 };
 const sandbox={require:key=>{if(!(key in dependencies))throw new Error('Unexpected dependency: '+key);return dependencies[key];},module:{exports:{}},process:{env:{}},console:{warn:(...args)=>state.warnings.push(args)},URL};
 vm.runInNewContext(source,sandbox,{filename:'browserPushService.js'});
 return {state,service:sandbox.module.exports};
}
describe('preventive maintenance push isolated transport',()=>{
 it('only delivers equipment events to their assigned technician with normal urgency',async()=>{
  const {state,service}=fixture();state.rows.push({...state.rows[0],id:2,eventType:'WATER_OPEN_OVERDUE',metadata:{reminderId:11,technicianId:7}});
  expect(await service.deliverMaintenanceNotifications()).toEqual({sent:1});expect(state.sends).toHaveLength(1);
  expect(state.sends[0]).toMatchObject({subscription:{endpoint:'https://example.invalid/3'},payload:{owner:'TECHNICIAN:7',url:'/technician-field-mode',tag:'maintenance-4:2:2026-09-15'},delivery:{TTL:86400,urgency:'normal'}});
  expect(state.rows[0].metadata.webPushComplete).toBe(true);expect(state.rows[1].metadata.webPushComplete).toBeUndefined();
 });
 it('delivers assigned field work to a team leader with the subscription owner identity',async()=>{
  const {state,service}=fixture();state.subscriptions[0].role='TEAM_LEADER';state.subscriptions[1].role='TEAM_LEADER';
  expect(await service.deliverMaintenanceNotifications()).toEqual({sent:1});expect(state.sends).toHaveLength(1);
  expect(state.sends[0].payload).toMatchObject({owner:'TEAM_LEADER:7',url:'/technician-field-mode'});
  expect(state.sends[0].subscription.endpoint).toBe('https://example.invalid/3');
 });
 it('keeps the critical delivery filter, tag and priority unchanged',async()=>{
  const {state,service}=fixture();state.rows.push({...state.rows[0],id:2,eventType:'WATER_OPEN_OVERDUE',metadata:{reminderId:11,technicianId:7}});
  expect(await service.deliverWaterNotifications()).toEqual({sent:1});expect(state.sends[0]).toMatchObject({payload:{tag:'water-11'},delivery:{TTL:3600,urgency:'high'}});expect(state.checks).toBe(0);
 });
 it('targets an explicit administrator without exposing its message to other administrators',async()=>{
  const {state,service}=fixture();state.rows[0].role='ADMIN';state.rows[0].userId=20;
  state.subscriptions=[20,21].map(id=>({id,role:'ADMIN',principalId:id,active:true,subscription:{endpoint:'https://example.invalid/'+id}}));
  expect(await service.deliverMaintenanceNotifications()).toEqual({sent:1});expect(state.sends[0].payload).toMatchObject({owner:'ADMIN:20',url:'/admin-operational-settings#equipmentMaintenancePanel'});
 });
 it.each(['expired','plan superseded','reassigned','disabled plan'])('suppresses %s work using the current business decision',async()=>{
  const {state,service}=fixture({current:false});expect(await service.deliverMaintenanceNotifications()).toEqual({sent:0});expect(state.sends).toHaveLength(0);expect(state.rows[0].status).toBe('SUPERSEDED');
 });
 it('rechecks current assignment immediately before sending, after subscription lookup',async()=>{
  const {state,service}=fixture({current:(_n,count)=>count===1});expect(await service.deliverMaintenanceNotifications()).toEqual({sent:0});expect(state.checks).toBe(2);expect(state.rows[0].status).toBe('SUPERSEDED');
 });
 it.each(['READ','isRead'])('does not deliver or supersede an already read %s notice',async mode=>{
  const {state,service}=fixture();if(mode==='READ')state.rows[0].status='READ';else state.rows[0].isRead=true;
  expect(await service.deliverMaintenanceNotifications()).toEqual({sent:0});expect(state.sends).toHaveLength(0);expect(state.updates).toHaveLength(0);
 });
 it('disables an expired subscription without marking the notice delivered',async()=>{
  const {state,service}=fixture({send:async()=>{throw {statusCode:410};}});expect(await service.deliverMaintenanceNotifications()).toEqual({sent:0});expect(state.subscriptions[0].active).toBe(false);expect(state.rows[0].metadata.webPushComplete).toBeUndefined();
 });
 it('retries transient failure only for the device that did not receive it',async()=>{
  const {state,service}=fixture();state.subscriptions[1].principalId=7;let failed=false;
  state.send=async subscription=>{if(subscription.endpoint.endsWith('/4')&&!failed){failed=true;throw {statusCode:503};}};
  expect(await service.deliverMaintenanceNotifications()).toEqual({sent:1});expect(state.rows[0].metadata.webPushComplete).toBe(false);expect(state.rows[0].metadata.webPushDeliveredTo).toEqual([3]);
  expect(await service.deliverMaintenanceNotifications()).toEqual({sent:1});expect(state.rows[0].metadata.webPushComplete).toBe(true);expect(state.sends).toHaveLength(3);
 });
 it('shares in-flight work within this process',async()=>{
  let release,started;const entered=new Promise(resolve=>{started=resolve;});const pending=new Promise(resolve=>{release=resolve;});
  const {state,service}=fixture({send:async()=>{started();await pending;}});
  const first=service.deliverMaintenanceNotifications();await entered;const second=service.deliverMaintenanceNotifications();expect(second).toBe(first);release();await Promise.all([first,second]);expect(state.sends).toHaveLength(1);
 });
 it.each(['enabled','configured'])('respects disabled %s gate',async key=>{
  const {state,service}=fixture({[key]:false});expect((await service.deliverMaintenanceNotifications()).skipped).toBe(true);expect(state.sends).toHaveLength(0);expect(state.checks).toBe(0);
 });
});
