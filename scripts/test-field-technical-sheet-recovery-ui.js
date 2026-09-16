'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { prisma } = require('../src/prismaClient'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{"language":"pt"}' });
  const client = await prisma.client.create({ data: { name: 'Pago', password: 'Do not retain this sheet password', pin: 'Do not retain this sheet PIN' } }), pools = [];
  for (let i = 0; i < 11; i++) pools.push(await prisma.pool.create({ data: { name: `Sheet ${i} <b>literal</b>`, clientId: client.id, type: 'POOL', zone: 'Urgente', monthlyAmount: 95.5, volumeM3: 48,
    technicalSheet: { create: { volumeM3: 48, disinfectionType: 'SAL', specialObservations: 'Retain treatment details' } },
    calculationProfile: { create: { lengthM: 8, widthM: 4, depthMinM: 1, depthMaxM: 2, averageDepthM: 1.5, volumeM3: 48 } }, equipment: { create: { pumpType: 'Existing pump' } } } }));
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => { if (!localStorage.getItem('cwQASheetSession')) { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); localStorage.setItem('cwQASheetSession', '1'); } }, { token, id: admin.id });
  const page = await context.newPage(), other = await context.newPage(), errors = [];
  for (const tab of [page, other]) { tab.setDefaultTimeout(7000); tab.on('pageerror', error => errors.push(error.message)); }
  const evidence = path.join(process.cwd(), 'reports/field-visual/technical-sheet'); fs.mkdirSync(evidence, { recursive: true });
  const endpoint = id => `${base}/api/core/pools/${id}/technical-sheet`, url = id => `${base}/admin-pool-technical?poolId=${id}`;
  const intercept = (tab, id, handler) => tab.route(endpoint(id), route => route.request().method() === 'PUT' ? handler(route) : route.continue());
  const idle = tab => tab.waitForFunction(() => document.getElementById('sheetForm')?.getAttribute('aria-busy') === 'false');
  const open = async (tab, id) => { await tab.goto(url(id), { waitUntil: 'networkidle' }); await idle(tab); };
  const submit = async tab => { await tab.locator('#sheetForm button[type="submit"]').click(); await idle(tab); }, retry = async tab => { await tab.locator('#sheetEditRetry').click(); await idle(tab); };
  const row = id => prisma.pool.findUniqueOrThrow({ where: { id }, include: { technicalSheet: true, calculationProfile: true, equipment: true, technicalRoom: true } });
  const count = (id, type = 'TECHNICAL_SHEET_CHANGE') => prisma.technicalHistory.count({ where: { poolId: id, type } });
  const stored = (tab, id) => tab.evaluate(({ id, owner }) => new Promise((resolve, reject) => { const request = indexedDB.open('cw-technical-sheet-edits-v1', 1); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result, tx = db.transaction('edits'), read = tx.objectStore('edits').get(`${owner}:${id}`); tx.oncomplete = () => { resolve(read.result || null); db.close(); }; }; }), { id, owner: 'USER:' + admin.id });
  const legacy = async (id, data) => { const response = await fetch(endpoint(id), { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); assert.equal(response.status, 200); return response.json(); };
  const first = pools[0]; await open(page, first.id); assert.equal(await page.locator('.cw-v2-sidebar').isVisible(), false); await page.screenshot({ path: path.join(evidence, 'page-pt-390.png') }); assert.equal(await page.locator('#name').inputValue(), first.name); let sent;
  await intercept(page, first.id, async route => { sent = route.request().postDataJSON(); await route.continue(); });
  await page.locator('#lengthM').fill('10'); assert.equal(await page.locator('#volumeM3').inputValue(), '60'); await page.locator('#historyNote').fill('Uma nota <img src=x>'); await submit(page); await page.unroute(endpoint(first.id));
  assert.match(await page.locator('#status').textContent(), /confirmada/); assert(sent, await page.locator('#status').textContent()); assert.deepEqual(Object.keys(sent).sort(), ['expectedVersion', 'historyNote', 'lengthM', 'requestId']);
  let actual = await row(first.id); assert.equal(actual.volumeM3, 60); assert.equal(actual.technicalSheet.specialObservations, 'Retain treatment details'); assert.equal(actual.monthlyAmount, 95.5); assert.equal(actual.equipment.pumpType, 'Existing pump'); assert.equal(await page.locator('#historyNote').inputValue(), '');
  assert.equal(await count(first.id, 'TECHNICAL_SHEET_NOTE'), 1); assert(!JSON.stringify(await stored(page, first.id)).includes('Do not retain'));
  await page.locator('#historyNote').fill('Uma nota <img src=x>'); await submit(page); assert.equal(await count(first.id, 'TECHNICAL_SHEET_NOTE'), 2);
  console.log('PASS actual technical form sends only changes, previews derived volume and confirms each deliberately submitted note exactly once');

  const lost = pools[1]; await open(page, lost.id); await page.locator('#monthlyAmount').fill('0'); await page.locator('#depthMinM').fill('2'); await page.locator('#depthMaxM').fill('3'); await page.locator('#historyNote').fill('Keep this pending note'); let original;
  await intercept(page, lost.id, async route => { original = route.request().postDataJSON(); await route.fetch(); await route.fulfill({ status: 502, json: { error: 'QA lost response' } }); });
  await submit(page); await page.unroute(endpoint(lost.id)); const pending = (await stored(page, lost.id)).pending; assert(pending); assert.equal((await row(lost.id)).volumeM3, 80); assert.equal((await row(lost.id)).calculationProfile.averageDepthM, 2.5);
  await page.reload({ waitUntil: 'networkidle' }); await idle(page); assert.equal(await page.locator('#historyNote').inputValue(), 'Keep this pending note'); assert.equal(await page.locator('#name').isDisabled(), true);
  for (const mutate of [result => ({ status: 202, json: result }), () => ({ status: 200, body: '' }), result => ({ status: 200, json: { ...result, receipt: { ...result.receipt, actorKey: 'USER:999999' } } }),
    result => ({ status: 200, json: { ...result, receipt: { ...result.receipt, requestId: crypto.randomUUID() } } }), result => ({ status: 200, json: { ...result, noteHistoryId: null } }),
    result => ({ status: 200, json: { ...result, pool: { ...result.pool, volumeM3: 999 } } }), result => ({ status: 200, json: { ...result, pool: { ...result.pool, averageDepthM: 2 } } }),
    result => ({ status: 200, json: { ...result, pool: { ...result.pool, equipmentNotes: 'Unexpected alteration' } } }), result => ({ status: 200, json: { ...result, propagation: { ...result.propagation, notificationId: 999999 } } })]) {
    await intercept(page, lost.id, async route => { assert.deepEqual(route.request().postDataJSON(), original); const response = await route.fetch(); await route.fulfill(mutate(await response.json())); }); await retry(page); await page.unroute(endpoint(lost.id));
    assert.deepEqual((await stored(page, lost.id)).pending, pending); assert.equal(await count(lost.id, 'TECHNICAL_SHEET_NOTE'), 1); assert.equal(await page.locator('#historyNote').inputValue(), 'Keep this pending note');
  }
  await retry(page); assert.equal((await stored(page, lost.id)).pending, null); assert.equal(await page.locator('#historyNote').inputValue(), ''); assert.equal(await page.locator('#averageDepthM').inputValue(), '2.5'); assert.equal(await count(lost.id), 1);
  console.log('PASS lost response, reload, derived average and malformed acknowledgements retain the same pending request without repeating the note');

  const conflict = pools[2]; await open(page, conflict.id); await page.locator('#pumpType').fill('My pump'); await page.locator('#historyNote').fill('New review note');
  await legacy(conflict.id, { pumpType: 'Current pump', technicalRoomNotes: 'Current room' }); await submit(page); const refused = (await stored(page, conflict.id)).pending;
  await page.locator('#sheetEditReview').click(); await idle(page); assert.equal(await page.locator('[data-sheet-edit-field="pumpType"]').inputValue(), ''); assert.equal(await page.locator('[data-sheet-edit-field="historyNote"]').inputValue(), 'draft');
  await page.locator('#sheetEditApplyReview').click(); assert.match(await page.locator('#status').textContent(), /Escolha/);
  for (const [lang, title] of Object.entries({ pt: 'Editar ficha técnica', en: 'Edit technical sheet', fr: 'Modifier la fiche technique', es: 'Editar ficha técnica', de: 'Technisches Datenblatt bearbeiten' })) {
    await page.locator('#cwLanguageSelect').selectOption(lang); assert.equal(await page.locator('#sheetEditTitle').textContent(), title); assert.equal(await page.locator('#zone').inputValue(), 'Urgente');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.locator('.cw-lang-switch').evaluate(el => getComputedStyle(el).position === 'fixed'), false);
      await page.locator('#sheetEditComparison').scrollIntoViewIfNeeded();
      const layout = await page.locator('.sheet-edit-recovery').evaluate(el => { const rect = el.getBoundingClientRect(), choice = el.querySelector('.sheet-edit-choice'), box = choice.getBoundingClientRect(), x = Math.max(0, Math.min(innerWidth - 1, (box.left + box.right) / 2)), y = Math.max(0, Math.min(innerHeight - 1, (box.top + box.bottom) / 2)); return { left: rect.left, right: rect.right, width: innerWidth, client: el.clientWidth, scroll: el.scrollWidth, foreground: el.contains(document.elementFromPoint(x, y)) }; });
      assert(layout.left >= 0 && layout.right <= layout.width && layout.scroll <= layout.client + 1 && layout.foreground, `${lang}/${width}: ${JSON.stringify(layout)}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.sheet-edit-recovery').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(evidence, 'review-de-390.png') });
  await page.evaluate(() => window.CristalI18n.applyLanguage('pt')); await page.setViewportSize({ width: 1440, height: 900 }); await page.locator('.sheet-edit-recovery').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(evidence, 'review-pt-1440.png') });
  await page.locator('[data-sheet-edit-field="pumpType"]').selectOption('current'); await page.locator('#sheetEditApplyReview').click(); await idle(page); assert.equal(await count(conflict.id), 1); assert.equal(await count(conflict.id, 'TECHNICAL_SHEET_NOTE'), 0);
  assert.equal(await page.locator('#technicalRoomNotes').inputValue(), 'Current room'); await submit(page); assert.equal((await row(conflict.id)).equipment.pumpType, 'Current pump'); assert.equal(await count(conflict.id, 'TECHNICAL_SHEET_NOTE'), 1); assert.notEqual((await stored(page, conflict.id)).confirmed.record.requestId, refused.requestId);
  console.log('PASS field conflict choices, a separate new-note command, explicit save after review and readable review in five languages at 320/390/1440 px');

  const parallel = pools[3]; await open(page, parallel.id); await open(other, parallel.id); await page.locator('#pumpType').fill('First tab pump'); await page.locator('#historyNote').fill('First tab note'); await other.locator('#pumpType').fill('Second tab pump'); await other.locator('#historyNote').fill('Second tab note');
  let release, entered; const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  await intercept(page, parallel.id, async route => { await route.fetch(); entered(); await gate; await route.fulfill({ status: 502, json: { error: 'QA held response' } }); });
  await page.locator('#sheetForm button[type="submit"]').click(); await started; try { await other.evaluate(() => sheetEditor.save()); assert.equal(await count(parallel.id), 1); } finally { release(); }
  await idle(page); await page.unroute(endpoint(parallel.id)); await open(page, pools[6].id); await other.evaluate(() => sheetEditor.sync()); await retry(other); assert.equal(await other.locator('#historyNote').inputValue(), 'Second tab note');
  await other.locator('#sheetEditReview').click(); await idle(other); await other.locator('[data-sheet-edit-field="pumpType"]').selectOption('draft'); await other.locator('#sheetEditApplyReview').click(); await idle(other); await submit(other); assert.equal(await count(parallel.id, 'TECHNICAL_SHEET_NOTE'), 2);
  await open(page, parallel.id); assert.equal(await page.locator('#historyNote').inputValue(), ''); assert.equal(await page.locator('#pumpType').inputValue(), 'Second tab pump'); assert.equal((await stored(page, parallel.id)).pending, null); assert.equal((await stored(page, parallel.id)).settled.length, 1);
  console.log('PASS two tabs share one pending request while retaining separate equipment drafts and distinct notes');

  const quota = pools[4]; await open(page, quota.id); await page.locator('#historyNote').fill('Quota note');
  await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value, key) { if (this.transaction.db.name === 'cw-technical-sheet-edits-v1') throw Error('QA quota'); return window.qaPut.call(this, value, key); }; });
  await submit(page); assert.equal(await count(quota.id), 0); assert.equal(await stored(page, quota.id), null);
  await page.evaluate(() => { IDBObjectStore.prototype.put = function (value, key) { if (this.transaction.db.name === 'cw-technical-sheet-edits-v1' && value.confirmed && !value.pending) throw Error('QA receipt quota'); return window.qaPut.call(this, value, key); }; });
  await submit(page); assert.equal(await count(quota.id), 1); assert((await stored(page, quota.id)).pending); await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; }); await retry(page); assert.equal(await count(quota.id, 'TECHNICAL_SHEET_NOTE'), 1);
  const draft = pools[5]; await open(page, draft.id); await page.locator('#equipmentNotes').fill('Draft for this pool'); await page.locator('#historyNote').fill('Unsaved note');
  await page.evaluate(() => { localStorage.setItem('cw:lastform:key', 'sheetForm'); localStorage.setItem('cw:lastform:sheetForm', JSON.stringify({ name: 'Old unscoped form', historyNote: 'Old unsafe note' })); });
  await page.reload({ waitUntil: 'networkidle' }); await idle(page); assert.equal(await page.locator('#equipmentNotes').inputValue(), 'Draft for this pool'); assert.equal(await page.locator('#historyNote').inputValue(), 'Unsaved note'); assert.equal(await page.locator('#name').inputValue(), draft.name);
  await open(page, pools[6].id); assert.equal(await page.locator('#historyNote').inputValue(), ''); await open(page, draft.id); assert.equal(await page.locator('#historyNote').inputValue(), 'Unsaved note');
  for (const invalid of ['-1', 'NaN', 'Infinity', '', '1,2,3']) { await page.locator('#monthlyAmount').fill(invalid); await submit(page); assert.equal(await count(draft.id), 0); }
  await page.locator('#monthlyAmount').fill('95,50'); await page.locator('#depthMinM').fill('3'); await submit(page); assert.equal(await count(draft.id), 0); await page.locator('#sheetEditDiscard').click();
  console.log('PASS local and confirmation quota failures, per-pool unsent drafts, old form memory exclusion and invalid numeric/depth values');

  const reading = pools[7]; await page.route(endpoint(reading.id) + '/edit-state', async route => { const response = await route.fetch(), result = await response.json(); delete result.pool.monthlyAmount; await route.fulfill({ status: 200, json: result }); }); await open(page, reading.id); assert.equal(await page.locator('#name').isDisabled(), true); await page.unroute(endpoint(reading.id) + '/edit-state'); await page.locator('#sheetEditReload').click(); await idle(page); assert.equal(await page.locator('#name').isEnabled(), true);
  await prisma.poolCalculationProfile.update({ where: { poolId: reading.id }, data: { shape: 'CIRCULAR', diameterM: 4, shapeFactor: 0.8 } }); await page.reload({ waitUntil: 'networkidle' }); await idle(page); await page.locator('#averageDepthM').fill('2'); assert.equal(await page.locator('#volumeM3').inputValue(), '20.1'); await submit(page); assert.match(await page.locator('#status').textContent(), /confirmada/);
  const corrupt = pools[8]; await open(page, corrupt.id); await page.locator('#historyNote').fill('Corrupt pending'); await intercept(page, corrupt.id, route => route.abort('internetdisconnected')); await submit(page); await page.unroute(endpoint(corrupt.id));
  await page.evaluate(({ id, owner }) => new Promise(resolve => { const request = indexedDB.open('cw-technical-sheet-edits-v1', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('edits', 'readwrite'), store = tx.objectStore('edits'), read = store.get(`${owner}:${id}`); read.onsuccess = () => { const state = read.result; state.pending.payloadHash = 'broken'; store.put(state, `${owner}:${id}`); }; tx.oncomplete = () => { db.close(); resolve(); }; }; }), { id: corrupt.id, owner: 'USER:' + admin.id });
  await page.evaluate(() => sheetEditor.sync()); assert.equal(await page.locator('#sheetEditRetry').isDisabled(), true); assert.equal((await stored(page, corrupt.id)).pending.payloadHash, 'broken'); assert.equal(await count(corrupt.id), 0);
  console.log('PASS incomplete current data and corrupt pending records fail closed; circular preview matches the saved calculation');

  const session = pools[9]; await open(page, session.id); await page.locator('#historyNote').fill('Original account note'); await intercept(page, session.id, route => route.abort('internetdisconnected')); await submit(page); await page.unroute(endpoint(session.id)); const originalState = (await stored(page, session.id)).pending;
  const another = await prisma.user.create({ data: { name: 'Other sheet admin', email: `sheet-other-${Date.now()}@qa.test`, role: 'ADMIN', active: true, password: 'QA unused' } }), otherToken = jwt.sign({ id: another.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const delayed = pools[10]; await open(page, delayed.id); await page.locator('#historyNote').fill('Delayed old-account note');
  let unblock, arrived; const held = new Promise(resolve => { unblock = resolve; }), arrival = new Promise(resolve => { arrived = resolve; });
  await intercept(page, delayed.id, async route => { const response = await route.fetch(); arrived(); await held; await route.fulfill({ response }); });
  await page.locator('#sheetForm button[type="submit"]').click(); await arrival;
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token: otherToken, id: another.id }); await page.evaluate(() => sheetEditor.sync()); unblock(); await idle(page); await page.unroute(endpoint(delayed.id)); assert((await stored(page, delayed.id)).pending); assert.equal(await count(delayed.id, 'TECHNICAL_SHEET_NOTE'), 1); assert.equal(await page.locator('#name').inputValue(), ''); assert.equal(await page.locator('#historyNote').inputValue(), ''); assert.equal(await page.locator('#keyAccessList').textContent(), ''); assert.deepEqual((await stored(page, session.id)).pending, originalState); assert.equal(await count(session.id), 0);
  await page.reload({ waitUntil: 'networkidle' }); await idle(page); assert.equal(await page.locator('#historyNote').inputValue(), ''); assert.equal(await page.locator('#sheetEditRetry').isVisible(), false);
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token, id: admin.id }); await open(page, session.id); await retry(page); assert.equal(await count(session.id, 'TECHNICAL_SHEET_NOTE'), 1); await open(page, delayed.id); await retry(page); assert.equal(await count(delayed.id, 'TECHNICAL_SHEET_NOTE'), 1); assert.deepEqual(errors, []);
  console.log('PASS account changes clear the form and related data, isolate pending notes and allow recovery with the original account');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
