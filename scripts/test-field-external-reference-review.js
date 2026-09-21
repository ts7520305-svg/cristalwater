'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.FISCAL_ISSUING_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const routes = [id => `/api/invoices/${id}/review-external-reference`, id => `/api/core/invoices/${id}/review-external-reference`];
const stamp = 'QA review ' + randomUUID(), gate = () => { let release; return { promise: new Promise(r => { release = r; }), release }; };
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const user = { id: admin.id, role: 'ADMIN' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const client = await prisma.client.create({ data: { name: stamp, requiresInvoice: true } });
  const other = await prisma.client.create({ data: { name: stamp + ' historical', requiresInvoice: false } });
  const fixture = (data = {}) => prisma.invoice.create({ data: { clientId: client.id, status: 'PAID', invoiceIssued: true, total: 12.3, totalAmount: 12.3, amount: 12.3, amountPaid: 12.3, amountOpen: 0, notes: 'Nota histórica intacta', issueDate: new Date('2020-01-02T00:00:00Z'),
    lines: { create: [{ description: 'Manutenção histórica', quantity: 1, unitPrice: 10.1, total: 10.1, lineTotal: 10.1 }, { description: 'Intervenção periódica', quantity: 1, unitPrice: 2.2, total: 2.2, lineTotal: 2.2 }] },
    payments: { create: { amount: 12.3, amountCents: 1230, method: 'CASH' } }, ...data }, include: { lines: true } });
  async function call(url, body, custom = headers) { const r = await fetch(base + url, { headers: custom, ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}) }); return { status: r.status, body: await r.json().catch(() => null), headers: r.headers }; }
  const listing = async (q = stamp, filter = 'all') => { const r = await call(`/api/invoices/to-issue?status=${filter}&q=${encodeURIComponent(q)}`); assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /no-store/); return r.body; };
  const find = async id => (await listing()).clients.flatMap(c => c.invoices).find(row => row.id === id);
  async function intent(id, decision = 'CONFIRM_EXTERNAL') { const row = await find(id); assert(row); return { requestId: randomUUID(), decision, note: 'Conferido com os documentos originais', externalInvoiceNo: row.externalInvoiceNo, expectedClientId: row.clientId,
    externalReferenceReviewToken: row.externalReferenceReview.token, reviewedLineIds: row.lines.map(line => line.id) }; }
  const snapshot = async id => ({ invoice: await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { id: 'asc' } }, payments: { orderBy: { id: 'asc' } } } }),
    audit: await prisma.auditTrail.findMany({ where: { entity: 'Invoice', entityId: id }, orderBy: { id: 'asc' } }),
    logs: await prisma.communicationLog.findMany({ where: { referenceId: id, channel: { in: ['EXTERNAL_INVOICE_REVIEW', 'EXTERNAL_INVOICE'] } }, orderBy: { id: 'asc' } }) });
  const copiedNumber = stamp + ' INT', legacyNumber = stamp + ' FT';
  const copied = await fixture({ invoiceNumber: copiedNumber, externalInvoiceNo: copiedNumber, clientId: other.id, invoiceIssued: false });
  const legacy = await fixture({ externalInvoiceNo: legacyNumber, status: 'CANCELLED', clientId: other.id });
  const dupeNumber = stamp + ' DUP', duplicate = await fixture({ externalInvoiceNo: ' \u00a0' + dupeNumber + '\ufeff' });
  const owner = await fixture({ clientId: other.id, invoiceNumber: dupeNumber, externalInvoiceNo: null, invoiceIssued: false, status: 'DRAFT' });
  const invalid = await fixture({ externalInvoiceNo: 'bad\nreference' });
  const beforeReads = await Promise.all([copied, legacy, duplicate, invalid].map(row => snapshot(row.id)));
  let data = await listing();
  assert.equal((await find(copied.id)).externalReferenceReview.status, 'INTERNAL_MATCH');
  assert.equal((await find(legacy.id)).externalReferenceReview.status, 'REVIEW_REQUIRED');
  assert.equal((await find(duplicate.id)).externalReferenceReview.status, 'DUPLICATE_REFERENCE');
  assert.deepEqual((await find(duplicate.id)).externalReferenceReview.conflictInvoiceIds, [owner.id]);
  assert.equal((await find(invalid.id)).externalReferenceReview.status, 'INVALID_REFERENCE');
  assert(data.summary.reviewReferences >= 4); assert((await listing(stamp, 'review')).clients.length >= 2);
  assert.deepEqual(await Promise.all([copied, legacy, duplicate, invalid].map(row => snapshot(row.id))), beforeReads, 'Reading must not reclassify or rewrite legacy records');
  const flat = await call('/api/core/invoices/external'); assert.equal(flat.status, 200); assert.equal(flat.body.invoices.find(i => i.id === copied.id).externalReferenceReview.status, 'INTERNAL_MATCH');
  for (const route of [id => `/api/invoices/${id}/mark-issued`, id => `/api/core/invoices/${id}/mark-external-issued`]) {
    const fresh = await fixture({ externalInvoiceNo: null }); assert.equal((await call(route(fresh.id), { externalInvoiceNo: dupeNumber })).status, 409);
  }
  const draft = await fixture({ status: 'DRAFT', amountPaid: 0, payments: { create: [] } });
  assert.equal((await call(`/api/finance-os/invoices/${draft.id}/issue`, { invoiceNumber: dupeNumber })).status, 409);
  console.log('PASS legacy/internal/invalid/conflicting references are signalled without writes; trimmed Unicode duplicates include internal-only documents outside the fiscal list');

  const payload = await intent(legacy.id), unchanged = await snapshot(legacy.id);
  for (const route of routes) {
    for (const patch of [{ decision: 'AUTO' }, { externalInvoiceNo: {} }, { note: '' }, { note: 'x'.repeat(1001) }, { requestId: 'wrong' }, { expectedClientId: true }, { reviewedLineIds: [legacy.lines[0].id, legacy.lines[0].id] }, { externalReferenceReviewToken: '' }]) assert.equal((await call(route(legacy.id), { ...payload, ...patch })).status, 400);
    for (const patch of [{ reviewedLineIds: [] }, { reviewedLineIds: [legacy.lines[0].id] }, { expectedClientId: client.id }, { externalInvoiceNo: 'Different number' }, { externalReferenceReviewToken: '0'.repeat(64) }]) assert.equal((await call(route(legacy.id), { ...payload, ...patch })).status, 409);
    for (const id of ['0', '01', '-1', '1.5', '2147483648']) assert.equal((await call(route(id), payload)).status, 400);
    assert.equal((await call(route(legacy.id), payload, { 'Content-Type': 'application/json' })).status, 401);
    const clientToken = jwt.sign({ id: client.id, clientId: client.id, principalType: 'CLIENT', role: 'CLIENT' }, getJwtSecret());
    assert.equal((await call(route(legacy.id), payload, { ...headers, Authorization: 'Bearer ' + clientToken })).status, 403);
  }
  assert.deepEqual(await snapshot(legacy.id), unchanged);
  assert.equal((await call(routes[0](duplicate.id), await intent(duplicate.id))).status, 409);
  assert.equal((await call(routes[1](legacy.id), { ...payload, decision: 'INTERNAL_ONLY' })).status, 409, 'An unrelated external number cannot be erased');
  const first = await call(routes[0](legacy.id), payload); assert.equal(first.status, 200, JSON.stringify(first.body));
  const saved = await snapshot(legacy.id); assert.deepEqual(saved.invoice, unchanged.invoice); assert.equal(saved.audit.length, 1); assert.equal(saved.logs.length, 1);
  assert.equal(saved.audit[0].metadata.actor, 'ADMIN:' + admin.id); assert.equal(saved.audit[0].metadata.snapshot.lines.length, 2); assert.equal(saved.audit[0].metadata.note, payload.note);
  assert.equal((await find(legacy.id)).externalReferenceReview.status, 'CONFIRMED');
  assert.equal((await call(routes[1](legacy.id), payload)).body.idempotent, true); assert.deepEqual(await snapshot(legacy.id), saved);
  assert.equal((await call(routes[0](legacy.id), { ...payload, note: 'Changed decision' })).status, 409);
  assert.equal((await call(routes[1](legacy.id), { ...payload, requestId: randomUUID() })).status, 409);
  console.log('PASS both aliases require authenticated explicit decisions and complete/current review; a cancelled historical reference can be confirmed without touching its financial document, and retries write once');

  const internalPayload = await intent(copied.id, 'INTERNAL_ONLY'), original = await snapshot(copied.id);
  assert.equal((await call(routes[1](copied.id), internalPayload)).status, 200);
  const cleared = await snapshot(copied.id), { externalInvoiceNo: ignored1, updatedAt: ignored2, ...beforeInvoice } = original.invoice;
  const { externalInvoiceNo: clearedValue, updatedAt: ignored3, ...afterInvoice } = cleared.invoice;
  assert.equal(clearedValue, null); assert.deepEqual(afterInvoice, beforeInvoice); assert.equal(cleared.audit[0].beforeJson.externalInvoiceNo, copiedNumber);
  let row = await find(copied.id); assert.equal(row.externalReferenceReview.status, 'INTERNAL_ONLY'); assert.equal(row.externalRegistrationAllowed, false);
  assert((await listing(copiedNumber)).clients.some(c => c.historyInvoices.some(i => i.id === copied.id)), 'Review history must remain searchable even without an invoice request or issued flag');
  assert.equal((await call(routes[0](copied.id), internalPayload)).body.idempotent, true); assert.deepEqual(await snapshot(copied.id), cleared);
  await prisma.invoice.update({ where: { id: copied.id }, data: { requiresInvoice: true } }); row = await find(copied.id); assert.equal(row.externalRegistrationAllowed, true);
  const official = stamp + ' REAL';
  assert.equal((await call(`/api/invoices/${copied.id}/mark-issued`, { externalInvoiceNo: official, expectedClientId: other.id, externalReviewToken: row.externalReviewToken, reviewedLineIds: row.lines.map(l => l.id) })).status, 200);
  const newlyRegistered = await snapshot(copied.id); assert.equal(newlyRegistered.invoice.invoiceNumber, copiedNumber); assert.equal(newlyRegistered.invoice.externalInvoiceNo, official);
  assert.equal((await find(copied.id)).externalReferenceHistory.length, 2);
  assert.equal((await call(routes[1](copied.id), internalPayload)).body.idempotent, true); assert.deepEqual(await snapshot(copied.id), newlyRegistered, 'Replaying the old correction must not erase a later real external reference');
  assert.equal((await call(routes[0](copied.id), await intent(copied.id, 'INTERNAL_ONLY'))).status, 409);

  for (const decision of ['CONFIRM_EXTERNAL', 'INTERNAL_ONLY']) for (const table of ['CommunicationLog', 'AuditTrail']) {
    const number = stamp + randomUUID(), doc = await fixture({ invoiceNumber: number, externalInvoiceNo: number }), body = await intent(doc.id, decision), before = await snapshot(doc.id);
    const condition = table === 'CommunicationLog' ? `NEW.channel = 'EXTERNAL_INVOICE_REVIEW' AND NEW."referenceId" = ${doc.id}` : `NEW.action = 'EXTERNAL_INVOICE_REFERENCE_REVIEWED' AND NEW."entityId" = ${doc.id}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_reference_review_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA reference review rollback'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_reference_review_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_reference_review_failure()`);
    try { assert.equal((await call(routes[0](doc.id), body)).status, 500); assert.deepEqual(await snapshot(doc.id), before); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_reference_review_failure ON "${table}"`); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_reference_review_failure()'); }
    assert.equal((await call(routes[1](doc.id), body)).status, 200);
  }
  const repeated = await fixture({ externalInvoiceNo: stamp + ' repeat' }), repeatBody = await intent(repeated.id);
  const repeats = await Promise.all(Array.from({ length: 8 }, (_, i) => call(routes[i % 2](repeated.id), repeatBody)));
  assert(repeats.every(r => r.status === 200), JSON.stringify(repeats)); assert.equal((await snapshot(repeated.id)).audit.length, 1);
  const raceNo = stamp + ' race', race = await fixture({ invoiceNumber: raceNo, externalInvoiceNo: raceNo }), raceBody = await intent(race.id);
  const raced = await Promise.all([call(routes[0](race.id), raceBody), call(routes[1](race.id), { ...raceBody, requestId: randomUUID(), decision: 'INTERNAL_ONLY' })]);
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 409]); assert.equal((await snapshot(race.id)).audit.length, 1);
  console.log('PASS explicit internal correction preserves prices/payments/numbers/notes and searchable history; later registration survives replay, both decisions roll back atomically, and concurrent decisions cannot overwrite each other');

  const stale = await fixture({ externalInvoiceNo: stamp + ' stale' }), staleBody = await intent(stale.id);
  await prisma.invoiceLine.update({ where: { id: stale.lines[0].id }, data: { description: 'Alteração depois da consulta' } }); assert.equal((await call(routes[0](stale.id), staleBody)).status, 409);
  const conflictBody = await intent(stale.id); await fixture({ externalInvoiceNo: ' ' + stale.externalInvoiceNo + ' ' }); assert.equal((await call(routes[1](stale.id), conflictBody)).status, 409);
  const confirmedRow = await find(copied.id); await prisma.invoice.update({ where: { id: copied.id }, data: { externalInvoiceNo: null } });
  const mismatch = await find(copied.id); assert.equal(mismatch.externalReferenceReview.status, 'HISTORY_MISMATCH'); assert.equal(mismatch.externalRegistrationAllowed, false);
  assert.equal((await call(`/api/invoices/${copied.id}/mark-issued`, { externalInvoiceNo: official })).status, 409);
  await prisma.invoice.update({ where: { id: copied.id }, data: { externalInvoiceNo: confirmedRow.externalInvoiceNo } });
  console.log('PASS changed services, newly conflicting references and out-of-band removal of a confirmed reference require renewed/documentary review');

  const uiClient = await prisma.client.create({ data: { name: 'Piscina da Quinta — ' + stamp, requiresInvoice: true } });
  const uiNumber = stamp + ' UI INT', uiCopy = await fixture({ clientId: uiClient.id, invoiceNumber: uiNumber, externalInvoiceNo: uiNumber });
  const uiUnknown = await fixture({ clientId: uiClient.id, externalInvoiceNo: 'FT QA <img src=x onerror=window.qaInjected=true> ' + randomUUID() });
  const uiDuplicate = await fixture({ clientId: uiClient.id, externalInvoiceNo: uiNumber });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 1000 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await context.addInitScript(({ user, token }) => { for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); localStorage.setItem('cw_language', 'pt'); }, { user, token });
  const page = await context.newPage(), errors = [], posts = []; page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message)); page.on('request', r => { if (r.url().endsWith('/review-external-reference')) posts.push(r.postDataJSON()); });
  const ready = () => page.waitForFunction(() => document.getElementById('status').textContent.includes('cliente(s) visíveis'));
  const form = id => page.locator(`form[data-invoice-id="${id}"][data-reference-review]`), save = id => form(id).locator('[type=submit]');
  await page.goto(base + '/to-issue?status=review&q=' + encodeURIComponent(uiClient.name), { waitUntil: 'networkidle' }); await ready();
  assert.equal(await page.locator('#statusFilter').inputValue(), 'review'); assert.equal(await form(uiDuplicate.id).locator('[type=submit]').count(), 0);
  assert.equal(await form(uiCopy.id).locator('option[value=CONFIRM_EXTERNAL]').count(), 0); assert.equal(await page.locator('#list img').count(), 0);
  async function fill(id, decision, note = 'Conferido no arquivo original <script>window.qaInjected=true</script>') { for (const box of await form(id).locator('input[type=checkbox]').all()) await box.check(); await form(id).locator('[name=referenceDecision]').selectOption(decision); await form(id).locator('[name=referenceNote]').fill(note); }
  async function accept(id) { await save(id).click(); await page.locator('.cw-ui-modal button').filter({ hasText: 'Registar decisão' }).click(); }
  assert.equal(await save(uiCopy.id).isDisabled(), true); await fill(uiCopy.id, 'INTERNAL_ONLY'); await save(uiCopy.id).click();
  assert.match(await page.locator('.cw-ui-modal').textContent(), /retirada do campo fiscal/); await page.locator('.cw-ui-modal button').filter({ hasText: 'Cancelar' }).click(); assert.equal(posts.length, 0);
  const evidence = path.join(__dirname, '..', 'reports', 'field-visual', 'external-reference-review-' + Date.now()); fs.mkdirSync(evidence, { recursive: true });
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => scrollTo(0, 0)); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await page.screenshot({ path: path.join(evidence, width + '.png'), fullPage: true }); }
  const copyUrl = base + routes[0](uiCopy.id);
  await page.route(copyUrl, async route => { await route.fetch(); await route.abort('failed'); });
  await save(uiCopy.id).click(); await save(uiCopy.id).dispatchEvent('click'); assert.equal(await page.locator('.cw-ui-modal').count(), 1); await page.locator('.cw-ui-modal button').filter({ hasText: 'Registar decisão' }).click();
  await page.waitForFunction(id => document.querySelector(`form[data-invoice-id="${id}"] .external-result`).textContent.includes('mesma decisão'), uiCopy.id);
  assert.equal((await snapshot(uiCopy.id)).invoice.externalInvoiceNo, null); assert.equal(posts.length, 1);
  await page.unroute(copyUrl); await accept(uiCopy.id); await ready(); assert.equal(await form(uiCopy.id).count(), 0); assert.deepEqual(posts[0], posts[1]); assert.equal((await snapshot(uiCopy.id)).audit.length, 1);
  assert.match(await page.locator('#list').textContent(), /Revisto como número interno/); assert.equal(await page.evaluate(() => !!window.qaInjected), false);

  await fill(uiUnknown.id, 'CONFIRM_EXTERNAL'); const beforeSwitch = posts.length; await save(uiUnknown.id).click();
  await page.locator('#search').fill('outra seleção'); await page.locator('#search').fill(uiClient.name); await page.locator('.cw-ui-modal button').filter({ hasText: 'Registar decisão' }).click(); assert.equal(posts.length, beforeSwitch);
  await page.locator('#refreshBtn').click(); await ready(); await fill(uiUnknown.id, 'CONFIRM_EXTERNAL'); await save(uiUnknown.id).click();
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'token' }))); await page.locator('.cw-ui-modal button').filter({ hasText: 'Registar decisão' }).click(); assert.equal(posts.length, beforeSwitch); assert.equal(await page.locator('form.reference-review').count(), 0);
  await page.locator('#refreshBtn').click(); await ready(); await fill(uiUnknown.id, 'CONFIRM_EXTERNAL');
  const unknownUrl = base + routes[0](uiUnknown.id);
  await page.route(unknownUrl, route => route.fulfill({ status: 200, contentType: 'application/json', json: { ok: true, invoiceId: uiCopy.id, clientId: uiClient.id, decision: 'CONFIRM_EXTERNAL' } }));
  await accept(uiUnknown.id); await page.waitForFunction(id => document.querySelector(`form[data-invoice-id="${id}"] .external-result`).textContent.includes('não corresponde'), uiUnknown.id); assert.equal((await snapshot(uiUnknown.id)).audit.length, 0); await page.unroute(unknownUrl);
  await prisma.invoiceLine.update({ where: { id: uiUnknown.lines[0].id }, data: { description: 'Linha revista após consulta no navegador' } });
  await accept(uiUnknown.id); await page.waitForFunction(id => document.querySelector(`form[data-invoice-id="${id}"] .external-result`).textContent.includes('mudaram'), uiUnknown.id); assert.equal((await snapshot(uiUnknown.id)).audit.length, 0);
  await page.locator('#refreshBtn').click(); await ready(); await fill(uiUnknown.id, 'CONFIRM_EXTERNAL');
  const arrived = gate(), release = gate(), finished = gate();
  await page.route(unknownUrl, async route => { const response = await route.fetch(); arrived.release(); await release.promise; try { await route.fulfill({ response }); } catch (e) { if (!/closed|handled|cancel/i.test(e.message)) throw e; } finally { finished.release(); } });
  await accept(uiUnknown.id); await arrived.promise; await page.locator('#refreshBtn').click(); await ready(); release.release(); await finished.promise; await page.unroute(unknownUrl);
  assert.equal(await form(uiUnknown.id).count(), 0); assert.equal((await snapshot(uiUnknown.id)).audit.length, 1); assert.match(await page.locator('#list').textContent(), /Referência externa confirmada/);
  const invalidList = await listing(uiClient.name);
  const forged = invalidList.clients.flatMap(c => c.issuedInvoices).find(row => row.id === uiDuplicate.id);
  forged.externalReferenceReview = { ...forged.externalReferenceReview, status: 'CONFIRMED', needsReview: false, canConfirm: false, canMarkInternal: false };
  forged.externalRegistration = null;
  await page.route('**/api/invoices/to-issue?*', route => route.fulfill({ status: 200, contentType: 'application/json', json: invalidList }));
  await page.locator('#refreshBtn').click(); await page.waitForFunction(() => document.getElementById('status').textContent.includes('incompleta'));
  assert.equal(await page.locator('#list form').count(), 0); assert.equal((await snapshot(uiDuplicate.id)).audit.length, 0);
  assert.equal(await page.evaluate(() => !!window.qaInjected), false); assert.deepEqual(errors, []);
  console.log('PASS real browser review filter, duplicate warnings, explicit motive/decision, responsive layout, lost-response replay, session/selection changes, stale services and late/wrong acknowledgements');
  console.log('Evidence: ' + evidence);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
