'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const service = require('../src/services/clientClosureService');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const prefix = 'QA_PORTAL_CLOSURE_' + randomUUID(), closures = [], clients = []; let staff, tech, probe;
const sign = body => jwt.sign(body, getJwtSecret(), body.exp === undefined ? { expiresIn: '1h' } : {});
(async () => {
  for (let i = 0; i < 3; i++) clients.push(await prisma.client.create({ data: { name: prefix + i, active: i !== 2 } }));
  const [a, b, inactive] = clients, admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  staff = await prisma.user.create({ data: { id: a.id + 1500000000, email: prefix + '@qa.test', name: prefix, role: 'CLIENT', password: 'qa-unused', active: true } });
  clients.push(await prisma.client.create({ data: { id: staff.id, name: prefix + 'collision', active: true } }));
  tech = await prisma.technician.create({ data: { name: prefix, active: true } });
  const actor = { id: a.id, clientId: a.id, role: 'CLIENT', principalType: 'CLIENT' }, token = sign(actor), adminToken = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const call = async (id = a.id, credential = token, suffix = '', origin = base, method = 'GET') => {
    const response = await fetch(origin + `/api/client-portal/${id}/company-closures` + suffix, { method, headers: credential ? { Authorization: 'Bearer ' + credential } : {} });
    return { status: response.status, headers: response.headers, body: method === 'HEAD' ? null : await response.json() };
  };
  const now = new Date(), start = new Date(now.getTime() - 86400000), end = new Date(now.getTime() + 86400000);
  async function add(extra = {}) {
    const row = await prisma.companyClosure.create({ data: { title: prefix, status: 'ACTIVE', startDate: start, endDate: end, showOnClientPortal: true, messageTitle: 'Aviso aos clientes', messageBody: 'De {startDate} até {endDate}', emergencyPhone: '+351 000 000 000', emergencyEmail: 'urgencias@qa.invalid', metadata: { private: 'PRIVATE_CLOSURE_METADATA' }, exceptionRules: { secret: true }, affectedServiceTypes: ['PRIVATE_SERVICE'], routeAction: 'CREATE_REPLAN_TASKS', createdByUserId: admin.id, ...extra } });
    closures.push(row.id); return row;
  }
  const active = await add(), future = await add({ startDate: new Date('2095-02-07T11:22:33Z'), endDate: new Date('2095-02-08T00:00:00Z'), messageTitle: null, messageBody: null });
  const excluded = [await add({ status: 'PLANNED' }), await add({ status: 'CANCELLED' }), await add({ showOnClientPortal: false }), await add({ startDate: new Date('2000-01-01'), endDate: new Date('2000-01-02') })];
  const original = await prisma.companyClosure.findMany({ where: { id: { in: closures } }, orderBy: { id: 'asc' } });
  const counts = () => Promise.all(['invoice', 'payment', 'serviceVisit', 'notification', 'userAuditLog', 'fieldWriteRequest'].map(model => prisma[model].count())), before = await counts();
  for (const [id, credential] of [[a.id, token], [b.id, sign({ id: b.id, role: 'CUSTOMER' })], [a.id, adminToken], [b.id, adminToken]]) {
    const result = await call(id, credential); assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.headers.get('cache-control'), 'private, no-store'); assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(result.headers.get('x-cw-portal-type'), 'company-closure-list'); assert.equal(result.headers.get('x-cw-client-id'), String(id));
    assert.equal(result.body.clientId, id); assert.equal(result.body.timeZone, 'UTC');
    for (const row of [active, future]) assert(result.body.closures.some(item => item.id === row.id));
    for (const row of excluded) assert(!result.body.closures.some(item => item.id === row.id));
    for (const row of result.body.closures) assert.deepEqual(Object.keys(row).sort(), ['id', 'title', 'message', 'startDate', 'endDate', 'emergencyPhone', 'emergencyEmail'].sort());
    assert(!JSON.stringify(result.body).includes('PRIVATE_CLOSURE_METADATA')); assert(!JSON.stringify(result.body).includes('PRIVATE_SERVICE'));
    const next = result.body.closures.find(row => row.id === future.id); assert.equal(next.startDate, future.startDate.toISOString()); assert.equal(next.endDate, future.endDate.toISOString()); assert.equal(next.title, prefix); assert(next.message.includes('2095-02-07')); assert(next.message.includes('2095-02-08'));
  }
  for (const method of ['GET', 'HEAD']) {
    for (const [id, credential, status] of [[a.id, null, 401], [a.id, 'invalid', 401], [a.id, sign({ id: a.id, role: 'CLIENT', exp: 1 }), 401], [b.id, token, 403], [a.id, sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' }), 403], [staff.id, sign({ id: staff.id, userId: staff.id, role: 'CLIENT', principalType: 'USER' }), 403], [inactive.id, sign({ id: inactive.id, role: 'CLIENT' }), 401]]) {
      const result = await call(id, credential, '', base, method); assert.equal(result.status, status); assert.equal(result.headers.get('cache-control'), 'private, no-store');
    }
  }
  assert.equal((await call('0' + a.id)).status, 400); assert.equal((await call('2147483648', adminToken)).status, 400);
  assert.equal((await call(2147483647, adminToken)).status, 404); assert.equal((await call(a.id, token, '?status=PLANNED')).status, 400);
  assert.equal((await fetch(base + '/api/company-closures', { headers: { Authorization: 'Bearer ' + token } })).status, 403);
  assert.deepEqual(await prisma.companyClosure.findMany({ where: { id: { in: closures } }, orderBy: { id: 'asc' } }), original); assert.deepEqual(await counts(), before);
  const exact = await service.list(actor, String(a.id), {}, prisma, future.endDate); assert(exact.closures.some(row => row.id === future.id));
  const afterEnd = await service.list(actor, String(a.id), {}, prisma, new Date(future.endDate.getTime() + 1)); assert(!afterEnd.closures.some(row => row.id === future.id));
  await prisma.companyClosure.update({ where: { id: active.id }, data: { status: 'CANCELLED' } }); assert(!(await call()).body.closures.some(row => row.id === active.id));
  await prisma.companyClosure.update({ where: { id: future.id }, data: { showOnClientPortal: false } }); assert(!(await call()).body.closures.some(row => row.id === future.id));
  for (let i = 0; i < 101; i++) await add({ title: prefix + 'limit ' + i, startDate: new Date('2000-01-01'), endDate: new Date('2099-01-01') });
  const capped = await call(); assert.equal(capped.body.complete, false); assert.equal(capped.body.limit, 100); assert.equal(capped.body.closures.length, 100);
  const oldList = service.list, app = require('express')(); app.use('/api/client-portal', require('../src/routes/clientPortalRoutes'));
  probe = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  try { service.list = async () => { throw Error('PRIVATE_DATABASE_FAILURE'); }; const failed = await call(a.id, token, '', 'http://127.0.0.1:' + probe.address().port); assert.equal(failed.status, 503); assert(!JSON.stringify(failed.body).includes('PRIVATE_DATABASE_FAILURE')); assert(!('closures' in failed.body)); }
  finally { service.list = oldList; }
  assert.deepEqual(await counts(), before);
  console.log('PASS client closures API: authenticated customer ownership and ADMIN preview, typed identity collisions refused, public field whitelist, future/current/hidden/cancelled/expired states, exact UTC boundaries, source preservation, explicit cap, no writes or external sends, sanitized failure');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (probe) await new Promise(resolve => probe.close(resolve));
  await prisma.companyClosure.deleteMany({ where: { id: { in: closures } } });
  if (staff) await prisma.user.delete({ where: { id: staff.id } });
  if (tech) await prisma.technician.delete({ where: { id: tech.id } });
  await prisma.client.deleteMany({ where: { id: { in: clients.map(row => row.id) } } }); await prisma.$disconnect();
});
