'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const now = new Date(), tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const tech = await prisma.technician.create({ data: { name: 'Complete route owner', active: true } });
  const other = await prisma.technician.create({ data: { name: 'Complete route other', active: true } });
  const client = await prisma.client.create({ data: { name: 'Complete route client', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Complete route pool', clientId: client.id, active: true } });
  const regularPool = await prisma.pool.create({ data: { name: 'Last regular beyond 300', clientId: client.id, active: true } });
  const extraPool = await prisma.pool.create({ data: { name: 'Last extra beyond 300', clientId: client.id, active: true } });
  const max = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const firstId = Math.max(...max.map(row => row._max.id || 0)) + 1, size = 305, lastId = firstId + size - 1;
  const common = i => ({ id: firstId + i, clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'PLANNED' });
  await prisma.serviceVisit.createMany({ data: Array.from({ length: size }, (_, i) => ({ ...common(i), plannedDate: now, date: now, ...(i === size - 1 ? { poolId: regularPool.id, status: 'DONE', endAt: now, notes: 'Last regular server note' } : {}) })) });
  await prisma.extraVisit.createMany({ data: Array.from({ length: size }, (_, i) => ({ ...common(i), scheduledAt: now, billingMode: 'NO_CHARGE', isBillable: false, ...(i === size - 1 ? { poolId: extraPool.id } : {}) })) });
  for (const model of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${model}"','id'), ${lastId}, true)`);
  const excluded = [];
  for (const change of [{ technicianId: other.id }, { plannedDate: tomorrow }, { status: 'CANCELLED' }]) excluded.push(await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, date: now, plannedDate: now, status: 'PLANNED', ...change } }));
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const call = async (endpoint, query = '') => {
    const response = await fetch(base + endpoint + '?date=' + day + query, { headers: { Authorization: 'Bearer ' + token } });
    return { status: response.status, data: await response.json() };
  };
  const identity = row => (row.visitType || 'REGULAR') + ':' + row.id;
  for (const [endpoint, total] of [['/api/technician/today', size * 2], ['/api/visits/today', size]]) {
    const full = await call(endpoint, '&technicianId=' + other.id);
    assert.equal(full.status, 200); assert.equal(full.data.total, total); assert.equal(full.data.returned, total); assert.equal(full.data.complete, true);
    assert.equal(full.data.nextOffset, null); assert.equal(full.data.hasMore, false); assert.equal(full.data.technicianId, tech.id);
    assert.equal(new Set(full.data.visits.map(identity)).size, total);
    assert(full.data.visits.some(row => row.id === lastId && (row.visitType || 'REGULAR') === 'REGULAR'));
    assert(!full.data.visits.some(row => excluded.some(excluded => excluded.id === row.id) && (row.visitType || 'REGULAR') === 'REGULAR'));
    const pages = []; let offset = 0;
    do {
      const result = await call(endpoint, '&limit=300&offset=' + offset);
      assert.equal(result.status, 200); assert.equal(result.data.complete, false); assert.equal(result.data.total, total); assert(result.data.returned <= 300);
      pages.push(...result.data.visits); offset = result.data.nextOffset;
    } while (offset !== null);
    assert.deepEqual(pages.map(identity), full.data.visits.map(identity));
    const empty = await call(endpoint, '&limit=300&offset=' + total);
    assert.deepEqual(empty.data.visits, []); assert.equal(empty.data.total, total); assert.equal(empty.data.complete, false); assert.equal(empty.data.nextOffset, null);
    for (const query of ['&limit=1.5', '&limit=0', '&limit=bad', '&limit=2&offset=-1', '&offset=2']) assert.equal((await call(endpoint, query)).status, 400, endpoint + query);
  }
  console.log('PASS 305 regular plus 305 extra, colliding IDs, complete counts, stable pages, invalid pagination, assigned scope and excluded future/cancelled visits');

  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech }) => {
    if (!localStorage.getItem('qaCompleteRoute')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('qaCompleteRoute', '1');
    }
    const interval = setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000].includes(delay) ? 0 : interval(callback, delay, ...args);
    window.alert = () => {};
  }, { token, tech });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  const open = path => page.goto(base + path, { waitUntil: 'networkidle' });
  const modernReady = () => page.waitForFunction(total => window.CWFieldDaySnapshot?.().visits.length === total, size * 2);
  await open('/technician-field-mode'); await modernReady();
  const modernKey = await page.evaluate(() => CWFieldRouteCache.key(CWFieldRouteCache.scope()));
  const modernRaw = await page.evaluate(key => localStorage.getItem(key), modernKey);
  assert.equal(JSON.parse(modernRaw).visits.length, size * 2);
  await page.locator('#poolSegments [data-pool-filter="DONE"]').evaluate(button => button.click());
  await page.locator('#visitList [data-visit-index]').filter({ hasText: regularPool.name }).evaluate(button => button.click());
  await page.locator('[data-field-tab-button="agora"]').click();
  assert.equal(await page.locator('#notes').inputValue(), 'Last regular server note');
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await modernReady();
  assert.equal(await page.locator('#notes').inputValue(), 'Last regular server note');
  const oldModern = JSON.stringify({ ...JSON.parse(modernRaw), v: 2, visits: JSON.parse(modernRaw).visits.slice(0, 200) });
  await page.evaluate(({ key, old }) => { localStorage.setItem(key.replace(':v3:', ':v2:'), old); localStorage.removeItem(key); }, { key: modernKey, old: oldModern });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('fieldLoadErrorText')?.textContent.includes('incompleta'));
  assert.equal(await page.locator('#visitList [data-visit-index]').count(), 0);
  assert.equal(await page.evaluate(key => localStorage.getItem(key.replace(':v3:', ':v2:')), modernKey), oldModern);
  await context.setOffline(false); await open('/technician-field-mode'); await modernReady();
  console.log('PASS last regular visit beyond 300 is editable and survives offline reload; potentially truncated v2 cache is preserved without claiming a complete route');

  const partial = async route => { const response = await route.fetch(), data = await response.json(); await route.fulfill({ response, json: { ...data, complete: false, visits: data.visits.slice(0, 1), returned: 1, hasMore: true } }); };
  const endpoint = '**/api/technician/today?*';
  await page.route(endpoint, partial);
  const beforePartial = await page.evaluate(key => localStorage.getItem(key), modernKey);
  await page.evaluate(() => document.getElementById('fieldReloadBtn').click());
  await page.waitForFunction(() => document.getElementById('fieldRouteAge')?.textContent.includes('Sem confirmação atual'));
  assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt), null);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), modernKey), beforePartial);
  await page.locator('[data-field-tab-button="hoje"]').click(); await page.locator('#dayReviewBtn').click();
  await page.waitForFunction(() => document.getElementById('dayReviewResult').textContent.includes('Ronda: não foi possível confirmar'));
  await page.unroute(endpoint);
  await open('/technician-map'); await page.waitForFunction(name => document.getElementById('visitList')?.textContent.includes(name), extraPool.name);
  await open('/technician-route'); await page.waitForFunction(() => document.getElementById('statusBox')?.textContent.includes('610 paragem'));
  await open('/technician-history'); await page.waitForFunction(() => document.getElementById('statusBox')?.textContent.includes('1 visita'));
  await page.route(endpoint, partial);
  for (const path of ['/technician-map', '/technician-route', '/technician-history']) {
    await open(path); await page.waitForFunction(() => document.getElementById('statusBox')?.dataset.tone === 'error');
  }
  await page.unroute(endpoint);
  console.log('PASS partial server list cannot replace full cache or confirm day review; route/map/history include last records and reject partial replies');

  await open('/technician'); await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('Rota atualizada'));
  const legacyKey = `cwLegacyRoute:v3:TECH:${tech.id}:${day}`;
  const legacyRaw = await page.evaluate(key => localStorage.getItem(key), legacyKey);
  assert.equal(JSON.parse(legacyRaw).visits.length, size);
  assert.match(await page.locator('#list').textContent(), /Last regular beyond 300/);
  await page.route('**/api/visits/today?*', partial);
  await page.evaluate(() => loadRoute());
  assert.match(await page.locator('#status').textContent(), /não foi possível confirmar a rota completa/i);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyKey), legacyRaw);
  await page.unroute('**/api/visits/today?*');
  const oldLegacy = JSON.stringify({ ...JSON.parse(legacyRaw), v: 2, visits: JSON.parse(legacyRaw).visits.slice(0, 200) });
  await page.evaluate(({ key, old }) => { localStorage.setItem(key.replace(':v3:', ':v2:'), old); localStorage.removeItem(key); }, { key: legacyKey, old: oldLegacy });
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('incompleta'));
  assert(!(await page.locator('#list').textContent()).includes(regularPool.name));
  assert.equal(await page.evaluate(key => localStorage.getItem(key.replace(':v3:', ':v2:')), legacyKey), oldLegacy);
  await context.setOffline(false); await open('/technician');
  await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('Rota atualizada'));
  assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), legacyKey)).visits.length, size);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS legacy list retains all 305, rejects partial replies, preserves v2 cache and acquires a separate full v3 snapshot online');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
