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
 const existing=await prisma.webPushSubscription.findUnique({where:{endpoint:subscription.endpoint}});
 if(existing&&(existing.role!==identity.role||existing.principalId!==identity.principalId))throw Object.assign(new Error('Subscrição de outra sessão. Volte a ativar as notificações neste dispositivo.'),{statusCode:409});
 return prisma.webPushSubscription.upsert({where:{endpoint:subscription.endpoint},create:{...identity,endpoint:subscription.endpoint,subscription,active:true},update:{subscription,active:true}});
}
async function unsubscribe(user,endpoint){return prisma.webPushSubscription.updateMany({where:{...owner(user),endpoint:String(endpoint)},data:{active:false}});}
async function deliverWaterNotifications(){
 if(!areExternalNotificationsEnabled())return {skipped:true,reason:'EXTERNAL_NOTIFICATIONS_DISABLED'};
 if(!configured())return {skipped:true,reason:'WEB_PUSH_NOT_CONFIGURED'};
 const config=configuration();webPush.setVapidDetails(config.subject,config.publicKey,config.privateKey);
 const notifications=await prisma.notification.findMany({where:{eventType:{in:['WATER_OPEN_OVERDUE','PUMP_MANUAL_OVERDUE']},status:{in:['PENDING','SENT']}},orderBy:{createdAt:'desc'},take:100});
 let sent=0;
 for(const notification of notifications){
  const metadata=notification.metadata||{};if(metadata.webPushComplete)continue;
  const role=normalizeRole(notification.role);
  if(role!=='ADMIN'&&role!=='TECHNICIAN')continue;
  if(role==='TECHNICIAN'&&!metadata.technicianId)continue;
  const subscriptions=await prisma.webPushSubscription.findMany({where:{active:true,role,...(role==='TECHNICIAN'?{principalId:Number(metadata.technicianId)}:{})}});
  const delivered=new Set(metadata.webPushDeliveredTo||[]);
  for(const subscription of subscriptions){
   if(delivered.has(subscription.id))continue;
   if(!(await validateJwtPrincipal({id:subscription.principalId,role:subscription.role})).ok){await prisma.webPushSubscription.update({where:{id:subscription.id},data:{active:false}});continue;}
   try{
    await webPush.sendNotification(subscription.subscription,JSON.stringify({title:notification.title,body:notification.message,tag:`water-${metadata.reminderId}`,url:role==='ADMIN'?'/admin-alerts?origin=water-open':'/technician-field-mode'}),{TTL:3600,urgency:'high',timeout:10000});
    delivered.add(subscription.id);sent++;
   }catch(error){if([404,410].includes(error.statusCode))await prisma.webPushSubscription.update({where:{id:subscription.id},data:{active:false}});else console.warn('WEB_PUSH_DELIVERY_FAILED',notification.id,error.statusCode||'NETWORK');}
  }
  if(delivered.size)await prisma.notification.update({where:{id:notification.id},data:{metadata:{...metadata,webPushDeliveredTo:[...delivered],webPushComplete:subscriptions.length>0&&subscriptions.every(s=>delivered.has(s.id))}}});
 }
 return {sent};
}
module.exports={configuration,configured,owner,validateSubscription,subscribe,unsubscribe,deliverWaterNotifications};
