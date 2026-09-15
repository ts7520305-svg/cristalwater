'use strict';
require('../src/loadEnv')();
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002', stamp = Date.now();
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = path.resolve(__dirname, '../reports/field-visual/inventory-count-' + stamp);
const report = { apiMocks: false, transportFault: 'Lost browser response after real API commit', status: 'RUNNING', screenshots: [], pageErrors: [], serverErrors: [] };
let browser;
async function capture(page, name, selector = '#inventoryCountPanel') {
  await page.locator(selector).screenshot({ path: path.join(output, name + '.png') }); report.screenshots.push(name + '.png');
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const vehicle = await prisma.vehicle.create({ data: { plate: `CONT-${stamp}`, name: 'Viatura de demonstração', active: true } });
  const productName = 'CLORO CONTAGEM QA';
  const liters = await prisma.stockBalance.create({ data: { scope: 'VEHICLE', vehicleId: vehicle.id, productName, unit: 'L', quantity: 10 } });
  const kilos = await prisma.stockBalance.create({ data: { scope: 'VEHICLE', vehicleId: vehicle.id, productName, unit: 'KG', quantity: 5 } });
  const fractional = await prisma.stockBalance.create({ data: { scope: 'VEHICLE', vehicleId: vehicle.id, productName: 'QUANTIDADE FRACIONADA QA', unit: 'L', quantity: 2.3 } });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(base + '/api/') && response.status() >= 500) report.serverErrors.push(response.status()); });
  await page.goto(base + '/admin-login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(process.env.ADMIN_EMAIL); await page.locator('#password').fill(process.env.ADMIN_PASSWORD); await page.locator('#loginBtn').click();
  await page.waitForURL(url => !url.pathname.includes('login'));
  await page.goto(base + '/admin-inventory', { waitUntil: 'domcontentloaded' });
  const status = page.locator('#inventoryCountStatus');
  const movements = () => prisma.stockMovement.count({ where: { vehicleId: vehicle.id, movementType: { startsWith: 'AUDIT_COUNT_' } } });
  async function prepare(balanceId, quantity) {
    await page.locator('#inventoryCountVehicle').selectOption(String(vehicle.id)); await page.locator('#inventoryCountLoad').click();
    await page.locator(`#inventoryCountProduct option[value="${balanceId}"]`).waitFor({ state: 'attached' });
    await page.locator('#inventoryCountProduct').selectOption(String(balanceId)); await page.locator('#inventoryCountPhysical').fill(String(quantity));
  }
  async function confirm() {
    await page.locator('#inventoryCountSave').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar contagem', exact: true }).click();
  }
  await prepare(liters.id, 7); assert.equal(await movements(), 0);
  await capture(page, 'count-before');
  let loseResponse = true; const requests = [];
  await page.route('**/api/inventory/audit-count', async route => {
    requests.push(route.request().postDataJSON());
    if (loseResponse) { loseResponse = false; const response = await route.fetch(); assert.equal(response.status(), 200); return route.abort('failed'); }
    return route.continue();
  });
  await page.locator('#inventoryCountSave').click(); await page.getByRole('dialog').waitFor(); await capture(page, 'count-confirmation', '.cw-ui-modal');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar contagem', exact: true }).click();
  await status.filter({ hasText: 'Ainda não foi possível' }).waitFor(); assert.equal(await movements(), 1);
  assert.equal((await prisma.stockBalance.findUnique({ where: { id: liters.id } })).quantity, 7);
  await page.reload(); await status.filter({ hasText: 'pendente recuperada' }).waitFor(); assert.equal(requests.length, 1);
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page, 'count-pending-mobile');
  await page.locator('#inventoryCountRetry').click(); await status.filter({ hasText: 'confirmação original' }).waitFor();
  assert.deepEqual(requests[1], requests[0]); assert.equal(await movements(), 1);
  assert.equal((await prisma.stockBalance.findUnique({ where: { id: kilos.id } })).quantity, 5);
  console.log('PASS real count form: explicit approval, lost response after commit, persisted reload and exact replay with one movement');
  await prepare(liters.id, 4);
  // A real stock change between the consultation and the physical confirmation.
  await prisma.stockBalance.update({ where: { id: liters.id }, data: { quantity: 6 } });
  await confirm(); await status.filter({ hasText: 'Consulte novamente' }).waitFor(); assert.equal(await movements(), 1);
  assert.equal((await prisma.stockBalance.findUnique({ where: { id: liters.id } })).quantity, 6);
  assert(await page.locator('#inventoryCountSave').isDisabled()); assert.equal(await page.locator('#inventoryCountPhysical').inputValue(), '');
  await prepare(liters.id, 4); await confirm(); await status.filter({ hasText: 'Contagem confirmada:' }).waitFor();
  assert.equal(await movements(), 2); assert.equal((await prisma.stockBalance.findUnique({ where: { id: liters.id } })).quantity, 4);
  await prepare(kilos.id, 0); await confirm(); await status.filter({ hasText: 'Contagem confirmada:' }).waitFor();
  assert.equal((await prisma.stockBalance.findUnique({ where: { id: kilos.id } })).quantity, 0);
  await prepare(fractional.id, 0.1); await confirm(); await status.filter({ hasText: 'Contagem confirmada:' }).waitFor();
  assert(Math.abs((await prisma.stockBalance.findUnique({ where: { id: fractional.id } })).quantity - 0.1) < 1e-12);
  assert.equal(await movements(), 4);
  await capture(page, 'count-confirmed-mobile');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.locator('#inventoryCountPanel').evaluate(panel => [...panel.querySelectorAll('input,select,button')].filter(n => n.getClientRects().length).every(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; })), `Count control overflow at ${width}px`);
  }
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.serverErrors, []);
  report.status = 'PASS'; report.movements = 4;
  console.log('PASS real count form: stale balance refusal, mandatory reread, unit isolation, zero/fractional quantities and responsive layout');
})().catch(error => {
  report.status = 'FAIL'; report.error = String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g, '[token]').slice(0, 1500);
  console.error(report.error); process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close(); await prisma.$disconnect();
  if (fs.existsSync(output)) fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log('Inventory count evidence:', output);
});
