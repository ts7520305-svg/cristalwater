'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let child, trigger = false, rule;
async function start() { child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore','ignore','ignore','ipc'] }); return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA child timeout')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve('http://127.0.0.1:' + port); }); }); }
async function stop() { if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function clearTrigger() { if (!trigger) return; await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_stock_request_failure ON "FieldWriteRequest"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_stock_request_failure()'); trigger = false; }
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Stock request owner', active: true,email:'stock-'+randomUUID()+'@qa.test' } }), other = await prisma.technician.create({ data: { name: 'Stock request other', active: true } });
  const client = await prisma.client.create({ data: { name: 'Stock request client', active: true } }), pool = await prisma.pool.create({ data: { name: 'Stock request pool', active: true, clientId: client.id } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, plannedDate: new Date(), status: 'PLANNED' } });
  const token = actor => jwt.sign(actor, getJwtSecret(), { expiresIn: '1h' });
  const credential = token({ id: tech.id, role: 'TECHNICIAN' }), otherCredential = token({ id: other.id, role: 'TECHNICIAN' }), clientCredential = token({ id: client.id, role: 'CLIENT' });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), adminCredential = token({ id: admin.id, role: 'ADMIN' });
  const body = { requestId: randomUUID(), visitType:'REGULAR',visitId:visit.id,poolId:pool.id,requestType:'STOCK_REQUEST',priority:'HIGH',productName:'Cloro shock',quantity:'2,5',unit:'kg',message:'Texto original: material em falta' };
  rule=await prisma.notificationRule.create({data:{eventType:'TECHNICIAN_STOCK_REQUEST',roles:'ADMIN,CLIENT,TECHNICIAN',channels:'INTERNAL',active:true}});
  const beforeNotifications=await prisma.notification.count({where:{eventType:'TECHNICIAN_STOCK_REQUEST'}});
  async function send(payload, host = base, actor = credential, drop = false) { const response = await fetch(host + '/api/technician/stock-reminders', { method: 'POST', headers: { Authorization: 'Bearer ' + actor, 'Content-Type': 'application/json', ...(drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: JSON.stringify(payload) }); return { status: response.status, data: await response.json() }; }
  let second = await start(); await assert.rejects(send(body, second, credential, true)); await stop(); second = await start();
  const results = await Promise.all(Array.from({ length: 6 }, (_, index) => send(body, index % 2 ? second : base)));
  for (const result of results) { assert.equal(result.status, 200); assert.deepEqual(result.data, results[0].data); }
  const receipt = results[0].data, notification = await prisma.notification.findUniqueOrThrow({ where: { id: receipt.stockRequest.notificationId } });
  assert.equal(await prisma.notification.count({where:{eventType:'TECHNICIAN_STOCK_REQUEST'}}),beforeNotifications+1,'Audience rules must not duplicate or forward a private office request');
  assert(notification.message.includes(body.message)); assert.equal(notification.metadata.technicianId,tech.id); assert.equal(notification.role, 'ADMIN'); assert.equal(notification.clientId, null); assert.equal(notification.userId, null); assert.equal(notification.isRead, false);
  assert.equal(await prisma.notification.count({ where: { eventType: 'TECHNICIAN_STOCK_REQUEST', metadata: { path: ['requestId'], equals: body.requestId } } }), 1);
  assert.equal(await prisma.auditTrail.count({ where: { eventType: 'TECHNICIAN_STOCK_REQUEST', entityId: notification.id } }), 1);
  assert.equal(receipt.receipt.scope,'FIELD_STOCK_REQUEST');
  assert.equal(receipt.receipt.owner,'TECH:'+tech.id);
  assert.equal(await prisma.operationalReminder.count({where:{metadata:{path:['requestId'],equals:body.requestId}}}),1);
  const reminder=await prisma.operationalReminder.findUniqueOrThrow({where:{id:receipt.stockRequest.reminderId}});assert.equal(reminder.assignedToTechnicianId,null);assert.equal(reminder.poolId,pool.id);assert.equal(reminder.clientId,client.id);
  assert.equal((await send({ ...body, message: 'Changed' })).status, 409); assert.equal((await send({ ...body, recipientRole: 'CLIENT' })).status, 400);
  assert.equal((await send(body, base, otherCredential)).status, 403); assert.equal((await send(body, base, clientCredential)).status, 403); assert.equal((await send(body, base, adminCredential)).status, 403);
  const notices = async auth => fetch(base + '/api/notifications', { headers: { Authorization: 'Bearer ' + auth } }).then(response => response.json());
  for (const auth of [credential, otherCredential, clientCredential]) assert(!(await notices(auth)).notifications.some(row => row.id === notification.id), 'Alert leaked to a non-admin recipient');
  assert((await notices(adminCredential)).notifications.some(row => row.id === notification.id));
  const listed = await fetch(base + '/api/alerts', { headers: { Authorization: 'Bearer ' + adminCredential } }).then(response => response.json());
  assert(listed.alerts.some(row => row.id === 'notification-' + notification.id && row.technicianName === tech.name && row.message.includes(body.message)));
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { technicianId: other.id } }); assert.deepEqual((await send(body)).data, receipt); assert.equal((await send({ ...body, requestId: randomUUID() })).status, 403);
  console.log('PASS original ADMIN stock request receipt across lost response/restart and six requests/two processes; one notification/reminder/audit and no CLIENT/TECH visibility');

  const general = {...body,requestId:randomUUID(),visitId:null,poolId:null,priority:'NORMAL',message:'Material sem piscina associada'};
  trigger = true; await prisma.$executeRawUnsafe("CREATE FUNCTION qa_stock_request_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA stock receipt failure'; END $$"); await prisma.$executeRawUnsafe('CREATE TRIGGER qa_stock_request_failure BEFORE INSERT ON "FieldWriteRequest" FOR EACH ROW EXECUTE FUNCTION qa_stock_request_failure()');
  try { assert.equal((await send(general, second)).status, 503); assert.equal(await prisma.notification.count({ where: { metadata: { path: ['requestId'], equals: general.requestId } } }), 0); assert.equal(await prisma.auditTrail.count({ where: { metadata: { path: ['requestId'], equals: general.requestId } } }), 0); assert.equal(await prisma.operationalReminder.count({where:{metadata:{path:['requestId'],equals:general.requestId}}}),0); }
  finally { await clearTrigger(); }
  const saved = await send(general); assert.equal(saved.status, 200); assert.equal(saved.data.stockRequest.visitId, null);
  for (const changed of [{ ...general, requestId: randomUUID(), message:'',productName:'' }, { ...general, requestId: randomUUID(), visitId: '1' }, { ...general, requestId: randomUUID(), priority: 'CLIENT' }]) assert.equal((await send(changed)).status, 400);
  console.log('PASS receipt failure rolls back notification/reminder/audit; general request recovers with explicit null visit and malformed fields are refused');

  for(const patch of [{quantity:'0'},{quantity:'-1'},{quantity:'1e2'},{quantity:'2',unit:''},{quantity:'1000001'},{visitType:'EXTRA'},{visitId:'1'},{productName:'x'.repeat(201)},{clientId:client.id},{technicianId:other.id},{vehicleId:999},{requestId:'bad-id'}])assert.equal((await send({...general,requestId:randomUUID(),...patch})).status,400);
  assert.equal((await send({...body,requestId:randomUUID(),poolId:pool.id+1},base,otherCredential)).status,409);
  const legacy={visitId:visit.id,poolId:pool.id,clientId:client.id,technicianId:other.id,requestType:'PURCHASE_REMINDER',priority:'NORMAL',productName:'Luvas',quantity:2,unit:'pares',message:'Pedido antigo validado'};
  const legacySaved=await send(legacy,base,otherCredential);assert.equal(legacySaved.status,200);assert.equal(legacySaved.data.confirmationMode,'LEGACY_NO_REQUEST_ID');assert(legacySaved.data.notification.id&&legacySaved.data.reminder.id);assert.equal(legacySaved.data.notification.clientId,null);
  for(const patch of [{technicianId:tech.id},{poolId:pool.id+1},{clientId:client.id+1},{vehicleId:999999}])assert.equal((await send({...legacy,...patch},base,otherCredential)).status,403);
  console.log('PASS exact types, positive quantities and units; legacy context derives from actual assignment and rejects forged actors, pools, clients and vehicles');
  const user=await prisma.user.create({data:{email:tech.email,name:'Linked stock account',password:'qa-unused',active:true,role:'TECHNICIAN'}}),linked=token({id:user.id,userId:user.id,technicianId:tech.id,principalType:'USER',role:'TECHNICIAN'});
  const linkedResult=await send({...general,requestType:'ADMIN_NOTE',productName:'',quantity:'',unit:''},base,linked);assert.equal(linkedResult.status,200);assert.equal(linkedResult.data.receipt.owner,`USER:${user.id}:TECH:${tech.id}`);assert.equal(linkedResult.data.stockRequest.technicianId,tech.id);assert.notEqual(linkedResult.data.stockRequest.notificationId,saved.data.stockRequest.notificationId);
  const leader=await prisma.technician.create({data:{name:'Stock leader',active:true,role:'TEAM_LEADER'}}),leaderResult=await send({...general,requestId:randomUUID()},base,token({id:leader.id,role:'TEAM_LEADER'}));assert.equal(leaderResult.status,200);assert.equal(leaderResult.data.stockRequest.technicianId,leader.id);
  await prisma.technician.update({where:{id:leader.id},data:{active:false}});assert.equal((await send({...general,requestId:randomUUID()},base,token({id:leader.id,role:'TEAM_LEADER'}))).status,401);
  console.log('PASS linked User and team leader retain authenticated Technician identity; owner namespaces are isolated and inactive sessions cannot write');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await clearTrigger(); await stop(); if(rule)await prisma.notificationRule.delete({where:{id:rule.id}}); await prisma.$disconnect(); });
