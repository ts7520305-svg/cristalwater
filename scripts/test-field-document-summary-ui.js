'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), fs = require('node:fs/promises'), path = require('node:path');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
let browser, page, f; const errors = [], writes = [];
(async () => {
  f = await require('./helpers/technician-guide-read-fixture')(prisma, 'summary-ui');
  const tech = f.technicians[0], vehicle = f.vehicles[0], work = f.works[0];
  const actor = { id: tech.id, role: tech.role }, token = jwt.sign(actor, getJwtSecret(), { expiresIn: '1h' });
  await prisma.vehicleStockMovement.createMany({ data: [
    { itemName: ' Exact zero <img src=x> ', unit: null, quantity: 0 },
    { itemName: ' Exact correction ', unit: ' kg ', quantity: -0.000001 },
  ].map(row => ({ ...row, vehicleId: vehicle.id, technicianId: tech.id, workGuideId: work.id, movementType: 'CONSUMPTION', source: 'QA', notes: ' Exact note <img src=x> ', createdAt: new Date() })) });
  const expected = await prisma.vehicleStockMovement.findMany({ where: { workGuideId: work.id, movementType: 'CONSUMPTION' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  assert.equal(expected.length, 105);
  const models = ['vehicle', 'technician', 'workGuide', 'workGuideItem', 'transportGuide', 'transportGuideItem', 'vehicleStockMovement', 'vehicleMaintenanceRecord', 'systemSetting', 'userAuditLog', 'fieldWriteRequest', 'invoice', 'payment'];
  const snapshot = () => Promise.all(models.map(k => prisma[k].findMany({ orderBy: { id: 'asc' } }))), before = await snapshot();
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1100 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, actor }) => {
    if (!localStorage.getItem('token')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(actor));
    }
    const interval = setInterval; window.setInterval = (fn, delay, ...args) => [15000, 30000].includes(delay) ? 0 : interval(fn, delay, ...args);
  }, { token, actor });
  page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
  context.on('request', r => { if (r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/')) writes.push(r.method() + ' ' + r.url()); });
  const visual = path.join(__dirname, '../reports/field-visual/field-document-summary'); await fs.mkdir(visual, { recursive: true });
  const capture = async (selector, name) => {
    await page.locator('#cw-v21-toast').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !document.getElementById('toast')?.classList.contains('show'));
    const node = page.locator(selector), height = await node.evaluate(el => Math.ceil(el.getBoundingClientRect().height));
    // Fit the section above fixed navigation without changing the product or hiding overlays.
    await page.setViewportSize({ width: page.viewportSize().width, height: Math.max(1100, height + 240) });
    await node.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await node.screenshot({ path: path.join(visual, name) });
    await page.setViewportSize({ width: page.viewportSize().width, height: 1100 });
  };
  const endpoint = '**/api/guides/stock/' + vehicle.id + '?*';
  const settled = () => page.waitForFunction(() => ['transportGuideBox', 'workGuideBox', 'insuranceBox'].every(id => ['live', 'cache', 'unavailable'].includes(document.getElementById(id)?.dataset.source)) && document.getElementById('fieldDocsValue')?.textContent !== 'A validar');
  const refresh = async () => { await page.locator('#loadGuidesBtn').evaluate(el => el.click()); await settled(); };
  const open = async () => { await page.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' }); await settled(); await page.locator('[data-field-tab-button="docs"]').click(); };
  const ids = () => page.locator('[data-consumption-id]').evaluateAll(rows => rows.map(row => Number(row.dataset.consumptionId)));
  const source = (id = 'workGuideBox') => page.locator('#' + id).getAttribute('data-source');
  await open(); assert.equal(await source(), 'live');
  const key = await page.evaluate(id => CWFieldDocuments.key(CWFieldDocuments.scope(CWFieldWriteStore.session(), id)), vehicle.id);
  const raw = () => page.evaluate(key => localStorage.getItem(key), key);
  const restore = bytes => page.evaluate(({ key, bytes }) => localStorage.setItem(key, bytes), { key, bytes });
  const complete = async () => {
    assert.deepEqual(await ids(), expected.slice(0, 8).map(row => row.id));
    assert.equal(await page.locator('[data-consumption-summary]').getAttribute('data-total'), '105');
    assert.match(await page.locator('[data-consumption-count]').innerText(), /8.*105/);
    assert.equal(await page.locator('[data-consumption-summary] img').count(), 0);
    assert(!(await page.locator('[data-consumption-summary]').innerText()).includes('FOREIGN_MOVE'));
    assert.match(await page.locator('[data-consumption-id="' + expected[1].id + '"] strong').innerText(), /0 Unidade não indicada/);
    assert.equal(await page.locator('[data-consumption-id="' + expected[0].id + '"] strong').textContent(), '-0.000001  kg ');
  };
  await complete();
  let safe = await raw(); const saved = JSON.parse(safe);
  for (const [kind, id] of [['transport', 'transportGuideBox'], ['work', 'workGuideBox'], ['insurance', 'insuranceBox']]) {
    assert.equal(await source(id), 'live');
    assert.equal(await page.locator('#' + id).getAttribute('data-confirmed-at'), saved.sections[kind].confirmedAt);
    assert.match(await page.locator('#' + id + ' [data-doc-provenance]').innerText(), /Consultado online/);
  }
  // Follow the summary's actual link, including movements other than consumption.
  await page.locator('[data-complete-movements]').click(); await page.waitForURL('**/technician-guide#movementPanel');
  await page.waitForFunction(() => document.getElementById('movementPanel')?.dataset.state === 'ready');
  assert.match(await page.locator('#movementTotal').innerText(), /209/); assert.equal(await page.locator('#movements article').count(), 25);
  await open(); await complete(); safe = await raw();
  for (const mode of ['truncated', 'count', 'duplicate', 'omitted', 'scope', 'ownerHeader', 'cacheHeader', 'type']) {
    const previous = JSON.parse(await raw()).sections.work;
    await page.route(endpoint, async route => {
      const response = await route.fetch(), data = await response.json(), headers = response.headers();
      if (mode === 'truncated') data.movements.pop();
      if (mode === 'count') data.consumptionCount = '105';
      if (mode === 'duplicate') data.movements[1] = data.movements[0];
      if (mode === 'omitted') { data.movements = []; data.movementsIncluded = false; data.consumptionCount = null; }
      if (mode === 'scope') delete data.scope;
      if (mode === 'ownerHeader') headers['x-cw-owner'] = 'USER:999:TECH:' + tech.id;
      if (mode === 'cacheHeader') headers['cache-control'] = 'public';
      if (mode === 'type') data.movements[0].movementType = 'LOAD';
      await route.fulfill({ response, headers, json: data });
    });
    await refresh(); assert.equal(await source(), 'cache', mode); await complete();
    assert.equal(await source('transportGuideBox'), 'live'); assert.equal(await source('insuranceBox'), 'live');
    assert.deepEqual(JSON.parse(await raw()).sections.work, previous, mode);
    assert.match(await page.locator('#workGuideBox [data-doc-provenance]').innerText(), /Cópia guardada/);
    if (mode === 'truncated') await capture('#workGuideBox [data-doc-provenance]', 'mixed-copy-390.png');
    await page.unroute(endpoint);
  }
  await refresh(); safe = await raw();
  // A missing section is unavailable, whereas an explicitly empty successful section is a confirmed absence.
  const missing = JSON.parse(safe); delete missing.sections.work; await restore(JSON.stringify(missing));
  await page.route(endpoint, r => r.fulfill({ status: 503, json: { ok: false } })); await refresh();
  assert.equal(await source(), 'unavailable'); assert.match(await page.locator('#workGuideBox').innerText(), /Consulta indisponível/);
  assert(!/Em falta|Sem guia de obra aberta/.test(await page.locator('#workGuideBox').innerText()));
  assert.equal(await page.locator('#workGuideBox a,[data-consumption-id]').count(), 0);
  await capture('#workGuideBox', 'unavailable-390.png');
  await page.unroute(endpoint); await restore(safe);
  for (const mode of ['absent', 'empty']) {
    await page.route(endpoint, async route => {
      const response = await route.fetch(), data = await response.json(); data.movements = []; data.consumptionCount = 0;
      if (mode === 'absent') Object.assign(data, { workGuide: null, stock: [], itemCount: 0, transportGuideDocument: null, missingTransportGuide: false });
      await route.fulfill({ response, json: data });
    });
    await refresh(); assert.equal(await source(), 'live');
    if (mode === 'absent') assert.match(await page.locator('#workGuideBox').innerText(), /Sem guia de obra aberta/);
    else { assert.match(await page.locator('[data-consumption-count]').innerText(), /Sem consumos registados/); assert.equal(await page.locator('[data-consumption-summary]').getAttribute('data-total'), '0'); }
    await page.unroute(endpoint); await restore(safe);
  }
  await refresh(); safe = await raw();
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await settled(); await page.locator('[data-field-tab-button="docs"]').click();
  for (const id of ['transportGuideBox', 'workGuideBox', 'insuranceBox']) assert.equal(await source(id), 'cache');
  await complete(); assert.equal(await raw(), safe);
  assert.match(await page.locator('[data-consumption-summary]').innerText(), /precisam de ligação/);
  const legacy = JSON.parse(safe); for (const k of ['itemCount', 'movementsIncluded', 'consumptionCount']) delete legacy.sections.work.data[k];
  const legacyBytes = JSON.stringify(legacy); await restore(legacyBytes); await refresh();
  assert.equal(await source(), 'cache'); assert.match(await page.locator('[data-consumption-count]').innerText(), /8 de 105.*Total da guia por confirmar/);
  assert.equal(await page.locator('[data-consumption-summary]').getAttribute('data-total'), ''); assert.equal(await raw(), legacyBytes);
  await capture('[data-consumption-count]', 'legacy-count-390.png');
  const damaged = JSON.parse(safe); damaged.sections.work.data.movements.pop(); const damagedBytes = JSON.stringify(damaged);
  await restore(damagedBytes); await refresh(); assert.equal(await source(), 'unavailable'); assert.equal(await ids().then(rows => rows.length), 0); assert.equal(await raw(), damagedBytes);
  await page.evaluate(key => localStorage.removeItem(key), key); await refresh();
  for (const id of ['transportGuideBox', 'workGuideBox', 'insuranceBox']) { assert.equal(await source(id), 'unavailable'); assert(!/Em falta|Sem seguro registado/.test(await page.locator('#' + id).innerText())); }
  await restore(safe); await context.setOffline(false); await refresh(); await complete(); safe = await raw();
  const ratios = await page.locator('[data-doc-provenance] strong,[data-consumption-summary] p,[data-consumption-summary] strong,[data-consumption-summary] time,[data-complete-movements]').evaluateAll(nodes => {
    const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    return nodes.filter(n => n.getClientRects().length).map(n => { const fg = lum(rgb(getComputedStyle(n).color)); let p = n, bg; while (p) { const c = getComputedStyle(p).backgroundColor; if (c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)') { bg = lum(rgb(c)); break; } p = p.parentElement; } bg ??= 1; return (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05); });
  });
  assert(ratios.length && ratios.every(r => r >= 4.5), 'summary contrast ' + Math.min(...ratios));
  // Language repaint changes only explanatory text; the original timestamp, rows and cache remain unchanged.
  const confirmedAt = await page.locator('#workGuideBox').getAttribute('data-confirmed-at');
  for (const lang of ['pt', 'en', 'fr', 'es', 'de']) for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1100 }); await page.evaluate(lang => { document.documentElement.lang = lang; }, lang);
    await page.waitForFunction(lang => document.querySelector('[data-doc-copy="full"]')?.textContent === CWFieldDocumentCopy.text('full', {}, lang), lang);
    assert.equal(await page.locator('#workGuideBox').getAttribute('data-confirmed-at'), confirmedAt); assert.equal(await raw(), safe);
    assert.deepEqual(await ids(), expected.slice(0, 8).map(row => row.id));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert(await page.locator('[data-consumption-summary]').evaluate(el => {
      const a = el.querySelector('a').getBoundingClientRect(), bounds = el.getBoundingClientRect();
      return el.scrollWidth <= el.clientWidth + 1 && a.height >= 44 && a.left >= bounds.left && a.right <= bounds.right + 1;
    }));
    await capture('[data-consumption-summary]', 'summary-' + lang + '-' + width + '.png');
    await page.locator('[data-complete-movements]').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    assert(await page.locator('[data-complete-movements]').evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('a') === el; }));
  }
  assert.deepEqual(errors, []); assert.equal(writes.length, 0, writes.join('\n')); assert.deepEqual(await snapshot(), before); assert.deepEqual(await fs.readFile(f.disk), f.oldBytes);
  console.log('PASS document summary: 8 of 105 exact own consumptions, 209 total movements through actual reader link, zero/negative/null/literal units and notes; independent live/cache/unavailable provenance and original timestamps; rejected truncation/count/duplicates/omission/scope/headers/type; explicit absence and confirmed zero; cold offline reload, old v3 unknown total, corrupt bytes preserved, offline without cache, online recovery; 5 languages x 3 widths, 44px unobscured controls, contrast >= 4.5:1 and 18 screenshots; zero API writes, 13-model snapshot and original official bytes unchanged.');
})().catch(async error => { console.error(error, errors); if (page) console.error(await page.locator('#workGuideBox').innerText().catch(() => '')); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (f) await f.cleanup(); await prisma.$disconnect(); });
