'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), fs = require('node:fs/promises'), path = require('node:path');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
let browser, page, f; const errors = [], writes = [];
(async () => {
  f = await require('./helpers/field-guide-read-fixture')(prisma, 'materials-ui');
  const tech = f.technicians[0], vehicle = f.vehicles[0], work = f.works[0];
  const actor = { id: tech.id, role: tech.role }, token = jwt.sign(actor, getJwtSecret(), { expiresIn: '1h' });
  await prisma.workGuide.update({ where: { id: work.id }, data: { createdAt: new Date('2026-01-01T00:00:00Z') } });
  const values = [
    { unit: 'L', quantity: 0.1, usedQty: -0.25 }, { unit: 'L', quantity: 0.2, usedQty: 0 },
    { unit: 'l', quantity: 3, usedQty: 1 }, { unit: ' L ', quantity: 4, usedQty: -2 },
    { unit: null, quantity: 0, usedQty: -0.000001 }, { unit: '', quantity: 5, usedQty: 0 },
    { unit: 'kg', quantity: 1e-7, usedQty: 0.1 }, { unit: 'kg', quantity: 2e-7, usedQty: 0.2 },
  ];
  const name = ' Exact material <img src=x onerror=alert(1)> ';
  for (const [index, row] of values.entries()) {
    const data = { ...row, name, type: index % 2 ? 'CHEMICAL' : null, initialQty: 29 };
    if (index < work.items.length) await prisma.workGuideItem.update({ where: { id: work.items[index].id }, data });
    else await prisma.workGuideItem.create({ data: { ...data, workGuideId: work.id } });
  }
  const expected = await prisma.workGuideItem.findMany({ where: { workGuideId: work.id }, orderBy: { id: 'asc' } });
  await prisma.transportGuideItem.update({ where: { id: f.transport.items[0].id }, data: { name, unit: null, quantity: 0 } });
  const models = ['vehicle', 'technician', 'workGuide', 'workGuideItem', 'transportGuide', 'transportGuideItem', 'vehicleStockMovement', 'vehicleMaintenanceRecord', 'systemSetting', 'userAuditLog', 'fieldWriteRequest', 'invoice', 'payment'];
  const snapshot = () => Promise.all(models.map(k => prisma[k].findMany({ orderBy: { id: 'asc' } }))), before = await snapshot();
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1100 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, actor }) => {
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(actor));
    const interval = setInterval; window.setInterval = (fn, delay, ...args) => [15000, 30000].includes(delay) ? 0 : interval(fn, delay, ...args);
  }, { token, actor });
  page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
  context.on('request', r => { if (r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/')) writes.push(r.method() + ' ' + r.url()); });
  const settled = () => page.waitForFunction(() => ['transportGuideBox', 'workGuideBox', 'insuranceBox'].every(id => ['live', 'cache', 'unavailable'].includes(document.getElementById(id)?.dataset.source)) && document.getElementById('fieldDocsValue')?.textContent !== 'A validar');
  const open = async () => { await page.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' }); await settled(); await page.locator('[data-field-tab-button="docs"]').click(); };
  await open(); assert.equal(await page.locator('#workGuideBox').getAttribute('data-source'), 'live');
  const key = await page.evaluate(id => CWFieldDocuments.key(CWFieldDocuments.scope(CWFieldWriteStore.session(), id)), vehicle.id);
  const raw = () => page.evaluate(key => localStorage.getItem(key), key), safe = await raw();
  async function checkRows() {
    for (const kind of ['usage', 'balance']) {
      const rows = page.locator('[data-material-rows="' + kind + '"] .doc-item');
      assert.equal(await rows.count(), expected.length);
      for (const row of expected) {
        const field = kind === 'usage' ? 'usedQty' : 'quantity';
        // Locate by the preserved row identity; duplicate names are not combined.
        const item = page.locator('[data-material-rows="' + kind + '"] [data-material-id="' + row.id + '"]');
        assert.equal(await item.locator('.material-name').textContent(), name);
        assert.equal(await item.locator('[data-material-value]').textContent(), row[field] + ' ' + (row.unit?.trim() ? row.unit : 'Unidade não indicada'));
      }
    }
    assert.equal(await page.locator('[data-material-section] img').count(), 0);
    const totals = await page.locator('[data-material-totals="quantity"] .material-total').allTextContents();
    assert.deepEqual(totals, ['0.3 L', '3 l', '4  L ', '0.0000003 kg']);
    assert.deepEqual(await page.locator('[data-material-totals="usedQty"] .material-total').allTextContents(), ['-0.25 L', '1 l', '-2  L ', '0.3 kg']);
    assert.match(await page.locator('[data-material-summary]').innerText(), /não foram somadas/);
    assert.match(await page.locator('[data-material-section="usage"]').innerText(), /desde a abertura da guia/);
    assert(!/Usado hoje|Leitura final de quimicos|Stock final da viatura/.test(await page.locator('#workGuideBox').innerText()));
    assert.match(await page.locator('#transportGuideBox [data-material-value]').first().innerText(), /0 Unidade não indicada/);
  }
  await checkRows();
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await settled(); await page.locator('[data-field-tab-button="docs"]').click();
  assert.equal(await page.locator('#workGuideBox').getAttribute('data-source'), 'cache'); await checkRows(); assert.equal(await raw(), safe);
  // Older copies retain their source bytes. Initial stock is not a substitute
  // for a missing balance; a missing usage is not a zero.
  const legacy = JSON.parse(safe), data = legacy.sections.work.data;
  for (const key of ['itemCount', 'movementsIncluded', 'consumptionCount']) delete data[key];
  delete data.stock[0].quantity; delete data.stock[0].usedQty;
  const legacyBytes = JSON.stringify(legacy); await page.evaluate(({ key, bytes }) => localStorage.setItem(key, bytes), { key, bytes: legacyBytes });
  await page.reload({ waitUntil: 'domcontentloaded' }); await settled(); await page.locator('[data-field-tab-button="docs"]').click();
  for (const kind of ['usage', 'balance']) assert.match(await page.locator('[data-material-rows="' + kind + '"] [data-material-value]').first().innerText(), /Quantidade por confirmar/);
  assert.match(await page.locator('[data-material-totals="quantity"] .material-total').first().innerText(), /Quantidade por confirmar L/);
  assert.equal(await raw(), legacyBytes);
  await context.setOffline(false); await page.locator('#loadGuidesBtn').evaluate(el => el.click()); await settled(); await checkRows();
  const current = await raw(), confirmed = await page.locator('#workGuideBox').getAttribute('data-confirmed-at');
  const visual = path.join(__dirname, '../reports/field-visual/field-materials'); await fs.mkdir(visual, { recursive: true });
  for (const language of ['pt', 'en', 'fr', 'es', 'de']) for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1100 }); await page.evaluate(lang => { document.documentElement.lang = lang; }, language);
    await page.waitForFunction(lang => document.querySelector('[data-doc-copy="materialTotals"]')?.textContent === CWFieldDocumentCopy.text('materialTotals', {}, lang), language);
    assert.equal(await raw(), current); assert.equal(await page.locator('#workGuideBox').getAttribute('data-confirmed-at'), confirmed);
    assert.equal(await page.locator('[data-material-rows="usage"] .doc-item').count(), expected.length);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert(await page.locator('[data-material-section],[data-material-summary]').evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)));
    const node = page.locator('[data-material-summary]');
    await page.locator('#cw-v21-toast').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !document.getElementById('toast')?.classList.contains('show'));
    const height = await node.evaluate(el => Math.ceil(el.getBoundingClientRect().height));
    await page.setViewportSize({ width, height: Math.max(1200, height + 600) });
    await node.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    assert(await node.evaluate(el => {
      const tail = el.querySelector('[data-material-totals="usedQty"] p') || el.lastElementChild;
      const r = tail.getBoundingClientRect();
      return tail.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'material totals must remain readable above fixed navigation');
    await node.screenshot({ path: path.join(visual, 'totals-' + language + '-' + width + '.png') });
    if (language === 'pt' && width === 390) {
      const usage = page.locator('[data-material-section="usage"]');
      await usage.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await usage.screenshot({ path: path.join(visual, 'usage-pt-390.png') });
    }
  }
  const ratios = await page.locator('[data-material-section] p,[data-material-section] strong,[data-material-section] .material-name,[data-material-summary] p,[data-material-summary] strong,[data-material-summary] .material-unit').evaluateAll(nodes => {
    const lum = s => s.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    return nodes.filter(n => n.getClientRects().length).map(n => { const fg = lum(getComputedStyle(n).color); let p = n, bg; while (p) { const color = getComputedStyle(p).backgroundColor; if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') { bg = lum(color); break; } p = p.parentElement; } bg ??= 1; return (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05); });
  });
  assert(ratios.length && ratios.every(n => n >= 4.5), 'material contrast ' + Math.min(...ratios));
  assert.deepEqual(errors, []); assert.deepEqual(writes, []); assert.deepEqual(await snapshot(), before); assert.deepEqual(await fs.readFile(f.disk), f.oldBytes);
  console.log('PASS field materials: 8 duplicate-name rows retained by ID; negative/zero/null/blank/literal units; decimal totals without float noise; all material types; lifetime guide scope; old missing quantities stay unknown without initial/zero fallback; actual live API, cold offline copy and online recovery; 5 languages x 3 widths, 15 captures, no horizontal overflow, contrast >= 4.5:1; no API writes, 13-model snapshot and official document bytes unchanged.');
})().catch(async error => { console.error(error, errors); if (page) console.error(await page.locator('#workGuideBox').innerText().catch(() => '')); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (f) await f.cleanup(); await prisma.$disconnect(); });
