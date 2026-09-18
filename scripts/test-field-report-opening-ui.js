'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const stamp = Date.now(), admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const user = { id: admin.id, userId: admin.id, role: 'ADMIN' }, token = jwt.sign({ ...user, principalType: 'USER' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'QA_OPENING_' + stamp, active: true } }), other = await prisma.client.create({ data: { name: 'QA_OTHER_OPENING_' + stamp } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, notes: 'PUBLIC_NOTE', internalNotes: 'INTERNAL_SECRET' } });
  const foreign = await prisma.serviceVisit.create({ data: { clientId: other.id } });
  const month = '2097-04';
  await prisma.invoice.create({ data: { clientId: client.id, monthRef: month, total: 14, amountOpen: 14, requiresInvoice: true } });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [], requests = [];
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 900 } });
  await c.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await c.addInitScript(({ user, token }) => {
    if (top !== window || location.protocol === 'blob:') return;
    if (!localStorage.getItem('qaOpeningInit')) {
      for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
      localStorage.setItem('qaOpeningInit', 'true');
    }
    localStorage.setItem('qaReportDraft', 'preserved'); localStorage.setItem('cw_language', 'pt');
    const later = setTimeout; window.setTimeout = (fn, ms, ...args) => later(fn, window.qaTimeout && ms === 20000 ? 100 : ms, ...args);
    const open = window.open.bind(window), create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    window.qaPopups = []; window.qaCreated = []; window.qaRevoked = [];
    window.open = (...args) => { if (window.qaRealPopup) return open(...args); if (window.qaBlocked) return null; const popup = { location: {}, closed: false, opener: {}, close() { this.closed = true; } }; qaPopups.push({ args, popup }); return popup; };
    URL.createObjectURL = blob => { const url = create(blob); qaCreated.push(url); return url; };
    URL.revokeObjectURL = url => { qaRevoked.push(url); revoke(url); };
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = async (...args) => { const response = await fetchOriginal(...args); if (window.qaHoldBlob && String(args[0]).includes('/api/report')) { const read = response.blob.bind(response); response.blob = async () => { const blob = await read(); window.qaBlobReady = true; await new Promise(resolve => window.qaReleaseBlob = resolve); return blob; }; } return response; };
  }, { user, token });
  async function page(url) { const p = await c.newPage(); p.setDefaultTimeout(12000); p.on('pageerror', e => errors.push(e.message)); p.on('request', r => { if (/\/api\/(report-visit\/visit|reports\/monthly-print)/.test(r.url())) requests.push({ url: r.url(), authorized: r.headers().authorization === 'Bearer ' + token }); }); await p.goto(base + url, { waitUntil: 'networkidle' }); return p; }
  const state = (p, kind, visitPage = false) => p.waitForFunction(({ kind, id }) => document.getElementById(id).dataset.state === kind, { kind, id: visitPage ? 'previewStatus' : 'status' });
  const info = p => p.evaluate(() => ({ created: qaCreated.length, revoked: qaRevoked.length, closed: qaPopups.at(-1)?.popup.closed, href: qaPopups.at(-1)?.popup.location.href, opener: qaPopups.at(-1)?.popup.opener, args: qaPopups.at(-1)?.args }));
  const p = await page('/report-center'); await p.locator('#monthRef').fill(month);
  const button = p.locator('#openPrintableReport'), endpoint = '**/api/reports/monthly-print?*';
  for (const value of ['', '1999-12']) { await p.locator('#monthRef').fill(value); const count = requests.length; await button.click(); await state(p, 'error'); assert.equal(requests.length, count); }
  await p.locator('#monthRef').fill(month); await p.evaluate(() => window.qaBlocked = true); const count = requests.length; await button.click(); await state(p, 'error'); assert.equal(requests.length, count); assert.match(await p.locator('#status').textContent(), /bloqueada/); await p.evaluate(() => window.qaBlocked = false);
  await button.click(); await state(p, 'opened'); let opened = await info(p); assert.equal(opened.opener, null); assert.deepEqual(opened.args, ['', '_blank']); assert.match(opened.href, /^blob:/);
  assert((await p.evaluate(async () => (await (await fetch(qaPopups.at(-1).popup.location.href)).text()))).includes(client.name));
  await p.locator('#onlyRequiresInvoice').selectOption('true'); await state(p, 'idle'); assert.equal((await info(p)).closed, true); assert.equal((await info(p)).revoked, 1);
  const malformed = [
    { status: 202 }, { status: 403 }, { status: 503 },
    { headers: { 'content-type': 'application/json' }, body: '{}' },
    { headers: { 'x-cw-month-ref': '2097-05' } }, { headers: { 'x-cw-invoice-filter': 'false' } }, { headers: { 'x-cw-report-type': '' } },
    { body: '' }, { body: '<!doctype html><html>truncated' },
  ];
  for (const mutation of malformed) {
    await p.route(endpoint, async route => { const response = await route.fetch(); await route.fulfill({ response, ...mutation, headers: { ...response.headers(), ...mutation.headers } }); });
    const before = await info(p); await button.click(); await state(p, 'error'); assert.equal((await info(p)).created, before.created); assert.equal((await info(p)).closed, true); await p.unroute(endpoint);
  }
  async function delayed(target, pattern, click, work) {
    let enter, release, finish; const arrived = new Promise(r => enter = r), gate = new Promise(r => release = r), handled = new Promise(r => finish = r);
    await target.route(pattern, async route => { const response = await route.fetch(); enter(); await gate; try { await route.fulfill({ response }); } finally { finish(); } });
    await click(); await arrived; await work(); release(); await handled; await target.unroute(pattern);
  }
  for (const change of [() => p.locator('#monthRef').fill('2097-05'), () => p.locator('#onlyRequiresInvoice').selectOption('false'), () => p.evaluate(() => document.getElementById('monthRef').value = '2097-06')]) {
    await p.locator('#monthRef').fill(month); await p.locator('#onlyRequiresInvoice').selectOption('true'); const before = (await info(p)).created;
    await delayed(p, endpoint, () => button.click(), async () => { await change(); await state(p, 'idle'); }); assert.equal((await info(p)).created, before); assert.equal((await info(p)).closed, true);
  }
  await p.locator('#monthRef').fill(month); await p.evaluate(() => window.qaTimeout = true);
  await delayed(p, endpoint, () => button.click(), async () => { await state(p, 'error'); assert.match(await p.locator('#status').textContent(), /demorou/); }); await p.evaluate(() => window.qaTimeout = false);
  await c.setOffline(true); await button.click(); await state(p, 'error'); await c.setOffline(false); const offlineCount = requests.length; await p.waitForTimeout(300); assert.equal(requests.length, offlineCount);
  await button.click(); await state(p, 'opened'); await p.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide'))); await state(p, 'idle'); assert.equal((await info(p)).closed, true); assert.equal((await info(p)).created, (await info(p)).revoked);
  await p.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await state(p, 'idle');
  await p.evaluate(() => window.qaRealPopup = true); const popupPromise = p.waitForEvent('popup'); await button.click(); const popup = await popupPromise; await state(p, 'opened'); await popup.waitForURL('blob:**'); await popup.waitForLoadState('domcontentloaded'); assert((await popup.locator('body').textContent()).includes(client.name)); assert.equal(await popup.evaluate(() => opener), null); assert.equal(await popup.getByRole('button', { name: 'Imprimir / Guardar PDF' }).count(), 1); await popup.close(); await p.evaluate(() => window.qaRealPopup = false);
  const visual = path.join(__dirname, '../reports/field-visual/report-opening-' + stamp); fs.mkdirSync(visual, { recursive: true });
  for (const width of [320, 390, 1440]) { await p.setViewportSize({ width, height: 900 }); assert(await p.locator('.report-center-main input,.report-center-main select,.report-center-main button,.report-center-main .card').evaluateAll(nodes => nodes.every(n => { const r = n.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth + 1 && n.scrollWidth <= n.clientWidth + 1; }))); await p.screenshot({ path: path.join(visual, 'monthly-' + width + '.png'), fullPage: true }); }
  console.log('PASS monthly opening: real authenticated response and popup, blocked-window recovery, canonical selection, exact type/identity/status, truncated/empty replies, stale month/filter, timeout, offline without auto-open, BFCache and object URL cleanup');
  const v = await page('/report-settings'), pdfEndpoint = '**/api/report-visit/visit/*';
  assert(await v.locator('#openClientReport').isDisabled()); await v.locator('#clientId').fill(String(client.id)); await v.locator('#loadSettings').click(); await v.waitForFunction(() => document.getElementById('status').dataset.state === 'ready');
  await v.locator('#visitId').fill(String(visit.id)); const preview = v.locator('#openClientReport'); assert(await preview.isEnabled());
  await v.locator('#showAddress').check(); assert(await preview.isDisabled()); await v.locator('#showAddress').uncheck(); assert(await preview.isEnabled());
  await preview.click(); await state(v, 'opened', true); assert.equal(await v.evaluate(async () => (await (await fetch(qaPopups.at(-1).popup.location.href)).text()).slice(0, 5)), '%PDF-');
  await v.locator('#visitId').fill(String(foreign.id)); await preview.click(); await state(v, 'error', true); assert.match(await v.locator('#previewStatus').textContent(), /cliente|Cliente/); assert.equal((await info(v)).closed, true);
  await v.locator('#visitId').fill(String(visit.id));
  for (const mutation of [{ 'x-cw-client-id': String(other.id) }, { 'x-cw-visit-id': String(foreign.id) }, { 'x-cw-report-view': 'admin' }, { 'x-cw-settings-version': 'wrong' }, { 'content-type': 'text/html' }]) {
    await v.route(pdfEndpoint, async route => { const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), ...mutation } }); });
    const before = (await info(v)).created; await preview.click(); await state(v, 'error', true); assert.equal((await info(v)).created, before); await v.unroute(pdfEndpoint);
  }
  await v.route(pdfEndpoint, async route => { const response = await route.fetch(); await route.fulfill({ response, body: '%PDF-1.3 incomplete' }); }); await preview.click(); await state(v, 'error', true); await v.unroute(pdfEndpoint);
  await delayed(v, pdfEndpoint, () => preview.click(), async () => { await v.locator('#visitId').fill(String(foreign.id)); await state(v, 'idle', true); });
  await v.locator('#visitId').fill(String(visit.id));
  await delayed(v, pdfEndpoint, () => preview.click(), async () => { await v.locator('#clientId').fill(String(other.id)); await state(v, 'idle', true); });
  await v.locator('#clientId').fill(String(client.id)); await v.locator('#loadSettings').click(); await v.waitForFunction(() => document.getElementById('status').dataset.state === 'ready');
  await prisma.clientReportSetting.create({ data: { clientId: client.id, showNotes: false } }); await preview.click(); await state(v, 'error', true); assert.match(await v.locator('#previewStatus').textContent(), /configurações/);
  await v.locator('#loadSettings').click(); await v.waitForFunction(() => document.getElementById('status').dataset.state === 'conflict'); await v.locator('#discardSettings').click(); await v.waitForFunction(() => document.getElementById('status').dataset.state === 'ready'); await v.locator('#openAdminReport').click(); await state(v, 'opened', true);
  await prisma.client.update({where:{id:client.id},data:{archiveStatus:'ARQUIVADO'}});await v.locator('#loadSettings').click();await v.waitForFunction(()=>document.getElementById('status').dataset.state==='ready');
  assert(await v.locator('#saveSettings').isDisabled());assert(await preview.isEnabled());await preview.click();await state(v,'opened',true);
  assert(requests.every(r => r.authorized && !r.url.includes(token)));
  // A session change after headers/body receipt still invalidates the old window.
  await p.evaluate(() => window.qaHoldBlob = true); await button.click(); await p.waitForFunction(() => window.qaBlobReady);
  await v.evaluate(() => localStorage.setItem('cristalwater_user', JSON.stringify({ id: 999999, role: 'ADMIN' })));
  await state(p, 'session'); await state(v, 'session', true); assert.equal((await info(p)).closed, true); assert.equal((await info(v)).closed, true);
  const old = (await info(p)).created; await p.evaluate(() => qaReleaseBlob()); await p.waitForTimeout(100); assert.equal((await info(p)).created, old); assert.equal(await p.evaluate(() => localStorage.getItem('qaReportDraft')), 'preserved'); assert(await button.isDisabled()); assert.deepEqual(errors, []);
  console.log('PASS visit preview: requires confirmed saved settings, protected PDF and exact client/visit/view/version, foreign visit and stale settings refused, delayed visit/client ignored, late body after cross-tab account change discarded, drafts preserved and no page errors');
  await p.evaluate(({user,token})=>{for(const key of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(key,token);for(const key of ['user','cristalwater_user'])localStorage.setItem(key,JSON.stringify(user));},{user,token});
  const expiring=await page('/report-settings');await expiring.locator('#clientId').fill(String(client.id));await expiring.locator('#loadSettings').click();await expiring.waitForFunction(()=>document.getElementById('status').dataset.state==='ready');await expiring.locator('#visitId').fill(String(visit.id));await expiring.locator('#openClientReport').click();await state(expiring,'opened',true);
  await expiring.evaluate(()=>{const future=Date.now()+7200000;Date.now=()=>future;});await state(expiring,'session',true);assert(await expiring.locator('#openClientReport').isDisabled());assert.equal((await info(expiring)).closed,true);
  const expired = await page('/report-center'); await expired.evaluate(() => window.qaRealPopup = true);
  await expired.route(endpoint, route => route.fulfill({status:401,json:{ok:false}}));
  const expiredPopupPromise=expired.waitForEvent('popup');await expired.locator('#openPrintableReport').click();const expiredPopup=await expiredPopupPromise;await expired.waitForURL('**/login');
  assert(expiredPopup.isClosed());assert.equal(await expired.evaluate(()=>localStorage.getItem('qaReportDraft')),'preserved');assert.equal(await expired.evaluate(()=>localStorage.getItem('cristalwater_jwt')),null);assert.deepEqual(errors,[]);
  console.log('PASS actual 401 lifecycle: shared authentication ends the session, closes the reserved popup and preserves local work');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
