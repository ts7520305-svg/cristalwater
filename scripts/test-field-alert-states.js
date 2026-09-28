'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const prefix = 'QA397-' + randomUUID(), closed = ['RESOLVED', 'DONE', 'CLOSED', 'CANCELLED', 'CANCELED', 'ARCHIVED', 'SUPERSEDED'];
let client, browser, probe;
function legacyList() {
  const Module = require('node:module'), { execFileSync } = require('node:child_process');
  const load = (file, presentation) => {
    const filename = path.join(__dirname, '..', file), loaded = new Module(filename, module);
    loaded.filename = filename; loaded.paths = module.paths;
    if (presentation) { const original = loaded.require.bind(loaded); loaded.require = name => name === '../../services/alertPresentationService' ? presentation : original(name); }
    loaded._compile(execFileSync('git', ['show', '5849cb802840c3e77472321d4a53afa101a1a406:' + file], { encoding: 'utf8' }), filename);
    return loaded.exports;
  };
  return load('src/business/admin/AlertListBusiness.js', load('src/services/alertPresentationService.js')).list();
}
function verifyTotals(data) {
  assert.equal(data.count, data.alerts.length);
  for (const [source, key] of [['notification', 'notifications'], ['technical', 'technical'], ['visit', 'visits'], ['generic', 'generic']]) assert.equal(data.totals[key], data.alerts.filter(row => row.source === source).length);
  assert.equal(Object.entries(data.totals).filter(([key]) => key !== 'critical').reduce((sum, [, value]) => sum + value, 0), data.count);
  assert.equal(data.totals.critical, data.alerts.filter(row => row.priority === 'CRITICAL').length);
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' }, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: 'Bearer ' + token };
  const read = async (url = '/api/alerts') => { const response = await fetch(base + url, { headers }); assert.equal(response.status, 200); return response.json(); };
  const before = await read(), dashboardBefore = await read('/api/dashboard/admin?monthRef=2079-01');
  client = await prisma.client.create({ data: { name: prefix } });
  const pool = await prisma.pool.create({ data: { name: prefix + ' <img src=x>', clientId: client.id } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'DONE', notes: prefix + ' current report' } });
  const wrongVisit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'DONE', notes: prefix + ' CLOSED CONTEXT' } });
  const alertedVisit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'DONE', alerts: prefix + ' completed visit still has an alert' } });
  const blockedVisit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'NOT_DONE', reason: prefix + ' blocked visit' } });
  await prisma.serviceVisit.createMany({ data: Array.from({ length: 503 }, () => ({ clientId: client.id, poolId: pool.id, status: 'DONE', alerts: '   ' })) });
  const variants = closed.flatMap(status => [status.toLowerCase(), [...status].map((c, i) => i % 2 ? c.toLowerCase() : c).join('')]);
  const closedStatuses = [...Array.from({ length: 1003 }, (_, i) => variants[i % variants.length]), ...closed];
  const states = ['OPEN', 'pEnDiNg', 'UNKNOWN'];
  const technical = [], notification = [], generic = [];
  for (const [i, status] of states.entries()) {
    const message = prefix + ' open ' + i + ' <img src=x>', createdAt = new Date('2020-01-01T12:00:00Z');
    technical.push(await prisma.technicalAlert.create({ data: { poolId: pool.id, type: 'ALERT', status, message, createdAt } }));
    notification.push(await prisma.notification.create({ data: { clientId: client.id, type: 'ALERT', status, message, createdAt, metadata: i === 0 ? { alertId: technical[0].id, visitType: 'REGULAR', visitId: visit.id, poolId: pool.id, clientId: client.id } : {} } }));
    generic.push(await prisma.alert.create({ data: { title: prefix, type: 'ALERT', status, message, createdAt } }));
  }
  await prisma.technicalAlert.createMany({ data: closedStatuses.map((status, i) => ({ poolId: pool.id, type: 'ALERT', status, message: prefix + ' CLOSED ' + i })) });
  await prisma.notification.createMany({ data: closedStatuses.map((status, i) => ({ clientId: client.id, type: 'ALERT', status, message: prefix + ' CLOSED ' + i, createdAt: new Date('2019-01-01T12:00:00Z'), metadata: { alertId: technical[0].id, visitType: 'REGULAR', visitId: wrongVisit.id, poolId: pool.id, clientId: client.id } })) });
  await prisma.alert.createMany({ data: closedStatuses.map((status, i) => ({ title: prefix, type: 'ALERT', status, message: prefix + ' CLOSED ' + i })) });
  await prisma.alert.create({ data: { title: prefix, active: false, message: prefix + ' INACTIVE' } });
  const fixture = row => row.clientId === client.id || row.poolId === pool.id || row.message.includes(prefix);
  const expected = [...notification.map(row => 'notification-' + row.id), ...technical.map(row => 'technical-' + row.id), ...generic.map(row => 'generic-' + row.id), 'visit-' + alertedVisit.id, 'visit-' + blockedVisit.id].sort();
  if (process.env.CW_ALERT_STATES_BASELINE === 'true') {
    const data = await legacyList(), leaked = data.alerts.filter(row => fixture(row) && closed.includes(row.status.toUpperCase()));
    console.log(JSON.stringify({ regression: 'TASK397', seededClosedPerSource: closedStatuses.length, leakedClosed: leaked.length, leakedBySource: Object.fromEntries(['notification', 'technical', 'generic'].map(source => [source, leaked.filter(row => row.source === source).length])), totalCount: data.count, sumOfSourceTotals: data.totals.notifications + data.totals.technical + data.totals.visits + data.totals.generic, technicalContextVisitId: data.alerts.find(row => row.id === 'technical-' + technical[0].id)?.serviceNote?.visitId ?? null, expectedContextVisitId: visit.id }));
    assert.equal(leaked.length, 0, 'Closed records cannot appear as actionable alerts'); return;
  }
  const snapshot = () => Promise.all([
    prisma.notification.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),
    prisma.technicalAlert.findMany({ where: { poolId: pool.id }, orderBy: { id: 'asc' } }),
    prisma.alert.findMany({ where: { title: prefix }, orderBy: { id: 'asc' } }),
    prisma.serviceVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),
  ]);
  const unchanged = await snapshot(), data = await read(); verifyTotals(data);
  assert.deepEqual(data.alerts.filter(fixture).map(row => row.id).sort(), expected);
  assert.equal(data.count, before.count + expected.length);
  const selected = data.alerts.find(row => row.id === 'technical-' + technical[0].id);
  assert.equal(selected.serviceNote.visitId, visit.id); assert.equal(selected.serviceNote.notes, visit.notes);
  for (const [i, status] of states.entries()) for (const id of ['technical-' + technical[i].id, 'notification-' + notification[i].id, 'generic-' + generic[i].id]) assert.equal(data.alerts.find(row => row.id === id).status, status);
  assert.deepEqual(await read(), data);
  const dashboard = await read('/api/dashboard/admin?monthRef=2079-01');
  assert.equal(dashboard.alertCoverage.total, dashboardBefore.alertCoverage.total + 8);
  for (const [source, added] of [['technical', 3], ['notification', 3], ['visit', 2]]) assert.equal(dashboard.alertCoverage.sources[source].total, dashboardBefore.alertCoverage.sources[source].total + added);
  assert.equal((await fetch(base + '/api/alerts')).status, 401);
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
  }, { token, id: admin.id });
  const page = await context.newPage(), writes = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.method()); });
  await page.goto(base + '/admin-alerts?q=' + encodeURIComponent(prefix), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => alertsLoaded);
  assert.deepEqual(await page.evaluate(() => filteredAlerts().map(row => row.id).sort()), expected);
  assert.equal(await page.locator('#alertsTotal').textContent(), '11');
  assert.equal(await page.locator('#alertsList img[src="x"]').count(), 0);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const visual = path.join(__dirname, '../reports/field-visual/alert-states'); await fs.mkdir(visual, { recursive: true });
  await page.screenshot({ path: path.join(visual, 'mobile-320.png'), fullPage: true });
  await page.locator('#refreshAlerts').click(); await page.waitForFunction(() => document.querySelector('#alertsStatus').textContent.includes('carregados'));
  assert.deepEqual(await page.evaluate(() => filteredAlerts().map(row => row.id).sort()), expected);
  assert.deepEqual(writes, []); assert.deepEqual(errors, []); await context.close();
  const app = require('express')(); app.use('/api/alerts', require('../src/routes/alertRoutes'));
  probe = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  for (const model of ['notification', 'technicalAlert', 'serviceVisit', 'alert']) {
    const original = prisma.$transaction;
    prisma.$transaction = function(callback, options) { return original.call(this, tx => callback(new Proxy(tx, { get(target, key) {
      if (key !== model) return target[key];
      return new Proxy(target[key], { get(delegate, operation) {
        if (operation !== 'findMany') return delegate[operation];
        return async query => { if (query.where?.AND?.some(condition => condition.id?.gt > 0)) throw Error('PRIVATE_LATE_CLOSED_ALERT_PAGE'); return delegate.findMany(query); };
      } });
    } })), options); };
    try {
      const response = await fetch('http://127.0.0.1:' + probe.address().port + '/api/alerts', { headers });
      assert.equal(response.status, 500, model + ' late failure'); const failed = await response.json();
      assert.equal(failed.ok, false); assert(!JSON.stringify(failed).includes('PRIVATE_LATE'));
    } finally { prisma.$transaction = original; }
  }
  assert.deepEqual(await snapshot(), unchanged);
  await fs.writeFile(path.join(visual, 'evidence.json'), JSON.stringify({ ok: true, phase: 'assertions-completed', closedPerSource: closedStatuses.length, blankVisitCandidates: 503, returnedFixture: expected.length, dashboardFixtureTotal: 8, sourceTotalsMatchRows: true, closedContextExcluded: true, literalStatesPreserved: true, repeatStable: true, lateSourceFailures: 4, noBusinessWrites: true }, null, 2));
  console.log('PASS closed alert states: 3030 closed records excluded, 503 blank visits excluded, 11 actionable records retained, exact totals/context, dashboard agreement, mobile UI, four late failures refused, unchanged source records');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); if (probe) await new Promise(resolve => probe.close(resolve));
  if (client) {
    await prisma.notification.deleteMany({ where: { clientId: client.id } });
    await prisma.technicalAlert.deleteMany({ where: { pool: { clientId: client.id } } });
    await prisma.serviceVisit.deleteMany({ where: { clientId: client.id } });
    await prisma.pool.deleteMany({ where: { clientId: client.id } }); await prisma.client.delete({ where: { id: client.id } });
  }
  await prisma.alert.deleteMany({ where: { title: prefix } }); await prisma.$disconnect();
});
