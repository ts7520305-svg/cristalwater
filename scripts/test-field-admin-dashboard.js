'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser, probe, coverageClient, visitStateClient;
function installReadFailure(model, shouldFail, message) {
  const originalRead = prisma[model].findMany, originalTransaction = prisma.$transaction;
  const failOrRead = (target, read) => async function(query) {
    if (shouldFail(query)) throw Error(message);
    return read.apply(target, arguments);
  };
  prisma[model].findMany = failOrRead(prisma[model], originalRead);
  // Interactive transactions expose their own delegates; inject the same
  // source fault there so this test exercises the snapshot, not just root reads.
  prisma.$transaction = function(callback, options) {
    if (typeof callback !== 'function') return originalTransaction.apply(this, arguments);
    return originalTransaction.call(this, tx => callback(new Proxy(tx, {
      get(target, key) {
        if (key !== model) return target[key];
        return new Proxy(target[key], { get(delegate, operation) {
          return operation === 'findMany' ? failOrRead(delegate, delegate.findMany) : delegate[operation];
        } });
      },
    })), options);
  };
  return () => { prisma[model].findMany = originalRead; prisma.$transaction = originalTransaction; };
}
async function verifyVisitStates(token, admin) {
  const month = '2146-03', headers = { Authorization: 'Bearer ' + token };
  const read = async (monthRef = month) => {
    const response = await fetch(base + '/api/dashboard/admin?monthRef=' + monthRef, { headers });
    assert.equal(response.status, 200); return response.json();
  };
  const before = await read(); assert.equal(before.visits.length, 0, 'Reserved isolated QA month must be empty');
  visitStateClient = await prisma.client.create({ data: { name: 'QA monthly visit states ' + require('node:crypto').randomUUID(), active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Literal visit states <img src=x>', clientId: visitStateClient.id } });
  const add = statuses => prisma.serviceVisit.createMany({ data: statuses.map(status => ({ clientId: visitStateClient.id, poolId: pool.id, status, plannedDate: new Date(month + '-15T12:00:00Z'), date: new Date(month + '-15T12:00:00Z') })) });
  const counts = data => {
    const s = data.summary;
    return [s.visitsDoneThisMonth, s.visitsPlannedThisMonth, s.visitsNotDoneThisMonth, s.visitsThisMonth - s.visitsDoneThisMonth - s.visitsPlannedThisMonth - s.visitsNotDoneThisMonth];
  };
  await add(['NOT_DONE', 'BLOCKED', 'RETAINED', 'IMPEDIDO']);
  if (process.env.CW_DASHBOARD_VISIT_BASELINE === 'true') {
    const Module = require('node:module'), filename = require.resolve('../src/controllers/dashboardController');
    const previous = new Module(filename, module); previous.filename = filename; previous.paths = module.paths;
    previous._compile(require('node:child_process').execFileSync('git', ['show', '97cb9c3112c774665514d1a15d8749ea2ac54874:src/controllers/dashboardController.js'], { encoding: 'utf8' }), filename);
    const data = await previous.exports.getAdminDashboardData({ query: { monthRef: month } });
    const context = require('node:vm').createContext({ window: { addEventListener() {} }, localStorage: { getItem: () => null }, document: { getElementById: () => null }, Intl, Date });
    require('node:vm').runInContext(await fs.readFile(path.join(__dirname, '../frontend/admin-dashboard.js'), 'utf8'), context);
    console.log(JSON.stringify({ regression: 'TASK396', total: data.summary.visitsThisMonth, counts: counts(data), dashboardRejected: context.buildDashboardView({ ok: true, ...data }, month) === null }));
    assert.deepEqual(counts(data), [0, 0, 4, 0], 'An impeded visit must count once');
    return;
  }
  assert.deepEqual(counts(await read()), [0, 0, 4, 0]);
  await add(['DONE', 'completed', 'Concluída', 'CONCLUIDO', 'PLANNED', 'PENDING', 'PENDING_TECHNICIAN', 'Agendada', 'PLANEADO', 'IN_PROGRESS', 'Em execução', 'not done', 'Não concluída', 'FAILED', 'CANCELLED', 'Canceled', 'Cancelada', 'ARCHIVED', 'DONE_LATER', '', '   ']);
  await prisma.serviceVisit.createMany({ data: ['DONE', 'NOT_DONE'].map(status => ({ clientId: visitStateClient.id, poolId: pool.id, status, plannedDate: new Date('2146-04-15T12:00:00Z'), date: new Date('2146-04-15T12:00:00Z') })) });
  const snapshot = () => prisma.serviceVisit.findMany({ where: { clientId: visitStateClient.id }, orderBy: { id: 'asc' } });
  const unchanged = await snapshot(), mixed = await read(), repeat = await read();
  assert.equal(mixed.visits.length, 25); assert.deepEqual(counts(mixed), [4, 7, 7, 7]);
  assert.deepEqual(repeat.visits, mixed.visits); assert.deepEqual(repeat.summary, mixed.summary);
  for (const visit of mixed.visits) assert.equal(visit.status, unchanged.find(row => row.id === visit.id).status, 'Preserve literal stored status');
  assert.deepEqual(counts(await read('2146-04')), [1, 0, 1, 0]);
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 1000 }, timezoneId: 'Europe/Lisbon' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
  }, { token, id: admin.id });
  const page = await context.newPage(), writes = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.method()); });
  await page.goto(base + '/admin-dashboard', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  const select = async value => { await page.locator('#monthRef').fill(value); assert.equal(await page.evaluate(() => loadDashboard()), true); };
  await select(month);
  assert.equal(await page.locator('[data-dashboard-card="visits"] strong').textContent(), '4 / 25');
  assert.equal(await page.locator('#efficiencyRate').textContent(), '16%');
  const operational = await page.locator('#operationalSummary').textContent();
  assert.match(operational, /Planeadas \/ em curso7/); assert.match(operational, /Não realizadas \/ impedidas7/); assert.match(operational, /Outros estados7/);
  await page.evaluate(() => { window.visitChartConfigs = []; window.Chart = function(canvas, config) { window.visitChartConfigs.push({ id: canvas.id, config }); this.destroy = () => {}; }; });
  assert.equal(await page.evaluate(() => loadDashboard()), true);
  const chart = await page.evaluate(() => window.visitChartConfigs.find(row => row.id === 'productivityChart').config.data);
  assert.deepEqual(chart.datasets[0].data, [4, 7, 7, 7]); assert.equal(chart.labels[1], 'Planeadas / em curso');
  const visual = path.join(__dirname, '../reports/field-visual/admin-dashboard'); await fs.mkdir(visual, { recursive: true });
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(visual, 'visit-states-' + width + '.png'), fullPage: true });
  }
  await select('2146-04'); assert.equal(await page.locator('[data-dashboard-card="visits"] strong').textContent(), '1 / 2');
  await select('2146-05'); assert.equal(await page.locator('#monthVisitCount').textContent(), '0'); assert.equal(await page.locator('#efficiencyRate').textContent(), '—');
  await select(month);
  const endpoint = '**/api/dashboard/admin?*';
  await page.route(endpoint, route => route.fulfill({ json: { ...mixed, summary: { ...mixed.summary, visitsPlannedThisMonth: 25 } } }));
  assert.equal(await page.evaluate(() => loadDashboard()), false); assert.equal(await page.locator('#monthVisitCount').textContent(), '—');
  await page.unroute(endpoint); assert.equal(await page.evaluate(() => loadDashboard()), true);
  assert.deepEqual(writes, []); assert.deepEqual(errors, []); assert.deepEqual(await snapshot(), unchanged);
  await context.close();
  await fs.writeFile(path.join(visual, 'visit-states.json'), JSON.stringify({ ok: true, phase: 'assertions-completed', fixtureVisits: 27, selectedMonth: month, visits: 25, done: 4, plannedOrInProgress: 7, notDone: 7, other: 7, completionRate: 16, repeatedReadStable: true, literalStatusPreserved: true, otherMonthAndEmptyMonthChecked: true, inconsistentResponseRefused: true, noBusinessWrites: true }, null, 2));
  console.log('PASS monthly visit states: 27 real SQL records, exclusive totals, literal aliases/blank/unknown states, adjacent and empty months, exact chart, inconsistent response unavailable, no writes');
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' }, getJwtSecret(), { expiresIn: '1h' });
  const response = await fetch(base + '/api/dashboard/admin?monthRef=2079-01', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(response.status, 200); const original = await response.json();
  const packet = { ...original, alertCoverage: undefined, visits: [], technicians: [], alerts: [],
    summary: { ...original.summary, visitsThisMonth: 0, visitsDoneThisMonth: 0, visitsNotDoneThisMonth: 0, visitsPlannedThisMonth: 0, openAlerts: 0, totalInvoices: 0, pendingInvoices: 0, partialInvoices: 0, monthBilled: 0, monthPaid: 0, monthOpen: 0, totalBilledAll: 12000, totalPaidAll: 9999, totalOpenAll: 5000, operationalCost: 24 },
    predictiveAnalysis: { tomorrowRiskZones: [{ zone: 'Zona literal <img src=x onerror=alert(1)>', visits: 8, alerts: 3 }], recommendations: [{ message: 'PREVISÃO NÃO COMPROVADA amanhã' }] },
  };
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  await verifyVisitStates(token, admin);
  if (process.env.CW_DASHBOARD_VISIT_BASELINE === 'true') return;
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
    const restore = installReadFailure(model, () => true, 'PRIVATE_SOURCE_FAILURE');
    try {
      const result = await fetch('http://127.0.0.1:' + probe.address().port + '/api/dashboard/admin', { headers: { Authorization: 'Bearer ' + token } });
      assert.equal(result.status, 500, model + ' read failure must not become zero');
      const body = await result.json(); assert.equal(body.ok, false); assert(!JSON.stringify(body).includes('PRIVATE_SOURCE'));
    } finally { restore(); }
  }
  const readCoverage = async () => {
    const response = await fetch(base + '/api/dashboard/admin?monthRef=2079-01', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status, 200); return response.json();
  };
  const beforeCoverage = await readCoverage();
  const prefix = 'QA alert coverage ' + require('node:crypto').randomUUID();
  coverageClient = await prisma.client.create({ data: { name: prefix, active: true } });
  const coveragePool = await prisma.pool.create({ data: { name: prefix, clientId: coverageClient.id } });
  const at = new Date('2199-01-01T12:00:00Z'), closedAt = new Date('2199-01-02T12:00:00Z');
  const amount = 503, excluded = 205;
  await prisma.technicalAlert.createMany({ data: Array.from({ length: amount + excluded }, (_, i) => ({ poolId: coveragePool.id, type: 'QA', message: prefix + ' <img src=x> ' + i, status: i < amount ? 'OPEN' : 'rEsOlVeD', createdAt: i < amount ? at : closedAt })) });
  await prisma.notification.createMany({ data: Array.from({ length: amount + excluded }, (_, i) => ({ clientId: coverageClient.id, type: 'ALERT', message: prefix + ' ' + i, role: 'ADMIN', status: i < amount ? 'PENDING' : 'cLoSeD', createdAt: i < amount ? at : closedAt })) });
  // Whitespace alone is not an alert on a completed visit. A NOT_DONE visit
  // remains actionable even without text (covered in test-field-alert-states).
  await prisma.serviceVisit.createMany({ data: Array.from({ length: amount + excluded }, (_, i) => ({ clientId: coverageClient.id, poolId: coveragePool.id, status: i < amount ? 'NOT_DONE' : 'DONE', alerts: i < amount ? prefix + ' ' + i : '   ', date: at, plannedDate: at, updatedAt: i < amount ? at : closedAt })) });
  const expectedTotal = beforeCoverage.alertCoverage.total + amount * 3;
  if (process.env.CW_DASHBOARD_ALERT_BASELINE === 'true') {
    const Module = require('node:module'), { execFileSync } = require('node:child_process');
    const file = path.join(__dirname, '../src/controllers/dashboardController.js');
    const historical = new Module(file); historical.filename = file; historical.paths = Module._nodeModulePaths(path.dirname(file));
    historical._compile(execFileSync('git', ['show', '5caafa64e24dff443da824a2c8f80233683d7921:src/controllers/dashboardController.js'], { encoding: 'utf8' }), file);
    const old = await historical.exports.getAdminDashboardData({ query: { monthRef: '2079-01' } });
    console.log(JSON.stringify({ regression: 'TASK395', eligibleFixture: amount * 3, legacyVisibleFixture: old.alerts.filter(row => row.clientId === coverageClient.id).length, legacyOpenAlerts: old.summary.openAlerts, expectedTotal, legacyTotal: old.alertCoverage?.total ?? null }));
    assert.equal(old.alertCoverage?.total, expectedTotal, 'Older eligible alerts must not disappear behind the 200 newest candidates');
  }
  const afterCoverage = await readCoverage();
  assert.equal(afterCoverage.alertCoverage.total, expectedTotal);
  assert.equal(afterCoverage.alertCoverage.returned, 600); assert.equal(afterCoverage.alertCoverage.truncated, true);
  assert.equal(afterCoverage.summary.openAlerts, afterCoverage.alerts.length, 'Preserve the legacy returned-row count');
  for (const source of ['technical', 'notification', 'visit']) {
    assert.equal(afterCoverage.alertCoverage.sources[source].total, beforeCoverage.alertCoverage.sources[source].total + amount);
    assert.equal(afterCoverage.alertCoverage.sources[source].returned, 200);
  }
  assert.equal(afterCoverage.alerts.filter(row => row.clientId === coverageClient.id).length, 600);
  assert(afterCoverage.alerts.every(row => !/resolved|closed/i.test(row.status)));
  const repeatCoverage = await readCoverage();
  assert.deepEqual(repeatCoverage.alertCoverage, afterCoverage.alertCoverage);
  assert.deepEqual(repeatCoverage.alerts.map(row => row.id), afterCoverage.alerts.map(row => row.id));
  const coverageContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 1000 } });
  await coverageContext.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await coverageContext.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
  }, { token, id: admin.id });
  const coveragePage = await coverageContext.newPage();
  const coverageWrites = []; coveragePage.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') coverageWrites.push(request.url()); });
  await coveragePage.goto(base + '/admin-dashboard', { waitUntil: 'networkidle' });
  await coveragePage.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  assert.equal(await coveragePage.locator('[data-dashboard-card="alerts"] strong').textContent(), String(expectedTotal));
  assert.match(await coveragePage.locator('[data-dashboard-card="alerts"] small').textContent(), /600 de .*Pré-visualização parcial/);
  assert.equal(await coveragePage.locator('#criticalAlerts').textContent(), String(expectedTotal));
  assert.equal(await coveragePage.locator('#intelligencePanel img').count(), 0);
  assert(await coveragePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await coveragePage.screenshot({ path: path.join(visual, 'alert-coverage-320.png'), fullPage: true });
  await coveragePage.route('**/api/dashboard/admin?*', route => route.fulfill({ json: { ...afterCoverage, monthRef: new URL(route.request().url()).searchParams.get('monthRef'), alertCoverage: { ...afterCoverage.alertCoverage, total: 0 } } }));
  assert.equal(await coveragePage.evaluate(() => loadDashboard()), false);
  assert.equal(await coveragePage.locator('#criticalAlerts').textContent(), '—');
  assert.equal(await coveragePage.locator('[data-dashboard-card="alerts"] strong').textContent(), '—');
  assert.deepEqual(coverageWrites, []); await coverageContext.close();
  for (const model of ['technicalAlert', 'notification', 'serviceVisit']) {
    const restore = installReadFailure(model, query => query.where?.AND?.some(condition => condition.id?.gt > 0), 'PRIVATE_LATE_ALERT_PAGE');
    try {
      const failed = await fetch('http://127.0.0.1:' + probe.address().port + '/api/dashboard/admin', { headers: { Authorization: 'Bearer ' + token } });
      assert.equal(failed.status, 500, model + ' later page failure');
      const body = await failed.json(); assert.equal(body.ok, false); assert(!JSON.stringify(body).includes('PRIVATE_LATE_ALERT_PAGE'));
    } finally { restore(); }
  }
  assert.equal(await prisma.technicalAlert.count({ where: { poolId: coveragePool.id } }), amount + excluded);
  assert.equal(await prisma.notification.count({ where: { clientId: coverageClient.id } }), amount + excluded);
  assert.equal(await prisma.serviceVisit.count({ where: { clientId: coverageClient.id } }), amount + excluded);
  const coverageEvidence = { ok: true, eligibleFixture: amount * 3, excludedFixture: excluded * 3, total: expectedTotal, coverage: afterCoverage.alertCoverage, returnedFixture: 600, consistentRepeatedRead: true, malformedMetadataRefused: true, lateSourceFailuresChecked: 3, noBusinessWrites: true };
  await fs.writeFile(path.join(visual, 'alert-coverage.json'), JSON.stringify(coverageEvidence, null, 2));
  console.log('PASS dashboard alert coverage: 1509 eligible records beyond 200/source, 615 excluded rows do not consume the preview, exact counts, bounded details, deterministic ties, incomplete totals unavailable, late failures rejected');
  console.log('PASS administrative dashboard: exact monthly zero, no unsupported profit/forecast/health score, explicit scope, failed reads unavailable, restored month, offline/session/late reads, responsive layout and no business requests');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); if (probe) await new Promise(resolve => probe.close(resolve));
  if (coverageClient) {
    await prisma.technicalAlert.deleteMany({ where: { pool: { clientId: coverageClient.id } } });
    await prisma.notification.deleteMany({ where: { clientId: coverageClient.id } });
    await prisma.serviceVisit.deleteMany({ where: { clientId: coverageClient.id } });
    await prisma.pool.deleteMany({ where: { clientId: coverageClient.id } });
    await prisma.client.delete({ where: { id: coverageClient.id } });
  }
  if (visitStateClient) {
    await prisma.serviceVisit.deleteMany({ where: { clientId: visitStateClient.id } });
    await prisma.pool.deleteMany({ where: { clientId: visitStateClient.id } });
    await prisma.client.delete({ where: { id: visitStateClient.id } });
  }
  await prisma.$disconnect();
});
