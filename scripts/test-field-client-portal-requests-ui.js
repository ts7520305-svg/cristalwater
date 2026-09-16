'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const gate = () => { let release; return { promise: new Promise(resolve => { release = resolve; }), release: () => release() }; };
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const sign = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  for (const kind of ['VISIT_REQUEST', 'PAYMENT_NOTICE']) {
    const visit = kind === 'VISIT_REQUEST', prefix = visit ? 'visitRequest' : 'paymentNotice';
    const client = await prisma.client.create({ data: { name: `Portal recovery QA ${kind}`, active: true } }), other = await prisma.client.create({ data: { name: `Other request QA ${kind}`, active: true } });
    const user = { id: client.id, clientId: client.id, role: 'CLIENT' }, token = sign(user), owner = `CLIENT:${client.id}`, storageKey = `${owner}:${kind}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.route('https://cdn.socket.io/**', route => route.abort());
    await context.addInitScript(({ user, token }) => {
      if (localStorage.getItem('cwPortalUIInitialized')) return;
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
      localStorage.setItem('cw_language', 'pt'); localStorage.setItem('cwPortalUIInitialized', 'true');
    }, { user, token });
    const page = await context.newPage(), errors = []; page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    const url = base + '/client-portal', postUrl = `${base}/api/client-portal/${client.id}/${visit ? 'visit-requests' : 'payment-notice'}`;
    const textInput = visit ? '#visitRequestInput' : '#paymentNoticeNote';
    const saved = () => page.evaluate(key => new Promise((resolve, reject) => { const open = indexedDB.open('cw-client-portal-requests-v1', 1); open.onerror = reject; open.onsuccess = () => { const db = open.result, read = db.transaction('pending').objectStore('pending').get(key); read.onsuccess = () => { resolve(read.result || null); db.close(); }; read.onerror = reject; }; }), storageKey);
    const idle = () => page.waitForFunction(prefix => document.getElementById(prefix + 'Recovery')?.getAttribute('aria-busy') === 'false', prefix);
    const ready = () => page.waitForFunction(prefix => document.getElementById(prefix + 'Btn')?.disabled === false, prefix);
    const count = () => prisma.clientMessage.count({ where: { clientId: client.id, messageType: kind } });
    async function fill(text) { await page.locator(textInput).fill(text); if (!visit) { await page.locator('#paymentNoticeAmount').fill('123.45'); await page.locator('#paymentNoticeMethod').selectOption('MBWay'); } }
    async function send() { await page.locator(`#${prefix}Btn`).click(); await idle(); }
    async function retry() { await page.locator(`#${prefix}Retry`).click(); await idle(); }
    await page.goto(url); await ready();
    await fill('Rascunho recuperável'); await page.reload(); await ready(); assert.equal(await page.locator(textInput).inputValue(), 'Rascunho recuperável');
    if (!visit) { assert.equal(await page.locator('#paymentNoticeAmount').inputValue(), '123.45'); assert.equal(await page.locator('#paymentNoticeMethod').inputValue(), 'MBWay'); }
    await fill(`Pedido ${kind} <b>literal</b>`);
    let reply, posts = 0; const entered = gate(), release = gate(), finished = gate();
    await page.route(postUrl, async route => { posts++; assert.equal(route.request().headers().authorization, `Bearer ${token}`); const response = await route.fetch(); reply = await response.json(); entered.release(); await release.promise; try { await route.fulfill({ status: 502, json: { ok: false } }); } finally { finished.release(); } });
    await page.locator(`#${prefix}Btn`).click(); await entered.promise;
    const tab = await context.newPage(); tab.on('pageerror', error => errors.push(error.message));
    try {
      await page.locator(`#${prefix}Btn`).dispatchEvent('click'); assert.equal(posts, 1); assert.equal(await count(), 1);
      await tab.goto(url); await tab.locator(`#${prefix}Retry`).waitFor({ state: 'visible' }); await tab.locator(`#${prefix}Btn`).dispatchEvent('click');
      await tab.waitForFunction(prefix => document.getElementById(prefix + 'Recovery').getAttribute('aria-busy') === 'false', prefix); assert.equal(await count(), 1);
    } finally { release.release(); }
    await finished.promise; await idle(); await page.unroute(postUrl);
    const pending = await saved(); assert.equal(pending.kind, kind); assert.equal(pending.clientId, client.id);
    await page.reload(); await page.locator(`#${prefix}Retry`).waitFor({ state: 'visible' }); assert.deepEqual(await saved(), pending);
    const badReplies = [[200, { ok: true }], [202, reply], [403, { ok: false }], [200, { ...reply, receipt: { ...reply.receipt, requestId: randomUUID() } }], [200, { ...reply, receipt: { ...reply.receipt, actorKey: 'CLIENT:999999' } }], [200, { ...reply, submission: { ...reply.submission, clientId: other.id } }], [200, { ...reply, message: { ...reply.message, text: 'Wrong text', message: 'Wrong text' } }]];
    for (const [status, json] of badReplies) { await page.route(postUrl, route => route.fulfill({ status, json })); await retry(); assert.deepEqual(await saved(), pending); assert.equal(await page.locator(`#${prefix}Status`).getAttribute('data-message'), '3'); await page.unroute(postUrl); }
    await page.route(postUrl, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{broken' })); await retry(); assert.deepEqual(await saved(), pending); await page.unroute(postUrl);
    // A failed refresh must preserve the successful acknowledgement.
    const readUrl = `${base}/api/client-portal/${client.id}/messages`;
    await page.route(readUrl, route => route.fulfill({ status: 503, json: { ok: false } }));
    await retry(); assert.equal(await saved(), null); assert.equal(await count(), 1); assert.equal(await page.locator(textInput).inputValue(), '');
    assert.equal(await page.locator(`#${prefix}Status`).getAttribute('data-message'), visit ? '1' : '2');
    await page.unroute(readUrl);
    await tab.waitForFunction(({ prefix, textInput }) => document.querySelector(textInput).value === '' && document.getElementById(prefix + 'Retry').hidden, { prefix, textInput });
    await tab.reload(); await tab.waitForFunction(prefix => !document.getElementById(prefix + 'Btn').disabled, prefix); assert.equal(await tab.locator(textInput).inputValue(), '', 'A different tab must not revive an acknowledged draft'); await tab.close();
    await page.evaluate(() => loadMessages()); assert.match(await page.locator('#chatBox').textContent(), /<b>literal<\/b>/); assert.equal(await page.locator(`[data-client-message-id="${reply.message.id}"] b`).count(), 1, 'Only the sender label is HTML, not user content');
    console.log(`PASS ${kind}: complete draft, exact recovery after lost/wrong/queued/malformed acknowledgements, two windows and independent failed refresh`);
    const labels = visit ? { pt: 'Solicitar visita', en: 'Request a visit', fr: 'Demander une visite', es: 'Solicitar visita', de: 'Besuch anfragen' } : { pt: 'Avisar pagamento', en: 'Payment notice', fr: 'Avis de paiement', es: 'Avisar del pago', de: 'Zahlung melden' };
    const success = visit ? { pt: 'Pedido de visita registado.', en: 'Visit request recorded.', fr: 'Demande de visite enregistrée.', es: 'Solicitud de visita registrada.', de: 'Besuchsanfrage gespeichert.' } : { pt: 'Aviso de pagamento registado.', en: 'Payment notice recorded.', fr: 'Avis de paiement enregistré.', es: 'Aviso de pago registrado.', de: 'Zahlungshinweis gespeichert.' };
    for (const language of ['en', 'fr', 'es', 'de', 'pt']) {
      await page.locator('#cwLanguageSelect').selectOption(language);
      assert.equal(await page.locator(`#${prefix}Btn`).textContent(), labels[language]);
      try { await page.waitForFunction(({ prefix, text }) => document.getElementById(prefix + 'Status').textContent.startsWith(text), { prefix, text: success[language] }); }
      catch (error) { console.error('Language failure', language, await page.evaluate(prefix => ({ current: portalLanguage, selected: document.getElementById('cwLanguageSelect')?.value, status: document.getElementById(prefix + 'Status').outerHTML, errors: document.querySelector('#portalActionStatus')?.textContent }), prefix)); throw error; }
    }
    await ready();
    await context.setOffline(true); await fill('Conservar sem rede'); await send(); assert.equal((await saved()).values[visit ? 'message' : 'note'], 'Conservar sem rede'); assert.equal(await count(), 1);
    await context.setOffline(false); await retry(); assert.equal(await saved(), null); assert.equal(await count(), 2);
    await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'pending') throw Error('QA quota'); return window.qaPut.apply(this, args); }; });
    await fill('Guardar antes de enviar'); await send(); assert.equal(await saved(), null); assert.equal(await count(), 2); assert.equal(await page.locator(textInput).inputValue(), 'Guardar antes de enviar');
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; });
    // If saving the acknowledgement fails, the original request remains recoverable.
    await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'confirmed') throw Error('QA acknowledgement quota'); return window.qaPut.apply(this, args); }; });
    await send(); assert.notEqual(await saved(), null); assert.equal(await count(), 3);
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; }); await retry(); assert.equal(await saved(), null); assert.equal(await count(), 3);
    const sessionEntered = gate(), sessionRelease = gate(), sessionFinished = gate();
    await page.route(postUrl, async route => { const response = await route.fetch(); sessionEntered.release(); await sessionRelease.promise; try { await route.fulfill({ response }); } catch (error) { if (!/closed|already handled/i.test(error.message)) throw error; } finally { sessionFinished.release(); } });
    await fill('Pedido privado da conta original'); await page.locator(`#${prefix}Btn`).click(); await sessionEntered.promise;
    const nextUser = { id: other.id, clientId: other.id, role: 'CLIENT' }, nextToken = sign(nextUser);
    try { await page.evaluate(({ user, token }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user: nextUser, token: nextToken }); } finally { sessionRelease.release(); }
    await sessionFinished.promise; await page.unroute(postUrl); await page.waitForFunction(prefix => document.getElementById(prefix + 'Status').dataset.message === '5', prefix);
    assert.equal(await page.locator(textInput).inputValue(), ''); assert.equal(await page.locator(`#${prefix}Pending`).isVisible(), false); assert.notEqual(await saved(), null);
    await page.reload(); await ready(); assert.equal(await page.locator(textInput).inputValue(), ''); assert.equal(await page.locator(`#${prefix}Retry`).isVisible(), false); assert(!(await page.locator('body').textContent()).includes('Pedido privado da conta original'));
    await page.evaluate(({ user, token }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user, token });
    await page.reload(); await page.locator(`#${prefix}Retry`).waitFor({ state: 'visible' }); const before = await count(); await retry(); assert.equal(await count(), before); assert.equal(await saved(), null);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const evidence = path.resolve('reports/field-visual/client-portal-requests'); fs.mkdirSync(evidence, { recursive: true });
    await page.locator(visit ? '#permissionsPanel' : '#paymentReferenceCard').screenshot({ path: path.join(evidence, `${prefix}-mobile.png`) });
    await page.setViewportSize({ width: 1440, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator(visit ? '#permissionsPanel' : '#paymentReferenceCard').screenshot({ path: path.join(evidence, `${prefix}-desktop.png`) });
    await context.setOffline(true); await fill('Pedido para preservar'); await send(); const original = await saved();
    await page.evaluate(key => new Promise(resolve => { const open = indexedDB.open('cw-client-portal-requests-v1', 1); open.onsuccess = () => { const db = open.result, tx = db.transaction('pending', 'readwrite'), store = tx.objectStore('pending'), request = store.get(key); request.onsuccess = () => store.put({ ...request.result, payloadHash: '0'.repeat(64) }, key); tx.oncomplete = () => { db.close(); resolve(); }; }; }), storageKey);
    await context.setOffline(false); await retry(); assert.equal(await count(), before); assert.equal((await saved()).requestId, original.requestId); assert.equal(await page.locator(`#${prefix}Status`).getAttribute('data-message'), '9');
    await page.reload(); await page.waitForFunction(prefix => document.getElementById(prefix + 'Status').dataset.message === '9', prefix); assert.equal(await page.locator(`#${prefix}Btn`).isDisabled(), true);
    assert.deepEqual(errors, []); console.log(`PASS ${kind}: five languages, offline, both storage failures, session change, original account recovery, corruption and mobile/desktop layouts`);
    await context.close();
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), client = await prisma.client.findFirstOrThrow({ where: { active: true } });
  const context = await browser.newContext(); await context.route('https://cdn.socket.io/**', route => route.abort());
  await context.addInitScript(({ user, token }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user: { id: admin.id, role: 'ADMIN' }, token: sign({ id: admin.id, role: 'ADMIN' }) });
  const page = await context.newPage(); let writes = 0; page.on('request', request => { if (request.method() === 'POST' && /visit-requests|payment-notice/.test(request.url())) writes++; });
  await page.goto(`${base}/client-portal?clientId=${client.id}`); await page.waitForFunction(() => loadedClientId === clientId && loadedClientId > 0);
  for (const prefix of ['visitRequest', 'paymentNotice']) { assert.equal(await page.locator(`#${prefix}Btn`).isDisabled(), true); await page.locator(`#${prefix}Btn`).dispatchEvent('click'); }
  await page.evaluate(() => Promise.all([requestVisit(), notifyPayment()])); assert.equal(writes, 0); await context.close();
  console.log('PASS administrator preview cannot submit either request, including direct handler calls');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
