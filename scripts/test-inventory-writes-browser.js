'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../frontend');
const html = fs.readFileSync(path.join(root, 'admin-inventory.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  .replace('</body>', '<script src="/cw-ui-feedback.js"></script><script src="/cw-inventory-pending.js"></script><script src="/admin-inventory.js"></script></body>');
const key = kind => `cwInventoryPending:ADMIN:1:${kind}`;
let browser;
async function setup() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const state = { mode: 'ok', readFailure: false, writes: [], confirmed: new Map(), errors: [] };
  await context.addInitScript(() => {
    if (!localStorage.getItem('initialized')) {
      localStorage.setItem('initialized', 'true'); localStorage.setItem('token', 'ADMIN-A');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'ADMIN' }));
    }
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/test') return route.fulfill({ contentType: 'text/html', body: html });
    if (/\.(css|js)$/.test(url.pathname)) return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: fs.readFileSync(path.join(root, url.pathname.slice(1)), 'utf8') });
    if (!url.pathname.startsWith('/api/')) return route.abort();
    assert.equal(request.headers().authorization, 'Bearer ADMIN-A');
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (request.method() === 'GET') {
      if (state.readFailure) return reply({ ok: false, error: 'Saldo indisponível' }, 503);
      if (url.pathname === '/api/guides/vehicles') return reply([{ id: 7, plate: 'CW-07-QA', active: true }]);
      if (url.pathname === '/api/inventory/products') return reply({ ok: true, products: [] });
      assert.equal(url.pathname, '/api/inventory/report');
      const balances = ['CENTRAL', 'VEHICLE'].flatMap(scope => ['L', 'KG'].map(unit => ({ scope, vehicleId: scope === 'VEHICLE' ? 7 : null, productName: 'CLORO', unit, quantity: 10 })));
      return reply({ ok: true, balances, lastMovements: [] });
    }
    if (url.pathname === '/api/inventory/purchases') {
      state.writes.push(request.postDataBuffer().toString());
      return reply({ ok: false, error: 'Reveja o fornecedor da fatura.' }, 400);
    }
    const body = request.postDataJSON(); state.writes.push(body);
    if (state.mode === 'hold') await new Promise(resolve => { state.release = resolve; });
    if (state.mode === 'reject') return reply({ ok: false, error: 'O stock disponível mudou. Reveja a quantidade.' }, 409);
    let result = state.confirmed.get(body.requestId);
    if (!result) {
      const row = body.items?.[0] || body, movement = { id: 100 + state.confirmed.size, vehicleId: Number(body.vehicleId), productName: row.productName, unit: row.unit, quantity: Number(row.quantity) };
      result = url.pathname.endsWith('consume') ? { ok: true, movement } : { ok: true, movements: [movement] };
      state.confirmed.set(body.requestId, result);
    }
    if (state.mode === 'lost') { state.mode = 'ok'; return route.abort('failed'); }
    if (state.mode === 'invalid-json') return route.fulfill({ contentType: 'application/json', body: '{' });
    if (state.mode === 'incomplete') return reply({ ok: true });
    return reply(result);
  });
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  page.on('pageerror', error => state.errors.push(error.message));
  await page.goto('https://inventory.test/test'); await ready(page);
  return { context, page, state };
}
const ready = page => page.locator('#inventoryStatus.ok').waitFor();
const confirmed = page => page.waitForFunction(() => document.querySelector('#inventoryStatus.ok')?.textContent.includes('confirmad') && [...document.querySelectorAll('[data-inventory-pending]')].length === 0);
const feedback = (page, kind = 'transfer') => page.locator(`#${kind}Form [data-inventory-feedback]`);
const submit = (page, kind = 'transfer') => page.locator(`#${kind}Form button[type=submit]`).click();
const readPending = (page, kind = 'transfer') => page.evaluate(k => CWInventoryPending.read(k), key(kind));
async function prepare(page, kind = 'transfer', unit = 'KG') {
  await page.locator(`#${kind}VehicleId`).selectOption('7');
  await page.locator(`#${kind}ProductName`).selectOption(JSON.stringify(['CLORO', unit]));
  assert.equal(await page.locator(`#${kind}Unit`).inputValue(), unit);
  await page.locator(`#${kind}Quantity`).fill('2');
}
async function scenario(name, work) {
  const h = await setup();
  try { await work(h); assert.deepEqual(h.state.errors, []); console.log('PASS ' + name); }
  finally { await h.context.close(); }
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  await scenario('exact product/unit, lost transfer, immutable record and explicit replay after reload', async ({ page, state }) => {
    assert.equal(state.writes.length, 0); state.mode = 'lost'; await prepare(page); await submit(page); await feedback(page).waitFor();
    assert(await page.locator('#transferQuantity').isDisabled()); assert.equal(state.confirmed.size, 1);
    await page.reload(); await ready(page); assert.equal(state.writes.length, 1);
    assert.match(await page.locator('#transferForm [data-inventory-pending]').textContent(), /CLORO: 2 KG/);
    await submit(page); await confirmed(page); assert.deepEqual(state.writes[0], state.writes[1]); assert.equal(state.confirmed.size, 1);
    assert.equal(await readPending(page), null);
  });
  for (const [kind, mode] of [['transfer', 'invalid-json'], ['consume', 'incomplete']]) {
    await scenario(`${kind}: malformed success cannot clear the pending movement`, async ({ page, state }) => {
      state.mode = mode; await prepare(page, kind); await submit(page, kind); await feedback(page, kind).waitFor();
      assert(await readPending(page, kind)); state.mode = 'ok'; await submit(page, kind); await confirmed(page);
      assert.deepEqual(state.writes[0], state.writes[1]); assert.equal(state.confirmed.size, 1); assert.equal(await readPending(page, kind), null);
    });
  }
  await scenario('definitive rejection persists and explicit correction issues a new request', async ({ page, state }) => {
    state.mode = 'reject'; await prepare(page); await submit(page); await feedback(page).waitFor();
    await page.reload(); await ready(page); assert(await page.locator('#transferForm button[type=submit]').isDisabled());
    await page.getByRole('button', { name: 'Corrigir pedido recusado' }).click();
    await page.waitForFunction(() => !document.querySelector('#transferQuantity').disabled);
    assert.equal(await page.locator('#transferQuantity').inputValue(), '2'); assert.equal(await page.locator('#transferUnit').inputValue(), 'KG');
    state.mode = 'ok'; await page.locator('#transferQuantity').fill('1'); await submit(page); await confirmed(page);
    assert.notEqual(state.writes[0].requestId, state.writes[1].requestId); assert.equal(state.confirmed.size, 1);
  });
  await scenario('rejected purchase restores exact rows and invoice bytes after reload', async ({ page, state }) => {
    await page.locator('#supplierName').fill('Fornecedor QA'); await page.locator('#invoiceNumber').fill('FAT-QA');
    await page.locator('#items [data-k=productName]').fill('CLORO'); await page.locator('#items [data-k=quantity]').fill('3');
    const invoice = '%PDF-1.4 invoice recovery QA';
    await page.locator('#document').setInputFiles({ name: 'invoice-qa.pdf', mimeType: 'application/pdf', buffer: Buffer.from(invoice) });
    await submit(page, 'purchase'); await feedback(page, 'purchase').waitFor(); await page.reload(); await ready(page);
    assert.equal(state.writes.length, 1); assert.match(state.writes[0], /invoice recovery QA/);
    assert.match(await page.locator('#purchaseForm [data-inventory-pending]').textContent(), /invoice-qa.pdf/);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.locator('#purchaseForm [data-inventory-pending]').evaluate(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1; }), `Pending invoice overflow at ${width}px`);
    }
    await page.getByRole('button', { name: 'Corrigir pedido recusado' }).click();
    await page.waitForFunction(() => !document.querySelector('#supplierName').disabled);
    assert.equal(await page.locator('#supplierName').inputValue(), 'Fornecedor QA'); assert.equal(await page.locator('#invoiceNumber').inputValue(), 'FAT-QA');
    assert.equal(await page.locator('#items [data-k=quantity]').inputValue(), '3');
    assert.equal(await page.locator('#document').evaluate(node => node.files[0].text()), invoice);
    assert.equal(await readPending(page, 'purchase'), null);
  });
  await scenario('storage failure sends nothing; malformed saved payload remains blocked', async ({ page, state }) => {
    await page.evaluate(() => { CWInventoryPending.create = async () => { throw Error('Sem espaço para guardar.'); }; });
    await prepare(page); await submit(page); await feedback(page).waitFor(); assert.equal(state.writes.length, 0);
    await page.reload(); await ready(page);
    await page.evaluate(k => CWInventoryPending.create({ key: k, version: 1, owner: 'ADMIN:1', kind: 'transfer', requestId: crypto.randomUUID(), body: { items: null }, legacyKey: 'old' }), key('transfer'));
    await page.reload(); await page.locator('#inventoryStatus.error').waitFor();
    assert.match(await page.locator('#inventoryStatus').textContent(), /não pôde ser lido/);
    assert(await page.locator('#transferForm button[type=submit]').isDisabled()); assert(await readPending(page)); assert.equal(state.writes.length, 0);
  });
  await scenario('two tabs cannot send concurrently or silently replace an existing pending request', async ({ page, context, state }) => {
    const second = await context.newPage(); second.setDefaultTimeout(6000); await second.goto('https://inventory.test/test'); await ready(second);
    state.mode = 'hold'; await prepare(page); await prepare(second); await submit(page);
    while (!state.release) await new Promise(resolve => setTimeout(resolve, 10));
    await submit(second); await feedback(second).filter({ hasText: 'noutra janela' }).waitFor(); assert.equal(state.writes.length, 1);
    state.mode = 'lost'; state.release(); await feedback(page).waitFor();
    await submit(second); await second.locator('#transferForm [data-inventory-pending]').waitFor(); assert.equal(state.writes.length, 1);
    await submit(second); await confirmed(second); assert.equal(state.confirmed.size, 1); assert.deepEqual(state.writes[0], state.writes[1]);
    await submit(page); await page.locator('#inventoryStatus').filter({ hasText: 'resolvido noutra janela' }).waitFor(); assert.equal(state.writes.length, 2);
  });
  await scenario('late response from an old session cannot clear its saved request or reveal stock', async ({ page, state }) => {
    state.mode = 'hold'; await prepare(page); await submit(page);
    while (!state.release) await new Promise(resolve => setTimeout(resolve, 10));
    await page.evaluate(() => { localStorage.setItem('token', 'ADMIN-B'); localStorage.setItem('user', JSON.stringify({ id: 2, role: 'ADMIN' })); window.dispatchEvent(new StorageEvent('storage', { key: 'token' })); });
    state.mode = 'ok'; state.release(); await page.locator('#inventorySessionChanged').waitFor();
    await page.waitForFunction(() => !writeStates.get('transfer').busy);
    assert(await readPending(page)); assert.equal(await page.locator('main.page').isVisible(), false); assert.equal(state.writes.length, 1);
  });
  await scenario('failed refresh blocks fresh movements until a successful retry', async ({ page, state }) => {
    state.readFailure = true; await page.getByRole('button', { name: 'Atualizar inventário', exact: true }).click(); await page.locator('#inventoryStatus.error').waitFor();
    assert(await page.locator('#transferForm button[type=submit]').isDisabled()); assert.equal(state.writes.length, 0);
    state.readFailure = false; await page.getByRole('button', { name: 'Atualizar inventário', exact: true }).click(); await ready(page);
    await prepare(page); await submit(page); await confirmed(page); assert.equal(state.confirmed.size, 1);
  });
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
