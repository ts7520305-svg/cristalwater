const assert = require('node:assert/strict');
require('../src/loadEnv')();
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true')throw new Error('Isolated QA required');
const {prisma}=require('../src/prismaClient');
const jwt=require('jsonwebtoken');
const {getJwtSecret}=require('../src/utils/jwtSecret');
const BASE=process.env.CW_BASE_URL||'http://127.0.0.1:3002';
async function main(){
 const results=[];const suffix=Date.now();
 const client=await prisma.client.create({data:{name:`Access QA ${suffix}`,active:true}});
 const other=await prisma.client.create({data:{name:`Other QA ${suffix}`,active:true}});
 const tech=await prisma.technician.create({data:{name:`Tech QA ${suffix}`,active:true}});
 const tech2=await prisma.technician.create({data:{name:`Tech2 QA ${suffix}`,active:true}});
 const sign=body=>jwt.sign(body,getJwtSecret(),{expiresIn:'1h'});
 const ct=sign({id:client.id,clientId:client.id,role:'CLIENT'}),tt=sign({id:tech.id,technicianId:tech.id,role:'TECHNICIAN'});
 const internal=await prisma.notification.create({data:{clientId:client.id,role:'ADMIN',title:'INTERNAL-ONLY',message:'Private management',eventType:'QA_ACCESS'}});
 const publicNote=await prisma.notification.create({data:{clientId:client.id,role:'CLIENT',title:'CLIENT-OK',message:'Client update',eventType:'QA_ACCESS'}});
 const ownTech=await prisma.notification.create({data:{role:'TECHNICIAN',title:'TECH-OWN',message:'Field update',metadata:{technicianId:tech.id}}});
 const otherTech=await prisma.notification.create({data:{role:'TECHNICIAN',title:'TECH-OTHER',message:'Other update',metadata:{technicianId:tech2.id}}});
 async function call(path,token,method='GET',body){const response=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return{status:response.status,body:await response.json().catch(()=>({}))};}
 const test=async(name,fn)=>{try{await fn();console.log('PASS',name);results.push({name,pass:true})}catch(e){console.error('FAIL',name,e.message);results.push({name,pass:false,error:e.message})}};
 await test('global settings require administration and notification settings require ownership',async()=>{
  const key=`QA_ACCESS_${suffix}`;
  const admin=await prisma.user.create({data:{name:'Settings QA',email:`settings-${suffix}@qa.test`,password:'qa-no-login',role:'ADMIN',active:true}});
  const at=sign({id:admin.id,role:'ADMIN'});
  for(const [token,expected] of [[null,401],[ct,403],[tt,403]]){
   for(const [url,method,body] of [['/api/settings/global','GET'],[`/api/settings/global/${key}`,'GET'],[`/api/settings/global/${key}`,'PUT',{value:'true'}],['/api/settings/global/bulk','POST',{settings:{[key]:'true'}}]])assert.equal((await call(url,token,method,body)).status,expected,`${method} ${url}`);
  }
  assert.equal(await prisma.systemSetting.count({where:{key}}),0);
  assert.equal((await call(`/api/settings/global/${key}`,at,'PUT',{value:'true'})).status,200);
  assert.equal((await call(`/api/settings/global/${key}`,at)).body.value,'true');
  const user=await prisma.user.create({data:{name:'Settings user',email:`settings-user-${suffix}@qa.test`,password:'qa-no-login',role:'TECHNICIAN',active:true}});
  await prisma.technician.update({where:{id:tech2.id},data:{email:user.email}});
  const ut=sign({id:user.id,userId:user.id,technicianId:tech2.id,principalType:'USER',role:'TECHNICIAN'});
  assert.equal((await call(`/api/settings/${user.id}`,null)).status,401);
  assert.equal((await call('/api/settings',null,'POST',{userId:user.id,type:'QA',sound:false})).status,401);
  assert.equal((await call('/api/settings',tt,'POST',{userId:user.id,type:'QA',sound:false})).status,403);
  assert.equal((await call(`/api/settings/${admin.id}`,ut)).status,403);
  assert.equal((await call('/api/settings',ut,'POST',{userId:user.id,type:'QA',sound:false})).status,200);
  assert.equal((await call(`/api/settings/${user.id}`,ut)).body.settings[0].sound,false);
  assert.equal((await call('/api/settings/language/me',ct)).status,200);
  await prisma.systemSetting.delete({where:{key}});
 });
 await test('geofence only validates assigned open visits and never invents missing GPS',async()=>{
  const pool=await prisma.pool.create({data:{clientId:client.id,name:'GPS QA',active:true,latitude:37,longitude:-8}});
  const visit=await prisma.serviceVisit.create({data:{clientId:client.id,poolId:pool.id,technicianId:tech.id,status:'PLANNED',date:new Date(),plannedDate:new Date()}});
  const check=(token,values={})=>call('/api/gps/validate-geofence',token,'POST',{visitId:visit.id,currentLatitude:37,currentLongitude:-8,...values});
  assert.equal((await check(ct)).status,403);
  assert.equal((await check(sign({id:tech2.id,technicianId:tech2.id,role:'TECHNICIAN'}))).status,403);
  assert.equal((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).startAt,null);
  assert.equal(await prisma.auditTrail.count({where:{visitId:visit.id,eventType:'GPS_GEOFENCE'}}),0);
  assert.equal((await check(tt,{currentLatitude:null})).status,400);
  const outside=await check(tt,{currentLatitude:38});assert.equal(outside.status,200);assert.equal(outside.body.inside,false);
  assert.equal((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).startAt,null);
  const inside=await check(tt);assert.equal(inside.status,200,JSON.stringify(inside.body));assert.equal(inside.body.inside,true);
  const started=await prisma.serviceVisit.findUnique({where:{id:visit.id}});assert(started.startAt);assert.equal(started.status,'IN_PROGRESS');
  await prisma.serviceVisit.update({where:{id:visit.id},data:{status:'COMPLETED',endAt:new Date()}});
  assert.equal((await check(tt)).status,409);
  await prisma.serviceVisit.update({where:{id:visit.id},data:{status:'PLANNED',startAt:null,endAt:null}});
  await prisma.pool.update({where:{id:pool.id},data:{latitude:null,longitude:null}});
  const missing=await check(tt);assert.equal(missing.status,200);assert.equal(missing.body.inside,null);assert.equal(missing.body.requiresManualConfirmation,true);
  assert.equal((await prisma.serviceVisit.findUnique({where:{id:visit.id}})).startAt,null);
 });
 await test('core dashboard is reserved for authenticated administration',async()=>{
  const target='/api/core/dashboard';
  const anonymous=await call(target,null);assert.equal(anonymous.status,401);assert(!('counts' in anonymous.body));assert(!('nextVisits' in anonymous.body));
  for(const token of [ct,tt]){const denied=await call(target,token);assert.equal(denied.status,403);assert(!('nextVisits' in denied.body));}
  const admin=await prisma.user.create({data:{name:'Dashboard QA',email:`dashboard-${suffix}@qa.test`,password:require('bcryptjs').hashSync(require('crypto').randomUUID(),4),role:'ADMIN',active:true}});
  const allowed=await call(target,sign({id:admin.id,role:'ADMIN'}));assert.equal(allowed.status,200);assert(allowed.body.counts);assert(Array.isArray(allowed.body.nextVisits));
  assert.equal((await call('/api/core/health',null)).status,200);
 });
 await test('client notifications exclude internal management',async()=>{const r=await call('/api/notifications',ct);assert.equal(r.status,200);assert(r.body.notifications.some(n=>n.id===publicNote.id));assert(!r.body.notifications.some(n=>n.id===internal.id));});
 await test('client portal notifications exclude internal management',async()=>{const r=await call(`/api/client-portal/${client.id}/notifications`,ct);assert.equal(r.status,200);assert(!JSON.stringify(r.body).includes('INTERNAL-ONLY'));assert(JSON.stringify(r.body).includes('CLIENT-OK'));});
 await test('legacy client read endpoint protects internal and superseded notices and records confirmation time',async()=>{
  const read=id=>call(`/api/client-portal/${client.id}/notifications/${id}/read`,ct,'POST',{});
  const own=await prisma.notification.create({data:{clientId:client.id,role:'CLIENT',message:'Read confirmation QA'}});
  const foreign=await prisma.notification.create({data:{clientId:other.id,role:'CLIENT',message:'Other account'}});
  const replaced=await prisma.notification.create({data:{clientId:client.id,role:'CLIENT',message:'Replaced',status:'SUPERSEDED'}});
  const visible=await call(`/api/client-portal/${client.id}/notifications`,ct);assert(!visible.body.notifications.some(note=>note.id===replaced.id));
  for(const id of [internal.id,foreign.id,replaced.id]){assert.equal((await read(id)).status,404);assert.equal((await prisma.notification.findUnique({where:{id}})).isRead,false);}
  assert.equal((await read(own.id)).status,200);assert.equal((await read(own.id)).status,200);
  const saved=await prisma.notification.findUnique({where:{id:own.id}});assert(saved.isRead&&saved.readAt);
  assert.equal((await read(-1)).status,400);
 });
 await test('technician sees own targeted notifications',async()=>{const r=await call('/api/notifications',tt);assert.equal(r.status,200,JSON.stringify(r.body));assert(r.body.notifications.some(n=>n.id===ownTech.id));assert(!r.body.notifications.some(n=>n.id===otherTech.id));});
 await test('unread totals and read-all stay within the recipient beyond 500 notifications',async()=>{
  const before=await call('/api/notifications/unread-count',tt);assert.equal(before.status,200);
  const eventType=`SCOPE_${suffix}`;
  await prisma.notification.createMany({data:[...Array.from({length:510},()=>({role:'TECHNICIAN',message:'Own field notice',eventType,metadata:{technicianId:tech.id}})),...Array.from({length:550},()=>({role:'TECHNICIAN',message:'Foreign field notice',eventType,metadata:{technicianId:tech2.id}})),{role:'TECHNICIAN',message:'Replaced field notice',eventType,status:'SUPERSEDED',metadata:{technicianId:tech.id}},{role:'TECHNICIAN',message:'PAYMENT hidden from field',eventType,metadata:{technicianId:tech.id}}]});
  const counter=await call('/api/notifications/unread-count',tt);assert.equal(counter.status,200);assert.equal(counter.body.count,before.body.count+510);
  const feed=await call('/api/notifications',tt);assert.equal(feed.status,200);assert(!feed.body.notifications.some(n=>/Foreign|Replaced|PAYMENT/.test(n.message)));
  assert.equal((await call(`/api/notifications/${otherTech.id}/read`,tt,'POST',{})).status,403);
  assert.equal((await call(`/api/notifications/read/${otherTech.id}`,tt,'POST',{})).status,403);
  assert.equal((await call('/api/notifications/read-all',tt,'POST',{})).status,200);
  assert.equal((await call('/api/notifications/unread-count',tt)).body.count,0);
  assert.equal(await prisma.notification.count({where:{eventType,isRead:true}}),510);
  assert.equal((await prisma.notification.findUnique({where:{id:otherTech.id}})).isRead,false);
  assert.equal((await prisma.notification.findUnique({where:{id:publicNote.id}})).isRead,false);
  assert.equal((await call('/api/notifications/read-all',ct,'POST',{})).status,200);
  assert.equal((await prisma.notification.findUnique({where:{id:publicNote.id}})).isRead,true);
  assert.equal((await prisma.notification.findUnique({where:{id:internal.id}})).isRead,false);
 });
 await test('critical water notices are not hidden by a client name that resembles billing',async()=>{
  const note=await prisma.notification.create({data:{role:'TECHNICIAN',eventType:'WATER_OPEN_OVERDUE',message:'Bill: confirmar fecho da água',metadata:{technicianId:tech.id}}});
  assert((await call('/api/notifications',tt)).body.notifications.some(n=>n.id===note.id));assert.equal((await call('/api/notifications/unread-count',tt)).body.count,1);
  await prisma.notification.update({where:{id:note.id},data:{status:'RESOLVED'}});assert.equal((await call('/api/notifications/unread-count',tt)).body.count,0);assert(!(await call('/api/notifications',tt)).body.notifications.some(n=>n.id===note.id));
 });
 await test('anonymous offline write rejected',async()=>assert.equal((await call('/api/sync/text',null,'POST',{visits:[{id:1,ph:7.4}]})).status,401));
 await test('client offline write rejected',async()=>assert.equal((await call('/api/sync/text',ct,'POST',{visits:[{id:1,ph:7.4}]})).status,403));
 await test('anonymous document list rejected',async()=>assert.equal((await call('/api/documents')).status,401));
 await test('deleted administrator token rejected',async()=>assert.equal((await call('/api/notifications',sign({id:99999999,role:'ADMIN'}))).status,401));
 await test('unknown role token rejected',async()=>assert.equal((await call('/api/notifications',sign({id:1,role:'MAGIC'}))).status,401));
 await test('another client portal rejected',async()=>assert.equal((await call(`/api/client-portal/${other.id}/dashboard`,ct)).status,403));
 for (const suffix of ['history','latest']) {
  await test(`anonymous numeric portal ${suffix} rejected`,async()=>assert.equal((await call(`/api/client-portal/${other.id}/${suffix}`)).status,401));
  await test(`other client numeric portal ${suffix} rejected`,async()=>assert.equal((await call(`/api/client-portal/${other.id}/${suffix}`,ct)).status,403));
 }
 await test('anonymous route optimization rejected',async()=>assert.equal((await call('/api/route/optimize?lat=38&lng=-9')).status,401));
 await test('anonymous chat rejected',async()=>assert.equal((await call(`/api/client-messages/${client.id}`)).status,401));
 await test('other client chat rejected',async()=>assert.equal((await call(`/api/client-messages/${other.id}`,ct)).status,403));
 await test('client cannot impersonate administrator',async()=>{const r=await call('/api/client-messages',ct,'POST',{clientId:client.id,sender:'Administrator',message:'QA identity test'});assert.equal(r.status,200);assert.equal(r.body.message.senderType,'CLIENT');});
 await test('technician cannot use another vehicle',async()=>{
  const vehicle=await prisma.vehicle.create({data:{plate:`ACCESS-${suffix}`,active:true}});
  assert.equal((await call(`/api/guides/stock/${vehicle.id}`,tt)).status,403);
 });
 const assigned=await prisma.serviceVisit.create({data:{technicianId:tech.id,date:new Date(),status:'PLANNED'}});
 await test('technician route contains only own visits including missing pool',async()=>{const r=await call('/api/route/optimize?lat=38&lng=-9',tt);assert.equal(r.status,200);assert(r.body.some(v=>v.id===assigned.id));assert(r.body.every(v=>v.technicianId===tech.id));});
 const foreignVisit=await prisma.serviceVisit.create({data:{technicianId:tech2.id,date:new Date(),status:'DONE',endAt:new Date()}});
 await test('completion rejects stock from another vehicle',async()=>assert.equal((await call(`/api/core/visits/${assigned.id}/complete`,tt,'POST',{ph:7.4,chlorine:1.5,vehicleId:999999})).status,403));
 await test('correction rejects another technician visit',async()=>assert.equal((await call(`/api/technician/visits/${foreignVisit.id}/correction`,tt,'PATCH',{ph:7.4,chlorine:1.5})).status,403));
 await test('push subscription ignores forged role and binds to authenticated technician',async()=>{
  const key=require('web-push').generateVAPIDKeys().publicKey;
  const subscription={endpoint:`https://fcm.googleapis.com/fcm/send/qa-${suffix}`,keys:{p256dh:key,auth:require('crypto').randomBytes(16).toString('base64url')},role:'ADMIN',principalId:1};
  const r=await call('/api/push/subscriptions',tt,'POST',subscription);assert.equal(r.status,200,JSON.stringify(r.body));
  const row=await prisma.webPushSubscription.findUnique({where:{id:r.body.id}});assert.equal(row.role,'TECHNICIAN');assert.equal(row.principalId,tech.id);
  const hijack=await call('/api/push/subscriptions',ct,'POST',subscription);assert.equal(hijack.status,409);
  const result=await require('../src/services/browserPushService').deliverWaterNotifications();assert.equal(result.reason,'EXTERNAL_NOTIFICATIONS_DISABLED');
 });
 await test('simultaneous subscriptions bind one endpoint to one account',async()=>{
  const payload={endpoint:`https://fcm.googleapis.com/fcm/send/race-${suffix}`,keys:{p256dh:require('web-push').generateVAPIDKeys().publicKey,auth:require('crypto').randomBytes(16).toString('base64url')}};
  const replies=await Promise.all([call('/api/push/subscriptions',tt,'POST',payload),call('/api/push/subscriptions',ct,'POST',payload)]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
  const winner=replies[0].status===200?tt:ct,loser=winner===tt?ct:tt;
  assert.equal((await call('/api/push/subscriptions',loser,'DELETE',{endpoint:payload.endpoint})).status,200);
  assert.equal((await prisma.webPushSubscription.findUnique({where:{endpoint:payload.endpoint}})).active,true);
  const own=await Promise.all([call('/api/push/subscriptions',winner,'POST',payload),call('/api/push/subscriptions',winner,'POST',payload)]);own.forEach(r=>assert.equal(r.status,200));assert.equal(own[0].body.id,own[1].body.id);
 });
 await test('push subscription rejects internal network destinations',async()=>assert.equal((await call('/api/push/subscriptions',tt,'POST',{endpoint:'http://127.0.0.1:4000/private',keys:{}})).status,400));
 await test('anonymous realtime connection rejected'  ,async()=>{
  const start=await fetch(`${BASE}/socket.io/?EIO=4&transport=polling`).then(r=>r.text());const sid=JSON.parse(start.slice(1)).sid;
  const url=`${BASE}/socket.io/?EIO=4&transport=polling&sid=${encodeURIComponent(sid)}`;
  await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:'40'});
  const packet=await fetch(url,{signal:AbortSignal.timeout(5000)}).then(r=>r.text());assert(packet.includes('44'),packet);
 });
 console.log(JSON.stringify({results},null,2));if(results.some(r=>!r.pass))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
