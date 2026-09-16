'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { chromium } = require('playwright');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const gate = () => { let resolve; return { promise: new Promise(r => { resolve = r; }), release: () => resolve() }; };
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const otherAdmin = await prisma.user.create({ data: { name: 'Other chat admin QA', email: `${randomUUID()}@chat-ui.test`, password: admin.password, role: 'ADMIN', active: true, mustChangePassword: false } });
  const sign = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const mode of ['legacy', 'portal', 'admin']) {
    const client = await prisma.client.create({ data: { name: `Conversa QA ${mode}`, active: true } }), other = await prisma.client.create({ data: { name: `Outra conversa QA ${mode}`, active: true } });
    const user = mode === 'admin' ? { id: admin.id, role: 'ADMIN' } : { id: client.id, clientId: client.id, role: 'CLIENT' }, token = sign(user);
    const owner = mode === 'admin' ? `USER:${admin.id}` : `CLIENT:${client.id}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.route('https://cdn.socket.io/**', route => route.abort());
    await context.addInitScript(({ user, token }) => {
      if (localStorage.getItem('cwChatUIInitialized')) return;
      for (const k of ['token', 'cristalwater_jwt']) localStorage.setItem(k, token);
      for (const k of ['user', 'cristalwater_user']) localStorage.setItem(k, JSON.stringify(user));
      localStorage.setItem('cw_language', 'pt'); localStorage.setItem('cwChatUIInitialized', 'true');
    }, { user, token });
    const page = await context.newPage(), errors = []; page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
    const url = mode === 'legacy' ? '/client_chat' : mode === 'portal' ? '/client-portal' : `/chat?clientId=${client.id}`;
    const input = mode === 'portal' ? '#messageInput' : '#text', list = mode === 'portal' ? '#chatBox' : '#messages';
    const saved = () => page.evaluate(owner => new Promise((resolve, reject) => { const open = indexedDB.open('cw-client-chat-v1', 1); open.onerror = reject; open.onsuccess = () => { const db = open.result, read = db.transaction('pending').objectStore('pending').get(owner); read.onsuccess = () => { const p = read.result; resolve(p ? { owner: p.owner, clientId: p.clientId, requestId: p.requestId, kind: p.kind, text: p.text, name: p.name, size: p.blob?.size, payloadHash: p.payloadHash } : null); db.close(); }; read.onerror = reject; }; }), owner);
    const idle = () => page.waitForFunction(() => document.querySelector('.cw-client-chat-recovery')?.getAttribute('aria-busy') === 'false');
    const ready = () => page.waitForFunction(() => !document.querySelector('#sendBtn')?.disabled);
    const count = () => prisma.clientMessage.count({ where: { clientId: client.id } });
    await page.goto(base + url); await ready();
    await page.locator(input).fill('Rascunho recuperável'); await page.reload(); await ready(); assert.equal(await page.locator(input).inputValue(), 'Rascunho recuperável');
    await page.locator(input).fill(`Mensagem ${mode} <b>literal</b>`);
    const entered = gate(), release = gate(), finished = gate(); let reply, posts = 0;
    const postUrl = base + '/api/client-messages';
    await page.route(postUrl, async route => { posts++; const response = await route.fetch(); reply = await response.json(); entered.release(); await release.promise; try { await route.fulfill({ status: 502, json: { ok: false } }); } finally { finished.release(); } });
    await page.locator('#sendBtn').click(); await entered.promise;
    let tab;
    try {
      await page.locator('#sendBtn').dispatchEvent('click'); assert.equal(posts, 1); assert.equal(await count(), 1);
      if (mode === 'legacy') { tab = await context.newPage(); await tab.goto(base + url); await tab.waitForFunction(() => !document.querySelector('#clientChatPending')?.hidden); await tab.locator('#sendBtn').dispatchEvent('click'); assert.equal(await count(), 1); }
    } finally { release.release(); }
    await finished.promise; await idle(); await page.unroute(postUrl);
    const pending = await saved(); assert.equal(pending.kind, 'TEXT'); assert.equal(pending.clientId, client.id);
    await page.reload(); await page.locator('#clientChatRetry').waitFor({ state: 'visible' }); assert.deepEqual(await saved(), pending);
    for (const [status, body] of [[200, { ok: true }], [202, reply], [200, { ...reply, receipt: { ...reply.receipt, requestId: randomUUID() } }], [200, { ...reply, receipt: { ...reply.receipt, actorKey: 'CLIENT:999999' } }], [200, { ...reply, message: { ...reply.message, text: 'Different text' } }]]) {
      await page.route(postUrl, route => route.fulfill({ status, json: body })); await page.locator('#clientChatRetry').click(); await idle(); assert.deepEqual(await saved(), pending); await page.unroute(postUrl);
    }
    await page.locator('#clientChatRetry').click(); await idle(); assert.equal(await saved(), null); assert.equal(await count(), 1); assert.equal(await page.locator(input).inputValue(), '');
    assert.match(await page.locator(list).textContent(), /<b>literal<\/b>/); assert.equal(await page.locator(`${list} b`).count(), mode === 'portal' ? 1 : 0);
    if (tab) await tab.close();
    console.log(`PASS ${mode}: draft, immutable pending send, double click, lost/wrong/queued acknowledgements, reload and exact retry`);
    if (mode !== 'legacy') {
      const uploadUrl = base + '/api/client-messages/upload';
      await page.route(uploadUrl, async route => { await route.fetch(); await route.fulfill({ status: 502, json: { ok: false } }); });
      await page.locator(mode === 'portal' ? '#photoInput' : '#fileInput').setInputFiles({ name: 'Análise ç.pdf', mimeType: 'application/pdf', buffer: Buffer.from('Recover exact attachment bytes') });
      await page.waitForFunction(() => document.querySelector('#clientChatSendStatus')?.dataset.message === '2'); await idle(); await page.unroute(uploadUrl);
      const filePending = await saved(); assert.equal(filePending.kind, 'FILE'); assert.equal(filePending.name, 'Análise ç.pdf');
      await page.reload(); await page.locator('#clientChatRetry').waitFor({ state: 'visible' }); assert.deepEqual(await saved(), filePending);
      await page.locator('#clientChatRetry').click(); await idle(); assert.equal(await saved(), null); assert.equal(await count(), 2);
      const row = await prisma.clientMessage.findFirstOrThrow({ where: { clientId: client.id, requestId: filePending.requestId } }); assert.equal(row.fileName, filePending.name);
      const bytes = await fetch(base + `/api/client-messages/attachments/${row.id}`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(await bytes.text(), 'Recover exact attachment bytes');
      console.log(`PASS ${mode}: complete file survives reload and lost response, unicode filename, exact original download and no duplicate`);
    }
    const baseline = await count(); await context.setOffline(true); await page.locator(input).fill('Conservada sem rede'); await page.locator('#sendBtn').click(); await idle(); assert.equal((await saved()).text, 'Conservada sem rede'); assert.equal(await count(), baseline);
    await context.setOffline(false); await page.locator('#clientChatRetry').click(); await idle(); assert.equal(await saved(), null); assert.equal(await count(), baseline + 1);
    await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === 'pending') throw Error('QA quota'); return window.qaPut.apply(this, args); }; });
    await page.locator(input).fill('Guardar antes de enviar'); await page.locator('#sendBtn').click(); await idle(); assert.equal(await saved(), null); assert.equal(await count(), baseline + 1); assert.equal(await page.locator(input).inputValue(), 'Guardar antes de enviar');
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; });
    const readUrl = base + (mode === 'portal' ? `/api/client-portal/${client.id}/messages` : `/api/chat/client/${client.id}`);
    const refresh = () => mode === 'admin' ? page.locator(`.client-item[data-client-id="${client.id}"]`).click() : page.evaluate(mode => mode === 'portal' ? loadMessages() : load(), mode);
    const lastList = await page.locator(list).textContent(); await page.route(readUrl, route => route.fulfill({ status: 503, json: { ok: false } })); await refresh(); await page.waitForFunction(() => document.querySelector('#clientChatSendStatus')?.dataset.message === '11'); assert.equal(await page.locator(list).textContent(), lastList); await page.unroute(readUrl);
    const oldEntered = gate(), oldRelease = gate(), oldFinished = gate(); let firstRead = true;
    await page.route(readUrl, async route => { if (!firstRead) return route.continue(); firstRead = false; const response = await route.fetch(); oldEntered.release(); await oldRelease.promise; try { await route.fulfill({ response }); } finally { oldFinished.release(); } });
    const readPromise = refresh(); await oldEntered.promise;
    try { await page.locator(input).fill('Mais recente que a consulta antiga'); await page.locator('#sendBtn').click(); await idle(); }
    finally { oldRelease.release(); }
    await oldFinished.promise; await readPromise; await page.unroute(readUrl); assert.match(await page.locator(list).textContent(), /Mais recente que a consulta antiga/);
    if (mode === 'admin') {
      await page.locator(input).fill('Rascunho apenas deste cliente'); await page.locator(`.client-item[data-client-id="${other.id}"]`).click(); await ready(); assert.equal(await page.locator(input).inputValue(), '');
      await page.locator(input).fill('Rascunho da outra conversa'); await page.locator(`.client-item[data-client-id="${client.id}"]`).click(); await ready(); assert.equal(await page.locator(input).inputValue(), 'Rascunho apenas deste cliente');
    }
    const sessionEntered = gate(), sessionRelease = gate(), sessionFinished = gate();
    await page.route(postUrl, async route => { const response = await route.fetch(); sessionEntered.release(); await sessionRelease.promise; try { await route.fulfill({ response }); } catch (error) { if (!/closed|already handled/i.test(error.message)) throw error; } finally { sessionFinished.release(); } });
    await page.locator(input).fill('Envio da conta original'); await page.locator('#sendBtn').click(); await sessionEntered.promise;
    const nextUser = mode === 'admin' ? { id: otherAdmin.id, role: 'ADMIN' } : { id: other.id, clientId: other.id, role: 'CLIENT' };
    try { await page.evaluate(({ user, token }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user: nextUser, token: sign(nextUser) }); }
    finally { sessionRelease.release(); }
    await sessionFinished.promise; await page.unroute(postUrl); await page.waitForFunction(() => document.querySelector('#clientChatSendStatus')?.dataset.message === '4'); assert.equal(await page.locator(list).textContent(), ''); assert.notEqual(await saved(), null);
    if (mode === 'legacy') { await page.reload(); await ready(); assert.equal(await page.locator('#clientChatRetry').isVisible(), false); assert.equal(await page.locator(input).inputValue(), ''); assert(!String(await page.locator(list).textContent()).includes('Envio da conta original')); }
    await page.evaluate(({ user, token }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user, token });
    await page.reload(); await page.locator('#clientChatRetry').waitFor({ state: 'visible' }); const beforeRetry = await count(); await page.locator('#clientChatRetry').click(); await idle(); assert.equal(await count(), beforeRetry); assert.equal(await saved(), null);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${mode} mobile overflow`);
    if (mode === 'admin') { assert.equal(await page.locator('.cw-v2-shell-sidebar').isVisible(), false); assert((await page.locator('.cw-v2-shell-topbar').boundingBox()).y < 2); }
    const evidence = path.resolve('reports/field-visual/client-chat-recovery'); fs.mkdirSync(evidence, { recursive: true }); await page.evaluate(() => window.scrollTo(0,0)); await page.screenshot({ path: path.join(evidence, `${mode}-mobile.png`), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.evaluate(() => window.scrollTo(0,0));
    if (mode === 'admin') { const button = await page.locator('#sendBtn').boundingBox(); assert(button && button.x >= 280 && button.y + button.height <= 1000, 'Desktop composer must remain visible beside navigation'); }
    await page.screenshot({ path: path.join(evidence, `${mode}-desktop.png`), fullPage: true });
    if (mode === 'legacy') {
      for (const language of ['en','fr','es','de','pt']) {
        await page.evaluate(language => { localStorage.setItem('cw_language',language); document.documentElement.lang = language; }, language);
        const expected = { en:'Message saved in the conversation.', fr:'Message enregistré dans la conversation.', es:'Mensaje guardado en la conversación.', de:'Nachricht im Gespräch gespeichert.', pt:'Mensagem guardada na conversa.' }[language];
        await page.waitForFunction(expected => document.querySelector('#clientChatSendStatus').textContent === expected, expected);
      }
      await context.setOffline(true); await page.locator(input).fill('Conservar pedido corrompido'); await page.locator('#sendBtn').click(); await idle();
      const original = await saved();
      await page.evaluate(owner => new Promise(resolve => { const open = indexedDB.open('cw-client-chat-v1',1); open.onsuccess = () => { const db = open.result, tx = db.transaction('pending','readwrite'), store = tx.objectStore('pending'), request = store.get(owner); request.onsuccess = () => store.put({...request.result,text:'Alterado depois de guardado'},owner); tx.oncomplete = () => { db.close(); resolve(); }; }; }),owner);
      await context.setOffline(false); const beforeCorrupt = await count(); await page.locator('#clientChatRetry').click(); await idle(); assert.equal(await count(), beforeCorrupt); assert.equal((await saved()).requestId, original.requestId); assert.equal(await page.locator('#clientChatSendStatus').getAttribute('data-message'), '9');
    }
    if (mode === 'portal') { await page.setViewportSize({width:390,height:844}); await page.locator('#mensagens').screenshot({path:path.join(evidence,'portal-messages-mobile.png')}); }
    if (mode === 'admin') { const before = await count(); await page.goto(base + '/client_chat'); await page.waitForURL(base + '/chat'); assert.equal(await page.evaluate(() => localStorage.getItem('cristalwater_jwt')),token); assert.equal(await count(),before); }
    assert.deepEqual(errors, []); console.log(`PASS ${mode}: offline, quota, failed/stale reads, account change and original recovery; mobile/desktop`);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
