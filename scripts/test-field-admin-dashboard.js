'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser, probe;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' }, getJwtSecret(), { expiresIn: '1h' });
  const response = await fetch(base + '/api/dashboard/admin?monthRef=2079-01', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(response.status, 200); const original = await response.json();
  const packet = { ...original, visits: [], technicians: [], alerts: [],
    summary: { ...original.summary, visitsThisMonth: 0, visitsDoneThisMonth: 0, visitsNotDoneThisMonth: 0, visitsPlannedThisMonth: 0, openAlerts: 0, totalInvoices: 0, pendingInvoices: 0, partialInvoices: 0, monthBilled: 0, monthPaid: 0, monthOpen: 0, totalBilledAll: 12000, totalPaidAll: 9999, totalOpenAll: 5000, operationalCost: 24 },
    predictiveAnalysis: { tomorrowRiskZones: [{ zone: 'Zona literal <img src=x onerror=alert(1)>', visits: 8, alerts: 3 }], recommendations: [{ message: 'PREVISÃO NÃO COMPROVADA amanhã' }] },
  };
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 1000 }, timezoneId: 'Europe/Lisbon' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, user }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
  }, { token, user: { id: admin.id, role: 'ADMIN' } });
  const page = await context.newPage(), errors = [], writes = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/') && r.method() !== 'GET') writes.push(r.method()); });
  const endpoint = '**/api/dashboard/admin?*';
  const fulfill = data => route => route.fulfill({ json: { ...data, monthRef: new URL(route.request().url()).searchParams.get('monthRef') } });
  await page.route(endpoint, fulfill(packet));
  if (process.env.CW_ADMIN_DASHBOARD_BASELINE === 'true') {
    const { execFileSync } = require('node:child_process');
    for (const file of ['admin-dashboard.html', 'admin-dashboard.js']) {
      const body = execFileSync('git', ['show', '49f5a0613ea41de8c05b868c2d6430a2be6ef615:frontend/' + file], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
      await page.route('**/' + file.replace(/\.html$/, ''), route => route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : 'application/javascript', body }));
    }
  }
  await page.goto(base + '/admin-dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Resumo Operacional online');
  const shown = { profit: await page.locator('#estimatedProfit').textContent(), financial: await page.locator('#financialSummary').textContent(), intelligence: await page.locator('#intelligencePanel').textContent() };
  if (process.env.CW_ADMIN_DASHBOARD_BASELINE === 'true') {
    console.log(JSON.stringify(shown));
    assert.equal(shown.profit, 'Não apurado', 'Missing costs cannot become profit');
    return;
  }
  assert.equal(shown.profit, 'Não apurado'); assert(!/PREVISÃO|amanhã|controlad|estável/.test(shown.intelligence));
  assert(!/12000|9999|5000|12\s?000|9\s?999|5\s?000/.test(shown.financial));
  assert.equal(await page.locator('#monthReceived').textContent(), '0,00 €');
  assert.equal(await page.locator('#efficiencyRate').textContent(), '—');
  assert.equal(await page.locator('[data-dashboard-card="visits"] strong').textContent(), '0 / 0');
  assert.match(await page.locator('#summaryScope').textContent(), /mês|período/);
  const recover = async () => { await page.unroute(endpoint); await page.route(endpoint, fulfill(packet)); assert.equal(await page.evaluate(() => loadDashboard()), true); };
  for (const fault of [{ status: 503, json: { ok: false } }, { json: { ok: true } }, { contentType: 'text/html', body: 'unavailable' }, { json: { ...packet, monthRef: '1900-01' } }, { json: { ...packet, summary: { ...packet.summary, monthPaid: null } } }]) {
    await page.unroute(endpoint); await page.route(endpoint, r => r.fulfill(fault));
    assert.equal(await page.evaluate(() => loadDashboard()), false);
    for (const id of ['monthReceived', 'estimatedProfit', 'efficiencyRate', 'monthVisitCount', 'monthDocumentCount']) assert.equal(await page.locator('#' + id).textContent(), '—');
    assert.equal(await page.locator('#status').getAttribute('data-state'), 'error'); await recover();
  }
  await page.locator('#monthRef').fill(''); assert.equal(await page.evaluate(() => loadDashboard()), false);
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'invalid');
  await page.locator('#monthRef').fill('2079-02');
  await page.locator('#refreshBtn').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#monthRef').inputValue(), '2079-02');
  assert.match(await page.locator('#summaryScope').textContent(), /2079-02/);
  await context.setOffline(true); await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'offline');
  assert.equal(await page.locator('#monthReceived').textContent(), '—');
  await context.setOffline(false); await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  const visual = path.join(__dirname, '../reports/field-visual/admin-dashboard'); await fs.mkdir(visual, { recursive: true });
  for (const [theme, width] of [['light', 320], ['light', 390], ['light', 1440], ['dark', 390]]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForFunction(() => document.getAnimations().every(a => !(a instanceof CSSTransition) || a.playState !== 'running'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow ' + width);
    assert(await page.locator('#monthRef,#refreshBtn').evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44)));
    const contrast = await page.locator('main h2,main h3,main p,main label,main strong,main b,main small,main .kpi-label,main .role-card span,main .role-action span,[data-cw-open-drawer]').evaluateAll(items => items.filter(el => el.getClientRects().length).map(el => {
      const rgb = value => value.match(/[\d.]+/g).map(Number);
      const lum = values => values.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const front = lum(rgb(getComputedStyle(el).color)); let parent = el, back;
      do { back = rgb(getComputedStyle(parent).backgroundColor); parent = parent.parentElement; } while (back[3] === 0 && parent);
      const behind = lum(back); return { text: el.textContent.slice(0, 30), ratio: (Math.max(front, behind) + .05) / (Math.min(front, behind) + .05) };
    }));
    assert(contrast.every(row => row.ratio >= 4.5), JSON.stringify({ theme, width, failed: contrast.filter(row => row.ratio < 4.5) }));
    await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(visual, theme + '-' + width + '.png'), fullPage: true });
  }
  const literal = { ...packet, summary: { ...packet.summary, openAlerts: 1, visitsThisMonth: 4, visitsDoneThisMonth: 1, visitsNotDoneThisMonth: 1, visitsPlannedThisMonth: 1, monthPaid: -12.34 }, visits: [{}, {}, {}, {}], alerts: [{ id: 'literal-1', message: '<img src=x onerror=alert(1)> mensagem original' }] };
  await page.unroute(endpoint); await page.route(endpoint, fulfill(literal));
  assert.equal(await page.evaluate(() => loadDashboard()), true);
  assert.match(await page.locator('#intelligencePanel').textContent(), /<img src=x/);
  assert.equal(await page.locator('#intelligencePanel img').count(), 0);
  assert.equal(await page.locator('#efficiencyRate').textContent(), '25%');
  assert.match(await page.locator('#monthReceived').textContent(), /-12,34/);
  assert.match(await page.locator('#operationalSummary').textContent(), /Outros estados1/);
  await page.evaluate(() => { window.chartConfigs = []; window.Chart = function(canvas, config) { window.chartConfigs.push({ id: canvas.id, config }); this.destroy = () => {}; }; });
  await page.evaluate(() => loadDashboard());
  const chartData = await page.evaluate(() => window.chartConfigs.map(row => ({ id: row.id, values: row.config.data.datasets[0].data })));
  assert.deepEqual(chartData, [{ id: 'productivityChart', values: [1, 1, 1, 1] }, { id: 'billingChart', values: [0, -12.34, 0] }]);
  await recover();
  await page.route('**/api/gps/live', route => route.fulfill({ json: [{ name: '<img src=x> Técnico literal', latitude: 37.1, longitude: -8.6, updatedAt: '2026-09-28T08:00:00Z' }, { name: 'Sem coordenadas', latitude: null, longitude: null }] }));
  await page.evaluate(() => {
    window.testMapMarkers = new Set();
    window.L = {
      map: () => ({ setView() { return this; }, removeLayer(marker) { window.testMapMarkers.delete(marker); }, fitBounds() {} }),
      tileLayer: () => ({ addTo() {} }),
      marker: point => ({ point, addTo() { window.testMapMarkers.add(this); return this; }, bindPopup(popup) { this.popup = popup; return this; } }),
    };
    initLiveMap();
  });
  await page.waitForFunction(() => document.querySelector('#liveTechnicians').textContent === '1');
  assert(await page.evaluate(() => [...window.testMapMarkers].every(marker => marker.popup.textContent.includes('<img src=x>') && !marker.popup.querySelector('img'))));
  await page.unroute('**/api/gps/live');
  await page.route('**/api/gps/live', route => route.fulfill({ status: 503, json: { ok: false } }));
  await page.evaluate(() => loadLiveMap());
  assert.equal(await page.locator('#liveTechnicians').textContent(), '—');
  assert.equal(await page.evaluate(() => window.testMapMarkers.size), 0);
  await page.evaluate(packet => {
    window.savedDashboardFetch = window.fetch;
    window.fetch = (...args) => {
      if (String(args[0]).includes('/api/dashboard/admin?')) return new Promise(resolve => { window.releaseDashboard = () => resolve(new Response(JSON.stringify({ ...packet, monthRef: document.querySelector('#monthRef').value }), { status: 200, headers: { 'Content-Type': 'application/json' } })); });
      if (String(args[0]).endsWith('/gps/live')) return new Promise(resolve => { window.releaseMap = () => resolve(new Response(JSON.stringify([{ name: 'Sessão anterior', latitude: 37.1, longitude: -8.6 }]), { status: 200, headers: { 'Content-Type': 'application/json' } })); });
      return window.savedDashboardFetch(...args);
    };
    window.pendingDashboard = loadDashboard();
    window.pendingMap = loadLiveMap();
  }, packet);
  await page.evaluate(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'user', oldValue: 'A', newValue: 'B' })); window.dispatchEvent(new StorageEvent('storage', { key: 'user', oldValue: 'B', newValue: 'A' })); });
  await page.evaluate(async () => { window.releaseDashboard(); window.releaseMap(); await Promise.all([window.pendingDashboard, window.pendingMap]); window.fetch = window.savedDashboardFetch; });
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'session');
  assert.equal(await page.locator('#monthReceived').textContent(), '—'); assert.equal(await page.locator('#refreshBtn').isDisabled(), true);
  assert.equal(await page.locator('#liveTechnicians').textContent(), '—'); assert.equal(await page.evaluate(() => window.testMapMarkers.size), 0);
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('user', '{"id":999,"role":"ADMIN"}'));
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'session');
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  const app = require('express')(); app.use('/api/dashboard', require('../src/routes/dashboardRoutes'));
  probe = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  for (const model of ['technician', 'technicalAlert', 'notification', 'serviceVisit']) {
    const originalRead = prisma[model].findMany;
    try {
      prisma[model].findMany = async () => { throw Error('PRIVATE_SOURCE_FAILURE'); };
      const result = await fetch('http://127.0.0.1:' + probe.address().port + '/api/dashboard/admin', { headers: { Authorization: 'Bearer ' + token } });
      assert.equal(result.status, 500, model + ' read failure must not become zero');
      const body = await result.json(); assert.equal(body.ok, false); assert(!JSON.stringify(body).includes('PRIVATE_SOURCE'));
    } finally { prisma[model].findMany = originalRead; }
  }
  console.log('PASS administrative dashboard: exact monthly zero, no unsupported profit/forecast/health score, explicit scope, failed reads unavailable, restored month, offline/session/late reads, responsive layout and no business requests');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (probe) await new Promise(resolve => probe.close(resolve)); await prisma.$disconnect(); });
