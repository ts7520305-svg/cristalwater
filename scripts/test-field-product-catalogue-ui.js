'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { chromium } = require('playwright'), wait = require('./fixtures/wait-browser-state');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const vehicle = await prisma.vehicle.create({ data: { plate: 'PC-' + Date.now(), active: true } }), tech = await prisma.technician.create({ data: { name: 'Catalogue owner', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Catalogue client', active: true } });
  const transport = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'PC-' + Date.now(), status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  const guide = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: transport.id, status: 'OPEN', isDraft: false } });
  await prisma.workGuideItem.createMany({ data: Array.from({ length: 207 }, (_, i) => ({ workGuideId: guide.id, name: i < 200 ? 'Cloro lote ' + String(i + 1).padStart(3, '0') : 'Ácido <img src=x onerror=window.catalogueXss=true>', unit: i === 206 ? null : i === 205 ? 'kg' : 'KG', type: 'CHEMICAL', quantity: 10, initialQty: 10 })) });
  const items = await prisma.workGuideItem.findMany({ where: { workGuideId: guide.id }, orderBy: { id: 'asc' } }), selected = items[202];
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(Date.now() + 86400000 * 30) } });
  const extraPool = await prisma.pool.create({ data: { name: 'EXTRA catalogue comparison', clientId: client.id, active: true } });
  await prisma.extraVisit.create({ data: { clientId: client.id, poolId: extraPool.id, technicianId: tech.id, status: 'PLANNED', scheduledAt: new Date(), billingMode: 'NO_CHARGE' } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const mode of ['MODERN', 'LEGACY']) {
    const pool = await prisma.pool.create({ data: { name: mode + ' catalogue pool', clientId: client.id, active: true } });
    const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'PLANNED', plannedDate: new Date(), date: new Date() } });
    const modern = mode === 'MODERN', context = await browser.newContext({ viewport: { width: 390, height: 1100 } });
    await context.addInitScript(({ token, tech, origin }) => {
      if (top !== window || location.origin !== origin) return;
      if (!localStorage.getItem('qaCatalogueSession')) { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' })); localStorage.setItem('qaCatalogueSession', '1'); }
      const interval = setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000].includes(delay) ? 0 : interval(callback, delay, ...args);
      Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } }); window.alert = () => {};
    }, { token, tech, origin: new URL(base).origin });
    const page = await context.newPage(), errors = []; page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    const card = page.locator(modern ? '#productsCard' : '#legacyProducts-' + visit.id), catalogue = card.locator('[data-product-catalogue]'), search = catalogue.locator('[data-catalogue-search]');
    const row = card.locator(modern ? '.dose-row' : '[data-product-row]').first(), select = row.locator('select'), refresh = card.locator(modern ? '#refreshDoseStockBtn' : '[data-product-refresh]');
    const quantity = row.locator(modern ? '[data-dose-field=quantity]' : '[data-product-field=quantity]');
    const key = modern ? 'cwFieldVisitDrafts:v2:TECH:' + tech.id : 'cwLegacyVisitDraft:v1:TECH:' + tech.id + ':' + visit.id;
    const raw = () => page.evaluate(key => localStorage.getItem(key), key), saved = () => page.waitForFunction(({ modern, id }) => modern ? document.getElementById('fieldSaveStatus')?.dataset.state === 'saved' : document.getElementById('legacyDraftStatus-' + id)?.textContent.startsWith('Rascunho guardado'), { modern, id: visit.id });
    const product = async () => { const value = JSON.parse(await raw()); return modern ? value.drafts['visit-REGULAR-' + visit.id].usedProducts[0] : JSON.parse(value.fields.products)[0]; };
    const openVisit = async done => {
      if (modern) { await page.locator('#poolSegments [data-pool-filter="' + (done ? 'DONE' : 'TODO') + '"]').evaluate(node => node.click()); await page.locator('#visitList [data-visit-index]').filter({ hasText: pool.name }).evaluate(node => node.click()); await page.locator('[data-field-tab-button=agora]').click(); }
    };
    await page.goto(base + (modern ? '/technician-field-mode' : '/technician.html'), { waitUntil: 'networkidle' }); await openVisit(false);
    await page.waitForFunction(({ modern, id }) => document.querySelector((modern ? '#productsCard' : '#legacyProducts-' + id) + ' [data-catalogue-count]')?.textContent.includes('207'), { modern, id: visit.id });
    await card.locator(modern ? '#addDoseBtn' : '[data-product-add]').click(); await saved(); const untouched = await raw(), seen = [];
    while (true) {
      const visible = await select.locator('[data-catalogue-result=page]').evaluateAll(nodes => nodes.map(node => Number(node.value))); assert(visible.length <= 25); seen.push(...visible); assert.equal(await select.inputValue(), '');
      if (await catalogue.locator('[data-catalogue-next]').isDisabled()) break;
      await catalogue.locator('[data-catalogue-next]').click();
    }
    assert.deepEqual(seen, items.map(item => item.id)); assert.equal(await raw(), untouched); assert.match(await catalogue.locator('[data-catalogue-count]').textContent(), /201–207 de 207/);
    await refresh.click(); await page.waitForFunction(({ modern, id }) => document.querySelector((modern ? '#productsCard' : '#legacyProducts-' + id) + ' [data-catalogue-count]')?.textContent.includes('201–207'), { modern, id: visit.id });
    await search.fill('acido KG'); assert.equal(await select.locator('[data-catalogue-result=page]').count(), 6); await select.selectOption(String(selected.id)); await quantity.fill('0.25'); await saved();
    assert.equal((await product()).workGuideItemId, selected.id); assert.equal((await product()).unit, 'KG'); let chosen = await raw(); const chosenProduct = await product();
    await search.fill('no matching product [.*]'); assert.equal(await select.locator('[data-catalogue-result=page]').count(), 0); assert.equal(await select.locator('[data-catalogue-result=pinned]').count(), 1); assert.equal(await select.inputValue(), String(selected.id)); assert.match(await catalogue.locator('[data-catalogue-count]').textContent(), /0–0 de 0/); assert.equal(await raw(), chosen);
    await search.fill('#' + items[205].id); assert.equal(await select.locator('[data-catalogue-result=page]').count(), 1); assert.match(await select.locator('[data-catalogue-result=page]').textContent(), /10 kg/); assert.equal(await select.inputValue(), String(selected.id));
    if (modern) {
      await page.locator('#visitList [data-visit-index]').filter({ hasText: extraPool.name }).evaluate(node => node.click()); await page.waitForFunction(() => document.querySelector('[data-catalogue-search]')?.value === ''); await search.fill('#' + items[0].id); await openVisit(false);
    } else await page.evaluate(() => loadRoute());
    await page.waitForFunction(({ modern, id, value }) => document.querySelector((modern ? '#productsCard' : '#legacyProducts-' + id) + ' [data-catalogue-search]')?.value === value, { modern, id: visit.id, value: '#' + items[205].id });
    await saved(); assert.equal(await select.inputValue(), String(selected.id)); assert.deepEqual(await product(), chosenProduct); chosen = await raw();
    for (const language of ['pt', 'en', 'fr', 'es', 'de']) {
      await page.locator(modern ? '#cwLanguageSelect' : '#legacyProducts-' + visit.id + ' [data-product-language]').selectOption(language);
      await page.waitForFunction(({ modern, id, language }) => document.querySelector((modern ? '#productsCard' : '#legacyProducts-' + id) + ' [data-catalogue-search]')?.placeholder === CWFieldDocumentCopy.text('cataloguePlaceholder', {}, language), { modern, id: visit.id, language });
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1100 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await catalogue.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        assert(await catalogue.evaluate(node => [...node.querySelectorAll('input,button')].every(control => { const rect = control.getBoundingClientRect(); return rect.height >= 44 && control.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); })), mode + ' ' + language + ' ' + width);
        assert.equal(await select.inputValue(), String(selected.id)); assert.equal(await raw(), chosen);
        if (process.env.CW_CAPTURE_UI) { require('node:fs').mkdirSync('reports/field-ui', { recursive: true }); await catalogue.screenshot({ path: `reports/field-ui/PRODUCT_CATALOGUE_${mode}_${language}_${width}.png` }); }
      }
    }
    await page.setViewportSize({ width: 390, height: 1100 }); await page.locator(modern ? '#cwLanguageSelect' : '#legacyProducts-' + visit.id + ' [data-product-language]').selectOption('pt');
    await catalogue.locator('[data-catalogue-clear]').click(); assert.equal(await search.inputValue(), ''); assert.equal(await select.locator('[data-catalogue-result=page]').count(), 25); assert.equal(await select.inputValue(), String(selected.id)); assert.equal(await raw(), chosen);
    await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await openVisit(false); await saved();
    assert.equal(await select.inputValue(), String(selected.id)); assert.equal(await select.locator('[data-catalogue-result=pinned]').count(), 1); assert.equal((await product()).workGuideItemId, selected.id); assert.equal(await quantity.inputValue(), '0.25');
    await search.fill('acido'); assert.equal(await select.locator('[data-catalogue-result=page]').count(), 7); assert(await select.locator('option[value="' + items[206].id + '"]').isDisabled()); assert.equal(await card.locator('img').count(), 0);
    console.log('PASS ' + mode + ' 207 guide rows traversed once in pages of 25; literal/accent/ID search, duplicate rows, null/literal units, pinned selection, unchanged draft bytes, refresh, five languages and real offline reload');
    await page.locator(modern ? '#finishBtn' : '[data-action=complete][data-visit-id="' + visit.id + '"]').click();
    await wait(page, () => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows.length === 1));
    const pending = await page.evaluate(() => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows[0])); assert.equal(JSON.parse(pending.payload.products)[0].workGuideItemId, selected.id);
    await context.setOffline(false); await page.evaluate(modern => modern ? CWFieldOffline.flush() : runAutoSync(), modern); await wait(page, () => CWFieldWriteStore.records('VISIT_COMPLETION').then(rows => rows.length === 0));
    const stock = await prisma.workGuideItem.findUniqueOrThrow({ where: { id: selected.id } }); assert.equal(stock.quantity, modern ? 9.75 : 9.5); assert.equal((await prisma.workGuideItem.findUniqueOrThrow({ where: { id: items[201].id } })).quantity, 10); assert.equal(await prisma.vehicleStockMovement.count({ where: { visitId: visit.id } }), 1);
    if (modern) { await page.reload({ waitUntil: 'networkidle' }); await openVisit(true); assert.match(await page.locator('#finishBtn').textContent(), /Guardar correção/); const disabled = await select.isDisabled(); await search.fill('Cloro'); assert.equal(await select.isDisabled(), disabled); assert.equal(await select.inputValue(), String(selected.id)); assert.equal(await prisma.vehicleStockMovement.count({ where: { visitId: visit.id } }), 1); }
    assert.equal(await page.evaluate(() => window.catalogueXss), undefined); assert.deepEqual(errors, []); await context.close();
    console.log('PASS ' + mode + ' filtered offline completion debits the chosen original row once; other identical rows retain their balance and filtering preserves the existing correction state');
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
