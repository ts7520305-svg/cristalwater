'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret'), wait = require('./fixtures/wait-browser-state');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
let browser; const releases = [];
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Internal alert UI owner', active: true } }), otherTech = await prisma.technician.create({ data: { name: 'Internal alert UI other', active: true } });
  const client = await prisma.client.create({ data: { name: 'Internal alert UI client', active: true } }), pool = await prisma.pool.create({ data: { name: 'Internal alert UI pool', clientId: client.id, active: true } });
  const visit = await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, technicianId: tech.id, date: new Date(), plannedDate: new Date(), status: 'PLANNED' } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), otherToken = jwt.sign({ id: otherTech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, tech, origin }) => {
    if (location.origin !== origin || top !== window) return;
    if (!localStorage.getItem('qaInternalAlertSession')) { for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' })); localStorage.setItem('qaInternalAlertSession','1'); }
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
    window.alert = message => { window.qaAlertMessage = message; };
  }, { token, tech, origin: new URL(base).origin });
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  const open = () => page.goto(base + '/technician.html', { waitUntil: 'networkidle' });
  const records = () => page.evaluate(() => CWFieldWriteStore.records('TECHNICIAN_ALERT'));
  const status = () => page.locator('#internalAlertStatus').textContent();
  let requests = 0; page.on('request', request => { if (request.url().endsWith('/api/visits/internal-alert')) requests++; });
  await open(); await page.waitForFunction(() => !document.getElementById('internalAlert').readOnly);
  await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwFieldInternalAlertDraft:')) throw new DOMException('QA draft quota', 'QuotaExceededError'); return qaSetItem.call(this, key, value); }; });
  await page.locator('#internalAlert').fill('Rascunho sem espaço'); await page.locator('#sendAlertBtn').click(); assert.equal(requests, 0); assert.equal(await page.locator('#internalAlert').inputValue(), 'Rascunho sem espaço'); assert.match(await status(), /não foi enviado/);
  await page.evaluate(() => { Storage.prototype.setItem = qaSetItem; delete window.qaSetItem; });
  const message = 'Avaria para o escritório <img src=x onerror=window.qaExecuted=true>';
  await page.locator('#internalAlert').fill(message); await page.locator('#internalAlertVisit').selectOption(String(visit.id)); await page.locator('#internalAlertPriority').selectOption('HIGH');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true); await page.locator('#sendAlertBtn').click(); await wait(page, () => CWFieldWriteStore.records('TECHNICIAN_ALERT').then(rows => rows.length === 1));
  const original = (await records())[0]; assert.equal(original.payload.message, message); assert.equal(original.payload.visitId, visit.id); assert.equal(original.payload.priority, 'HIGH');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.getElementById('sendAlertBtn')?.textContent.includes('Confirmar alerta'));
  await page.waitForFunction(() => getComputedStyle(document.getElementById('splashScreen')).opacity === '0');
  await page.waitForFunction(() => document.getElementById('splashLogo').naturalWidth > 0);
  assert.equal(await page.locator('#internalAlert').inputValue(), message); assert.equal(await page.locator('#internalAlert').getAttribute('readonly'), ''); assert.equal((await records())[0].requestId, original.requestId);
  for (const width of [320,390,1440]) { await page.setViewportSize({ width, height: 900 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#internalAlertStatus').evaluate(node => node.scrollIntoView({ block: 'center' }));
  assert(await page.locator('#internalAlertStatus').evaluate(node => { const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.left + 8, box.top + 8)); }), 'Recovery status covered by fixed navigation');
  if (process.env.CW_CAPTURE_UI) { require('node:fs').mkdirSync('reports/field-ui', { recursive: true }); await page.locator('#sendAlertBtn').scrollIntoViewIfNeeded(); await page.locator('.card').filter({ has: page.locator('#internalAlert') }).screenshot({ path: 'reports/field-ui/INTERNAL_ALERT_RECOVERY.png' }); }
  console.log('PASS actual alert form: draft quota prevents sending; offline request and exact fields survive a real offline reload at three widths');

  const endpoint = base + '/api/visits/internal-alert'; let bodies = [];
  await page.route(endpoint, async route => { bodies.push(route.request().postDataJSON()); const response = await route.fetch(), data = await response.json(); await route.fulfill({ status: 200, json: { ...data, alert: { ...data.alert, recipientRole: 'CLIENT' } } }); });
  await context.setOffline(false); await page.locator('#sendAlertBtn').click(); await page.waitForFunction(() => document.getElementById('internalAlertStatus').textContent.includes('não corresponde'));
  assert.equal(await page.locator('#internalAlert').inputValue(), message); assert.equal((await records())[0].requestId, original.requestId); await page.unroute(endpoint);
  const where = { eventType: 'TECHNICIAN_INTERNAL_ALERT', metadata: { path: ['requestId'], equals: original.requestId } };
  assert.equal(await prisma.notification.count({ where }), 1);
  await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (row, ...args) { if (this.name === 'requests' && row.scope === 'TECHNICIAN_ALERT' && row.response) throw new DOMException('QA receipt quota', 'QuotaExceededError'); return qaPut.call(this, row, ...args); }; });
  await page.locator('#sendAlertBtn').click(); await page.waitForFunction(() => document.getElementById('internalAlertStatus').textContent.includes('receipt quota')); assert.equal((await records()).length, 1); assert.equal(await page.locator('#internalAlert').inputValue(), message);
  await page.evaluate(() => { IDBObjectStore.prototype.put = qaPut; delete window.qaPut; window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function (key, raw) { if (key.startsWith('cwFieldInternalAlertDraft:') && JSON.parse(raw).message === '') throw new DOMException('QA confirmed draft quota', 'QuotaExceededError'); return qaSetItem.call(this, key, raw); }; });
  await page.locator('#sendAlertBtn').click(); await page.waitForFunction(() => document.getElementById('sendAlertBtn').textContent === 'Limpar rascunho confirmado');
  assert.equal((await records()).length, 0); assert.equal(await page.locator('#internalAlert').inputValue(), message);
  const beforeClear = requests; await page.evaluate(() => { Storage.prototype.setItem = qaSetItem; delete window.qaSetItem; }); await page.locator('#sendAlertBtn').click();
  await page.waitForFunction(() => document.getElementById('internalAlert').value === '' && !document.getElementById('internalAlert').readOnly);
  assert.equal(requests, beforeClear); assert.equal(await prisma.notification.count({ where }), 1); assert.match(await status(), /leitura ainda não está confirmada/);
  assert.equal(bodies[0].requestId, original.requestId); assert.deepEqual({ message: bodies[0].message, visitId: bodies[0].visitId, priority: bodies[0].priority }, original.payload);
  console.log('PASS wrong recipient acknowledgement and two storage-failure boundaries preserve the original text; confirmed draft clears without a second alert');

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), adminToken = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await adminContext.addInitScript(({ token, user, origin }) => { if (location.origin !== origin || top !== window) return; for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { token: adminToken, user: { id: admin.id, role: 'ADMIN' }, origin: new URL(base).origin });
  const adminPage = await adminContext.newPage(); await adminPage.goto(base + '/admin-alerts', { waitUntil: 'networkidle' });
  const card = adminPage.locator('#alertsList article').filter({ has: adminPage.getByText(message, { exact: true }) });
  assert.equal(await card.count(), 1); assert.match(await card.textContent(), new RegExp(tech.name)); assert.equal(await adminPage.locator('img[onerror]').count(), 0); assert.equal(await adminPage.evaluate(() => window.qaExecuted), undefined); await adminContext.close();
  console.log('PASS real ADMIN panel receives one alert with the authenticated author and treats submitted markup as text');

  await page.locator('#internalAlert').fill('Alerta com resposta tardia');
  let entered, release; const started = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; releases.push(resolve); });
  await page.route(endpoint, async route => { const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }).catch(() => {}); });
  await page.locator('#sendAlertBtn').click(); await started;
  const late = (await records())[0];
  const change = (token, person) => page.evaluate(({ token, person }) => { for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: person.id, name: person.name, role: 'TECHNICIAN' })); }, { token, person });
  await change(otherToken, otherTech); release(); await page.unroute(endpoint); await page.waitForFunction(() => document.getElementById('internalAlert').value === ''); assert.equal((await records()).length, 0);
  await change(token, tech); await open(); await page.waitForFunction(() => document.getElementById('sendAlertBtn').textContent.includes('Confirmar alerta')); assert.equal((await records())[0].requestId, late.requestId);
  await page.locator('#sendAlertBtn').click(); await wait(page, () => CWFieldWriteStore.records('TECHNICIAN_ALERT').then(rows => !rows.length));
  assert.equal(await prisma.notification.count({ where: { metadata: { path: ['requestId'], equals: late.requestId } } }), 1);
  console.log('PASS late account change cannot clear or confirm another account; original owner recovers the same alert once');

  await page.waitForFunction(() => !document.getElementById('internalAlert').readOnly);
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await page.waitForFunction(() => !document.getElementById('internalAlert').readOnly && !document.getElementById('sendAlertBtn').disabled);
  const secondPage = await context.newPage(); await secondPage.goto(base + '/technician.html', { waitUntil: 'networkidle' }); await secondPage.waitForFunction(() => !document.getElementById('internalAlert').readOnly);
  await page.locator('#internalAlert').fill('Rascunho preservado entre janelas'); await secondPage.waitForFunction(() => document.getElementById('sendAlertBtn').disabled); assert.match(await secondPage.locator('#internalAlertStatus').textContent(), /noutra janela/); await secondPage.close();
  const key = 'cwFieldInternalAlertDraft:TECH:' + tech.id; await page.evaluate(key => localStorage.setItem(key, '{interrupted'), key); await open();
  await page.waitForFunction(() => document.getElementById('internalAlertStatus').textContent.includes('JSON') || document.getElementById('internalAlertStatus').textContent.includes('ilegível'));
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{interrupted'); assert(await page.locator('#sendAlertBtn').isDisabled()); assert.deepEqual(errors, []);
  console.log('PASS cross-tab draft conflict and corrupt draft are preserved without false confirmation or replacement');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const release of releases) release(); await browser?.close(); await prisma.$disconnect(); });
