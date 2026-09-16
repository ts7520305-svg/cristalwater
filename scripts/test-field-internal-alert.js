'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let child, trigger = false;
async function start() { child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore','ignore','ignore','ipc'] }); return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA child timeout')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve('http://127.0.0.1:' + port); }); }); }
async function stop() { if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function clearTrigger() { if (!trigger) return; await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_internal_alert_failure ON "FieldWriteRequest"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_internal_alert_failure()'); trigger = false; }
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Internal alert owner', active: true } }), other = await prisma.technician.create({ data: { name: 'Internal alert other', active: true } });
  const client = await prisma.client.create({ data: { name: 'Internal alert client', active: true } }), pool = await prisma.pool.create({ data: { name: 'Internal alert pool', active: true, clientId: client.id } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, plannedDate: new Date(), status: 'PLANNED' } });
  const token = actor => jwt.sign(actor, getJwtSecret(), { expiresIn: '1h' });
  const credential = token({ id: tech.id, role: 'TECHNICIAN' }), otherCredential = token({ id: other.id, role: 'TECHNICIAN' }), clientCredential = token({ id: client.id, role: 'CLIENT' });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), adminCredential = token({ id: admin.id, role: 'ADMIN' });
  const body = { requestId: randomUUID(), message: 'Texto original: avaria da bomba', visitId: visit.id, priority: 'HIGH' };
  async function send(payload, host = base, actor = credential, drop = false) { const response = await fetch(host + '/api/visits/internal-alert', { method: 'POST', headers: { Authorization: 'Bearer ' + actor, 'Content-Type': 'application/json', ...(drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: JSON.stringify(payload) }); return { status: response.status, data: await response.json() }; }
  let second = await start(); await assert.rejects(send(body, second, credential, true)); await stop(); second = await start();
  const results = await Promise.all(Array.from({ length: 6 }, (_, index) => send(body, index % 2 ? second : base)));
  for (const result of results) { assert.equal(result.status, 200); assert.deepEqual(result.data, results[0].data); }
  const receipt = results[0].data, notification = await prisma.notification.findUniqueOrThrow({ where: { id: receipt.alert.id } });
  assert.equal(notification.message, body.message); assert.equal(notification.role, 'ADMIN'); assert.equal(notification.clientId, null); assert.equal(notification.userId, null); assert.equal(notification.isRead, false);
  assert.equal(await prisma.notification.count({ where: { eventType: 'TECHNICIAN_INTERNAL_ALERT', metadata: { path: ['requestId'], equals: body.requestId } } }), 1);
  assert.equal(await prisma.auditTrail.count({ where: { eventType: 'TECHNICIAN_INTERNAL_ALERT', entityId: notification.id } }), 1);
  assert.equal((await send({ ...body, message: 'Changed' })).status, 409); assert.equal((await send({ ...body, recipientRole: 'CLIENT' })).status, 400);
  assert.equal((await send(body, base, otherCredential)).status, 403); assert.equal((await send(body, base, clientCredential)).status, 403); assert.equal((await send(body, base, adminCredential)).status, 403);
  const notices = async auth => fetch(base + '/api/notifications', { headers: { Authorization: 'Bearer ' + auth } }).then(response => response.json());
  for (const auth of [credential, otherCredential, clientCredential]) assert(!(await notices(auth)).notifications.some(row => row.id === notification.id), 'Alert leaked to a non-admin recipient');
  assert((await notices(adminCredential)).notifications.some(row => row.id === notification.id));
  const listed = await fetch(base + '/api/alerts', { headers: { Authorization: 'Bearer ' + adminCredential } }).then(response => response.json());
  assert(listed.alerts.some(row => row.id === 'notification-' + notification.id && row.technicianName === tech.name && row.message === body.message));
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { technicianId: other.id } }); assert.deepEqual((await send(body)).data, receipt); assert.equal((await send({ ...body, requestId: randomUUID() })).status, 403);
  console.log('PASS original ADMIN alert receipt across lost response/restart and six requests/two processes; one notification/audit and no CLIENT/TECH visibility');

  const general = { requestId: randomUUID(), message: 'Material necessário sem piscina associada', visitId: null, priority: 'NORMAL' };
  trigger = true; await prisma.$executeRawUnsafe("CREATE FUNCTION qa_internal_alert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA alert receipt failure'; END $$"); await prisma.$executeRawUnsafe('CREATE TRIGGER qa_internal_alert_failure BEFORE INSERT ON "FieldWriteRequest" FOR EACH ROW EXECUTE FUNCTION qa_internal_alert_failure()');
  try { assert.equal((await send(general, second)).status, 503); assert.equal(await prisma.notification.count({ where: { metadata: { path: ['requestId'], equals: general.requestId } } }), 0); assert.equal(await prisma.auditTrail.count({ where: { metadata: { path: ['requestId'], equals: general.requestId } } }), 0); }
  finally { await clearTrigger(); }
  const saved = await send(general); assert.equal(saved.status, 200); assert.equal(saved.data.alert.visitId, null);
  for (const changed of [{ ...general, requestId: randomUUID(), message: '' }, { ...general, requestId: randomUUID(), visitId: '1' }, { ...general, requestId: randomUUID(), priority: 'CLIENT' }]) assert.equal((await send(changed)).status, 400);
  console.log('PASS receipt failure rolls back alert/audit; general alert recovers with explicit null visit and malformed fields are refused');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await clearTrigger(); await stop(); await prisma.$disconnect(); });
