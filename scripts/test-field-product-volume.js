'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto'), { spawn } = require('node:child_process'), { performance } = require('node:perf_hooks');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002', database = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(database.hostname) && /qa/i.test(database.pathname));
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const { PrismaClient } = require('@prisma/client'), prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
global.__CRISTAL_WATER_PRISMA__ = prisma;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex'), mib = bytes => Math.round(bytes / 1048576 * 100) / 100;
const tokenFor = id => require('jsonwebtoken').sign({ id, role: 'TECHNICIAN' }, require('../src/utils/jwtSecret').getJwtSecret(), { expiresIn: '30m' });
const folder = path.join(__dirname, '../reports/field-suite/product-volume');
let completed = false;
process.on('exit', () => { if (!completed && !process.exitCode) { fs.writeSync(2, 'Product volume exited before assertions completed\n'); process.exitCode = 1; } });

async function apiProbe(f) {
  const app = require('express')(); app.use('/api/guides', require('../src/routes/guideRoutes'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = 'http://127.0.0.1:' + server.address().port + '/api/guides/stock/' + f.vehicle.id;
  let measuring = false; const sql = { queries: 0, writes: 0, durationMs: 0 };
  prisma.$on('query', e => { if (measuring) { sql.queries++; sql.durationMs += e.duration; if (/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(e.query)) sql.writes++; } });
  try {
    global.gc?.(); const peak = { rss: process.memoryUsage().rss, heap: process.memoryUsage().heapUsed }, sample = () => { const m = process.memoryUsage(); peak.rss = Math.max(peak.rss, m.rss); peak.heap = Math.max(peak.heap, m.heapUsed); };
    const timer = setInterval(sample, 5), start = performance.now(); let response, raw, ms; measuring = true;
    try { response = await fetch(url, { headers: { Authorization: 'Bearer ' + tokenFor(f.tech.id) }, signal: AbortSignal.timeout(30000) }); raw = await response.text(); ms = performance.now() - start; sample(); }
    finally { measuring = false; clearInterval(timer); }
    const body = JSON.parse(raw); sample(); assert.equal(response.status, 200); assert.equal(body.ok, true);
    assert.equal(body.itemCount, f.rows.length); assert.equal(hash(body.stock.map(r => r.id)), hash(f.rows.map(r => r.id))); assert.deepEqual(body.stock, body.workGuide.items);
    for (let i = 0; i < f.rows.length; i++) for (const key of ['id', 'workGuideId', 'name', 'unit', 'quantity', 'initialQty', 'usedQty']) assert.equal(body.stock[i][key], f.rows[i][key]);
    assert.equal(sql.writes, 0); assert(ms < 30000); assert(Buffer.byteLength(raw) < 64 * 1048576); assert(peak.rss < 768 * 1048576);
    for (const [token, status] of [[null, 401], [tokenFor(f.other.id), 403]]) assert.equal((await fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} })).status, status);
    return { mode: 'API', products: f.rows.length, durationMs: Math.round(ms * 10) / 10, jsonBytes: Buffer.byteLength(raw), sampledRssMiB: mib(peak.rss), sampledHeapMiB: mib(peak.heap), sql, exactOrderedIds: true, literalFields: true, anonymousDenied: true, foreignTechnicianDenied: true };
  } finally { await new Promise(resolve => server.close(resolve)); }
}

async function browserProbe(f, mode) {
  const legacy = mode === 'LEGACY', correction = mode === 'CORRECTION', extra = mode === 'EXTRA' || correction, visit = f.visits[mode];
  const selected = f.rows.at(-1), nullUnit = f.rows.at(-4), lowerUnit = f.rows.at(-3);
  const browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let page, phase = 'opening';
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1100 } });
    await context.addInitScript(({ token, tech, origin }) => {
      if (top !== window || location.origin !== origin) return;
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      const interval = setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000].includes(delay) ? 0 : interval(callback, delay, ...args);
      Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } }); window.alert = () => {};
    }, { token: tokenFor(f.tech.id), tech: f.tech, origin: new URL(base).origin });
    page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = [], writes = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    page.on('request', r => { if (r.url().startsWith(base + '/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(r.method() + ' ' + new URL(r.url()).pathname); });
    const host = correction ? '#extraCorrectionProductSection' : legacy ? '#legacyProducts-' + visit.id : '#productsCard';
    const rowCss = correction ? '.extra-correction-product' : legacy ? '[data-product-row]' : '.dose-row';
    const card = page.locator(host), catalogue = card.locator('[data-product-catalogue]'), row = card.locator(rowCss).first(), select = row.locator('select'), search = catalogue.locator('[data-catalogue-search]');
    const key = correction ? `cwExtraCorrectionDraft:v1:TECH:${f.tech.id}:${visit.id}` : legacy ? `cwLegacyVisitDraft:v1:TECH:${f.tech.id}:${visit.id}` : `cwFieldVisitDrafts:v2:TECH:${f.tech.id}`;
    const raw = () => page.evaluate(k => localStorage.getItem(k), key);
    const saved = () => page.waitForFunction(({ mode, id }) => mode === 'CORRECTION' ? document.querySelector('#extraCorrectionStatus')?.textContent.includes('Rascunho guardado') : mode === 'LEGACY' ? document.getElementById('legacyDraftStatus-' + id)?.textContent.startsWith('Rascunho guardado') : document.getElementById('fieldSaveStatus')?.dataset.state === 'saved', { mode, id: visit.id });
    const product = async () => { const d = JSON.parse(await raw()); return correction ? d.payload.products[0] : legacy ? JSON.parse(d.fields.products)[0] : d.drafts['visit-' + (extra ? 'EXTRA-' : 'REGULAR-') + visit.id].usedProducts[0]; };
    const open = async () => {
      if (!legacy) {
        await page.locator('#poolSegments [data-pool-filter="' + (correction ? 'DONE' : 'TODO') + '"]').evaluate(n => n.click());
        await page.locator('#visitList [data-visit-index]').filter({ hasText: visit.poolName }).evaluate(n => n.click());
        await page.locator('[data-field-tab-button=agora]').click();
        if (correction) { await page.locator('#finishBtn').click(); await page.waitForFunction(() => document.querySelector('#extraCorrectionDialog')?.open && !document.querySelector('#extraCorrectionPreview').disabled); }
      }
      await page.waitForFunction(({ host, n }) => document.querySelector(host + ' [data-catalogue-count]')?.textContent.includes(' de ' + n + ' ·'), { host, n: f.rows.length });
    };
    const start = performance.now(); await page.goto(base + (legacy ? '/technician.html' : '/technician-field-mode'), { waitUntil: 'networkidle' }); await open();
    if (!correction) { await card.locator(legacy ? '[data-product-add]' : '#addDoseBtn').click(); await saved(); }
    else { await page.locator('#extraCorrectionDialog [name=reason]').fill('Verificar catálogo grande sem enviar correção'); await saved(); }
    const loadMs = performance.now() - start, before = await raw();
    // Exercise the actual next-button handlers and inspect the DOM after every
    // synchronous render, without hundreds of Playwright round trips.
    const traversal = await page.evaluate(({ host, rowCss }) => {
      const box = document.querySelector(host), ids = [], start = performance.now(); let pages = 0, maxOptions = 0;
      for (;;) {
        const select = box.querySelector(rowCss + ' select'), options = [...select.querySelectorAll('[data-catalogue-result=page]')];
        ids.push(...options.map(o => Number(o.value))); pages++; maxOptions = Math.max(maxOptions, options.length);
        if (pages > 1000) throw Error('Non-terminating catalogue');
        const next = box.querySelector('[data-catalogue-next]'); if (next.disabled) break; next.click();
      }
      return { ids, pages, maxOptions, durationMs: performance.now() - start };
    }, { host, rowCss });
    assert.equal(hash(traversal.ids), hash(f.rows.map(r => r.id))); assert(traversal.maxOptions <= 25); assert.equal(await raw(), before);
    await search.fill('ÁCIDO KG'); assert(await select.locator('option[value="' + selected.id + '"]').count());
    await select.selectOption(String(selected.id)); await row.locator(legacy || correction ? '[data-product-field=quantity]' : '[data-dose-field=quantity]').fill('0.25'); await saved();
    const chosen = await raw(), picked = await product(); assert.equal(picked.workGuideItemId, selected.id); assert.equal(picked.workGuideId, f.guide.id); assert.equal(picked.name, selected.name); assert.equal(picked.unit, selected.unit);
    for (const query of ['missing [.*]', '#' + lowerUnit.id, '#' + nullUnit.id]) {
      await search.fill(query); assert.equal(await select.inputValue(), String(selected.id)); assert.equal(await raw(), chosen);
      assert.equal(await select.locator('[data-catalogue-result=pinned]').count(), 1);
      if (query === '#' + nullUnit.id) {
        const option = await select.locator('option[value="' + nullUnit.id + '"]').evaluate(n => ({ disabled: n.disabled, html: n.outerHTML }));
        assert(option.disabled, JSON.stringify(option));
      }
      if (query === '#' + lowerUnit.id) assert.match(await select.locator('option[value="' + lowerUnit.id + '"]').textContent(), / l/);
    }
    await catalogue.locator('[data-catalogue-clear]').click(); assert.equal(await select.inputValue(), String(selected.id)); assert.equal(await raw(), chosen);
    assert.equal(await card.locator('img').count(), 0); assert((await select.locator('option[value="' + selected.id + '"]').textContent()).includes(selected.name));
    const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable'); const metrics = await cdp.send('Performance.getMetrics');
    const heapMiB = mib(metrics.metrics.find(m => m.name === 'JSHeapUsedSize').value);
    const storageChars = await page.evaluate(() => Object.keys(localStorage).reduce((n, k) => n + k.length + localStorage.getItem(k).length, 0));
    console.log(JSON.stringify({ productVolumeBrowserMeasurement: { mode, products: f.rows.length, loadMs, traversalMs: traversal.durationMs, heapMiB, storageChars,
      cacheStatus: legacy ? await card.locator('[role=status]').textContent() : null } }));
    assert(loadMs < 30000); assert(traversal.durationMs < 30000); assert(heapMiB < 256);
    phase = 'offline-reload';
    await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); const reload = performance.now();
    await page.reload({ waitUntil: 'domcontentloaded' }); await open();
    assert.equal(await select.inputValue(), String(selected.id)); assert.deepEqual(await product(), picked);
    await search.fill('#' + selected.id); assert.equal(await select.locator('[data-catalogue-result=page]').count(), 1); assert.equal(await select.inputValue(), String(selected.id));
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    return { mode, products: f.rows.length, loadMs: Math.round(loadMs * 10) / 10, traversalMs: Math.round(traversal.durationMs * 10) / 10, pages: traversal.pages, maximumPageOptions: traversal.maxOptions,
      browserJsHeapMiB: heapMiB, localStorageChars: storageChars, offlineReloadMs: Math.round((performance.now() - reload) * 10) / 10, exactOrderedIds: true, selectedBeyond200: selected.id, identityAndDraftPreserved: true, literalNames: true, writes: 0, pageErrors: 0 };
  } catch (error) {
    const diagnostics = page ? await page.evaluate(() => ({
      storage: Object.keys(localStorage).filter(k => /Products|Documents|Draft|RouteCache/.test(k)).map(k => ({ key: k, chars: localStorage.getItem(k).length })),
      statuses: [...document.querySelectorAll('.legacy-products [role=status],[data-catalogue-count],#extraCorrectionStatus,#fieldSaveStatus')].map(n => ({ id: n.id, text: n.textContent.slice(0, 600) })),
    })).catch(() => null) : null;
    const failure = { mode, products: f.rows.length, phase, error: error.message, diagnostics };
    fs.writeFileSync(path.join(folder, 'failed-probe.json'), JSON.stringify(failure, null, 2) + '\n');
    console.error(JSON.stringify({ productVolumeFailure: failure })); throw error;
  } finally { await browser.close(); }
}

async function child(file, mode) {
  const f = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = mode === 'API' ? await apiProbe(f) : await browserProbe(f, mode);
  completed = true; console.log(JSON.stringify({ productVolumeProbe: { ok: true, phase: 'assertions-completed', ...result } }));
}
async function run(file, mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--expose-gc', __filename, 'probe', file, mode], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; }); const timer = setTimeout(() => child.kill('SIGKILL'), 55000);
    child.once('error', e => { clearTimeout(timer); reject(e); }); child.once('close', (code, signal) => { clearTimeout(timer);
      if (code !== 0 || signal) return reject(Error(mode + ' failed ' + code + '/' + signal + '\n' + out.slice(-3000) + err.slice(-5000)));
      const line = out.split('\n').find(l => l.startsWith('{"productVolumeProbe"')); if (!line) return reject(Error('Missing completion proof'));
      const result = JSON.parse(line).productVolumeProbe; assert(result.ok && result.phase === 'assertions-completed'); console.log(JSON.stringify(result)); resolve(result);
    });
  });
}

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-product-volume-')), file = path.join(temporary, 'fixture.json'), stamp = 'PV-' + randomUUID();
  fs.mkdirSync(folder, { recursive: true }); const output = path.join(folder, 'results.json'), results = [];
  const regression = process.env.CW_PRODUCT_VOLUME_REGRESSION === 'true', profiles = regression ? [10001] : [201, 1001, 10001], modes = regression ? ['API', 'LEGACY'] : ['API', 'MODERN', 'LEGACY', 'EXTRA', 'CORRECTION'];
  fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'started' }));
  const models = ['vehicle', 'technician', 'client', 'pool', 'transportGuide', 'workGuide', 'workGuideItem', 'serviceVisit', 'extraVisit', 'vehicleStockMovement', 'vehicleMaintenanceRecord'];
  const baseline = {}; for (const model of models) baseline[model] = await prisma[model].count();
  let f = {}, previous = 0;
  try {
    f.vehicle = await prisma.vehicle.create({ data: { plate: stamp, active: true } });
    f.tech = await prisma.technician.create({ data: { name: 'Volume catalogue technician', vehicleId: f.vehicle.id, active: true } });
    f.other = await prisma.technician.create({ data: { name: stamp + ' forbidden technician', active: true } });
    f.client = await prisma.client.create({ data: { name: stamp, active: true } });
    f.transport = await prisma.transportGuide.create({ data: { vehicleId: f.vehicle.id, codeAT: stamp, status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
    f.guide = await prisma.workGuide.create({ data: { vehicleId: f.vehicle.id, technicianId: f.tech.id, guideId: f.transport.id, status: 'OPEN', isDraft: false } });
    for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: f.vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(Date.now() + 30 * 86400000) } });
    f.visits = {};
    for (const mode of ['MODERN', 'LEGACY', 'EXTRA', 'CORRECTION']) {
      const pool = await prisma.pool.create({ data: { clientId: f.client.id, name: stamp + ' ' + mode, active: true } });
      const common = { clientId: f.client.id, poolId: pool.id, technicianId: f.tech.id };
      const visit = ['EXTRA', 'CORRECTION'].includes(mode) ? await prisma.extraVisit.create({ data: { ...common, status: 'PLANNED', scheduledAt: new Date(), billingMode: 'NO_CHARGE' } }) : await prisma.serviceVisit.create({ data: { ...common, status: 'PLANNED', plannedDate: new Date(), date: new Date() } });
      f.visits[mode] = { ...visit, poolName: pool.name };
    }
    for (const n of profiles) {
      const rows = Array.from({ length: n - previous }, (_, x) => { const i = previous + x; return { workGuideId: f.guide.id, name: i >= n - 4 ? 'Ácido <img src=x> catálogo' : 'Produto ' + String(i).padStart(5, '0'), unit: i === n - 4 ? null : i === n - 3 ? 'l' : 'KG', type: 'CHEMICAL', quantity: 20, initialQty: 20 }; });
      for (let i = 0; i < rows.length; i += 250) await prisma.workGuideItem.createMany({ data: rows.slice(i, i + 250) }); previous = n;
      if (f.originalId) await prisma.workGuideItem.update({ where: { id: f.originalId }, data: { quantity: 20, usedQty: 0 } });
      f.rows = await prisma.workGuideItem.findMany({ where: { workGuideId: f.guide.id }, orderBy: { id: 'asc' } }); assert.equal(f.rows.length, n);
      const original = f.rows.at(-2), products = [{ workGuideId: f.guide.id, workGuideItemId: original.id, name: original.name, unit: original.unit, quantity: 1 }];
      f.originalId = original.id; original.quantity = 19; original.usedQty = 1;
      const updated = await prisma.workGuideItem.update({ where: { id: original.id }, data: { quantity: 19, usedQty: 1 } }); Object.assign(original, updated);
      // Synthetic completed baseline with its original guide movement; no
      // production command is invoked and browser probes never submit it.
      await prisma.extraVisit.update({ where: { id: f.visits.CORRECTION.id }, data: { status: 'DONE', endAt: new Date(), execution: { chemicalsJson: products, products: JSON.stringify(products) } } });
      await prisma.vehicleStockMovement.deleteMany({ where: { vehicleId: f.vehicle.id } });
      await prisma.vehicleStockMovement.create({ data: { vehicleId: f.vehicle.id, workGuideId: f.guide.id, extraVisitId: f.visits.CORRECTION.id, technicianId: f.tech.id, movementType: 'CONSUMPTION', itemName: original.name, unit: original.unit, quantity: 1, source: 'QA_VOLUME_FIXTURE' } });
      fs.writeFileSync(file, JSON.stringify(f));
      for (const mode of modes) { results.push(await run(file, mode)); fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'profiles-in-progress', profiles, modes, results }, null, 2) + '\n'); }
      const unchanged = await prisma.workGuideItem.findMany({ where: { workGuideId: f.guide.id }, orderBy: { id: 'asc' } }); assert.equal(hash(unchanged), hash(f.rows));
      assert.equal(await prisma.fieldWriteRequest.count({ where: { owner: 'TECH:' + f.tech.id } }), 0);
    }
  } finally {
    if (f.vehicle) { await prisma.vehicleStockMovement.deleteMany({ where: { vehicleId: f.vehicle.id } }); await prisma.vehicleMaintenanceRecord.deleteMany({ where: { vehicleId: f.vehicle.id } }); }
    if (f.client) { await prisma.serviceVisit.deleteMany({ where: { clientId: f.client.id } }); await prisma.extraVisit.deleteMany({ where: { clientId: f.client.id } }); await prisma.pool.deleteMany({ where: { clientId: f.client.id } }); await prisma.client.delete({ where: { id: f.client.id } }); }
    if (f.guide) await prisma.workGuide.delete({ where: { id: f.guide.id } }); if (f.transport) await prisma.transportGuide.delete({ where: { id: f.transport.id } });
    for (const tech of [f.tech, f.other]) if (tech) await prisma.technician.delete({ where: { id: tech.id } }); if (f.vehicle) await prisma.vehicle.delete({ where: { id: f.vehicle.id } });
    for (const model of models) assert.equal(await prisma[model].count(), baseline[model], model + ' fixture cleanup');
    const partial = JSON.parse(fs.readFileSync(output)); partial.cleanupVerified = true; fs.writeFileSync(output, JSON.stringify(partial, null, 2) + '\n');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  assert.equal(results.length, profiles.length * modes.length);
  fs.writeFileSync(output, JSON.stringify({ ok: true, phase: 'assertions-completed', profiles, modes, results, cleanupVerified: true,
    scope: 'Fresh Node process per probe. API RSS includes oracle and HTTP client, not DB/browser. UI CDP JS heap excludes native DOM memory. Each UI profile traverses real DOM next handlers, then preserves exact draft/product through real offline reload. No browser stock command is submitted; existing completion/replay regressions run separately.' }, null, 2) + '\n');
  completed = true; console.log('PASS product volume: ' + profiles.join('/') + ' × ' + modes.join('/') + '; complete ordered IDs, bounded options, literal identity, offline draft, permissions, zero writes and fixture cleanup');
}
(process.argv[2] === 'probe' ? child(...process.argv.slice(3)) : main()).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
