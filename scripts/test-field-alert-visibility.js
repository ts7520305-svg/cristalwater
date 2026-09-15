'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}` };
  const client = await prisma.client.create({ data: { name: 'Visibilidade dos alertas QA' } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina dos alertas QA' } });
  const old = new Date('2020-01-01T08:00:00Z'), recent = new Date();
  const notification = await prisma.notification.create({ data: { clientId: client.id, type: 'WATER_OPEN', severity: 'CRITICAL', message: 'Água aberta antiga QA', createdAt: old } });
  const technical = await prisma.technicalAlert.create({ data: { poolId: pool.id, type: 'PUMP_MANUAL', priority: 'CRITICAL', message: 'Bomba antiga QA', createdAt: old } });
  const visit = await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, alerts: 'Problema antigo QA', status: 'DONE', updatedAt: old } });
  const generic = await prisma.alert.create({ data: { type: 'CRITICAL', message: 'Alerta geral antigo QA', createdAt: old } });
  const rows = Array.from({ length: 505 }, (_, i) => i);
  await prisma.notification.createMany({ data: rows.map(i => ({ clientId: client.id, type: 'ALERT', message: `Aviso QA ${i}`, createdAt: recent })) });
  await prisma.technicalAlert.createMany({ data: rows.map(i => ({ poolId: pool.id, type: 'MANUAL_ALERT', message: `Técnico QA ${i}`, createdAt: recent })) });
  await prisma.serviceVisit.createMany({ data: rows.map(i => ({ poolId: pool.id, clientId: client.id, alerts: `Visita QA ${i}`, status: 'DONE', updatedAt: recent })) });
  await prisma.alert.createMany({ data: rows.map(i => ({ type: 'ALERT', message: `Geral QA ${i}`, createdAt: recent })) });
  const response = await fetch(base + '/api/alerts', { headers });
  const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data));
  const expected = [`notification-${notification.id}`, `technical-${technical.id}`, `visit-${visit.id}`, `generic-${generic.id}`];
  const missing = expected.filter(id => !data.alerts.some(row => row.id === id));
  console.log(JSON.stringify({ seededPerSource: 506, returned: data.totals, missingOldOpenAlerts: missing }));
  assert.deepEqual(missing, [], 'Old open alerts must remain visible beyond the recent rows');
  assert.equal(new Set(data.alerts.map(row => row.id)).size, data.alerts.length);
  for (const [source, total] of Object.entries({ notification: 'notifications', technical: 'technical', visit: 'visits', generic: 'generic' })) {
    assert.equal(data.totals[total], data.alerts.filter(row => row.source === source).length);
    assert(data.totals[total] >= 506);
  }
  const ranks = { CRITICAL: 0, WARNING: 1, NORMAL: 2, LOW: 3 };
  for (let i = 1; i < data.alerts.length; i++) assert(ranks[data.alerts[i - 1].priority] <= ranks[data.alerts[i].priority], 'Critical alerts must precede newer normal alerts');
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } })).isRead, false);
  assert.equal((await prisma.technicalAlert.findUniqueOrThrow({ where: { id: technical.id } })).resolvedAt, null);
  console.log('PASS old open alerts from all four sources remain visible beyond 500 rows');

  const repair = await prisma.repair.create({ data: { poolId: pool.id, problem: 'Reparação ligada QA' } });
  await prisma.notification.update({ where: { id: notification.id }, data: { metadata: { visitId: visit.id, repairId: repair.id, alertId: technical.id, poolId: pool.id } } });
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { notes: 'Nota integral antiga QA', ph: 7.4 } });
  const closed = await prisma.notification.create({ data: { type: 'CRITICAL', message: 'Aviso resolvido QA', status: 'RESOLVED', clientId: client.id } });
  const closedTechnical = await prisma.technicalAlert.create({ data: { type: 'CRITICAL', message: 'Técnico cancelado QA', status: 'CANCELLED', poolId: pool.id } });
  const closedGeneric = await prisma.alert.create({ data: { type: 'CRITICAL', message: 'Geral inativo QA', active: false } });
  const contextResponse = await fetch(base + '/api/alerts', { headers }), full = await contextResponse.json();
  assert.equal(contextResponse.status, 200);
  for (const id of [`notification-${closed.id}`, `technical-${closedTechnical.id}`, `generic-${closedGeneric.id}`]) assert(!full.alerts.some(row => row.id === id));
  for (const id of [`notification-${notification.id}`, `technical-${technical.id}`]) {
    const row = full.alerts.find(row => row.id === id);
    assert.equal(row.serviceNote.notes, 'Nota integral antiga QA');
    assert.equal(row.repair.problem, 'Reparação ligada QA');
    assert.equal(row.serviceNote.readings.find(item => item.label === 'pH').value, 7.4);
  }
  assert.equal((await fetch(base + '/api/alerts')).status, 401);
  const tech = await prisma.technician.create({ data: { name: 'Alertas acesso QA' } });
  const techToken = jwt.sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  assert.equal((await fetch(base + '/api/alerts', { headers: { Authorization: `Bearer ${techToken}` } })).status, 403);
  const clientToken = jwt.sign({ id: client.id, clientId: client.id, role: 'CLIENT' }, getJwtSecret(), { expiresIn: '1h' });
  assert.equal((await fetch(base + '/api/alerts', { headers: { Authorization: `Bearer ${clientToken}` } })).status, 403);
  for (const [method, path, payload] of [['POST', '/api/alerts', { poolId: pool.id, message: 'Forbidden QA' }],
    ['PUT', `/api/alerts/technical-${technical.id}/resolve`, {}], ['POST', `/api/alerts/notification-${notification.id}/convert`, { price: 10 }]]) {
    for (const [credential, expectedStatus] of [['', 401], [techToken, 403], [clientToken, 403]]) {
      const rejected = await fetch(base + path, { method, headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      assert.equal(rejected.status, expectedStatus);
    }
  }
  assert.equal((await prisma.technicalAlert.findUniqueOrThrow({ where: { id: technical.id } })).status, 'OPEN');
  console.log('PASS complete counts, critical-first ordering, linked notes/repairs, closed exclusions, read-only history and authorization');

  const language = await fetch(base + '/api/settings/language/me', { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ language: 'pt' }) });
  assert.equal(language.status, 200);
  const { chromium } = require('playwright');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    const user = JSON.stringify({ id, name: 'Alertas QA', role: 'ADMIN' });
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, user);
  }, { token, id: admin.id });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const endpoint = base + '/api/alerts', status = page.locator('#alertsStatus');
  const url = base + '/admin-alerts?q=antig';
  await page.goto(url, { waitUntil: 'networkidle' });
  await status.filter({ hasText: 'Alertas carregados' }).waitFor();
  const water = page.locator(`[data-resolve-alert="notification-${notification.id}"]`);
  assert.equal(await water.count(), 1);
  const countBefore = await page.locator('#alertsTotal').textContent();
  await page.route(endpoint, route => route.fulfill({ status: 503, json: { ok: false } }));
  await page.locator('#refreshAlerts').click();
  await status.filter({ hasText: 'ultima consulta' }).waitFor();
  assert.equal(await water.count(), 1);
  assert.equal(await page.locator('#alertsTotal').textContent(), countBefore);
  assert(!/Sem alertas abertos/.test(await page.locator('#alertsList').textContent()));
  await page.unroute(endpoint);
  for (const malformed of [{ ok: true }, { ...full, alerts: [] }, { ...full, count: 2, alerts: [full.alerts[0], full.alerts[0]] }]) {
    await page.route(endpoint, route => route.fulfill({ json: malformed }));
    assert.equal(await page.evaluate(() => loadAlerts()), false);
    assert.equal(await water.count(), 1);
    assert.match(await status.textContent(), /ultima consulta/);
    await page.unroute(endpoint);
  }
  console.log('PASS failed/malformed refresh preserves visible alerts and counts with an explicit stale-data warning');

  let release, started;
  const gate = new Promise(resolve => { release = resolve; }), entered = new Promise(resolve => { started = resolve; });
  await page.route(endpoint, async route => {
    const response = await route.fetch(); started(); await gate;
    await route.fulfill({ response });
  }, { times: 1 });
  await page.evaluate(() => { window.slowAlertRead = loadAlerts(); });
  await entered;
  try {
    await prisma.notification.update({ where: { id: notification.id }, data: { status: 'RESOLVED' } });
    assert.equal(await page.evaluate(() => loadAlerts()), true);
    assert.equal(await water.count(), 0);
  } finally { release(); }
  assert.equal(await page.evaluate(() => window.slowAlertRead), false);
  assert.equal(await water.count(), 0, 'An older read must not resurrect an alert removed by the newer snapshot');
  await page.unroute(endpoint);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert(size.scroll <= size.width + 1, JSON.stringify(size));
  }
  console.log('PASS delayed reads cannot overwrite newer data; alert screen fits mobile and desktop');

  const firstPage = await context.newPage();
  await firstPage.route(endpoint, route => route.fulfill({ status: 503, json: { ok: false } }));
  await firstPage.goto(url, { waitUntil: 'networkidle' });
  await firstPage.locator('#alertsStatus').filter({ hasText: 'Nao foi possivel consultar' }).waitFor();
  assert.equal(await firstPage.locator('#alertsTotal').textContent(), '—');
  assert(!/Sem alertas abertos/.test(await firstPage.locator('#alertsList').textContent()));
  await firstPage.locator('#alertPriorityFilter').selectOption('CRITICAL');
  assert.equal(await firstPage.locator('#alertsTotal').textContent(), '—');
  await firstPage.unroute(endpoint);
  assert.equal(await firstPage.evaluate(() => loadAlerts()), true);
  assert((await firstPage.locator('[data-resolve-alert]').count()) > 0);
  await firstPage.route(endpoint, route => route.fulfill({ json: { ok: true, count: 0, alerts: [], totals: { critical: 0, technical: 0, notifications: 0, visits: 0, generic: 0 } } }));
  assert.equal(await firstPage.evaluate(() => loadAlerts()), true);
  assert.equal(await firstPage.locator('#alertsTotal').textContent(), '0');
  assert.match(await firstPage.locator('#alertsList').textContent(), /Sem alertas abertos/);
  await firstPage.close();
  await page.evaluate(() => { localStorage.setItem('token', 'changed-session'); });
  assert.equal(await page.evaluate(() => loadAlerts()), false);
  assert.equal(await page.locator('[data-resolve-alert]').count(), 0);
  assert.equal(await page.locator('#alertsTotal').textContent(), '—');
  assert.deepEqual(errors, []);
  console.log('PASS initial failure stays unknown, refresh recovers, only validated empty data shows zero, changed session clears old alerts');
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
