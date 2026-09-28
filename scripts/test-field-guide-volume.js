'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { randomUUID, createHash } = require('node:crypto'), { spawn } = require('node:child_process'), { performance } = require('node:perf_hooks');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002', address = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(address.hostname) && /qa/i.test(address.pathname));
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const { PrismaClient } = require('@prisma/client'), prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
global.__CRISTAL_WATER_PRISMA__ = prisma;
const folder = path.join(__dirname, '../reports/field-suite/guide-volume');
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex'), mib = n => Math.round(n / 1048576 * 100) / 100;
const order = (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) || b.id - a.id, ids = rows => rows.map(r => r.id);
const sign = actor => require('jsonwebtoken').sign(actor, require('../src/utils/jwtSecret').getJwtSecret(), { expiresIn: '30m' });
const pick = (v, keys) => Object.fromEntries(keys.map(k => [k, v[k]]));
function exact(actual, expected, label) { assert.equal(new Set(actual).size, actual.length, label + ' duplicates'); assert.equal(hash(actual), hash(expected), label + ': ' + actual.length + '/' + expected.length); }
const paramsFor = (f, kind) => ({ kind, vehicleId: f.vehicles[0].id, ...(kind === 'work' ? { technicianId: f.techs[0].id } : kind === 'movement' ? { workGuideId: f.open.id } : {}) });
const dataFor = (f, kind) => kind === 'transport' ? f.transports : kind === 'work' ? f.works : f.moves;
let completed = false;
process.on('exit', () => { if (!completed && !process.exitCode) { fs.writeSync(2, 'Guide volume exited before assertions completed\n'); process.exitCode = 1; } });

async function apiProbe(f) {
  const app = require('express')(); app.use('/api/guides', require('../src/routes/guideRoutes')); app.use('/api/fleet-history', require('../src/routes/fleetHistoryRoutes'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const origin = 'http://127.0.0.1:' + server.address().port, actor = { id: f.techs[0].id, role: 'TECHNICIAN' }, token = sign(actor);
  const admin = sign({ id: f.admin, role: 'ADMIN', principalType: 'USER' }), writer = new PrismaClient(), reads = [], proofs = [], txOptions = [];
  let measuring = false, sql, fault = null;
  prisma.$on('query', e => { if (measuring) { sql.queries++; sql.durationMs += e.duration; if (/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(e.query)) sql.writes++; } });
  const transaction = prisma.$transaction.bind(prisma);
  prisma.$transaction = (fn, options) => transaction(async tx => {
    txOptions.push(options);
    return fn(new Proxy(tx, { get(target, key) {
      if (!['transportGuide', 'workGuide', 'vehicleStockMovement', 'workGuideItem', 'transportGuideItem'].includes(key)) return target[key];
      return new Proxy(target[key], { get(model, method) {
        if (method !== 'findMany') return model[method];
        return async q => { if (fault?.model === key && (q.skip || 0) >= fault.offset) throw Error('PRIVATE_VOLUME_READ_FAILURE'); return model.findMany(q); };
      } });
    } }));
  }, options);
  async function get(url, credential = token, expectedStatus = 200) {
    const peak = { rss: process.memoryUsage().rss, heap: process.memoryUsage().heapUsed };
    const sample = () => { const m = process.memoryUsage(); peak.rss = Math.max(peak.rss, m.rss); peak.heap = Math.max(peak.heap, m.heapUsed); };
    sql = { queries: 0, durationMs: 0, writes: 0 }; measuring = true; const start = performance.now(), timer = setInterval(sample, 5); let response, raw, duration;
    try { response = await fetch(origin + url, { headers: credential ? { Authorization: 'Bearer ' + credential } : {}, signal: AbortSignal.timeout(30000) }); raw = await response.text(); duration = performance.now() - start; sample(); }
    finally { measuring = false; clearInterval(timer); }
    const body = JSON.parse(raw); sample(); assert.equal(response.status, expectedStatus, url + ' ' + raw.slice(0, 300)); assert.equal(sql.writes, 0);
    assert(duration < 30000 && Buffer.byteLength(raw) < 64 * 1048576 && peak.rss < 768 * 1048576);
    if (expectedStatus === 200) { assert(body.ok); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-cw-owner'), credential === admin ? 'ADMIN:' + f.admin : 'TECH:' + f.techs[0].id); }
    reads.push({ url, status: response.status, durationMs: Math.round(duration * 10) / 10, jsonBytes: Buffer.byteLength(raw), sampledRssMiB: mib(peak.rss), sampledHeapMiB: mib(peak.heap), sql });
    return body;
  }
  async function insert(kind) {
    // A separate connection commits while the reader is between pages. The
    // backdated insert would fall inside later pages without the ID boundary.
    const common = { vehicleId: f.vehicles[0].id, createdAt: new Date('2032-01-01T00:00:00Z') };
    if (kind === 'transport') return writer.transportGuide.create({ data: { ...common, status: 'CLOSED', codeAT: f.prefix + ' added' } });
    if (kind === 'work') return writer.workGuide.create({ data: { ...common, technicianId: actor.id, status: 'CLOSED', guideId: f.active.id } });
    return writer.vehicleStockMovement.create({ data: { ...common, technicianId: actor.id, workGuideId: f.open.id, transportGuideId: f.active.id, itemName: 'Added while browsing', quantity: -1, movementType: 'CONSUMPTION' } });
  }
  const modelFor = kind => ({ transport: 'transportGuide', work: 'workGuide', movement: 'vehicleStockMovement' })[kind];
  try {
    for (const [kind, route, key] of [['transport', 'transport', 'guides'], ['work', 'work', 'workGuides'], ['movement', 'movements', 'movements']]) {
      const expected = [...dataFor(f, kind)].sort(order), found = []; let maxId, inserted, pages = 0;
      try {
        for (let offset = 0; offset < f.n; offset += 200) {
          const q = { limit: 200, offset, ...(maxId === undefined ? {} : { maxId }) }, packet = await get('/api/guides/' + route + '?' + new URLSearchParams(q));
          assert.equal(packet.total, f.n); assert.equal(packet.limit, 200); assert.equal(packet.offset, offset); assert.equal(packet.hasMore, offset + 200 < f.n);
          exact(ids(packet[key]), ids(expected.slice(offset, offset + 200)), 'field ' + kind + ' page'); found.push(...ids(packet[key])); pages++;
          assert(!JSON.stringify(packet).includes('PRIVATE_'), 'private metadata');
          if (kind === 'transport') assert(packet.guides.every(g => g.workGuides.every(w => w.technicianId === actor.id)));
          if (kind === 'work') assert(packet.workGuides.every(w => w.technicianId === actor.id && w.vehicleId === f.vehicles[0].id && w.guide.vehicleId === w.vehicleId));
          if (kind === 'movement') {
            for (const row of packet.movements) { const source = f.moves.find(m => m.id === row.id); assert.deepEqual(pick(row, ['vehicleId', 'technicianId', 'workGuideId', 'transportGuideId', 'itemName', 'unit', 'quantity', 'movementType']), pick(source, ['vehicleId', 'technicianId', 'workGuideId', 'transportGuideId', 'itemName', 'unit', 'quantity', 'movementType'])); }
            if (maxId === undefined) { maxId = packet.maxId; inserted = await insert(kind); assert(inserted.id > maxId); } else assert.equal(packet.maxId, maxId);
          }
        }
        exact(found, ids(expected), 'field ' + kind + ' complete');
        const beyond = await get('/api/guides/' + route + '?' + new URLSearchParams({ limit: 200, offset: f.n, ...(maxId === undefined ? {} : { maxId }) })); assert.equal(beyond[key].length, 0); assert.equal(beyond.hasMore, false);
        if (inserted) { const fresh = await get('/api/guides/movements'); assert.equal(fresh.total, f.n + 1); assert.equal(fresh.maxId, inserted.id); const offset = [...expected, inserted].sort(order).findIndex(r => r.id === inserted.id); const added = await get('/api/guides/movements?limit=1&offset=' + offset); assert.equal(added.movements[0].id, inserted.id); }
        proofs.push({ surface: 'field-' + kind, rows: found.length, pages, orderedIdsSha256: hash(found), insertionBoundary: !!inserted });
      } finally { if (inserted) await writer[modelFor(kind)].delete({ where: { id: inserted.id } }); }
    }
    for (const kind of ['transport', 'work', 'movement']) {
      const expected = [...dataFor(f, kind)].sort(order), found = []; let boundary, inserted, pages = 0;
      try {
        for (let page = 1; found.length < f.n; page++) {
          const packet = await get('/api/fleet-history?' + new URLSearchParams({ ...paramsFor(f, kind), page, ...(boundary === undefined ? {} : { maxId: boundary }) }), admin);
          assert.equal(packet.total, f.n); assert.equal(packet.size, 25); assert.equal(packet.page, page); exact(ids(packet.rows), ids(expected.slice((page - 1) * 25, page * 25)), 'admin page');
          found.push(...ids(packet.rows)); pages++; assert(pages < 50);
          if (boundary === undefined) { boundary = packet.maxId; inserted = await insert(kind); assert(inserted.id > boundary); } else assert.equal(packet.maxId, boundary);
        }
        exact(found, ids(expected), 'admin ' + kind + ' complete');
        const empty = await get('/api/fleet-history?' + new URLSearchParams({ ...paramsFor(f, kind), page: pages + 1, maxId: boundary }), admin); assert.equal(empty.rows.length, 0); assert.equal(empty.total, f.n);
        const refreshed = await get('/api/fleet-history?' + new URLSearchParams(paramsFor(f, kind)), admin); assert.equal(refreshed.total, f.n + 1); assert.equal(refreshed.maxId, inserted.id);
        const added = await get('/api/fleet-history?' + new URLSearchParams({ ...paramsFor(f, kind), recordId: inserted.id }), admin); exact(ids(added.rows), [inserted.id], 'refresh includes committed insert');
        proofs.push({ surface: 'admin-' + kind, rows: found.length, pages, orderedIdsSha256: hash(found), insertionBoundary: true });
      } finally { if (inserted) await writer[modelFor(kind)].delete({ where: { id: inserted.id } }); }
    }
    const stockUrl = '/api/guides/stock/' + f.vehicles[0].id, lean = await get(stockUrl + '?includeMovements=false'), full = await get(stockUrl);
    exact(ids(lean.stock), ids(f.items), 'complete stock'); assert.deepEqual(lean.stock, lean.workGuide.items); assert.equal(lean.itemCount, 100); assert.equal(lean.consumptionCount, null); assert.deepEqual(lean.movements, []); assert.equal(lean.movementsIncluded, false);
    for (const item of lean.stock) assert.deepEqual(pick(item, ['name', 'unit', 'type', 'initialQty', 'quantity', 'usedQty']), pick(f.items.find(r => r.id === item.id), ['name', 'unit', 'type', 'initialQty', 'quantity', 'usedQty']));
    assert.deepEqual(full.stock, lean.stock); const consumed = f.moves.filter(m => m.movementType === 'CONSUMPTION').sort((a, b) => -order(a, b)); exact(ids(full.movements), ids(consumed), 'full consumption'); assert.equal(full.consumptionCount, consumed.length);
    const loadRows = f.moves.filter(m => m.movementType === 'LOAD').sort(order), filtered = await get('/api/guides/movements?' + new URLSearchParams({ workGuideId: f.open.id, transportGuideId: f.active.id, movementType: 'LOAD' })); assert.equal(filtered.total, loadRows.length); exact(ids(filtered.movements), ids(loadRows.slice(0, 200)), 'movement filter');
    const noMoves = await get('/api/guides/movements?maxId=0'); assert.equal(noMoves.total, 0); assert.deepEqual(noMoves.movements, []);
    const activeOnly = await get('/api/guides/transport?status=ACTIVE'), openOnly = await get('/api/guides/work?status=OPEN'); exact(ids(activeOnly.guides), [f.active.id], 'active guide'); exact(ids(openOnly.workGuides), [f.open.id], 'open own work');
    const current = await get('/api/guides/transport/latest/' + f.vehicles[0].id); assert.equal(current.guide.id, f.active.id); exact(ids(current.items), ids(f.transportItems), 'latest transport items');
    for (const [kind, id, items] of [['work', f.open.id, f.items], ['transport', f.active.id, f.transportItems]]) {
      const found = [];
      for (let page = 1; page <= 5; page++) { const packet = await get('/api/fleet-history/' + kind + '/' + id + '?page=' + page, admin); assert.equal(packet.total, 100); assert.equal(packet.record.id, id); found.push(...ids(packet.items)); }
      exact(found, ids(items), 'admin detail items');
    }
    for (const url of ['/api/guides/work?technicianId=' + f.techs[1].id, '/api/guides/stock/' + f.vehicles[1].id, '/api/guides/movements?workGuideId=' + f.foreignWork.id, '/api/guides/transport?vehicleId=' + f.vehicles[1].id, '/api/fleet-history?kind=work', '/api/fleet-history/work/' + f.open.id]) await get(url, token, 403);
    await get('/api/guides/movements', null, 401); await get('/api/fleet-history', null, 401); await get('/api/guides/movements?limit=201', token, 400);
    await get('/api/guides/stock/' + f.vehicles[0].id, sign({ id: f.techs[2].id, role: 'TECHNICIAN' }), 403);
    for (const [model, url, credential, offset] of [
      ['transportGuide', '/api/guides/transport?offset=200', token, 200], ['workGuide', '/api/guides/work?offset=200', token, 200], ['vehicleStockMovement', '/api/guides/movements?offset=200', token, 200],
      ...['transport', 'work', 'movement'].map(k => [modelFor(k), '/api/fleet-history?' + new URLSearchParams({ ...paramsFor(f, k), page: 2 }), admin, 25]),
      ['workGuideItem', '/api/fleet-history/work/' + f.open.id + '?page=2', admin, 25], ['transportGuideItem', '/api/fleet-history/transport/' + f.active.id + '?page=2', admin, 25]
    ]) { fault = { model, offset }; const packet = await get(url, credential, 503); assert.equal(packet.ok, false); assert(!packet.rows && !packet.guides && !packet.workGuides && !packet.movements && !packet.items); assert(!JSON.stringify(packet).includes('PRIVATE_')); fault = null; }
    assert(txOptions.length > 0 && txOptions.every(q => q.isolationLevel === 'RepeatableRead'));
    return { mode: 'API', records: f.n, reads, proofs, stockItems: lean.itemCount, consumptions: full.consumptionCount, partialFailuresRejected: 8, permissions: true, literalFields: true, transactionsRepeatableRead: true, writes: 0 };
  } finally { prisma.$transaction = transaction; await writer.$disconnect(); await new Promise(resolve => server.close(resolve)); }
}

async function browserProbe(f) {
  const browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [], writes = [], expected = [...f.moves].sort(order), results = []; let inserted;
  async function context(actor) {
    const c = await browser.newContext({ viewport: { width: 390, height: 1100 }, serviceWorkers: 'block' });
    await c.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
    await c.addInitScript(({ token, actor, origin }) => { if (location.origin !== origin) return; for (const k of ['token', 'cristalwater_jwt']) localStorage.setItem(k, token); if (actor.role === 'ADMIN') localStorage.setItem('adminToken', token); for (const k of ['user', 'cristalwater_user']) localStorage.setItem(k, JSON.stringify(actor)); localStorage.setItem('qa-guide-draft', ' Preserve exact draft '); }, { token: sign(actor), actor, origin: base });
    const p = await c.newPage(); p.setDefaultTimeout(20000); p.on('pageerror', e => errors.push(e.message)); c.on('request', r => { if (r.url().startsWith(base + '/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(r.method() + ' ' + new URL(r.url()).pathname); });
    return { c, p };
  }
  async function heap(c, p) { const d = await c.newCDPSession(p); await d.send('Performance.enable'); const m = await d.send('Performance.getMetrics'), value = mib(m.metrics.find(x => x.name === 'JSHeapUsedSize').value); assert(value < 256); return value; }
  try {
    const { c, p } = await context({ id: f.techs[0].id, role: 'TECHNICIAN' }), start = performance.now();
    const state = (id, value = 'ready') => p.waitForFunction(({ id, value }) => document.getElementById(id)?.dataset.state === value, { id, value });
    await p.goto(base + '/technician-guide', { waitUntil: 'networkidle' }); for (const id of ['guideReader', 'stockPanel', 'movementPanel']) await state(id);
    const materials = []; for (let page = 1; page <= 4; page++) { materials.push(...await p.locator('#materials article').evaluateAll(rows => rows.map(r => Number(r.dataset.itemId)))); if (page < 4) await p.locator('#itemsNext').click(); }
    exact(materials, ids(f.items), 'technician material pages'); assert(await p.locator('#itemsNext').isDisabled());
    const found = [], pageIds = () => p.locator('#movements article').evaluateAll(rows => rows.map(r => Number(r.dataset.movementId))); let pages = 0;
    inserted = await prisma.vehicleStockMovement.create({ data: { vehicleId: f.vehicles[0].id, technicianId: f.techs[0].id, workGuideId: f.open.id, itemName: 'Added in real browser', quantity: -1, movementType: 'CONSUMPTION', createdAt: new Date('2032-01-01T00:00:00Z') } });
    for (;;) { await state('movementPanel'); found.push(...await pageIds()); pages++; assert(pages < 50); if (await p.locator('#movementsNext').isDisabled()) break; await p.locator('#movementsNext').click(); }
    exact(found, ids(expected), 'technician movement pages'); await p.locator('#refreshMovements').click(); await state('movementPanel'); assert((await p.locator('#movementTotal').innerText()).includes(String(f.n + 1)));
    await prisma.vehicleStockMovement.delete({ where: { id: inserted.id } }); inserted = null;
    await p.locator('#movementType').fill('CONSUMPTION'); await p.locator('#movementFilters button[type=submit]').click(); await state('movementPanel'); assert((await p.locator('#movementTotal').innerText()).includes(String(f.moves.filter(m => m.movementType === 'CONSUMPTION').length)));
    await c.setOffline(true); await p.locator('#refreshMovements').click(); await state('movementPanel', 'error'); assert.equal(await p.locator('#movements article').count(), 0); assert.equal(await p.locator('#materials article').count(), 25);
    await c.setOffline(false); await p.locator('#clearMovementFilter').click(); await state('movementPanel'); exact(await pageIds(), ids(expected.slice(0, 25)), 'technician first page restored');
    assert.equal(await p.locator('#guideReader img').count(), 0); assert.equal(await p.evaluate(() => localStorage.getItem('qa-guide-draft')), ' Preserve exact draft ');
    await p.locator('#cw-v21-toast').waitFor({ state: 'hidden' }); await p.locator('#movementPanel').evaluate(n => n.scrollIntoView({ block: 'start', behavior: 'instant' })); await p.screenshot({ path: path.join(folder, 'technician-390.png') });
    results.push({ surface: 'technician', rows: f.n, pages, materialPages: 4, loadAndTraversalMs: Math.round((performance.now() - start) * 10) / 10, jsHeapMiB: await heap(c, p), insertionBoundary: true, offlineRecovery: true }); await c.close();
    const { c: adminContext, p: admin } = await context({ id: f.admin, role: 'ADMIN', principalType: 'USER' });
    await admin.goto(base + '/admin-vehicles', { waitUntil: 'networkidle' }); const hosts = { transport: 'guides', work: 'works', movement: 'movements' };
    const ready = (kind, detail = false) => admin.waitForFunction(({ host, detail }) => document.getElementById(host)?.dataset[detail ? 'detailState' : 'state'] === 'ready', { host: hosts[kind], detail });
    for (const kind of Object.keys(hosts)) {
      await ready(kind); const begin = performance.now(), form = admin.locator('#fh-' + kind + '-filters'); await form.locator('details').evaluate(n => n.open = true);
      for (const [key, value] of Object.entries(paramsFor(f, kind))) if (key !== 'kind') await form.locator('[name=' + key + ']').fill(String(value));
      await form.locator('button[type=submit]').click(); const seen = []; let count = 0;
      for (;;) { await ready(kind); seen.push(...await admin.locator('#fh-' + kind + '-list > article').evaluateAll(rows => rows.map(r => Number(r.dataset.historyId)))); count++; assert(count < 50); if (await admin.locator('#fh-' + kind + '-next').isDisabled()) break; await admin.locator('#fh-' + kind + '-next').click(); }
      exact(seen, ids([...dataFor(f, kind)].sort(order)), 'admin browser ' + kind);
      await admin.locator('#fh-' + kind + '-refresh').click(); await ready(kind);
      if (kind !== 'movement') {
        const id = kind === 'work' ? f.open.id : f.active.id; await admin.locator('#fh-' + kind + '-recordId').fill(String(id)); await form.locator('button[type=submit]').click(); await ready(kind);
        await admin.locator('#fh-' + kind + '-list [data-fh=detail]').click(); const items = [];
        for (let page = 1; page <= 4; page++) { await ready(kind, true); items.push(...await admin.locator('#fh-' + kind + '-materials > article').evaluateAll(rows => rows.map(r => Number(r.dataset.itemId)))); if (page < 4) await admin.locator('#fh-' + kind + '-detail-next').click(); }
        exact(items, ids(kind === 'work' ? f.items : f.transportItems), 'admin browser detail'); assert(await admin.locator('#fh-' + kind + '-detail-next').isDisabled());
        assert.equal(await admin.locator('#fh-' + kind + '-detail img').count(), 0);
      }
      results.push({ surface: 'admin-' + kind, rows: seen.length, pages: count, traversalMs: Math.round((performance.now() - begin) * 10) / 10, jsHeapMiB: await heap(adminContext, admin) });
    }
    for (const width of [390, 1440]) { await admin.setViewportSize({ width, height: 1100 }); await admin.locator('#fh-work-detail').evaluate(n => n.scrollIntoView({ block: 'start', behavior: 'instant' })); assert(await admin.locator('#works').evaluate(n => n.scrollWidth <= n.clientWidth + 1)); await admin.screenshot({ path: path.join(folder, 'admin-detail-' + width + '.png') }); }
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    return { mode: 'UI', records: f.n, results, exactIds: true, pageErrors: 0, writes: 0 };
  } finally { if (inserted) await prisma.vehicleStockMovement.deleteMany({ where: { id: inserted.id } }); await browser.close(); }
}

async function run(file, mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, 'probe', file, mode], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; }); const timer = setTimeout(() => child.kill('SIGKILL'), 85000);
    child.once('error', e => { clearTimeout(timer); reject(e); }); child.once('close', (code, signal) => { clearTimeout(timer);
      if (code !== 0 || signal) return reject(Error(mode + ' failed ' + code + '/' + signal + '\n' + out.slice(-1000) + err.slice(-4500)));
      const line = out.split('\n').find(l => l.startsWith('{"guideVolumeProbe"')); if (!line) return reject(Error('Missing assertion completion proof'));
      const result = JSON.parse(line).guideVolumeProbe; assert(result.ok && result.phase === 'assertions-completed'); console.log(JSON.stringify({ guideVolume: mode, records: result.records, reads: result.reads?.length })); resolve(result);
    });
  });
}
async function main() {
  fs.mkdirSync(folder, { recursive: true }); const output = path.join(folder, 'results.json'), profiles = [201, 1001], results = [], start = Date.now();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-guide-volume-')), file = path.join(temporary, 'fixture.json'), engine = (await prisma.$queryRawUnsafe('SELECT version() AS version'))[0].version;
  const models = ['vehicle', 'technician', 'transportGuide', 'transportGuideItem', 'workGuide', 'workGuideItem', 'vehicleStockMovement', 'systemSetting', 'fieldWriteRequest', 'userAuditLog', 'invoice', 'payment'];
  const counts = async () => { const out = {}; for (const model of models) out[model] = await prisma[model].count(); return out; }, baseline = await counts();
  const many = async (model, data) => { for (let i = 0; i < data.length; i += 250) await prisma[model].createMany({ data: data.slice(i, i + 250) }); };
  fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'started', profiles }));
  try {
    for (const n of profiles) {
      const f = { n, prefix: 'QA408 ' + randomUUID(), vehicles: [], techs: [] };
      try {
        f.admin = (await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } })).id;
        for (let i = 0; i < 2; i++) f.vehicles.push(await prisma.vehicle.create({ data: { plate: f.prefix + '-' + i, active: true, notes: 'PRIVATE_VEHICLE' } }));
        for (let i = 0; i < 3; i++) f.techs.push(await prisma.technician.create({ data: { name: f.prefix + ' technician ' + i, role: i === 1 ? 'TEAM_LEADER' : 'TECHNICIAN', vehicleId: f.vehicles[i === 2 ? 1 : 0].id, active: true, phone: 'PRIVATE_PHONE' } }));
        const vehicleId = f.vehicles[0].id, technicianId = f.techs[0].id, at = i => new Date(Date.UTC(2032, 0, 1 + i % 3));
        await many('transportGuide', Array.from({ length: n }, (_, i) => ({ vehicleId, codeAT: f.prefix + '-' + i, status: i === n - 1 ? 'ACTIVE' : 'CLOSED', isDraft: false, createdAt: at(i), validUntil: new Date('2035-01-01Z') })));
        f.transports = await prisma.transportGuide.findMany({ where: { vehicleId }, orderBy: { id: 'asc' } }); f.active = f.transports.at(-1);
        await many('workGuide', f.transports.map((g, i) => ({ vehicleId, technicianId, guideId: g.id, status: i === n - 1 ? 'OPEN' : 'CLOSED', startKm: 0, endKm: null, isDraft: false, createdAt: at(i), notes: ' Literal <img src=x> guide ' })));
        f.works = await prisma.workGuide.findMany({ where: { vehicleId }, orderBy: { id: 'asc' } }); f.open = f.works.at(-1);
        f.foreignWork = await prisma.workGuide.create({ data: { vehicleId, technicianId: f.techs[1].id, guideId: f.active.id, status: 'OPEN', notes: 'PRIVATE_OTHER_WORK' } });
        const otherGuide = await prisma.transportGuide.create({ data: { vehicleId: f.vehicles[1].id, status: 'ACTIVE' } });
        const otherWork = await prisma.workGuide.create({ data: { vehicleId: f.vehicles[1].id, technicianId, guideId: otherGuide.id, status: 'CLOSED' } });
        const items = Array.from({ length: 100 }, (_, i) => ({ name: ' Literal material <img src=x> ' + Math.floor(i / 2), type: i % 2 ? 'CHEMICAL' : null, unit: i === 0 ? null : i % 2 ? ' L ' : ' KG ', quantity: i === 0 ? 0 : 1.000001 }));
        await many('transportGuideItem', items.map(i => ({ ...i, guideId: f.active.id })));
        await many('workGuideItem', items.map(i => ({ ...i, workGuideId: f.open.id, initialQty: i.quantity === 0 ? 0 : 2, usedQty: i.quantity === 0 ? 0 : 0.999999 })));
        f.items = await prisma.workGuideItem.findMany({ where: { workGuideId: f.open.id }, orderBy: { id: 'asc' } }); f.transportItems = await prisma.transportGuideItem.findMany({ where: { guideId: f.active.id }, orderBy: { id: 'asc' } });
        await many('vehicleStockMovement', Array.from({ length: n }, (_, i) => ({ vehicleId, technicianId: i % 3 ? technicianId : null, workGuideId: f.open.id, transportGuideId: f.active.id, itemName: ' Literal movement <img src=x> ' + i, quantity: i % 3 ? -0.000001 : 0, unit: i === 0 ? null : ' KG ', movementType: i % 3 ? 'CONSUMPTION' : 'LOAD', source: 'QA', notes: JSON.stringify({ cwGuideMovement: true, userNotes: ' Literal note ', readings: { ph: 0 }, private: { email: 'PRIVATE_MOVEMENT' } }), createdAt: at(i) })));
        f.moves = await prisma.vehicleStockMovement.findMany({ where: { workGuideId: f.open.id }, orderBy: { id: 'asc' } });
        await many('vehicleStockMovement', [{ vehicleId, technicianId: f.techs[1].id, workGuideId: f.foreignWork.id, itemName: 'PRIVATE_SAME_VEHICLE' }, { vehicleId: f.vehicles[1].id, technicianId, workGuideId: otherWork.id, itemName: 'PRIVATE_PREVIOUS_VEHICLE' }]);
        const snapshot = async () => {
          const v = { in: f.vehicles.map(x => x.id) }, state = {};
          for (const model of ['transportGuide', 'workGuide', 'vehicleStockMovement']) state[model] = await prisma[model].findMany({ where: { vehicleId: v }, orderBy: { id: 'asc' } });
          state.workGuideItem = await prisma.workGuideItem.findMany({ where: { workGuideId: f.open.id }, orderBy: { id: 'asc' } }); state.transportGuideItem = await prisma.transportGuideItem.findMany({ where: { guideId: f.active.id }, orderBy: { id: 'asc' } }); return hash(state);
        };
        const before = await counts(), beforeHash = await snapshot(); fs.writeFileSync(file, JSON.stringify(f)); results.push(await run(file, 'API'));
        if (n === 1001) results.push(await run(file, 'UI'));
        assert.deepEqual(await counts(), before); assert.equal(await snapshot(), beforeHash);
        fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'profiles-in-progress', profiles, results }, null, 2) + '\n');
      } finally {
        const where = { vehicleId: { in: f.vehicles.map(v => v.id) } }; await prisma.vehicleStockMovement.deleteMany({ where }); await prisma.workGuide.deleteMany({ where }); await prisma.transportGuide.deleteMany({ where });
        await prisma.technician.deleteMany({ where: { id: { in: f.techs.map(t => t.id) } } }); await prisma.vehicle.deleteMany({ where: { id: { in: f.vehicles.map(v => v.id) } } }); assert.deepEqual(await counts(), baseline);
      }
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); const partial = JSON.parse(fs.readFileSync(output)); partial.cleanupVerified = hash(await counts()) === hash(baseline); fs.writeFileSync(output, JSON.stringify(partial, null, 2) + '\n'); }
  assert.equal(results.length, 3); fs.writeFileSync(output, JSON.stringify({ ok: true, phase: 'assertions-completed', engine, profiles, results, durationMs: Date.now() - start, cleanupVerified: true, scope: 'Fresh Node process per API profile. RSS includes API, HTTP client and fixture oracle, excludes DB/browser. Real SQL and UI, explicit ID boundaries for insertions between requests. Does not certify stability under updates/deletions or cross-request snapshots for legacy field guide lists. Read tests do not submit stock commands or generate PDFs.' }, null, 2) + '\n');
  completed = true; console.log('PASS guide volume: 201/1001 guides and movements, exact field/admin pages, insertion boundaries, 100-item stock/details, isolation, failures, real UI and cleanup');
}
async function child(file, mode) { const f = JSON.parse(fs.readFileSync(file, 'utf8')), result = mode === 'API' ? await apiProbe(f) : await browserProbe(f); completed = true; console.log(JSON.stringify({ guideVolumeProbe: { ok: true, phase: 'assertions-completed', ...result } })); }
(process.argv[2] === 'probe' ? child(...process.argv.slice(3)) : main()).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
