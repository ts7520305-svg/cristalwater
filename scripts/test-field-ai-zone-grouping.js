'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const prefix = 'QA AI zones ' + randomUUID(), month = '2078-03';
const reserved = Object.getOwnPropertyNames(Object.prototype);
const cases = [
  ...reserved.map(zone => ({ zone, visits: 10, alerts: 3 })),
  { zone: prefix + ' below', visits: 7, alerts: 2 },
  { zone: prefix + ' alerts only', visits: 0, alerts: 3 },
  { zone: null, visits: 10, alerts: 0 },
  { zone: prefix + ' <img src=x onerror=alert(1)>', visits: 10, alerts: 3 },
];
let client, technician; const poolIds = [];

(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = payload => jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' });
  const adminToken = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const call = async (credential = adminToken, period = month) => {
    const response = await fetch(base + '/api/dashboard/admin?monthRef=' + period, { headers: credential ? { Authorization: 'Bearer ' + credential } : {} });
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
  };
  client = await prisma.client.create({ data: { name: prefix, active: true } });
  technician = await prisma.technician.create({ data: { name: prefix, active: true } });
  for (const row of cases) {
    const pool = await prisma.pool.create({ data: { name: prefix, clientId: client.id, zone: row.zone, active: true } });
    poolIds.push(pool.id);
    if (row.visits) await prisma.serviceVisit.createMany({ data: Array.from({ length: row.visits }, (_, i) => ({ clientId: client.id, poolId: pool.id, technicianId: technician.id, date: new Date('2078-03-' + String(i + 1).padStart(2, '0') + 'T12:00:00Z'), status: 'PLANNED' })) });
    if (row.alerts) await prisma.technicalAlert.createMany({ data: Array.from({ length: row.alerts }, () => ({ poolId: pool.id, type: 'QA', message: prefix, priority: 'HIGH', status: 'OPEN', createdAt: new Date('2078-03-01T12:00:00Z') })) });
  }
  await prisma.technicalAlert.create({ data: { poolId: poolIds.at(-1), type: 'QA', message: prefix + ' closed', status: 'RESOLVED', createdAt: new Date('2078-03-01T12:00:00Z') } });
  const snapshot = async () => ({
    client: await prisma.client.findUnique({ where: { id: client.id } }),
    technician: await prisma.technician.findUnique({ where: { id: technician.id } }),
    pools: await prisma.pool.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),
    visits: await prisma.serviceVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),
    alerts: await prisma.technicalAlert.findMany({ where: { poolId: { in: poolIds } }, orderBy: { id: 'asc' } }),
    payments: await prisma.payment.count(), invoices: await prisma.invoice.count(), communications: await prisma.communicationLog.count(),
  });
  const before = await snapshot();
  const first = await call(); assert.equal(first.status, 200); assert.equal(first.body.ok, true);
  const foundOperational = reserved.filter(zone => first.body.aiAnalysis.criticalZones.some(row => row.zone === zone));
  const foundPredictive = reserved.filter(zone => first.body.predictiveAnalysis.tomorrowRiskZones.some(row => row.zone === zone));
  console.log(JSON.stringify({ reservedNames: reserved.length, operationalReservedZones: foundOperational.length, predictiveReservedZones: foundPredictive.length }));
  assert.equal(foundOperational.length, reserved.length, 'Every reserved name must contribute to operational zone risk');
  assert.equal(foundPredictive.length, reserved.length, 'Every reserved name must contribute to predictive zone risk');
  assert.equal(first.cache, 'private, no-store');
  assert.equal(first.body.visits.filter(row => row.clientId === client.id).length, cases.reduce((sum, row) => sum + row.visits, 0));
  assert.equal(first.body.alerts.filter(row => poolIds.includes(row.poolId)).length, cases.reduce((sum, row) => sum + row.alerts, 0));
  const normalize = rows => [...rows].sort((a, b) => a.zone.localeCompare(b.zone));
  // Independent Map-based oracle uses the exact API inputs. This deliberately
  // does not certify source completeness, tomorrow's date or financial context.
  const verify = body => {
    const grouped = new Map();
    for (const [field, rows] of [['visits', body.visits], ['alerts', body.alerts]]) for (const row of rows) {
      const zone = row.pool?.zone || 'Sem zona';
      if (!grouped.has(zone)) grouped.set(zone, { zone, visits: 0, alerts: 0 });
      grouped.get(zone)[field]++;
    }
    const values = [...grouped.values()];
    assert.deepEqual(normalize(body.aiAnalysis.criticalZones), normalize(values.filter(row => row.visits >= 10).map(({ zone, visits }) => ({ zone, visits }))));
    assert.deepEqual(normalize(body.predictiveAnalysis.tomorrowRiskZones), normalize(values.filter(row => row.visits >= 8 || row.alerts >= 3)));
  };
  verify(first.body);
  const repeat = await call(); assert.equal(repeat.status, 200); verify(repeat.body);
  assert.deepEqual(repeat.body.aiAnalysis, first.body.aiAnalysis);
  assert.deepEqual(repeat.body.predictiveAnalysis, first.body.predictiveAnalysis);
  const nextMonth = await call(adminToken, '2078-04'); assert.equal(nextMonth.status, 200); verify(nextMonth.body);
  assert.equal(nextMonth.body.visits.filter(row => row.clientId === client.id).length, 0);
  // Alerts remain global under the existing API contract; this is not a forecast.
  assert(reserved.every(zone => nextMonth.body.predictiveAnalysis.tomorrowRiskZones.some(row => row.zone === zone && row.alerts >= 3)));
  const again = await call(); assert.equal(again.status, 200); verify(again.body);
  assert.deepEqual(again.body.aiAnalysis, first.body.aiAnalysis);
  for (const [credential, expected] of [[null, 401], ['invalid', 401], [sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), 403], [sign({ id: technician.id, technicianId: technician.id, role: 'TECHNICIAN' }), 403]]) assert.equal((await call(credential)).status, expected);
  assert.deepEqual(await snapshot(), before);
  console.log('PASS AI zone grouping API: 12 inherited names, literal names, 147 visits, 44 open alerts, closed alert exclusion, preserved threshold rules, repeated/changed-period reads, ADMIN scope and unchanged business records');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (client) {
    await prisma.technicalAlert.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.serviceVisit.deleteMany({ where: { clientId: client.id } });
    await prisma.pool.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
  }
  if (technician) await prisma.technician.delete({ where: { id: technician.id } });
  await prisma.$disconnect();
});
