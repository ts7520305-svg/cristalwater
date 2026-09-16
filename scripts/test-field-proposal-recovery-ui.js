'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto');
const fs = require('node:fs'), path = require('node:path');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser; const releases = [];
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const tech = await prisma.technician.create({ data: { name: 'Proposal browser recovery', active: true } });
  const techToken = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'Proposal browser owner', creditBalance: 32 } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Proposal recovery UI', monthlyAmount: 145, volumeM3: 48,
    technicalSheet: { create: { volumeM3: 48 } }, calculationProfile: { create: { lengthM: 8, widthM: 4, averageDepthM: 1.5, volumeM3: 48 } },
    equipment: { create: { pumpPower: '1 CV' } }, technicalRoom: { create: { notes: 'Original room' } } } });
  await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, technicianId: tech.id, plannedDate: new Date(), status: 'PLANNED' } });
  const endpoint = base + '/api/core/pools/' + pool.id + '/technical-change-proposals';
  const api = async (suffix, body) => { const response = await fetch(endpoint + suffix, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); assert(response.ok, await response.clone().text()); return response.json(); };
  const create = async changes => (await api('', { requestId: randomUUID(), reason: 'Browser review', changes: changes || [{ field: 'pumpPower', after: '2 CV' }] })).proposal;
  const transition = async (proposal, nextStatus) => (await api('/' + proposal.id + '/workflow', { requestId: randomUUID(), expectedVersion: proposal.version, nextStatus })).proposal;
  const counts = async () => ({ proposals: await prisma.technicalHistory.count({ where: { poolId: pool.id, type: 'TECHNICAL_CHANGE_PROPOSAL' } }), events: await prisma.technicalHistory.count({ where: { poolId: pool.id, type: 'TECHNICAL_PROPOSAL_WORKFLOW_EVENT' } }), sheets: await prisma.technicalHistory.count({ where: { poolId: pool.id, type: 'TECHNICAL_SHEET_CHANGE' } }), notes: await prisma.technicalHistory.count({ where: { poolId: pool.id, type: 'TECHNICAL_SHEET_NOTE' } }) });
  const records = page => page.evaluate(() => new Promise((resolve, reject) => { const open = indexedDB.open('cw-technical-proposal-requests-v1', 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction('requests'), read = tx.objectStore('requests').getAll(); tx.oncomplete = () => { db.close(); resolve(read.result); }; }; }));
  const intercept = (page, suffix, fn) => page.route(endpoint + suffix, route => route.request().method() === 'POST' ? fn(route) : route.continue());
  const retry = async (page, requestId) => { const selector = '[data-proposal-retry="' + requestId + '"]'; await page.locator(selector).click(); await page.waitForFunction(selector => !document.querySelector(selector)?.disabled, selector); };
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const context = async (credential, id, role) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(({ credential, id, role }) => { if (!localStorage.getItem('qaProposalSession')) { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, credential); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role })); localStorage.setItem('cwTechnicianId', String(id)); localStorage.setItem('cw_language', 'pt'); localStorage.setItem('qaProposalSession', '1'); } }, { credential, id, role }); return ctx; };
  const newPage = async ctx => { const page = await ctx.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message)); return page; };
  const fieldOpen = async page => { await page.goto(base + '/technician-field-mode?technicianId=' + tech.id, { waitUntil: 'networkidle' }); await page.waitForFunction(name => document.getElementById('nextTitle').textContent.includes(name), pool.name); await page.locator('[data-field-tab-button="docs"]').click(); };
  const techContext = await context(techToken, tech.id, 'TECHNICIAN'), field = await newPage(techContext); await fieldOpen(field);
  await field.locator('#proposalFieldName').fill('pumpPower'); await field.locator('#proposalAfterValue').fill('2 CV'); await field.locator('#proposalReason').fill('Measured <b>literal</b>');
  await field.evaluate(() => { window.qaProposalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value, key) { if (this.transaction.db.name === 'cw-technical-proposal-requests-v1') throw Error('QA quota'); return window.qaProposalPut.call(this, value, key); }; });
  await field.locator('#submitTechnicalProposalBtn').click(); await field.waitForFunction(() => document.getElementById('technicalProposalStatus').textContent.includes('guardar'));
  assert.equal((await counts()).proposals, 0); assert.equal((await records(field)).length, 0); assert.equal(await field.locator('#proposalReason').inputValue(), 'Measured <b>literal</b>');
  await field.evaluate(() => { IDBObjectStore.prototype.put = window.qaProposalPut; });
  const draft = await field.evaluate(() => { const key = Object.keys(sessionStorage).find(key => key.startsWith('cwTechnicalProposalDraft:')); return [key, sessionStorage.getItem(key)]; });
  const twin = await newPage(techContext); await fieldOpen(twin); await twin.evaluate(([key, value]) => sessionStorage.setItem(key, value), draft); await fieldOpen(twin);
  let release, entered, original; const gate = new Promise(resolve => { release = resolve; releases.push(resolve); }), started = new Promise(resolve => { entered = resolve; });
  await intercept(field, '', async route => { original = route.request().postDataJSON(); await route.fetch(); entered(); await gate; await route.abort('connectionfailed'); });
  await field.locator('#submitTechnicalProposalBtn').click(); await started;
  const blocked = await twin.evaluate(async ({ poolId, body }) => { const client = CWProposalRequests.create(); const { requestId, ...intent } = body; try { await client.send('CREATE', poolId, null, intent, crypto.randomUUID()); return 'unexpected'; } catch (error) { return error.message; } }, { poolId: pool.id, body: original });
  assert.match(blocked, /janela|guardado/); release(); await field.waitForFunction(() => document.getElementById('technicalProposalStatus').textContent.includes('Sem confirmação')); await field.unroute(endpoint);
  assert.equal((await counts()).proposals, 1); assert.equal(await field.locator('#proposalReason').isDisabled(), true);
  await fieldOpen(field); assert.equal(await field.locator('#proposalReason').inputValue(), 'Measured <b>literal</b>');
  const pending = (await records(field)).find(row => row.phase === 'pending'); assert.equal(pending.record.requestId, original.requestId);
  for (const malformed of [result => ({ status: 202, json: result }), () => ({ status: 201, json: { ok: true } }), result => ({ status: 201, json: { ...result, receipt: { ...result.receipt, actorKey: 'TECHNICIAN:999999' } } }), result => ({ status: 201, json: { ...result, proposal: { ...result.proposal, reason: 'Wrong reason' } } }), () => ({ status: 400, json: { ok: false, code: 'UNVERIFIED_ERROR' } })]) {
    await intercept(field, '', async route => { assert.deepEqual(route.request().postDataJSON(), original); const response = await route.fetch(); await route.fulfill(malformed(await response.json())); });
    await retry(field, original.requestId); await field.unroute(endpoint); assert.deepEqual((await records(field)).find(row => row.record.requestId === original.requestId), pending);
  }
  await field.evaluate(() => { window.qaProposalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (value, key) { if (this.transaction.db.name === 'cw-technical-proposal-requests-v1' && value.phase === 'confirmed') throw Error('QA receipt quota'); return window.qaProposalPut.call(this, value, key); }; });
  await retry(field, original.requestId); assert.deepEqual((await records(field)).find(row => row.record.requestId === original.requestId), pending); assert.equal(await field.locator('#proposalReason').inputValue(), 'Measured <b>literal</b>');
  await field.evaluate(() => { IDBObjectStore.prototype.put = window.qaProposalPut; });
  await retry(field, original.requestId); await field.waitForFunction(() => document.getElementById('proposalReason').value === ''); await twin.waitForFunction(() => document.getElementById('proposalReason').value === '');
  assert.equal((await counts()).proposals, 1); assert.equal((await records(field))[0].phase, 'confirmed');
  console.log('PASS actual technician form: durable-before-send, quota failure, two tabs, response loss/reload, invalid acknowledgements and one confirmed proposal');

  // Corrupt recovery data is never silently overwritten, and belongs to its account.
  const corruptContext = await context(techToken, tech.id, 'TECHNICIAN'), corrupt = await newPage(corruptContext); await fieldOpen(corrupt);
  await corrupt.locator('#proposalFieldName').fill('pumpPower'); await corrupt.locator('#proposalAfterValue').fill('3 CV'); await corrupt.locator('#proposalReason').fill('Private unsent proposal');
  await intercept(corrupt, '', route => route.abort('internetdisconnected')); await corrupt.locator('#submitTechnicalProposalBtn').click(); await corrupt.waitForFunction(() => document.getElementById('technicalProposalStatus').textContent.includes('Sem confirmação')); await corrupt.unroute(endpoint);
  await corrupt.evaluate(() => new Promise(resolve => { const request = indexedDB.open('cw-technical-proposal-requests-v1', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('requests', 'readwrite'), store = tx.objectStore('requests'), read = store.openCursor(); read.onsuccess = () => { const cursor = read.result; if (cursor) { const entry = cursor.value; entry.record.payloadHash = 'broken'; cursor.update(entry); } }; tx.oncomplete = () => { db.close(); resolve(); }; }; }));
  await fieldOpen(corrupt); assert.equal(await corrupt.locator('#submitTechnicalProposalBtn').isDisabled(), true); assert.match(await corrupt.locator('#technicalProposalRecovery').textContent(), /não são válidos/); assert.equal((await counts()).proposals, 1);
  await corrupt.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token, id: admin.id });
  await corrupt.waitForFunction(() => document.getElementById('proposalReason').value === ''); await corrupt.goto(base + '/admin-pool-technical?poolId=' + pool.id, { waitUntil: 'networkidle' }); assert.equal(await corrupt.locator('#proposalRequestRecovery').isVisible(), false); assert.equal((await records(corrupt))[0].record.payloadHash, 'broken');
  console.log('PASS corrupt records fail closed and switching accounts hides the previous account’s draft and recovery data');

  const adminContext = await context(token, admin.id, 'ADMIN'), page = await newPage(adminContext);
  const adminOpen = async () => { await page.goto(base + '/admin-pool-technical?poolId=' + pool.id, { waitUntil: 'networkidle' }); await page.waitForFunction(() => document.getElementById('sheetForm').getAttribute('aria-busy') === 'false'); };
  const reviewProposal = await create(); await adminOpen(); let workflow;
  await intercept(page, '/' + reviewProposal.id + '/workflow', async route => { workflow = route.request().postDataJSON(); await route.fetch(); await route.abort('connectionfailed'); });
  await page.locator('[data-proposal-id="' + reviewProposal.id + '"][data-proposal-transition="IN_REVIEW"]').click(); await page.waitForFunction(() => document.getElementById('status').textContent.includes('Sem confirmação')); await page.unroute(endpoint + '/' + reviewProposal.id + '/workflow');
  const afterDecision = await counts(); await adminOpen(); await retry(page, workflow.requestId); assert.deepEqual(await counts(), afterDecision);
  let latest = (await api('')).proposals.find(p => p.id === reviewProposal.id); latest = await transition(latest, 'APPROVED');
  const batchProposal = await create(); await adminOpen(); await page.locator('[data-proposal-select="' + latest.id + '"]').check(); await page.locator('[data-proposal-select="' + batchProposal.id + '"]').check(); let batch;
  await intercept(page, '/workflow/batch', async route => { batch = route.request().postDataJSON(); await route.fetch(); await route.abort('connectionfailed'); }); await page.locator('#proposalBatchReviewBtn').click(); await page.waitForFunction(() => document.getElementById('proposalBatchStatus').textContent.includes('Sem confirmação')); await page.unroute(endpoint + '/workflow/batch');
  const afterBatch = await counts(); await adminOpen(); await retry(page, batch.requestId); await page.waitForFunction(() => document.getElementById('proposalBatchStatus').textContent.includes('1 atualizada(s), 1 falha(s)') && !document.getElementById('proposalBatchReviewBtn').disabled);
  assert.equal(await page.locator('[data-proposal-select="' + latest.id + '"]').isChecked(), true); assert.equal(await page.locator('[data-proposal-select="' + batchProposal.id + '"]').isChecked(), false); assert.deepEqual(await counts(), afterBatch);
  console.log('PASS actual admin decisions and partial batches recover their original result after reload and retain failed selections');

  const application = await transition(await create([{ field: 'lengthM', before: '8', after: '10' }, { field: 'technicalRoomNotes', before: 'Original room', after: 'Proposed room' }, { field: 'historyNote', after: 'One application note' }]), 'APPROVED');
  await prisma.technicalRoom.update({ where: { poolId: pool.id }, data: { notes: 'Later room' } }); await adminOpen(); await page.locator('#pumpType').fill('Unsaved equipment draft');
  const openApplication = async () => { await page.locator('[data-proposal-apply="' + application.id + '"]').click(); await page.waitForSelector('[data-proposal-resolution="lengthM"]'); };
  const choose = async () => { await page.locator('[data-proposal-resolution="technicalRoomNotes"]').selectOption('CURRENT'); await page.waitForFunction(() => !document.querySelector('[data-proposal-application-confirm]').disabled); };
  await openApplication(); assert.equal(await page.locator('[data-proposal-application-confirm]').isDisabled(), true); assert.equal(await page.locator('[data-proposal-resolution="technicalRoomNotes"]').inputValue(), ''); await choose();
  assert.match(await page.locator('[data-proposal-application-effects]').textContent(), /48.*60/);
  const evidence = path.join(process.cwd(), 'reports/field-visual/proposal-recovery'); fs.mkdirSync(evidence, { recursive: true });
  for (const [lang, title] of Object.entries({ pt: 'Aplicar proposta à ficha técnica', en: 'Apply proposal to technical sheet', fr: 'Appliquer la proposition à la fiche', es: 'Aplicar propuesta a la ficha técnica', de: 'Vorschlag im Datenblatt anwenden' })) {
    await page.locator('[data-proposal-application-close]').click(); await page.evaluate(lang => CristalI18n.applyLanguage(lang), lang); await openApplication(); await choose();
    assert.equal(await page.locator('#proposalApplicationTitle').textContent(), title);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await page.locator('#proposalApplicationDialog').evaluate(el => { el.scrollTop = 0; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scroll: el.scrollWidth, client: el.clientWidth, width: innerWidth, height: innerHeight }; });
      assert(box.left >= 0 && box.right <= box.width && box.top >= 0 && box.bottom <= box.height && box.scroll <= box.client + 1, lang + ': ' + JSON.stringify(box));
    }
  }
  await page.locator('[data-proposal-application-close]').click(); await page.evaluate(() => CristalI18n.applyLanguage('pt')); await page.setViewportSize({ width: 390, height: 844 }); await openApplication(); await choose();
  await page.locator('#proposalApplicationDialog').evaluate(el => { el.scrollTop = 0; }); await page.screenshot({ path: path.join(evidence, 'application-390.png') });
  await prisma.poolEquipment.update({ where: { poolId: pool.id }, data: { pumpPower: 'Changed after comparison' } });
  await page.locator('[data-proposal-application-confirm]').click(); await page.waitForFunction(() => document.querySelector('[data-proposal-application-status]').textContent.includes('mudou')); assert.equal((await counts()).sheets, 0);
  await page.locator('[data-proposal-application-reopen]').click(); await page.waitForSelector('[data-proposal-resolution="lengthM"]'); await choose(); let applyBody;
  await intercept(page, '/' + application.id + '/apply', async route => { applyBody = route.request().postDataJSON(); await route.fetch(); await route.abort('connectionfailed'); });
  await page.locator('[data-proposal-application-confirm]').click(); await page.waitForFunction(() => document.querySelector('[data-proposal-application-status]').textContent.includes('Sem confirmação')); await page.unroute(endpoint + '/' + application.id + '/apply');
  await page.locator('[data-proposal-application-close]').click(); assert.equal(await page.locator('#pumpType').inputValue(), 'Unsaved equipment draft');
  const afterApply = await counts(); assert.equal(afterApply.notes, 1); assert.equal(afterApply.sheets, 1); await adminOpen(); assert.equal(await page.locator('#pumpType').inputValue(), 'Unsaved equipment draft');
  const applyPending = (await records(page)).find(row => row.record.requestId === applyBody.requestId);
  await intercept(page, '/' + application.id + '/apply', async route => { assert.deepEqual(route.request().postDataJSON(), applyBody); const result = await (await route.fetch()).json(); result.application.effects[0].after = 999; result.proposal.application = result.application; await route.fulfill({ status: 200, json: result }); });
  await retry(page, applyBody.requestId); await page.unroute(endpoint + '/' + application.id + '/apply'); assert.deepEqual((await records(page)).find(row => row.record.requestId === applyBody.requestId), applyPending);
  await retry(page, applyBody.requestId); await page.waitForFunction(() => document.getElementById('proposalBatchStatus').textContent.includes('aplicada'));
  assert.equal(await page.locator('#pumpType').inputValue(), 'Unsaved equipment draft'); assert.deepEqual(await counts(), afterApply);
  const saved = await prisma.pool.findUniqueOrThrow({ where: { id: pool.id }, include: { calculationProfile: true, technicalSheet: true, technicalRoom: true, equipment: true } });
  assert.equal(saved.volumeM3, 60); assert.equal(saved.technicalSheet.volumeM3, 60); assert.equal(saved.calculationProfile.volumeM3, 60); assert.equal(saved.technicalRoom.notes, 'Later room'); assert.equal(saved.monthlyAmount, 145); assert.equal(saved.equipment.pumpType, null);
  assert.equal(await page.locator('[data-proposal-apply="' + application.id + '"]').count(), 0);
  console.log('PASS actual application dialog requires drift choices, exposes calculated volume, rejects stale comparisons, verifies effects on replay and preserves a dirty sheet draft');

  const late = await create(); await adminOpen(); let releaseLate, enteredLate, lateBody;
  const lateGate = new Promise(resolve => { releaseLate = resolve; releases.push(resolve); }), lateArrival = new Promise(resolve => { enteredLate = resolve; });
  await intercept(page, '/' + late.id + '/workflow', async route => { lateBody = route.request().postDataJSON(); const response = await route.fetch(); enteredLate(); await lateGate; await route.fulfill({ response }).catch(() => {}); });
  await page.locator('[data-proposal-id="' + late.id + '"][data-proposal-transition="IN_REVIEW"]').click(); await lateArrival; const lateCounts = await counts();
  const otherAdmin = await prisma.user.create({ data: { name: 'Other proposal reviewer', email: 'proposal-reviewer-' + Date.now() + '@qa.test', role: 'ADMIN', active: true, password: 'QA unused' } });
  const otherToken = jwt.sign({ id: otherAdmin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const account = async (credential, id) => page.evaluate(({ credential, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, credential); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { credential, id });
  await account(otherToken, otherAdmin.id); await page.waitForFunction(() => document.getElementById('technicalProposalAdminList').textContent === ''); releaseLate();
  await page.unroute(endpoint + '/' + late.id + '/workflow'); assert.equal((await records(page)).find(row => row.record.requestId === lateBody.requestId).phase, 'pending');
  await adminOpen(); assert.equal(await page.locator('#proposalRequestRecovery').isVisible(), false);
  await account(token, admin.id); await adminOpen(); await retry(page, lateBody.requestId); assert.deepEqual(await counts(), lateCounts);
  console.log('PASS a late decision response cannot confirm or reveal the old account’s request; the original account can recover it once');
  assert.deepEqual(errors, []);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const release of releases) release(); await browser?.close(); await prisma.$disconnect(); });
