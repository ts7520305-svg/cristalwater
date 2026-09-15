'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../frontend');
const html = fs.readFileSync(path.join(root, 'admin-inventory.html'), 'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  .replace('</body>', '<script src="/cw-ui-feedback.js"></script><script src="/admin-inventory-count.js"></script></body>');
const key = 'cwInventoryCount:v1:ADMIN:1';
let browser;
async function setup() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const state = { mode: 'ok', getFailure: false, stockFailure: false, writes: [], confirmations: new Map(), errors: [], balances: [
    { id: 11, scope: 'VEHICLE', vehicleId: 7, productName: 'CLORO', unit: 'L', quantity: 10 },
    { id: 12, scope: 'VEHICLE', vehicleId: 7, productName: 'CLORO', unit: 'KG', quantity: 5 },
    { id: 13, scope: 'VEHICLE', vehicleId: 7, productName: '<img src=x onerror=alert(1)>', unit: 'L', quantity: 0 },
  ] };
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
    if (url.pathname === '/api/guides/vehicles') return state.getFailure ? reply({ ok: false, error: 'Viaturas indisponíveis' }, 503) : reply([{ id: 7, plate: 'CW-07-QA', active: true }]);
    if (url.pathname === '/api/inventory/stock') return state.stockFailure ? reply({ ok: false, error: 'Saldo indisponível' }, 503) : reply({ ok: true, balances: state.balances });
    assert.equal(url.pathname, '/api/inventory/audit-count');
    const body = request.postDataJSON(); state.writes.push(body);
    if (state.mode === 'conflict') return reply({ ok: false, error: 'O stock mudou desde a consulta.' }, 409);
    if (state.mode === 'hold') await new Promise(resolve => { state.release = resolve; });
    let result = state.confirmations.get(body.requestId), replay = Boolean(result);
    if (!result) {
      const balance = state.balances.find(b => b.productName === body.productName && b.unit === body.unit);
      result = { ok: true, movement: { id: 100 + state.confirmations.size, vehicleId: body.vehicleId }, balance: { id: balance.id, quantity: body.physicalQuantity }, digitalQuantity: body.expectedQuantity, physicalQuantity: body.physicalQuantity, desvio: body.physicalQuantity - body.expectedQuantity };
      state.confirmations.set(body.requestId, result); balance.quantity = body.physicalQuantity;
    }
    if (state.mode === 'lost') { state.mode = 'ok'; return route.abort('failed'); }
    if (state.mode === 'malformed') return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    return reply({ ...result, idempotent: replay });
  });
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  page.on('pageerror', error => state.errors.push(error.message));
  await page.goto('https://inventory.test/test');
  return { context, page, state };
}
const status = page => page.locator('#inventoryCountStatus');
async function prepare(page, id = '11', quantity = '7') {
  await page.locator('#inventoryCountVehicle').selectOption('7'); await page.locator('#inventoryCountLoad').click();
  await page.locator(`#inventoryCountProduct option[value="${id}"]`).waitFor({ state: 'attached' });
  await page.locator('#inventoryCountProduct').selectOption(id); await page.locator('#inventoryCountPhysical').fill(quantity);
}
async function confirm(page) {
  await page.locator('#inventoryCountSave').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar contagem', exact: true }).click();
}
async function scenario(name, work) {
  const h = await setup();
  try { await work(h); assert.deepEqual(h.state.errors, []); console.log('PASS ' + name); }
  finally { await h.context.close(); }
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  await scenario('read-only startup, exact product/unit, cancellation, double submit and zero count', async ({ page, state }) => {
    await prepare(page, '12', '0'); assert.equal(state.writes.length, 0);
    assert.match(await page.locator('#inventoryCountDifference').textContent(), /-5 KG/);
    await page.locator('#inventoryCountSave').click(); await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click(); assert.equal(state.writes.length, 0);
    await page.locator('#inventoryCountSave').click();
    await page.getByRole('dialog').waitFor();
    await page.evaluate(() => document.getElementById('inventoryCountForm').dispatchEvent(new Event('submit', { cancelable: true })));
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar contagem', exact: true }).click();
    await status(page).filter({ hasText: 'Contagem confirmada:' }).waitFor(); assert.equal(state.writes.length, 1);
    assert.equal(state.writes[0].unit, 'KG'); assert.equal(state.writes[0].expectedQuantity, 5); assert.equal(state.writes[0].physicalQuantity, 0);
    assert.equal(await page.evaluate(k => localStorage.getItem(k), key), null);
  });
  await scenario('lost response, immutable pending count, reload and exact replay', async ({ page, state }) => {
    state.mode = 'lost'; await prepare(page); await confirm(page);
    await status(page).filter({ hasText: 'Ainda não foi possível' }).waitFor(); assert.equal(state.confirmations.size, 1);
    assert.equal(await page.locator('#inventoryCountEditor').isVisible(), false);
    await page.reload(); await status(page).filter({ hasText: 'pendente recuperada' }).waitFor(); assert.equal(state.writes.length, 1);
    await page.locator('#inventoryCountRetry').click(); await status(page).filter({ hasText: 'confirmação original' }).waitFor();
    assert.deepEqual(state.writes[1], state.writes[0]); assert.equal(state.confirmations.size, 1);
  });
  await scenario('stale balance rejection requires a fresh read and recount', async ({ page, state }) => {
    state.mode = 'conflict'; await prepare(page); await confirm(page);
    await status(page).filter({ hasText: 'Consulte novamente' }).waitFor(); assert.equal(state.confirmations.size, 0);
    assert(await page.locator('#inventoryCountSave').isDisabled()); assert.equal(await page.locator('#inventoryCountPhysical').inputValue(), '');
    assert.equal(await page.evaluate(k => localStorage.getItem(k), key), null);
    state.mode = 'ok'; state.balances[0].quantity = 6; await prepare(page, '11', '4'); await confirm(page);
    await status(page).filter({ hasText: 'Contagem confirmada' }).waitFor(); assert.equal(state.writes[1].expectedQuantity, 6);
    assert.notEqual(state.writes[1].requestId, state.writes[0].requestId);
  });
  await scenario('malformed success preserves the original request for confirmation', async ({ page, state }) => {
    state.mode = 'malformed'; await prepare(page); await confirm(page); await status(page).filter({ hasText: 'Ainda não foi possível' }).waitFor();
    assert(await page.evaluate(k => Boolean(localStorage.getItem(k)), key)); state.mode = 'ok'; await page.locator('#inventoryCountRetry').click();
    await status(page).filter({ hasText: 'confirmação original' }).waitFor(); assert.deepEqual(state.writes[0], state.writes[1]);
  });
  await scenario('quota failure sends nothing and corrupt storage is retained', async ({ page, state }) => {
    await prepare(page);
    await page.evaluate(() => { const write = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k.startsWith('cwInventoryCount:')) throw Error('Quota'); return write.call(this, k, v); }; });
    await confirm(page); await status(page).filter({ hasText: 'Nenhum pedido foi enviado' }).waitFor(); assert.equal(state.writes.length, 0);
    await page.reload(); await page.evaluate(k => localStorage.setItem(k, '{broken'), key); await page.reload();
    await status(page).filter({ hasText: 'não pôde ser lida' }).waitFor(); assert.equal(await page.evaluate(k => localStorage.getItem(k), key), '{broken');
    assert.equal(await page.locator('#inventoryCountEditor').isVisible(), false);
  });
  await scenario('session change during confirmation prevents sending', async ({ page, state }) => {
    await prepare(page); await page.locator('#inventoryCountSave').click();
    await page.getByRole('dialog').waitFor();
    await page.evaluate(() => { localStorage.setItem('token', 'ADMIN-B'); localStorage.setItem('user', JSON.stringify({ id: 2, role: 'ADMIN' })); window.dispatchEvent(new StorageEvent('storage', { key: 'token' })); });
    await status(page).filter({ hasText: 'A sessão mudou' }).waitFor(); assert.equal(state.writes.length, 0);
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.locator('#inventoryCountEditor').isVisible(), false);
  });
  await scenario('late response from a previous session cannot confirm or clear its pending count', async ({ page, state }) => {
    state.mode = 'hold'; await prepare(page); await confirm(page); await page.waitForFunction(() => document.getElementById('inventoryCountStatus').textContent.includes('A confirmar'));
    while (!state.release) await new Promise(resolve => setTimeout(resolve, 10));
    await page.evaluate(() => { localStorage.setItem('token', 'ADMIN-B'); window.dispatchEvent(new StorageEvent('storage', { key: 'token' })); });
    state.release(); await page.waitForTimeout(100); assert.match(await status(page).textContent(), /A sessão mudou/);
    assert(await page.evaluate(k => Boolean(localStorage.getItem(k)), key)); assert.equal(await page.locator('#inventoryCountPending').isVisible(), false);
  });
  await scenario('multiple tabs cannot open simultaneous confirmations', async ({ page, context, state }) => {
    const second = await context.newPage(); second.setDefaultTimeout(6000); await second.goto('https://inventory.test/test');
    await prepare(page); await prepare(second); await page.locator('#inventoryCountSave').click();
    await page.getByRole('dialog').waitFor();
    await second.locator('#inventoryCountSave').click(); await status(second).filter({ hasText: 'noutra janela' }).waitFor();
    assert.equal(await second.getByRole('dialog').count(), 0); assert.equal(state.writes.length, 0);
    state.mode = 'lost';
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar contagem', exact: true }).click();
    await status(page).filter({ hasText: 'Ainda não foi possível' }).waitFor();
    await second.locator('#inventoryCountSave').click(); await status(second).filter({ hasText: 'recuperada uma contagem pendente' }).waitFor();
    assert.equal(state.writes.length, 1); await second.locator('#inventoryCountRetry').click();
    await status(second).filter({ hasText: 'confirmação original' }).waitFor();
    await page.locator('#inventoryCountRetry').click(); await status(page).filter({ hasText: 'resolvida noutra janela' }).waitFor();
    assert.equal(state.writes.length, 2); assert.equal(state.confirmations.size, 1); await second.close();
  });
  await scenario('failed reads, zero balance, escaped labels and responsive controls', async ({ page, state }) => {
    state.getFailure = true; await page.locator('#inventoryCountReload').click(); await status(page).filter({ hasText: 'Viaturas indisponíveis' }).waitFor();
    assert(await page.locator('#inventoryCountVehicle').isDisabled()); state.getFailure = false; await page.locator('#inventoryCountReload').click();
    await prepare(page, '13', '1'); assert.equal(await page.locator('#inventoryCountProduct img').count(), 0);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.locator('#inventoryCountPanel').evaluate(panel => [...panel.querySelectorAll('input,select,button')].filter(n => n.getClientRects().length).every(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; })));
    }
    state.stockFailure = true; await page.locator('#inventoryCountLoad').click(); await status(page).filter({ hasText: 'Saldo indisponível' }).waitFor();
    assert(await page.locator('#inventoryCountSave').isDisabled()); assert.equal(state.writes.length, 0);
  });
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
