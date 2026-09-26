'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { chromium } = require('playwright'), wait = require('./fixtures/wait-browser-state');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const vehicle = await prisma.vehicle.create({ data: { plate: 'PIUI-' + Date.now(), active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Product selection technician', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Product selection client', active: true } });
  const visits = [];
  for (const type of ['REGULAR', 'EXTRA']) {
    const pool = await prisma.pool.create({ data: { name: type + ' product selection', clientId: client.id, active: true } });
    const visit = await (type === 'EXTRA' ? prisma.extraVisit : prisma.serviceVisit).create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'PLANNED', ...(type === 'EXTRA' ? { scheduledAt: new Date(), billingMode: 'NO_CHARGE' } : { plannedDate: new Date(), date: new Date() }) } });
    visits.push({ ...visit, type, pool });
  }
  const transport = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'PIUI-' + Date.now(), status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  const guide = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: transport.id, status: 'OPEN', isDraft: false } });
  const items = [];
  for (const [unit, quantity] of [['L', 10], ['KG', 10], ['KG', 10], [null, 10], ['l', 0], ['L', -2]]) items.push(await prisma.workGuideItem.create({ data: { workGuideId: guide.id, name: 'Cloro <img src=x onerror=window.qaProductXss=true>', unit, type: 'CHEMICAL', quantity, initialQty: quantity } }));
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(Date.now() + 86400000 * 30) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), key = 'cwFieldVisitDrafts:v2:TECH:' + tech.id;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
    const interval = setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000].includes(delay) ? 0 : interval(callback, delay, ...args);
    window.alert = () => {};
  }, { token, tech, origin: new URL(base).origin });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(10000); page.on('dialog', d => d.accept()); page.on('pageerror', e => errors.push(e.message));
  const saved = () => page.waitForFunction(() => document.getElementById('fieldSaveStatus')?.dataset.state === 'saved');
  const select = async (visit, done = false) => {
    await page.locator('#poolSegments [data-pool-filter="' + (done ? 'DONE' : 'TODO') + '"]').evaluate(node => node.click());
    await page.locator('#visitList [data-visit-index]').filter({ hasText: visit.pool.name }).evaluate(node => node.click());
    await page.locator('[data-field-tab-button="agora"]').click(); await page.waitForFunction(() => ['saved', 'empty'].includes(document.getElementById('fieldSaveStatus')?.dataset.state));
  };
  await page.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('fieldDocsValue')?.textContent === 'Válidos');
  const regular = visits[0], record = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).drafts['visit-REGULAR-' + id], { key, id: regular.id });
  await select(regular); await page.locator('#addDoseBtn').click();
  const option = id => page.locator('#doseRows option[value="' + id + '"]');
  assert(await option(items[3].id).isDisabled()); assert.match(await option(items[4].id).textContent(), /0 l/); assert.match(await option(items[5].id).textContent(), /-2 L/);
  const row = page.locator('#doseRows .dose-row').first();
  await row.locator('select').selectOption(String(items[1].id)); await row.locator('[data-dose-field=quantity]').fill('1.25'); await saved();
  await row.locator('select').selectOption(String(items[0].id)); await saved();
  assert.equal(await row.locator('[data-dose-field=unit]').inputValue(), 'L'); assert(await row.locator('[data-dose-field=unit]').getAttribute('readonly') !== null);
  assert.equal(await row.locator('[data-dose-field=quantity]').inputValue(), '1.25'); assert.equal((await record()).usedProducts[0].workGuideItemId, items[0].id);
  assert.equal(await page.locator('#doseRows img').count(), 0); assert.equal(await page.evaluate(() => window.qaProductXss), undefined);
  for (const language of ['pt', 'en', 'fr', 'es', 'de']) {
    await page.locator('#cwLanguageSelect').selectOption(language);
    await page.waitForFunction(lang => document.documentElement.lang === lang && document.querySelector('#doseRows select').getAttribute('aria-label') === CWFieldDocumentCopy.text('productUsed', {}, lang), language);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.equal(await row.locator('[data-dose-field=unit]').inputValue(), 'L');
      await page.locator('#doseRows').evaluate(node => node.scrollIntoView({block:'center',behavior:'instant'}));
      assert(await page.locator('#doseRows').evaluate(node => [...node.querySelectorAll('input,select,button')].every(control => { const box=control.getBoundingClientRect(); return box.height>=44 && control.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)); })), language+' '+width+' controls accessible');
      if (process.env.CW_CAPTURE_UI) { require('node:fs').mkdirSync('reports/field-ui', { recursive: true }); await page.locator('#doseRows').screenshot({ path: `reports/field-ui/PRODUCT_IDENTITY_${language}_${width}.png` }); }
    }
  }
  await page.locator('#cwLanguageSelect').selectOption('pt'); await page.setViewportSize({ width: 390, height: 1000 });
  for (const quantity of ['', '0', '-1']) {
    await row.locator('[data-dose-field=quantity]').fill(quantity); await saved(); await page.locator('#finishBtn').click();
    try { await page.waitForFunction(() => document.getElementById('toast').textContent.includes('quantidade positiva')); } catch (error) { console.error({quantity,errors,state:await page.evaluate(()=>({language:document.documentElement.lang,toast:document.getElementById('toast').textContent,save:document.getElementById('fieldSaveStatus').textContent,disabled:document.getElementById('finishBtn').disabled,docs:document.getElementById('documentCenterBox').textContent,values:[...document.querySelectorAll('#doseRows input')].map(x=>[x.dataset.doseField,x.value])}))}); throw error; }
    assert.equal((await page.evaluate(() => CWFieldWriteStore.records('VISIT_COMPLETION'))).length, 0); assert.equal((await record()).usedProducts[0].quantity, quantity);
  }
  await row.locator('[data-dose-field=quantity]').fill('6'); await page.locator('#addDoseBtn').click();
  const second = page.locator('#doseRows .dose-row').nth(1); await second.locator('select').selectOption(String(items[0].id)); await second.locator('[data-dose-field=quantity]').fill('6'); await saved();
  await page.locator('#finishBtn').click(); await page.waitForFunction(() => document.getElementById('toast').textContent.includes('Stock insuficiente'));
  assert.equal((await page.evaluate(() => CWFieldWriteStore.records('VISIT_COMPLETION'))).length, 0); assert.equal((await record()).usedProducts.length, 2);
  await second.locator('[data-dose-remove]').click(); await row.locator('select').selectOption(String(items[2].id)); await row.locator('[data-dose-field=quantity]').fill('1.25'); await saved();
  // Earlier drafts remain visible and need an explicit selection, with their quantity and note intact.
  await page.evaluate(({ key, id }) => { const value = JSON.parse(localStorage.getItem(key)), product = value.drafts['visit-REGULAR-' + id].usedProducts[0]; delete product.workGuideId; delete product.workGuideItemId; product.notes = 'Preserved old product note'; localStorage.setItem(key, JSON.stringify(value)); }, { key, id: regular.id });
  await page.reload({ waitUntil: 'networkidle' }); await select(regular); assert.equal(await row.locator('select').inputValue(), 'saved');
  await page.locator('#finishBtn').click(); await page.waitForFunction(() => document.getElementById('toast').textContent.includes('Selecione novamente'));
  assert.equal((await record()).usedProducts[0].notes, 'Preserved old product note'); assert.equal(await row.locator('[data-dose-field=quantity]').inputValue(), '1.25');
  await row.locator('select').selectOption(String(items[2].id)); await saved();
  console.log('PASS distinct selector IDs/units, no assumed unit, literal stock/labels, five languages at 320/390/1440, incomplete and aggregate checks, preserved old draft requiring explicit review');
  for (const visit of visits) {
    await select(visit);
    if (visit.type === 'EXTRA') { await page.locator('#addDoseBtn').click(); await row.locator('select').selectOption(String(items[0].id)); await row.locator('[data-dose-field=quantity]').fill('0.5'); await saved(); }
    await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await saved();
    const scope = visit.type === 'EXTRA' ? 'EXTRA_VISIT_COMPLETION' : 'VISIT_COMPLETION', item = visit.type === 'EXTRA' ? items[0] : items[2];
    assert.equal(await row.locator('select').inputValue(), String(item.id)); await page.locator('#finishBtn').click();
    await wait(page, scope => CWFieldWriteStore.records(scope).then(rows => rows.length === 1), scope);
    const pending = await page.evaluate(scope => CWFieldWriteStore.records(scope).then(rows => rows[0]), scope), products = JSON.parse(pending.payload.products);
    assert.equal(products[0].workGuideItemId, item.id); assert.equal(products[0].workGuideId, guide.id); assert.equal(products[0].unit, item.unit);
    if (visit.type === 'REGULAR') assert.equal(products[0].notes, 'Preserved old product note');
    const endpoint = visit.type === 'EXTRA' ? `/api/field/extra-visits/${visit.id}/complete` : `/api/core/visits/${visit.id}/complete`;
    await page.route('**' + endpoint, async route => { await route.fetch(); await route.abort(); }); await context.setOffline(false);
    await wait(page, scope => CWFieldWriteStore.records(scope).then(rows => rows[0]?.status === 'failed' || rows[0]?.failure), scope);
    await page.unroute('**' + endpoint); await page.reload({ waitUntil: 'networkidle' }); await page.evaluate(() => CWFieldOffline.flush());
    await wait(page, scope => CWFieldWriteStore.records(scope).then(rows => rows.length === 0), scope);
    const movements = await prisma.vehicleStockMovement.findMany({ where: visit.type === 'EXTRA' ? { extraVisitId: visit.id } : { visitId: visit.id } });
    assert.equal(movements.length, 1); assert.equal(JSON.parse(movements[0].notes).workGuideItemId, item.id);
    assert.equal((await prisma.workGuideItem.findUnique({ where: { id: item.id } })).quantity, 10 - products[0].quantity);
    const confirmed = await page.evaluate(scope => CWFieldWriteStore.records(scope, CWFieldWriteStore.session(), true).then(rows => rows.find(row => row.response)), scope); assert.equal(confirmed.requestId, pending.requestId);
    console.log('PASS ' + visit.type + ' exact product/notes in offline draft, immutable queue, lost committed response, reload and one debit on the selected row');
  }
  await select(visits[1], true); await page.locator('#finishBtn').click();
  const dialog = page.locator('#extraCorrectionDialog'); await dialog.locator('[data-product-field=quantity]').fill('0.25');
  assert(await dialog.locator('[data-product-field=name]').getAttribute('readonly') !== null); assert(await dialog.locator('[data-product-field=unit]').getAttribute('readonly') !== null);
  await dialog.locator('[name=reason]').fill('Quantidade confirmada na linha original'); await dialog.locator('#extraCorrectionPreview').click(); await dialog.locator('#extraCorrectionConfirm').click();
  await page.waitForFunction(() => document.getElementById('extraCorrectionStatus').textContent.includes('Correção confirmada'));
  assert.equal((await prisma.workGuideItem.findUnique({ where: { id: items[0].id } })).quantity, 9.75);
  const extra = await prisma.extraVisit.findUnique({ where: { id: visits[1].id } }); assert.equal(extra.execution.chemicalsJson[0].workGuideItemId, items[0].id);
  assert.equal((await prisma.workGuideItem.findUnique({ where: { id: items[1].id } })).quantity, 10); assert.deepEqual(errors, []);
  console.log('PASS completed EXTRA editor retains the selected identity and adjusts only its original stock row');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
