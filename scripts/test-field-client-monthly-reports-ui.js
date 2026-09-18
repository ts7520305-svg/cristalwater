'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright'), jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../src/utils/jwtSecret'), pdfText = require('./lib/reportPdfText');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const gate = () => { let release; return { promise: new Promise(r => { release = r; }), release }; };
const sign = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
let browser;
(async () => {
  const a = await prisma.client.create({ data: { name: 'QA monthly portal Álvaro <b>literal</b>', active: true } });
  const b = await prisma.client.create({ data: { name: 'QA monthly portal other', active: true } });
  const empty = await prisma.client.create({ data: { name: 'QA monthly portal empty', active: true } });
  const user = { id: a.id, clientId: a.id, role: 'CLIENT', principalType: 'CLIENT' }, token = sign(user);
  const bUser = { id: b.id, clientId: b.id, role: 'CLIENT', principalType: 'CLIENT' }, bToken = sign(bUser);
  const months = [...Array.from({ length: 12 }, (_, i) => '2095-' + String(i + 1).padStart(2, '0')), '2096-01', '2096-02'];
  const reports = [];
  for (const month of months) reports.push(await prisma.monthlyReport.create({ data: { clientId: a.id, type: 'CLIENT', month, data: {
    client: 'SAVED_MONTHLY_ALPHA', paymentStatus: 'PAID', pools: [{ name: 'Piscina guardada', totalVisits: 7, notDone: 1, unconfirmed: 2 }],
    ...(month === '2096-02' ? { reportVersion: 2, reviewRequired: true } : {}),
  } } }));
  const foreign = await prisma.monthlyReport.create({ data: { clientId: b.id, type: 'CLIENT', month: '2096-02', data: { client: 'SAVED_MONTHLY_BETA', paymentStatus: 'PAID', pools: [] } } });
  await prisma.monthlyReport.createMany({ data: ['ADMIN', 'EXTRA_VISITS'].map(type => ({ clientId: a.id, type, month: '2096-02', data: { secret: 'NOT_A_CLIENT_REPORT' } })) });
  const current = reports.at(-1), listing = id => base + '/api/client-reports/' + id + '/reports', pdf = row => listing(row.clientId) + '/' + row.id + '/pdf';
  const snapshot = await prisma.monthlyReport.findMany({ where: { clientId: { in: [a.id, b.id, empty.id] } }, orderBy: { id: 'asc' } });
  const counts = () => Promise.all(['invoice', 'payment', 'serviceVisit'].map(model => prisma[model].count())), before = await counts();
  const response = await fetch(listing(a.id), { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('x-cw-client-id'), String(a.id)); assert.equal(response.headers.get('x-cw-report-type'), 'client-monthly-list');
  const listData = await response.json(); assert.equal(listData.count, 14); assert(listData.reports.every(r => r.type === 'CLIENT' && r.clientId === a.id));
  const document = await fetch(pdf(current), { headers: { Authorization: 'Bearer ' + token } });
  for (const [key, value] of Object.entries({ 'content-language': 'pt', 'x-cw-report-type': 'client-monthly-pdf', 'x-cw-report-id': current.id, 'x-cw-client-id': a.id, 'x-cw-month-ref': current.month })) assert.equal(document.headers.get(key), String(value));
  const documentBytes = Buffer.from(await document.arrayBuffer()); assert(pdfText(documentBytes).includes('SAVED_MONTHLY_ALPHA'));
  assert.equal((await fetch(pdf(foreign), { headers: { Authorization: 'Bearer ' + token } })).status, 403);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [], requests = [];
  async function contextFor(identity, credential) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 900 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(({ user, token }) => {
      if (top !== window || location.protocol === 'blob:') return;
      if (!localStorage.getItem('qaMonthlyInitialized')) {
        for (const key of ['cristalwater_jwt', 'token', 'adminToken']) localStorage.setItem(key, token);
        for (const key of ['cristalwater_user', 'user']) localStorage.setItem(key, JSON.stringify(user));
        localStorage.setItem('qaMonthlyInitialized', 'true'); localStorage.setItem('cw_language', 'pt');
      }
      localStorage.setItem('qaMonthlyDraft', 'preserved');
      const later = setTimeout; window.setTimeout = (fn, ms, ...args) => later(fn, window.qaShortTimeout && ms === 20000 ? 100 : ms, ...args);
      const make = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      window.qaPopups = []; window.qaCreated = []; window.qaRevoked = [];
      window.open = (...args) => { if (window.qaBlocked) return null; const popup = { location: {}, opener: {}, closed: false, close() { this.closed = true; } }; qaPopups.push({ args, popup }); return popup; };
      URL.createObjectURL = blob => { const url = make(blob); qaCreated.push(url); return url; };
      URL.revokeObjectURL = url => { qaRevoked.push(url); revoke(url); };
      const original = fetch.bind(window);
      window.fetch = async (...args) => { const response = await original(...args); if (window.qaHoldBlob && /\/api\/client-reports\/.*\/pdf/.test(String(args[0]))) { const read = response.blob.bind(response); response.blob = async () => { const blob = await read(); window.qaBlobReady = true; await new Promise(r => window.qaReleaseBlob = r); return blob; }; } return response; };
    }, { user: identity, token: credential });
    return context;
  }
  async function pageFor(context, suffix = '') {
    const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/api/client-reports/')) requests.push({ url: r.url(), method: r.method(), authorization: r.headers().authorization }); });
    await page.goto(base + '/client-portal' + suffix, { waitUntil: 'networkidle' }); return page;
  }
  const state = (page, kind) => page.waitForFunction(kind => document.getElementById('monthlyReportsPanel').dataset.state === kind, kind);
  const openState = (page, kind) => page.waitForFunction(kind => document.getElementById('monthlyOpenStatus').dataset.state === kind, kind);
  const info = page => page.evaluate(() => ({ created: qaCreated.length, revoked: qaRevoked.length, closed: qaPopups.at(-1)?.popup.closed, href: qaPopups.at(-1)?.popup.location.href, opener: qaPopups.at(-1)?.popup.opener, args: qaPopups.at(-1)?.args }));
  async function hold(page, url, action, work, replacement) {
    const arrived = gate(), release = gate(), finished = gate(); let first = true;
    await page.route(url, async route => {
      if (!first) return route.continue(); first = false;
      const response = await route.fetch(); arrived.release(); await release.promise;
      try { await route.fulfill(replacement ? { response, ...replacement } : { response }); }
      catch (error) { if (!/closed|handled|cancel/i.test(error.message)) throw error; }
      finally { finished.release(); }
    });
    try { await action(); await arrived.promise; await work(); } finally { release.release(); }
    await finished.promise; await page.unroute(url);
  }
  const context = await contextFor(user, token), page = await pageFor(context); await state(page, 'ready');
  const first = () => page.locator('#monthlyList button').first(), refresh = () => page.locator('#monthlyRefresh').click();
  assert.equal(await page.locator('#monthlyList article').count(), 6); assert.match(await page.locator('#monthlySummary').textContent(), /1–6 de 14/);
  assert.match(await page.locator('#monthlyList').textContent(), /Revisão necessária/);
  await page.locator('#monthlyNext').click(); await page.locator('#monthlyNext').click(); assert.equal(await page.locator('#monthlyList article').count(), 2);
  assert.equal(await page.locator('#monthlyNext').isDisabled(), true); assert.equal(await page.locator('#monthlyList article').last().getAttribute('data-report-id'), String(reports[0].id));
  await page.locator('#monthlyMonth').fill('2095-01'); assert.equal(await page.locator('#monthlyList article').count(), 1); await first().click(); await openState(page, 'opened');
  let opened = await info(page); assert.equal(opened.opener, null); assert.deepEqual(opened.args, ['', '_blank']); assert.match(opened.href, /^blob:/);
  const openedBytes = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(qaPopups.at(-1).popup.location.href)).arrayBuffer()))));
  assert(pdfText(openedBytes).includes('2095-01')); assert(pdfText(openedBytes).includes('SAVED_MONTHLY_ALPHA')); assert(!pdfText(openedBytes).includes('BETA'));
  await page.locator('#monthlyMonth').fill('2094-01'); assert.match(await page.locator('#monthlyList').textContent(), /Não existem relatórios/); assert((await info(page)).closed);
  await page.locator('#monthlyClear').click(); await first().click(); await openState(page, 'opened');
  assert.equal(new URL(requests.at(-1).url).pathname, new URL(pdf(current)).pathname); assert(requests.every(r => r.method === 'GET' && r.authorization === 'Bearer ' + token));
  await page.evaluate(() => window.qaBlocked = true); const blockedCount = requests.length; await first().click(); await openState(page, 'error'); assert.equal(requests.length, blockedCount); await page.evaluate(() => window.qaBlocked = false);
  for (const mutation of [
    { status: 202 }, { status: 403 }, { status: 503 }, { headers: { 'content-type': 'application/json' }, body: '{}' },
    { headers: { 'x-cw-report-type': 'visit-pdf' } }, { headers: { 'x-cw-report-id': String(foreign.id) } }, { headers: { 'x-cw-client-id': String(b.id) } },
    { headers: { 'x-cw-month-ref': '2095-01' } }, { headers: { 'content-language': 'en' } }, { body: '' }, { body: '%PDF-1.7 truncated' },
  ]) {
    await page.route(pdf(current), async route => { const response = await route.fetch(); await route.fulfill({ response, ...mutation, headers: { ...response.headers(), ...mutation.headers } }); });
    const before = (await info(page)).created; await first().click(); await openState(page, 'error'); assert.equal((await info(page)).created, before); assert((await info(page)).closed); await page.unroute(pdf(current));
  }
  for (const mutation of [
    { status: 202 }, { status: 503 }, { headers: { 'x-cw-client-id': String(b.id) } }, { headers: { 'x-cw-report-type': 'other' } },
    { headers: { 'content-type': 'text/html' } }, { body: '{broken' }, { json: { count: 0, reports: listData.reports } },
    { json: { count: 1, reports: [{ ...listData.reports[0], clientId: b.id }] } },
    { json: { count: 1, reports: [{ ...listData.reports[0], type: 'ADMIN' }] } },
    { json: { count: 1, reports: [{ ...listData.reports[0], month: '<img src=x onerror=alert(1)>' }] } },
    { json: { count: 2, reports: [listData.reports[0], listData.reports[0]] } },
  ]) {
    await page.route(listing(a.id), async route => { const response = await route.fetch(); await route.fulfill({ response, ...mutation, headers: { ...response.headers(), ...mutation.headers } }); });
    await refresh(); await state(page, 'error'); assert.equal(await page.locator('#monthlyList article').count(), 0); await page.unroute(listing(a.id));
    await refresh(); await state(page, 'ready');
  }
  const countBeforeDelay = (await info(page)).created;
  await hold(page, pdf(current), () => first().click(), async () => {
    const count = requests.length; await first().dispatchEvent('click'); assert.equal(requests.length, count);
    await page.locator('#monthlyMonth').fill('2095-01'); await openState(page, 'idle'); await page.locator('#monthlyClear').click();
  });
  assert.equal((await info(page)).created, countBeforeDelay); assert((await info(page)).closed);
  await page.evaluate(() => window.qaHoldBlob = true); await first().click(); await page.waitForFunction(() => window.qaBlobReady);
  await page.locator('#monthlyMonth').fill('2095-01'); await openState(page, 'idle'); await page.evaluate(() => { window.qaHoldBlob = false; window.qaReleaseBlob(); });
  assert.equal((await info(page)).created, countBeforeDelay); await page.locator('#monthlyClear').click();
  await page.evaluate(() => window.qaShortTimeout = true);
  await hold(page, listing(a.id), refresh, () => state(page, 'error')); await page.evaluate(() => window.qaShortTimeout = false); await refresh(); await state(page, 'ready');
  await context.setOffline(true); await refresh(); await state(page, 'error'); await context.setOffline(false);
  const noReplay = requests.length; await page.waitForTimeout(300); assert.equal(requests.length, noReplay); await refresh(); await state(page, 'ready');
  const titleByLanguage = { pt: 'Relatórios mensais de visitas', en: 'Monthly visit reports', fr: 'Rapports mensuels des visites', es: 'Informes mensuales de visitas', de: 'Monatliche Besuchsberichte' };
  for (const [language, title] of Object.entries(titleByLanguage)) {
    await page.locator('#cwLanguageSelect').selectOption(language); await state(page, 'ready'); await page.waitForFunction(title => document.getElementById('monthlyTitle').textContent === title, title);
    assert.match(await page.locator('#monthlyReportsPanel').textContent(), /portugu|Portug/i);
  }
  const evidence = path.join(__dirname, '../reports/field-visual/client-monthly-portal-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
  await page.locator('#cw-v21-toast').waitFor({ state: 'hidden' });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.locator('#monthlyReportsPanel').scrollIntoViewIfNeeded();
    const layout = await page.locator('#monthlyReportsPanel, #monthlyReportsPanel input, #monthlyReportsPanel button').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(), css = getComputedStyle(n); return { id: n.id, className: n.className, display: css.display, direction: css.flexDirection, columns: css.gridTemplateColumns, x: r.x, right: r.right, overflow: n.scrollWidth - n.clientWidth }; }));
    await page.locator('#monthlyReportsPanel').screenshot({ path: path.join(evidence, 'monthly-' + width + '.png') });
    assert(layout.every(r => r.x >= 0 && r.right <= width + 1 && r.overflow <= 1), JSON.stringify({ width, layout }));
  }
  await page.locator('#cwLanguageSelect').selectOption('pt'); await state(page, 'ready'); await first().click(); await openState(page, 'opened');
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide'))); assert((await info(page)).closed); assert.equal(await page.locator('#monthlyList article').count(), 0);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await state(page, 'ready');
  console.log('PASS monthly portal: exact list/PDF identity, 14 months and pagination, current/legacy files, malformed responses, cancellation, timeout, offline, five languages and responsive layouts');
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const adminUser = { id: admin.id, userId: admin.id, role: 'ADMIN', principalType: 'USER' }, adminContext = await contextFor(adminUser, sign(adminUser));
  const preview = await pageFor(adminContext, '?clientId=' + a.id); await state(preview, 'ready');
  const choose = id => preview.evaluate(id => chooseAdminClient(id), id);
  await hold(preview, listing(a.id), () => preview.locator('#monthlyRefresh').click(), async () => {
    await choose(b.id); await state(preview, 'ready'); assert.equal(await preview.locator('#monthlyList article').getAttribute('data-report-id'), String(foreign.id));
    await choose(a.id); await state(preview, 'ready');
  }, { json: { count: 0, reports: [] } });
  await state(preview, 'ready'); assert.match(await preview.locator('#monthlySummary').textContent(), /14/);
  await hold(preview, pdf(current), () => preview.locator('#monthlyList button').first().click(), async () => { await choose(b.id); await state(preview, 'ready'); await choose(a.id); await state(preview, 'ready'); });
  assert.equal((await info(preview)).created, 0); assert((await info(preview)).closed);
  await choose(empty.id); await state(preview, 'ready'); assert.match(await preview.locator('#monthlyList').textContent(), /Ainda não existem/);
  await choose(0); await state(preview, 'idle'); assert.equal(await preview.locator('#monthlyRefresh').isDisabled(), true);
  console.log('PASS administrator preview: exact customer, A-B-A late list and PDF cancellation, empty history and cleared selection');
  await hold(page, pdf(current), () => first().click(), async () => {
    const otherTab = await context.newPage(); await otherTab.goto(base + '/client-portal');
    await otherTab.evaluate(({ user, token }) => { for (const key of ['cristalwater_jwt', 'token', 'adminToken']) localStorage.setItem(key, token); for (const key of ['cristalwater_user', 'user']) localStorage.setItem(key, JSON.stringify(user)); }, { user: bUser, token: bToken });
    await state(page, 'session'); assert.equal(await page.locator('#monthlyList article').count(), 0); assert((await info(page)).closed); await otherTab.close();
  });
  assert.equal(await page.evaluate(() => localStorage.getItem('qaMonthlyDraft')), 'preserved');
  await page.reload(); await state(page, 'ready'); assert.equal(await page.locator('#monthlyList article').getAttribute('data-report-id'), String(foreign.id));
  const expiredContext = await contextFor(user, token), expired = await pageFor(expiredContext); await state(expired, 'ready');
  await expired.route(pdf(current), route => route.fulfill({ status: 401, json: { ok: false } }));
  await expired.locator('#monthlyList button').first().click(); await expired.waitForURL(/\/(?:client-)?login/);
  assert.equal(await expired.evaluate(() => localStorage.getItem('qaMonthlyDraft')), 'preserved'); assert.equal(await expired.evaluate(() => localStorage.getItem('cristalwater_jwt')), null);
  assert.deepEqual(await prisma.monthlyReport.findMany({ where: { clientId: { in: [a.id, b.id, empty.id] } }, orderBy: { id: 'asc' } }), snapshot); assert.deepEqual(await counts(), before);
  assert.deepEqual(errors, []); console.log('PASS session switch across tabs and actual 401 lifecycle; reports, visit counts and financial records preserved'); console.log('Visual evidence ' + evidence);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
