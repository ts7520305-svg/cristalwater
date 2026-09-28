'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002', monthA = '2081-01', monthB = '2081-02';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const prefix = 'QA400-' + randomUUID(), endpoint = '**/api/dashboard/admin?*';
const money = value => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
let client, browser;
(async () => {
  await fs.rm(path.join(__dirname, '../reports/field-visual/legacy-dashboard/evidence.json'), { force: true });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' }, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: 'Bearer ' + token };
  const read = async month => { const response = await fetch(base + '/api/dashboard/admin?monthRef=' + month, { headers }); assert.equal(response.status, 200); return response.json(); };
  client = await prisma.client.create({ data: { name: prefix + ' <img src=x>', active: false, status: 'PAUSED' } });
  const zone = prefix + ' <script>literal</script> ' + 'Z'.repeat(90);
  const pool = await prisma.pool.create({ data: { name: prefix, zone, clientId: client.id } });
  for (const [month, value] of [[monthA, 123.45], [monthB, 50.67]]) await prisma.invoice.create({ data: { clientId: client.id, month, status: 'PENDING', amount: value, total: value, totalAmount: value, amountOpen: value } });
  await prisma.serviceVisit.createMany({ data: ['DONE', 'PLANNED', 'IN_PROGRESS', 'FAILED', 'CANCELLED', 'UNKNOWN'].map(status => ({ clientId: client.id, poolId: pool.id, status, plannedDate: new Date(monthA + '-15T12:00:00Z'), date: new Date(monthA + '-15T12:00:00Z') })) });
  const a = await read(monthA), b = await read(monthB);
  const snapshot = () => Promise.all([
    prisma.client.findUnique({ where: { id: client.id } }), prisma.pool.findMany({ where: { clientId: client.id } }),
    prisma.invoice.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),
    prisma.serviceVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),
    prisma.payment.count(), prisma.communicationLog.count(), prisma.emailLog.count(),
  ]);
  const original = await snapshot();
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 1000 }, timezoneId: 'America/Los_Angeles' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
  }, { token, id: admin.id });
  const page = await context.newPage(), errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.method()); });
  if (process.env.CW_LEGACY_DASHBOARD_BASELINE === 'true') {
    const { execFileSync } = require('node:child_process');
    for (const file of ['dashboard.html', 'dashboard.js']) {
      const body = execFileSync('git', ['show', '1b8c97bc2eb25565ef1b8bfcb8b4872c82ac30df:frontend/' + file], { encoding: 'utf8' });
      await page.route('**/' + file.replace(/\.html$/, ''), route => route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : 'application/javascript', body }));
    }
  }
  await page.goto(base + '/dashboard', { waitUntil: 'networkidle' });
  await page.locator('#monthRef').fill(monthA); await page.evaluate(() => loadDashboard());
  const first = { credit: await page.locator('#creditBalance').textContent(), potential: await page.locator('#monthlyPotential').textContent(), zones: await page.locator('#poolsByZone').textContent(), visits: await page.locator('#visitsSub').textContent(), alerts: await page.locator('#openAlerts').textContent(), expectedAlertTotal: a.alertCoverage.total, returnedAlerts: a.alerts.length };
  // Deliberately ignore AbortSignal so generation and visible-month checks are necessary.
  await page.evaluate(({ older, newer }) => {
    window.savedLegacyFetch = window.fetch; let calls = 0;
    window.fetch = (...args) => String(args[0]).includes('/api/dashboard/admin?') ? ++calls === 1
      ? new Promise(resolve => { window.releaseLegacyRead = () => resolve(new Response(JSON.stringify(older), { status: 200, headers: { 'Content-Type': 'application/json' } })); })
      : Promise.resolve(new Response(JSON.stringify(newer), { status: 200, headers: { 'Content-Type': 'application/json' } })) : window.savedLegacyFetch(...args);
    window.pendingLegacyRead = loadDashboard();
  }, { older: { ...a, summary: { ...a.summary, totalClients: 7 } }, newer: { ...b, summary: { ...b.summary, totalClients: 9 } } });
  await page.locator('#monthRef').fill(monthB); await page.evaluate(() => loadDashboard());
  await page.evaluate(async () => { window.releaseLegacyRead(); await window.pendingLegacyRead; window.fetch = window.savedLegacyFetch; });
  const afterLate = await page.locator('#totalClients').textContent();
  await page.route(endpoint, route => route.fulfill({ status: 503, json: { ok: false, error: 'PRIVATE_READ_FAILURE' } }), { times: 1 });
  await page.evaluate(() => loadDashboard()); const afterError = await page.locator('#totalClients').textContent();
  await page.route(endpoint, route => route.fulfill({ json: { ok: true } }), { times: 1 });
  await page.evaluate(() => loadDashboard()); const afterPartial = await page.locator('#totalClients').textContent();
  if (process.env.CW_LEGACY_DASHBOARD_BASELINE === 'true') {
    console.log(JSON.stringify({ regression: 'TASK400', ...first, afterLate, afterError, afterPartial }));
    assert.equal(afterLate, '9', 'An older month must not overwrite the selected month'); return;
  }
  assert.equal(first.credit, '—'); assert(!first.potential.includes('0,00') && !first.potential.includes('0.00'));
  assert(!first.zones.includes('€')); assert.match(first.visits, /planeadas \/ em curso/);
  assert.equal(first.alerts, String(first.expectedAlertTotal)); assert.equal(afterLate, '9'); assert.equal(afterError, '—'); assert.equal(afterPartial, '—');
  assert(!await page.locator('#dashboardStatus').textContent().then(text => text.includes('PRIVATE')));
  const recover = async (month = monthA) => { await page.locator('#monthRef').fill(month); assert.equal(await page.evaluate(() => loadDashboard()), true); };
  await recover(); assert.equal(await page.locator('#monthOpen').textContent(), money(a.summary.monthOpen));
  assert.equal(await page.locator('#monthBilled').textContent(), money(a.summary.monthBilled));
  assert.equal(await page.locator('#monthPaid').textContent(), money(a.summary.monthPaid));
  for (const alert of a.alerts.filter(row => Number.isSafeInteger(row.clientId) && row.clientId > 0).slice(0, 3)) assert(await page.locator('#alertsList a[href="/admin-clients?clientId=' + alert.clientId + '"]').count());
  assert.match(await page.locator('#poolsByZone').textContent(), /<script>literal<\/script>/); assert.equal(await page.locator('#poolsByZone script,#topDebtorsTable img').count(), 0);
  const visible = ['totalClients', 'totalPools', 'monthBilled', 'monthPaid', 'monthOpen', 'creditBalance', 'openAlerts', 'visitsThisMonth'];
  const empty = async () => { for (const id of visible) assert.equal(await page.locator('#' + id).textContent(), '—'); };
  for (const fault of [{ status: 403, json: {} }, { contentType: 'text/html', body: '<h1>Unavailable</h1>' },
    { json: { ...a, monthRef: monthB } }, { json: { ...a, summary: { ...a.summary, monthPaid: null } } },
    { json: { ...a, alertCoverage: { ...a.alertCoverage, total: a.alertCoverage.total + 1 } } },
    { json: { ...a, poolsByZone: [] } }]) {
    await page.route(endpoint, route => route.fulfill(fault), { times: 1 }); assert.equal(await page.evaluate(() => loadDashboard()), false); await empty(); await recover();
  }
  await page.locator('#monthRef').fill(monthB); await empty();
  await page.locator('#refreshBtn').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#dashboardStatus').dataset.state === 'ready');
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('#monthRef').inputValue(), monthB);
  assert.equal(await page.locator('#monthOpen').textContent(), money(b.summary.monthOpen));
  let invalidRequests = 0; const invalidCount = request => { if (request.url().includes('/api/dashboard/admin?')) invalidRequests++; };
  page.on('request', invalidCount); await page.locator('#monthRef').fill(''); assert.equal(await page.evaluate(() => loadDashboard()), false); assert.equal(invalidRequests, 0); page.off('request', invalidCount); await empty(); await recover();
  await context.setOffline(true); await page.waitForFunction(() => document.querySelector('#dashboardStatus').dataset.state === 'offline'); await empty();
  await context.setOffline(false); await page.waitForFunction(() => document.querySelector('#dashboardStatus').dataset.state === 'ready');
  await page.evaluate(() => {
    window.savedLegacyFetch = window.fetch; window.savedLegacyTimeout = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => window.savedLegacyTimeout(fn, ms === 15000 ? 40 : ms, ...args);
    window.fetch = (...args) => String(args[0]).includes('/api/dashboard/admin?') ? new Promise(resolve => { window.releaseLegacyRead = resolve; }) : window.savedLegacyFetch(...args);
    window.pendingLegacyRead = loadDashboard();
  });
  await page.waitForFunction(() => document.querySelector('#dashboardStatus').textContent === 'Tempo de consulta excedido.'); await empty();
  await page.evaluate(async packet => {
    window.releaseLegacyRead(new Response(JSON.stringify(packet), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await window.pendingLegacyRead; window.fetch = window.savedLegacyFetch; window.setTimeout = window.savedLegacyTimeout;
  }, a);
  await empty(); await recover();
  const visual = path.join(__dirname, '../reports/field-visual/legacy-dashboard'); await fs.mkdir(visual, { recursive: true });
  for (const [theme, width] of [['light', 320], ['light', 390], ['light', 1440], ['dark', 390]]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => document.getAnimations().every(animation => !(animation instanceof CSSTransition) || animation.playState !== 'running'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow at ' + width);
    assert.equal(await page.locator('#dashboardResults').evaluate(el => getComputedStyle(el).display), 'block');
    assert(await page.locator('#dashboardResults .grid .card').evaluateAll(nodes => nodes.every(el => el.getBoundingClientRect().width >= 200)), 'Cards remain readable, not compressed into status badges');
    assert((await page.locator('#queryForm').boundingBox()).y < 600, 'Query controls stay near the top of the page');
    assert(await page.locator('#monthRef,#refreshBtn').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44)));
    const contrasts = await page.locator('main h2,main strong,main .card-value,main .card-title,main .card-sub,main label,main p,[data-cw-open-drawer]').evaluateAll(nodes => nodes.filter(el => el.getClientRects().length).map(el => {
      const rgb = value => value.match(/[\d.]+/g).map(Number);
      const lum = values => values.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const front = lum(rgb(getComputedStyle(el).color)); let parent = el, back;
      do { back = rgb(getComputedStyle(parent).backgroundColor); parent = parent.parentElement; } while (back[3] === 0 && parent);
      const behind = lum(back); return { text: el.textContent.slice(0, 35), color: getComputedStyle(el).color, background: back, ratio: (Math.max(front, behind) + .05) / (Math.min(front, behind) + .05) };
    }));
    assert(contrasts.every(value => value.ratio >= 4.5), 'Readable text contrast in ' + theme + ': ' + JSON.stringify(contrasts.filter(value => value.ratio < 4.5).slice(0, 8)));
    await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(visual, theme + '-' + width + '.png') });
  }
  const literal = { ...a, summary: { ...a.summary, monthPaid: -12.34 }, alertCoverage: undefined };
  await page.route(endpoint, route => route.fulfill({ json: literal }), { times: 1 }); assert.equal(await page.evaluate(() => loadDashboard()), true);
  assert.equal(await page.locator('#monthPaid').textContent(), money(-12.34)); assert.equal(await page.locator('#openAlerts').textContent(), '—');
  assert.match(await page.locator('#alertScope').textContent(), /por confirmar/); await recover();
  for (const mutation of ['storage-return', 'same-tab']) {
    await page.evaluate(packet => {
      window.savedLegacyFetch = window.fetch;
      window.fetch = (...args) => String(args[0]).includes('/api/dashboard/admin?') ? new Promise(resolve => { window.releaseLegacyRead = () => resolve(new Response(JSON.stringify(packet), { status: 200, headers: { 'Content-Type': 'application/json' } })); }) : window.savedLegacyFetch(...args);
      window.pendingLegacyRead = loadDashboard();
    }, a);
    await page.evaluate(mutation => {
      if (mutation === 'same-tab') localStorage.setItem('user', '{"id":999,"role":"ADMIN"}');
      else { window.dispatchEvent(new StorageEvent('storage', { key: 'user', oldValue: 'A', newValue: 'B' })); window.dispatchEvent(new StorageEvent('storage', { key: 'user', oldValue: 'B', newValue: 'A' })); }
    }, mutation);
    await page.waitForFunction(() => document.querySelector('#dashboardStatus').dataset.state === 'session');
    await page.evaluate(async () => { window.releaseLegacyRead(); await window.pendingLegacyRead; window.fetch = window.savedLegacyFetch; });
    await empty(); assert.equal(await page.locator('#refreshBtn').isDisabled(), true);
    await page.reload({ waitUntil: 'networkidle' }); await recover();
  }
  // The common auth wrapper owns 401 retirement and navigates to login.
  await page.route(endpoint, route => route.fulfill({ status: 401, json: {} }), { times: 1 });
  await page.locator('#refreshBtn').click(); await page.waitForURL(/\/login(?:\?|$)/);
  assert.equal(await page.locator('#dashboardResults').count(), 0);
  assert.deepEqual(errors, []); assert.deepEqual(writes, []); assert.deepEqual(await snapshot(), original);
  await fs.writeFile(path.join(visual, 'evidence.json'), JSON.stringify({ ok: true, phase: 'assertions-completed', apiMonths: [monthA, monthB], noInventedCreditOrZoneAmounts: true, alertTotal: a.alertCoverage.total, alertPreview: a.alerts.length, lateMonthRejected: true, malformedResponsesRefused: true, offlineClears: true, timeoutRejectsLateResponse: true, invalidMonthNoRequest: true, restoredMonthMatches: true, ignoredAbortSessionCases: 2, unauthorizedRetiresSession: true, signedPaymentsPreserved: true, widths: [320, 390, 1440], themes: ['light', 'dark'], noBusinessWrites: true }, null, 2));
  console.log('PASS legacy dashboard: real monthly values, unknown fields not zero, complete alert total/preview scope, literal data, late periods/session rejected, errors/offline clear data, restored month, signed payments, responsive 320/390/1440, no business writes');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (client) { await prisma.serviceVisit.deleteMany({ where: { clientId: client.id } }); await prisma.invoice.deleteMany({ where: { clientId: client.id } }); await prisma.pool.deleteMany({ where: { clientId: client.id } }); await prisma.client.delete({ where: { id: client.id } }); }
  await prisma.$disconnect();
});
