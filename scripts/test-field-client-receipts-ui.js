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
  const client = await prisma.client.create({ data: { name: 'Cliente <b>literal</b> recebimento QA', status: 'ACTIVE', monthlyFee: 80 } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', amount: 100, total: 100, totalAmount: 100, amountOpen: 100,
    lines: { create: [{ type: 'SERVICE', description: 'Recebimento QA', quantity: 1, unitPrice: 100, total: 100, lineTotal: 100 }] } } });
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN', name: 'Recebimentos QA' }));
  }, { token, id: admin.id });
  const page = await context.newPage(), other = await context.newPage();
  const errors = []; for (const tab of [page, other]) { tab.setDefaultTimeout(10000); tab.on('pageerror', error => errors.push(error.message)); }
  const url = base + '/admin-collection', endpoint = `${base}/api/admin/payments/${client.id}/manual-received*`, list = `${base}/api/admin/payments?*`;
  const key = `cwClientReceipt:v1:ADMIN:${admin.id}`;
  const pending = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), key);
  const count = () => prisma.payment.count({ where: { invoice: { clientId: client.id } } });
  const state = () => prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  const panel = page.locator('#clientReceiptPending'), status = page.locator('#collectionStatus');
  const card = tab => tab.locator(`[data-client-id="${client.id}"]`);
  async function filter(tab) { await tab.locator('#searchFilter').fill(client.name); }
  async function open(tab, amount = '10') {
    await card(tab).locator('[data-client-receipt]').click();
    assert.equal(await tab.locator('#clientReceiptModal').evaluate(element => getComputedStyle(element).position), 'fixed');
    await tab.locator('#receiptAmount').fill(amount); await tab.locator('#receiptNotes').fill('Comprovativo <b>literal</b> QA');
  }
  async function complete(tab = page) { await tab.locator('#receiptConfirm').click(); await tab.waitForFunction(() => !clientReceipt.busy()); }
  async function recover() { await panel.locator('#clientReceiptRetry').click(); await page.waitForFunction(() => !clientReceipt.busy()); }
  await page.goto(url, { waitUntil: 'networkidle' }); await other.goto(url, { waitUntil: 'networkidle' });
  await filter(page); await filter(other);
  assert.equal(await page.locator('.cw-v2-sidebar').isVisible(), false);
  assert.equal(await page.locator('.cw-v2-drawer').isVisible(), false);
  assert.equal(await page.locator('.cw-v2-shell-topbar').evaluate(element => getComputedStyle(element).position), 'fixed');
  await other.setViewportSize({ width: 1440, height: 1000 }); assert.equal(await other.locator('.cw-v2-sidebar').isVisible(), true);
  assert.equal(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.getByRole('button', { name: /Marcar.*pag/ }).count(), 0);
  await open(page); await page.locator('#receiptCancel').click(); assert.equal(await count(), 0);
  await open(page); await page.keyboard.press('Escape'); assert.equal(await page.locator('#clientReceiptModal').isVisible(), false);
  await open(other); await open(page);
  if (process.env.CW_RECEIPT_VISUAL_PATH) await page.screenshot({ path: process.env.CW_RECEIPT_VISUAL_PATH.replace('.png', '-form.png') });
  assert.equal(await card(page).locator('.line').first().evaluate(element => getComputedStyle(element).color), 'rgb(51, 65, 85)');
  const entered = gate(), release = gate(); let firstReply, posts = 0, firstBody;
  await page.route(endpoint, async route => {
    posts++; firstBody = route.request().postDataJSON(); const response = await route.fetch(); firstReply = await response.json();
    entered.release(); await release.promise; await route.fulfill({ status: 502, json: { error: 'QA lost acknowledgement' } });
  });
  await page.evaluate(() => { window.receiptSend = clientReceipt.submit(true); }); await entered.promise;
  try {
    assert.equal(await count(), 1); assert.equal((await state()).amountPaid, 10);
    await page.evaluate(() => { clientReceipt.submit(true); clientReceipt.close(); });
    await other.evaluate(() => clientReceipt.submit(true));
    assert.equal(posts, 1); assert.equal((await pending()).requestId, firstBody.requestId);
    assert.equal(await page.locator('#receiptConfirm').isDisabled(), true);
  } finally { release.release(); }
  await page.evaluate(() => window.receiptSend); await page.unroute(endpoint);
  assert.equal(await panel.isVisible(), true); assert.match(await panel.textContent(), /Cliente <b>literal<\/b>/); assert.equal(await panel.locator('b').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (process.env.CW_RECEIPT_VISUAL_PATH) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: process.env.CW_RECEIPT_VISUAL_PATH, fullPage: true }); }
  const original = await pending(); await page.reload({ waitUntil: 'networkidle' }); await filter(page);
  assert.deepEqual(await pending(), original); assert.equal(await card(page).locator('[data-client-receipt]').isDisabled(), true);
  console.log('PASS mobile/desktop navigation, cancellation, duplicate clicks and two tabs; lost acknowledgement retains the literal immutable receipt across reload');

  for (const fake of [{ ok: true, clientId: client.id }, { ...firstReply, month: '2020-01' }, { ...firstReply, clientId: client.id + 1 },
    { ...firstReply, requestReceipt: { ...firstReply.requestReceipt, requestId: randomUUID() } },
    { ...firstReply, requestReceipt: { ...firstReply.requestReceipt, appliedCents: 999 } },
    { ...firstReply, allocations: firstReply.allocations.map(row => ({ ...row, amountCents: 999 })) },
    { ...firstReply, invoices: firstReply.invoices.map(row => ({ ...row, clientId: client.id + 1 })) }]) {
    await page.route(endpoint, route => route.fulfill({ json: fake })); await recover();
    assert.deepEqual(await pending(), original); assert.equal(await count(), 1); await page.unroute(endpoint);
  }
  await recover(); assert.equal(await pending(), null); assert.equal(await count(), 1); assert.equal((await state()).amountPaid, 10);
  assert.match(await status.textContent(), /Recebimento confirmado/); assert.equal(await page.locator('#sumDebt').textContent(), '90.00 €');
  assert.equal(await card(page).isVisible(), true, 'Partial payment must not hide the client');
  await open(page);
  const external = await fetch(base + `/api/payments/invoice/${invoice.id}`, { method: 'POST', headers, body: JSON.stringify({ requestId: randomUUID(), amount: 5 }) }); assert([200, 201].includes(external.status));
  await complete(); assert.equal(await count(), 2); assert.match(await status.textContent(), /saldo mudou/); assert.equal(await pending(), null);
  console.log('PASS wrong identity/month/amount/allocations cannot clear the receipt; original recovery is applied once; partial debt remains visible and a stale form cannot pay');

  await open(page, '20'); let committed = false;
  await page.route(list, route => committed ? route.fulfill({ status: 503, json: { error: 'QA unavailable' } }) : route.continue());
  await page.route(endpoint, async route => { const response = await route.fetch(); committed = true; await route.fulfill({ response }); });
  await complete(); assert.equal(await pending(), null); assert.equal(await count(), 3); assert.equal((await state()).amountPaid, 35);
  assert.equal(await card(page).locator('[data-client-receipt]').isDisabled(), true); assert.match(await status.textContent(), /Recebimento confirmado.*atualizar o saldo/);
  assert.equal(await page.locator('#sumDebt').textContent(), '85.00 €', 'The last known balance is retained with an explicit freshness warning');
  await page.unroute(endpoint); await page.unroute(list); await page.evaluate(() => loadCollection());
  assert.equal(await page.locator('#sumDebt').textContent(), '65.00 €');
  await open(page);
  await page.evaluate(() => {
    window.originalReceiptStorage = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('cwClientReceipt:')) throw Error('QA quota'); return window.originalReceiptStorage.call(this, key, value); };
  });
  await complete(); assert.equal(await count(), 3); assert.match(await status.textContent(), /guardar o recebimento/);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalReceiptStorage; });
  await page.evaluate(key => localStorage.setItem(key, '{broken'), key); await page.reload({ waitUntil: 'networkidle' }); await filter(page);
  await page.evaluate(() => clientReceipt.submit(true)); assert.equal(await count(), 3);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), '{broken'); assert.match(await panel.textContent(), /conservado para revisão/);
  await page.evaluate(key => localStorage.removeItem(key), key); await page.reload({ waitUntil: 'networkidle' }); await filter(page);
  console.log('PASS failed refresh preserves the prior list and blocks payments; quota sends nothing; corrupt pending data is retained for review');

  await open(page); const sessionEntered = gate(), sessionRelease = gate();
  await page.route(endpoint, async route => { const response = await route.fetch(); sessionEntered.release(); await sessionRelease.promise; await route.fulfill({ response }); });
  await page.evaluate(() => { window.sessionReceiptSend = clientReceipt.submit(true); }); await sessionEntered.promise;
  try { await page.evaluate(() => localStorage.setItem('token', 'changed-session')); } finally { sessionRelease.release(); }
  await page.evaluate(() => window.sessionReceiptSend); await page.unroute(endpoint);
  assert.equal(await count(), 4); assert.equal(await panel.isVisible(), false); assert.equal(await page.locator('[data-client-id]').count(), 0); assert.notEqual(await pending(), null);
  await page.reload({ waitUntil: 'networkidle' }); await filter(page); await recover(); assert.equal(await pending(), null); assert.equal(await count(), 4);
  console.log('PASS a changed session hides client data and the late acknowledgement; the original account recovers without duplication');

  await open(page);
  const previousMonth = await page.locator('#monthFilter').inputValue();
  await page.locator('#monthFilter').fill('2026-08'); await page.locator('#monthFilter').dispatchEvent('change');
  await page.waitForFunction(() => collectionFresh && collectionMonth === '2026-08');
  await complete(); assert.equal(await count(), 4); assert.match(await status.textContent(), /mês mudou/);
  const oldReadEntered = gate(), oldReadRelease = gate();
  await page.route(list, async route => {
    if (new URL(route.request().url()).searchParams.get('month') === '2026-07') {
      const response = await route.fetch(); oldReadEntered.release(); await oldReadRelease.promise; await route.fulfill({ response });
    } else await route.continue();
  });
  await page.evaluate(() => { document.getElementById('monthFilter').value = '2026-07'; window.oldCollectionRead = loadCollection(); }); await oldReadEntered.promise;
  try { await page.evaluate(month => { document.getElementById('monthFilter').value = month; return loadCollection(); }, previousMonth); }
  finally { oldReadRelease.release(); }
  await page.evaluate(() => window.oldCollectionRead); await page.unroute(list);
  assert.equal(await page.evaluate(() => collectionMonth), previousMonth); assert.equal(await page.evaluate(() => collectionFresh), true);
  console.log('PASS changing month invalidates an open form; an old query cannot overwrite the latest month');

  await open(page);
  await page.route(endpoint, async route => {
    const body = route.request().postDataJSON();
    const response = await fetch(base + `/api/payments/invoice/${invoice.id}`, { method: 'POST', headers, body: JSON.stringify(body) }); assert([200, 201].includes(response.status));
    await route.continue();
  });
  await complete(); await page.unroute(endpoint);
  assert.equal((await pending()).rejection.status, 409); assert.equal(await panel.locator('#clientReceiptRetry').isDisabled(), true);
  await page.route(list, route => route.fulfill({ status: 503, json: {} }));
  await panel.locator('#clientReceiptReview').click(); await page.waitForFunction(() => !clientReceipt.busy()); assert.notEqual(await pending(), null);
  await page.unroute(list); await panel.locator('#clientReceiptReview').click(); await page.waitForFunction(() => !clientReceipt.busy()); assert.equal(await pending(), null);
  assert.equal(await count(), 5);
  console.log('PASS server rejection needs explicit review; failed refresh cannot discard the rejected receipt');

  await open(page, '50');
  await page.route(endpoint, async route => { await route.fetch(); await route.fulfill({ status: 502, json: {} }); });
  await complete(); await page.unroute(endpoint); assert.equal(await count(), 7);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).creditBalance, 5);
  await page.reload({ waitUntil: 'networkidle' }); await filter(page); assert.equal(await card(page).count(), 0);
  assert.equal(await panel.isVisible(), true); await recover(); assert.equal(await count(), 7); assert.equal(await pending(), null);
  assert.match(await status.textContent(), /Crédito criado: 5.00/);
  const failed = await context.newPage(); await failed.route(list, route => route.fulfill({ status: 503, json: {} }));
  await failed.goto(url, { waitUntil: 'networkidle' }); assert.equal(await failed.locator('#sumDebt').textContent(), '—');
  assert.equal(await failed.locator('[data-client-receipt]').count(), 0);
  await failed.locator('#searchFilter').fill('QA'); assert.equal(await failed.locator('#sumDebt').textContent(), '—'); await failed.close();
  assert.deepEqual(errors, []); await context.close();
  console.log('PASS a fully paid client disappearing from the list still retains recoverable surplus acknowledgement; initial load failure never displays invented zero debt');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
