'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const { randomInt, randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
const pdfText = require('./lib/reportPdfText');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
async function get(path, token, method = 'GET', headers = {}) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers } });
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}
function refused(row, status) {
  assert.equal(row.status, status, row.bytes.toString());
  assert.match(row.headers.get('cache-control'), /private.*no-store/);
  assert(!row.bytes.toString().includes('MONTHLY_PRIVATE'));
  assert(!row.bytes.toString().startsWith('%PDF-'));
}
(async () => {
  const stamp = randomUUID(), collision = randomInt(1000000000, 1900000000);
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const client = await prisma.client.create({ data: { id: collision, name: 'MONTHLY_PRIVATE_CLIENT', active: true } });
  const other = await prisma.client.create({ data: { name: 'MONTHLY_PRIVATE_OTHER', active: true } });
  const tech = await prisma.technician.create({ data: { id: collision, name: 'Monthly report technician', role: 'TEAM_LEADER', active: true, email: stamp + '@qa.test' } });
  const user = await prisma.user.create({ data: { id: collision, name: 'Monthly report staff', email: tech.email, password: 'qa-only', role: 'TECHNICIAN', active: true } });
  const own = await prisma.monthlyReport.create({ data: { type: 'CLIENT', clientId: client.id, month: '2097-04', data: { client: client.name, paymentStatus: 'PENDING', pools: [{ name: 'MONTHLY_PRIVATE_POOL', totalVisits: 7, notDone: 1 }] } } });
  const earlier = await prisma.monthlyReport.create({ data: { type: 'CLIENT', clientId: client.id, month: '2097-03', data: { client: client.name, paymentStatus: 'PAID', pools: [] } } });
  const foreign = await prisma.monthlyReport.create({ data: { type: 'CLIENT', clientId: other.id, month: own.month, data: { client: other.name, paymentStatus: 'PAID', pools: [] } } });
  const internal = await prisma.monthlyReport.create({ data: { type: 'ADMIN', clientId: client.id, month: own.month, data: { secret: 'MONTHLY_PRIVATE_ADMIN' } } });
  const extra = await prisma.monthlyReport.create({ data: { type: 'EXTRA_VISITS', clientId: client.id, month: own.month, data: { items: [{ secret: 'MONTHLY_PRIVATE_EXTRA' }] } } });
  const orphan = await prisma.monthlyReport.create({ data: { type: 'CLIENT', month: '2097-04', data: { client: 'MONTHLY_PRIVATE_ORPHAN', paymentStatus: 'PAID', pools: [] } } });
  const at = sign({ id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' });
  const ct = sign({ id: client.id, clientId: client.id, role: 'CLIENT', principalType: 'CLIENT' });
  const ot = sign({ id: other.id, clientId: other.id, role: 'CLIENT', principalType: 'CLIENT' });
  const tt = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
  const lt = sign({ id: tech.id, technicianId: tech.id, role: 'TEAM_LEADER', principalType: 'TECHNICIAN' });
  const ut = sign({ id: tech.id, userId: user.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'USER' });
  const list = id => '/api/client-reports/' + id + '/reports';
  const scoped = (id, reportId) => list(id) + '/' + reportId + '/pdf';
  const legacy = id => '/api/client/client/reports/' + id + '/pdf';
  const paths = [list(client.id), scoped(client.id, own.id), legacy(own.id)];
  // Reproduces the cross-table identity collision in every mounted client-report route.
  const probes = [];
  for (const path of paths) probes.push((await get(path, tt)).status);
  console.log(JSON.stringify({ collidingTechnicianStatuses: probes, expected: [403, 403, 403] }));
  assert.deepEqual(probes, [403, 403, 403]);
  const snapshot = await prisma.monthlyReport.findMany({ where: { id: { in: [own.id, earlier.id, foreign.id, internal.id, extra.id, orphan.id] } }, orderBy: { id: 'asc' } });
  const counts = () => Promise.all(['invoice', 'payment', 'userAuditLog', 'clientReportSetting'].map(model => prisma[model].count()));
  const before = await counts();
  for (const path of paths) {
    for (const method of ['GET', 'HEAD']) {
      for (const token of [tt, lt, ut]) refused(await get(path, token, method), 403);
      for (const token of [null, 'invalid', jwt.sign({ id: client.id, role: 'CLIENT' }, getJwtSecret(), { expiresIn: -1 })]) refused(await get(path, token, method), 401);
    }
    refused(await get(path + '?role=ADMIN&clientId=' + client.id, tt), 403);
    refused(await get(path, tt, 'GET', { Range: 'bytes=0-20' }), 403);
  }
  refused(await get(list(client.id), ot), 403);
  refused(await get(scoped(client.id, own.id), ot), 403);
  refused(await get(legacy(own.id), ot), 404);
  refused(await get(scoped(client.id, foreign.id), ct), 404);
  for (const token of [at, ct, sign({ role: 'CLIENT', clientId: client.id }), sign({ role: 'CUSTOMER', id: client.id })]) {
    const listed = await get(list(client.id), token);
    assert.equal(listed.status, 200); assert.equal(listed.headers.get('cache-control'), 'private, no-store');
    const data = JSON.parse(listed.bytes); assert.equal(data.count, 2); assert.deepEqual(data.reports.map(r => r.id), [own.id, earlier.id]);
    assert(data.reports.every(r => r.type === 'CLIENT' && r.clientId === client.id));
    for (const path of [scoped(client.id, own.id), legacy(own.id)]) {
      const row = await get(path, token); assert.equal(row.status, 200);
      assert.equal(row.headers.get('cache-control'), 'private, no-store'); assert.equal(row.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(row.headers.get('content-type'), 'application/pdf');
      assert.equal(row.bytes.subarray(0, 5).toString(), '%PDF-'); assert.match(row.bytes.toString('latin1').slice(-1024), /%%EOF\s*$/);
      const text = pdfText(row.bytes); assert(text.includes(client.name)); assert(text.includes('MONTHLY_PRIVATE_POOL')); assert(!text.includes(other.name));
    }
  }
  for (const token of [at, ct]) for (const report of [internal, extra, orphan]) {
    refused(await get(scoped(client.id, report.id), token), 404);
    refused(await get(legacy(report.id), token), 404);
  }
  for (const invalid of ['0', '-1', '01', '1.0', '1e0', '2147483648', 'abc']) {
    refused(await get(list(invalid), at), 400);
    refused(await get(scoped(client.id, invalid), at), 400);
    refused(await get(legacy(invalid), at), 400);
  }
  refused(await get(legacy(2147483647), at), 404);
  assert.deepEqual(JSON.parse((await get(list(other.id), ot)).bytes).reports.map(r => r.id), [foreign.id]);
  // A User marked CLIENT has no validated relationship to a Client row, even with an equal ID.
  await prisma.user.update({ where: { id: user.id }, data: { role: 'CLIENT' } });
  const ambiguous = sign({ id: user.id, userId: user.id, principalType: 'USER', role: 'CLIENT' });
  for (const path of paths) refused(await get(path, ambiguous), 403);
  await prisma.client.update({ where: { id: client.id }, data: { active: false } });
  for (const path of paths) refused(await get(path, ct), 401);
  assert.equal((await get(legacy(own.id), at)).status, 200, 'Admin can consult an inactive client history');
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await prisma.monthlyReport.findMany({ where: { id: { in: snapshot.map(r => r.id) } }, orderBy: { id: 'asc' } }), snapshot);
  console.log('PASS saved monthly reports: typed ownership, colliding IDs, legacy client identities, roles, private GET/HEAD and ranges, exact IDs/types, inactive client, read-only history and unchanged PDFs');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
