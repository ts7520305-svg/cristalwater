'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;

(async () => {
  const suffix = randomUUID();
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const tech = await prisma.technician.create({ data: { name: 'Keys technician', active: true, email: `keys-${suffix}@qa.test` } });
  const leader = await prisma.technician.create({ data: { name: 'Keys leader', active: true, role: 'TEAM_LEADER' } });
  const user = await prisma.user.create({ data: { email: tech.email, name: 'Linked keys account', role: 'TECHNICIAN', active: true, password: 'qa-no-login' } });
  const first = await prisma.client.create({ data: { name: 'Assigned key client', active: true } });
  const other = await prisma.client.create({ data: { name: 'Other key client', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Assigned key pool', clientId: first.id, active: true } });
  const otherPool = await prisma.pool.create({ data: { name: 'Other key pool', clientId: other.id, active: true } });
  const sharedCode = `SHARED-${suffix}`, hiddenCode = `HIDDEN-${suffix}`, clientCode = `CLIENT-${suffix}`;
  await prisma.keyAccess.create({ data: { keyCode: sharedCode, requiredForVisit: true, visibleToTechnician: true, active: true, pools: { connect: [{ id: pool.id }, { id: otherPool.id }] } } });
  await prisma.keyAccess.create({ data: { keyCode: hiddenCode, requiredForVisit: true, visibleToTechnician: false, active: true, pools: { connect: { id: pool.id } } } });
  await prisma.keyAccess.create({ data: { keyCode: `OPTIONAL-${suffix}`, requiredForVisit: false, visibleToTechnician: true, active: true, pools: { connect: { id: pool.id } } } });
  await prisma.keyAccess.create({ data: { keyCode: `ARCHIVED-${suffix}`, requiredForVisit: true, visibleToTechnician: true, active: false, pools: { connect: { id: pool.id } } } });
  for (const client of [first, other]) await prisma.clientAccess.create({ data: { clientId: client.id, accessType: 'KEY', codeValue: clientCode, visibleToTechnician: true, active: true } });
  const date = '2032-02-29', at = time => new Date(`${date}T${time}:00`);
  const maximum = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const sharedId = Math.max(...maximum.map(row => row._max.id || 0)) + 1;
  const regular = await prisma.serviceVisit.create({ data: { id: sharedId, poolId: pool.id, clientId: first.id, technicianId: tech.id, status: 'PLANNED', plannedDate: at('00:00') } });
  const extra = await prisma.extraVisit.create({ data: { id: sharedId, poolId: pool.id, clientId: first.id, technicianId: tech.id, status: 'PLANNED', scheduledAt: at('23:59') } });
  for (const name of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${name}"','id'), ${sharedId}, true)`);
  const leaderVisit = await prisma.serviceVisit.create({ data: { poolId: otherPool.id, clientId: other.id, technicianId: leader.id, status: 'PLANNED', plannedDate: at('10:00') } });
  const excluded = [];
  excluded.push(await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: first.id, technicianId: tech.id, status: 'PLANNED', plannedDate: new Date('2032-03-01T10:00:00'), date: at('10:00') } }));
  for (const status of ['DONE', 'CONCLUIDA', 'SKIPPED', 'CANCELADA', 'ARCHIVED']) excluded.push(await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: first.id, technicianId: tech.id, status, plannedDate: at('10:00') } }));
  const sign = body => jwt.sign(body, getJwtSecret(), { expiresIn: '1h' });
  const adminToken = sign({ id: admin.id, role: 'ADMIN' }), techToken = sign({ id: tech.id, role: 'TECHNICIAN' }), leaderToken = sign({ id: leader.id, role: 'TEAM_LEADER' });
  const userToken = sign({ id: user.id, userId: user.id, technicianId: tech.id, principalType: 'USER', role: 'TECHNICIAN' }), clientToken = sign({ id: first.id, role: 'CLIENT' });
  async function get(path, token) {
    const response = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  }
  const morning = `/api/keys/required/morning?date=${date}`;
  assert.equal((await get(morning)).status, 401);
  assert.equal((await get(morning, clientToken)).status, 403);
  for (const token of [techToken, userToken]) {
    const result = await get(morning, token);
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.cache, 'private, no-store');
    assert.equal(result.body.date, date);
    assert.equal(result.body.technicianId, tech.id);
    assert.equal(result.body.count, 4, 'Both same-ID visit types must retain their two required keys');
    assert.deepEqual(new Set(result.body.keys.map(key => key.visitType)), new Set(['REGULAR', 'EXTRA']));
    assert(result.body.keys.every(key => key.technicianId === tech.id && key.poolId === pool.id && key.visitId === sharedId));
    assert(!JSON.stringify(result.body).includes(hiddenCode));
    assert.equal((await get(morning + `&technicianId=${leader.id}`, token)).status, 403);
  }
  const leadership = await get(morning, leaderToken);
  assert.equal(leadership.body.count, 2); assert(leadership.body.keys.every(key => key.visitId === leaderVisit.id && key.technicianId === leader.id));
  const management = await get(morning, adminToken);
  assert(management.body.keys.some(key => key.technicianId === tech.id)); assert(management.body.keys.some(key => key.technicianId === leader.id));
  assert(!(management.body.keys || []).some(key => key.visitType === 'REGULAR' && excluded.some(visit => visit.id === key.visitId)));
  for (const query of ['date=2031-02-29', 'date=2032-02-30', 'date=bad', 'date=', 'date[x]=2032-02-29', 'date=2032-02-29&date=2032-03-01', `date=${date}&technicianId=0`, `date=${date}&technicianId=abc`]) assert.equal((await get('/api/keys/required/morning?' + query, adminToken)).status, 400, query);
  const holder = code => '/api/keys/holder/' + encodeURIComponent(code);
  for (const token of [techToken, userToken]) {
    const result = await get(holder(sharedCode), token);
    assert.equal(result.status, 200); assert.equal(result.cache, 'private, no-store');
    assert.equal(result.body.holders.length, 1); assert.deepEqual(result.body.holders[0].pools.map(row => row.id), [pool.id]);
    assert(!JSON.stringify(result.body).includes(other.name));
    assert.equal((await get(holder(hiddenCode), token)).body.holders.length, 0);
    assert.deepEqual((await get(holder(clientCode), token)).body.holders.map(row => row.clientId), [first.id]);
  }
  assert.equal((await get(holder(hiddenCode), adminToken)).body.holders.length, 1);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token','cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' }));
  }, { token: adminToken, id: admin.id });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base + '/admin-keys', { waitUntil: 'networkidle' });
  await page.waitForFunction(id => !!document.querySelector(`#technicianId option[value="${id}"]`), tech.id);
  await page.locator('#technicianId').selectOption(String(tech.id)); await page.locator('#date').fill(date);
  await page.evaluate(() => loadMorningKeys());
  assert.equal(await page.locator('#morning .key-alert').count(), 4);
  assert.equal(await page.locator('#morning a[href="/admin-rounds"]').count(), 2);
  for (const width of [320,390,1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Keys page overflow at ' + width);
  }
  require('node:fs').mkdirSync('reports/field-ui', { recursive: true });
  await page.locator('#morning').locator('..').screenshot({ path: 'reports/field-ui/KEYS_MORNING.png' });
  let release, arrived;
  const held = new Promise(resolve => { release = resolve; }), waiting = new Promise(resolve => { arrived = resolve; });
  await page.route('**/api/keys/required/morning?**', async route => {
    const response = await route.fetch();
    if (new URL(route.request().url()).searchParams.get('date') === date) { arrived(); await held; }
    await route.fulfill({ response });
  });
  await page.evaluate(() => { window.qaOlderKeys = loadMorningKeys(); }); await waiting;
  await page.locator('#date').fill('2032-03-01'); await page.evaluate(() => loadMorningKeys());
  const currentText = await page.locator('#morning').textContent();
  assert(currentText.includes('2032-03-01')); release(); await page.evaluate(() => window.qaOlderKeys);
  assert.equal(await page.locator('#morning').textContent(), currentText, 'Older response must not replace the selected day');
  await page.unroute('**/api/keys/required/morning?**');
  await page.route('**/api/keys/required/morning?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'QA unavailable' }) }));
  await page.evaluate(() => loadMorningKeys());
  assert.equal(await page.locator('#morning .key-alert').count(), 0); assert((await page.locator('#morning').textContent()).includes('Não foi possível'));
  await page.unroute('**/api/keys/required/morning?**');
  await page.locator('#date').fill(date); await page.evaluate(() => loadMorningKeys());
  assert.equal(await page.locator('#morning .key-alert').count(), 4);
  await page.evaluate(() => { localStorage.setItem('token', 'different-session'); window.dispatchEvent(new StorageEvent('storage', { key: 'token' })); });
  assert.equal(await page.locator('#morning .key-alert').count(), 0); assert(!((await page.locator('#morning').textContent()).includes('SHARED-')));
  assert.deepEqual(pageErrors, []); await context.close();
  console.log('PASS morning UI preserves the selected day against delayed replies, clears stale keys on failure/session change and renders both visit types at 320/390/1440 px');
  await prisma.serviceVisit.updateMany({ where: { technicianId: tech.id }, data: { technicianId: leader.id } });
  await prisma.extraVisit.update({ where: { id: extra.id }, data: { technicianId: leader.id } });
  assert.equal((await get(morning, techToken)).body.count, 0);
  assert.equal((await get(holder(sharedCode), techToken)).body.holders.length, 0);
  assert.equal((await get(holder(clientCode), techToken)).body.holders.length, 0);
  await prisma.serviceVisit.createMany({ data: Array.from({ length: 1001 }, () => ({ poolId: pool.id, clientId: first.id, technicianId: tech.id, status: 'PLANNED', plannedDate: new Date('2032-03-03T10:00:00') })) });
  const volume = await get('/api/keys/required/morning?date=2032-03-03', techToken);
  assert.equal(volume.status, 200); assert.equal(volume.body.count, 2002, 'The complete checklist must not silently truncate at 1000 visits');
  console.log('PASS local leap-day boundaries, regular/extra ID collisions, required key filters, tech/user/leader isolation, private reads and immediate reassignment');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
