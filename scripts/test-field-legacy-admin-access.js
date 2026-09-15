'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { name: 'Legacy access QA', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Private pool QA', clientId: client.id, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Legacy tech QA', active: true } });
  const leader = await prisma.technician.create({ data: { name: 'Legacy leader QA', active: true, role: 'TEAM_LEADER' } });
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const at = sign({ id: admin.id, role: 'ADMIN' }), ct = sign({ id: client.id, role: 'CLIENT' });
  const tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' });
  const lt = sign({ id: leader.id, technicianId: leader.id, role: 'TEAM_LEADER' });
  async function call(path, token, method = 'GET', body) {
    const r = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  }
  const anonymous = await call('/api/pools');
  console.log(JSON.stringify({ anonymousPools: anonymous.status, expected: 401 }));
  assert.equal(anonymous.status, 401);
  const reads = ['/api/pools', '/api/routes/auto-plan', `/api/routes/today/${tech.id}`, '/api/metrics/productivity',
    '/api/notification-rules', '/api/notification-rules/payment-policy', '/api/zones', '/api/extras', '/api/extra-visits',
    '/api/pool-equipment', '/api/poolEquipment', '/api/technical-history', '/api/technicalHistory', `/api/history/pool/${pool.id}`,
    '/api/round-planner/week', '/api/admin/email-logs', '/api/communications', '/api/location-logs', '/api/location-logs/seed',
    '/api/tasks', '/api/stats/summary', '/api/customers', `/api/pool-calculations/${pool.id}`, `/api/calculator/${pool.id}`,
    '/api/company-closures', '/api/closures', '/api/operational-risk/summary', '/api/brain/status', '/api/platform/status',
    '/api/business/summary', '/api/real-business/clients/first', '/API/PoOlS/', `/api/poolEquipment/${pool.id}/registry`];
  const writes = [
    [`/api/pools/${pool.id}`, 'PUT', { name: 'Forbidden change' }], [`/api/pools/${pool.id}/archive`, 'POST', {}],
    ['/api/pools', 'POST', { name: 'Forbidden', clientId: client.id }], ['/api/zones', 'POST', { name: 'Forbidden' }],
    ['/api/tasks', 'POST', { title: 'Forbidden' }], ['/api/customers', 'POST', { name: 'Forbidden' }],
    ['/api/notification-rules/payment-policy', 'PUT', { enabled: false }], ['/api/operational-risk/rules', 'PUT', { enabled: false }],
    [`/api/reminders/${client.id}`, 'POST', {}], ['/api/round-planner/generate', 'POST', {}],
    ['/api/admin/email/retry-failed/1', 'POST', {}], ['/api/ai/ask', 'POST', { question: 'Private context' }],
    ['/api/brain/ask', 'POST', { question: 'Private context' }], ['/api/brain/quality/smoke-test', 'POST', {}],
    ['/api/company-closures', 'POST', { title: 'Forbidden', startDate: '2026-01-01', endDate: '2026-01-02' }],
    [`/api/pool-equipment/${pool.id}/assets/install`, 'POST', { type: 'PUMP' }],
    ['/api/technicalHistory', 'POST', { poolId: pool.id, type: 'QA', description: 'Forbidden' }]
  ];
  const before = { pools: await prisma.pool.count(), zones: await prisma.zone.count(), logs: await prisma.locationLog.count(), closures: await prisma.companyClosure.count() };
  for (const [token, expected] of [[null, 401], [ct, 403], [tt, 403], [lt, 403]]) {
    for (const path of reads) assert.equal((await call(path, token)).status, expected, path);
    for (const [path, method, body] of writes) assert.equal((await call(path, token, method, body)).status, expected, `${method} ${path}`);
  }
  assert.deepEqual({ pools: await prisma.pool.count(), zones: await prisma.zone.count(), logs: await prisma.locationLog.count(), closures: await prisma.companyClosure.count() }, before);
  assert.deepEqual(await prisma.pool.findUniqueOrThrow({ where: { id: pool.id } }), pool);
  assert.equal((await call('/api/pools', 'invalid')).status, 401);
  await prisma.technician.update({ where: { id: tech.id }, data: { active: false } });
  assert.equal((await call('/api/pools', tt)).status, 401);
  await prisma.technician.update({ where: { id: tech.id }, data: { active: true } });
  const listed = await call('/api/pools', at); assert.equal(listed.status, 200); assert(listed.body.pools.some(row => row.id === pool.id));
  assert.equal((await call(`/api/pools/${pool.id}`, at, 'PUT', { name: 'Authorized change' })).status, 200);
  assert.equal((await prisma.pool.findUniqueOrThrow({ where: { id: pool.id } })).name, 'Authorized change');
  for (const path of ['/api/zones', '/api/notification-rules', '/api/company-closures', '/api/platform/status', `/api/poolEquipment/${pool.id}/registry`]) assert.equal((await call(path, at)).status, 200, path);
  assert.equal((await call('/api/core/health')).status, 200);
  assert.equal((await call(`/api/client-portal/${client.id}`, ct)).status, 200);
  assert.equal((await call('/api/route/optimize?lat=37&lng=-8', tt)).status, 200);
  console.log('PASS legacy administration reads, mutations, aliases and AI require active ADMIN; refused requests are inert, administration and canonical field/client routes remain usable');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
