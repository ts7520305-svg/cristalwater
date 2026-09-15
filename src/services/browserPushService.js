const {prisma}=require('../prismaClient');
const webPush=require('web-push');
const {normalizeRole}=require('../utils/roles');
const {areExternalNotificationsEnabled}=require('../config/externalIntegrations');
const {validateJwtPrincipal}=require('../utils/jwtPrincipalGuard');
function configuration(){return {publicKey:process.env.WEB_PUSH_PUBLIC_KEY||'',privateKey:process.env.WEB_PUSH_PRIVATE_KEY||'',subject:process.env.WEB_PUSH_SUBJECT||''};}
function configured(){const c=configuration();try { webPush.setVapidDetails(c.subject,c.publicKey,c.privateKey); return true; } catch (_) { return false; }}
function owner(user){const role=normalizeRole(user.role);return {role,principalId:Number(role==='TECHNICIAN'||role==='TEAM_LEADER'?user.technicianId||user.id:role==='CLIENT'?user.clientId||user.id:user.userId||user.id)};}
function validateSubscription(value){
 let endpoint;try{endpoint=new URL(value?.endpoint)}catch{throw Object.assign(new Error('Subscrição inválida'),{statusCode:400})}
 const host=endpoint.hostname.toLowerCase();
 const provider=host==='fcm.googleapis.com'||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host.endsWith('.notify.windows.com');
 if(endpoint.protocol!=='https:'||endpoint.port||endpoint.username||endpoint.password||!provider||endpoint.href.length>2048)throw Object.assign(new Error('Fornecedor de notificações inválido'),{statusCode:400});
 const keys=value.keys||{};
 if(!/^[A-Za-z0-9_-]{87,88}=?$/.test(keys.p256dh||'')||!/^[A-Za-z0-9_-]{22,24}={0,2}$/.test(keys.auth||''))throw Object.assign(new Error('Chaves de subscrição inválidas'),{statusCode:400});
 return {endpoint:endpoint.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
async function subscribe(user,value){
 const subscription=validateSubscription(value),identity=owner(user);
 return prisma.$transaction(async tx=>{
  const lockKey=`browser-push-subscription:${subscription.endpoint}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text`;
  const existing=await tx.webPushSubscription.findUnique({where:{endpoint:subscription.endpoint}});
  if(existing&&(existing.role!==identity.role||existing.principalId!==identity.principalId))throw Object.assign(new Error('Subscrição de outra sessão. Volte a ativar as notificações neste dispositivo.'),{statusCode:409});
  return tx.webPushSubscription.upsert({where:{endpoint:subscription.endpoint},create:{...identity,endpoint:subscription.endpoint,subscription,active:true},update:{subscription,active:true}});
 });
}
async function unsubscribe(user,endpoint){return prisma.webPushSubscription.updateMany({where:{...owner(user),endpoint:String(endpoint)},data:{active:false}});}
async function stillCurrent(notification){
 const fresh=await prisma.notification.findUnique({where:{id:notification.id},select:{status:true,isRead:true}});
 if(!fresh||!['PENDING','SENT'].includes(fresh.status))return false;
 if(notification.eventType==='EQUIPMENT_MAINTENANCE_DUE'){
  if(fresh.isRead)return false;
  const valid=await require('../business/equipment/EquipmentMaintenanceReminderBusiness').isCurrentNotification(notification);
  if(!valid)await prisma.notification.updateMany({where:{id:notification.id,status:{in:['PENDING','SENT']}},data:{status:'SUPERSEDED'}});
  return Boolean(valid);
 }
 const reminder=await prisma.operationalReminder.findUnique({where:{id:Number(notification.metadata?.reminderId)||0}});
 const role=normalizeRole(notification.role);
 const critical=notification.eventType==='PUMP_MANUAL_OVERDUE'?reminder?.sourceKey?.startsWith('pump:'):(reminder?.sourceKey?.startsWith('water:')||/^Agua aberta - /i.test(reminder?.title||''));
 const valid=critical&&reminder&&!reminder.isCompleted&&(role==='ADMIN'||reminder.assignedToTechnicianId===Number(notification.metadata?.technicianId));
 if(!valid)await prisma.notification.updateMany({where:{id:notification.id,status:{in:['PENDING','SENT']}},data:{status:'SUPERSEDED'}});
 return Boolean(valid);
}
async function deliverNotifications(maintenance=false){
 if(!areExternalNotificationsEnabled())return {skipped:true,reason:'EXTERNAL_NOTIFICATIONS_DISABLED'};
 if(!configured())return {skipped:true,reason:'WEB_PUSH_NOT_CONFIGURED'};
 const config=configuration();webPush.setVapidDetails(config.subject,config.publicKey,config.privateKey);
 let sent=0,cursor=0;
 while(true){
 const notifications=await prisma.notification.findMany({where:{id:{gt:cursor},eventType:{in:maintenance?['EQUIPMENT_MAINTENANCE_DUE']:['WATER_OPEN_OVERDUE','PUMP_MANUAL_OVERDUE']},status:{in:['PENDING','SENT']}},orderBy:{id:'asc'},take:100});
 if(!notifications.length)break;
 cursor=notifications[notifications.length-1].id;
 for(const notification of notifications){
  const metadata=notification.metadata||{};if(metadata.webPushComplete)continue;
  const role=normalizeRole(notification.role);
  if(role!=='ADMIN'&&role!=='TECHNICIAN')continue;
  if(role==='TECHNICIAN'&&!metadata.technicianId)continue;
  if(!await stillCurrent(notification))continue;
  const subscriptions=await prisma.webPushSubscription.findMany({where:{active:true,role:maintenance&&role==='TECHNICIAN'?{in:['TECHNICIAN','TEAM_LEADER']}:role,...(role==='TECHNICIAN'?{principalId:Number(metadata.technicianId)}:maintenance&&notification.userId?{principalId:Number(notification.userId)}:{})}});
  const delivered=new Set(metadata.webPushDeliveredTo||[]);
  for(const subscription of subscriptions){
   if(delivered.has(subscription.id))continue;
   if(!(await validateJwtPrincipal({id:subscription.principalId,role:subscription.role})).ok){await prisma.webPushSubscription.update({where:{id:subscription.id},data:{active:false}});continue;}
   if(!await stillCurrent(notification))break;
   try{
    await webPush.sendNotification(subscription.subscription,JSON.stringify({owner:`${maintenance?normalizeRole(subscription.role):role}:${subscription.principalId}`,title:notification.title,body:notification.message,tag:maintenance?`maintenance-${metadata.maintenanceKey||metadata.planId}`:`water-${metadata.reminderId}`,url:role==='ADMIN'?(maintenance?'/admin-operational-settings#equipmentMaintenancePanel':'/admin-alerts?origin=water-open'):'/technician-field-mode'}),{TTL:maintenance?86400:3600,urgency:maintenance?'normal':'high',timeout:10000});
    delivered.add(subscription.id);sent++;
   }catch(error){if([404,410].includes(error.statusCode))await prisma.webPushSubscription.update({where:{id:subscription.id},data:{active:false}});else console.warn('WEB_PUSH_DELIVERY_FAILED',notification.id,error.statusCode||'NETWORK');}
  }
  if(delivered.size)await prisma.notification.updateMany({where:{id:notification.id,status:{in:['PENDING','SENT']}},data:{metadata:{...metadata,webPushDeliveredTo:[...delivered],webPushComplete:subscriptions.length>0&&subscriptions.every(s=>delivered.has(s.id))}}});
 }
 if(notifications.length<100)break;
 }
 return {sent};
}
function deliverWaterNotifications(){return deliverNotifications(false);}
let maintenanceInFlight;
function deliverMaintenanceNotifications(){
 if(maintenanceInFlight)return maintenanceInFlight;
 maintenanceInFlight=deliverNotifications(true).finally(()=>{maintenanceInFlight=null;});
 return maintenanceInFlight;
}
module.exports={configuration,configured,owner,validateSubscription,subscribe,unsubscribe,deliverWaterNotifications,deliverMaintenanceNotifications,stillCurrent};
