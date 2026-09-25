'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), jwt = require('jsonwebtoken'), { randomUUID, randomInt } = require('node:crypto');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const prefix = 'QA_PORTAL_CLOSURE_UI_' + randomUUID(), clients = [], closures = []; let browser;
const sign = (user, seconds = 3600) => jwt.sign(user, getJwtSecret(), { expiresIn: seconds });
const gate = () => { let release; return { promise: new Promise(resolve => { release = resolve; }), release }; };
(async () => {
  for (let i = 0; i < 2; i++) {
    // Avoid the low IDs referenced by the historical chat fixture files.
    let id; do { id = randomInt(1000000000, 1400000000); } while (await prisma.client.findUnique({ where: { id } }));
    clients.push(await prisma.client.create({ data: { id, name: prefix + i, active: true } }));
  }
  const [a, b] = clients, user = { id: a.id, clientId: a.id, role: 'CLIENT', principalType: 'CLIENT' }, token = sign(user);
  const second = { id: b.id, clientId: b.id, role: 'CLIENT', principalType: 'CLIENT' }, secondToken = sign(second);
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), adminUser = { id: admin.id, role: 'ADMIN', principalType: 'USER' }, adminToken = sign(adminUser);
  const now = Date.now();
  for (const future of [false, true]) closures.push(await prisma.companyClosure.create({ data: { title: prefix, status: 'ACTIVE', showOnClientPortal: true, startDate: new Date(future ? '2095-02-07T11:22:33Z' : now - 86400000), endDate: new Date(future ? '2095-02-08T00:00:00Z' : now + 86400000), messageTitle: future ? 'Férias futuras — informação para clientes' : 'Aviso <img src=x onerror="window.qaInjected=true"> ' + 'Á'.repeat(100), messageBody: 'Encerramento de {startDate} a {endDate}.\n<script>window.qaInjected=true</script>', emergencyPhone: '+351 000 000 000', emergencyEmail: 'urgencias@qa.invalid', metadata: { private: 'PRIVATE_CLOSURE_METADATA' } } }));
  const source = await prisma.companyClosure.findMany({ where: { id: { in: closures.map(row => row.id) } }, orderBy: { id: 'asc' } });
  const counts = () => Promise.all(['invoice', 'payment', 'serviceVisit', 'notification', 'userAuditLog', 'fieldWriteRequest'].map(model => prisma[model].count())), before = await counts();
  const url = id => base + `/api/client-portal/${id}/company-closures`;
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [], reads = [];
  async function contextFor(identity, credential, selected = identity.clientId || a.id) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await context.addInitScript(({ identity, credential, selected, base }) => {
      if (location.origin !== base || localStorage.getItem('qaClosuresInitialized')) return;
      for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, credential);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(identity));
      localStorage.setItem('cw_client_id', String(selected)); localStorage.setItem('clientId', String(selected)); localStorage.setItem('cw_language', 'pt'); localStorage.setItem('qaClosuresInitialized', 'true'); localStorage.setItem('qaOriginalDraft', 'preserved');
    }, { identity, credential, selected, base });
    return context;
  }
  const state = (page, expected) => page.waitForFunction(expected => document.getElementById('clientClosuresPanel')?.dataset.state === expected, expected);
  async function pageFor(context, selected = a.id) {
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/client-portal\/\d+\/company-closures$/.test(request.url())) reads.push({ url: request.url(), method: request.method(), token: request.headers().authorization }); });
    await page.goto(base + '/client-portal?clientId=' + selected + '&language=pt', { waitUntil: 'networkidle' }); return page;
  }
  const context = await contextFor(user, token), page = await pageFor(context); await state(page, 'ready');
  const refresh = () => page.locator('#clientClosureRefresh').click();
  const title = () => page.locator('#clientClosureTitle').textContent();
  assert(await page.locator('[data-closure-id="' + closures[0].id + '"]').isVisible());
  assert.match(await page.locator('#clientClosureList').textContent(), /Encerramento em curso/); assert.match(await page.locator('#clientClosureList').textContent(), /Próximo encerramento/);
  assert.match(await page.locator('#clientClosureList').textContent(), /<img src=x/); assert.equal(await page.locator('#clientClosureList img,#clientClosureList script,#clientClosureList a').count(), 0); assert.equal(await page.evaluate(() => !!window.qaInjected), false);
  assert(!(await page.locator('#clientClosureList').textContent()).includes('PRIVATE_CLOSURE_METADATA')); assert.match(await page.locator('#clientClosureList').textContent(), /2095/);
  const output = path.resolve('reports/field-visual/client-closures'); await fs.mkdir(output, { recursive: true });
  for (const [lang, expected] of [['pt', 'Férias e encerramentos'], ['en', 'Holidays and closures'], ['fr', 'Congés et fermetures'], ['es', 'Vacaciones y cierres'], ['de', 'Urlaub und Schließzeiten']]) {
    await page.locator('#cwLanguageSelect').selectOption(lang); await page.waitForFunction(expected => document.getElementById('clientClosureTitle')?.textContent === expected, expected); await state(page, 'ready'); assert.equal(await title(), expected);
    assert.equal(new URL(page.url()).searchParams.get('lang'), lang); assert.equal(new URL(page.url()).searchParams.has('language'), false);
    await page.locator('#clientClosuresPanel').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, 'closures-' + lang + '-390.png') });
    assert(await page.locator('#clientClosuresPanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
  }
  await page.reload({ waitUntil: 'networkidle' }); await state(page, 'ready'); assert.equal(await title(), 'Urlaub und Schließzeiten');
  await page.locator('#cwLanguageSelect').selectOption('pt'); await state(page, 'ready');
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.locator('#clientClosuresPanel').scrollIntoViewIfNeeded(); assert(await page.locator('#clientClosuresPanel').evaluate(node => node.scrollWidth <= node.clientWidth + 1)); await page.screenshot({ path: path.join(output, 'closures-pt-' + width + '.png') });
  }
  const packet = await (await fetch(url(a.id), { headers: { Authorization: 'Bearer ' + token } })).json();
  for (const mutation of [{ status: 503 }, { status: 202 }, { body: '{broken' }, { headers: { 'x-cw-client-id': String(b.id) } }, { headers: { 'x-cw-portal-type': 'other' } }, { headers: { 'content-type': 'text/html' } }, { json: { ...packet, clientId: b.id } }, { json: { ...packet, complete: false, closures: [] } }, { json: { ...packet, closures: [packet.closures[0], packet.closures[0]] } }, { json: { ...packet, closures: [{ ...packet.closures[0], endDate: '2000-01-01T00:00:00.000Z' }] } }]) {
    await page.route(url(a.id), async route => { const response = await route.fetch(); await route.fulfill({ response, ...mutation, headers: { ...response.headers(), ...mutation.headers } }); });
    await refresh(); await state(page, 'error'); assert.equal(await page.locator('#clientClosureList article').count(), 0); await page.unroute(url(a.id)); await refresh(); await state(page, 'ready');
  }
  const empty = { ...packet, closures: [] };
  await page.route(url(a.id), async route => { const response = await route.fetch(); await route.fulfill({ response, json: empty }); }); await refresh(); await state(page, 'empty'); assert.match(await page.locator('#clientClosureStatus').textContent(), /Sem avisos/); await page.unroute(url(a.id));
  const many = Array.from({ length: 100 }, (_, i) => ({ ...packet.closures[0], id: i + 1 }));
  await page.route(url(a.id), async route => { const response = await route.fetch(); await route.fulfill({ response, json: { ...packet, complete: false, closures: many } }); }); await refresh(); await state(page, 'partial'); assert.match(await page.locator('#clientClosureStatus').textContent(), /100 avisos/); await page.unroute(url(a.id)); await refresh(); await state(page, 'ready');
  await context.setOffline(true); await refresh(); await state(page, 'error'); assert.equal(await page.locator('#clientClosureList article').count(), 0); await context.setOffline(false); await refresh(); await state(page, 'ready');
  await page.evaluate(() => {
    window.qaClosureFetch = window.fetch; window.qaClosureTimeout = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) => window.qaClosureTimeout(fn, ms === 15000 ? 100 : ms, ...args);
    window.fetch = (url, options) => String(url).endsWith('/company-closures') ? new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('QA timeout', 'AbortError')), { once: true })) : window.qaClosureFetch(url, options);
  }); await refresh(); await state(page, 'error');
  await page.evaluate(() => { window.fetch = window.qaClosureFetch; window.setTimeout = window.qaClosureTimeout; }); await refresh(); await state(page, 'ready');
  // Never reuse a previous snapshot after navigation restoration.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))); assert.equal(await page.locator('#clientClosureList article').count(), 0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await state(page, 'ready');
  // A cancelled public notice disappears on the next confirmed read; no other source changes.
  await prisma.companyClosure.update({ where: { id: closures[0].id }, data: { status: 'CANCELLED' } }); await refresh(); await state(page, 'ready'); assert.equal(await page.locator('[data-closure-id="' + closures[0].id + '"]').count(), 0);
  await prisma.companyClosure.update({ where: { id: closures[0].id }, data: { status: 'ACTIVE', updatedAt: source[0].updatedAt } });
  // Advance only the monotonic UI clock: the 60-second refresh must retire old cards.
  const automatic = gate(), resumeAutomatic = gate();
  await page.route(url(a.id), async route => { const response = await route.fetch(); automatic.release(); await resumeAutomatic.promise; try { await route.fulfill({ response }); } catch (_) {} });
  await page.evaluate(() => { const original = performance.now.bind(performance); Object.defineProperty(performance, 'now', { configurable: true, value: () => original() + 61000 }); });
  await automatic.promise; await state(page, 'loading'); assert.equal(await page.locator('#clientClosureList article').count(), 0); resumeAutomatic.release(); await state(page, 'ready'); await page.unroute(url(a.id), { behavior: 'wait' });
  // A notice ends at its stored instant, without waiting for another HTTP response.
  await page.route(url(a.id), async route => { const response = await route.fetch(), data = await response.json(); await route.fulfill({ response, json: { ...data, closures: [{ ...data.closures.find(row => row.id === closures[0].id), endDate: new Date(Date.parse(data.asOf) + 600).toISOString() }] } }); });
  await refresh(); await state(page, 'ready'); await state(page, 'empty'); assert.equal(await page.locator('#clientClosureList article').count(), 0); await page.unroute(url(a.id)); await refresh(); await state(page, 'ready');
  // A response for an earlier language must not restore the previous UI.
  const arrived = gate(), release = gate(); let first = true;
  await page.route(url(a.id), async route => { const response = await route.fetch(); if (first) { first = false; arrived.release(); await release.promise; } try { await route.fulfill({ response }); } catch (_) {} });
  await refresh(); await arrived.promise; await page.locator('#cwLanguageSelect').selectOption('de'); await state(page, 'ready'); release.release(); await page.unroute(url(a.id), { behavior: 'wait' }); assert.equal(await title(), 'Urlaub und Schließzeiten');
  // Same-tab identity change while a response is held invalidates the entire section.
  const held = gate(), letGo = gate();
  await page.route(url(a.id), async route => { const response = await route.fetch(); held.release(); await letGo.promise; try { await route.fulfill({ response }); } catch (_) {} });
  await refresh(); await held.promise;
  await page.evaluate(({ user, token }) => { for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user: second, token: secondToken });
  await state(page, 'session'); letGo.release(); await page.unroute(url(a.id), { behavior: 'wait' }); assert.equal(await page.locator('#clientClosureList article').count(), 0); assert(await page.locator('#clientClosureRefresh').isDisabled()); assert.equal(await page.evaluate(() => localStorage.getItem('qaOriginalDraft')), 'preserved');
  const previewContext = await contextFor(adminUser, adminToken), preview = await pageFor(previewContext); await state(preview, 'ready');
  const previewArrived = gate(), previewRelease = gate();
  await preview.route(url(a.id), async route => { const response = await route.fetch(); previewArrived.release(); await previewRelease.promise; try { await route.fulfill({ response }); } catch (_) {} });
  await preview.locator('#clientClosureRefresh').click(); await previewArrived.promise;
  await preview.locator('#adminClientSelect').selectOption(String(b.id)); await state(preview, 'ready'); previewRelease.release(); await preview.unroute(url(a.id), { behavior: 'wait' }); assert.equal(await preview.locator('#adminClientSelect').inputValue(), String(b.id));
  assert(reads.some(read => read.url === url(b.id) && read.token === 'Bearer ' + adminToken));
  await preview.locator('#adminClientSelect').selectOption(''); await state(preview, 'idle'); assert.equal(await preview.locator('#clientClosureList article').count(), 0);
  // Expiry is observed without a further request; unrelated stored drafts remain.
  const expiringToken = sign(user), expiryContext = await contextFor(user, expiringToken), expiryPage = await pageFor(expiryContext); await state(expiryPage, 'ready');
  await expiryPage.evaluate(() => { const original = Date.now; Date.now = () => original() + 3700000; }); await state(expiryPage, 'session'); assert.equal(await expiryPage.locator('#clientClosureList article').count(), 0);
  assert(reads.every(read => read.method === 'GET' && ['Bearer ' + token, 'Bearer ' + adminToken, 'Bearer ' + expiringToken].includes(read.token)));
  assert.deepEqual(errors, []); assert.deepEqual(await counts(), before);
  assert.deepEqual(await prisma.companyClosure.findMany({ where: { id: { in: closures.map(row => row.id) } }, orderBy: { id: 'asc' } }), source);
  console.log('PASS client closures browser: real portal, 5 languages, 320/390/1440, literal original notices, future/current states, empty/partial/error, wrong response identity, offline, timeout, reload lifecycle, cancellation and periodic refresh, exact expiry, late language/client replies, account swap and expiry, preserved sources and no writes');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close(); await prisma.$disconnect();
  try { await prisma.companyClosure.deleteMany({ where: { id: { in: closures.map(row => row.id) } } }); await prisma.client.deleteMany({ where: { id: { in: clients.map(row => row.id) } } }); }
  finally { await prisma.$disconnect(); }
});
