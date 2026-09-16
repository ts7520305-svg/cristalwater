'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let failureTable, browser;
async function clearFailure() {
  if (!failureTable) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_sheet_write_fail ON "' + failureTable + '"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_sheet_write_fail()'); failureTable = null;
}
async function inject(table, operation, type = '') {
  assert(['TechnicalSheet', 'PoolEquipment', 'TechnicalRoom', 'PoolCalculationProfile', 'TechnicalHistory', 'Notification'].includes(table));
  failureTable = table;
  await prisma.$executeRawUnsafe("CREATE FUNCTION qa_sheet_write_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA technical sheet mandatory failure'; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_sheet_write_fail BEFORE ' + operation + ' ON "' + table + '" FOR EACH ROW ' + (type ? "WHEN (NEW.type = '" + type + "') " : '') + 'EXECUTE FUNCTION qa_sheet_write_fail()');
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const technician = await prisma.technician.create({ data: { name: 'Technical sheet QA technician', active: true } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'Technical sheet owner', active: true, creditBalance: 29, contractActive: true, billingActive: true, password: 'Private technical owner password', pin: 'Private technical owner PIN' } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Original technical pool', type: 'POOL', monthlyAmount: 140, notes: 'General original', volumeM3: 48,
    technicalSheet: { create: { volumeM3: 48, disinfectionType: 'SAL', specialObservations: 'Measured technical observation', targetPhMin: 7.1 } },
    equipment: { create: { notes: 'Equipment original', pumpType: 'Original pump' } }, technicalRoom: { create: { notes: 'Room original' } },
    calculationProfile: { create: { lengthM: 8, widthM: 4, averageDepthM: 1.5, volumeM3: 48, notes: 'Calculation original' } } } });
  const include = { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true };
  const row = () => prisma.pool.findUniqueOrThrow({ where: { id: pool.id }, include });
  const records = () => prisma.technicalHistory.findMany({ where: { poolId: pool.id }, orderBy: { id: 'asc' } });
  const notices = () => prisma.notification.findMany({ where: { type: 'TECHNICAL_SHEET_PROPAGATION', metadata: { path: ['poolId'], equals: pool.id } }, orderBy: { id: 'asc' } });
  const call = async (body, credential = token, target = pool.id) => {
    const response = await fetch(base + '/api/core/pools/' + target + '/technical-sheet', { method: 'PUT', headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json', 'x-user-email': 'FORGED HEADER' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const patch = { name: 'Changed technical pool', lengthM: '10', widthM: '4', averageDepthM: '1.5', pumpType: 'New pump', equipmentNotes: 'New equipment', technicalRoomNotes: 'New room', calculationNotes: 'New calculation', historyNote: 'Checked in QA', actor: 'FORGED BODY' };
  for (const [table, operation, type] of [
    ['TechnicalHistory', 'INSERT', 'TECHNICAL_SHEET_CHANGE'], ['TechnicalSheet', 'UPDATE'], ['PoolEquipment', 'UPDATE'], ['TechnicalRoom', 'UPDATE'], ['PoolCalculationProfile', 'UPDATE'],
    ['TechnicalHistory', 'INSERT', 'TECHNICAL_SHEET_NOTE'], ['TechnicalHistory', 'INSERT', 'TECHNICAL_SHEET_PROPAGATION_EVENT'], ['Notification', 'INSERT', 'TECHNICAL_SHEET_PROPAGATION'],
  ]) {
    const before = await row(), historyBefore = await records(), noticesBefore = await notices(); await inject(table, operation, type);
    try {
      const failed = await call(patch); assert.equal(failed.status, 500, JSON.stringify(failed)); assert(!JSON.stringify(failed.body).includes('QA technical sheet mandatory failure'));
      assert.deepEqual(await row(), before, table + ' must roll back every component'); assert.deepEqual(await records(), historyBefore); assert.deepEqual(await notices(), noticesBefore);
    } finally { await clearFailure(); }
  }
  console.log('PASS all technical components, mandatory history, note, propagation record and notification roll back together');

  const saved = await call(patch); assert.equal(saved.status, 200, JSON.stringify(saved)); assert.equal(saved.body.ok, true);
  let actual = await row(); assert.equal(actual.volumeM3, 60); assert.equal(actual.technicalSheet.volumeM3, 60); assert.equal(actual.calculationProfile.volumeM3, 60);
  assert.equal(actual.equipment.pumpType, 'New pump'); assert.equal(actual.technicalRoom.notes, 'New room'); assert.equal(actual.technicalSheet.specialObservations, 'Measured technical observation'); assert.equal(actual.technicalSheet.disinfectionType, 'SAL');
  assert.equal(actual.clientId, client.id); assert.equal(actual.monthlyAmount, 140); assert.equal(actual.notes, 'General original'); assert(!JSON.stringify(saved).includes('Private technical owner'));
  const history = await records(); assert.equal(history.length, 3); const change = JSON.parse(history.find(h => h.type === 'TECHNICAL_SHEET_CHANGE').description);
  assert.equal(change.actor, 'USER:' + admin.id); assert.equal(change.before.name, 'Original technical pool'); assert.equal(change.after.name, patch.name); assert(!JSON.stringify(history).includes('FORGED'));
  assert.equal((await notices()).length, 1); assert.equal(saved.body.propagation.persisted, true);
  assert.equal((await call({ lengthM: 12 })).status, 200); actual = await row(); assert.equal(actual.volumeM3, 72); assert.equal(actual.calculationProfile.lengthM, 12); assert.equal(actual.calculationProfile.widthM, 4);
  const beforeName = await row(); assert.equal((await call({ name: 'Only the name' })).status, 200); actual = await row(); for (const field of ['technicalSheet', 'equipment', 'technicalRoom', 'calculationProfile']) assert.deepEqual(actual[field], beforeName[field]);
  assert.equal((await call({ monthlyAmount: 0, saltSystem: 'false', equipmentNotes: '', technicalRoomNotes: '' })).status, 200); actual = await row(); assert.equal(actual.monthlyAmount, 0); assert.equal(actual.equipment.saltSystem, false); assert.equal(actual.equipment.notes, null); assert.equal(actual.technicalRoom.notes, null);
  const ownerAfter = await prisma.client.findUniqueOrThrow({ where: { id: client.id } }); assert.equal(ownerAfter.creditBalance, 29); assert.equal(ownerAfter.contractActive, true); assert.equal(ownerAfter.billingActive, true);
  console.log('PASS authenticated history, partial dimension calculation, omitted fields, zero values and distinct general/technical notes are preserved');

  const unchanged = await row(), historyCount = (await records()).length;
  for (const body of [{ name: '' }, { monthlyAmount: -1 }, { volumeM3: 'NaN' }, { lengthM: -2 }, { lightsCount: 1.5 }, { saltSystem: 'unexpected' }]) assert.equal((await call(body)).status, 400);
  assert.equal((await call({ name: 'Denied' }, '')).status, 401); assert.equal((await call({ name: 'Denied' }, jwt.sign({ id: technician.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }))).status, 403);
  assert.equal((await call({ name: 'Missing' }, token, 2147483647)).status, 404); assert.equal((await call({ name: 'Bad ID' }, token, 'bad')).status, 400);
  assert.deepEqual(await row(), unchanged); assert.equal((await records()).length, historyCount);
  const results = await Promise.all([call({ name: 'Concurrent name' }), call({ zone: 'Concurrent zone' })]); assert(results.every(r => r.status === 200), JSON.stringify(results));
  actual = await row(); assert.equal(actual.name, 'Concurrent name'); assert.equal(actual.zone, 'Concurrent zone');
  const latest = (await records()).filter(h => h.type === 'TECHNICAL_SHEET_CHANGE').slice(-2).map(h => JSON.parse(h.description)); assert.deepEqual(latest[1].before, latest[0].after);
  console.log('PASS invalid inputs, access, missing resources and concurrent disjoint edits with a consistent history chain');

  const state = await (await fetch(base + '/api/pools/' + pool.id + '/edit-state', { headers: { Authorization: 'Bearer ' + token } })).json();
  assert.equal((await call({ equipmentNotes: 'Changed through the technical route' })).status, 200);
  const stale = await fetch(base + '/api/pools/' + pool.id, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), expectedVersion: state.version, name: 'Obsolete general editor' }) });
  assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'POOL_VERSION_CONFLICT');
  const freshPool = await prisma.pool.create({ data: { name: 'Without technical records', clientId: client.id } });
  const freshRow = () => prisma.pool.findUniqueOrThrow({ where: { id: freshPool.id }, include });
  const beforeCreate = await freshRow(); await inject('Notification', 'INSERT', 'TECHNICAL_SHEET_PROPAGATION');
  try { assert.equal((await call(patch, token, freshPool.id)).status, 500); assert.deepEqual(await freshRow(), beforeCreate); assert.equal(await prisma.technicalHistory.count({ where: { poolId: freshPool.id } }), 0); } finally { await clearFailure(); }
  assert.equal((await call(patch, token, freshPool.id)).status, 200); const created = await freshRow(); assert.equal(created.technicalSheet.volumeM3, 60); assert.equal(created.calculationProfile.volumeM3, 60); assert.equal(created.equipment.pumpType, patch.pumpType);
  console.log('PASS technical writes invalidate the general editor version and new related rows roll back before a successful retry');

  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{"language":"pt"}' });
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token, id: admin.id });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(7000);
  await page.goto(base + '/admin-pool-technical?poolId=' + pool.id, { waitUntil: 'networkidle' }); await page.waitForFunction(() => !document.getElementById('name').disabled);
  const button = page.locator('#sheetForm button[type="submit"]'), submit = async () => { await (await page.locator('#sheetEditRetry').isVisible() ? page.locator('#sheetEditRetry') : button).click(); await page.waitForFunction(() => document.getElementById('sheetForm').getAttribute('aria-busy') === 'false'); };
  await page.locator('#notes').fill('General note from the actual form'); await page.locator('#historyNote').fill('Keep this note until confirmed');
  const beforeFailure = await row(), recordsBeforeFailure = await records(); await inject('Notification', 'INSERT', 'TECHNICAL_SHEET_PROPAGATION');
  try { await submit(); assert.match(await page.locator('#status').textContent(), /não confirmado/); assert.equal(await page.locator('#historyNote').inputValue(), 'Keep this note until confirmed'); assert.deepEqual(await row(), beforeFailure); assert.deepEqual(await records(), recordsBeforeFailure); } finally { await clearFailure(); }
  const endpoint = base + '/api/core/pools/' + pool.id + '/technical-sheet'; let unlock, calls = 0;
  const held = new Promise(resolve => { unlock = resolve; }); await page.route(endpoint, async route => { if (route.request().method() === 'PUT') { calls++; await held; } await route.continue(); });
  await page.locator('#sheetEditRetry').click(); await page.waitForFunction(() => document.getElementById('sheetForm').getAttribute('aria-busy') === 'true'); assert.equal(await button.isDisabled(), true); assert.equal(await page.locator('#notes').isDisabled(), true); await page.evaluate(() => saveSheet()); unlock(); await page.waitForFunction(() => document.getElementById('sheetForm').getAttribute('aria-busy') === 'false'); await page.unroute(endpoint);
  assert.equal(calls, 1); assert.match(await page.locator('#status').textContent(), /confirmada/); assert.equal(await page.locator('#historyNote').inputValue(), ''); assert.equal((await row()).notes, 'General note from the actual form');
  const confirmedCount = (await records()).length;
  for (const response of [{ status: 202, json: { ok: true } }, { status: 200, json: { ok: true } }, { status: 200, json: { ok: true, pool: { id: freshPool.id }, historyId: 1, propagation: { persisted: true } } }]) {
    if (await page.locator('#historyNote').isEnabled()) await page.locator('#historyNote').fill('Still not confirmed'); await page.route(endpoint, route => route.request().method() === 'PUT' ? route.fulfill(response) : route.continue()); await submit(); await page.unroute(endpoint);
    assert.match(await page.locator('#status').textContent(), /não confirmado/); assert.equal(await page.locator('#historyNote').inputValue(), 'Still not confirmed'); assert.equal((await records()).length, confirmedCount);
  }
  assert.deepEqual(errors, []);
  console.log('PASS real technical form preserves failed work, blocks duplicate submission and refuses intermediate or malformed confirmations');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await clearFailure(); await prisma.$disconnect(); });
