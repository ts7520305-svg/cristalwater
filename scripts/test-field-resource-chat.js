'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Resource chat QA', email: 'private@qa.test', phone: '900000000', fiscalNif: '123456789', monthlyFee: 900, active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Assigned pool QA', clientId: client.id, active: true, monthlyAmount: 900 } });
  const tech = await prisma.technician.create({ data: { name: 'Chat tech QA', active: true, pin: 'private-pin-qa' } });
  const other = await prisma.technician.create({ data: { name: 'Other chat tech QA', active: true } });
  const leader = await prisma.technician.create({ data: { name: 'Chat leader QA', active: true, role: 'TEAM_LEADER' } });
  const visit = await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, technicianId: tech.id, status: 'PLANNED' } });
  const service = await prisma.service.create({ data: { poolId: pool.id, technicianId: tech.id, status: 'PENDING' } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' });
  const tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' });
  const ot = sign({ id: other.id, technicianId: other.id, role: 'TECHNICIAN' }), lt = sign({ id: leader.id, technicianId: leader.id, role: 'TEAM_LEADER' });
  async function call(path, token, method = 'GET', body) { const r = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') }; }
  const paths = [`/api/poolChat/${pool.id}`, `/api/pool-chat/${pool.id}`, `/api/serviceChat/${service.id}`, `/api/service-chat/${service.id}`];
  const anonymous = await call(paths[0]); console.log(JSON.stringify({ anonymousPoolChat: anonymous.status, expected: 401 })); assert.equal(anonymous.status, 401);
  for (const [token, expected] of [[null, 401], [ct, 403], [ot, 404], [lt, 404]]) for (const path of paths) {
    assert.equal((await call(path, token)).status, expected, path);
    assert.equal((await call(path, token, 'POST', { text: 'Forbidden', senderType: 'ADMIN' })).status, expected, path);
  }
  assert.equal(await prisma.poolMessage.count({ where: { poolId: pool.id } }), 0);
  assert.equal(await prisma.serviceMessage.count({ where: { serviceId: service.id } }), 0);
  for (const path of paths) {
    const listed = await call(path, tt); assert.equal(listed.status, 200, JSON.stringify(listed.body)); assert.equal(listed.cache, 'private, no-store');
    const p = listed.body.pool || listed.body.service.pool;
    for (const secret of ['email', 'phone', 'fiscalNif', 'monthlyFee', 'password', 'pin']) assert(!(secret in p.client), secret);
    assert(!('monthlyAmount' in p)); if (listed.body.service) assert(!('pin' in listed.body.service.technician));
    const sent = await call(path, tt, 'POST', { text: '  Technical note  ', senderType: 'ADMIN' }); assert.equal(sent.status, 200); assert.equal(sent.body.senderType, 'TECH'); assert.equal(sent.body.text, 'Technical note');
    const adminSent = await call(path, at, 'POST', { text: 'Administrative note', senderType: 'TECH' }); assert.equal(adminSent.body.senderType, 'ADMIN');
    assert.equal((await call(path, tt, 'POST', { text: {} })).status, 400);
    assert.equal((await call(path, tt, 'POST', { text: 'x'.repeat(4001) })).status, 400);
  }
  assert.equal((await call(`/api/pool-chat/0`, at)).status, 400);
  assert.equal((await call(`/api/service-chat/1.5`, at)).status, 400);
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { technicianId: other.id } });
  await prisma.service.update({ where: { id: service.id }, data: { technicianId: other.id } });
  for (const path of paths) {
    assert.equal((await call(path, tt)).status, 404);
    assert.equal((await call(path, tt, 'POST', { text: 'Forbidden after reassignment' })).status, 404);
    assert.equal((await call(path, ot)).status, 200);
  }
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { technicianId: leader.id } });
  await prisma.service.update({ where: { id: service.id }, data: { technicianId: leader.id } });
  for (const path of paths) assert.equal((await call(path, lt)).status, 200);
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { status: 'COMPLETED', endAt: new Date() } });
  await prisma.service.update({ where: { id: service.id }, data: { status: 'COMPLETED' } });
  assert.equal((await call(paths[0], lt)).status, 404, 'Completed assignments do not authorize pool history');
  assert.equal((await call(paths[2], lt)).status, 200, 'Assigned service history remains readable');
  assert.equal((await call(paths[2], lt, 'POST', { text: 'Closed service write' })).status, 409);
  const audit = await prisma.userAuditLog.findFirstOrThrow({ where: { entity: 'PoolMessage', action: 'RESOURCE_CHAT_SENT', actor: `TECHNICIAN:${tech.id}` } }); assert.equal(audit.metadata.resourceId, pool.id);
  await prisma.technician.update({ where: { id: leader.id }, data: { active: false } });
  assert.equal((await call(paths[2], lt)).status, 401);
  console.log('PASS resource chat aliases require assignment and active identity; forged sender ignored, contact/financial/authentication data removed, reassignment revokes access');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
