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
const folder = path.join(__dirname, '../reports/field-suite/report-volume');
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex'), mib = n => Math.round(n / 1048576 * 100) / 100;
const ids = rows => rows.map(r => r.id), canonical = v => JSON.parse(JSON.stringify(v));
const sign = actor => require('jsonwebtoken').sign(actor, require('../src/utils/jwtSecret').getJwtSecret(), { expiresIn: '30m' });
const clientActor = c => ({ id: c.id, clientId: c.id, role: 'CLIENT', principalType: 'CLIENT' });
const listUrl = id => '/api/client-reports/' + id + '/reports';
const monthAt = n => new Date(Date.UTC(2001, n, 1)).toISOString().slice(0, 7);
const summaryUrl = (f, section, month = f.month) => '/api/admin/reports/summary?' + new URLSearchParams({ monthRef: month, section });
function exact(actual, expected, label) { assert.equal(new Set(actual).size, actual.length, label + ' duplicates'); assert.deepEqual(actual, expected, label); }
let completed = false;
process.on('exit', () => { if (!completed && !process.exitCode) { fs.writeSync(2, 'Report volume exited before assertions completed\n'); process.exitCode = 1; } });

async function apiProbe(f) {
  const app = require('express')(); app.use('/api/admin', require('../src/routes/adminReportsRoutes')); app.use('/api/client-reports', require('../src/routes/clientReportRoutes')); app.use(require('../src/middlewares/errorHandlerMiddleware'));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const origin = 'http://127.0.0.1:' + server.address().port, admin = sign({ id: f.admin, role: 'ADMIN', principalType: 'USER' }), client = sign(clientActor(f.clients[0]));
  const reads = [], txOptions = [], originals = {}, transaction = prisma.$transaction.bind(prisma);
  let fault, measuring = false, sql;
  prisma.$on('query', e => { if (measuring) { sql.queries++; sql.durationMs += e.duration; if (/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(e.query)) sql.writes++; } });
  async function invoke(model, method, operation, query, scope) {
    const result = await operation(query);
    // Reject after the actual SQL result, to detect accidental partial success.
    if (fault?.model === model && fault.method === method && fault.scope === scope) throw Error('PRIVATE_VOLUME_READ_FAILURE');
    return result;
  }
  for (const method of ['findMany', 'findUnique']) {
    originals[method] = prisma.monthlyReport[method].bind(prisma.monthlyReport);
    prisma.monthlyReport[method] = q => invoke('monthlyReport', method, originals[method], q, 'global');
  }
  prisma.$transaction = (fn, options) => transaction(async tx => {
    txOptions.push(options); if (fault?.phase === 'opening') throw Error('PRIVATE_OPEN_FAILURE');
    const result = await fn(new Proxy(tx, { get(target, model) {
      if (!['monthlyReport', 'payment', 'invoice', 'communicationLog'].includes(model)) return target[model];
      return new Proxy(target[model], { get(delegate, method) {
        if (!['findMany', 'count', 'groupBy'].includes(method)) return delegate[method];
        return q => invoke(model, method, delegate[method].bind(delegate), q, 'transaction');
      } });
    } }));
    if (fault?.phase === 'completion') throw Error('PRIVATE_COMMIT_FAILURE');
    return result;
  }, options);
  async function get(url, credential = admin, expectedStatus = 200) {
    const peak = { rss: 0, heap: 0 }, sample = () => { const m = process.memoryUsage(); peak.rss = Math.max(peak.rss, m.rss); peak.heap = Math.max(peak.heap, m.heapUsed); };
    sql = { queries: 0, durationMs: 0, writes: 0 }; measuring = true; sample(); const start = performance.now(), timer = setInterval(sample, 5); let response, raw, duration;
    try { response = await fetch(origin + url, { headers: credential ? { Authorization: 'Bearer ' + credential } : {}, signal: AbortSignal.timeout(30000) }); raw = await response.text(); duration = performance.now() - start; sample(); }
    finally { measuring = false; clearInterval(timer); }
    const body = JSON.parse(raw); sample();
    const measurement = { url, status: response.status, durationMs: Math.round(duration * 10) / 10, jsonBytes: Buffer.byteLength(raw), sampledRssMiB: mib(peak.rss), sampledHeapMiB: mib(peak.heap), sql };
    reads.push(measurement); fs.writeFileSync(path.join(folder, 'last-measurement.json'), JSON.stringify(measurement));
    assert.equal(response.status, expectedStatus, url + ' ' + raw.slice(0, 300)); assert.equal(sql.writes, 0);
    assert(duration < 30000 && measurement.jsonBytes < 64 * 1048576 && peak.rss < 768 * 1048576, JSON.stringify(measurement));
    if (url.includes('/client-reports/') || url.includes('/reports/summary') && ![401, 403].includes(expectedStatus)) assert.equal(response.headers.get('cache-control'), 'private, no-store');
    if (expectedStatus === 200 && url.startsWith('/api/client-reports/')) { assert.equal(response.headers.get('x-cw-report-type'), 'client-monthly-list'); assert.equal(response.headers.get('x-cw-client-id'), url.split('/')[3]); }
    if (expectedStatus >= 500) { assert.equal(body.ok, false); assert(!body.reports && !body.data && !body.count); assert(!raw.includes('PRIVATE_')); }
    return body;
  }
  function ownList(packet) {
    assert.equal(packet.count, f.n); exact(ids(packet.reports), ids(f.own).reverse(), 'client list order');
    assert.deepEqual(packet.reports, [...f.own].reverse()); assert(!JSON.stringify(packet).includes('FOREIGN_SECRET'));
  }
  try {
    ownList(await get(listUrl(f.clients[0].id), client)); ownList(await get(listUrl(f.clients[0].id), admin));
    const empty = await get(listUrl(f.clients[2].id), sign(clientActor(f.clients[2]))); assert.deepEqual(empty, { count: 0, reports: [] });
    const other = await get(listUrl(f.clients[1].id), sign(clientActor(f.clients[1]))); assert.equal(other.count, 1); assert.equal(other.reports[0].id, f.foreign.id);
    const adminUrl = '/api/admin/reports?' + new URLSearchParams({ month: f.month, type: 'ADMIN' });
    const historical = await get(adminUrl); assert.equal(historical.count, f.n);
    exact(ids(historical.reports).sort((a, b) => a - b), ids(f.adminReports), 'admin saved IDs');
    for (let i = 1; i < historical.reports.length; i++) assert(Date.parse(historical.reports[i - 1].createdAt) >= Date.parse(historical.reports[i].createdAt));
    for (const row of historical.reports) {
      const expected = f.adminReports.find(r => r.id === row.id), owner = f.clients.find(c => c.id === row.clientId);
      assert.deepEqual(row, { ...expected, client: owner ? { name: owner.name } : null });
    }
    const all = await get('/api/admin/reports'); assert.equal(all.count, f.allIds.length); exact(ids(all.reports).sort((a, b) => a - b), f.allIds, 'unfiltered admin list');
    for (const row of [f.own[0], f.own[Math.floor(f.n / 2)], f.own.at(-1), f.adminReports[0], f.adminReports.at(-1)]) {
      const result = await get('/api/admin/reports/' + row.id), owner = f.clients.find(c => c.id === row.clientId);
      assert.deepEqual(result, { ...row, client: owner ? { name: owner.name } : null });
    }
    assert.deepEqual(await get('/api/admin/reports?month=' + f.emptyMonth), { count: 0, reports: [] });
    assert.equal((await get('/api/admin/reports?month=' + f.month)).count, f.n + 3);
    for (const section of ['financial', 'reports', 'communications']) {
      const packet = await get(summaryUrl(f, section));
      assert.equal(packet.ok, true); assert.equal(packet.complete, true); assert.equal(packet.limitApplied, null); assert.equal(packet.section, section); assert.equal(packet.monthRef, f.month);
      assert.deepEqual(packet.period, { start: f.start, end: f.end, timeZone: 'UTC' }); assert(!JSON.stringify(packet).includes('PRIVATE_'));
      if (section === 'financial') {
        assert.deepEqual(packet.data.cash, { amountCents: f.cashCount - 1, paymentCount: f.cashCount, invalidAmountCount: 0 });
        assert.deepEqual(packet.data.documents, { total: f.bulk, receivableCount: f.bulk, excludedCount: 0, unknownStatusCount: 0, invalidAmountCount: 0, amountCents: f.bulk, openAmountCents: f.bulk });
        assert.equal(packet.data.basis.historicalClosingBalance, false); assert.equal(packet.data.basis.internalCreditIncluded, false);
      } else if (section === 'reports') assert.deepEqual(packet.data, { basis: 'MONTHLY_REPORT_MONTH', total: f.n + 3, adminCount: f.n, clientCount: 1, extraVisitsCount: 1, otherCount: 1 });
      else { assert.equal(packet.data.total, f.bulk); assert.equal(packet.data.latestLimit, 5); assert.equal(packet.data.deliveryConfirmed, false); assert.deepEqual(packet.data.latest, f.latest); }
      const zero = (await get(summaryUrl(f, section, f.emptyMonth))).data;
      if (section === 'financial') { assert.equal(zero.cash.amountCents, 0); assert.equal(zero.cash.paymentCount, 0); assert.equal(zero.documents.amountCents, 0); assert.equal(zero.documents.total, 0); }
      else { assert.equal(zero.total, 0); if (section === 'communications') assert.deepEqual(zero.latest, []); }
    }
    for (const url of [adminUrl, '/api/admin/reports/' + f.own[0].id, summaryUrl(f, 'financial')]) {
      for (const credential of [client, ...f.techs.map(t => sign({ id: t.id, technicianId: t.id, role: t.role, principalType: 'TECHNICIAN' }))]) await get(url, credential, 403);
      await get(url, null, 401);
    }
    await get(listUrl(f.clients[1].id), client, 403); await get(listUrl(f.clients[0].id), null, 401);
    for (const t of f.techs) await get(listUrl(f.clients[0].id), sign({ id: t.id, technicianId: t.id, role: t.role, principalType: 'TECHNICIAN' }), 403);
    await get(listUrl('01'), client, 400); await get(summaryUrl(f, 'unknown'), admin, 400); await get('/api/admin/reports/2147483647', admin, 404);
    const failures = [
      [{ model: 'monthlyReport', method: 'findMany', scope: 'global' }, listUrl(f.clients[0].id), client, 503],
      [{ model: 'monthlyReport', method: 'findMany', scope: 'global' }, adminUrl, admin, 500],
      [{ model: 'monthlyReport', method: 'findUnique', scope: 'global' }, '/api/admin/reports/' + f.own[0].id, admin, 500],
      ...[['monthlyReport', 'groupBy', 'reports'], ['invoice', 'findMany', 'financial'], ['payment', 'findMany', 'financial'], ['communicationLog', 'count', 'communications'], ['communicationLog', 'findMany', 'communications']].map(([model, method, section]) => [{ model, method, scope: 'transaction' }, summaryUrl(f, section), admin, 503]),
      ...['opening', 'completion'].map(phase => [{ phase }, summaryUrl(f, 'financial'), admin, 503]),
    ];
    for (const [injection, url, credential, status] of failures) { fault = injection; await get(url, credential, status); fault = null; await get(url, credential); }
    assert(txOptions.length > 0 && txOptions.every(q => q.isolationLevel === 'RepeatableRead' && q.timeout === 30000));
    return { mode: 'API', records: f.n, financialRecords: f.bulk, reads, orderedClientIdsSha256: hash(ids(f.own).reverse()), adminIdsSha256: hash(ids(f.adminReports)), exactSavedData: true, totals: true, permissions: true, failuresRejected: failures.length, summaryTransactionsRepeatableRead: true, writes: 0 };
  } finally { prisma.$transaction = transaction; for (const method of Object.keys(originals)) prisma.monthlyReport[method] = originals[method]; await new Promise(resolve => server.close(resolve)); }
}

async function browserProbe(f) {
  const browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [], writes = [], seenRequests = [], results = []; let inserted;
  async function pageFor(actor, route) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1100 }, serviceWorkers: 'block' });
    await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
    await context.addInitScript(({ actor, token }) => {
      for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(actor));
      localStorage.setItem('cw_language', 'pt'); localStorage.setItem('qa-report-draft', ' Preserve exact draft ');
      window.qaPopups = []; window.open = () => { const p = { location: {}, closed: false, close() { this.closed = true; } }; qaPopups.push(p); return p; };
    }, { actor, token: sign(actor) });
    const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {
      if (!r.url().includes('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(r.method())) return;
      const url = new URL(r.url()), request = { url: r.url(), method: r.method() };
      // The surrounding portal marks its conversation as seen on load. Record
      // this existing action; only empty conversations belong to this fixture.
      if (r.method() === 'POST' && url.pathname === '/api/client-messages/seen/' + f.clients[0].id && url.search === '?actor=client' && !r.postData()) seenRequests.push(request);
      else writes.push(request);
    });
    await page.goto(base + route, { waitUntil: 'networkidle' }); return { context, page };
  }
  const state = (p, kind) => p.waitForFunction(k => document.getElementById('monthlyReportsPanel').dataset.state === k, kind);
  const expected = ids(f.own).reverse(), adminActor = { id: f.admin, role: 'ADMIN', principalType: 'USER' };
  async function traverse(page) {
    const result = await page.evaluate(() => {
      const started = performance.now(), found = []; let pages = 0, maximum = 0;
      const rows = () => [...document.querySelectorAll('#monthlyList article')].map(r => Number(r.dataset.reportId));
      while (true) { const current = rows(); maximum = Math.max(maximum, current.length); found.push(...current); pages++; if (document.getElementById('monthlyNext').disabled) break; if (pages > 200) throw Error('Unbounded pagination'); document.getElementById('monthlyNext').click(); }
      const last = rows(); document.getElementById('monthlyPrevious').click(); const previous = rows(); document.getElementById('monthlyNext').click();
      return { found, last, previous, final: rows(), pages, maximum, traversalMs: Math.round((performance.now() - started) * 10) / 10 };
    });
    exact(result.found, expected, 'browser complete history'); assert.equal(result.pages, Math.ceil(f.n / 6)); assert.equal(result.maximum, 6);
    assert.deepEqual(result.final, result.last); assert.deepEqual(result.last, expected.slice(-5)); assert.deepEqual(result.previous, expected.slice(-11, -5));
    return { pages: result.pages, rows: result.found.length, maximumDomRows: result.maximum, traversalMs: result.traversalMs, orderedIdsSha256: hash(result.found) };
  }
  try {
    for (const preview of [false, true]) {
      const { context, page } = await pageFor(preview ? adminActor : clientActor(f.clients[0]), '/client-portal' + (preview ? '?clientId=' + f.clients[0].id : ''));
      await state(page, 'ready'); const measurement = await traverse(page);
      await page.locator('#monthlyMonth').fill(f.own[0].month); assert.equal(await page.locator('#monthlyList article').count(), 1); assert.equal(await page.locator('#monthlyList article').getAttribute('data-report-id'), String(f.own[0].id));
      await page.locator('#monthlyList button').click(); await page.waitForFunction(() => document.getElementById('monthlyOpenStatus').dataset.state === 'opened');
      const bytes = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(qaPopups.at(-1).location.href)).arrayBuffer()))));
      const text = require('./lib/reportPdfText')(bytes); assert(text.includes(f.own[0].month)); assert(text.includes('SAVED_VOLUME_0')); assert(!text.includes('FOREIGN_SECRET'));
      await page.locator('#monthlyMonth').fill(f.emptyMonth); assert.equal(await page.locator('#monthlyList article').count(), 0);
      await page.locator('#monthlyClear').click(); exact(await page.locator('#monthlyList article').evaluateAll(rs => rs.map(r => Number(r.dataset.reportId))), expected.slice(0, 6), 'clear filter');
      const endpoint = '**/api/client-reports/' + f.clients[0].id + '/reports';
      await page.route(endpoint, r => r.fulfill({ status: 503, json: { ok: false } })); await page.locator('#monthlyRefresh').click(); await state(page, 'error'); assert.equal(await page.locator('#monthlyList article').count(), 0);
      await page.unroute(endpoint); await page.locator('#monthlyRefresh').click(); await state(page, 'ready');
      if (!preview) {
        inserted = await prisma.monthlyReport.create({ data: { clientId: f.clients[0].id, month: monthAt(f.n), type: 'CLIENT', data: { client: 'ADDED_AFTER_LOAD', pools: [] } } });
        assert.match(await page.locator('#monthlySummary').textContent(), new RegExp('de ' + f.n + '$'));
        await page.locator('#monthlyRefresh').click(); await state(page, 'ready'); assert.match(await page.locator('#monthlySummary').textContent(), new RegExp('de ' + (f.n + 1) + '$')); assert.equal(await page.locator('#monthlyList article').first().getAttribute('data-report-id'), String(inserted.id));
        await prisma.monthlyReport.delete({ where: { id: inserted.id } }); inserted = null; await page.locator('#monthlyRefresh').click(); await state(page, 'ready');
      } else {
        await page.evaluate(id => window.chooseAdminClient(id), f.clients[1].id); await state(page, 'ready'); assert.equal(await page.locator('#monthlyList article').count(), 1); assert.equal(await page.locator('#monthlyList article').getAttribute('data-report-id'), String(f.foreign.id));
        await page.evaluate(id => window.chooseAdminClient(id), f.clients[0].id); await state(page, 'ready'); exact(await page.locator('#monthlyList article').evaluateAll(rs => rs.map(r => Number(r.dataset.reportId))), expected.slice(0, 6), 'preview owner restored');
      }
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1100 }); await page.locator('#monthlyReportsPanel').evaluate(n => n.scrollIntoView({ block: 'start', behavior: 'instant' }));
        assert(await page.locator('#monthlyReportsPanel').evaluate(n => n.scrollWidth <= n.clientWidth + 1)); await page.screenshot({ path: path.join(folder, (preview ? 'preview' : 'client') + '-' + width + '.png') });
      }
      assert.equal(await page.evaluate(() => localStorage.getItem('qa-report-draft')), ' Preserve exact draft ');
      const cdp = await context.newCDPSession(page), metrics = await cdp.send('Runtime.getHeapUsage'); await cdp.detach();
      results.push({ surface: preview ? 'admin-client-preview' : 'client-history', ...measurement, jsHeapMiB: mib(metrics.usedSize), pdfBytes: bytes.length, pdfSha256: createHash('sha256').update(bytes).digest('hex'), filterAndRecovery: true }); await context.close();
    }
    const { context, page } = await pageFor(adminActor, '/admin-reports');
    await page.locator('#reportMonth').fill(f.month); await page.locator('#refreshReports').click(); await page.waitForFunction(() => document.getElementById('reportsStatus').dataset.state === 'review');
    assert.equal(await page.locator('#financialPanel').getAttribute('data-state'), 'ready'); assert.equal(await page.locator('#communicationsPanel').getAttribute('data-state'), 'ready'); assert.equal(await page.locator('#reportsPanel').getAttribute('data-state'), 'review');
    const metric = key => page.locator('[data-metric=' + key + ']');
    assert.equal(await metric('payments').textContent(), String(f.cashCount)); assert.equal(await metric('adminReports').textContent(), String(f.n)); assert.equal(await metric('clientReports').textContent(), '1'); assert.equal(await metric('extraReports').textContent(), '1'); assert.equal(await metric('otherReports').textContent(), '1'); assert.equal(await metric('communications').textContent(), String(f.bulk));
    for (const [key, cents] of [['cash', f.cashCount - 1], ['documentsOpen', f.bulk], ['documentsAmount', f.bulk]]) assert((await metric(key).textContent()).includes((cents / 100).toFixed(2).replace('.', ',')));
    assert.equal(await page.locator('#communications li').count(), 5); assert.equal(await page.locator('#communications img').count(), 0); assert((await page.locator('#communications').textContent()).includes('<img src=x>')); assert(!(await page.locator('main').textContent()).includes('PRIVATE_'));
    for (const width of [390, 1440]) { await page.setViewportSize({ width, height: 1100 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(folder, 'summary-' + width + '.png'), fullPage: true }); }
    const cdp = await context.newCDPSession(page), metrics = await cdp.send('Runtime.getHeapUsage'); await cdp.detach();
    results.push({ surface: 'admin-monthly-summary', savedReports: f.n + 3, sourceRecords: f.bulk, latestRows: 5, jsHeapMiB: mib(metrics.usedSize), exactTotals: true });
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    return { mode: 'UI', records: f.n, results, pageErrors: 0, reportWrites: 0, otherUnexpectedWrites: 0, surroundingPortalSeenRequests: seenRequests };
  } finally { if (inserted) await prisma.monthlyReport.deleteMany({ where: { id: inserted.id } }); await browser.close(); }
}

async function run(file, mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, 'probe', file, mode], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; }); const timer = setTimeout(() => child.kill('SIGKILL'), 85000);
    child.once('error', e => { clearTimeout(timer); reject(e); }); child.once('close', (code, signal) => { clearTimeout(timer);
      if (code !== 0 || signal) return reject(Error(mode + ' failed ' + code + '/' + signal + '\n' + out.slice(-1000) + err.slice(-4500)));
      const line = out.split('\n').find(l => l.startsWith('{"reportVolumeProbe"')); if (!line) return reject(Error('Missing assertion completion proof'));
      const result = JSON.parse(line).reportVolumeProbe; assert(result.ok && result.phase === 'assertions-completed'); console.log(JSON.stringify({ reportVolume: mode, records: result.records, reads: result.reads?.length })); resolve(result);
    });
  });
}
async function main() {
  fs.mkdirSync(folder, { recursive: true }); const output = path.join(folder, 'results.json'), profiles = [201, 1001], results = [], integrity = [], started = Date.now();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-report-volume-')), file = path.join(temporary, 'fixture.json'), engine = (await prisma.$queryRawUnsafe('SELECT version() AS version'))[0].version;
  const models = ['client', 'technician', 'monthlyReport', 'monthlyReportDelivery', 'invoice', 'invoiceLine', 'payment', 'communicationLog', 'clientMessage', 'emailLog', 'fieldWriteRequest', 'userAuditLog'];
  const counts = async () => { const out = {}; for (const model of models) out[model] = await prisma[model].count(); return out; }, baseline = await counts();
  const many = async (model, data) => { for (let i = 0; i < data.length; i += 250) await prisma[model].createMany({ data: data.slice(i, i + 250) }); };
  fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'started', profiles }));
  try {
    for (const n of profiles) {
      const f = { n, bulk: n === 1001 ? 10001 : 201, prefix: 'QA410 ' + randomUUID(), clients: [], techs: [], month: '2187-04', emptyMonth: '2187-06', start: '2187-04-01T00:00:00.000Z', end: '2187-05-01T00:00:00.000Z' };
      const ownWhere = () => ({ clientId: { in: f.clients.map(c => c.id) } });
      try {
        f.admin = (await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } })).id;
        assert.equal(await prisma.monthlyReport.count({ where: { month: { in: [f.month, f.emptyMonth] } } }), 0, 'QA months reserved for this fixture');
        f.reservedMonth = true;
        for (let i = 0; i < 3; i++) f.clients.push(await prisma.client.create({ data: { name: f.prefix + ' Álvaro <img src=x> ' + i, active: true } }));
        for (const role of ['TECHNICIAN', 'TEAM_LEADER']) f.techs.push(await prisma.technician.create({ data: { name: f.prefix + role, active: true, role } }));
        const saved = i => ({ client: 'SAVED_VOLUME_' + i, paymentStatus: 'PAID', literal: ' <img src=x> Łukasz / água ', zero: 0, absent: null, ...(i === n - 2 ? { reportVersion: 2, reviewRequired: true } : {}), pools: Array.from({ length: 24 }, (_, j) => ({ name: 'Piscina <img src=x> ' + j, totalVisits: j, notDone: 0, unconfirmed: j % 3 })) });
        await many('monthlyReport', Array.from({ length: n }, (_, i) => ({ clientId: f.clients[0].id, month: monthAt(i), type: 'CLIENT', data: saved(i), createdAt: new Date(Date.UTC(2020, 0, 1 + i % 3)) })));
        f.own = await prisma.monthlyReport.findMany({ where: { clientId: f.clients[0].id }, orderBy: { id: 'asc' } });
        await many('monthlyReport', Array.from({ length: n }, (_, i) => ({ clientId: i < 2 ? f.clients[i].id : null, month: f.month, type: 'ADMIN', data: saved(i), createdAt: new Date(Date.UTC(2020, 0, 1 + i % 3)) })));
        f.adminReports = await prisma.monthlyReport.findMany({ where: { month: f.month }, orderBy: { id: 'asc' } });
        f.foreign = await prisma.monthlyReport.create({ data: { clientId: f.clients[1].id, month: monthAt(n - 1), type: 'CLIENT', data: { client: 'FOREIGN_SECRET', pools: [] } } });
        await many('monthlyReport', ['CLIENT', 'EXTRA_VISITS', 'OTHER'].map(type => ({ month: f.month, type, clientId: type === 'CLIENT' ? null : f.clients[0].id, data: { private: 'PRIVATE_OTHER_TYPE' } })));
        await many('invoice', Array.from({ length: f.bulk }, () => ({ clientId: f.clients[0].id, monthRef: null, month: f.month, total: 0.01, amountOpen: 0.01, status: 'ISSUED' })));
        const invoice = await prisma.invoice.findFirstOrThrow({ where: ownWhere() });
        const payments = Array.from({ length: f.bulk }, (_, i) => ({ invoiceId: invoice.id, amount: i === 1 ? 0 : 0.01, method: i % 7 ? 'CASH' : 'CREDIT', paidAt: new Date(i % 2 ? new Date(f.end) - 1 : f.start) }));
        f.cashCount = payments.filter(p => p.method === 'CASH').length;
        await many('payment', [...payments, { invoiceId: invoice.id, amount: 999, method: 'CASH', paidAt: new Date(new Date(f.start) - 1) }, { invoiceId: invoice.id, amount: 999, method: 'CASH', paidAt: new Date(f.end) }]);
        await many('communicationLog', [...Array.from({ length: f.bulk }, (_, i) => ({ clientId: f.clients[0].id, channel: 'Canal <img src=x> ' + i, message: 'PRIVATE_COMMUNICATION', createdAt: new Date(i % 2 ? new Date(f.end) - 1 : f.start) })), { clientId: f.clients[0].id, channel: 'PRIVATE_BEFORE', message: '', createdAt: new Date(new Date(f.start) - 1) }, { clientId: f.clients[0].id, channel: 'PRIVATE_AFTER', message: '', createdAt: new Date(f.end) }]);
        const communications = await prisma.communicationLog.findMany({ where: { clientId: f.clients[0].id }, select: { id: true, channel: true, createdAt: true } });
        f.latest = communications.filter(r => +r.createdAt >= +new Date(f.start) && +r.createdAt < +new Date(f.end)).sort((a, b) => b.createdAt - a.createdAt || b.id - a.id).slice(0, 5);
        f.allIds = ids(await prisma.monthlyReport.findMany({ select: { id: true }, orderBy: { id: 'asc' } }));
        const snapshot = async () => {
          const values = {}; for (const model of ['monthlyReport', 'invoice', 'communicationLog', 'clientMessage']) values[model] = await prisma[model].findMany({ where: model === 'monthlyReport' ? { OR: [ownWhere(), { month: f.month }] } : ownWhere(), orderBy: { id: 'asc' } });
          values.payment = await prisma.payment.findMany({ where: { invoice: ownWhere() }, orderBy: { id: 'asc' } }); values.client = await prisma.client.findMany({ where: { id: { in: f.clients.map(c => c.id) } }, orderBy: { id: 'asc' } }); return hash(values);
        };
        const before = await counts(), beforeHash = await snapshot(); fs.writeFileSync(file, JSON.stringify(f)); results.push(await run(file, 'API'));
        if (n === 1001) results.push(await run(file, 'UI'));
        assert.deepEqual(await counts(), before); assert.equal(await snapshot(), beforeHash);
        integrity.push({ records: n, sourceSnapshotSha256: beforeHash, sourcePreserved: true, unchangedModelCounts: before });
        fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'profiles-in-progress', profiles, results, integrity }, null, 2) + '\n');
      } finally {
        await prisma.payment.deleteMany({ where: { invoice: ownWhere() } }); await prisma.invoice.deleteMany({ where: ownWhere() }); await prisma.communicationLog.deleteMany({ where: ownWhere() });
        await prisma.monthlyReport.deleteMany({ where: { OR: [ownWhere(), ...(f.reservedMonth ? [{ month: f.month }] : [])] } });
        await prisma.client.deleteMany({ where: { id: { in: f.clients.map(c => c.id) } } }); await prisma.technician.deleteMany({ where: { id: { in: f.techs.map(t => t.id) } } }); assert.deepEqual(await counts(), baseline);
      }
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); const partial = JSON.parse(fs.readFileSync(output)); partial.cleanupVerified = hash(await counts()) === hash(baseline); fs.writeFileSync(output, JSON.stringify(partial, null, 2) + '\n'); }
  assert.equal(results.length, 3); fs.writeFileSync(output, JSON.stringify({ ok: true, phase: 'assertions-completed', engine, profiles, results, integrity, durationMs: Date.now() - started, cleanupVerified: true, scope: 'Fresh Node process per API profile; RSS includes routes, HTTP client and fixture oracle, excludes database/browser. Full saved lists remain O(n); portal pages of six are local. Browser traversal dispatches real click handlers and checks every DOM result, not human pacing/painting. Summary sections have individual RepeatableRead transactions, not a common cross-section snapshot. Saved legacy admin listing has createdAt order without an ID tie-break or explicit private cache header. New volume fixtures are removed; source hashes and twelve model counts are preserved. Report HTTP commands are read-only; surrounding portal conversation-seen POSTs are recorded separately and empty message state is preserved. PDF checks cover historical identity, not maximum document/attachment sizes.' }, null, 2) + '\n');
  completed = true; console.log('PASS report volume: 201/1001 saved client/admin reports, 10001 financial/communication records, exact data/totals, six-row pages, scoped details, failures, real UI and cleanup');
}
async function child(file, mode) { const f = canonical(JSON.parse(fs.readFileSync(file, 'utf8'))), result = mode === 'API' ? await apiProbe(f) : await browserProbe(f); completed = true; console.log(JSON.stringify({ reportVolumeProbe: { ok: true, phase: 'assertions-completed', ...result } })); }
(process.argv[2] === 'probe' ? child(...process.argv.slice(3)) : main()).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
