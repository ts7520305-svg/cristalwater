'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const fixtures = [];
  for (let i = 0; i < 12; i++) fixtures.push(await prisma.client.create({ data: { name: i === 10 ? 'Pago' : `Edição UI ${i} <b>literal</b>`, internalName: i === 10 ? 'Urgente' : null, phone: '910000000', email: `client-edit-ui-${Date.now()}-${i}@qa.test`, status: 'ACTIVE', active: true, contractActive: true, billingActive: true, creditBalance: 37, monthlyFee: 70, monthlyAmount: 70, password: await bcrypt.hash('Before QA only', 4) } }));
  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{"language":"pt"}' });
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    if (!localStorage.getItem('cwQAEditSession')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
      localStorage.setItem('cwQAEditSession', '1'); localStorage.setItem('cw_client_status_filter', 'all');
      localStorage.setItem('cw:lastform:editClientForm', JSON.stringify({ name: 'Unowned old snapshot', password: 'Old QA secret' }));
      localStorage.setItem('cw:lastform:key', 'editClientForm');
      sessionStorage.setItem('cw:ctx:/admin-clients', JSON.stringify({ fields: { editName: 'Wrong old client', editPassword: 'Old QA secret', password: 'Old QA secret' } }));
    }
  }, { token, id: admin.id });
  const page = await context.newPage(), other = await context.newPage(), errors = [];
  for (const tab of [page, other]) { tab.setDefaultTimeout(7000); tab.on('pageerror', error => errors.push(error.message)); }
  const url = base + '/admin-clients', endpoint = id => `${base}/api/core/clients/${id}`;
  const idle = tab => tab.waitForFunction(() => document.getElementById('editClientForm').getAttribute('aria-busy') === 'false');
  const open = async (tab, id) => { await tab.evaluate(id => clientEdit.open(id), id); await idle(tab); };
  const submit = async tab => { await tab.locator('#saveEditClient').click(); await idle(tab); };
  const retry = async tab => { await tab.locator('#clientEditRetry').click(); await idle(tab); };
  const state = id => prisma.client.findUniqueOrThrow({ where: { id } });
  const audits = id => prisma.userAuditLog.count({ where: { entity: 'Client', entityId: String(id), action: 'CLIENT_UPDATED' } });
  const stored = (tab, id) => tab.evaluate(({ id, owner }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('cw-client-edits-v1', 1); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction('edits'), read = tx.objectStore('edits').get(`${owner}:${id}`); tx.oncomplete = () => { resolve(read.result || null); db.close(); }; };
  }), { id, owner: 'USER:' + admin.id });
  const storageText = tab => tab.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('cw-client-edits-v1', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('edits'), read = tx.objectStore('edits').getAll(); tx.oncomplete = () => { resolve(JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, requests: read.result })); db.close(); }; };
  }));
  const changedByServer = async (id, patch) => { const response = await fetch(endpoint(id), { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); assert.equal(response.status, 200); return response.json(); };
  await page.goto(url, { waitUntil: 'networkidle' }); await other.goto(url, { waitUntil: 'networkidle' });
  assert(!(await storageText(page)).includes('Old QA secret'));

  const first = fixtures[0]; let submitted;
  await page.route(endpoint(first.id), async route => { submitted = route.request().postDataJSON(); await route.continue(); });
  await page.locator(`button[onclick="editClient(${first.id})"]`).click(); await idle(page);
  await page.locator('#editName').fill('Nome revisto'); await submit(page);
  assert.match(await page.locator('#clientEditStatus').textContent(), /confirmada/);
  assert.deepEqual(Object.keys(submitted).sort(), ['credentialIntent', 'expectedVersion', 'name', 'requestId']);
  const updated = await state(first.id);
  for (const key of ['phone', 'email', 'monthlyFee', 'monthlyAmount', 'contractActive', 'billingActive', 'creditBalance', 'password']) assert.equal(updated[key], first[key]);
  assert.equal(await audits(first.id), 1); assert.equal((await stored(page, first.id)).pending, null);
  await page.unroute(endpoint(first.id));
  console.log('PASS actual client editor sends only changed fields and confirms the matching receipt');

  const lost = fixtures[1], secret = 'Lost reply QA password'; let originalBody;
  await open(page, lost.id); await page.locator('#editName').fill('Pedido <img src=x>'); await page.locator('#editPassword').fill(secret);
  await page.route(endpoint(lost.id), async route => { originalBody = route.request().postDataJSON(); await route.fetch(); await route.fulfill({ status: 502, json: { error: 'QA lost response after commit' } }); });
  await submit(page); const saved = (await stored(page, lost.id)).pending; assert(saved); assert.equal(saved.requestId, originalBody.requestId);
  const passwordAfter = (await state(lost.id)).password; assert(await bcrypt.compare(secret, passwordAfter));
  const persisted = await storageText(page);
  assert(!persisted.includes(secret)); assert(!persisted.includes(passwordAfter));
  await page.unroute(endpoint(lost.id)); await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#clientEditPendingList').isVisible(), true);
  await page.locator(`[data-client-edit-pending="${lost.id}"]`).click(); await idle(page);
  assert.equal(await page.locator('#editPassword').inputValue(), ''); assert.equal(await page.locator('#editName').isDisabled(), true);
  assert.equal(await page.locator('#clientEditPending img').count(), 0);
  const invalidReplies = [
    result => ({ status: 202, json: result }),
    () => ({ status: 200, body: '' }),
    result => ({ status: 200, json: { ...result, receipt: { ...result.receipt, actorKey: 'USER:999999' } } }),
    result => ({ status: 200, json: { ...result, client: { ...result.client, id: fixtures[2].id } } }),
    result => ({ status: 200, json: { ...result, receipt: { ...result.receipt, payloadHash: '0'.repeat(64) } } }),
    result => { delete result.client.phone; return { status: 200, json: result }; },
  ];
  for (const invalid of invalidReplies) {
    await page.route(endpoint(lost.id), async route => { const body = route.request().postDataJSON(); assert.equal(body.requestId, originalBody.requestId); assert.equal(body.password, undefined); const response = await route.fetch(); await route.fulfill(invalid(await response.json())); });
    await retry(page); assert.deepEqual((await stored(page, lost.id)).pending, saved); assert.equal(await audits(lost.id), 1);
    await page.unroute(endpoint(lost.id));
  }
  await retry(page); assert.equal((await stored(page, lost.id)).pending, null); assert.equal((await state(lost.id)).password, passwordAfter); assert.equal(await audits(lost.id), 1);
  console.log('PASS lost reply, reload, password omission and invalid acknowledgements retain one original request');

  const unsent = fixtures[2], reentered = 'Reentered QA password';
  await open(page, unsent.id); await page.locator('#editNotes').fill('Rascunho sem rede'); await page.locator('#editPassword').fill(reentered);
  await page.route(endpoint(unsent.id), route => route.abort('internetdisconnected')); await submit(page);
  const notSent = (await stored(page, unsent.id)).pending; assert.equal(await audits(unsent.id), 0); assert(!(await storageText(page)).includes(reentered));
  await page.unroute(endpoint(unsent.id)); await page.reload({ waitUntil: 'networkidle' }); await open(page, unsent.id); await retry(page);
  assert.equal(await page.locator('#editPassword').isDisabled(), false); assert.match(await page.locator('#clientEditStatus').textContent(), /introduzir/); assert.equal(await audits(unsent.id), 0);
  await page.locator('#editPassword').fill(reentered); await retry(page);
  assert.equal((await stored(page, unsent.id)).confirmed.record.requestId, notSent.requestId); assert.equal(await audits(unsent.id), 1); assert(await bcrypt.compare(reentered, (await state(unsent.id)).password));
  assert(!(await storageText(page)).includes(reentered));
  console.log('PASS an uncommitted password edit requests reentry with the same UUID and never stores the secret');

  const conflict = fixtures[3]; await open(page, conflict.id);
  await page.locator('#editName').fill('Nome do meu rascunho'); await page.locator('#editPhone').fill('919999999');
  await changedByServer(conflict.id, { name: 'Nome de outra pessoa', zone: 'Zona atual' });
  await submit(page); const refused = (await stored(page, conflict.id)).pending;
  assert.equal((await state(conflict.id)).name, 'Nome de outra pessoa'); assert.equal(await page.locator('#clientEditReview').isVisible(), true);
  await page.locator('#clientEditReview').click(); await idle(page);
  const chooseName = page.locator('[data-client-edit-field="name"]'), choosePhone = page.locator('[data-client-edit-field="phone"]');
  assert.equal(await chooseName.inputValue(), ''); assert.equal(await choosePhone.inputValue(), 'draft');
  await page.locator('#clientEditApplyReview').click(); await idle(page); assert.match(await page.locator('#clientEditStatus').textContent(), /Escolha/);
  await chooseName.selectOption('current'); await page.locator('#clientEditApplyReview').click(); await idle(page);
  assert.equal((await stored(page, conflict.id)).pending, null); assert.equal(await audits(conflict.id), 1);
  assert.equal(await page.locator('#editName').inputValue(), 'Nome de outra pessoa'); assert.equal(await page.locator('#editZone').inputValue(), 'Zona atual');
  await submit(page); assert.equal((await state(conflict.id)).phone, '919999999'); assert.equal((await state(conflict.id)).name, 'Nome de outra pessoa');
  assert.notEqual((await stored(page, conflict.id)).confirmed.record.requestId, refused.requestId); assert.equal(await audits(conflict.id), 2);
  console.log('PASS stale versions require field review; preparing a revision makes no write and the next save uses a new UUID');

  const parallel = fixtures[4]; await open(page, parallel.id); await open(other, parallel.id);
  await page.locator('#editName').fill('Primeira janela'); await other.locator('#editName').fill('Segunda janela'); await other.locator('#editNotes').fill('Nota da segunda janela');
  let release, entered; const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  await page.route(endpoint(parallel.id), async route => { await route.fetch(); entered(); await gate; await route.fulfill({ status: 502, json: { error: 'QA delayed lost response' } }); });
  await page.locator('#saveEditClient').click(); await started;
  try { await other.evaluate(() => saveEditedClient()); assert.equal(await audits(parallel.id), 1); } finally { release(); }
  await idle(page); await page.unroute(endpoint(parallel.id));
  await other.evaluate(() => clientEdit.sync()); await retry(other);
  assert.equal(await other.locator('#editName').inputValue(), 'Segunda janela'); assert.equal(await other.locator('#editNotes').inputValue(), 'Nota da segunda janela');
  assert.equal(await other.locator('#clientEditReview').isVisible(), true); assert.equal(await audits(parallel.id), 1);
  await other.locator('#clientEditReview').click(); await idle(other); await other.locator('[data-client-edit-field="name"]').selectOption('draft');
  await other.locator('#clientEditApplyReview').click(); await idle(other); await submit(other); assert.equal(await audits(parallel.id), 2);
  await page.reload({ waitUntil: 'networkidle' }); await open(page, parallel.id);
  // A stale first-tab draft can be reviewed but cannot resurrect its confirmed request.
  assert.equal((await stored(page, parallel.id)).pending, null); assert.equal(await audits(parallel.id), 2);
  console.log('PASS two tabs share one pending request, preserve different drafts and cannot resurrect a confirmed UUID');

  const delayed = fixtures[5], destination = fixtures[6]; await open(page, destination.id); await page.locator('#editNotes').fill('Rascunho do outro cliente'); await open(page, delayed.id); await page.locator('#editName').fill('Resposta atrasada');
  let unblock, arrived; const delayedGate = new Promise(resolve => { unblock = resolve; }), arrivedGate = new Promise(resolve => { arrived = resolve; });
  await page.route(endpoint(delayed.id), async route => { const response = await route.fetch(); arrived(); await delayedGate; await route.fulfill({ response }); });
  await page.locator('#saveEditClient').click(); await arrivedGate; await page.evaluate(id => clientEdit.open(id), destination.id); unblock(); await idle(page);
  assert.equal(await page.locator('#editName').inputValue(), destination.name); assert.equal(await page.locator('#editNotes').inputValue(), 'Rascunho do outro cliente');
  assert.equal(await page.locator('#editClientModal').isVisible(), true); await page.unroute(endpoint(delayed.id));
  console.log('PASS a late confirmation cannot close or overwrite another customer’s open draft');

  const quota = fixtures[7]; await open(page, quota.id); await page.locator('#editName').fill('Quota QA');
  await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value, key) { if (this.transaction.db.name === 'cw-client-edits-v1') throw Error('QA quota'); return window.qaPut.call(this, value, key); }; });
  await submit(page); assert.equal(await audits(quota.id), 0); assert.equal(await stored(page, quota.id), null);
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; });
  await page.evaluate(() => { IDBObjectStore.prototype.put = function (value, key) { if (this.transaction.db.name === 'cw-client-edits-v1' && value.confirmed && !value.pending) throw Error('QA acknowledgement quota'); return window.qaPut.call(this, value, key); }; });
  await submit(page); assert.equal(await audits(quota.id), 1); assert((await stored(page, quota.id)).pending);
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; }); await retry(page); assert.equal(await audits(quota.id), 1); assert.equal((await stored(page, quota.id)).pending, null);
  console.log('PASS failed persistence blocks transport; failed confirmation persistence preserves the original retry');

  const draft = fixtures[8]; await open(page, draft.id); await page.locator('#editNotes').fill('Rascunho local não enviado');
  await page.reload({ waitUntil: 'networkidle' }); await open(page, draft.id); assert.equal(await page.locator('#editNotes').inputValue(), 'Rascunho local não enviado'); assert.equal(await audits(draft.id), 0);
  await page.locator('#editName').fill(''); await page.locator('#saveEditClient').click(); assert.equal(await audits(draft.id), 0);
  await page.locator('#editName').fill(draft.name); await page.locator('#editPassword').fill('á'.repeat(37)); await submit(page); assert.equal(await audits(draft.id), 0); assert.match(await page.locator('#clientEditStatus').textContent(), /72/);
  await page.locator('#editPassword').fill(''); await changedByServer(draft.id, { notes: 'Nota atual diferente' }); await submit(page);
  await page.locator('#clientEditReview').click(); await idle(page);
  const titles = { pt: 'Editar cliente', en: 'Edit customer', fr: 'Modifier le client', es: 'Editar cliente', de: 'Kunden bearbeiten' };
  const evidence = path.join(process.cwd(), 'reports', 'field-visual', 'client-edit'); fs.mkdirSync(evidence, { recursive: true });
  for (const [language, title] of Object.entries(titles)) {
    await page.evaluate(language => window.CristalI18n.applyLanguage(language), language);
    assert.equal(await page.locator('#editClientTitle').textContent(), title);
    const literal = page.locator('article.client').filter({ has: page.locator(`button[onclick="editClient(${fixtures[10].id})"]`) });
    assert.equal(await literal.locator('h3').textContent(), 'Pago'); assert.equal(await literal.locator('.client-kv span').last().textContent(), 'Urgente');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const fit = await page.locator('#editClientModal .cw-modal-card').evaluate(element => { const rect = element.getBoundingClientRect(), modal = element.closest('#editClientModal'); return { client: element.clientWidth, scroll: element.scrollWidth, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight, position: getComputedStyle(modal).position, foreground: modal.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2)) }; });
      assert(fit.position === 'fixed' && fit.foreground && fit.scroll <= fit.client + 1 && fit.left >= 0 && fit.right <= fit.width && fit.top >= 0 && fit.bottom <= fit.height, `${language}/${width}: ${JSON.stringify(fit)}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#clientEditComparison').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(evidence, 'review-de-390.png') });
  await page.evaluate(() => window.CristalI18n.applyLanguage('pt')); await page.setViewportSize({ width: 1440, height: 900 }); await page.locator('#clientEditComparison').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(evidence, 'review-pt-1440.png') });
  console.log('PASS drafts survive reload; validation and field review work in five languages at 320/390/1440 px');

  const reading = fixtures[10];
  await page.route(endpoint(reading.id) + '/edit-state', async route => { const response = await route.fetch(), result = await response.json(); delete result.client.phone; await route.fulfill({ status: 200, json: result }); });
  await open(page, reading.id); assert.equal(await page.locator('#saveEditClient').isDisabled(), true); assert.equal(await page.locator('#clientEditReload').isVisible(), true);
  await page.unroute(endpoint(reading.id) + '/edit-state'); await page.locator('#clientEditReload').click(); await idle(page); assert.equal(await page.locator('#editPhone').inputValue(), reading.phone);
  await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwClientEditDraft:')) throw Error('QA draft quota'); return window.qaSetItem.call(this, key, value); }; });
  await page.locator('#editNotes').fill('Keep this window'); await page.locator('#cancelEditClient').click(); assert.equal(await page.locator('#editClientModal').isVisible(), true);
  await page.locator('#clientEditDiscard').click(); await page.locator('#cancelEditClient').click(); assert.equal(await page.locator('#editClientModal').isVisible(), false);
  await page.evaluate(() => { Storage.prototype.setItem = window.qaSetItem; });
  const corrupt = fixtures[11]; await open(page, corrupt.id); await page.locator('#editNotes').fill('Corruption QA');
  await page.route(endpoint(corrupt.id), route => route.abort('internetdisconnected')); await submit(page); await page.unroute(endpoint(corrupt.id));
  const validStored = await stored(page, corrupt.id);
  await page.evaluate(({ id, owner }) => new Promise(resolve => { const request = indexedDB.open('cw-client-edits-v1', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('edits', 'readwrite'), store = tx.objectStore('edits'), read = store.get(`${owner}:${id}`); read.onsuccess = () => { const state = read.result; state.pending.payloadHash = 'broken'; store.put(state, `${owner}:${id}`); }; tx.oncomplete = () => { db.close(); resolve(); }; }; }), { id: corrupt.id, owner: 'USER:' + admin.id });
  await page.evaluate(() => clientEdit.sync()); assert.equal(await page.locator('#saveEditClient').isDisabled(), true); assert.equal(await page.locator('#clientEditRetry').isDisabled(), true); assert.equal(await audits(corrupt.id), 0);
  assert.equal((await stored(page, corrupt.id)).pending.payloadHash, 'broken');
  // Restore only the deliberately corrupted QA fixture, then recover through the real UI.
  await page.evaluate(({ id, owner, state }) => new Promise(resolve => { const request = indexedDB.open('cw-client-edits-v1', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('edits', 'readwrite'); tx.objectStore('edits').put(state, `${owner}:${id}`); tx.oncomplete = () => { db.close(); resolve(); }; }; }), { id: corrupt.id, owner: 'USER:' + admin.id, state: validStored });
  await page.reload({ waitUntil: 'networkidle' }); await open(page, corrupt.id); await retry(page); assert.equal(await audits(corrupt.id), 1);
  console.log('PASS incomplete reads and corrupt pending data fail closed; failed draft storage requires keeping or explicitly discarding the draft');

  await page.locator('#cancelEditClient').click(); await page.addScriptTag({ url: base + '/cw-flow-shell.js' });
  await page.locator('#password').fill('Generic QA secret'); assert(!(await storageText(page)).includes('Generic QA secret'));
  await page.locator('#password').fill(''); await open(page, first.id); await page.locator('#editPassword').fill('Managed QA secret');
  assert(!(await storageText(page)).includes('Managed QA secret')); assert.equal(await page.evaluate(() => localStorage.getItem('cw:lastform:editClientForm')), null);
  await page.evaluate(() => { localStorage.setItem('cw:lastform:key', 'editClientForm'); localStorage.setItem('cw:lastform:editClientForm', JSON.stringify({ name: 'Wrong restored name', password: 'Wrong restored password' })); });
  await page.evaluate(() => document.querySelector('.cw-undo').click()); assert.equal(await page.locator('#editName').inputValue(), 'Nome revisto'); assert.equal(await page.locator('#editPassword').inputValue(), 'Managed QA secret');
  await page.locator('#editPassword').fill('');
  console.log('PASS generic navigation/form memory excludes credentials and cannot restore over the managed editor');

  const session = fixtures[9]; await open(page, session.id); await page.locator('#editName').fill('Pedido da conta original'); await page.locator('#editPassword').fill('Account QA password');
  await page.route(endpoint(session.id), route => route.abort('internetdisconnected')); await submit(page); await page.unroute(endpoint(session.id)); const original = (await stored(page, session.id)).pending;
  const second = await prisma.user.create({ data: { name: 'Another QA admin', email: `client-edit-other-${Date.now()}@qa.test`, role: 'ADMIN', active: true, password: await bcrypt.hash('Isolated only', 4) } });
  const secondToken = jwt.sign({ id: second.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token: secondToken, id: second.id });
  await page.evaluate(() => clientEdit.sync()); assert.equal(await page.locator('#editName').inputValue(), ''); assert.equal(await page.locator('#editPassword').inputValue(), ''); assert.equal(await page.locator('#saveEditClient').isDisabled(), true);
  assert.deepEqual((await stored(page, session.id)).pending, original); assert.equal(await audits(session.id), 0);
  await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.locator('#clientEditPendingList').isVisible(), false);
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token, id: admin.id });
  await page.reload({ waitUntil: 'networkidle' }); await open(page, session.id); await retry(page); assert.equal(await page.locator('#editPassword').isDisabled(), false);
  await page.locator('#editPassword').fill('Account QA password'); await retry(page); assert.equal(await audits(session.id), 1);
  console.log('PASS account changes clear visible data, isolate saved requests and require the original account to recover');
  assert.deepEqual(errors, []);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
