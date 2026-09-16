'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser, child, trigger = false; const releases = [];
async function start() { child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA startup timed out')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve('http://127.0.0.1:' + port); }); }); }
async function stop() { if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function clearTrigger() { if (!trigger) return; await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_gps_track_failure ON "TechnicianTrack"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_gps_track_failure()'); trigger = false; }
(async () => {
  const techs = []; for (const name of ['API', 'Browser', 'Other']) techs.push(await prisma.technician.create({ data: { name: 'GPS confirmation ' + name, active: true } }));
  const tokens = techs.map(tech => jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }));
  const point = (tech, time = Date.now()) => ({ pointId: randomUUID(), technicianId: tech.id, latitude: 37, longitude: -8, accuracy: 9, recordedAt: new Date(time).toISOString() });
  const call = async (body, host = base, drop = false, token = tokens[0]) => { const response = await fetch(host + '/api/gps/update', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  const tracks = tech => prisma.technicianTrack.count({ where: { technicianId: tech.id } });
  const verify = (result, body, outcome) => { assert.equal(result.status, 200); assert.deepEqual(result.body.acknowledgement, { ...body, scope: 'GPS_READING', owner: 'TECH:' + body.technicianId, outcome }); };
  let second = await start(); const first = point(techs[0]);
  const simultaneous = await Promise.all(Array.from({ length: 6 }, (_, i) => call(first, i % 2 ? second : base)));
  assert.equal(simultaneous.filter(r => r.body.acknowledgement.outcome === 'RECORDED').length, 1); assert.equal(await tracks(techs[0]), 1);
  for (const result of simultaneous) verify(result, first, result.body.ignored ? 'OLDER_LOCATION' : 'RECORDED');
  const lost = point(techs[0], Date.now() + 1000); await assert.rejects(call(lost, second, true)); await stop(); second = await start(); verify(await call(lost, second), lost, 'OLDER_LOCATION'); assert.equal(await tracks(techs[0]), 2);
  const stale = point(techs[0], Date.now() - 600000); verify(await call(stale), stale, 'STALE_LOCATION'); assert.equal(await tracks(techs[0]), 2);
  for (const bad of [{ pointId: 'bad' }, { accuracy: '9' }, { recordedAt: '' }, { extra: true }, { latitude: '37' }]) assert.equal((await call({ ...point(techs[0]), ...bad })).status, 400);
  assert.equal((await call(point(techs[2]))).status, 403);
  const before = await prisma.technicianLocation.findFirst({ where: { technicianId: techs[0].id } });
  trigger = true; await prisma.$executeRawUnsafe("CREATE FUNCTION qa_gps_track_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA GPS track write'; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_gps_track_failure BEFORE INSERT ON "TechnicianTrack" FOR EACH ROW EXECUTE FUNCTION qa_gps_track_failure()');
  try { assert.equal((await call(point(techs[0], Date.now() + 2000), second)).status, 503); assert.deepEqual(await prisma.technicianLocation.findFirst({ where: { technicianId: techs[0].id } }), before); assert.equal(await tracks(techs[0]), 2); } finally { await clearTrigger(); await stop(); }
  console.log('PASS exact GPS acknowledgements, two processes, lost response/restart, explicit old readings, ownership and location/history rollback');

  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    if (!localStorage.getItem('qaGpsSession')) { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'TECHNICIAN' })); localStorage.setItem('qaGpsSession', '1'); }
    window.qaGps = { current: [], watchers: [], cleared: [] };
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (success, error) => window.qaGps.current.push({ success, error }), watchPosition: (success, error) => (window.qaGps.watchers.push({ success, error }), window.qaGps.watchers.length), clearWatch: id => window.qaGps.cleared.push(id) } });
  }, { token: tokens[1], id: techs[1].id });
  const page = await context.newPage(), other = await context.newPage(), errors = [];
  for (const tab of [page, other]) { tab.setDefaultTimeout(10000); tab.on('pageerror', error => errors.push(error.message)); }
  const open = tab => tab.goto(base + '/technician-gps', { waitUntil: 'networkidle' });
  const stored = tab => tab.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('cwGpsPoint:v2:')).sort().map(k => [k, localStorage.getItem(k)]));
  const emit = (tab, time = Date.now()) => tab.evaluate(time => window.qaGps.current.at(-1).success({ coords: { latitude: 37, longitude: -8, accuracy: 9 }, timestamp: time }), time);
  const idle = tab => tab.waitForFunction(() => !document.getElementById('sendNowBtn').disabled && !document.getElementById('gpsRetryBtn').disabled);
  const endpoint = base + '/api/gps/update'; await open(page); await context.setOffline(true); await page.locator('#sendNowBtn').click(); await emit(page); await idle(page);
  const original = await stored(page); assert.equal(original.length, 1); assert.equal(await page.locator('#syncKpi').textContent(), 'Por confirmar'); assert.equal(await tracks(techs[1]), 0);
  await context.setOffline(false); let sent;
  await page.route(endpoint, async route => { sent = route.request().postDataJSON(); await route.fetch(); await route.fulfill({ status: 502, json: { error: 'QA lost response' } }); });
  await page.locator('#gpsRetryBtn').click(); await idle(page); await page.unroute(endpoint); assert.deepEqual(await stored(page), original); assert.equal(await tracks(techs[1]), 1);
  await open(page); assert.equal(await page.locator('#syncKpi').textContent(), 'Por confirmar');
  for (const bad of [() => ({ status: 202, json: { ok: true, success: true } }), () => ({ status: 200, json: { ok: true } }), data => ({ status: 200, json: { ...data, acknowledgement: { ...data.acknowledgement, latitude: 1 } } }), data => ({ status: 200, json: { ...data, acknowledgement: { ...data.acknowledgement, owner: 'TECH:999999' } } })]) {
    await page.route(endpoint, async route => { assert.deepEqual(route.request().postDataJSON(), sent); const response = await route.fetch(); await route.fulfill(bad(await response.json())); });
    await page.locator('#gpsRetryBtn').click(); await idle(page); await page.unroute(endpoint); assert.deepEqual(await stored(page), original); assert.equal(await tracks(techs[1]), 1);
  }
  await page.locator('#gpsRetryBtn').click(); await idle(page); assert.equal((await stored(page)).length, 0); assert.equal(await tracks(techs[1]), 1); assert.equal(await page.locator('#syncKpi').textContent(), 'A atualizar');
  console.log('PASS actual GPS screen: offline persistence, lost response, reload, incomplete/wrong acknowledgements and one history point');

  await open(other); let release, entered; const gate = new Promise(resolve => { release = resolve; releases.push(resolve); }), started = new Promise(resolve => { entered = resolve; });
  await page.route(endpoint, async route => { const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }); });
  await page.locator('#sendNowBtn').click(); await emit(page, Date.now() + 1000); await started;
  await other.locator('#sendNowBtn').click(); await emit(other, Date.now() + 2000); await idle(other); assert.equal((await stored(other)).length, 2); assert.equal(await page.locator('#sendNowBtn').isDisabled(), true);
  release(); await idle(page); await page.unroute(endpoint); assert.equal((await stored(page)).length, 1); await other.locator('#gpsRetryBtn').click(); await idle(other); assert.equal((await stored(page)).length, 0); assert.equal(await tracks(techs[1]), 3);
  await page.locator('#startBtn').click(); assert.equal(await page.locator('#startBtn').isDisabled(), true);
  await page.evaluate(() => { window.CWGps.stop(); window.qaGps.watchers[0].success({ coords: { latitude: 38, longitude: -9, accuracy: 10 }, timestamp: Date.now() }); }); assert.equal((await stored(page)).length, 0); assert.equal(await tracks(techs[1]), 3);
  console.log('PASS two real tabs preserve points captured during a send and serialize delivery; stopped watcher callbacks cannot capture again');

  await page.locator('#sendNowBtn').click(); await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); }); await emit(page, Date.now() + 2000);
  assert.equal(await page.locator('#startBtn').isDisabled(), false); assert.equal(await page.locator('#sendNowBtn').isDisabled(), false); assert.equal((await stored(page)).length, 0); assert.equal(await tracks(techs[1]), 3);

  await open(page); await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwGpsPoint:v2:')) throw Error('QA quota'); return window.qaSetItem.call(this, key, value); }; });
  await page.locator('#sendNowBtn').click(); await emit(page); await idle(page); assert.equal((await stored(page)).length, 0); assert.equal(await tracks(techs[1]), 3); await page.evaluate(() => { Storage.prototype.setItem = window.qaSetItem; });
  let releaseLate, enteredLate; const lateGate = new Promise(resolve => { releaseLate = resolve; releases.push(resolve); }), lateStarted = new Promise(resolve => { enteredLate = resolve; });
  await page.route(endpoint, async route => { const response = await route.fetch(); enteredLate(); await lateGate; await route.fulfill({ response }).catch(() => {}); });
  await page.locator('#sendNowBtn').click(); await emit(page, Date.now() + 3000); await lateStarted; const oldQueue = await stored(page);
  const account = (token, id) => page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'TECHNICIAN' })); }, { token, id });
  await account(tokens[2], techs[2].id); await page.waitForFunction(() => document.getElementById('syncKpi').textContent === 'Sessão alterada'); releaseLate(); await page.unroute(endpoint);
  assert.deepEqual(await stored(page), oldQueue); assert.equal(await page.locator('#accuracyKpi').textContent(), '—'); await open(page); assert.equal(await page.locator('#syncKpi').textContent(), 'Em espera'); assert.equal(await tracks(techs[2]), 0);
  await account(tokens[1], techs[1].id); await open(page); await page.locator('#gpsRetryBtn').click(); await idle(page); assert.equal((await stored(page)).length, 0); assert.equal(await tracks(techs[1]), 4);
  console.log('PASS storage failure sends nothing; late replies cannot clear another account’s queue; the original account recovers without duplicate history');

  await page.evaluate(() => { saveOfflineGps({ latitude: 37, longitude: -8, accuracy: 9, recordedAt: new Date().toISOString() }); const key = Object.keys(localStorage).find(k => k.startsWith('cwGpsPoint:v2:')), item = JSON.parse(localStorage.getItem(key)); item.technicianId = 999999; localStorage.setItem(key, JSON.stringify(item)); localStorage.setItem('cristalwater_offline_gps', '[{"userId":1}]'); });
  const corrupt = await stored(page); await open(page); await page.locator('#gpsRetryBtn').click(); await idle(page); assert.deepEqual(await stored(page), corrupt); assert.equal(await tracks(techs[1]), 4); assert.match(await page.locator('#gpsStatus').textContent(), /inválido/);
  await page.goto(base + '/technician.html', { waitUntil: 'networkidle' }); await page.waitForFunction(() => document.getElementById('offlineNetwork').textContent.includes('GPS por rever')); assert.deepEqual(await stored(page), corrupt); assert(!String(await page.locator('#offlineNetwork').textContent()).includes('Sincronizado')); assert.equal(await page.evaluate(() => localStorage.getItem('cristalwater_offline_gps')), '[{"userId":1}]');
  assert.deepEqual(errors, []); console.log('PASS corrupt points and unattributed legacy data remain intact; the actual old page stays usable and cannot claim complete synchronization');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const release of releases) release(); await browser?.close(); await clearTrigger(); await stop(); await prisma.$disconnect(); });
