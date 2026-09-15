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
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  async function api(path, options = {}, expected = 200) {
    const response = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } });
    const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
  }
  const client = await prisma.client.create({ data: { name: 'Lista lembretes QA' } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina com histórico' } });
  const dueAt = new Date('2028-01-01T10:00:00Z');
  const seed = (status, count) => prisma.generalReminder.createMany({ data: Array.from({ length: count }, (_, i) => ({ title: `${status} ${i}`, poolId: pool.id, clientId: client.id, category: 'TECHNICAL_PERIODIC_SERVICE', dueAt, status, ...(status === 'DONE' ? { completedAt: dueAt } : {}) })) });
  await seed('DONE', 105); await seed('PENDING', 505);
  const other = await prisma.generalReminder.create({ data: { title: 'Other pool QA', poolId: pool.id + 100000, category: 'TECHNICAL_PERIODIC_SERVICE', dueAt } });
  const list = (await api(`/api/core/pools/${pool.id}/service-reminders`)).reminders;
  assert.equal(list.filter(r => r.status === 'PENDING').length, 505, 'Pending reminders must not disappear behind history or a result cap');
  assert.equal(list.length, 610); assert(!list.some(r => r.id === other.id));
  assert.equal(list[0].status, 'PENDING'); assert.equal(list.at(-1).status, 'DONE');
  const crm = (await api('/api/crm/reminders?category=TECHNICAL_PERIODIC_SERVICE')).reminders;
  assert.equal(crm.filter(r => r.poolId === pool.id).length, 610);
  assert.equal((await api('/api/agenda/reminders?status=PENDING&category=TECHNICAL_PERIODIC_SERVICE')).reminders.filter(r => r.poolId === pool.id).length, 505);
  const closed = (await api('/api/crm/reminders?status=DONE')).reminders;
  assert.equal(closed.filter(r => r.poolId === pool.id).length, 105); assert(closed.every(r => r.status === 'DONE'));
  assert.equal(await prisma.generalReminder.count({ where: { poolId: pool.id } }), 610);
  console.log('PASS 505 pending + 105 historical reminders, pending-first order, exact pool, CRM/agenda filters and read-only history');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
