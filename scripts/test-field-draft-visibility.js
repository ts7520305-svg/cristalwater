'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function get(path) {
    const response = await fetch(base + path, { headers }); assert.equal(response.status, 200);
    return response.json();
  }
  const dashboardBefore = await get('/api/dashboard/admin');
  const client = await prisma.client.create({ data: { name: 'Rascunho visivel <b>literal</b> QA', status: 'ACTIVE' } });
  const create = (status, total, values = {}) => prisma.invoice.create({ data: { clientId: client.id, status, amount: total, total, totalAmount: total,
    amountOpen: total, month: new Date().toISOString().slice(0, 7), year: new Date().getUTCFullYear(), ...values } });
  const draft = await create('DRAFT', 20), zero = await create('DRAFT', 0), cancelled = await create('CANCELLED', 30), pending = await create('PENDING', 40), paid = await create('PAID', 50, { amountPaid: 50, amountOpen: 0 });
  const api = await get(`/api/invoices/client/${client.id}`);
  for (const row of [draft, zero, cancelled]) assert.equal(api.find(item => item.id === row.id).amountOpen, 0);
  assert.equal(api.find(item => item.id === draft.id).totalAmount, 20);
  const dashboard = await get('/api/dashboard/admin');
  assert.equal(dashboard.summary.totalBilledAll - dashboardBefore.summary.totalBilledAll, 90);
  assert.equal(dashboard.summary.totalOpenAll - dashboardBefore.summary.totalOpenAll, 40);
  assert.equal(dashboard.summary.paidInvoices - dashboardBefore.summary.paidInvoices, 1);
  assert.equal(dashboard.summary.totalInvoicesAll - dashboardBefore.summary.totalInvoicesAll, 2);
  assert(!dashboard.topDebtors.some(row => [draft.id, zero.id, cancelled.id].includes(row.invoiceId)));
  const month = new Date().toISOString().slice(0, 7);
  const evolution = dashboard.monthlyEvolution.find(row => row.month === month), oldEvolution = dashboardBefore.monthlyEvolution.find(row => row.month === month);
  assert.equal(evolution.billed - oldEvolution.billed, 90); assert.equal(evolution.open - oldEvolution.open, 40);
  console.log('PASS invoice API and administrative dashboard preserve draft face value without debt, billed totals, paid counts or debtor ranking');
  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers, body: '{"language":"pt"}' });
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN', name: 'Rascunhos QA' }));
  }, { token, id: admin.id });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const url = base + `/invoices?clientId=${client.id}`, endpoint = base + '/api/invoices';
  const card = row => page.locator(`[data-invoice-id="${row.id}"]`), status = page.locator('#statusBox');
  await page.goto(url, { waitUntil: 'networkidle' });
  console.log(JSON.stringify({ cards: await page.locator('.invoice-title').allTextContents(), labels: await page.locator('.invoice-badge:not(.month)').allTextContents(), total: await page.locator('#sumAmount').textContent(), open: await page.locator('#sumOpen').textContent() }));
  assert.equal(await page.locator('#sumOpen').textContent(), '40.00 EUR', 'Drafts and cancelled documents must not count as open debt');
  assert.equal(await page.locator('#sumAmount').textContent(), '90.00 €');
  assert.equal(await page.locator('#sumInvoices').textContent(), '2');
  assert.equal(await page.locator('#sumPending').textContent(), '1');
  assert.equal(await card(draft).locator('.invoice-title').textContent(), `Rascunho #${draft.id}`);
  assert.match(await card(draft).textContent(), /<b>literal<\/b>/);
  for (const row of [draft, zero, cancelled, paid]) assert.equal(await card(row).getByRole('button', { name: 'Registar pagamento', exact: true }).count(), 0);
  assert.equal(await card(draft).getByRole('button', { name: 'Abrir PDF', exact: true }).count(), 0);
  assert.equal(await card(pending).getByRole('button', { name: 'Registar pagamento', exact: true }).count(), 1);
  assert.equal(await card(draft).locator('.invoice-badge.month').textContent(), `${month.slice(5)}/${month.slice(0, 4)}`);
  const ids = () => page.locator('[data-invoice-id]').evaluateAll(rows => rows.map(row => Number(row.dataset.invoiceId)).sort((a,b) => a-b));
  for (const [filter, expected] of [['draft', [draft.id, zero.id]], ['pending', [pending.id]], ['overdue', [pending.id]], ['paid', [paid.id]]]) {
    await page.locator('#statusFilter').selectOption(filter);
    await page.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('[data-invoice-id]')].map(row => Number(row.dataset.invoiceId)).sort((a,b) => a-b)) === JSON.stringify(expected), expected);
    assert.deepEqual(await ids(), expected);
  }
  await page.goto(url + '&status=draft', { waitUntil: 'networkidle' });
  assert.deepEqual(await ids(), [draft.id, zero.id]); assert.equal(await page.locator('#sumOpen').textContent(), '0.00 EUR');
  await page.evaluate(id => { openPaymentModal(id, 999); openInvoicePdf(id); }, draft.id);
  assert.equal(await page.locator('#paymentModal').getAttribute('aria-hidden'), 'true');
  assert.equal(context.pages().length, 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.goto(url, { waitUntil: 'networkidle' });
  console.log('PASS literal draft labels, correct totals, period and filters; zero draft is never paid; drafts expose neither collection nor PDF actions; direct stale handlers cannot bypass them');

  const beforeRead = await ids();
  await page.route(endpoint, route => route.fulfill({ status: 503, json: { ok: false } }));
  assert.equal(await page.evaluate(() => loadInvoices()), false);
  assert.deepEqual(await ids(), beforeRead); assert.match(await status.textContent(), /ultima consulta/);
  assert.equal(await page.locator('#sumOpen').textContent(), '40.00 EUR');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#sumOpen').textContent(), '—'); assert.equal(await page.locator('[data-invoice-id]').count(), 0);
  await page.unroute(endpoint);
  assert.equal(await page.evaluate(() => loadInvoices()), true);
  await page.route(endpoint, route => route.fulfill({ json: { ok: true, invoices: [] } }));
  assert.equal(await page.evaluate(() => loadInvoices()), false);
  assert.equal(await page.locator('#sumOpen').textContent(), '40.00 EUR');
  await page.unroute(endpoint);
  console.log('PASS failed and malformed reads preserve the last values; failed initial read shows unknown amounts and permits recovery');

  let release, entered, reads = 0;
  const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  await page.route(endpoint, async route => { if (++reads > 1) return route.continue(); const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }); });
  await page.evaluate(() => { window.delayedInvoiceRead = loadInvoices(); }); await started;
  try {
    await prisma.invoice.update({ where: { id: draft.id }, data: { status: 'ISSUED' } });
    assert.equal(await page.evaluate(() => loadInvoices()), true);
    assert.equal(await card(draft).getByRole('button', { name: 'Registar pagamento', exact: true }).count(), 1);
  } finally { release(); }
  await page.evaluate(() => window.delayedInvoiceRead);
  await page.unroute(endpoint);
  assert.match(await card(draft).textContent(), /EMITIDA/);
  await card(draft).getByRole('button', { name: 'Registar pagamento', exact: true }).click();
  assert.equal(await page.locator('#paymentAmountInput').inputValue(), '20.00');
  await prisma.invoice.update({ where: { id: draft.id }, data: { status: 'DRAFT' } });
  await page.locator('#paymentModal').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await status.filter({ hasText: 'rascunho' }).waitFor();
  assert.equal(await prisma.payment.count({ where: { invoiceId: draft.id } }), 0);
  await page.evaluate(() => closePaymentModal()); await page.evaluate(() => loadInvoices());
  console.log('PASS older read cannot restore an obsolete draft; explicit issue enables collection; server rejects a document returned to draft after opening the payment form');

  await card(pending).getByRole('button', { name: 'Registar pagamento', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('token', 'changed-session'));
  await page.locator('#paymentModal').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await status.filter({ hasText: 'A sessao mudou' }).waitFor();
  assert.equal(await prisma.payment.count({ where: { invoiceId: pending.id } }), 0);
  assert.equal(await page.locator('[data-invoice-id]').count(), 0);
  await page.reload({ waitUntil: 'networkidle' });
  let releaseSession, enteredSession;
  const sessionGate = new Promise(resolve => { releaseSession = resolve; }), sessionStarted = new Promise(resolve => { enteredSession = resolve; });
  await page.route(endpoint, async route => { const response = await route.fetch(); enteredSession(); await sessionGate; await route.fulfill({ response }); });
  await page.evaluate(() => { window.sessionInvoiceRead = loadInvoices(); }); await sessionStarted;
  try { await page.evaluate(() => localStorage.setItem('token', 'changed-during-read')); } finally { releaseSession(); }
  await page.evaluate(() => window.sessionInvoiceRead);
  assert.equal(await page.locator('[data-invoice-id]').count(), 0); assert.equal(await page.locator('#sumOpen').textContent(), '—');
  assert.deepEqual(errors, []); await context.close();
  console.log('PASS account change prevents payment and hides values; a late read cannot display the previous account');

  const advanceClient = await prisma.client.create({ data: { name: 'Credito sem divida de rascunho QA', status: 'ACTIVE' } });
  const advanceDraft = await create('DRAFT', 20, { clientId: advanceClient.id });
  const advance = await fetch(base + `/api/admin/payments/${advanceClient.id}/manual-received`, { method: 'POST', headers, body: '{"amount":10}' });
  assert.equal(advance.status, 200);
  const advanceState = await prisma.client.findUnique({ where: { id: advanceClient.id } });
  assert.equal(advanceState.creditBalance, 10); assert.equal(advanceState.paymentStatus, 'PAID');
  assert.deepEqual(await prisma.invoice.findUnique({ where: { id: advanceDraft.id } }), advanceDraft);
  console.log('PASS a client with only an unreviewed draft and an advance is not labelled partially paid');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
