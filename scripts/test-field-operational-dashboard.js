'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises'), path = require('node:path');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const prefix = 'QA Operational ' + randomUUID(), monthA = '2077-01', monthB = '2077-02';
const gate = () => { let release; return { promise: new Promise(resolve => { release = resolve; }), release }; };
const money = value => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
let browser, client, technician, probe;

(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = value => jwt.sign(value, getJwtSecret(), { expiresIn: '1h' });
  const token = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const call = async (month = monthA, credential = token, origin = base) => {
    const response = await fetch(origin + '/api/dashboard/admin?monthRef=' + month, { headers: credential ? { Authorization: 'Bearer ' + credential } : {} });
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
  };
  const baseline = await call(); assert.equal(baseline.status, 200);
  client = await prisma.client.create({ data: { name: prefix + ' <img src=x onerror=alert(1)> ' + 'Z'.repeat(100), active: false, status: 'PAUSED' } });
  technician = await prisma.technician.create({ data: { name: prefix, active: true } });
  const zones = ['__proto__', 'constructor', 'toString', prefix + ' <script>literal</script>'];
  for (const zone of zones) await prisma.pool.create({ data: { name: prefix, clientId: client.id, zone, active: false } });
  // Multiple internal documents may share the legacy period field; monthRef
  // is the unique monthly-aggregate key and must not be duplicated per client.
  const createInvoice = (status, amount, monthRef, extra = {}) => prisma.invoice.create({ data: { clientId: client.id, status, amount, total: amount, totalAmount: amount, amountOpen: amount, month: monthRef, ...extra } });
  await createInvoice('PENDING', 123.45, monthA);
  await createInvoice('PENDING', 50.67, monthB);
  for (const status of ['DRAFT', 'CANCELLED', 'VOID']) await createInvoice(status, 9999, monthA);
  await createInvoice('PAID', 20, monthA, { amountPaid: 20, amountOpen: 0 });
  const a = await call(), b = await call(monthB); assert.equal(a.status, 200); assert.equal(b.status, 200);
  const snapshot = async () => ({ client: await prisma.client.findUnique({ where: { id: client.id } }), pools: await prisma.pool.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }), invoices: await prisma.invoice.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }), payments: await prisma.payment.count(), communications: await prisma.communicationLog.count() });
  const before = await snapshot();
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 1000 }, timezoneId: 'Europe/Lisbon' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, user }) => {
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
  }, { token, user: { id: admin.id, role: 'ADMIN', name: 'QA administrator' } });
  const page = await context.newPage(), errors = [], writes = [];
  if (process.env.CW_OPERATIONAL_REGRESSION_ONLY === 'true') {
    // The previous page is served over the fixed API, isolating its three UI
    // failures from the independently tested prototype-name grouping bug.
    const { execFileSync } = require('node:child_process');
    for (const file of ['operational-dashboard.html', 'operational-dashboard.js']) {
      const original = execFileSync('git', ['show', '7e94fb53db461bb1f7eb30d732f435b7755f563a:frontend/' + file], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
      await page.route('**/' + file.replace(/\.html$/, ''), route => route.fulfill({ contentType: file.endsWith('.html') ? 'text/html' : 'application/javascript', body: original }));
    }
  }
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.method() + ' ' + new URL(request.url()).pathname); });
  await page.goto(base + '/operational-dashboard', { waitUntil: 'networkidle' });
  await page.locator('#monthRef').fill(monthA); await page.evaluate(() => loadOperational());
  const shownMoney = await page.locator('#monthOpen,#monthlyPotential').textContent();
  const endpoint = '**/api/dashboard/admin?*';
  const arrived = gate(), release = gate(), finished = gate(); let calls = 0;
  await page.route(endpoint, async route => {
    if (++calls > 1) return route.fulfill({ json: { ...b.body, summary: { ...b.body.summary, totalClients: 9 } } });
    arrived.release(); await release.promise;
    try { await route.fulfill({ json: { ...a.body, summary: { ...a.body.summary, totalClients: 7 } } }); }
    catch (error) { if (!/closed|handled|cancel/i.test(error.message)) throw error; }
    finally { finished.release(); }
  });
  await page.evaluate(() => { window.olderDashboardRead = loadOperational(); }); await arrived.promise;
  await page.locator('#monthRef').fill(monthB); await page.evaluate(() => loadOperational());
  release.release(); await finished.promise; await page.evaluate(() => window.olderDashboardRead);
  const clientsAfterLateRead = await page.locator('#totalClients').textContent();
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.fulfill({ json: { ok: true } }), { times: 1 });
  await page.evaluate(() => loadOperational());
  const clientsAfterMalformed = await page.locator('#totalClients').textContent();
  const groupComplete = zones.every(zone => a.body.poolsByZone.some(row => row.zone === zone && row.count >= 1));
  if (process.env.CW_OPERATIONAL_REGRESSION_ONLY === 'true') {
    console.log(JSON.stringify({ expectedMonthOpen: a.body.summary.monthOpen, shownMoney, clientsAfterLateRead, clientsAfterMalformed, allReservedZonesPresent: groupComplete }));
    assert.equal(clientsAfterLateRead, '9', 'An older period must not overwrite the newer result');
    assert.equal(clientsAfterMalformed, '—', 'Missing fields must not become zero');
    assert.equal(shownMoney, money(a.body.summary.monthOpen)); assert(groupComplete);
    return;
  }
  assert.equal(clientsAfterLateRead, '9'); assert.equal(clientsAfterMalformed, '—');
  assert.equal(shownMoney, money(a.body.summary.monthOpen)); assert(groupComplete);
  assert.equal(a.body.poolsByZone.reduce((sum, row) => sum + row.count, 0), a.body.summary.totalPools);
  assert.equal(a.body.summary.totalClients, baseline.body.summary.totalClients + 1);
  assert.equal(a.body.summary.totalPools, baseline.body.summary.totalPools + 4);
  assert.equal(Math.round(a.body.summary.monthOpen * 100) - Math.round(baseline.body.summary.monthOpen * 100), 12345);
  assert.equal(a.cache, 'private, no-store');
  for (const credential of [null, 'invalid', sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), sign({ id: technician.id, technicianId: technician.id, role: 'TECHNICIAN' })]) assert([401, 403].includes((await call(monthA, credential)).status));
  const app = require('express')(); app.use('/api/dashboard', require('../src/routes/dashboardRoutes'));
  probe = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  const originalRead = prisma.pool.findMany;
  try {
    prisma.pool.findMany = async () => { throw Error('PRIVATE_OPERATIONAL_READ_FAILURE'); };
    const failed = await call(monthA, token, 'http://127.0.0.1:' + probe.address().port);
    assert.equal(failed.status, 500); assert.equal(failed.body.ok, false); assert(!JSON.stringify(failed.body).includes('PRIVATE_OPERATIONAL'));
  } finally { prisma.pool.findMany = originalRead; }
  console.log('PASS operational API: reserved zone names counted, inactive records retained as registered totals, exact month balance, drafts/withdrawn/paid excluded from open balance, ADMIN scope and explicit read failures');

  const recover = async () => { await page.locator('#monthRef').fill(monthA); assert.equal(await page.evaluate(() => loadOperational()), true); };
  for (const response of [
    { status: 503, json: { ok: false } }, { status: 403, json: { ok: false } }, { contentType: 'text/html', body: '<h1>Error</h1>' },
    { json: { ...a.body, ok: false } }, { json: { ...a.body, monthRef: monthB } },
    ...[null, '0', -1].map(monthOpen => ({ json: { ...a.body, summary: { ...a.body.summary, monthOpen } } })),
    { json: { ...a.body, poolsByZone: [...a.body.poolsByZone, a.body.poolsByZone[0]] } },
    { json: { ...a.body, poolsByZone: [{ zone: 'malformed count', count: '<img src=x>' }] } },
    { json: { ...a.body, topDebtors: [{ invoiceId: 1, clientName: 'missing amount' }] } },
  ]) {
    await recover(); await page.route(endpoint, route => route.fulfill(response), { times: 1 });
    assert.equal(await page.evaluate(() => loadOperational()), false);
    for (const id of ['totalClients', 'totalPools', 'zoneCount', 'monthOpen']) assert.equal(await page.locator('#' + id).textContent(), '—');
    assert.equal(await page.locator('#zonesTable tbody tr,#debtorsTable tbody tr').count(), 0);
    assert.equal(await page.locator('#status').getAttribute('data-state'), 'error');
  }
  await recover();
  const zero = { ok: true, monthRef: monthA, summary: { totalClients: 0, totalPools: 0, monthOpen: 0 }, poolsByZone: [], topDebtors: [] };
  await page.route(endpoint, route => route.fulfill({ json: zero }), { times: 1 });
  assert.equal(await page.evaluate(() => loadOperational()), true);
  assert.equal(await page.locator('#totalClients').textContent(), '0'); assert.equal(await page.locator('#monthOpen').textContent(), money(0));
  assert.match(await page.locator('#zonesTable').textContent(), /Sem instalações/);
  assert.match(await page.locator('#debtorsTable').textContent(), /Sem documentos/);
  await page.locator('#monthRef').fill('');
  let invalidRequests = 0; const countInvalid = request => { if (request.url().includes('/api/dashboard/admin?')) invalidRequests++; };
  page.on('request', countInvalid); assert.equal(await page.evaluate(() => loadOperational()), false); page.off('request', countInvalid);
  assert.equal(invalidRequests, 0); assert.equal(await page.locator('#status').getAttribute('data-state'), 'invalid');
  await recover();
  await page.locator('#monthRef').fill(monthB);
  assert.equal(await page.locator('#monthOpen').textContent(), '—');
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'changed');
  await page.locator('#refreshBtn').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(month => document.querySelector('#results').dataset.month === month, monthB);
  assert.equal(await page.locator('#monthOpen').textContent(), money(b.body.summary.monthOpen));

  // A transport that ignores AbortSignal must still not restore stale/signed-out data.
  const heldRead = async action => {
    await page.evaluate(packet => {
      window.savedOperationalFetch = window.fetch;
      window.fetch = (...args) => String(args[0]).startsWith('/api/dashboard/admin?') ? new Promise(resolve => { window.releaseOperationalRead = () => resolve(new Response(JSON.stringify(packet), { status: 200, headers: { 'Content-Type': 'application/json' } })); }) : window.savedOperationalFetch(...args);
      window.heldOperationalRead = loadOperational();
    }, b.body);
    await action();
    await page.evaluate(async () => { window.releaseOperationalRead(); await window.heldOperationalRead; window.fetch = window.savedOperationalFetch; });
  };
  await heldRead(async () => { await page.locator('#monthRef').fill(monthA); await page.locator('#monthRef').fill(monthB); });
  assert.equal(await page.locator('#totalClients').textContent(), '—');
  await recover();
  await context.setOffline(true); await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'offline');
  assert.equal(await page.locator('#monthOpen').textContent(), '—'); assert.equal(await page.locator('#refreshBtn').isDisabled(), true);
  await context.setOffline(false); await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');

  // Controlled presentation data keeps exact IDs, names, amounts and original periods literal.
  const visualPacket = { ok: true, monthRef: monthA, summary: { totalClients: 1, totalPools: 4, monthOpen: 123.45 }, poolsByZone: zones.map(zone => ({ zone, count: 1 })), topDebtors: [{ invoiceId: 123, clientId: client.id, clientName: client.name, monthRef: monthB, status: 'PENDING', total: 200, amountOpen: 123.45 }] };
  await page.route(endpoint, route => route.fulfill({ json: visualPacket }));
  await recover();
  assert.equal(await page.locator('#zonesTable img,#zonesTable script,#debtorsTable img,#debtorsTable script').count(), 0);
  assert.match(await page.locator('#debtorsTable').textContent(), /2077-02/);
  assert.match(await page.locator('#scopeNote').textContent(), /todos os períodos/);
  assert.match(await page.locator('#debtorsNote').textContent(), /15 documentos/);
  const visual = path.join(__dirname, '../reports/field-visual/operational-dashboard'); await fs.mkdir(visual, { recursive: true });
  for (const [theme, width] of [['light', 320], ['light', 390], ['light', 1440], ['dark', 390]]) {
    await page.emulateMedia({ colorScheme: theme }); await page.setViewportSize({ width, height: 1000 }); await page.mouse.move(0, 0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => document.getAnimations().every(animation => !(animation instanceof CSSTransition) || animation.playState !== 'running'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow at ' + width);
    assert(await page.locator('#monthRef,#refreshBtn').evaluateAll(items => items.every(el => el.getBoundingClientRect().height >= 44)));
    const ratios = await page.locator('main h2,main label,main .label,main .value,main p,main th,main td,[data-cw-open-drawer]').evaluateAll(items => items.filter(el => el.getClientRects().length).map(el => {
      const rgb = value => value.match(/[\d.]+/g).map(Number);
      const lum = values => values.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const front = lum(rgb(getComputedStyle(el).color)); let parent = el, back;
      do { back = rgb(getComputedStyle(parent).backgroundColor); parent = parent.parentElement; } while (back[3] === 0 && parent);
      const behind = lum(back); return { text: el.textContent.slice(0, 30), ratio: (Math.max(front, behind) + .05) / (Math.min(front, behind) + .05) };
    }));
    assert(ratios.every(row => row.ratio >= 4.5), JSON.stringify({ theme, width, failed: ratios.filter(row => row.ratio < 4.5) }));
    if (width === 320) {
      const table = page.locator('#debtorsTable'); await table.focus(); await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('#debtorsTable').scrollLeft > 0);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(visual, 'pt-' + theme + '-' + width + '.png'), fullPage: true });
  }
  await page.unroute(endpoint); await recover();
  await page.locator('#monthRef').fill(monthB); await page.evaluate(() => loadOperational());
  await heldRead(async () => { await page.evaluate(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'user', oldValue: 'A', newValue: 'B' })); window.dispatchEvent(new StorageEvent('storage', { key: 'user', oldValue: 'B', newValue: 'A' })); }); });
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'session');
  assert.equal(await page.locator('#totalClients').textContent(), '—'); assert.equal(await page.locator('#refreshBtn').isDisabled(), true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  } catch (error) {
    console.error('Reload state', await page.evaluate(() => ({ state: document.querySelector('#status')?.dataset.state, message: document.querySelector('#status')?.textContent, month: document.querySelector('#monthRef')?.value, ready: document.readyState, loader: typeof window.loadOperational, online: navigator.onLine, path: location.pathname })), errors);
    throw error;
  }
  assert.equal(await page.locator('#monthRef').inputValue(), monthB);
  assert.equal(await page.locator('#results').getAttribute('data-month'), monthB);
  assert.equal(await page.locator('#monthOpen').textContent(), money(b.body.summary.monthOpen));
  await page.evaluate(() => localStorage.setItem('user', '{"id":999,"role":"ADMIN"}'));
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'session');
  assert.equal(await page.locator('#totalClients').textContent(), '—');
  assert.deepEqual(writes, []); assert.deepEqual(errors, []); assert.deepEqual(await snapshot(), before);
  console.log('PASS operational UI: no invented zero or potential revenue; exact month selection, stale/late response rejection even without transport abort, terminal session isolation, loading/empty/error/offline, literal fields, keyboard/scroll regions, 320/390/1440 and light/dark contrast, no business writes');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close(); if (probe) await new Promise(resolve => probe.close(resolve));
  if (client) { await prisma.invoice.deleteMany({ where: { clientId: client.id } }); await prisma.pool.deleteMany({ where: { clientId: client.id } }); await prisma.client.delete({ where: { id: client.id } }); }
  if (technician) await prisma.technician.delete({ where: { id: technician.id } });
  await prisma.$disconnect();
});
