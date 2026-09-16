'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken');
const waitBrowserState = require('./fixtures/wait-browser-state');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tAAAAABJRU5ErkJggg==', 'base64');
let browser; const releases = [];
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Field UI owner', active: true } }), otherTech = await prisma.technician.create({ data: { name: 'Field UI other', active: true } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), otherToken = jwt.sign({ id: otherTech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'Field UI client', active: true } }), pool = await prisma.pool.create({ data: { name: 'Field UI pool', clientId: client.id, active: true } });
  const visits = []; for (let index = 0; index < 5; index++) visits.push(await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, plannedDate: new Date(), date: new Date(), status: 'PLANNED' } }));
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id, name }) => {
    if (!localStorage.getItem('qaFieldWriteSession')) { for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, name, role: 'TECHNICIAN' })); localStorage.setItem('qaFieldWriteSession', '1'); }
    const interval = window.setInterval; window.setInterval = (callback, delay, ...args) => delay === 15000 ? 0 : interval(callback, delay, ...args);
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
    window.qaMessages = []; window.alert = text => window.qaMessages.push(text);
  }, { token, id: tech.id, name: tech.name });
  const page = await context.newPage(), other = await context.newPage(), errors = []; for (const tab of [page, other]) { tab.setDefaultTimeout(10000); tab.on('pageerror', error => errors.push(error.message)); }
  const open = tab => tab.goto(base + '/technician.html', { waitUntil: 'networkidle' });
  const records = (tab, scope) => tab.evaluate(scope => CWFieldWriteStore.records(scope).then(rows => rows.map(({ file, attemptedAt, failure, ...row }) => ({ ...row, ...(file ? { bytes: file.size } : {}) }))), scope);
  const savePhoto = (tab, visitId, suffix = '') => tab.evaluate(async ({ visitId, base64, suffix }) => { const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0)); return (await saveOfflinePhoto({ visitId, type: 'AFTER', file: new File([bytes, suffix], 'camera.png', { type: 'image/png' }) })).requestId; }, { visitId, base64: png.toString('base64'), suffix });
  await open(page); await page.waitForSelector('[data-action="before"]');
  let attemptedUploads = 0; page.on('request', request => { if (request.url().endsWith('/photo') && request.method() === 'POST') ++attemptedUploads; });
  await page.evaluate(() => { window.qaOriginalAdd = IDBObjectStore.prototype.add; IDBObjectStore.prototype.add = function (row, ...args) { if (this.name === 'requests') throw new DOMException('QA quota before persistence', 'QuotaExceededError'); return qaOriginalAdd.call(this, row, ...args); }; });
  const [quotaChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="before"]').first().click()]); await quotaChooser.setFiles({ name: 'no-space.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => window.qaMessages.some(text => text.includes('não ficou guardada')));
  assert.equal((await records(page, 'VISIT_PHOTO')).length, 0); assert.equal(attemptedUploads, 0);
  await page.evaluate(() => { IDBObjectStore.prototype.add = qaOriginalAdd; delete window.qaOriginalAdd; window.qaMessages = []; });
  await context.setOffline(true);
  await page.waitForFunction(() => document.getElementById('offlineNetwork').textContent.includes('Offline'));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-action="before"]').first().click()]); await chooser.setFiles({ name: 'camera.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => window.qaMessages.some(text => text.includes('Fotografia guardada')));
  const original = await records(page, 'VISIT_PHOTO'); assert.equal(original.length, 1); assert.equal(original[0].bytes, png.length);
  for (const width of [320,390,1440]) { await page.setViewportSize({ width, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.CW_CAPTURE_UI) { require('node:fs').mkdirSync('reports/field-ui', { recursive: true }); await page.locator('#legacyFieldRecovery').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'reports/field-ui/LEGACY_WRITE_RECOVERY.png', fullPage: false }); }
  await context.route('**/api/visits/*/photo', route => route.fulfill({ status: 503, json: { error: 'QA offline recovery' } }));
  await context.setOffline(false); await open(page); assert.deepEqual(await records(page, 'VISIT_PHOTO'), original);
  const photoUrl = base + '/api/visits/' + original[0].resourceId + '/photo';
  for (const bad of [() => ({ status: 202, json: { ok: true } }), () => ({ status: 200, json: { ok: true, photo: { id: 1 } } }), data => ({ status: 200, json: { ...data, receipt: { ...data.receipt, owner: 'TECH:99999' } } }), data => ({ status: 200, json: { ...data, sha256: 'wrong' } })]) {
    await page.route(photoUrl, async route => { const response = await route.fetch(); await route.fulfill(bad(await response.json())); });
    await page.evaluate(id => CWFieldWriteStore.send(id).catch(error => error.message), original[0].requestId); await page.unroute(photoUrl);
    const rows = await records(page, 'VISIT_PHOTO'); assert.equal(rows.length, 1); assert.equal(rows[0].payloadHash, original[0].payloadHash); assert.equal(rows[0].bytes, png.length);
  }
  await context.unroute('**/api/visits/*/photo');
  await page.evaluate(() => { window.qaOriginalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (row, ...args) { if (this.name === 'requests' && row.response) throw new DOMException('QA quota while saving receipt', 'QuotaExceededError'); return qaOriginalPut.call(this, row, ...args); }; });
  assert.match(await page.evaluate(id => CWFieldWriteStore.send(id).catch(error => error.message), original[0].requestId), /quota/);
  assert.equal((await records(page, 'VISIT_PHOTO'))[0].bytes, png.length);
  assert.equal(await prisma.visitPhoto.count({ where: { visitId: original[0].resourceId } }), 1);
  await page.evaluate(() => { IDBObjectStore.prototype.put = qaOriginalPut; delete window.qaOriginalPut; });
  await page.locator('#legacyFieldRecovery button').first().click(); await waitBrowserState(page, () => CWFieldWriteStore.records('VISIT_PHOTO').then(rows => !rows.length)); assert.equal(await prisma.visitPhoto.count({ where: { visitId: original[0].resourceId } }), 1);
  console.log('PASS actual old photo button persists before send, reloads binary data and retains malformed/mismatched acknowledgements until explicit recovery');
  console.log('PASS real IndexedDB quota failures before persistence prevent network writes; receipt quota retains the original binary until recovery');

  const originalVisit = original[0].resourceId;
  await page.locator('#notes-' + originalVisit).fill('Conclusão pelo botão real');
  await context.setOffline(true); await page.locator('[data-action="complete"][data-visit-id="' + originalVisit + '"]').click();
  await waitBrowserState(page, () => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows.length === 1));
  assert.equal((await records(page, 'VISIT_COMPLETION'))[0].payload.notes, 'Conclusão pelo botão real');
  assert.notEqual((await prisma.serviceVisit.findUnique({ where: { id: originalVisit } })).status, 'DONE');
  await context.route('**/api/core/visits/*/complete', route => route.fulfill({ status: 503, json: { error: 'QA explicit recovery' } }));
  await context.setOffline(false); await open(page); assert.equal((await records(page, 'VISIT_COMPLETION')).length, 1);
  await context.unroute('**/api/core/visits/*/complete'); await page.locator('#legacyFieldRecovery button').first().click();
  await waitBrowserState(page, () => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows.length === 0));
  assert.equal((await prisma.serviceVisit.findUnique({ where: { id: originalVisit } })).notes, 'Conclusão pelo botão real');
  console.log('PASS actual completion form/button persists offline, survives reload and confirms the original fields through the recovery control');

  await open(other); const first = await savePhoto(page, visits[1].id); let enter, release; const entered = new Promise(resolve => { enter = resolve; }), gate = new Promise(resolve => { release = resolve; releases.push(resolve); });
  await page.route(base + '/api/visits/' + visits[1].id + '/photo', async route => { const response = await route.fetch(); enter(); await gate; await route.fulfill({ response }); });
  const sending = page.evaluate(id => CWFieldWriteStore.send(id), first); await entered; const second = await savePhoto(other, visits[1].id, 'new photo');
  assert.match(await other.evaluate(id => CWFieldWriteStore.send(id).catch(error => error.message), first), /outra janela/); assert.equal((await records(page, 'VISIT_PHOTO')).length, 2);
  release(); await sending; await page.unroute(base + '/api/visits/' + visits[1].id + '/photo'); assert.deepEqual((await records(page, 'VISIT_PHOTO')).map(row => row.requestId), [second]); await other.evaluate(id => CWFieldWriteStore.send(id), second); assert.equal(await prisma.visitPhoto.count({ where: { visitId: visits[1].id } }), 2);
  console.log('PASS two real tabs and a photo captured during an earlier send preserve both requests without overwriting the queue');

  await page.evaluate(ids => Promise.all(ids.map(id => addOfflineAction({ url: '/api/core/visits/' + id + '/complete', body: { visitId: id, notes: 'Offline completion' } }))), [visits[2].id, visits[3].id]);
  await page.route('**/api/core/visits/*/complete', route => route.abort('failed')); const result = await page.evaluate(() => syncOfflineQueue()); assert.equal(result.pending, 2); await page.unroute('**/api/core/visits/*/complete');
  assert.equal((await records(page, 'VISIT_COMPLETION')).length, 2);
  let body; const completionUrl = base + '/api/core/visits/' + visits[2].id + '/complete';
  await page.route(completionUrl, async route => { body = route.request().postDataJSON(); await route.fetch(); await route.fulfill({ status: 503, json: { error: 'QA lost reply' } }); });
  await page.evaluate(() => syncOfflineQueue()); await page.unroute(completionUrl); assert.equal((await records(page, 'VISIT_COMPLETION')).length, 2);
  await open(page); await page.route(completionUrl, async route => { assert.deepEqual(route.request().postDataJSON(), body); const response = await route.fetch(), data = await response.json(); await route.fulfill({ status: 200, json: { ...data, visit: { ...data.visit, id: visits[4].id } } }); });
  await page.evaluate(() => syncOfflineQueue()); assert.equal((await records(page, 'VISIT_COMPLETION')).length, 2); await page.unroute(completionUrl); const confirmed = await page.evaluate(() => syncOfflineQueue()); assert.equal(confirmed.pending, 0);
  for (const visit of visits.slice(2, 4)) assert.equal(await prisma.auditTrail.count({ where: { visitId: visit.id, eventType: 'VISIT_COMPLETED' } }), 1);
  console.log('PASS first completion network failure retains later items; lost reply/reload and wrong visit confirmation retain original requests, with no duplicate effects');

  const late = await savePhoto(page, visits[4].id); let enterLate, releaseLate; const started = new Promise(resolve => { enterLate = resolve; }), lateGate = new Promise(resolve => { releaseLate = resolve; releases.push(resolve); });
  const lateUrl = base + '/api/visits/' + visits[4].id + '/photo'; await page.route(lateUrl, async route => { const response = await route.fetch(); enterLate(); await lateGate; await route.fulfill({ response }).catch(() => {}); });
  const sendingLate = page.evaluate(id => CWFieldWriteStore.send(id).catch(error => error.message), late); await started;
  const change = (credential, technician) => page.evaluate(({ credential, technician }) => { for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, credential); for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: technician.id, name: technician.name, role: 'TECHNICIAN' })); }, { credential, technician });
  await change(otherToken, otherTech); releaseLate(); await sendingLate; await page.unroute(lateUrl); assert.equal((await records(page, 'VISIT_PHOTO')).length, 0);
  await change(token, tech); await open(page); assert.equal((await records(page, 'VISIT_PHOTO')).length, 1); await page.evaluate(id => CWFieldWriteStore.send(id), late); assert.equal(await prisma.visitPhoto.count({ where: { visitId: visits[4].id } }), 1);
  console.log('PASS a late response cannot confirm for another account; the original account recovers its same photo');

  await page.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' });
  await page.locator('[data-field-tab-button="agora"]').click();
  const [lateChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-photo-type="BEFORE"]').click()]);
  await change(otherToken, otherTech); await lateChooser.setFiles({ name: 'late-camera.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => document.getElementById('photoFeedback').textContent.includes('sessão mudou'));
  assert.equal((await records(page, 'VISIT_PHOTO')).length, 0);
  await change(token, tech); assert.equal((await records(page, 'VISIT_PHOTO')).length, 0);
  await open(page);
  console.log('PASS real modern camera chooser rejects files selected after account change, without assigning them to either account');

  await page.evaluate(() => { localStorage.setItem('cristalwater_offline_queue', '[{"body":{"visitId":999999}}]'); localStorage.setItem('cristalwater_offline_photos', '[{"base64":"historic"}]'); }); await open(page);
  await page.waitForFunction(() => document.getElementById('legacyFieldRecovery').textContent.includes('sem conta confirmada'));
  assert.equal(await page.evaluate(() => localStorage.getItem('cristalwater_offline_photos')), '[{"base64":"historic"}]');
  const corrupt = await savePhoto(page, visits[4].id, 'corrupt'); await page.evaluate(id => new Promise((resolve, reject) => { const open = indexedDB.open('cw-field-writes', 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction('requests', 'readwrite'), store = tx.objectStore('requests'), get = store.get(CWFieldWriteStore.session().owner + ':' + id); get.onsuccess = () => store.put({ ...get.result, payloadHash: 'wrong' }); tx.oncomplete = () => { db.close(); resolve(); }; }; }), corrupt);
  await open(page); await page.waitForFunction(() => document.getElementById('legacyFieldRecovery').textContent.includes('inválido')); assert.deepEqual(errors, []);
  console.log('PASS unattributed old queues and corrupt new records remain intact; the real page remains usable and never claims full synchronization');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const release of releases) release(); await browser?.close(); await prisma.$disconnect(); });
