'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
function gate() { let release; return { promise: new Promise(resolve => { release = resolve; }), release: () => release() }; }
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, month = new Date().toISOString().slice(0, 7);
  const createClient = name => prisma.client.create({ data: { name, status: 'ACTIVE', creditBalance: 0 } });
  const read = id => prisma.client.findUniqueOrThrow({ where: { id } });
  const payload = (expectedCreditCents = 0, amount = '10.01') => ({ requestId: randomUUID(), month, amount, notes: 'Ajuste interno QA', expectedCreditCents });
  async function post(id, body, expected = 200, customHeaders = headers) {
    const r = await fetch(base + `/api/billing/client/${id}/credit`, { method: 'POST', headers: customHeaders, body: JSON.stringify(body) });
    const data = await r.json(); assert.equal(r.status, expected, JSON.stringify(data)); return data;
  }
  const client = await createClient('Crédito auditado QA'), original = await read(client.id), request = payload();
  const receipts = await Promise.all(Array.from({ length: 8 }, () => post(client.id, request)));
  assert.equal(new Set(receipts.map(r => r.adjustmentId)).size, 1);
  assert.equal((await read(client.id)).creditBalance, 10.01);
  const audit = await prisma.auditTrail.findUniqueOrThrow({ where: { id: receipts[0].adjustmentId } });
  assert.equal(audit.userId, admin.id); assert.equal(audit.message, request.notes);
  assert.deepEqual(audit.beforeJson, { creditCents: 0 }); assert.deepEqual(audit.afterJson, { creditCents: 1001 });
  assert.equal(audit.metadata.kind, 'NON_CASH_ADJUSTMENT');
  assert.equal(await prisma.auditTrail.count({ where: { clientId: client.id, eventType: 'CLIENT_CREDIT_ADJUSTED' } }), 1);
  assert.equal(await prisma.communicationLog.count({ where: { clientId: client.id, channel: 'CREDIT_ADJUSTMENT' } }), 1);
  assert.equal(await prisma.invoice.count({ where: { clientId: client.id } }), 0);
  assert.equal((await read(client.id)).lastPaymentAt, original.lastPaymentAt); assert.equal((await read(client.id)).paymentStatus, original.paymentStatus);
  const otherClient = await createClient('Crédito distinto QA');
  for (const patch of [{ amount: '11' }, { notes: 'Motivo diferente' }, { expectedCreditCents: 1001 }, { month: '2030-01' }]) await post(client.id, { ...request, ...patch }, 409);
  await post(otherClient.id, request, 409);
  const secondAdmin = await prisma.user.create({ data: { name: 'Crédito segundo admin QA', email: `credit-${randomUUID()}@qa.test`, password: admin.password, role: 'ADMIN', active: true } });
  await post(client.id, request, 409, { ...headers, Authorization: `Bearer ${jwt.sign({ id: secondAdmin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}` });
  for (const patch of [{ requestId: undefined }, { notes: '' }, { expectedCreditCents: undefined }, { expectedCreditCents: -1 }, { method: 'CASH' }, { amount: '0.001' }, { amount: -1 }, { month: '0000-01' }]) await post(client.id, { ...payload(1001), ...patch }, 400);
  await post(client.id, payload(), 401, { 'Content-Type': 'application/json' });
  const race = await Promise.all([payload(1001, '2'), payload(1001, '3')].map(async body => {
    const r = await fetch(base + `/api/billing/client/${client.id}/credit`, { method: 'POST', headers, body: JSON.stringify(body) }); return r.status;
  }));
  assert.deepEqual(race.sort(), [200, 409]);
  const replay = await post(client.id, request); assert.equal(replay.idempotent, true); assert.equal(replay.afterCreditCents, 1001);
  const cross = await fetch(base + `/api/admin/payments/${client.id}/manual-received`, { method: 'POST', headers, body: JSON.stringify({ ...request, method: 'CASH' }) });
  assert.equal(cross.status, 409);
  console.log('PASS concurrent retries grant once; owner/data/global key conflicts, required reason, balance precondition, original acknowledgement and non-cash semantics');

  for (const table of ['AuditTrail', 'CommunicationLog', 'OperationalReminder']) {
    const failed = await createClient(`Crédito rollback ${table} QA`), before = await read(failed.id), body = payload();
    const condition = table === 'OperationalReminder' ? `NEW."sourceKey" = 'invoice-payment:${body.requestId}'` : `NEW."clientId" = ${failed.id}`;
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_adjustment_failure() RETURNS trigger AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA adjustment failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_adjustment_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_adjustment_failure()`);
    try {
      await post(failed.id, body, 500); assert.deepEqual(await read(failed.id), before);
      assert.equal(await prisma.auditTrail.count({ where: { clientId: failed.id } }), 0);
      assert.equal(await prisma.communicationLog.count({ where: { clientId: failed.id } }), 0);
      assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `invoice-payment:${body.requestId}` } }), 0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_adjustment_failure ON "${table}"`);
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_adjustment_failure()');
    }
    await post(failed.id, body); await post(failed.id, body); assert.equal((await read(failed.id)).creditBalance, 10.01);
  }
  console.log('PASS audit, communication and acknowledgement failures roll back the whole adjustment; recovery grants once');

  const uiClient = await createClient('Cliente <b>literal</b> crédito QA');
  const invoice = await prisma.invoice.create({ data: { clientId: uiClient.id, monthRef: month, status: 'ISSUED', amount: 20, total: 20, totalAmount: 20, amountOpen: 20,
    lines: { create: [{ type: 'SERVICE', description: 'Serviço <img src=x onerror=alert(1)>', quantity: 1, unitPrice: 20, total: 20, lineTotal: 20 }] } } });
  const draft = await prisma.invoice.create({ data: { clientId: otherClient.id, monthRef: month, status: 'DRAFT', amount: 99, total: 99, totalAmount: 99, amountOpen: 99 } });
  const listResponse = await fetch(base + `/api/billing/monthly?monthRef=${month}`, { headers }); assert.equal(listResponse.status, 200);
  const listing = await listResponse.json();
  assert(listing.clients.some(c => c.id === client.id)); assert(listing.items.some(i => i.invoiceId === invoice.id)); assert(!listing.items.some(i => i.invoiceId === draft.id));
  assert.equal(listing.totals.totalAmount, listing.items.reduce((n, i) => n + Math.round(i.total * 100), 0) / 100);
  assert.equal((await fetch(base + '/api/billing/monthly?monthRef=wrong', { headers })).status, 400);
  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers, body: '{"language":"pt"}' });
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN', name: 'Crédito QA' }));
  }, { token, id: admin.id });
  const page = await context.newPage(), second = await context.newPage(), errors = [];
  for (const tab of [page, second]) { tab.setDefaultTimeout(10000); tab.on('pageerror', e => errors.push(e.message)); }
  const endpoint = `${base}/api/billing/client/${uiClient.id}/credit`, list = `${base}/api/billing/monthly?*`, key = `cwCreditAdjustment:v1:ADMIN:${admin.id}`;
  const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
  const idle = tab => tab.waitForFunction(() => !busy);
  async function open(tab = page) {
    await tab.locator('#creditClient').selectOption(String(uiClient.id)); await tab.locator('#creditOpen').click();
    await tab.locator('#creditAmount').fill('2.01'); await tab.locator('#creditReason').fill('Oferta <b>literal</b> QA');
  }
  async function confirm(tab = page) { await tab.locator('#creditConfirm').click(); await idle(tab); }
  async function recover() { await page.locator('#creditRetry').click(); await idle(page); }
  await page.goto(base + '/billing', { waitUntil: 'networkidle' }); await second.goto(base + '/billing', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.cw-v2-sidebar').isVisible(), false);
  assert.equal(await page.locator('.cw-v2-shell-topbar').evaluate(e => getComputedStyle(e).position), 'fixed');
  await second.setViewportSize({ width: 1440, height: 1000 }); assert.equal(await second.locator('.cw-v2-sidebar').isVisible(), true);
  for (const tab of [page, second]) assert(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.locator(`[data-invoice-id="${invoice.id}"] b, [data-invoice-id="${invoice.id}"] img`).count(), 0);
  await open(); await page.locator('#creditCancel').click(); assert.equal((await read(uiClient.id)).creditBalance, 0);
  await open(); await page.keyboard.press('Escape'); assert.equal(await page.locator('#creditModal').isVisible(), false);
  await open(second); await open();
  if (process.env.CW_CREDIT_VISUAL_PATH) await page.screenshot({ path: process.env.CW_CREDIT_VISUAL_PATH });
  const entered = gate(), release = gate(); let posts = 0, firstReply, firstBody;
  await page.route(endpoint, async route => { posts++; firstBody = route.request().postDataJSON(); const r = await route.fetch(); firstReply = await r.json(); entered.release(); await release.promise; await route.fulfill({ status: 502, json: { error: 'QA lost reply' } }); });
  await page.evaluate(() => { window.sending = submitCredit({ preventDefault() {} }); }); await entered.promise;
  try {
    await page.evaluate(() => submitCredit({ preventDefault() {} })); await second.evaluate(() => submitCredit({ preventDefault() {} }));
    assert.equal(posts, 1); assert.equal((await stored()).requestId, firstBody.requestId); assert.equal((await read(uiClient.id)).creditBalance, 2.01);
  } finally { release.release(); }
  await page.evaluate(() => window.sending); await page.unroute(endpoint);
  assert.equal(await page.locator('#creditPending').isVisible(), true);
  await page.reload({ waitUntil: 'networkidle' }); await recover(); assert.equal(await stored(), null); assert.equal((await read(uiClient.id)).creditBalance, 2.01);
  console.log('PASS mobile/desktop, escaped names/lines, cancellation, double-click, two windows and lost-acknowledgement recovery');

  await open(); await page.route(endpoint, route => route.fulfill({ status: 200, json: firstReply })); await confirm();
  assert(await stored()); assert.match(await page.locator('#status').textContent(), /não corresponde/);
  await page.unroute(endpoint); await recover(); assert.equal((await read(uiClient.id)).creditBalance, 4.02);
  await page.evaluate(() => loadBilling()); await open(); await post(uiClient.id, payload(402, '1'));
  await confirm(); assert.equal(await stored(), null); assert.equal((await read(uiClient.id)).creditBalance, 5.02);
  assert.match(await page.locator('#status').textContent(), /saldo mudaram/);
  await open(); await page.route(endpoint, async route => { await post(uiClient.id, payload(502, '1')); await route.continue(); });
  await confirm(); await page.unroute(endpoint); assert.equal((await stored()).rejected, 409); assert.equal(await page.locator('#creditRetry').isDisabled(), true);
  await page.locator('#creditReview').click(); await idle(page); assert.equal(await stored(), null); assert.equal((await read(uiClient.id)).creditBalance, 6.02);
  await open(); let didPost = false;
  await page.route(endpoint, async route => { const r = await route.fetch(); didPost = true; await route.fulfill({ response: r }); });
  await page.route(list, async route => { if (didPost) await route.fulfill({ status: 503, json: {} }); else await route.continue(); });
  const oldTotal = await page.locator('#totalAmount').textContent(); await confirm();
  assert.equal(await stored(), null); assert.equal(await page.locator('#totalAmount').textContent(), oldTotal); assert.equal(await page.locator('#creditOpen').isDisabled(), true);
  await page.unroute(endpoint); await page.unroute(list); await page.evaluate(() => loadBilling());
  console.log('PASS mismatched acknowledgement preserved, stale balance blocked, conflict reviewed and failed refresh keeps last values without permitting new grants');

  await open(); const enteredTamper = gate(), releaseTamper = gate();
  await page.route(endpoint, async route => { const r = await route.fetch(); enteredTamper.release(); await releaseTamper.promise; await route.fulfill({ response: r }); });
  await page.evaluate(() => { window.sending = submitCredit({ preventDefault() {} }); }); await enteredTamper.promise;
  const originalPending = await stored();
  try { await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify({ ...p, notes: 'Alterado durante a resposta' })), { key, p: originalPending }); }
  finally { releaseTamper.release(); }
  await page.evaluate(() => window.sending); assert.equal((await stored()).notes, 'Alterado durante a resposta');
  await page.unroute(endpoint); await page.evaluate(({ key, p }) => localStorage.setItem(key, JSON.stringify(p)), { key, p: originalPending }); await recover();
  const oldRead = gate(), releaseRead = gate();
  await page.route(list, async route => {
    if (new URL(route.request().url()).searchParams.get('monthRef') === month) { const r = await route.fetch(); oldRead.release(); await releaseRead.promise; await route.fulfill({ response: r }); }
    else await route.continue();
  });
  await page.evaluate(() => { window.oldRead = loadBilling(); }); await oldRead.promise;
  try { await page.evaluate(async () => { document.getElementById('monthRef').value = '2041-11'; await loadBilling(); }); }
  finally { releaseRead.release(); }
  await page.evaluate(() => window.oldRead); assert.equal(await page.locator(`[data-invoice-id="${invoice.id}"]`).count(), 0);
  await page.unroute(list); await page.evaluate(async month => { document.getElementById('monthRef').value = month; await loadBilling(); }, month);
  console.log('PASS a changed saved payload is never discarded on acknowledgement, and late list responses cannot overwrite another month');

  await open(); let blockedPosts = 0; await page.route(endpoint, async route => { blockedPosts++; await route.continue(); });
  await page.evaluate(key => { window.originalStorageSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === key) throw Error('QA quota'); return window.originalStorageSet.call(this, k, v); }; }, key);
  await confirm(); assert.equal(blockedPosts, 0);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageSet; }); await page.locator('#creditCancel').click(); await page.unroute(endpoint);
  await page.evaluate(key => localStorage.setItem(key, '{broken'), key); await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{broken'); assert.equal(await page.locator('#creditOpen').isDisabled(), true);
  await page.evaluate(key => localStorage.removeItem(key), key); await page.reload({ waitUntil: 'networkidle' });
  await open(); const enteredSession = gate(), releaseSession = gate();
  await page.route(endpoint, async route => { const r = await route.fetch(); enteredSession.release(); await releaseSession.promise; await route.fulfill({ response: r }); });
  await page.evaluate(() => { window.sending = submitCredit({ preventDefault() {} }); }); await enteredSession.promise;
  try { await page.evaluate(() => { localStorage.setItem('token', 'changed-session'); }); } finally { releaseSession.release(); }
  await page.evaluate(() => window.sending); assert(await stored()); assert.equal(await page.locator('#billingList').textContent(), '');
  await page.unroute(endpoint); await page.reload({ waitUntil: 'networkidle' }); await recover(); assert.equal(await stored(), null);
  await page.route(list, route => route.fulfill({ status: 503, json: {} })); await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#totalAmount').textContent(), '-'); assert.equal(await page.locator('#creditOpen').isDisabled(), true);
  await page.unroute(list);
  assert.equal(await prisma.payment.count({ where: { invoice: { clientId: uiClient.id } } }), 0);
  assert.deepEqual(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }), invoice);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS storage quota/corruption, session change and initial load failure; adjustments never create payments or settle an invoice');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
