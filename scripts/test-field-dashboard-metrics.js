'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
process.env.DASHBOARD_BREAKER_THRESHOLD = '2';
process.env.DASHBOARD_BREAKER_COOLDOWN_MS = '60';
const cache = require('../src/services/dashboardCacheService');
const prefix = 'QA metrics ' + randomUUID();
const resultPath = path.join(__dirname, '../reports/field-suite/dashboard-metrics.json');
fs.mkdirSync(path.dirname(resultPath), { recursive: true });
fs.writeFileSync(resultPath, JSON.stringify({ ok: false, prefix, phase: 'started' }));
let client, technician, leader, server;
let completed = false;
process.on('exit', () => {
  if (!completed && !process.exitCode) {
    fs.writeSync(2, 'FAIL metrics integration exited before completing assertions\n');
    process.exitCode = 1;
  }
});
const counts = rows => Object.fromEntries(rows.map(row => [row.status, row._count.id]));
const sources = [['serviceVisit', 'groupBy'], ['technicalAlert', 'count'], ['invoice', 'aggregate']];
function interceptSources(intercept, onTransaction = () => {}) {
  const originals = sources.map(([model, operation]) => prisma[model][operation]), transaction = prisma.$transaction;
  for (const [index, [model, operation]] of sources.entries()) prisma[model][operation] = (...args) => intercept({ model, operation, scope: 'root', read: () => originals[index].apply(prisma[model], args) });
  let index = 0;
  prisma.$transaction = function (callback, options) {
    const scope = 'transaction-' + (++index); onTransaction({ scope, options });
    return transaction.call(this, tx => callback(new Proxy(tx, { get(target, property) {
      const entry = sources.find(([model]) => model === property);
      if (!entry) return Reflect.get(target, property);
      const [model, operation] = entry;
      return new Proxy(target[model], { get(delegate, method) {
        return method === operation ? (...args) => intercept({ model, operation, scope, read: () => delegate[method](...args) }) : Reflect.get(delegate, method);
      } });
    } })), options);
  };
  return () => { for (const [index, [model, operation]] of sources.entries()) prisma[model][operation] = originals[index]; prisma.$transaction = transaction; };
}

async function verifySnapshot(call, poolId, date) {
  const writer = new (require('@prisma/client').PrismaClient)();
  let restore = () => {}, release, firstStarted = false, writerPromise, fixture, writerError, timer, committedBeforeRemaining;
  const remaining = new Promise(resolve => { release = resolve; }), reads = [], transactions = [];
  try {
    const engine = (await writer.$queryRawUnsafe('SELECT version() AS version'))[0].version;
    cache.invalidateDashboardCache('QA_SNAPSHOT_BASELINE');
    const before = await call(); assert.equal(before.status, 200);
    restore = interceptSources(async ({ model, scope, read }) => {
      reads.push({ model, scope });
      if (model === 'serviceVisit' && !firstStarted) {
        firstStarted = true; const result = await read();
        writerPromise = writer.$transaction(async tx => {
          const visit = await tx.serviceVisit.create({ data: { clientId: client.id, poolId, status: 'DONE', plannedDate: date, date } });
          const alert = await tx.technicalAlert.create({ data: { poolId, type: 'QA', status: 'OPEN', message: prefix + ' concurrent' } });
          const invoice = await tx.invoice.create({ data: { clientId: client.id, total: 17.25, createdAt: date } });
          return { visit, alert, invoice };
        }, { maxWait: 10000, timeout: 30000 }).then(value => { fixture = value; }, error => { writerError = error; });
        // Local PGlite queues writers; native PostgreSQL must commit while the
        // reader remains open, proving the actual MVCC isolation level.
        committedBeforeRemaining = await Promise.race([
          writerPromise.then(() => { if (writerError) throw writerError; return true; }),
          new Promise(resolve => { timer = setTimeout(() => resolve(false), 5000); }),
        ]);
        clearTimeout(timer); release(); return result;
      }
      await remaining; return read();
    }, row => transactions.push(row));
    const during = await call(); assert.equal(during.status, 200);
    await writerPromise; if (writerError) throw writerError;
    restore();
    const after = await call(); assert.equal(after.status, 200);
    const values = data => ({ done: counts(data.body.serviceVisitsByStatus).DONE || 0, alerts: data.body.activeAlerts, total: data.body.financialAggregates._sum.total || 0 });
    const initial = values(before), delta = data => Object.fromEntries(Object.entries(values(data)).map(([key, value]) => [key, Math.round((value - initial[key]) * 100) / 100]));
    const proof = { engine, transactions, reads, committedBeforeRemaining, duringDelta: delta(during), afterDelta: delta(after) };
    console.log(JSON.stringify({ metricsSnapshot: proof }));
    assert.deepEqual(proof.duringDelta, { done: 0, alerts: 0, total: 0 }, 'Metrics must retain the same database snapshot across all sources');
    assert.deepEqual(proof.afterDelta, { done: 1, alerts: 1, total: 17.25 });
    assert.deepEqual(transactions, [{ scope: 'transaction-1', options: { isolationLevel: 'RepeatableRead', timeout: 30000 } }]);
    assert(reads.every(row => row.scope === 'transaction-1')); assert.equal(reads.length, 3);
    if (!/wasm|emscripten|pglite/i.test(engine)) assert.equal(committedBeforeRemaining, true, 'Native PostgreSQL must exercise a concurrent commit');
    return proof;
  } finally {
    clearTimeout(timer); release(); restore(); if (writerPromise) await writerPromise;
    if (fixture) {
      await writer.serviceVisit.delete({ where: { id: fixture.visit.id } });
      await writer.technicalAlert.delete({ where: { id: fixture.alert.id } });
      await writer.invoice.delete({ where: { id: fixture.invoice.id } });
    }
    await writer.$disconnect(); cache.invalidateDashboardCache('QA_SNAPSHOT_CLEANUP');
  }
}

(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' }, getJwtSecret(), { expiresIn: '1h' });
  let router = require('../src/routes/dashboardRoutes');
  if (process.env.CW_METRICS_SNAPSHOT_BASELINE === 'true') {
    const Module = require('node:module'), { execFileSync } = require('node:child_process');
    const filename = require.resolve('../src/routes/dashboardRoutes'), previous = new Module(filename, module);
    previous.filename = filename; previous.paths = module.paths;
    previous._compile(execFileSync('git', ['show', '852c4f3082b51e3d6ad5835ba4230d7e5f0935ac:src/routes/dashboardRoutes.js'], { encoding: 'utf8' }), filename);
    router = previous.exports;
  }
  const app = require('express')(); app.use('/api/dashboard', router);
  server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const call = async ({ force = true, method = 'GET', credential = token } = {}) => {
    const response = await fetch(origin + '/api/dashboard/metrics' + (force ? '?force=1' : ''), { method, headers: credential ? { Authorization: 'Bearer ' + credential } : {} });
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
  };
  const baseline = await call(); assert.equal(baseline.status, 200);
  const start = new Date(baseline.body.dayWindow.gte), end = new Date(baseline.body.dayWindow.lte);
  const midday = new Date(start.getTime() + 12 * 3600000), yesterday = new Date(start.getTime() - 3600000), tomorrow = new Date(end.getTime() + 3600000);
  client = await prisma.client.create({ data: { name: prefix, active: true } });
  const pool = await prisma.pool.create({ data: { name: prefix, clientId: client.id } });
  technician = await prisma.technician.create({ data: { name: prefix, active: true } });
  leader = await prisma.technician.create({ data: { name: prefix + ' leader', role: 'TEAM_LEADER', active: true } });
  for (const [status, date, plannedDate] of [['DONE', midday, midday], ['PLANNED', yesterday, midday], ['NOT_DONE', tomorrow, tomorrow]]) {
    await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: technician.id, status, date, plannedDate } });
  }
  for (const status of ['OPEN', 'ACKNOWLEDGED', 'RESOLVED']) await prisma.technicalAlert.create({ data: { poolId: pool.id, type: 'QA', message: prefix, status } });
  for (const [total, createdAt] of [[123.45, midday], [-12.34, midday], [999, yesterday]]) await prisma.invoice.create({ data: { clientId: client.id, total, createdAt } });
  const snapshotProof = await verifySnapshot(call, pool.id, midday);
  const snapshot = async () => ({ visits: await prisma.serviceVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }), invoices: await prisma.invoice.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }), alerts: await prisma.technicalAlert.findMany({ where: { poolId: pool.id }, orderBy: { id: 'asc' } }), payments: await prisma.payment.count(), communications: await prisma.communicationLog.count() });
  const before = await snapshot(); cache.invalidateDashboardCache('QA_FIXTURE');
  const complete = await call(); assert.equal(complete.status, 200); assert.equal(complete.cache, 'private, no-store');
  assert.equal(complete.body.activeAlerts, baseline.body.activeAlerts + 2);
  const oldCounts = counts(baseline.body.serviceVisitsByStatus), newCounts = counts(complete.body.serviceVisitsByStatus);
  assert.equal(newCounts.DONE, (oldCounts.DONE || 0) + 1); assert.equal(newCounts.PLANNED, (oldCounts.PLANNED || 0) + 1);
  assert.equal(newCounts.NOT_DONE || 0, oldCounts.NOT_DONE || 0);
  assert.equal(Math.round((complete.body.financialAggregates._sum.total - (baseline.body.financialAggregates._sum.total || 0)) * 100), 11111);
  for (const method of ['GET', 'POST']) {
    const hit = await call({ force: false, method }); assert.equal(hit.status, 200); assert.equal(hit.body.source, 'RAM_CACHE_HIT'); assert.equal(hit.cache, 'private, no-store');
  }
  const sign = payload => jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' });
  for (const method of ['GET', 'POST']) {
    for (const credential of [null, 'invalid', sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), sign({ id: technician.id, technicianId: technician.id, role: 'TECHNICIAN' })]) {
      const denied = await call({ method, credential, force: false }); assert([401, 403].includes(denied.status)); assert.equal(denied.cache, 'private, no-store'); assert(!denied.body.financialAggregates);
    }
    assert.equal((await call({ method, credential: sign({ id: leader.id, technicianId: leader.id, role: 'TEAM_LEADER' }) })).status, 200);
  }
  for (const [model] of sources) {
    let restore;
    try {
      cache.invalidateDashboardCache('QA_FAILURE'); restore = interceptSources(entry => { if (entry.model === model) throw Error('PRIVATE_METRIC_SOURCE_SECRET'); return entry.read(); });
      for (const method of ['GET', 'POST']) {
        const failed = await call({ method }); assert.equal(failed.status, 503, model + ' failure must not become zero');
        assert.equal(failed.body.ok, false); assert(!JSON.stringify(failed).includes('PRIVATE_METRIC_SOURCE_SECRET')); assert.equal(cache.getDashboardCache(), null);
      }
      const blocked = await call(); assert.equal(blocked.status, 503); assert.equal(blocked.body.breaker.state, 'OPEN');
    } finally { restore?.(); }
    await new Promise(resolve => setTimeout(resolve, 70));
    const recovered = await call(); assert.equal(recovered.status, 200); assert.equal(recovered.body.breaker.state, 'CLOSED'); assert.equal(recovered.body.activeAlerts, complete.body.activeAlerts);
    try {
      restore = interceptSources(entry => { if (entry.model === model) throw Error('PRIVATE_METRIC_SOURCE_SECRET'); return entry.read(); });
      const fallback = await call(); assert.equal(fallback.status, 200); assert.equal(fallback.body.source, 'RAM_CACHE_FALLBACK');
      assert.equal(fallback.body.cache.source, fallback.body.source); assert.equal(fallback.body.breakerDegraded, true);
      assert.deepEqual(counts(fallback.body.serviceVisitsByStatus), counts(complete.body.serviceVisitsByStatus));
      assert.deepEqual(fallback.body.financialAggregates, complete.body.financialAggregates);
      assert.equal((await call({ force: false })).body.breakerDegraded, true);
      const opened = await call(); assert.equal(opened.body.breaker.state, 'OPEN');
      const cachedOpen = await call({ force: false }); assert.equal(cachedOpen.body.source, 'RAM_CIRCUIT_BREAKER'); assert.equal(cachedOpen.body.breakerDegraded, true);
    } finally { restore?.(); }
    await new Promise(resolve => setTimeout(resolve, 70)); assert.equal((await call()).body.breaker.state, 'CLOSED');
  }
  let release, arrived, restore;
  const reached = new Promise(resolve => { arrived = resolve; });
  try {
    cache.invalidateDashboardCache('QA_BEFORE_RACE');
    restore = interceptSources(async entry => { const result = await entry.read(); if (entry.model === 'technicalAlert') { arrived(); await new Promise(resolve => { release = resolve; }); } return result; });
    const pending = call(); await reached; cache.invalidateDashboardCache('VISIT_COMPLETED'); release();
    const outdated = await pending; assert.equal(outdated.status, 503); assert.equal(outdated.body.breaker.failureCount, 0); assert.equal(cache.getDashboardCache(), null);
  } finally { restore?.(); if (release) release(); }
  assert.equal((await call()).status, 200); assert.deepEqual(await snapshot(), before, 'Metrics must not write business records');
  completed = true;
  fs.writeFileSync(resultPath, JSON.stringify({ ok: true, prefix, phase: 'assertions-completed', snapshot: snapshotProof, failedSourcesChecked: 3, methods: ['GET', 'POST'], allowedRoles: ['ADMIN', 'TEAM_LEADER'], refusedRoles: ['CLIENT', 'TECHNICIAN'], invalidationRaceChecked: true, businessRecordsUnchanged: true }, null, 2) + '\n');
  fs.writeSync(1, 'PASS live dashboard metrics: real SQL values and UTC scope, GET/POST permissions and private cache policy, each failed source unavailable, retained/degraded complete cache, breaker recovery, invalidation race and no business mutations\n');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (client) {
    await prisma.technicalAlert.deleteMany({ where: { pool: { clientId: client.id } } });
    await prisma.serviceVisit.deleteMany({ where: { clientId: client.id } });
    await prisma.invoice.deleteMany({ where: { clientId: client.id } });
    await prisma.pool.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
  }
  for (const row of [technician, leader]) if (row) await prisma.technician.delete({ where: { id: row.id } });
  await prisma.$disconnect();
});
