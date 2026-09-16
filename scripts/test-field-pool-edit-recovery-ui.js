'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{"language":"pt"}' });
  const clients = []; for (const name of ['Pago', 'Urgente', 'Cliente <img src=x>', 'Cliente arquivado durante edição']) clients.push(await prisma.client.create({ data: { name, active: true, status: 'ACTIVE', contractActive: true, billingActive: true, creditBalance: 19, password: 'Never store this pool owner credential', pin: 'Never store this pool owner PIN' } }));
  const pools = []; for (let i = 0; i < 12; i++) pools.push(await prisma.pool.create({ data: { name: i === 10 ? 'Pago' : `Pool UI ${i} <b>literal</b>`, clientId: clients[0].id, type: 'POOL', monthlyAmount: 95.5, zone: 'Urgente', notes: 'Notas gerais originais', technicalSheet: { create: { volumeM3: 42, disinfectionType: 'SAL', specialObservations: 'Notas técnicas preservadas' } }, equipment: { create: { notes: 'Equipamento preservado' } } } }));
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => { if (!localStorage.getItem('cwQAPoolEditSession')) { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); localStorage.setItem('cwQAPoolEditSession', '1'); } }, { token, id: admin.id });
  const page = await context.newPage(), other = await context.newPage(), errors = [];
  const evidence = path.join(process.cwd(), 'reports', 'field-visual', 'pool-edit'); fs.mkdirSync(evidence, { recursive: true });
  for (const tab of [page, other]) { tab.setDefaultTimeout(7000); tab.on('pageerror', error => errors.push(error.message)); }
  const url = base + '/admin-pools', endpoint = id => `${base}/api/pools/${id}`;
  const idle = tab => tab.waitForFunction(() => document.getElementById('poolEditForm')?.getAttribute('aria-busy') === 'false');
  const open = async (tab, id) => { await tab.evaluate(id => poolEdit.open(id), id); await idle(tab); };
  const submit = async tab => { await tab.locator('#poolEditSave').click(); await idle(tab); }, retry = async tab => { await tab.locator('#poolEditRetry').click(); await idle(tab); };
  const row = id => prisma.pool.findUniqueOrThrow({ where: { id }, include: { technicalSheet: true, equipment: true } });
  const count = id => prisma.technicalHistory.count({ where: { poolId: id, type: 'TECHNICAL_SHEET_CHANGE' } });
  const stored = (tab, id) => tab.evaluate(({ id, owner }) => new Promise((resolve, reject) => { const request = indexedDB.open('cw-pool-edits-v1', 1); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result, tx = db.transaction('edits'), read = tx.objectStore('edits').get(`${owner}:${id}`); tx.oncomplete = () => { resolve(read.result || null); db.close(); }; }; }), { id, owner: 'USER:' + admin.id });
  const storageText = tab => tab.evaluate(() => new Promise(resolve => { const request = indexedDB.open('cw-pool-edits-v1', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('edits'), read = tx.objectStore('edits').getAll(); tx.oncomplete = () => { resolve(JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, requests: read.result })); db.close(); }; }; }));
  const legacy = async (id, body) => { const response = await fetch(endpoint(id), { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); assert.equal(response.status, 200); return response.json(); };
  await page.goto(url, { waitUntil: 'networkidle' }); await other.goto(url, { waitUntil: 'networkidle' });
  const first = pools[0], before = await row(first.id); let sent;
  await page.route(endpoint(first.id), async route => { sent = route.request().postDataJSON(); await route.continue(); });
  await page.locator(`button[onclick="editPool(${first.id})"]`).click(); await idle(page); await page.screenshot({ path: path.join(evidence, 'form-pt-390.png') }); await page.locator('#poolEditName').fill('Nome alterado'); await submit(page);
  assert.match(await page.locator('#poolEditStatus').textContent(), /confirmada/); assert.deepEqual(Object.keys(sent).sort(), ['expectedClientVersion', 'expectedVersion', 'name', 'requestId']);
  const after = await row(first.id); for (const field of ['clientId', 'monthlyAmount', 'zone', 'notes', 'technicalSheet', 'equipment']) assert.deepEqual(after[field], before[field]);
  assert.equal(await count(first.id), 1); assert.equal((await stored(page, first.id)).pending, null); await page.unroute(endpoint(first.id));
  assert(!(await storageText(page)).includes('Never store this pool owner'));
  console.log('PASS real pool editor sends only changes, validates the receipt and preserves technical and client data');

  const transfer = pools[1], visit = await prisma.serviceVisit.create({ data: { poolId: transfer.id, clientId: clients[0].id, status: 'PLANNED' } }), done = await prisma.serviceVisit.create({ data: { poolId: transfer.id, clientId: clients[0].id, status: 'DONE', endAt: new Date() } });
  await page.locator('#poolEditCancel').click(); await page.locator(`button[onclick="reassignPool(${transfer.id})"]`).click(); await idle(page);
  assert.equal(await page.locator('#poolEditClientId').evaluate(el => document.activeElement === el), true);
  await page.locator('#poolEditClientId').selectOption(String(clients[1].id)); await page.locator('#poolEditMonthlyAmount').fill('0'); await page.locator('#poolEditNotes').fill('Geral <img src=x>');
  let original;
  await page.route(endpoint(transfer.id), async route => { original = route.request().postDataJSON(); await route.fetch(); await route.fulfill({ status: 502, json: { error: 'QA lost reply after commit' } }); });
  await submit(page); const pending = (await stored(page, transfer.id)).pending; assert(pending); assert.match(original.expectedClientVersion, /^pool-client-v1:/);
  assert.equal((await row(transfer.id)).clientId, clients[1].id); assert.equal((await row(transfer.id)).monthlyAmount, 0); assert.equal((await row(transfer.id)).technicalSheet.specialObservations, 'Notas técnicas preservadas');
  assert.equal((await prisma.serviceVisit.findUniqueOrThrow({ where: { id: visit.id } })).clientId, clients[1].id); assert.equal((await prisma.serviceVisit.findUniqueOrThrow({ where: { id: done.id } })).clientId, clients[0].id);
  await page.unroute(endpoint(transfer.id)); await page.reload({ waitUntil: 'networkidle' }); await page.locator(`[data-pool-edit-pending="${transfer.id}"]`).click(); await idle(page);
  assert.equal(await page.locator('#poolEditClientId').isDisabled(), true); assert.equal(await page.locator('#poolEditPending img').count(), 0);
  const invalid = [result => ({ status: 202, json: result }), () => ({ status: 200, body: '' }), result => ({ status: 200, json: { ...result, receipt: { ...result.receipt, actorKey: 'USER:999999' } } }),
    result => ({ status: 200, json: { ...result, receipt: { ...result.receipt, clientId: clients[0].id } } }), result => ({ status: 200, json: { ...result, receipt: { ...result.receipt, reassignedVisits: 999 } } }),
    result => ({ status: 200, json: { ...result, receipt: { ...result.receipt, expectedClientVersion: null } } }), result => { delete result.pool.monthlyAmount; return { status: 200, json: result }; }];
  for (const mutate of invalid) { await page.route(endpoint(transfer.id), async route => { assert.deepEqual(route.request().postDataJSON(), original); const response = await route.fetch(); await route.fulfill(mutate(await response.json())); }); await retry(page); assert.deepEqual((await stored(page, transfer.id)).pending, pending); assert.equal(await count(transfer.id), 1); await page.unroute(endpoint(transfer.id)); }
  await retry(page); assert.equal((await stored(page, transfer.id)).pending, null); assert.equal(await count(transfer.id), 1);
  console.log('PASS lost transfer reply, reload, zero amount and invalid acknowledgements keep one original request and one visit transfer');

  const conflict = pools[2]; await open(page, conflict.id); await page.locator('#poolEditName').fill('Nome do rascunho'); await page.locator('#poolEditNotes').fill('Nota não sobreposta');
  await legacy(conflict.id, { name: 'Nome atual de outra janela', address: 'Morada atual' }); await submit(page); const refused = (await stored(page, conflict.id)).pending;
  assert.equal((await row(conflict.id)).name, 'Nome atual de outra janela'); await page.locator('#poolEditReview').click(); await idle(page);
  assert.equal(await page.locator('[data-pool-edit-field="name"]').inputValue(), ''); assert.equal(await page.locator('[data-pool-edit-field="notes"]').inputValue(), 'draft');
  await page.locator('#poolEditApplyReview').click(); assert.match(await page.locator('#poolEditStatus').textContent(), /Escolha/);
  await page.locator('[data-pool-edit-field="name"]').selectOption('current'); await page.locator('#poolEditApplyReview').click(); await idle(page);
  assert.equal((await stored(page, conflict.id)).pending, null); assert.equal(await count(conflict.id), 1); assert.equal(await page.locator('#poolEditAddress').inputValue(), 'Morada atual');
  await submit(page); assert.equal((await row(conflict.id)).name, 'Nome atual de outra janela'); assert.equal((await row(conflict.id)).notes, 'Nota não sobreposta'); assert.notEqual((await stored(page, conflict.id)).confirmed.record.requestId, refused.requestId);
  console.log('PASS conflicts need a field choice and preparing a revision makes no write before an explicit save with a new UUID');

  const retired = pools[3]; await open(page, retired.id); await page.locator('#poolEditClientId').selectOption(String(clients[3].id));
  await prisma.client.update({ where: { id: clients[3].id }, data: { active: false, archiveStatus: 'ARQUIVADO' } }); await submit(page); assert.match(await page.locator('#poolEditStatus').textContent(), /cliente selecionado/); assert.equal(await count(retired.id), 0);
  await page.locator('#poolEditReview').click(); await idle(page); const choose = page.locator('[data-pool-edit-field="clientId"]'); assert.equal(await choose.inputValue(), ''); assert.equal(await choose.locator('option[value="draft"]').isDisabled(), true);
  await choose.selectOption('current'); await page.locator('#poolEditApplyReview').click(); await idle(page); await page.locator('#poolEditClientId').selectOption(String(clients[2].id)); await submit(page);
  assert.equal((await row(retired.id)).clientId, clients[2].id); assert.equal(await count(retired.id), 1);
  console.log('PASS a recipient archived after selection is rejected and review cannot select the unavailable account');

  const parallel = pools[4]; await open(page, parallel.id); await open(other, parallel.id); await page.locator('#poolEditName').fill('Primeira janela'); await other.locator('#poolEditName').fill('Segunda janela'); await other.locator('#poolEditMonthlyAmount').fill('125,75');
  let release, entered; const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  await page.route(endpoint(parallel.id), async route => { await route.fetch(); entered(); await gate; await route.fulfill({ status: 502, json: { error: 'QA delayed reply' } }); });
  await page.locator('#poolEditSave').click(); await started; try { await other.evaluate(() => poolEdit.save()); assert.equal(await count(parallel.id), 1); } finally { release(); }
  await idle(page); await page.unroute(endpoint(parallel.id)); await other.evaluate(() => poolEdit.sync()); await retry(other);
  assert.equal(await other.locator('#poolEditName').inputValue(), 'Segunda janela'); assert.equal(await other.locator('#poolEditMonthlyAmount').inputValue(), '125,75');
  await other.locator('#poolEditReview').click(); await idle(other); await other.locator('[data-pool-edit-field="name"]').selectOption('draft'); await other.locator('#poolEditApplyReview').click(); await idle(other); await submit(other);
  assert.equal((await row(parallel.id)).monthlyAmount, 125.75); assert.equal(await count(parallel.id), 2); await page.reload({ waitUntil: 'networkidle' }); await open(page, parallel.id); assert.equal((await stored(page, parallel.id)).pending, null); assert.equal(await count(parallel.id), 2);
  console.log('PASS two tabs share the pending request, preserve separate drafts, normalize comma amounts and cannot resurrect a confirmed UUID');

  const delayed = pools[5], destination = pools[6]; await open(page, destination.id); await page.locator('#poolEditNotes').fill('Rascunho da piscina B'); await open(page, delayed.id); await page.locator('#poolEditName').fill('Resposta atrasada A');
  let unblock, arrived; const late = new Promise(resolve => { unblock = resolve; }), arrival = new Promise(resolve => { arrived = resolve; });
  await page.route(endpoint(delayed.id), async route => { const response = await route.fetch(); arrived(); await late; await route.fulfill({ response }); });
  await page.locator('#poolEditSave').click(); await arrival; await page.evaluate(id => poolEdit.open(id), destination.id); unblock(); await idle(page);
  assert.equal(await page.locator('#poolEditName').inputValue(), destination.name); assert.equal(await page.locator('#poolEditNotes').inputValue(), 'Rascunho da piscina B'); assert.equal(await page.locator('#poolEditModal').isVisible(), true); await page.unroute(endpoint(delayed.id));
  console.log('PASS a late result cannot close or overwrite a different pool’s draft');

  const quota = pools[7]; await open(page, quota.id); await page.locator('#poolEditName').fill('Quota QA');
  await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value, key) { if (this.transaction.db.name === 'cw-pool-edits-v1') throw Error('QA quota'); return window.qaPut.call(this, value, key); }; });
  await submit(page); assert.equal(await count(quota.id), 0); assert.equal(await stored(page, quota.id), null);
  await page.evaluate(() => { IDBObjectStore.prototype.put = function (value, key) { if (this.transaction.db.name === 'cw-pool-edits-v1' && value.confirmed && !value.pending) throw Error('QA acknowledgement quota'); return window.qaPut.call(this, value, key); }; });
  await submit(page); assert.equal(await count(quota.id), 1); assert((await stored(page, quota.id)).pending); await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; }); await retry(page); assert.equal(await count(quota.id), 1);
  console.log('PASS persistence failure blocks transport and confirmation storage failure retains the original retry');

  const draft = pools[8]; await open(page, draft.id); await page.locator('#poolEditNotes').fill('Rascunho local'); await page.reload({ waitUntil: 'networkidle' }); await open(page, draft.id); assert.equal(await page.locator('#poolEditNotes').inputValue(), 'Rascunho local'); assert.equal(await count(draft.id), 0);
  for (const invalid of ['-1', 'NaN', 'Infinity', '', '1,2,3']) { await page.locator('#poolEditMonthlyAmount').fill(invalid); await submit(page); assert.equal(await count(draft.id), 0); assert.match(await page.locator('#poolEditStatus').textContent(), /valor mensal/); }
  await page.locator('#poolEditMonthlyAmount').fill('95,50'); await legacy(draft.id, { notes: 'Nota atual' }); await submit(page); await page.locator('#poolEditReview').click(); await idle(page);
  for (const [language, title] of Object.entries({ pt: 'Editar piscina', en: 'Edit pool', fr: 'Modifier la piscine', es: 'Editar piscina', de: 'Pool bearbeiten' })) {
    await page.evaluate(language => window.CristalI18n.applyLanguage(language), language); assert.equal(await page.locator('#poolEditTitle').textContent(), title);
    const literal = page.locator('article.pool-row').filter({ has: page.locator(`button[onclick="editPool(${pools[10].id})"]`) }); assert.equal(await literal.locator('.pool-title-line strong').textContent(), 'Pago'); assert.equal(await literal.locator('.pool-cell b').first().textContent(), 'Pago'); assert.equal(await literal.locator('.pool-cell b').nth(1).textContent(), 'Urgente');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await page.locator('.pool-edit-card').evaluate(el => { const rect = el.getBoundingClientRect(), modal = el.closest('#poolEditModal'); return { client: el.clientWidth, scroll: el.scrollWidth, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight, position: getComputedStyle(modal).position, foreground: modal.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2)) }; });
      assert(box.position === 'fixed' && box.foreground && box.scroll <= box.client + 1 && box.left >= 0 && box.right <= box.width && box.top >= 0 && box.bottom <= box.height, `${language}/${width}: ${JSON.stringify(box)}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(evidence, 'review-de-390.png') }); await page.evaluate(() => window.CristalI18n.applyLanguage('pt')); await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: path.join(evidence, 'review-pt-1440.png') });
  console.log('PASS saved drafts, invalid amounts, literal customer/pool names and conflict review in five languages at 320/390/1440 px');

  const reading = pools[10]; await page.route(endpoint(reading.id) + '/edit-state', async route => { const response = await route.fetch(), result = await response.json(); delete result.pool.monthlyAmount; await route.fulfill({ status: 200, json: result }); }); await open(page, reading.id); assert.equal(await page.locator('#poolEditSave').isDisabled(), true); await page.unroute(endpoint(reading.id) + '/edit-state'); await page.locator('#poolEditReload').click(); await idle(page); assert.equal(await page.locator('#poolEditMonthlyAmount').inputValue(), '95.5');
  await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwPoolEditDraft:')) throw Error('QA draft quota'); return window.qaSetItem.call(this, key, value); }; }); await page.locator('#poolEditNotes').fill('Keep this window'); await page.locator('#poolEditCancel').click(); assert.equal(await page.locator('#poolEditModal').isVisible(), true); await page.locator('#poolEditDiscard').click(); await page.locator('#poolEditCancel').click(); assert.equal(await page.locator('#poolEditModal').isVisible(), false); await page.evaluate(() => { Storage.prototype.setItem = window.qaSetItem; });
  const corrupt = pools[11]; await open(page, corrupt.id); await page.locator('#poolEditNotes').fill('Corruption QA'); await page.route(endpoint(corrupt.id), route => route.abort('internetdisconnected')); await submit(page); await page.unroute(endpoint(corrupt.id));
  await page.evaluate(({ id, owner }) => new Promise(resolve => { const request = indexedDB.open('cw-pool-edits-v1', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('edits', 'readwrite'), store = tx.objectStore('edits'), read = store.get(`${owner}:${id}`); read.onsuccess = () => { const state = read.result; state.pending.payloadHash = 'broken'; store.put(state, `${owner}:${id}`); }; tx.oncomplete = () => { db.close(); resolve(); }; }; }), { id: corrupt.id, owner: 'USER:' + admin.id });
  await page.evaluate(() => poolEdit.sync()); assert.equal(await page.locator('#poolEditRetry').isDisabled(), true); assert.equal((await stored(page, corrupt.id)).pending.payloadHash, 'broken'); assert.equal(await count(corrupt.id), 0);
  console.log('PASS incomplete state and corrupt pending data fail closed; unsaved draft loss requires explicit discard');

  const session = pools[9]; await open(page, session.id); await page.locator('#poolEditName').fill('Pedido da conta original'); await page.route(endpoint(session.id), route => route.abort('internetdisconnected')); await submit(page); await page.unroute(endpoint(session.id)); const originalState = (await stored(page, session.id)).pending;
  const another = await prisma.user.create({ data: { name: 'Another QA admin', email: `pool-edit-other-${Date.now()}@qa.test`, role: 'ADMIN', active: true, password: 'QA unused login' } }), otherToken = jwt.sign({ id: another.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token: otherToken, id: another.id }); await page.evaluate(() => poolEdit.sync()); assert.equal(await page.locator('#poolEditName').inputValue(), ''); assert.equal(await page.locator('#poolEditSave').isDisabled(), true); assert.deepEqual((await stored(page, session.id)).pending, originalState); assert.equal(await count(session.id), 0);
  assert.equal(await page.locator('#poolEditClientId option').count(), 0); await page.evaluate(() => window.CristalI18n.applyLanguage('de')); assert.equal(await page.locator('#poolEditClientId option').count(), 0);
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('#poolEditPendingList').isVisible(), false);
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token, id: admin.id }); await page.reload({ waitUntil: 'networkidle' }); await open(page, session.id); await retry(page); assert.equal(await count(session.id), 1);
  assert(!(await storageText(page)).includes('Never store this pool owner')); assert.deepEqual(errors, []);
  console.log('PASS account changes clear visible details, isolate saved requests and recover only with the original account');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
