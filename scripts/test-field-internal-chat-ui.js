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
  const tech = await prisma.technician.create({ data: { name: 'João <b>literal</b>', active: true } });
  const otherTech = await prisma.technician.create({ data: { name: 'Outra conta', active: true } });
  const leader = await prisma.technician.create({ data: { name: 'Chefe de equipa QA', active: true, role: 'TEAM_LEADER' } });
  const client = await prisma.client.create({ data: { name: 'Cliente privado QA', active: true } });
  const sign = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const user = { id: tech.id, role: 'TECHNICIAN', name: tech.name }, token = sign(user);
  const count = () => prisma.internalChatMessage.count({ where: { actorType: 'TECHNICIAN', actorId: tech.id } });
  const key = `cwStaffChat:v1:TECHNICIAN:${tech.id}`;
  const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
  const api = base + '/api/chat/internal', noticeApi = base + '/api/notifications';
  const marker = randomUUID();
  await prisma.internalChatMessage.create({ data: { messageId: 'legacy-ui-' + marker, legacyPayload: { id: 15, author: 'ADMIN', text: 'Registo antigo <script>bad()</script>', created_at: 'unknown' } } });
  await fetch(api, { method: 'POST', headers: { Authorization: 'Bearer ' + sign({ id: admin.id, role: 'ADMIN' }), 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Bom dia. Confirmem o acesso antes de iniciar a visita.', requestId: randomUUID() }) });
  await prisma.notification.create({ data: { role: 'TECHNICIAN', type: 'INFO', title: 'Aviso de serviço', message: 'Verificar material antes de sair.', severity: 'INFO', metadata: { technicianId: tech.id } } });
  browser = await chromium.launch({ headless: true, ...(process.env.CW_CHROMIUM_PATH ? { executablePath: process.env.CW_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', serviceWorkers: 'block' });
  await context.addInitScript(({ user, token }) => {
    if (sessionStorage.getItem('cwChatQAInitialized')) return;
    for (const key of ['cristalwater_jwt', 'token']) localStorage.setItem(key, token);
    for (const key of ['cristalwater_user', 'user']) localStorage.setItem(key, JSON.stringify(user));
    localStorage.setItem('cw_language', 'pt'); sessionStorage.setItem('cwChatQAInitialized', 'true');
  }, { user, token });
  const page = await context.newPage(), tab = await context.newPage(), errors = [];
  for (const p of [page, tab]) { p.setDefaultTimeout(8000); p.on('pageerror', e => errors.push(e.message)); }
  await page.goto(base + '/technician-chat'); await tab.goto(base + '/technician-chat');
  const ready = p => p.waitForFunction(() => document.querySelector('#chatReadStatus').textContent === 'Lista atualizada.');
  const idle = p => p.waitForFunction(() => document.querySelector('#chatForm').getAttribute('aria-busy') === 'false');
  await ready(page); await ready(tab);
  assert.match(await page.locator('#noticeList').textContent(), /Verificar material/);
  assert.match(await page.locator('#messageList').textContent(), /autor não confirmado/);
  assert.equal(await page.locator('#messageList script').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#chatText').fill('Rascunho conservado'); await page.reload(); await ready(page); assert.equal(await page.locator('#chatText').inputValue(), 'Rascunho conservado');
  await page.locator('#chatText').fill('Confirmei o acesso. Vou iniciar a visita.');
  await tab.locator('#chatText').fill('Outro rascunho nesta janela');
  const entered = gate(), release = gate(); let postBody, reply, posts = 0;
  await page.route(api, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++; postBody = route.request().postDataJSON(); const response = await route.fetch(); reply = await response.json(); entered.release(); await release.promise;
    await route.fulfill({ status: 502, json: { ok: false, error: 'QA response lost' } });
  });
  await page.locator('#chatSend').click(); await entered.promise;
  try {
    await page.locator('#chatForm').dispatchEvent('submit'); await tab.locator('#chatForm').dispatchEvent('submit');
    assert.equal(await count(), 1); assert.equal(posts, 1); assert.equal((await saved(page)).requestId, postBody.requestId);
    assert.equal(await page.locator('#chatText').isDisabled(), true);
  } finally { release.release(); }
  await idle(page); await page.unroute(api);
  assert.equal(await page.locator('#chatPending').isVisible(), true);
  const pending = await saved(page); await page.reload(); await ready(page); assert.deepEqual(await saved(page), pending);
  for (const fake of [{ ok: true }, { ...reply, message: { ...reply.message, requestId: randomUUID() } }, { ...reply, message: { ...reply.message, actorId: otherTech.id } }, { ...reply, message: { ...reply.message, text: 'Different text' } }]) {
    await page.route(api, route => route.request().method() === 'POST' ? route.fulfill({ status: 200, json: fake }) : route.continue());
    await page.locator('#chatRetry').click(); await idle(page); assert.deepEqual(await saved(page), pending); await page.unroute(api);
  }
  await page.route(api, route => route.request().method() === 'POST' ? route.fulfill({ status: 202, json: { ok: true, offline: true } }) : route.continue());
  await page.locator('#chatRetry').click(); await idle(page); assert.deepEqual(await saved(page), pending); await page.unroute(api);
  await page.locator('#chatRetry').click(); await idle(page); assert.equal(await saved(page), null); assert.equal(await count(), 1);
  assert.match(await page.locator('#chatWriteStatus').textContent(), /Mensagem guardada/);
  await ready(page); assert.match(await page.locator('#messageList').textContent(), /João <b>literal<\/b>/); assert.equal(await page.locator('#messageList b').count(), 0);
  assert.equal(await tab.locator('#chatText').inputValue(), 'Outro rascunho nesta janela');
  console.log('PASS mobile shared chat, historical attribution, escaped names/text, draft reload, two tabs, double clicks, lost/wrong/queued replies and exact replay');

  const before = await page.locator('#messageList').textContent(), beforeNotices = await page.locator('#noticeList').textContent();
  await page.route(api, route => route.fulfill({ status: 503, json: {} })); await page.route(noticeApi, route => route.fulfill({ status: 503, json: {} }));
  await page.locator('#refreshChat').click(); await page.waitForFunction(() => document.querySelector('#chatReadStatus').dataset.tone === 'error');
  assert.equal(await page.locator('#messageList').textContent(), before); assert.equal(await page.locator('#noticeList').textContent(), beforeNotices);
  await page.unroute(api); await page.unroute(noticeApi);
  await page.evaluate(() => {
    window.originalStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwStaffChat:')) throw Error('QA quota'); return window.originalStorageSet.call(this, key, value); };
  });
  await page.locator('#chatText').fill('Quota must send nothing'); await page.locator('#chatSend').click(); await idle(page); assert.equal(await count(), 1);
  assert.match(await page.locator('#chatWriteStatus').textContent(), /Nenhuma mensagem nova/);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageSet; });
  await context.setOffline(true); await page.locator('#chatText').fill('Sem rede, conservar texto'); await page.locator('#chatSend').click(); await idle(page);
  const offline = await saved(page); assert.equal(offline.text, 'Sem rede, conservar texto'); assert.equal(await count(), 1);
  await context.setOffline(false); await page.locator('#chatRetry').click(); await idle(page); assert.equal(await count(), 2); assert.equal(await saved(page), null);
  await page.evaluate(key => localStorage.setItem(key, '{corrupt'), key); await page.reload();
  await page.waitForFunction(() => document.querySelector('#chatSend').disabled); assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{corrupt'); assert.equal(await count(), 2);
  await page.evaluate(key => localStorage.removeItem(key), key); await page.reload(); await ready(page);
  console.log('PASS failures preserve the last lists; quota prevents transport; offline send remains pending; malformed local data is retained');

  const oldEntered = gate(), oldRelease = gate(), oldFinished = gate(); let firstRead = true;
  await page.route(api, async route => {
    if (route.request().method() === 'GET' && firstRead) { firstRead = false; const response = await route.fetch(); oldEntered.release(); await oldRelease.promise; try { await route.fulfill({ response }); } finally { oldFinished.release(); } return; }
    await route.continue();
  });
  await page.locator('#refreshChat').click(); await oldEntered.promise;
  try { await page.locator('#chatText').fill('Newer than retained read'); await page.locator('#chatSend').click(); await idle(page); await ready(page); }
  finally { oldRelease.release(); }
  await oldFinished.promise; await page.unroute(api); assert.match(await page.locator('#messageList').textContent(), /Newer than retained read/);
  const sessionEntered = gate(), sessionRelease = gate();
  await page.route(api, async route => { if (route.request().method() !== 'POST') return route.continue(); const response = await route.fetch(); sessionEntered.release(); await sessionRelease.promise; try { await route.fulfill({ response }); } catch (error) { if (!/already handled|closed/i.test(error.message)) throw error; } });
  await page.locator('#chatText').fill('Belongs to the original account'); await page.locator('#chatSend').click(); await sessionEntered.promise;
  try {
    await page.evaluate(({ user, token }) => { for (const key of ['cristalwater_jwt', 'token']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user: { id: otherTech.id, role: 'TECHNICIAN' }, token: sign({ id: otherTech.id, role: 'TECHNICIAN' }) });
  } finally { sessionRelease.release(); }
  await page.waitForFunction(() => document.querySelector('#staffChat').hidden); await page.unroute(api);
  assert.equal(await page.locator('#messageList').textContent(), ''); assert.notEqual(await saved(page), null);
  await page.reload(); await ready(page); assert.equal(await page.locator('#chatPending').isVisible(), false); assert.equal(await page.locator('#chatText').inputValue(), '');
  await page.evaluate(({ user, token }) => { for (const key of ['cristalwater_jwt', 'token']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user, token });
  await page.reload(); await ready(page); await page.locator('#chatRetry').click(); await idle(page); assert.equal(await saved(page), null); assert.equal(await count(), 4);
  for (const language of ['en', 'fr', 'es', 'de', 'pt']) {
    await page.evaluate(language => CristalI18n.applyLanguage(language), language);
    await page.waitForFunction(language => document.documentElement.lang === language, language);
    assert.equal(await page.locator('h1').textContent(), { pt: 'Conversa da equipa', en: 'Team conversation', fr: 'Conversation de l’équipe', es: 'Conversación del equipo', de: 'Teamgespräch' }[language]);
    assert.match(await page.locator('#messageList').textContent(), /Newer than retained read/);
  }
  console.log('PASS stale reads cannot remove a committed message; account changes hide data and preserve the original request; five UI languages keep message content literal');
  await page.setViewportSize({ width: 1440, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const evidence = path.resolve('reports/field-visual/internal-chat'); fs.mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  const contrast = await page.locator('#refreshChat').evaluate(element => {
    const style = getComputedStyle(element), luminance = value => { const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; };
    const a = luminance(style.color), b = luminance(style.backgroundColor); return (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
  });
  if (contrast < 4.5) console.log(await page.locator('#refreshChat').evaluate(element => { const style = getComputedStyle(element); return { color: style.color, background: style.backgroundColor, transition: style.transition, customText: style.getPropertyValue('--chat-text'), customCard: style.getPropertyValue('--chat-card') }; }));
  assert(contrast >= 4.5, 'Dark refresh control must remain legible');
  await page.evaluate(() => { const list = document.querySelector('#messageList'); list.scrollTop = list.scrollHeight; });
  await page.screenshot({ path: path.join(evidence, 'mobile-dark.png'), fullPage: true });
  await page.emulateMedia({ colorScheme: 'light' }); await page.screenshot({ path: path.join(evidence, 'mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const heading = await page.locator('h1').boundingBox(), selector = await page.locator('.cw-lang-switch').boundingBox();
  assert(selector.y + selector.height < heading.y, 'Language selector must not cover the mobile title');
  for (const identity of [{ id: admin.id, role: 'ADMIN' }, { id: leader.id, role: 'TEAM_LEADER' }, { id: client.id, role: 'CLIENT' }]) {
    await page.evaluate(({ user, token }) => { for (const key of ['cristalwater_jwt', 'token']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { user: identity, token: sign(identity) });
    await page.reload();
    if (identity.role === 'CLIENT') { await page.waitForFunction(() => !document.querySelector('#sessionStatus').hidden); assert.equal(await page.locator('#staffChat').isVisible(), false); }
    else { await page.waitForFunction(() => !document.querySelector('#staffChat').hidden); await page.locator('#chatText').fill('Role access ' + identity.role); await page.locator('#chatSend').click(); await idle(page); assert.equal(await page.locator('#chatPending').isVisible(), false); }
  }
  assert.deepEqual(errors, []);
  console.log('PASS desktop/mobile light and dark layouts; ADMIN/TEAM_LEADER use the shared screen and CLIENT cannot access it');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
