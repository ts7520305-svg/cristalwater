'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
function gate() { let release; return { promise: new Promise(resolve => { release = resolve; }), release: value => release(value) }; }
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers, body: '{"language":"pt"}' });
  const client = await prisma.client.create({ data: { name: 'Cliente <b>literal</b> pagamento QA', status: 'ACTIVE' } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', amount: 100, total: 100, totalAmount: 100, amountOpen: 100,
    lines: { create: [{ type: 'SERVICE', description: 'Pagamento QA', quantity: 1, unitPrice: 100, total: 100, lineTotal: 100 }] } } });
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN', name: 'Pagamentos QA' }));
  }, { token, id: admin.id });
  const page = await context.newPage(), other = await context.newPage();
  const errors = []; for (const tab of [page, other]) { tab.setDefaultTimeout(10000); tab.on('pageerror', error => errors.push(error.message)); }
  const url = base + `/invoices?clientId=${client.id}`, endpoint = base + `/api/payments/invoice/${invoice.id}`, list = base + '/api/invoices';
  const key = `cwInvoicePayment:v1:ADMIN:${admin.id}`;
  const pending = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
  const count = () => prisma.payment.count({ where: { invoiceId: invoice.id } });
  const state = () => prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  const panel = page.locator('#invoicePaymentPending'), status = page.locator('#statusBox');
  async function open(tab, amount = '10') {
    await tab.locator(`[data-invoice-id="${invoice.id}"] [data-invoice-payment]`).click();
    assert.equal(await tab.locator('#paymentModal').evaluate(element => getComputedStyle(element).position), 'fixed');
    await tab.locator('#paymentAmountInput').fill(amount);
    await tab.locator('#paymentNotesInput').fill('Comprovativo <b>literal</b> QA');
  }
  await page.goto(url, { waitUntil: 'networkidle' }); await other.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.cw-v2-sidebar').isVisible(), false, 'Mobile navigation must not expose the desktop sidebar in the document');
  assert.equal(await page.locator('.cw-v2-drawer').isVisible(), false, 'The navigation drawer starts closed');
  assert.equal(await page.locator('.cw-v2-shell-topbar').evaluate(element => getComputedStyle(element).position), 'fixed');
  await other.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await other.locator('.cw-v2-sidebar').isVisible(), true);
  assert.equal(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await open(other); const stale = await other.evaluate(() => ({ ...paymentModalState }));
  await open(page);
  const entered = gate(), release = gate(); let firstReply, posts = 0, firstBody;
  await page.route(endpoint, async route => {
    posts++; firstBody = route.request().postDataJSON(); const response = await route.fetch(); firstReply = await response.json();
    entered.release(); await release.promise; await route.fulfill({ status: 502, json: { error: 'QA lost acknowledgement' } });
  });
  await page.evaluate(() => { window.paymentSend = submitPaymentModal(); });
  await entered.promise;
  try {
    assert.equal(await count(), 1); assert.equal((await state()).amountPaid, 10);
    await page.evaluate(() => { submitPaymentModal(); closePaymentModal(); });
    await other.evaluate(() => submitPaymentModal());
    assert.equal(posts, 1);
    assert.equal(await page.locator('#paymentConfirm').isDisabled(), true);
    assert.equal((await pending()).requestId, firstBody.requestId);
  } finally { release.release(); }
  await page.evaluate(() => window.paymentSend); await page.unroute(endpoint);
  assert.equal(await panel.isVisible(), true); assert.match(await panel.textContent(), /Cliente <b>literal<\/b>/);
  assert.equal(await panel.locator('b').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (process.env.CW_PAYMENT_VISUAL_PATH) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: process.env.CW_PAYMENT_VISUAL_PATH, fullPage: true });
  }
  const original = await pending();
  await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await pending(), original);
  assert.equal(await page.locator('[data-invoice-payment]').isDisabled(), true);
  console.log('PASS duplicate clicks and two tabs send once; lost response retains immutable request and literal client/notes across reload at mobile width');

  for (const fake of [{ ok: true, invoice: { id: invoice.id }, appliedAmount: 10 },
    { ...firstReply, invoice: { ...firstReply.invoice, clientId: client.id + 1 } },
    { ...firstReply, requestReceipt: { ...firstReply.requestReceipt, requestId: randomUUID() } },
    { ...firstReply, requestReceipt: { ...firstReply.requestReceipt, appliedCents: 999 } }]) {
    await page.route(endpoint, route => route.fulfill({ json: fake }));
    await panel.getByRole('button', { name: 'Confirmar pagamento guardado', exact: true }).click();
    await page.waitForFunction(() => !invoicePayment.busy());
    assert.deepEqual(await pending(), original); assert.equal(await count(), 1);
    await page.unroute(endpoint);
  }
  await panel.getByRole('button', { name: 'Confirmar pagamento guardado', exact: true }).click();
  await page.waitForFunction(() => !invoicePayment.busy());
  assert.equal(await pending(), null); assert.equal(await count(), 1); assert.equal((await state()).amountPaid, 10);
  assert.match(await status.textContent(), /Pagamento confirmado/);
  assert.equal(await page.locator('#sumOpen').textContent(), '90.00 EUR');
  await other.evaluate(({ stale }) => {
    paymentModalState = stale; document.getElementById('paymentAmountInput').value = '10';
    return submitPaymentModal();
  }, { stale });
  assert.equal(await count(), 1); assert.match(await other.locator('#statusBox').textContent(), /mudou/);
  console.log('PASS missing, mismatched and financially inconsistent confirmations cannot clear the request; recovery does not duplicate; a stale form cannot submit a new payment');

  await open(page, '20'); let committed = false;
  await page.route(list, route => committed ? route.fulfill({ status: 503, json: { error: 'QA unavailable' } }) : route.continue());
  await page.route(endpoint, async route => { const response = await route.fetch(); committed = true; await route.fulfill({ response }); });
  await page.evaluate(() => submitPaymentModal());
  assert.equal(await pending(), null); assert.equal(await count(), 2); assert.equal((await state()).amountPaid, 30);
  assert.equal(await page.locator('[data-invoice-payment]').isDisabled(), true);
  assert.match(await status.textContent(), /Pagamento confirmado.*atualizar o saldo/);
  await page.unroute(endpoint); await page.unroute(list); await page.evaluate(() => loadInvoices());
  assert.equal(await page.locator('#sumOpen').textContent(), '70.00 EUR');
  await open(page);
  await page.evaluate(() => {
    window.originalPaymentStorage = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('cwInvoicePayment:')) throw Error('QA quota'); return window.originalPaymentStorage.call(this, key, value); };
  });
  await page.evaluate(() => submitPaymentModal());
  assert.equal(await count(), 2); assert.match(await status.textContent(), /guardar o pagamento/);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalPaymentStorage; });
  await page.evaluate(key => localStorage.setItem(key, '{broken'), key);
  await page.reload({ waitUntil: 'networkidle' }); await page.evaluate(() => submitPaymentModal());
  assert.equal(await count(), 2); assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{broken');
  assert.match(await panel.textContent(), /conservado para revisão/);
  await page.evaluate(key => localStorage.removeItem(key), key); await page.reload({ waitUntil: 'networkidle' });
  console.log('PASS acknowledged payment with failed balance refresh blocks fresh payments; storage quota sends nothing; corrupt saved data is preserved and blocks writes');

  await open(page); const sessionEntered = gate(), sessionRelease = gate();
  await page.route(endpoint, async route => { const response = await route.fetch(); sessionEntered.release(); await sessionRelease.promise; await route.fulfill({ response }); });
  await page.evaluate(() => { window.sessionPaymentSend = submitPaymentModal(); }); await sessionEntered.promise;
  try { await page.evaluate(() => localStorage.setItem('token', 'changed-session')); } finally { sessionRelease.release(); }
  await page.evaluate(() => window.sessionPaymentSend); await page.unroute(endpoint);
  assert.equal(await count(), 3); assert.equal(await panel.isVisible(), false);
  assert.equal(await page.locator('[data-invoice-id]').count(), 0); assert.notEqual(await pending(), null);
  await page.reload({ waitUntil: 'networkidle' });
  await panel.getByRole('button', { name: 'Confirmar pagamento guardado', exact: true }).click();
  await page.waitForFunction(() => !invoicePayment.busy()); assert.equal(await pending(), null); assert.equal(await count(), 3);
  console.log('PASS account change hides the late acknowledgement and financial data; return to the original account recovers the original payment once');

  await open(page);
  await page.route(endpoint, async route => { await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'DRAFT' } }); await route.continue(); });
  await page.evaluate(() => submitPaymentModal()); await page.unroute(endpoint);
  assert.equal((await pending()).rejection.status, 409); assert.equal(await count(), 3);
  assert.equal(await panel.getByRole('button', { name: 'Confirmar pagamento guardado', exact: true }).isDisabled(), true);
  await panel.getByRole('button', { name: 'Rever pagamento', exact: true }).click();
  await page.waitForFunction(() => !invoicePayment.busy()); assert.equal(await pending(), null);
  assert.equal(await page.locator('[data-invoice-payment]').count(), 0);
  assert.deepEqual(errors, []); await context.close();
  console.log('PASS server rejection after the fresh read requires explicit review and refresh; a draft cannot be charged');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
