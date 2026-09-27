'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { chromium } = require('playwright'), wait = require('./fixtures/wait-browser-state');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const client = await prisma.client.create({ data: { name: 'Legacy products client', active: true } }), pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Legacy products pool', active: true } });
  const vehicle = await prisma.vehicle.create({ data: { plate: 'LP-' + Date.now(), active: true } }), tech = await prisma.technician.create({ data: { name: 'Legacy products owner', vehicleId: vehicle.id, active: true } }), other = await prisma.technician.create({ data: { name: 'Legacy products other', active: true } });
  const transport = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'LP-' + Date.now(), status: 'ACTIVE', isDraft: false } }), guide = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: transport.id, status: 'OPEN', isDraft: false } });
  const items = []; for (const unit of ['L', 'KG', 'KG', null]) items.push(await prisma.workGuideItem.create({ data: { workGuideId: guide.id, name: 'Cloro <img src=x onerror=window.productXss=true>', type: 'CHEMICAL', unit, quantity: 10, initialQty: 10 } }));
  const original = 'Cloro no local <img src=x onerror=window.productXss=true>\nConfirmar a quantidade e a unidade.';
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'PLANNED', plannedDate: new Date(), date: new Date(), products: original } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), otherToken = jwt.sign({ id: other.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const draftKey = 'cwLegacyVisitDraft:v1:TECH:' + tech.id + ':' + visit.id;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1100 } });
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaLegacyProductSession')) { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' })); localStorage.setItem('qaLegacyProductSession', '1'); }
    const interval = setInterval; window.setInterval = (callback, delay, ...args) => delay === 15000 ? 0 : interval(callback, delay, ...args);
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } }); window.productAlerts = []; window.alert = message => productAlerts.push(message);
  }, { token, tech, origin: new URL(base).origin });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const box = page.locator('#legacyProducts-' + visit.id), finish = page.locator('[data-action=complete][data-visit-id="' + visit.id + '"]'), row = box.locator('[data-product-row]').first();
  const saved = () => page.waitForFunction(id => document.getElementById('legacyDraftStatus-' + id)?.textContent.startsWith('Rascunho guardado'), visit.id);
  const raw = () => page.evaluate(key => localStorage.getItem(key), draftKey), draft = async () => JSON.parse(await raw()), products = async () => JSON.parse((await draft()).fields.products);
  const open = () => page.goto(base + '/technician.html', { waitUntil: 'networkidle' });
  const rejected = async text => { await page.evaluate(() => { productAlerts.length = 0; }); await finish.click(); await page.waitForFunction(text => productAlerts.some(message => message.includes(text)), text); assert.equal((await page.evaluate(() => CWFieldWriteStore.records('VISIT_COMPLETION'))).length, 0); };
  await open(); await page.waitForFunction(id => document.querySelector('#legacyProducts-' + id + ' [role=status]')?.textContent.includes('Guia consultada online'), visit.id);
  assert.match(await box.locator('.legacy-product-previous').textContent(), /Confirmar a quantidade/); assert.equal(await box.locator('img').count(), 0); assert.equal(await page.locator('#products-' + visit.id).isVisible(), false);
  await rejected('texto anterior'); assert.equal((await draft()).fields.products, original);
  await box.locator('[data-product-convert]').click(); await saved(); assert.equal((await products()).originalText, original); await box.locator('[data-product-add]').click();
  assert(await row.locator('option[value="' + items[3].id + '"]').isDisabled());
  await row.locator('select').selectOption(String(items[1].id)); await row.locator('[data-product-field=quantity]').fill('1.25'); await saved();
  await row.locator('select').selectOption(String(items[0].id)); await saved(); assert.equal(await row.locator('[data-product-field=unit]').inputValue(), 'L'); assert.equal(await row.locator('[data-product-field=quantity]').inputValue(), '1.25');
  await row.locator('[data-product-field=notes]').fill('Nota literal <b>texto</b>\nsegunda linha'); await saved();
  for (const quantity of ['', '0', '-1']) { await row.locator('[data-product-field=quantity]').fill(quantity); await saved(); await rejected('quantidade positiva'); assert.equal((await products()).rows[0].quantity, quantity); }
  await row.locator('[data-product-field=quantity]').fill('6'); await box.locator('[data-product-add]').click(); const second = box.locator('[data-product-row]').nth(1);
  await second.locator('select').selectOption(String(items[0].id)); await second.locator('[data-product-field=quantity]').fill('6'); await saved(); await rejected('Stock insuficiente'); assert.equal((await products()).rows.length, 2);
  await second.locator('[data-product-remove]').click(); await row.locator('select').selectOption(String(items[2].id)); await row.locator('[data-product-field=quantity]').fill('1.25'); await saved();
  for (const language of ['pt', 'en', 'fr', 'es', 'de']) {
    await box.locator('[data-product-language]').selectOption(language); await page.waitForFunction(language => document.documentElement.lang === language, language);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1100 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await row.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const controls = await row.evaluate(node => [...node.querySelectorAll('input,select,textarea,button')].map(control => { const r = control.getBoundingClientRect(), target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { field: control.dataset.productField || 'remove', height: r.height, width: r.width, y: r.y, unobstructed: control.contains(target), target: target?.tagName + '#' + target?.id + '.' + target?.className }; }));
      if (process.env.CW_CAPTURE_UI && controls.some(control => !control.unobstructed)) await page.screenshot({ path: 'reports/field-ui/LEGACY_PRODUCTS_layout_failure.png' });
      assert(controls.every(control => control.height >= 44 && control.unobstructed), language + ' ' + width + ': ' + JSON.stringify(controls));
      assert.equal(await row.locator('[data-product-field=unit]').inputValue(), 'KG');
      if (process.env.CW_CAPTURE_UI) { require('node:fs').mkdirSync('reports/field-ui', { recursive: true }); await page.setViewportSize({ width, height: 1600 }); await box.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' })); await box.screenshot({ path: `reports/field-ui/LEGACY_PRODUCTS_${language}_${width}.png` }); }
    }
  }
  await box.locator('[data-product-language]').selectOption('pt'); await page.setViewportSize({ width: 390, height: 1100 });
  const cache = await page.evaluate(() => { const key = Object.keys(localStorage).find(key => key.startsWith('cwLegacyVisitProducts:v1:')); return { key, raw: localStorage.getItem(key) }; }); assert(cache.raw); assert(!cache.raw.includes(token));
  await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await saved();
  assert.match(await box.locator('[role=status]').textContent(), /Cópia guardada/); assert.equal(await row.locator('select').inputValue(), String(items[2].id)); assert.equal((await products()).originalText, original); assert.match(await row.locator('[data-product-field=notes]').inputValue(), /segunda linha/);
  console.log('PASS explicit original-text conversion, exact duplicate row and literal unit/notes, incomplete/aggregate validation, five languages at 320/390/1440 and genuine offline reload');
  const healthy = await raw();
  // Earlier structured drafts are displayed without guessing their guide row.
  await page.evaluate(({ key, raw }) => { const data = JSON.parse(raw), product = JSON.parse(data.fields.products).rows[0]; delete product.workGuideId; delete product.workGuideItemId; data.fields.products = JSON.stringify([product]); localStorage.setItem(key, JSON.stringify(data)); }, { key: draftKey, raw: healthy });
  await page.reload({ waitUntil: 'domcontentloaded' }); await saved(); assert.equal(await row.locator('select').inputValue(), 'saved'); await rejected('Selecione novamente');
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: draftKey, raw: healthy }); await page.reload({ waitUntil: 'domcontentloaded' }); await saved();
  await page.evaluate(({ key }) => localStorage.setItem(key, '{broken'), cache); await page.reload({ waitUntil: 'domcontentloaded' }); await saved(); await rejected('Consulte a guia'); assert.equal(await page.evaluate(key => localStorage.getItem(key), cache.key), '{broken');
  await context.setOffline(false); await box.locator('[data-product-refresh]').click(); await page.waitForFunction(id => document.querySelector('#legacyProducts-' + id + ' [role=status]').textContent.includes('Guia consultada online'), visit.id); assert.equal(await page.evaluate(key => localStorage.getItem(key), cache.key), '{broken');
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), cache); await box.locator('[data-product-refresh]').click();
  const stockUrl = '**/api/guides/stock/' + vehicle.id + '?includeMovements=false';
  await page.route(stockUrl, route => route.fulfill({ status: 403, json: { ok: false } })); await box.locator('[data-product-refresh]').click(); await page.waitForFunction(id => document.querySelector('#legacyProducts-' + id + ' [role=status]').textContent.includes('recusado'), visit.id); await rejected('Consulte a guia');
  await page.unroute(stockUrl); await box.locator('[data-product-refresh]').click(); await page.waitForFunction(id => document.querySelector('#legacyProducts-' + id + ' [role=status]').textContent.includes('Guia consultada online'), visit.id);
  const staleGuide = await prisma.workGuideItem.update({ where: { id: items[2].id }, data: { unit: 'kg' } }); await box.locator('[data-product-refresh]').click(); await page.waitForFunction(id => document.querySelector('#legacyProducts-' + id + ' [data-product-field=name]')?.value === 'saved', visit.id); await rejected('única linha'); assert.equal((await products()).rows[0].unit, 'KG');
  await prisma.workGuideItem.update({ where: { id: staleGuide.id }, data: { unit: 'KG' } }); await box.locator('[data-product-refresh]').click(); await page.waitForFunction(({ id, item }) => document.querySelector('#legacyProducts-' + id + ' [data-product-field=name]')?.value === String(item), { id: visit.id, item: items[2].id });
  assert.deepEqual((await draft()).fields, JSON.parse(healthy).fields);
  console.log('PASS legacy rows require reselection; corrupt cache bytes stay intact; denied access and changed literal unit cannot silently use old stock or rewrite the draft');
  await context.setOffline(true); await finish.click(); await wait(page, () => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows.length === 1));
  const pending = await page.evaluate(() => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows[0])), sent = JSON.parse(pending.payload.products);
  assert.equal(sent[0].workGuideItemId, items[2].id); assert.equal(sent[0].workGuideId, guide.id); assert.equal(pending.payload.workGuideId, guide.id); assert.equal(sent[0].quantity, 1.25); assert.equal(sent[0].unit, 'KG'); assert.equal((await products()).originalText, original);
  const completeUrl = '**/api/core/visits/' + visit.id + '/complete'; await page.route(completeUrl, async route => { await route.fetch(); await route.abort(); }); await context.setOffline(false); await page.evaluate(() => runAutoSync());
  await wait(page, () => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows[0]?.failure)); await page.waitForFunction(() => !isSyncing); await page.unroute(completeUrl); await page.reload({ waitUntil: 'networkidle' }); await page.evaluate(() => runAutoSync()); await wait(page, () => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows.length === 0));
  assert.equal((await prisma.workGuideItem.findUnique({ where: { id: items[2].id } })).quantity, 8.75); assert.equal((await prisma.workGuideItem.findUnique({ where: { id: items[1].id } })).quantity, 10);
  assert.equal(await prisma.vehicleStockMovement.count({ where: { visitId: visit.id } }), 1); assert.equal(await prisma.stockMovement.count({ where: { visitId: visit.id } }), 1); assert.equal(await prisma.auditTrail.count({ where: { visitId: visit.id, eventType: 'VISIT_COMPLETED' } }), 1);
  assert.deepEqual((await prisma.serviceVisit.findUnique({ where: { id: visit.id } })).chemicalsJson, sent); assert.equal((await products()).originalText, original);
  assert((await page.evaluate(() => CWFieldWriteStore.records('VISIT_COMPLETION', CWFieldWriteStore.session(), true))).some(row => row.requestId === pending.requestId && row.response));
  assert(await row.locator('select').isDisabled());
  let release, started; const gate = new Promise(resolve => { release = resolve; }), waiting = new Promise(resolve => { started = resolve; });
  await page.route('**/api/guides/vehicles', async route => { const response = await route.fetch(); started(); await gate; await route.fulfill({ response }).catch(() => {}); });
  await box.locator('[data-product-refresh]').click(); await waiting; const beforeAccountChange = await raw(), cacheBefore = await page.evaluate(key => localStorage.getItem(key), cache.key);
  await page.evaluate(({ token, other }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: other.id, role: 'TECHNICIAN', name: other.name })); window.dispatchEvent(new Event('storage')); }, { token: otherToken, other }); release();
  await page.waitForFunction(() => !document.querySelector('.legacy-product-row')); assert.equal(await raw(), beforeAccountChange); assert.equal(await page.evaluate(key => localStorage.getItem(key), cache.key), cacheBefore);
  assert.equal(await page.evaluate(() => window.productXss), undefined); assert.deepEqual(errors, []);
  console.log('PASS immutable offline UUID, lost committed response, one debit/audit and two ledgers, original text retained after completion, and late account response cannot repaint or overwrite saved data');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
