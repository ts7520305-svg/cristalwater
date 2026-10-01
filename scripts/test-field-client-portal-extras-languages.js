'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), { randomInt } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const retryLabels = ['Tentar novamente', 'Try again', 'Réessayer', 'Reintentar', 'Erneut versuchen'];
const errorLabels = ['Nao foi possivel carregar dados', 'Unable to load data', 'Impossible de charger les donnees', 'No se pudieron cargar los datos', 'Daten konnten nicht geladen werden'];
const quoteTitles = ['Orçamentos', 'Quotes', 'Devis', 'Presupuestos', 'Angebote'], quoteRefresh = ['Atualizar', 'Refresh', 'Actualiser', 'Actualizar', 'Aktualisieren'];
const quoteLoadErrors = ['Não foi possível carregar.', 'Could not load.', 'Chargement impossible.', 'No se pudo cargar.', 'Laden fehlgeschlagen.'];
let quoteLanguageCases = 0;
async function quotePresentation(page, index) {
  await page.waitForFunction(expected => document.getElementById('clientQuotesTitle').textContent === expected, quoteTitles[index]);
  assert.equal(await page.locator('#clientQuotesRefresh').textContent(), quoteRefresh[index]);
  const geometry = await page.evaluate(() => ['clientQuotesTitle', 'clientQuotesRefresh'].map(id => { const item = document.getElementById(id), range = document.createRange(); range.selectNodeContents(item); return { id, lines: range.getClientRects().length, height: item.getBoundingClientRect().height, text: [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right })) }; }));
  for (const item of geometry) { assert.equal(item.lines, 1, 'Quote heading/refresh words must remain whole: ' + item.id); assert(item.text.every(rect => rect.left >= 0 && rect.right <= page.viewportSize().width)); }
  assert(geometry[1].height >= 44); quoteLanguageCases++;
}
const deadline = setTimeout(() => { console.error('Client portal extras language QA deadline'); process.exit(1); }, 150000);
let browser, client, notice, originalLanguage, complete = false, checks = 0;
process.on('exit', code => { if (!code && !complete) process.exitCode = 1; });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const pending = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('cw-client-portal-requests-v1', 1); request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, read = db.transaction('pending').objectStore('pending').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a, b) => a.kind.localeCompare(b.kind))); }; read.onerror = () => reject(read.error); };
}));
const work = page => page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech|^cwPortal/.test(key)).sort().map(key => [key, localStorage.getItem(key)])), session: Object.fromEntries(Object.keys(sessionStorage).filter(key => /^cwPortal|^cwClientChat/.test(key)).sort().map(key => [key, sessionStorage.getItem(key)])) }));
const fields = page => page.evaluate(() => ({ values: ['messageInput', 'visitRequestInput', 'paymentNoticeAmount', 'paymentNoticeMethod', 'paymentNoticeNote'].map(id => ({ id, value: document.getElementById(id).value, disabled: document.getElementById(id).disabled })), focus: document.activeElement.id, selection: [document.getElementById('messageInput').selectionStart, document.getElementById('messageInput').selectionEnd] }));
const capture = async (page, name, section = '#permissionsPanel') => {
  if (!process.env.CW_PORTAL_EXTRAS_CAPTURE) return;
  await fs.mkdir(process.env.CW_PORTAL_EXTRAS_CAPTURE, { recursive: true }); await page.locator(section).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(process.env.CW_PORTAL_EXTRAS_CAPTURE, name + '.png') });
};
async function database() {
  // Separate fixture-inspection phases from the application's connections;
  // each still uses the actual database and all assertions remain active.
  await prisma.$disconnect();
  try { return await Promise.all([prisma.client.findUnique({ where: { id: client.id } }), prisma.notification.findUnique({ where: { id: notice.id } }), prisma.clientMessage.count({ where: { clientId: client.id } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count(), prisma.serviceVisit.count(), prisma.extraVisit.count()]); }
  finally { await prisma.$disconnect(); }
}
(async () => {
  client = await prisma.client.create({ data: { id: randomInt(1500000000, 1600000000), name: 'Portal labels <b>{retryExtras}</b>', active: true } });
  const languageKey = 'LANGUAGE:CLIENT:' + client.id; originalLanguage = await prisma.systemSetting.findUnique({ where: { key: languageKey } });
  notice = await prisma.notification.create({ data: { clientId: client.id, role: 'CLIENT', title: 'Tentar novamente', message: '{"key":"retryExtras"} <b>literal source</b>', isRead: false } });
  const user = { id: client.id, clientId: client.id, role: 'CLIENT' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  await prisma.$disconnect();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function context(serviceWorkers = 'block') {
    const result = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers, timezoneId: 'Europe/Lisbon' });
    await result.route('https://cdn.socket.io/**', route => route.abort());
    await result.addInitScript(({ user, token }) => { if (localStorage.getItem('qaPortal503')) return; for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); localStorage.setItem('cw_language', 'pt'); localStorage.setItem('qaPortal503', 'true'); }, { user, token });
    return result;
  }
  const ctx = await context(), page = await ctx.newPage(), errors = [], requests = []; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/')) requests.push({ path: url.pathname, method: request.method() }); });
  const endpoints = { notificationList: 'notifications', permissionsList: 'permissions' };
  let faults = new Set(Object.keys(endpoints)), malformed = false, responseStatus = 503;
  for (const [id, endpoint] of Object.entries(endpoints)) await page.route(base + '/api/client-portal/' + client.id + '/' + endpoint, route => faults.has(id) ? route.fulfill(malformed ? { status: 200, contentType: 'application/json', body: '{broken' } : { status: responseStatus, json: { ok: false, error: '{"key":"retryExtras"} <b>server literal</b>' } }) : route.continue());
  const posts = requests => requests.filter(request => request.method !== 'GET' && request.path !== '/api/settings/language/me');
  await page.goto(base + '/client-portal?lang=pt'); await page.waitForFunction(() => loadedClientId === clientId); await page.waitForLoadState('networkidle');
  await page.locator('#visitRequestInput').fill('Visit preserved <b>{key}</b>');
  await page.route(base + '/api/client-portal/' + client.id + '/visit-requests', route => route.abort('failed'));
  await page.locator('#visitRequestBtn').click(); await page.waitForFunction(() => document.getElementById('visitRequestRecovery').getAttribute('aria-busy') === 'false' && !document.getElementById('visitRequestRetry').hidden);
  await page.locator('#paymentNoticeAmount').fill('123.45'); await page.locator('#paymentNoticeMethod').selectOption('MBWay'); await page.locator('#paymentNoticeNote').fill('Payment note literal {key}');
  await page.route(base + '/api/client-portal/' + client.id + '/payment-notice', route => route.abort('failed'));
  await page.locator('#paymentNoticeBtn').click(); await page.waitForFunction(() => document.getElementById('paymentNoticeRecovery').getAttribute('aria-busy') === 'false' && !document.getElementById('paymentNoticeRetry').hidden);
  await page.locator('#messageInput').fill('Message draft <b>{key}</b>'); await page.locator('#messageInput').focus(); await page.evaluate(() => document.getElementById('messageInput').setSelectionRange(2, 8));
  await page.evaluate(() => { localStorage.setItem('cwFieldLegacyCorrupt:keep', '{broken source bytes'); localStorage.setItem('cwFieldRouteCache:v2:TECH:503', '{"literal":"unrelated route"}'); });
  const originalPending = await pending(page), originalWork = await work(page), savedDatabase = await database();
  assert.equal(originalPending.length, 2); assert.notEqual(originalPending[0].requestId, originalPending[1].requestId);
  assert(originalPending.every(row => row.owner === 'CLIENT:' + client.id && row.payloadHash.length === 64));
  assert.equal(savedDatabase[2], 0, 'Aborted producer requests created no client messages');
  const phasePosts = posts(requests).length;
  async function preserve() { assert.deepEqual(await pending(page), originalPending); assert.deepEqual(await work(page), originalWork); assert.equal(posts(requests).length, phasePosts, 'Labels/retries must not send pending work or acknowledge notices'); }
  async function holdCore() {
    const routes = [];
    const handler = route => routes.push(route);
    await page.route(base + '/api/client-portal/' + client.id + '?*', handler);
    return async () => { await page.unroute(base + '/api/client-portal/' + client.id + '?*', handler); for (const route of routes) await route.continue(); await page.waitForFunction(() => loadedClientId === clientId); await page.waitForLoadState('networkidle'); };
  }
  async function matrix(name, ids) {
    const release = await holdCore();
    await page.locator('#messageInput').focus(); await page.evaluate(() => { document.getElementById('messageInput').setSelectionRange(2, 8); window.qaExtraNodes = [...document.querySelectorAll('#notificationList > p[role=alert], #notificationList > button, #permissionsList > p[role=alert], #permissionsList > button')]; window.qaExtraTextNodes = qaExtraNodes.map(node => node.firstChild); });
    await page.locator('#cwLanguageSelect').selectOption('pt'); await page.waitForFunction(() => loadedClientId === 0 && document.getElementById('messageInput').disabled); await settle(page);
    const before = await fields(page);
    const quoteReads = requests.filter(request => request.path.endsWith('/quotes')).length;
    try {
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [index, language] of languages.entries()) {
          await page.locator('#cwLanguageSelect').selectOption(language); await settle(page);
          assert.equal(await page.evaluate(() => portalLanguage), language);
          await quotePresentation(page, index); assert.equal(requests.filter(request => request.path.endsWith('/quotes')).length, quoteReads);
          for (const id of ids) { assert.equal(await page.locator('#' + id + ' > button').textContent(), retryLabels[index]); assert.equal(await page.locator('#' + id + ' > p[role=alert]').textContent(), errorLabels[index]); }
          assert(await page.evaluate(() => qaExtraNodes.every((node, index) => node.isConnected && node.firstChild === qaExtraTextNodes[index])));
          assert.deepEqual(await fields(page), before); await preserve();
          for (const id of ids) { const rect = await page.locator('#' + id + ' > button').boundingBox(); assert(rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44, JSON.stringify({ name, id, width, language, rect })); }
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks++;
        }
      }
      await page.setViewportSize({ width: 320, height: 900 }); await capture(page, name + '-de-320');
    } finally { await release(); }
    assert.deepEqual(await database(), savedDatabase); await preserve();
    console.log('PASS portal extras labels ' + JSON.stringify({ name, widths: [320, 390, 1440], languages: 5, originalLabelsFocusDraftsAndPendingPreserved: true, pendingRequests: 2 }));
  }
  // Pure repaint retains a focused composer. Actual selector reloads below
  // retain the original busy guard, which disables it while its read is held.
  await page.locator('#messageInput').focus(); await page.evaluate(() => document.getElementById('messageInput').setSelectionRange(2, 8));
  const idleFields = await fields(page), coreReads = () => requests.filter(request => request.path === '/api/client-portal/' + client.id).length, idleReads = coreReads();
  const idleQuoteReads = requests.filter(request => request.path.endsWith('/quotes')).length;
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    await page.evaluate(language => { queryLanguage = language; applyLanguage(language); }, language); await settle(page);
    await quotePresentation(page, index); assert.equal(requests.filter(request => request.path.endsWith('/quotes')).length, idleQuoteReads);
    for (const id of Object.keys(endpoints)) { assert.equal(await page.locator('#' + id + ' > button').textContent(), retryLabels[index]); assert.equal(await page.locator('#' + id + ' > p[role=alert]').textContent(), errorLabels[index]); }
    assert.deepEqual(await fields(page), idleFields); assert.equal(coreReads(), idleReads); await preserve(); checks++;
  } }
  console.log('PASS pure portal extras repaint: original focused composer and selection preserved without a core reload');
  await matrix('both-503', Object.keys(endpoints));
  for (const [name, selectedFaults] of [['notification-503', ['notificationList']], ['permissions-503', ['permissionsList']], ['both-invalid-ok', Object.keys(endpoints)], ['both-malformed', Object.keys(endpoints)]]) {
    faults = new Set(selectedFaults); responseStatus = name === 'both-invalid-ok' ? 200 : 503; malformed = name === 'both-malformed';
    await page.evaluate(() => loadCustomerExtras()); await page.waitForLoadState('networkidle'); await matrix(name, selectedFaults);
    if (!faults.has('notificationList')) { assert.equal(await page.locator('#notificationList .service-title').textContent(), notice.title); assert((await page.locator('#notificationList').textContent()).includes(notice.message)); assert.equal(await page.locator('#notificationList .service-title b').count(), 0); }
  }
  // Actual retries keep the existing two-section callback and native responses.
  faults = new Set(); malformed = false;
  const beforeRetry = requests.length; await page.locator('#permissionsList > button').click(); await page.locator('#permissionsList > button').waitFor({ state: 'detached' }); await page.locator('#notificationList > button').waitFor({ state: 'detached' }); await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#notificationList > button').count(), 0); assert.equal(await page.locator('#permissionsList > button').count(), 0);
  for (const endpoint of Object.values(endpoints)) assert.equal(requests.slice(beforeRetry).filter(request => request.path === '/api/client-portal/' + client.id + '/' + endpoint).length, 1);
  assert.equal(await page.locator('#notificationList .service-title').textContent(), notice.title); assert((await page.locator('#notificationList').textContent()).includes(notice.message));
  await preserve(); assert.deepEqual(await database(), savedDatabase); checks++;
  faults = new Set(Object.keys(endpoints)); responseStatus = 503; await page.evaluate(() => loadCustomerExtras()); await page.waitForLoadState('networkidle');
  for (const kind of ['changed-leaf', 'replaced-node']) {
    await page.evaluate(kind => { const button = document.querySelector('#permissionsList > button'); if (kind === 'changed-leaf') button.firstChild.nodeValue = 'Operator literal <b>{retryExtras}</b>'; else { const clone = button.cloneNode(); clone.textContent = 'Foreign retry literal {retryExtras}'; button.replaceWith(clone); } window.qaForeignExtra = document.querySelector('#permissionsList > button'); }, kind);
    const release = await holdCore();
    try { for (const language of languages) { await page.locator('#cwLanguageSelect').selectOption(language); await settle(page); assert.equal(await page.locator('#permissionsList > button').textContent(), kind === 'changed-leaf' ? 'Operator literal <b>{retryExtras}</b>' : 'Foreign retry literal {retryExtras}'); assert(await page.evaluate(() => document.querySelector('#permissionsList > button') === qaForeignExtra)); await preserve(); checks++; } }
    finally { await release(); }
    await page.evaluate(() => loadCustomerExtras()); await page.waitForLoadState('networkidle');
  }
  assert.deepEqual(errors, []); await ctx.close();
  // Compare the real worker shell with current source before warm and cold
  // offline cases; both retain the original producer guards and pending work.
  const offline = await context('allow'), offlinePage = await offline.newPage(); offlinePage.setDefaultTimeout(12000);
  await offlinePage.goto(base + '/admin-login'); await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await offlinePage.goto(base + '/client-portal?lang=de'); await offlinePage.waitForFunction(() => loadedClientId === clientId); await offlinePage.waitForLoadState('networkidle');
  for (const [url, file] of [['/client-portal?lang=de', 'client-portal.html'], ['/client-portal.js', 'client-portal.js'], ['/cw-auth.js', 'cw-auth.js'], ['/client-quotes.js', 'client-quotes.js']]) {
    await offlinePage.waitForFunction(async url => Boolean(await (await caches.open('cristalwater-field-20261001-v283')).match(url)), url);
    assert.equal(await offlinePage.evaluate(async url => (await (await caches.open('cristalwater-field-20261001-v283')).match(url)).text(), url), await fs.readFile(path.join(__dirname, '../frontend', file), 'utf8'));
  }
  await offlinePage.route(base + '/api/client-portal/' + client.id + '/visit-requests', route => route.abort('failed'));
  await offlinePage.route(base + '/api/client-portal/' + client.id + '/payment-notice', route => route.abort('failed'));
  await offlinePage.locator('#visitRequestInput').fill('Cold visit pending <b>{retryExtras}</b>'); await offlinePage.locator('#visitRequestBtn').click(); await offlinePage.waitForFunction(() => document.getElementById('visitRequestRecovery').getAttribute('aria-busy') === 'false' && !document.getElementById('visitRequestRetry').hidden);
  await offlinePage.locator('#paymentNoticeAmount').fill('98.76'); await offlinePage.locator('#paymentNoticeMethod').selectOption('MBWay'); await offlinePage.locator('#paymentNoticeNote').fill('Cold payment pending exact'); await offlinePage.locator('#paymentNoticeBtn').click(); await offlinePage.waitForFunction(() => document.getElementById('paymentNoticeRecovery').getAttribute('aria-busy') === 'false' && !document.getElementById('paymentNoticeRetry').hidden);
  await offlinePage.locator('#messageInput').fill('Offline message draft exact');
  const coldPending = await pending(offlinePage); assert.equal(coldPending.length, 2); assert.notEqual(coldPending[0].requestId, coldPending[1].requestId); assert(coldPending.every(row => row.owner === 'CLIENT:' + client.id && row.payloadHash.length === 64));
  const coldValues = (await fields(offlinePage)).values.map(({ id, value }) => ({ id, value }));
  const coldSession = await offlinePage.evaluate(() => Object.fromEntries(['token', 'cristalwater_jwt', 'user', 'cristalwater_user'].map(key => [key, localStorage.getItem(key)])));
  const coldRequests = []; offlinePage.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/')) coldRequests.push({ path: url.pathname, method: request.method() }); });
  const offlineWork = await work(offlinePage); await offline.setOffline(true); await offlinePage.evaluate(() => loadCustomerExtras());
  for (const [index, language] of languages.entries()) { await offlinePage.locator('#cwLanguageSelect').selectOption(language); await settle(offlinePage); await quotePresentation(offlinePage, index); for (const id of Object.keys(endpoints)) assert.equal(await offlinePage.locator('#' + id + ' > button').textContent(), retryLabels[index]); assert.equal(await offlinePage.locator('#messageInput').inputValue(), 'Offline message draft exact'); assert.deepEqual(await work(offlinePage), offlineWork); checks++; }
  await offlinePage.setViewportSize({ width: 320, height: 900 }); await capture(offlinePage, 'offline-de-320');
  // A real cached-document reload must replace the original HTML loaders even
  // though the primary read fails before the extra-section requests are made.
  await offlinePage.reload({ waitUntil: 'domcontentloaded' });
  await offlinePage.locator('#notificationList > p[role=alert]').waitFor(); await offlinePage.locator('#permissionsList > p[role=alert]').waitFor();
  await offlinePage.waitForFunction(() => document.getElementById('messageInput').value === 'Offline message draft exact'); await offlinePage.waitForLoadState('networkidle');
  async function coldPreserve() {
    assert.deepEqual(await pending(offlinePage), coldPending); assert.deepEqual(await work(offlinePage), offlineWork);
    assert.deepEqual((await fields(offlinePage)).values.map(({ id, value }) => ({ id, value })), coldValues);
    assert.deepEqual(await offlinePage.evaluate(() => Object.fromEntries(['token', 'cristalwater_jwt', 'user', 'cristalwater_user'].map(key => [key, localStorage.getItem(key)]))), coldSession);
    assert.equal(coldRequests.filter(request => request.method !== 'GET' && request.path !== '/api/settings/language/me' && request.path !== '/api/client-messages/seen/' + client.id).length, 0, 'Cold labels and primary retries cannot send any producer or notification acknowledgement');
  }
  async function coldLabels() {
    const index = languages.indexOf(await offlinePage.evaluate(() => portalLanguage)), width = await offlinePage.evaluate(() => innerWidth);
    await quotePresentation(offlinePage, index); assert((await offlinePage.locator('#clientQuotesStatus').textContent()).startsWith(quoteLoadErrors[index]));
    for (const id of Object.keys(endpoints)) {
      assert.equal(await offlinePage.locator('#' + id + ' > p[role=alert]').textContent(), errorLabels[index]); assert.equal(await offlinePage.locator('#' + id + ' > button').textContent(), retryLabels[index]);
      const rect = await offlinePage.locator('#' + id + ' > button').boundingBox(); assert(rect.x >= 0 && rect.x + rect.width <= width && rect.height >= 44);
    }
    assert.equal(await offlinePage.evaluate(() => loadedClientId), 0);
    for (const id of ['messageInput', 'sendBtn', 'photoBtn', 'visitRequestBtn', 'paymentNoticeBtn', 'visitRequestRetry', 'paymentNoticeRetry']) assert.equal(await offlinePage.locator('#' + id).isDisabled(), true);
    assert(await offlinePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await coldPreserve();
  }
  async function coldMatrix(name) {
    const guardedReads = () => coldRequests.filter(request => request.method === 'GET' && (request.path === '/api/client-portal/' + client.id || Object.values(endpoints).some(endpoint => request.path === '/api/client-portal/' + client.id + '/' + endpoint))).length;
    const fieldsBeforePaint = await fields(offlinePage), reads = guardedReads();
    await offlinePage.evaluate(() => { window.qaColdNodes = [...document.querySelectorAll('#notificationList > p[role=alert],#notificationList > button,#permissionsList > p[role=alert],#permissionsList > button')]; window.qaColdTextNodes = qaColdNodes.map(node => node.firstChild); });
    for (const width of [320, 390, 1440]) { await offlinePage.setViewportSize({ width, height: 900 }); for (const language of languages) {
      await offlinePage.evaluate(language => { queryLanguage = language; applyLanguage(language); }, language); await settle(offlinePage); await coldLabels();
      assert.deepEqual(await fields(offlinePage), fieldsBeforePaint); assert.equal(guardedReads(), reads); assert(await offlinePage.evaluate(() => qaColdNodes.every((node, index) => node.isConnected && node.firstChild === qaColdTextNodes[index]))); checks++;
    } }
    for (const width of [320, 390, 1440]) { await offlinePage.setViewportSize({ width, height: 900 }); for (const language of languages) {
      await offlinePage.evaluate(() => { window.qaColdPrevious = document.querySelector('#notificationList > button'); });
      await offlinePage.locator('#cwLanguageSelect').selectOption(language); await offlinePage.waitForFunction(() => !qaColdPrevious.isConnected); await offlinePage.waitForLoadState('networkidle'); await coldLabels(); checks++;
    } }
    await offlinePage.setViewportSize({ width: 320, height: 900 }); await capture(offlinePage, 'cold-' + name + '-de-320');
    console.log('PASS cold portal extras ' + JSON.stringify({ name, languages: 5, widths: [320, 390, 1440], pureAndActualSelectorCases: 30, originalBusyGuard: true, exactPendingRequests: 2 }));
  }
  await coldMatrix('offline-cache-reload');
  // Direct producer calls remain blocked by the existing primary-read guard.
  await offlinePage.evaluate(() => Promise.all([requestVisit(), notifyPayment(), sendMessage()])); await coldLabels();
  const corePath = '/api/client-portal/' + client.id, coldCoreReads = () => coldRequests.filter(request => request.method === 'GET' && request.path === corePath).length;
  let beforeCore = coldCoreReads(); await offlinePage.evaluate(() => { window.qaColdPrevious = document.querySelector('#notificationList > button'); });
  await offlinePage.locator('#notificationList > button').click(); await offlinePage.waitForFunction(() => !qaColdPrevious.isConnected); await offlinePage.waitForLoadState('networkidle');
  assert.equal(coldCoreReads(), beforeCore + 1); await coldLabels(); checks++;
  // These are primary-read faults; otherwise native extra endpoints stay live.
  await offline.setOffline(false); let coreFault = '503';
  const serverLiteral = '{"key":"retryExtras"} <b>primary source literal</b>';
  await offlinePage.route(base + corePath + '?*', route => coreFault ? route.fulfill(coreFault === 'malformed' ? { status: 200, contentType: 'application/json', body: '{broken' } : { status: coreFault === '503' ? 503 : 200, json: { ok: false, error: serverLiteral } }) : route.continue());
  for (const name of ['503', 'ok-false', 'malformed']) {
    coreFault = name; const beforeExtras = coldRequests.filter(request => Object.values(endpoints).some(endpoint => request.path === corePath + '/' + endpoint)).length;
    await offlinePage.evaluate(() => { window.qaColdPrevious = document.querySelector('#notificationList > button'); });
    await offlinePage.locator('#permissionsList > button').click(); await offlinePage.waitForFunction(() => !qaColdPrevious.isConnected); await offlinePage.waitForLoadState('networkidle');
    await coldMatrix(name);
    assert.equal(coldRequests.filter(request => Object.values(endpoints).some(endpoint => request.path === corePath + '/' + endpoint)).length, beforeExtras, 'Primary failure must not launch extra reads');
    if (name !== 'malformed') { assert.equal(await offlinePage.locator('#poolsList .empty').textContent(), serverLiteral); assert.equal(await offlinePage.locator('#poolsList b').count(), 0); }
    assert.deepEqual(await database(), savedDatabase);
  }
  // Recovery reuses the original primary loader and its two native extra reads.
  coreFault = null; beforeCore = coldCoreReads(); const beforeRecovery = coldRequests.length;
  await offlinePage.locator('#notificationList > button').click(); await offlinePage.waitForFunction(() => loadedClientId === clientId); await offlinePage.locator('#permissionsList > button').waitFor({ state: 'detached' }); await offlinePage.locator('#notificationList > button').waitFor({ state: 'detached' }); await offlinePage.waitForLoadState('networkidle');
  assert.equal(coldCoreReads(), beforeCore + 1); for (const endpoint of Object.values(endpoints)) assert.equal(coldRequests.slice(beforeRecovery).filter(request => request.path === corePath + '/' + endpoint).length, 1);
  assert.equal(await offlinePage.locator('#notificationList .service-title').textContent(), notice.title); assert((await offlinePage.locator('#notificationList').textContent()).includes(notice.message));
  await coldPreserve(); assert.equal(await offlinePage.locator('#messageInput').isDisabled(), false); assert.deepEqual(await database(), savedDatabase); checks++;
  // Healthy responses must render Spanish notifications instead of presenting
  // the extra-section error view. Only an explicit read acknowledgement may
  // change the fixture; every pending producer record remains unchanged.
  const noticeReadPath = '/api/notifications/' + notice.id + '/read', noticeStart = coldRequests.length;
  const noticeLabels = {
    heading: ['Notificações', 'Notifications', 'Notifications', 'Notificaciones', 'Mitteilungen'], updates: ['Atualizações', 'Updates', 'Actualités', 'Actualizaciones', 'Neuigkeiten'], support: ['Suporte', 'Support', 'Assistance', 'Asistencia', 'Hilfe'],
    mark: ['Marcar como lida', 'Mark as read', 'Marquer comme lue', 'Marcar como leída', 'Als gelesen markieren'], unread: ['Por ler', 'Unread', 'Non lue', 'Sin leer', 'Ungelesen'], read: ['Lida', 'Read', 'Lue', 'Leída', 'Gelesen'],
    error: ['Não foi possível confirmar a leitura. Tente novamente.', 'Could not confirm reading. Please try again.', 'Impossible de confirmer la lecture. Réessayez.', 'No se pudo confirmar la lectura. Vuelve a intentarlo.', 'Lesebestätigung fehlgeschlagen. Bitte erneut versuchen.'],
  };
  let healthyNoticeCases = 0;
  async function noticePreserve() {
    assert.deepEqual(await pending(offlinePage), coldPending); assert.deepEqual(await work(offlinePage), offlineWork);
    assert.deepEqual((await fields(offlinePage)).values.map(({ id, value }) => ({ id, value })), coldValues);
    assert.deepEqual(await offlinePage.evaluate(() => Object.fromEntries(['token', 'cristalwater_jwt', 'user', 'cristalwater_user'].map(key => [key, localStorage.getItem(key)]))), coldSession);
    assert.equal(coldRequests.filter(request => request.method !== 'GET' && request.path !== '/api/settings/language/me' && request.path !== '/api/client-messages/seen/' + client.id && request.path !== noticeReadPath).length, 0, 'Notification labels/read acknowledgement cannot send pending producers');
  }
  async function noticeNodes() { await offlinePage.evaluate(() => { window.qaNoticeNodes = [...document.querySelectorAll('#notificationsTitle,#notificationsPill,#notificationList .service-title,#notificationList .pill,#notificationList button,#notificationList [role=status]')]; window.qaNoticeLeaves = qaNoticeNodes.map(node => node.firstChild); }); }
  async function healthyLabels(index, state, retainedButton = true) {
    for (const [id, key] of [['notificationsTitle', 'heading'], ['notificationsPill', 'updates'], ['permissionsPill', 'support']]) assert.equal(await offlinePage.locator('#' + id).textContent(), noticeLabels[key][index]);
    const headingLines = await offlinePage.evaluate(() => ['notificationsTitle', 'notificationsPill', 'permissionsPill'].map(id => { const range = document.createRange(); range.selectNodeContents(document.getElementById(id)); return { id, lines: range.getClientRects().length }; }));
    for (const item of headingLines) assert.equal(item.lines, 1, 'Notification/support words must remain whole: ' + item.id);
    assert.equal(await offlinePage.locator('#notificationList .service-title').textContent(), notice.title); assert((await offlinePage.locator('#notificationList').textContent()).includes(notice.message)); assert.equal(await offlinePage.locator('#notificationList .service-title b').count(), 0);
    assert.equal(await offlinePage.locator('#notificationList .pill').textContent(), noticeLabels[state === 'read' ? 'read' : 'unread'][index]);
    if (retainedButton) { assert.equal(await offlinePage.locator('#notificationList [data-notice-read]').textContent(), noticeLabels[state === 'read' ? 'read' : 'mark'][index]); assert.equal(await offlinePage.locator('#notificationList [data-notice-read]').isDisabled(), state === 'busy' || state === 'read'); const rect = await offlinePage.locator('#notificationList [data-notice-read]').boundingBox(); assert(rect.height >= 44 && rect.x >= 0 && rect.x + rect.width <= offlinePage.viewportSize().width); }
    else assert.equal(await offlinePage.locator('#notificationList [data-notice-read]').count(), 0);
    if (state === 'failed') assert.equal(await offlinePage.locator('#notificationList [role=status]').textContent(), noticeLabels.error[index]);
    assert.equal(await offlinePage.locator('#notificationList > p[role=alert]').count(), 0); assert.equal(await offlinePage.locator('#permissionsList > p[role=alert]').count(), 0); await noticePreserve();
  }
  async function healthyMatrix(state) {
    const guardedReads = () => coldRequests.filter(request => request.method === 'GET' && (request.path === corePath || Object.values(endpoints).some(endpoint => request.path === corePath + '/' + endpoint))).length;
    const readsBefore = guardedReads(), writesBefore = coldRequests.filter(request => request.path === noticeReadPath).length;
    await offlinePage.locator('#messageInput').focus(); await offlinePage.evaluate(() => document.getElementById('messageInput').setSelectionRange(2, 8)); const before = await fields(offlinePage); await noticeNodes();
    for (const width of [320, 390, 1440]) { await offlinePage.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
      await offlinePage.evaluate(language => { queryLanguage = language; applyLanguage(language); }, language); await settle(offlinePage); await healthyLabels(index, state);
      assert.deepEqual(await fields(offlinePage), before); assert.equal(guardedReads(), readsBefore); assert.equal(coldRequests.filter(request => request.path === noticeReadPath).length, writesBefore);
      assert(await offlinePage.evaluate(() => qaNoticeNodes.every((node, index) => node.isConnected && node.firstChild === qaNoticeLeaves[index]))); assert(await offlinePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); healthyNoticeCases++;
    } }
    await offlinePage.setViewportSize({ width: 320, height: 900 }); await capture(offlinePage, 'notice-' + state + '-de-320', '#notificationsPanel');
  }
  await offlinePage.evaluate(() => { queryLanguage = 'es'; applyLanguage('es'); }); await offlinePage.evaluate(() => loadCustomerExtras()); await offlinePage.waitForLoadState('networkidle'); await healthyLabels(3, 'unread'); await healthyMatrix('unread');
  await offlinePage.route(base + noticeReadPath, route => route.abort('failed'));
  await offlinePage.locator('#notificationList [data-notice-read]').click(); await offlinePage.waitForFunction(() => document.querySelector('#notificationList [role=status]').textContent.length > 0); await healthyMatrix('failed'); assert.deepEqual(await database(), savedDatabase);
  await offlinePage.unroute(base + noticeReadPath); let heldNotice;
  await offlinePage.route(base + noticeReadPath, route => { assert.equal(route.request().headers().authorization, 'Bearer ' + token); assert.equal(route.request().postData(), null); heldNotice = route; });
  await offlinePage.locator('#notificationList [data-notice-read]').click(); await offlinePage.waitForFunction(() => document.querySelector('#notificationList [data-notice-read]').disabled); await healthyMatrix('busy'); assert(heldNotice); assert.deepEqual(await database(), savedDatabase);
  const noticeBeforeConfirm = Date.now(); await heldNotice.continue(); await offlinePage.unroute(base + noticeReadPath); await offlinePage.waitForFunction(() => document.querySelector('#notificationList [data-notice-read]').textContent === 'Gelesen'); await healthyMatrix('read');
  const afterNotice = await database(); assert.equal(afterNotice[1].isRead, true); for (const key of ['readAt', 'updatedAt']) assert(afterNotice[1][key] instanceof Date && afterNotice[1][key].getTime() >= noticeBeforeConfirm && afterNotice[1][key].getTime() <= Date.now());
  const finalDatabaseExpected = savedDatabase.map((row, index) => index === 1 ? { ...row, isRead: true, readAt: afterNotice[1].readAt, updatedAt: afterNotice[1].updatedAt } : row); assert.deepEqual(afterNotice, finalDatabaseExpected);
  await offlinePage.evaluate(() => document.querySelector('#notificationList [data-notice-read]').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await noticePreserve();
  for (const width of [320, 390, 1440]) { await offlinePage.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    await offlinePage.locator('#cwLanguageSelect').selectOption(language); await offlinePage.waitForFunction(() => loadedClientId === clientId); await offlinePage.waitForLoadState('networkidle'); await healthyLabels(index, 'read', false); healthyNoticeCases++;
  } }
  assert.equal(coldRequests.slice(noticeStart).filter(request => request.path === noticeReadPath).length, 2, 'One failed attempt and one explicit native confirmation; repaint/selector/disabled handler cannot retry automatically'); assert.deepEqual(await database(), finalDatabaseExpected);
  console.log('PASS healthy portal notifications ' + JSON.stringify({ healthyNoticeCases, languages: 5, widths: [320, 390, 1440], spanishNativeResponseRendered: true, explicitReadAttempts: 2, nativeSqlConfirmations: 1, pendingRequests: 2, originalNodesFocusAndGuardRetained: true }));
  console.log('PASS primary portal retry: exact core GET, native two-section reload, restored guard, literal notification and immutable pending work'); await offline.close();
  assert.deepEqual(await database(), finalDatabaseExpected);
  console.log('PASS portal extras result ' + JSON.stringify({ checks, languageCases: 210, nativeRetry: true, literalNativeNotification: true, ownershipControls: 2, pendingRequests: 2, currentWorkerShellBytes: true, actualPageContinuedOffline: true, actualColdOfflineReload: true, primaryFailureStates: 4, primaryRetry: true }));
  console.log('PASS actual portal quote presentation ' + JSON.stringify({ quoteLanguageCases, cachedQuotesJsBytesEqualSource: true, coldOfflineQuoteErrors: true, realLanguageSelector: true, pureQuotePaintDoesNotReloadQuotes: true })); complete = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearTimeout(deadline); await browser?.close(); await prisma.$disconnect();
  if (client) { if (notice) await prisma.notification.delete({ where: { id: notice.id } }); await prisma.clientMessage.deleteMany({ where: { clientId: client.id } }); const key = 'LANGUAGE:CLIENT:' + client.id; await prisma.systemSetting.deleteMany({ where: { key } }); if (originalLanguage) await prisma.systemSetting.create({ data: originalLanguage }); await prisma.client.delete({ where: { id: client.id } }); assert.equal(await prisma.client.count({ where: { id: client.id } }), 0); assert.deepEqual(await prisma.systemSetting.findUnique({ where: { key } }), originalLanguage); console.log('PASS portal extras fixtures removed and previous language setting restored'); }
  await prisma.$disconnect();
});
