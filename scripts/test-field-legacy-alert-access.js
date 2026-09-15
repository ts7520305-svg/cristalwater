'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const { resolutionVersion } = require('../src/services/alertResolutionStateService');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Acesso legado QA', active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Técnico legado QA', active: true } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina privada QA' } });
  const alert = await prisma.technicalAlert.create({ data: { poolId: pool.id, type: 'FILTER_LEAK', message: 'Registo privado', status: 'OPEN' } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' }), tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' });
  async function call(path, token, method = 'GET', body) { const r = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; }
  const listing = '/api/client-auth', target = `${listing}/${alert.id}/resolve`;
  const anonymous = await call(listing); console.log(JSON.stringify({ anonymousStatus: anonymous.status, expected: 401 })); assert.equal(anonymous.status, 401);
  for (const [token, expected] of [[null, 401], [ct, 403], [tt, 403]]) {
    assert.equal((await call(listing, token)).status, expected);
    assert.equal((await call(target, token, 'PUT', {})).status, expected);
  }
  assert.equal((await prisma.technicalAlert.findUniqueOrThrow({ where: { id: alert.id } })).status, 'OPEN');
  const listed = await call(listing, at); assert.equal(listed.status, 200); assert(Array.isArray(listed.body)); assert(listed.body.some(a => a.id === alert.id));
  const physical = await prisma.technicalAlert.create({ data: { poolId: pool.id, type: 'WATER_OPEN', message: 'Água aberta', status: 'OPEN' } });
  const blocked = await call(`${listing}/${physical.id}/resolve`, at, 'PUT', {});
  assert.equal(blocked.status, 409); assert.equal(blocked.body.code, 'PHYSICAL_CONFIRMATION_REQUIRED');
  assert.equal((await prisma.technicalAlert.findUniqueOrThrow({ where: { id: physical.id } })).status, 'OPEN');
  const expectedVersion = resolutionVersion('technical', alert);
  const replies = await Promise.all(Array.from({ length: 8 }, (_, i) => call(i % 2 ? target : `/api/alerts/technical-${alert.id}/resolve`, at, 'PUT', { expectedVersion })));
  assert(replies.every(r => r.status === 200), JSON.stringify(replies));
  assert(replies.every(r => r.body.reference === `technical-${alert.id}`));
  assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: { startsWith: `alert-resolution:technical-${alert.id}:` } } }), 1);
  await prisma.technicalAlert.update({ where: { id: alert.id }, data: { status: 'OPEN', message: 'Nova ocorrência' } });
  assert.equal((await call(target, at, 'PUT', { expectedVersion })).status, 409);
  for (const id of ['0', '1x', 'notification-1', '2147483648']) assert.equal((await call(`${listing}/${id}/resolve`, at, 'PUT', {})).status, 400);
  const login = await call('/api/client-auth/login', null, 'POST', { email: 'invalid@qa.test', password: 'invalid' });
  assert.equal(login.status, 200); assert.equal(login.body.ok, false);
  console.log('PASS legacy alert routes require ADMIN; physical closure and exact shared resolution acknowledgements cannot be bypassed; login stays public');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
