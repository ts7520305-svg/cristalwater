'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { randomUUID, createHash } = require('node:crypto'), { spawn } = require('node:child_process'), { performance } = require('node:perf_hooks');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const address = new URL(process.env.DATABASE_URL);
assert(['127.0.0.1', 'localhost'].includes(address.hostname) && /qa/i.test(address.pathname));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
global.__CRISTAL_WATER_PRISMA__ = prisma;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mib = bytes => Math.round(bytes / 1048576 * 100) / 100;
const folder = path.join(__dirname, '../reports/field-suite/inventory-volume');
let completed = false;
process.on('exit', () => { if (!completed && !process.exitCode) { fs.writeSync(2, 'Inventory volume exited before assertions completed\n'); process.exitCode = 1; } });
const tokenFor = principal => require('jsonwebtoken').sign(principal, require('../src/utils/jwtSecret').getJwtSecret(), { expiresIn: '10m' });

async function probe(file, mode, fault) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')), ids = new Set(manifest.rows.map(row => row.id));
  const query = mode === 'active' ? '' : mode === 'alias' ? '?active=all' : '?includeInactive=true' + (mode.startsWith('search-') ? '&q=' + encodeURIComponent(manifest.search[mode]) : fault === 'concurrent' ? '&q=' + encodeURIComponent(manifest.prefix) : '');
  const needle = manifest.search[mode]?.toLocaleLowerCase('pt-PT');
  const expected = manifest.rows.filter(row => mode !== 'active' || row.active).filter(row => !needle || [row.name, row.sku, row.brand].some(v => String(v || '').toLocaleLowerCase('pt-PT').includes(needle)));
  const expectedById = new Map(expected.map(row => [row.id, row]));
  let measuring = false, server, writer, writerPromise, inserted, pivot, writerError, committedBeforeRemaining;
  const sql = { queries: 0, writes: 0, durationMs: 0 }, pages = [], transactions = [];
  prisma.$on('query', event => { if (measuring) { sql.queries++; sql.durationMs += event.duration; if (/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(event.query)) sql.writes++; } });
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = function (callback, options) {
    if (measuring) transactions.push(options);
    return originalTransaction.call(this, tx => callback(new Proxy(tx, { get(target, property) {
      if (property !== 'inventoryProduct') return Reflect.get(target, property);
      return new Proxy(target.inventoryProduct, { get(delegate, operation) {
        if (operation !== 'findMany') return Reflect.get(delegate, operation);
        return async args => {
          if (fault === 'late-page' && pages.length === 1) throw Error('PRIVATE_CATALOGUE_PAGE_FAILURE');
          const rows = await delegate.findMany(args);
          if (measuring) pages.push({ rows: rows.length, take: args.take, cursor: args.cursor?.id || null });
          if (fault === 'concurrent' && !writerPromise) {
            pivot = rows.at(-1); assert(pivot && ids.has(pivot.id));
            writerPromise = writer.$transaction(async w => {
              await w.inventoryProduct.update({ where: { id: pivot.id }, data: { name: manifest.prefix + ' changed cursor', active: !pivot.active } });
              inserted = await w.inventoryProduct.create({ data: { name: manifest.prefix + ' inserted', sku: manifest.prefix + '-concurrent', active: true } });
            }, { maxWait: 15000, timeout: 30000 }).catch(error => { writerError = error; });
            let timer;
            committedBeforeRemaining = await Promise.race([writerPromise.then(() => { if (writerError) throw writerError; return true; }), new Promise(resolve => { timer = setTimeout(() => resolve(false), 5000); })]);
            clearTimeout(timer);
          }
          return rows;
        };
      } });
    } })), options);
  };
  try {
    // Open the independent connection before the reader locks PGlite's socket;
    // otherwise its initial handshake itself waits behind the transaction.
    if (fault === 'concurrent') { writer = new PrismaClient(); await writer.$queryRawUnsafe('SELECT 1'); }
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
    const token = tokenFor({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
    const app = require('express')(), router = require('../src/routes/inventoryRoutes');
    app.use('/api/inventory', router); app.use('/api/stock', router);
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const url = 'http://127.0.0.1:' + server.address().port + (mode === 'alias' ? '/api/stock' : '/api/inventory') + '/products' + query;
    global.gc?.(); const before = process.memoryUsage(), peak = { rss: before.rss, heap: before.heapUsed };
    const sample = () => { const now = process.memoryUsage(); peak.rss = Math.max(peak.rss, now.rss); peak.heap = Math.max(peak.heap, now.heapUsed); };
    const timer = setInterval(sample, 5); measuring = true; const start = performance.now();
    let response, raw, durationMs;
    try { response = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(35000) }); raw = await response.text(); durationMs = Math.round((performance.now() - start) * 10) / 10; sample(); }
    finally { measuring = false; clearInterval(timer); }
    const body = JSON.parse(raw); sample();
    const fixture = (body.products || []).filter(row => ids.has(row.id));
    const measurement = { mode, fault: fault || null, products: manifest.rows.length, status: response.status, expectedFixtureCount: expected.length, actualFixtureCount: fixture.length,
      durationMs, jsonBytes: Buffer.byteLength(raw), rssBeforeMiB: mib(before.rss), sampledRssPeakMiB: mib(peak.rss), sampledHeapPeakMiB: mib(peak.heap), lifetimeRssPeakMiB: Math.round(process.resourceUsage().maxRSS / 1024 * 100) / 100, sql, pages, transactions };
    console.log(JSON.stringify({ inventoryVolumeMeasurement: measurement }));
    assert.equal(sql.writes, 0);
    if (fault === 'late-page') { assert.equal(response.status, 503); assert.equal(body.ok, false); assert(!body.products); assert(!raw.includes('PRIVATE_CATALOGUE_PAGE_FAILURE')); assert.equal(pages.length, 1); }
    else {
      assert.equal(response.status, 200); assert.equal(body.ok, true);
      assert.equal(fixture.length, expected.length, 'Complete catalogue: no silent 500-product cut');
      assert.equal(hash(fixture.map(row => row.id)), hash(expected.map(row => row.id)), 'Stable complete ordered IDs, including duplicate names');
      assert.equal(new Set(body.products.map(row => row.id)).size, body.products.length);
      for (const row of fixture) { const source = expectedById.get(row.id); for (const key of ['name', 'sku', 'brand', 'active', 'notes']) assert.equal(row[key], source[key]); }
      assert(durationMs < 30000); assert(Buffer.byteLength(raw) < 64 * 1048576); assert(peak.rss < 768 * 1048576);
    }
    assert.equal(transactions.length, 1); assert.equal(transactions[0].isolationLevel, 'RepeatableRead');
    assert(pages.every(page => page.take === 500 && page.rows <= 500));
    if (fault === 'concurrent') {
      await writerPromise; if (writerError) throw writerError;
      const engine = (await prisma.$queryRawUnsafe('SELECT version() AS version'))[0].version;
      if (!/wasm|emscripten|pglite/i.test(engine)) assert.equal(committedBeforeRemaining, true, 'Native PostgreSQL must commit while the reader remains open');
      const after = await (await fetch(url, { headers: { Authorization: 'Bearer ' + token } })).json();
      assert(after.products.some(row => row.id === inserted.id)); assert.equal(after.products.find(row => row.id === pivot.id).name, manifest.prefix + ' changed cursor');
      measurement.snapshot = { engine, committedBeforeRemaining, oldIdsComplete: true, nextReadIncludesCommit: true };
    }
    completed = true;
    console.log(JSON.stringify({ inventoryVolumeProbe: { ok: true, phase: 'assertions-completed', ...measurement, fixtureIdsSha256: hash(fixture.map(row => row.id)) } }));
  } finally {
    if (writerPromise) await writerPromise;
    if (writer) { if (pivot) await writer.inventoryProduct.update({ where: { id: pivot.id }, data: { name: pivot.name, active: pivot.active, updatedAt: pivot.updatedAt } }); if (inserted) await writer.inventoryProduct.delete({ where: { id: inserted.id } }); await writer.$disconnect(); }
    if (server) await new Promise(resolve => server.close(resolve));
  }
}

async function runProbe(file, mode, fault) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--expose-gc', __filename, 'probe', file, mode, ...(fault ? [fault] : [])], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 45000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal) {
        const measure = output.split('\n').find(line => line.startsWith('{"inventoryVolumeMeasurement"'));
        if (measure) fs.writeFileSync(path.join(folder, 'failed-probe.json'), JSON.stringify({ code, signal, ...JSON.parse(measure).inventoryVolumeMeasurement }, null, 2) + '\n');
        return reject(Error('Inventory volume probe failed: ' + code + '/' + signal + '\n' + output.slice(-4000) + errors.slice(-3000)));
      }
      const line = output.split('\n').find(line => line.startsWith('{"inventoryVolumeProbe"')); if (!line) return reject(Error('Missing completion proof'));
      const result = JSON.parse(line).inventoryVolumeProbe; assert(result.ok && result.phase === 'assertions-completed');
      console.log(JSON.stringify({ inventoryVolume: { products: result.products, mode, fault: fault || null, durationMs: result.durationMs, bytes: result.jsonBytes, rssMiB: result.sampledRssPeakMiB } })); resolve(result);
    });
  });
}

async function browserRead(rows, token, admin) {
  const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(30000);
    await page.addInitScript(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token, id: admin.id });
    const writes = [], errors = []; page.on('request', r => { if (r.url().startsWith(base + '/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(r.method() + ' ' + new URL(r.url()).pathname); }); page.on('pageerror', e => errors.push(e.message));
    const start = performance.now(); await page.goto(base + '/admin-inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('inventoryStatus')?.textContent === 'Inventario atualizado.');
    const rendered = await page.locator('#products > .item').evaluateAll(nodes => nodes.map(node => Number(node.querySelector('button')?.getAttribute('onclick')?.match(/\d+/)?.[0])));
    const ids = new Set(rows.map(row => row.id)); assert.equal(hash(rendered.filter(id => ids.has(id))), hash(rows.map(row => row.id)));
    const literal = rows.find(row => row.name.includes('<img'));
    assert((await page.locator('#products > .item').nth(rendered.indexOf(literal.id)).innerText()).includes(literal.name));
    assert.equal(await page.locator('#products img').count(), 0); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable'); const metrics = await cdp.send('Performance.getMetrics');
    return { products: rows.length, renderedFixtureCount: rendered.filter(id => ids.has(id)).length, durationMs: Math.round((performance.now() - start) * 10) / 10, browserJsHeapMiB: mib(metrics.metrics.find(m => m.name === 'JSHeapUsedSize').value), writes: 0, exactOrderedIds: true, literalNames: true, viewport: 390 };
  } finally { await browser.close(); }
}

async function main() {
  const prefix = 'QA405-' + randomUUID(), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-inventory-'));
  fs.mkdirSync(folder, { recursive: true }); fs.rmSync(path.join(folder, 'failed-probe.json'), { force: true });
  const resultPath = path.join(folder, 'results.json'), file = path.join(temporary, 'manifest.json');
  const regression = process.env.CW_INVENTORY_VOLUME_REGRESSION === 'true', scenarios = regression ? [601] : [100, 1000, 10000], results = [], ui = [];
  const baseline = await prisma.inventoryProduct.count(); let previous = 0;
  fs.writeFileSync(resultPath, JSON.stringify({ ok: false, phase: 'started', scenarios }));
  try {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } }), token = tokenFor({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
    for (const n of scenarios) {
      const added = Array.from({ length: n - previous }, (_, x) => { const i = previous + x; return { name: i % 27 === 0 ? prefix + ' searchname <img src=x>' : prefix + ' Duplicate ' + String(Math.floor(i / 2)).padStart(5, '0'), sku: prefix + '-' + String(i).padStart(5, '0'), brand: i % 3 === 0 ? prefix + ' searchbrand' : 'QA supplier', active: i % 5 !== 0, notes: 'Synthetic product context '.repeat(24), unit: i % 2 ? 'L' : 'KG', category: 'CHEMICAL', defaultCost: 2.5 }; });
      for (let i = 0; i < added.length; i += 250) await prisma.inventoryProduct.createMany({ data: added.slice(i, i + 250) });
      previous = n;
      const rows = await prisma.inventoryProduct.findMany({ where: { sku: { startsWith: prefix } }, orderBy: [{ active: 'desc' }, { name: 'asc' }, { id: 'asc' }] });
      assert.equal(rows.length, n);
      fs.writeFileSync(file, JSON.stringify({ prefix, rows, search: { 'search-name': prefix + ' searchname', 'search-brand': prefix + ' searchbrand', 'search-sku': prefix + '-' + String(n - 1).padStart(5, '0') } }));
      for (const mode of regression ? ['all'] : ['active', 'all', 'search-name', 'search-brand', 'search-sku', 'alias']) results.push(await runProbe(file, mode));
      if (!regression && n === 1000) results.push(await runProbe(file, 'all', 'concurrent'));
      if (!regression && n === 10000) { results.push(await runProbe(file, 'all', 'late-page')); ui.push(await browserRead(rows, token, admin)); }
      fs.writeFileSync(resultPath, JSON.stringify({ ok: false, phase: 'profiles-in-progress', scenarios, results, ui }, null, 2) + '\n');
    }
    const denied = await fetch((process.env.CW_BASE_URL || 'http://127.0.0.1:3002') + '/api/inventory/products'); assert.equal(denied.status, 401);
    fs.writeFileSync(resultPath, JSON.stringify({ ok: false, phase: 'cleanup-pending', scenarios, results, ui, anonymousDenied: true,
      measurementScope: 'One fresh Node process per HTTP GET; request ends after response.text; RSS/heap sampled every 5 ms and after parsing. Includes API plus local HTTP client, excludes fixture setup and database server/browser memory. Browser DOM/JS heap is measured separately. QA guards: 30 seconds, 64 MiB JSON, 768 MiB sampled RSS; not a production SLA.' }, null, 2) + '\n');
  } finally {
    await prisma.inventoryProduct.deleteMany({ where: { sku: { startsWith: prefix } } });
    assert.equal(await prisma.inventoryProduct.count(), baseline, 'Fixture-only cleanup');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  const report = JSON.parse(fs.readFileSync(resultPath, 'utf8')); assert.equal(report.phase, 'cleanup-pending'); report.ok = true; report.phase = 'assertions-completed'; report.cleanupVerified = true;
  fs.writeFileSync(resultPath, JSON.stringify(report, null, 2) + '\n'); completed = true;
  console.log('PASS inventory volume: complete 100/1000/10000 catalogues, active/all/search/alias, bounded SQL pages, consistent concurrent snapshot, later-page failure, exact browser rows and fixture cleanup');
}

(process.argv[2] === 'probe' ? probe(...process.argv.slice(3)) : main()).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
