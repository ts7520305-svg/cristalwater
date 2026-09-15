import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const {prisma}=require('../src/prismaClient');
const webPush=require('web-push');
const service=require('../src/services/browserPushService');
let notifications,reminder,subscriptions;
function row(id,metadata={}){return {id,role:'TECHNICIAN',eventType:'WATER_OPEN_OVERDUE',status:'PENDING',title:'Água aberta',message:'Confirmar fecho',metadata:{reminderId:10,technicianId:7,...metadata}};}
describe('critical browser push delivery',()=>{
 beforeEach(()=>{
  vi.stubEnv('NODE_ENV','test');vi.stubEnv('QA_MODE','false');vi.stubEnv('EXTERNAL_NOTIFICATIONS_ENABLED','true');
  notifications=[row(1)];reminder={id:10,sourceKey:'water:7:test',isCompleted:false,assignedToTechnicianId:7};subscriptions=[{id:3,role:'TECHNICIAN',principalId:7,subscription:{endpoint:'https://example.invalid/mock'}}];
  vi.spyOn(webPush,'setVapidDetails').mockImplementation(()=>{});
  vi.spyOn(webPush,'sendNotification').mockResolvedValue({});
  vi.spyOn(prisma.notification,'findMany').mockImplementation(async q=>q.where.id?notifications.filter(n=>n.id>q.where.id.gt&&['PENDING','SENT'].includes(n.status)).slice(0,q.take):[]);
  vi.spyOn(prisma.notification,'findUnique').mockImplementation(async q=>notifications.find(n=>n.id===q.where.id));
  vi.spyOn(prisma.notification,'updateMany').mockImplementation(async q=>{const n=notifications.find(n=>n.id===q.where.id&&q.where.status.in.includes(n.status));if(n)Object.assign(n,q.data);return {count:n?1:0};});
  vi.spyOn(prisma.operationalReminder,'findUnique').mockImplementation(async()=>reminder);
  vi.spyOn(prisma.webPushSubscription,'findMany').mockImplementation(async()=>subscriptions);
  vi.spyOn(prisma.webPushSubscription,'update').mockResolvedValue({});
  vi.spyOn(prisma.technician,'findUnique').mockResolvedValue({id:7,active:true,role:'TECHNICIAN'});
 });
 afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
 it('reaches pending work beyond 100 already delivered notifications',async()=>{
  notifications=Array.from({length:100},(_,i)=>row(i+1,{webPushComplete:true}));notifications.push(row(101));
  expect(await service.deliverWaterNotifications()).toEqual({sent:1});expect(webPush.sendNotification).toHaveBeenCalledTimes(1);expect(JSON.parse(webPush.sendNotification.mock.calls[0][1]).owner).toBe('TECHNICIAN:7');expect(notifications[100].metadata.webPushComplete).toBe(true);
 });
 it.each(['closed','reassigned'])('does not send obsolete %s responsibility',async reason=>{
  if(reason==='closed')reminder.isCompleted=true;else reminder.assignedToTechnicianId=8;
  expect(await service.deliverWaterNotifications()).toEqual({sent:0});expect(webPush.sendNotification).not.toHaveBeenCalled();expect(notifications[0].status).toBe('SUPERSEDED');
 });
 it('stops subsequent devices after closure during the first external send',async()=>{
  subscriptions.push({...subscriptions[0],id:4});
  webPush.sendNotification.mockImplementation(async()=>{reminder.isCompleted=true;notifications[0].status='RESOLVED';return {};});
  expect(await service.deliverWaterNotifications()).toEqual({sent:1});expect(webPush.sendNotification).toHaveBeenCalledTimes(1);expect(notifications[0].status).toBe('RESOLVED');expect(notifications[0].metadata.webPushComplete).toBeUndefined();
 });
 it('retires expired subscriptions without claiming delivery',async()=>{
  webPush.sendNotification.mockRejectedValue({statusCode:410});expect(await service.deliverWaterNotifications()).toEqual({sent:0});expect(prisma.webPushSubscription.update).toHaveBeenCalledWith({where:{id:3},data:{active:false}});expect(notifications[0].metadata.webPushComplete).toBeUndefined();
 });
 it('retries a failed device without resending to the successful one',async()=>{
  subscriptions.push({...subscriptions[0],id:4});
  webPush.sendNotification.mockResolvedValueOnce({}).mockRejectedValueOnce({statusCode:503}).mockResolvedValue({});
  vi.spyOn(console,'warn').mockImplementation(()=>{});
  expect(await service.deliverWaterNotifications()).toEqual({sent:1});expect(notifications[0].metadata.webPushDeliveredTo).toEqual([3]);
  expect(await service.deliverWaterNotifications()).toEqual({sent:1});expect(webPush.sendNotification).toHaveBeenCalledTimes(3);expect(notifications[0].metadata.webPushComplete).toBe(true);
 });
 it('keeps the safety scan running while the external provider is delayed',async()=>{
  const monitor=require('../src/services/waterReminderService');
  vi.spyOn(prisma.operationalReminder,'findMany').mockResolvedValue([]);
  let release,started;const pending=new Promise(resolve=>{release=resolve;});const entered=new Promise(resolve=>{started=resolve;});
  vi.spyOn(service,'deliverWaterNotifications').mockImplementation(()=>{started();return pending;});
  const first=monitor.processOverdue();
  try{
   await entered;expect(await monitor.processOverdue()).toEqual({escalated:0,repeated:0});
   expect(prisma.operationalReminder.findMany).toHaveBeenCalledTimes(2);expect(service.deliverWaterNotifications).toHaveBeenCalledTimes(1);
  }finally{release({sent:0});await first;}
 });
 it('keeps QA external delivery disabled',async()=>{
  vi.stubEnv('QA_MODE','true');expect((await service.deliverWaterNotifications()).skipped).toBe(true);expect(webPush.sendNotification).not.toHaveBeenCalled();expect(prisma.notification.findMany).not.toHaveBeenCalled();
 });
});
