'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), { randomInt } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const retryLabels = ['Tentar novamente', 'Try again', 'Réessayer', 'Reintentar', 'Erneut versuchen'];
const errorLabels = ['Nao foi possivel carregar dados', 'Unable to load data', 'Impossible de charger les donnees', 'No se pudieron cargar los datos', 'Daten konnten nicht geladen werden'];
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
    try {
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [index, language] of languages.entries()) {
          await page.locator('#cwLanguageSelect').selectOption(language); await settle(page);
          assert.equal(await page.evaluate(() => portalLanguage), language);
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
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const [index, language] of languages.entries()) {
    await page.evaluate(language => { queryLanguage = language; applyLanguage(language); }, language); await settle(page);
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
  // Compare the real worker's warmed shell with current source, then continue
  // this actual page offline. Cold offline bootstrap is a separate UI gate.
  const offline = await context('allow'), offlinePage = await offline.newPage(); offlinePage.setDefaultTimeout(12000);
  await offlinePage.goto(base + '/admin-login'); await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await offlinePage.goto(base + '/client-portal?lang=de'); await offlinePage.waitForFunction(() => loadedClientId === clientId); await offlinePage.waitForLoadState('networkidle');
  for (const [url, file] of [['/client-portal?lang=de', 'client-portal.html'], ['/client-portal.js', 'client-portal.js'], ['/cw-auth.js', 'cw-auth.js']]) {
    await offlinePage.waitForFunction(async url => Boolean(await (await caches.open('cristalwater-field-20261001-v279')).match(url)), url);
    assert.equal(await offlinePage.evaluate(async url => (await (await caches.open('cristalwater-field-20261001-v279')).match(url)).text(), url), await fs.readFile(path.join(__dirname, '../frontend', file), 'utf8'));
  }
  await offlinePage.locator('#messageInput').fill('Offline message draft exact');
  const offlineWork = await work(offlinePage); await offline.setOffline(true); await offlinePage.evaluate(() => loadCustomerExtras());
  for (const [index, language] of languages.entries()) { await offlinePage.locator('#cwLanguageSelect').selectOption(language); await settle(offlinePage); for (const id of Object.keys(endpoints)) assert.equal(await offlinePage.locator('#' + id + ' > button').textContent(), retryLabels[index]); assert.equal(await offlinePage.locator('#messageInput').inputValue(), 'Offline message draft exact'); assert.deepEqual(await work(offlinePage), offlineWork); checks++; }
  await offlinePage.setViewportSize({ width: 320, height: 900 }); await capture(offlinePage, 'offline-de-320'); await offline.close();
  assert.deepEqual(await database(), savedDatabase);
  console.log('PASS portal extras result ' + JSON.stringify({ checks, languageCases: 90, nativeRetry: true, literalNativeNotification: true, ownershipControls: 2, pendingRequests: 2, currentWorkerShellBytes: true, actualPageContinuedOffline: true })); complete = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearTimeout(deadline); await browser?.close(); await prisma.$disconnect();
  if (client) { if (notice) await prisma.notification.delete({ where: { id: notice.id } }); await prisma.clientMessage.deleteMany({ where: { clientId: client.id } }); const key = 'LANGUAGE:CLIENT:' + client.id; await prisma.systemSetting.deleteMany({ where: { key } }); if (originalLanguage) await prisma.systemSetting.create({ data: originalLanguage }); await prisma.client.delete({ where: { id: client.id } }); assert.equal(await prisma.client.count({ where: { id: client.id } }), 0); assert.deepEqual(await prisma.systemSetting.findUnique({ where: { key } }), originalLanguage); console.log('PASS portal extras fixtures removed and previous language setting restored'); }
  await prisma.$disconnect();
});
