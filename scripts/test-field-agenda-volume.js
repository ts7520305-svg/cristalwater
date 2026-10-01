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
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex'), mib = bytes => Math.round(bytes / 1048576 * 100) / 100;
const key = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const add = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const inside = (value, start, end) => value != null && +new Date(value) >= +start && +new Date(value) < +end;
const sign = actor => require('jsonwebtoken').sign(actor, require('../src/utils/jwtSecret').getJwtSecret(), { expiresIn: '30m' });
const folder = path.join(__dirname, '../reports/field-suite/agenda-volume');
let completed = false;
process.on('exit', () => { if (!completed && !process.exitCode) { fs.writeSync(2, 'Agenda volume exited before assertions completed\n'); process.exitCode = 1; } });
function exact(actual, expected, label) {
  assert.equal(new Set(actual).size, actual.length, label + ' duplicate IDs');
  assert.equal(hash(actual), hash(expected), label + ': actual ' + actual.length + ', expected ' + expected.length);
}
const visitKey = r => (r.kind || r.visitType) + ':' + r.id;
const regularOrder = (a, b) => +new Date(a.plannedDate) - +new Date(b.plannedDate) || a.id - b.id;
function group(status) {
  const value = String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, '_');
  const aliases = { DONE: ['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUIDO'], PLANNED: ['PLANNED', 'PENDING', 'PENDING_TECHNICIAN', 'AGENDADA', 'AGENDADO', 'PLANEADA', 'PLANEADO'], IN_PROGRESS: ['IN_PROGRESS', 'EM_EXECUCAO'], NOT_DONE: ['NOT_DONE', 'BLOCKED', 'RETAINED', 'IMPEDIDO', 'INCOMPLETE', 'FAILED', 'NOT_COMPLETED', 'NAO_REALIZADA', 'NAO_REALIZADO', 'NAO_CONCLUIDA', 'NAO_CONCLUIDO'], CANCELLED: ['CANCELLED', 'CANCELED', 'CANCELADA', 'CANCELADO'] };
  return Object.keys(aliases).find(k => aliases[k].includes(value)) || 'OTHER';
}
const totals = rows => rows.reduce((t, r) => { t.total++; t[group(r.status)]++; return t; }, { total: 0, PLANNED: 0, IN_PROGRESS: 0, DONE: 0, NOT_DONE: 0, CANCELLED: 0, OTHER: 0 });
// Independent civil-day oracle: compare formatted Lisbon dates; never reuse
// the production SQL predicates or the production bounds/status helpers.
const lisbonClock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' });
const lisbonDay = date => lisbonClock.format(new Date(date));
function scheduled(f) { return [...f.regular.map(r => ({ ...r, kind: 'REGULAR', at: r.plannedDate || r.date })), ...f.extra.map(r => ({ ...r, kind: 'EXTRA', at: r.scheduledAt }))]; }
function dayRows(f, day) { return scheduled(f).filter(r => lisbonDay(r.at) === day).sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind) || a.id - b.id); }
function technicianRows(f) {
  const start = new Date(f.today), end = add(start, 1), cancelled = new Set(['CANCELLED', 'CANCELED', 'CANCELADA', 'CANCELADO', 'ARCHIVED', 'ARQUIVADA', 'ARQUIVADO']);
  return scheduled(f).filter(r => r.technicianId === f.techs[0].id && !cancelled.has(r.status) && (inside(r.kind === 'REGULAR' ? r.plannedDate || r.date : r.scheduledAt, start, end) || inside(r.startAt, start, end) || inside(r.endAt, start, end)))
    .sort((a, b) => +new Date(a.at) - +new Date(b.at) || a.id - b.id || (a.kind === b.kind ? 0 : a.kind === 'REGULAR' ? -1 : 1));
}
function occurs(r, day) {
  const date = key(day);
  if (r.startsOn && date < r.startsOn.slice(0, 10) || r.endsOn && date > r.endsOn.slice(0, 10)) return false;
  if (r.recurrence === 'DAILY') return true;
  if (r.recurrence === 'MONTHLY') return day.getDate() === Math.min(r.dayOfMonth, new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate());
  return day.getDay() === r.dayOfWeek;
}

async function apiProbe(f) {
  const app = require('express')(); require('../src/middlewares/legacyAdministrationAccess')(app);
  for (const [mount, file] of [['/api/round-planner', 'roundRoutes'], ['/api/rounds', 'adminRoundsRoutes'], ['/api/admin/rounds', 'adminRoundsRoutes'], ['/api/core', 'coreFlowRoutes'], ['/api/dashboard', 'dashboardRoutes'], ['/api/technician', 'technicianRoutes']]) app.use(mount, require('../src/routes/' + file));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const origin = 'http://127.0.0.1:' + server.address().port, token = sign({ id: f.admin, role: 'ADMIN', principalType: 'USER' });
  const techToken = sign({ id: f.techs[0].id, technicianId: f.techs[0].id, role: 'TECHNICIAN' });
  const reads = []; let sql, measuring = false;
  prisma.$on('query', e => { if (measuring) { sql.queries++; sql.durationMs += e.duration; if (/^\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(e.query)) sql.writes++; } });
  async function get(url, credential = token, expectedStatus = 200) {
    global.gc?.(); const peak = { rss: process.memoryUsage().rss, heap: process.memoryUsage().heapUsed };
    const sample = () => { const m = process.memoryUsage(); peak.rss = Math.max(peak.rss, m.rss); peak.heap = Math.max(peak.heap, m.heapUsed); };
    sql = { queries: 0, writes: 0, durationMs: 0 }; const timer = setInterval(sample, 5), start = performance.now(); let response, raw, durationMs;
    measuring = true;
    try { response = await fetch(origin + url, { headers: credential ? { Authorization: 'Bearer ' + credential } : {}, signal: AbortSignal.timeout(30000) }); raw = await response.text(); durationMs = performance.now() - start; sample(); }
    finally { measuring = false; clearInterval(timer); }
    const body = JSON.parse(raw); sample(); assert.equal(response.status, expectedStatus, url + ': ' + raw.slice(0, 400)); assert.equal(sql.writes, 0, url);
    assert(durationMs < 30000); assert(Buffer.byteLength(raw) < 64 * 1048576); assert(peak.rss < 768 * 1048576);
    reads.push({ url, status: response.status, durationMs: Math.round(durationMs * 10) / 10, jsonBytes: Buffer.byteLength(raw), sampledRssMiB: mib(peak.rss), sampledHeapMiB: mib(peak.heap), sql });
    return body;
  }
  try {
    const today = new Date(f.today), end = add(today, 7), poolIds = new Set(f.pools.map(p => p.id));
    const expectedRolling = f.regular.filter(r => inside(r.plannedDate, today, end)).sort(regularOrder).map(r => r.id);
    const rolling = await get('/api/round-planner/week');
    exact(rolling.filter(r => poolIds.has(r.poolId)).map(r => r.id), expectedRolling, 'rolling week');
    assert(rolling.every(r => inside(r.plannedDate, today, end)));
    const weekProofs = [];
    for (const day of ['2032-02-29', '2032-12-31', '2033-01-01', f.day]) {
      const start = new Date(day + 'T00:00:00'); start.setDate(start.getDate() - start.getDay()); const stop = add(start, 7);
      const expected = f.regular.filter(r => inside(r.plannedDate, start, stop)).sort(regularOrder).map(r => r.id);
      let alias;
      for (const route of ['/api/rounds/week', '/api/admin/rounds/week']) {
        const packet = await get(route + '?date=' + day); assert(packet.ok); const body = packet.plan;
        if (alias) assert.deepEqual(body, alias); alias = body;
        assert.equal(body.weekStart, start.toISOString()); assert.equal(body.weekEnd, stop.toISOString()); assert.equal(body.days.length, 7);
        const visits = body.days.flatMap(d => d.visits); assert.equal(body.totalVisits, visits.length);
        exact(visits.filter(r => poolIds.has(r.poolId)).map(r => r.id), expected, route + ' ' + day);
        for (const [index, d] of body.days.entries()) {
          const date = add(start, index); assert.equal(d.calendarDate, key(date)); assert.equal(d.summary.visits, d.visits.length);
          assert(d.visits.every(v => key(new Date(v.plannedDate)) === d.calendarDate));
          exact(d.rounds.filter(r => f.rounds.some(x => x.id === r.id)).map(r => r.id).sort((a, b) => a - b), f.rounds.filter(r => r.active && occurs(r, date)).map(r => r.id).sort((a, b) => a - b), 'active recurrence');
          assert.equal(d.summary.pools, d.rounds.reduce((n, r) => n + r.pools.length, 0));
          assert.equal(d.summary.technicians, d.rounds.reduce((n, r) => n + r.technicians.length, 0));
        }
      }
      weekProofs.push({ day, fixtureVisits: expected.length, orderedIdsSha256: hash(expected) });
    }
    const inactive = (await get('/api/rounds/week?date=2032-02-29&includeInactive=true')).plan;
    for (const d of inactive.days) exact(d.rounds.filter(r => f.rounds.some(x => x.id === r.id)).map(r => r.id).sort((a, b) => a - b), f.rounds.filter(r => occurs(r, new Date(d.date))).map(r => r.id).sort((a, b) => a - b), 'include inactive recurrence');
    const dayProofs = [];
    for (const day of ['2032-02-29', '2032-03-28', '2032-10-31', f.lisbonDay]) {
      const expected = dayRows(f, day), found = []; let last, page = 1;
      do {
        last = await get('/api/core/visits/day/page?' + new URLSearchParams({ date: day, q: f.prefix, page: String(page++) }));
        assert(last.rows.length <= 50); assert.deepEqual(last.totals, totals(expected)); found.push(...last.rows.map(r => r.key)); assert(page < 100);
      } while (last.hasNext);
      exact(found, expected.map(visitKey), 'admin day ' + day);
      const beyond = await get('/api/core/visits/day/page?' + new URLSearchParams({ date: day, q: f.prefix, page: String(page) })); assert.equal(beyond.rows.length, 0);
      dayProofs.push({ day, rows: found.length, pages: page - 1, orderedKeysSha256: hash(found), hours: (Date.parse(last.range.end) - Date.parse(last.range.start)) / 3600000 });
    }
    assert.equal(dayProofs[1].hours, 23); assert.equal(dayProofs[2].hours, 25);
    const monthProofs = [];
    for (const month of ['2032-02', '2032-12', '2033-01']) {
      const [year, n] = month.split('-').map(Number), start = new Date(year, n - 1, 1), stop = new Date(year, n, 1);
      const expected = f.regular.filter(r => inside(r.plannedDate, start, stop) || inside(r.date, start, stop));
      const body = await get('/api/dashboard/admin?monthRef=' + month), own = body.visits.filter(r => poolIds.has(r.poolId));
      exact(own.map(r => r.id).sort((a, b) => a - b), expected.map(r => r.id).sort((a, b) => a - b), 'monthly IDs');
      const t = totals(body.visits); assert.equal(body.summary.visitsThisMonth, body.visits.length);
      assert.equal(body.summary.visitsDoneThisMonth, t.DONE); assert.equal(body.summary.visitsNotDoneThisMonth, t.NOT_DONE); assert.equal(body.summary.visitsPlannedThisMonth, t.PLANNED + t.IN_PROGRESS);
      monthProofs.push({ month, fixtureVisits: own.length, idsSha256: hash(own.map(r => r.id).sort((a, b) => a - b)) });
    }
    const expectedTech = technicianRows(f);
    const url = '/api/technician/today?date=' + f.day + '&technicianId=' + f.techs[1].id, full = await get(url, techToken);
    assert(full.complete); assert.equal(full.total, expectedTech.length); exact(full.visits.map(visitKey), expectedTech.map(visitKey), 'technician scope and complete route');
    const paged = []; let offset = 0, packet;
    do { packet = await get(url + '&limit=200&offset=' + offset, techToken); assert.equal(packet.total, full.total); assert(packet.visits.length <= 200); paged.push(...packet.visits.map(visitKey)); offset = packet.nextOffset; } while (packet.hasMore);
    exact(paged, expectedTech.map(visitKey), 'technician pages');
    for (const route of ['/api/round-planner/week', '/api/rounds/week', '/api/admin/rounds/week', '/api/core/visits/day/page']) { await get(route, null, 401); await get(route, techToken, 403); }
    const previous = prisma.serviceVisit.findMany;
    try { prisma.serviceVisit.findMany = async () => { throw Error('PRIVATE_AGENDA_READ_FAILURE'); };
      for (const route of ['/api/round-planner/week', '/api/rounds/week', '/api/admin/rounds/week']) { const body = await get(route, token, 500); assert(!body.plan && !body.days && !body.visits && !body.totalVisits); assert(!JSON.stringify(body).includes('PRIVATE_')); }
    } finally { prisma.serviceVisit.findMany = previous; }
    return { mode: 'API', pools: f.pools.length, historicalWeeks: 104, historicalMonths: 24, regular: f.regular.length, extras: f.extra.length, reads, weekProofs, dayProofs, monthProofs, rollingVisits: expectedRolling.length, technicianVisits: full.total, technicianPages: Math.ceil(full.total / 200), permissions: true, partialFailuresRejected: 3, writes: 0 };
  } finally { await new Promise(resolve => server.close(resolve)); }
}

async function browserProbe(f) {
  const probeStarted = performance.now(), phases = [];
  const mark = (phase, detail = {}) => { const entry = { phase, elapsedMs: Math.round(performance.now() - probeStarted), ...detail }; phases.push(entry); console.log(JSON.stringify({ agendaVolumeStage: entry })); };
  const browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: f.timeZone, serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(({ token, id, origin }) => { if (location.origin !== origin) return; for (const k of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(k, token); for (const k of ['user', 'cristalwater_user']) localStorage.setItem(k, JSON.stringify({ id, role: 'ADMIN' })); }, { token: sign({ id: f.admin, role: 'ADMIN', principalType: 'USER' }), id: f.admin, origin: new URL(base).origin });
    const page = await context.newPage(), errors = [], writes = []; page.setDefaultTimeout(30000);
    const observe = p => { p.on('pageerror', e => errors.push(e.message)); p.on('request', r => { if (r.url().startsWith(base + '/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(r.method() + ' ' + new URL(r.url()).pathname); }); }; observe(page);
    mark('planner-open');
    const start = performance.now(); await page.goto(base + '/admin-rounds', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('carregadas com sucesso'));
    const today = new Date(f.today), end = add(today, 7), ownPools = new Set(f.pools.map(r => r.id));
    const expected = scheduled(f).filter(r => inside(r.kind === 'REGULAR' ? r.plannedDate : r.scheduledAt, today, end)).sort((a, b) => +new Date(a.at) - +new Date(b.at) || (a.kind === b.kind ? a.id - b.id : a.kind === 'REGULAR' ? -1 : 1));
    await page.locator('#visitSearch').fill(f.prefix);
    const rowKeys = () => page.locator('#weekVisits tr[data-id]').evaluateAll(rows => rows.map(r => r.dataset.kind + ':' + r.dataset.id).sort());
    // Planner uses SERVICE; day/technician APIs use REGULAR. Equal-time
    // extras have no ID ordering contract, so compare exact unique sets here.
    const plannerKeys = rows => rows.map(r => (r.kind === 'REGULAR' ? 'SERVICE' : 'EXTRA') + ':' + r.id).sort();
    exact(await rowKeys(), plannerKeys(expected), 'planner DOM');
    const loadMs = performance.now() - start;
    for (const status of ['extra', '', 'extra', '']) { await page.locator('#visitStatusFilter').selectOption(status); exact(await rowKeys(), plannerKeys(status ? expected.filter(r => r.kind === 'EXTRA') : expected), 'planner repeated filter'); }
    // Chromium date fill already emits the native change event. Measure it and
    // verify the resulting rows instead of dispatching a second full repaint.
    await page.evaluate(() => { window.qaAgendaDateChanges = []; document.getElementById('visitDateFilter').addEventListener('change', event => qaAgendaDateChanges.push(event.target.value)); });
    await page.locator('#visitDateFilter').fill(f.day);
    exact(await rowKeys(), plannerKeys(expected.filter(r => key(new Date(r.at)) === f.day)), 'planner selected day');
    assert.deepEqual(await page.evaluate(() => qaAgendaDateChanges), [f.day], 'One actual date change updates the selected-day rows');
    await page.locator('#visitDateFilter').fill(''); exact(await rowKeys(), plannerKeys(expected), 'planner restored');
    const dateChanges = await page.evaluate(() => qaAgendaDateChanges);
    assert.deepEqual(dateChanges, [f.day, ''], 'Clearing the actual date updates the complete original set');
    mark('planner-date-changes-verified', { changes: dateChanges.length });
    assert.equal(await page.locator('#weekVisits img').count(), 0);
    const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable'); const metrics = await cdp.send('Performance.getMetrics');
    const plannerHeapMiB = mib(metrics.metrics.find(m => m.name === 'JSHeapUsedSize').value);
    await page.setViewportSize({ width: 390, height: 1000 }); exact(await rowKeys(), plannerKeys(expected), 'mobile planner IDs');
    await page.locator('#weekVisits').evaluate(n => n.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(folder, 'planner-390.png') });
    mark('planner-verified', { rows: expected.length });
    const dayExpected = dayRows(f, f.lisbonDay), seen = []; let pages = 0;
    const dayStart = performance.now(); await page.goto(base + '/admin-today?' + new URLSearchParams({ date: f.lisbonDay, q: f.prefix }), { waitUntil: 'networkidle' });
    for (;;) {
      await page.waitForFunction(() => document.getElementById('adminDay')?.dataset.state === 'ready');
      const ids = await page.locator('[data-visit-key]').evaluateAll(rows => rows.map(r => r.dataset.visitKey)); assert(ids.length <= 50); seen.push(...ids); pages++; assert(pages < 100);
      if (await page.locator('#dayNext').isDisabled()) break;
      await page.locator('#dayNext').click();
    }
    exact(seen, dayExpected.map(visitKey), 'day browser pages'); assert.equal(await page.locator('[data-day-total=total]').textContent(), String(dayExpected.length));
    await page.locator('#dayFirst').click(); await page.waitForFunction(() => document.getElementById('adminDay')?.dataset.state === 'ready');
    exact(await page.locator('[data-visit-key]').evaluateAll(rows => rows.map(r => r.dataset.visitKey)), dayExpected.slice(0, 50).map(visitKey), 'day first-page return');
    assert(loadMs < 30000); assert(plannerHeapMiB < 256); assert(ownPools.size === 400);
    await page.locator('[data-visit-key]').first().scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(folder, 'day-390.png') });
    const dayTraversalMs = performance.now() - dayStart;
    mark('day-verified', { rows: seen.length, pages });
    const techContext = await browser.newContext({ viewport: { width: 390, height: 1000 }, timezoneId: f.timeZone, serviceWorkers: 'block' });
    await techContext.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await techContext.addInitScript(({ token, tech, origin }) => {
      if (location.origin !== origin) return;
      for (const k of ['token', 'cristalwater_jwt']) localStorage.setItem(k, token);
      for (const k of ['user', 'cristalwater_user']) localStorage.setItem(k, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      const interval = window.setInterval; window.setInterval = (fn, ms, ...args) => [15000, 30000].includes(ms) ? 0 : interval(fn, ms, ...args);
      Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
      // A complete field route must be verifiable while unrelated reads continue.
      window.qaAgendaTraffic = { started: 0, completed: 0 };
      window.qaAgendaTrafficTimer = interval(() => {
        qaAgendaTraffic.started++;
        fetch('/api/core/health?agendaReadiness=' + qaAgendaTraffic.started).then(response => { if (response.ok) qaAgendaTraffic.completed++; }).catch(() => {});
      }, 100);
    }, { token: sign({ id: f.techs[0].id, role: 'TECHNICIAN' }), tech: f.techs[0], origin: new URL(base).origin });
    const field = await techContext.newPage(); field.setDefaultTimeout(20000); observe(field);
    const expectedTech = technicianRows(f), techStart = performance.now(); mark('technician-open', { expectedRows: expectedTech.length });
    // The exact route and DOM assertions below define field readiness.
    try { await field.goto(base + '/technician-field-mode', { waitUntil: 'domcontentloaded' }); }
    catch (error) { const readiness = await field.evaluate(() => ({ routeRows: window.CWFieldDaySnapshot?.().visits.length, domRows: document.querySelectorAll('#visitList [data-visit-index]').length, traffic: window.qaAgendaTraffic })); mark('technician-wait-failed', readiness); throw error; }
    await field.waitForFunction(n => window.CWFieldDaySnapshot?.().visits.length === n, expectedTech.length);
    exact(await field.evaluate(() => CWFieldDaySnapshot().visits.map(r => r.visitType + ':' + r.id)), expectedTech.map(visitKey), 'technician browser snapshot');
    mark('technician-snapshot-verified', { rows: expectedTech.length });
    await field.locator('#poolSegments [data-pool-filter=TODO]').evaluate(n => n.click());
    exact(await field.locator('#visitList [data-visit-index]').evaluateAll(rows => rows.map(r => Number(r.dataset.visitIndex))), expectedTech.map((_, i) => i), 'technician browser DOM indexes');
    mark('technician-dom-verified', { rows: expectedTech.length });
    for (const index of [expectedTech.length - 1, 0, expectedTech.length - 1]) {
      await field.locator('#visitList [data-visit-index="' + index + '"]').evaluate(n => n.click());
      await field.waitForFunction(wanted => { const r = window.CWFieldVisitContext?.(); return r && r.visitType + ':' + r.id === wanted; }, visitKey(expectedTech[index]));
      mark('technician-selection-verified', { index });
    }
    assert.equal(await field.locator('#visitList img').count(), 0);
    const techCdp = await techContext.newCDPSession(field); await techCdp.send('Performance.enable'); const techMetrics = await techCdp.send('Performance.getMetrics');
    const technicianHeapMiB = mib(techMetrics.metrics.find(m => m.name === 'JSHeapUsedSize').value), technicianMs = performance.now() - techStart;
    assert(technicianHeapMiB < 256); assert(technicianMs < 30000); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    const readinessTraffic = await field.evaluate(() => { clearInterval(qaAgendaTrafficTimer); return { ...qaAgendaTraffic }; });
    assert(readinessTraffic.started > 0 && readinessTraffic.completed > 0, 'Continuous reads exercised during field readiness');
    mark('technician-verified', { rows: expectedTech.length, readinessTraffic });
    await field.locator('#visitList [data-visit-index]').last().scrollIntoViewIfNeeded(); await field.screenshot({ path: path.join(folder, 'technician-390.png') });
    return { mode: 'UI', pools: f.pools.length, plannerRows: expected.length, plannerLoadMs: Math.round(loadMs * 10) / 10, plannerJsHeapMiB: plannerHeapMiB, dayRows: seen.length, dayPages: pages, dayTraversalMs: Math.round(dayTraversalMs * 10) / 10, technicianRows: expectedTech.length, technicianLoadAndNavigationMs: Math.round(technicianMs * 10) / 10, technicianJsHeapMiB: technicianHeapMiB, exactIds: true, repeatedFilters: true, dateChangeEvents: dateChanges.length, pageErrors: errors.length, writes: writes.length, readinessTraffic, phases };
  } finally { await browser.close(); }
}

async function child(file, mode) { const f = JSON.parse(fs.readFileSync(file, 'utf8')); const result = mode === 'API' ? await apiProbe(f) : await browserProbe(f); completed = true; console.log(JSON.stringify({ agendaVolumeProbe: { ok: true, phase: 'assertions-completed', ...result } })); }
async function run(file, mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--expose-gc', __filename, 'probe', file, mode], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; }); const timer = setTimeout(() => child.kill('SIGKILL'), 75000);
    child.once('error', e => { clearTimeout(timer); reject(e); }); child.once('close', (code, signal) => { clearTimeout(timer);
      if (code !== 0 || signal) return reject(Error(mode + ' failed ' + code + '/' + signal + '\n' + out.slice(-2000) + err.slice(-5000)));
      const line = out.split('\n').find(l => l.startsWith('{"agendaVolumeProbe"')); if (!line) return reject(Error('Missing assertion completion proof'));
      const result = JSON.parse(line).agendaVolumeProbe; assert(result.ok && result.phase === 'assertions-completed'); console.log(JSON.stringify({ agendaVolume: mode, pools: result.pools, reads: result.reads?.length, plannerRows: result.plannerRows })); resolve(result);
    });
  });
}
async function main() {
  fs.mkdirSync(folder, { recursive: true }); const output = path.join(folder, 'results.json'), results = [], profiles = [25, 100, 400];
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-agenda-volume-')), file = path.join(temporary, 'fixture.json');
  const f = { prefix: 'QA407 ' + randomUUID(), techs: [], pools: [], rounds: [] }, today = new Date(); today.setHours(0, 0, 0, 0);
  Object.assign(f, { today: today.toISOString(), day: key(today), lisbonDay: lisbonDay(add(today, 0).setHours(12)), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'started', profiles }));
  const models = ['client', 'pool', 'technician', 'round', 'roundPool', 'roundTechnician', 'serviceVisit', 'extraVisit', 'notification', 'chatMessage', 'emailLog'];
  const counts = async () => { const c = {}; for (const m of models) c[m] = await prisma[m].count(); return c; }, baseline = await counts();
  const many = async (model, rows) => { for (let i = 0; i < rows.length; i += 250) await prisma[model].createMany({ data: rows.slice(i, i + 250) }); };
  try {
    f.admin = (await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } })).id;
    f.client = await prisma.client.create({ data: { name: f.prefix + ' <img src=x>', active: true } });
    for (let i = 0; i < 16; i++) {
      f.techs.push(await prisma.technician.create({ data: { name: f.prefix + ' tech ' + i, active: true } }));
      const round = await prisma.round.create({ data: { name: f.prefix + ' round ' + i, active: i !== 15, dayOfWeek: i % 7, recurrence: i === 0 ? 'DAILY' : i === 1 ? 'MONTHLY' : 'WEEKLY', dayOfMonth: i === 1 ? 31 : null, startsOn: i === 14 ? new Date('2032-02-29T00:00:00Z') : null, endsOn: i === 14 ? new Date('2033-01-01T00:00:00Z') : null } });
      f.rounds.push(round); await prisma.roundTechnician.create({ data: { roundId: round.id, technicianId: f.techs[i].id } });
    }
    for (const n of profiles) {
      const previous = f.pools.length;
      await many('pool', Array.from({ length: n - previous }, (_, i) => ({ clientId: f.client.id, name: f.prefix + ' pool ' + String(previous + i).padStart(3, '0'), active: true })));
      f.pools = await prisma.pool.findMany({ where: { clientId: f.client.id }, select: { id: true, name: true }, orderBy: { id: 'asc' } }); assert.equal(f.pools.length, n);
      const regular = [], extra = [], associations = [], statuses = ['DONE', 'PLANNED', 'NOT_DONE', 'CANCELLED', 'IN_PROGRESS', 'UNKNOWN'];
      for (const [j, pool] of f.pools.slice(previous).entries()) {
        const i = previous + j, common = { clientId: f.client.id, poolId: pool.id, technicianId: f.techs[i % 16].id }, roundId = f.rounds[i % 16].id;
        associations.push({ roundId, poolId: pool.id, order: Math.floor(i / 16) + 1 });
        for (let week = 0; week < 104; week++) { const date = add(new Date(2032, 0, 6, 12), week * 7); regular.push({ ...common, roundId, status: statuses[week % statuses.length], date, plannedDate: date }); }
        for (let month = 0; month < 24; month++) { const date = new Date(2032, month + 1, 0, 12); extra.push({ ...common, status: statuses[month % statuses.length], scheduledAt: date, date, billingMode: 'NO_CHARGE' }); }
        const noon = new Date(today); noon.setHours(12);
        regular.push({ ...common, roundId, technicianId: f.techs[0].id, status: 'PLANNED', plannedDate: noon, date: noon });
        extra.push({ ...common, technicianId: f.techs[0].id, status: 'PLANNED', scheduledAt: noon, date: noon, billingMode: 'NO_CHARGE' });
        // Foreign technician, null plannedDate fallback, and exact rolling boundaries.
        for (const plannedDate of [new Date(+today - 1), today, add(today, 7)]) regular.push({ ...common, status: 'PLANNED', plannedDate, date: noon });
        regular.push({ ...common, status: 'BLOCKED', plannedDate: null, date: new Date('2032-02-29T12:00:00Z') });
      }
      await many('roundPool', associations); await many('serviceVisit', regular); await many('extraVisit', extra);
      if (n === profiles[0]) {
        const common = { clientId: f.client.id, poolId: f.pools[0].id, technicianId: f.techs[0].id, status: 'PLANNED' };
        // Millisecond boundary sentinels independent of the implementation.
        for (const instant of ['2032-02-28T23:59:59.999Z', '2032-02-29T00:00:00.000Z', '2032-02-29T23:59:59.999Z', '2032-03-01T00:00:00.000Z', '2032-03-28T00:00:00.000Z', '2032-03-28T22:59:59.999Z', '2032-03-28T23:00:00.000Z', '2032-10-30T23:00:00.000Z', '2032-10-31T23:59:59.999Z', '2032-11-01T00:00:00.000Z', '2032-12-31T23:59:59.999Z', '2033-01-01T00:00:00.000Z']) { const date = new Date(instant); await prisma.serviceVisit.create({ data: { ...common, plannedDate: date, date } }); await prisma.extraVisit.create({ data: { ...common, scheduledAt: date, date, billingMode: 'NO_CHARGE' } }); }
      }
      const select = { id: true, poolId: true, technicianId: true, status: true, date: true, startAt: true, endAt: true };
      f.regular = await prisma.serviceVisit.findMany({ where: { clientId: f.client.id }, select: { ...select, plannedDate: true }, orderBy: { id: 'asc' } });
      f.extra = await prisma.extraVisit.findMany({ where: { clientId: f.client.id }, select: { ...select, scheduledAt: true }, orderBy: { id: 'asc' } });
      const beforeCounts = await counts(), before = hash({ regular: f.regular, extra: f.extra }); fs.writeFileSync(file, JSON.stringify(f));
      results.push(await run(file, 'API'));
      fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'profiles-in-progress', profiles, results }, null, 2) + '\n');
      if (n === 400) results.push(await run(file, 'UI'));
      assert.deepEqual(await counts(), beforeCounts);
      assert.equal(hash({ regular: await prisma.serviceVisit.findMany({ where: { clientId: f.client.id }, select: { ...select, plannedDate: true }, orderBy: { id: 'asc' } }), extra: await prisma.extraVisit.findMany({ where: { clientId: f.client.id }, select: { ...select, scheduledAt: true }, orderBy: { id: 'asc' } }) }), before);
      fs.writeFileSync(output, JSON.stringify({ ok: false, phase: 'profiles-in-progress', profiles, results }, null, 2) + '\n');
    }
  } finally {
    if (f.client) { const where = { clientId: f.client.id }; await prisma.serviceVisit.deleteMany({ where }); await prisma.extraVisit.deleteMany({ where }); }
    const roundIds = f.rounds.map(r => r.id); await prisma.roundPool.deleteMany({ where: { roundId: { in: roundIds } } }); await prisma.roundTechnician.deleteMany({ where: { roundId: { in: roundIds } } }); await prisma.round.deleteMany({ where: { id: { in: roundIds } } });
    if (f.client) { await prisma.pool.deleteMany({ where: { clientId: f.client.id } }); await prisma.client.delete({ where: { id: f.client.id } }); }
    await prisma.technician.deleteMany({ where: { id: { in: f.techs.map(t => t.id) } } }); assert.deepEqual(await counts(), baseline);
    const partial = JSON.parse(fs.readFileSync(output)); partial.cleanupVerified = true; fs.writeFileSync(output, JSON.stringify(partial, null, 2) + '\n'); fs.rmSync(temporary, { recursive: true, force: true });
  }
  assert.equal(results.length, 4); fs.writeFileSync(output, JSON.stringify({ ok: true, phase: 'assertions-completed', profiles, serverTimeZone: f.timeZone, results, cleanupVerified: true, scope: 'Fresh Node process per API profile; RSS includes routers, HTTP client and fixture oracle, excludes DB/browser. Real browser, 1440/390px. Synthetic history does not certify generation or physical devices. Existing temporal contracts are distinct; no calendar-policy change.' }, null, 2) + '\n');
  completed = true; console.log('PASS agenda volume: 25/100/400 pools, 16 technicians, two-year history, exact rolling/calendar/day/month IDs, recurrence, pagination, real UI, permissions, failures and cleanup');
}
(process.argv[2] === 'probe' ? child(...process.argv.slice(3)) : main()).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
