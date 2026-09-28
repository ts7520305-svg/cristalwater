'use strict';
// Fresh process per API read: fixture creation and earlier responses cannot
// contaminate the heap baseline. Only explicitly isolated QA is accepted.
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs');
const { createHash } = require('node:crypto'), { performance } = require('node:perf_hooks');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const address = new URL(process.env.DATABASE_URL);
assert(['127.0.0.1', 'localhost'].includes(address.hostname) && /qa/i.test(address.pathname));
const [mode, manifestPath, fault] = process.argv.slice(2);
assert(['dashboard', 'metrics', 'alerts', 'risk'].includes(mode)); assert(!fault || fault === 'late-page' || mode === 'dashboard' && fault === 'legacy-projections');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
global.__CRISTAL_WATER_PRISMA__ = prisma;
const sql = { queries: 0, durationMs: 0, writes: 0 }, scans = [], transactions = [];
let measuring = false, failedPage = 0, injected = false, server, completed = false;
prisma.$on('query', event => {
  if (!measuring) return;
  sql.queries++; sql.durationMs += event.duration;
  if (/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(event.query)) sql.writes++;
});
const originalTransaction = prisma.$transaction;
prisma.$transaction = function (callback, options) {
  if (measuring) transactions.push(options);
  return originalTransaction.call(this, tx => callback(new Proxy(tx, { get(target, property) {
    const model = Reflect.get(target, property);
    if (!model || typeof model.findMany !== 'function') return model;
    return new Proxy(model, { get(delegate, operation) {
      if (mode === 'metrics' && ['groupBy', 'count', 'aggregate'].includes(operation)) return async args => {
        const value = await delegate[operation](args);
        if (measuring) scans.push({ model: property, operation, rows: Array.isArray(value) ? value.length : 1 });
        return value;
      };
      if (operation !== 'findMany') return Reflect.get(delegate, operation);
      return async args => {
        const selected = mode === 'risk' ? property === 'invoice' && args.take === 250 : property === 'technicalAlert' && args.take === 500;
        if (fault === 'late-page' && selected && ++failedPage === 2) { injected = true; throw Error('PRIVATE_VOLUME_LATE_PAGE_FAILURE'); }
        // Reference query shapes from TASK403. Compare full HTTP output on the
        // same fixture, not just chosen totals, before accepting projections.
        if (fault === 'legacy-projections' && args.select && !args.where && !args.take) {
          const includes = { client: { pools: true, invoices: true }, pool: { client: true },
            invoice: { client: true, payments: true }, payment: { invoice: { include: { client: true } } } };
          if (includes[property] && args.orderBy) { args = { include: includes[property], orderBy: args.orderBy }; }
        }
        const rows = await delegate.findMany(args);
        if (measuring) scans.push({ model: property, rows: rows.length, take: args.take || null, rssMiB: mib(process.memoryUsage().rss), ...(property === 'serviceVisit' && args.where?.OR ? { where: args.where } : {}) });
        if (args.take) assert(rows.length <= args.take);
        return rows;
      };
    } });
  } })), options);
};
const hashIds = values => createHash('sha256').update(values.map(String).sort().join('\n')).digest('hex');
const measureMemory = () => { const m = process.memoryUsage(); return { rss: m.rss, heap: m.heapUsed }; };
const mib = bytes => Math.round(bytes / 1048576 * 100) / 100;
const fixtureIds = new Set(manifest.clientIds), alertIds = new Set(manifest.allAlertIds), riskIds = new Set(manifest.allRiskIds);
function inspect(body) {
  if (mode === 'metrics') {
    assert.equal(body.cache.source, 'DATABASE_HIT'); assert.equal(body.breaker.state, 'CLOSED');
    assert.deepEqual(scans.map(row => row.model + '.' + row.operation).sort(), ['invoice.aggregate', 'serviceVisit.groupBy', 'technicalAlert.count']);
    return { activeAlerts: body.activeAlerts, serviceVisitsByStatus: body.serviceVisitsByStatus, financialAggregates: body.financialAggregates, dayWindow: body.dayWindow, cacheSource: body.cache.source };
  }
  if (mode === 'dashboard') {
    assert(body.alertCoverage.totalsComplete); assert.equal(body.alertCoverage.limitPerSource, 200);
    assert.equal(body.alertCoverage.total, Object.values(body.alertCoverage.sources).reduce((sum, source) => sum + source.total, 0));
    assert.equal(body.alertCoverage.returned, body.alerts.length);
    for (const source of Object.values(body.alertCoverage.sources)) assert(source.returned <= 200 && source.returned <= source.total);
    assert.equal(body.poolsByZone.reduce((sum, zone) => sum + zone.count, 0), body.summary.totalPools);
    assert.equal(new Set(body.visits.map(row => row.id)).size, body.visits.length);
    const visits = body.visits.filter(row => fixtureIds.has(row.clientId));
    const observed = new Set(visits.map(row => row.id)), expected = new Set(manifest.expectedMonthlyVisitIds || []);
    assert.equal(hashIds([...observed]), manifest.expectedMonthlyVisitHash, JSON.stringify({ expected: expected.size, actual: observed.size,
      missing: [...expected].filter(id => !observed.has(id)).slice(0, 10), unexpected: visits.filter(row => !expected.has(row.id)).slice(0, 10).map(({ id, clientId, date, plannedDate }) => ({ id, clientId, date, plannedDate })) }));
    assert(body.topDebtors.length <= 15 && body.latestPayments.length <= 15);
    return { summary: body.summary, technicians: body.technicians.length, coverage: body.alertCoverage,
      visits: body.visits.length, fixtureVisits: visits.length, fixtureIdsHash: hashIds(visits.map(row => row.id)),
      returnedAlerts: body.alerts.length, topDebtors: body.topDebtors.length, latestPayments: body.latestPayments.length };
  }
  if (mode === 'alerts') {
    assert.equal(body.count, body.alerts.length); assert.equal(new Set(body.alerts.map(row => row.id)).size, body.count);
    for (const [source, key] of [['technical', 'technical'], ['notification', 'notifications'], ['visit', 'visits'], ['generic', 'generic']]) assert.equal(body.alerts.filter(row => row.source === source).length, body.totals[key]);
    const fixture = body.alerts.filter(row => alertIds.has(row.id));
    assert.equal(hashIds(fixture.map(row => row.id)), manifest.expectedAlertHash);
    return { count: body.count, totals: body.totals, fixtureCount: fixture.length, fixtureIdsHash: hashIds(fixture.map(row => row.id)) };
  }
  assert(body.complete); assert.equal(body.counts.total, body.issues.length); assert.equal(new Set(body.issues.map(row => row.id)).size, body.issues.length);
  assert.equal(body.counts.critical + body.counts.warning, body.counts.total);
  const fixture = body.issues.filter(row => riskIds.has(row.id));
  assert.equal(hashIds(fixture.map(row => row.id)), manifest.expectedRiskHash);
  for (const id of fixtureIds) assert.equal(body.byClientId[id]?.length, 13);
  return { counts: body.counts, fixtureCount: fixture.length, fixtureIdsHash: hashIds(fixture.map(row => row.id)), complete: body.complete };
}
process.on('exit', () => { if (!completed && !process.exitCode) { fs.writeSync(2, 'Volume probe exited before assertions completed\n'); process.exitCode = 1; } });
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = require('jsonwebtoken').sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' }, require('../src/utils/jwtSecret').getJwtSecret(), { expiresIn: '10m' });
  const app = require('express')();
  const mount = { dashboard: '/api/dashboard', metrics: '/api/dashboard', alerts: '/api/alerts', risk: '/api/operational-risk' }[mode];
  app.use(mount, require('../src/routes/' + { dashboard: 'dashboardRoutes', metrics: 'dashboardRoutes', alerts: 'alertRoutes', risk: 'operationalRiskRoutes' }[mode]));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  global.gc?.(); const before = measureMemory(), peak = { ...before };
  const sample = () => { const current = measureMemory(); peak.rss = Math.max(peak.rss, current.rss); peak.heap = Math.max(peak.heap, current.heap); };
  const sampler = setInterval(sample, 5), start = performance.now(); measuring = true;
  let response, raw, receivedAt;
  try {
    response = await fetch('http://127.0.0.1:' + server.address().port + mount + { dashboard: '/admin?monthRef=2019-12', metrics: '/metrics?force=1', alerts: '', risk: '/summary' }[mode], { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(35000) });
    raw = await response.text(); receivedAt = performance.now(); sample();
  } finally { measuring = false; clearInterval(sampler); }
  const body = JSON.parse(raw); sample(); const durationMs = Math.round((receivedAt - start) * 10) / 10;
  assert.equal(sql.writes, 0, 'The measured GET must not mutate business data');
  const measurements = { durationMs, jsonBytes: Buffer.byteLength(raw), rssBeforeMiB: mib(before.rss), sampledRssPeakMiB: mib(peak.rss), heapBeforeMiB: mib(before.heap), sampledHeapPeakMiB: mib(peak.heap), lifetimeRssPeakMiB: Math.round(process.resourceUsage().maxRSS / 1024 * 100) / 100, sql, scans, transactions };
  console.log(JSON.stringify({ summaryVolumeMeasurement: { mode, clients: manifest.clientIds.length, fault: fault || null, measurements } }));
  let verified;
  if (fault === 'late-page') {
    assert(injected); assert.equal(response.status, mode === 'risk' ? 503 : 500); assert.equal(body.ok, false);
    assert(!raw.includes('PRIVATE_VOLUME_LATE_PAGE_FAILURE'));
    assert(!body.alerts?.length && !body.issues?.length && !body.summary && !body.complete && !body.totals && !body.counts);
    verified = { laterPageRejected: true, status: response.status };
  } else {
    assert.equal(response.status, 200, raw.slice(0, 500)); assert.equal(body.ok, true); verified = inspect(body);
    assert(durationMs < 30000, 'QA guard: complete API read within 30 s');
    assert(Buffer.byteLength(raw) < 64 * 1048576, 'QA guard: response below 64 MiB');
    assert(peak.rss < 768 * 1048576, 'QA guard: sampled process RSS below 768 MiB');
  }
  assert.equal(transactions.length, 1); assert.equal(transactions[0].isolationLevel, 'RepeatableRead');
  completed = true;
  console.log(JSON.stringify({ summaryVolumeProbe: { ok: true, phase: 'assertions-completed', mode, clients: manifest.clientIds.length, fault: fault || null, measurements, verified, responseSha256: createHash('sha256').update(raw).digest('hex') } }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await prisma.$disconnect();
});
