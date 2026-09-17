'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const stamp = Date.now(), email = `leader-${stamp}@qa.test`, password = `QA-${stamp}-password`;
  const vehicle = await prisma.vehicle.create({ data: { plate: 'LEADER-' + stamp, active: true } });
  const leader = await prisma.technician.create({ data: { name: 'QA chefe de equipa', email, pin: String(stamp), role: 'TEAM_LEADER', vehicleId: vehicle.id, active: true } });
  const other = await prisma.technician.create({ data: { name: 'QA outro técnico', pin: String(stamp + 1), active: true } });
  const user = await prisma.user.create({ data: { name: leader.name, email, password: await bcrypt.hash(password, 10), role: 'TEAM_LEADER', active: true } });
  const client = await prisma.client.create({ data: { name: 'QA cliente da equipa', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'QA ronda do chefe', clientId: client.id, active: true } });
  const foreignPool = await prisma.pool.create({ data: { name: 'QA ronda de outro técnico', clientId: client.id, active: true } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: leader.id, plannedDate: new Date(), date: new Date(), status: 'PLANNED' } });
  const foreign = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: foreignPool.id, technicianId: other.id, plannedDate: new Date(), date: new Date(), status: 'PLANNED' } });
  const extra = await prisma.extraVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: leader.id, scheduledAt: new Date(), status: 'PLANNED', billingMode: 'NO_CHARGE', isBillable: false } });
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'LEADER-' + stamp, status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: leader.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(Date.now() + 86400000 * 30) } });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Keep the entry test independent of optional external maps/fonts.
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const goto = async path => { await page.goto(base + path, { waitUntil: 'networkidle' }); };
  const token = () => page.evaluate(() => CristalAuth.getToken());
  const api = (path, credential) => fetch(base + path, { headers: { Authorization: 'Bearer ' + credential } });
  const pinLogin = async pin => {
    await goto('/technician-login');
    await page.locator('#pin').fill(pin);
    await page.locator('#loginBox button').click();
    await page.waitForURL('**/technician-field-mode');
    await page.waitForFunction(() => document.getElementById('fieldLoadError')?.hidden && document.querySelector('#visitList [data-visit-index]'));
  };
  const selectRegular = async () => {
    await page.locator('#poolSegments [data-pool-filter="TODO"]').evaluate(button => button.click());
    await page.locator('#visitList [data-visit-index]').first().evaluate(button => button.click());
    await page.locator('[data-field-tab-button="agora"]').click();
    await page.waitForFunction(() => document.getElementById('fieldSaveStatus')?.dataset.state !== 'saving');
  };
  const saved = () => page.waitForFunction(() => document.getElementById('fieldSaveStatus')?.dataset.state === 'saved');
  const pinKey = 'cwFieldVisitDrafts:v2:TECH:' + leader.id;
  const userKey = `cwFieldVisitDrafts:v2:USER:${user.id}:TECH:${leader.id}`;
  await pinLogin(leader.pin);
  const pinToken = await token();
  assert.equal(jwt.decode(pinToken).role, 'TEAM_LEADER');
  assert.equal(await page.evaluate(() => CWFieldWriteStore.session().owner), 'TECH:' + leader.id);
  await page.waitForFunction(() => document.getElementById('fieldDocsValue')?.textContent === 'Válidos');
  const routeResponse = await api('/api/technician/today?technicianId=' + other.id, pinToken);
  assert.equal(routeResponse.status, 200);
  const route = await routeResponse.json();
  assert.equal(route.technicianId, leader.id);
  assert.deepEqual(route.visits.map(row => row.visitType + ':' + row.id).sort(), ['REGULAR:' + visit.id, 'EXTRA:' + extra.id].sort());
  assert.equal((await api('/api/visits/' + visit.id, pinToken)).status, 200);
  assert.equal((await api('/api/visits/' + foreign.id, pinToken)).status, 403);
  assert.equal((await api('/api/users', pinToken)).status, 403);
  await selectRegular();
  await page.locator('#notes').fill('Rascunho da sessão PIN');
  await saved();
  const pinDraft = await page.evaluate(key => localStorage.getItem(key), pinKey);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await selectRegular();
  assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  assert(!(await page.locator('#visitList').textContent()).includes(foreignPool.name));
  await context.setOffline(false);
  console.log('PASS real TEAM_LEADER PIN login, assigned REGULAR/EXTRA route, forbidden foreign/admin resources and offline draft recovery');

  for (const path of ['/client-payments', '/settings', '/client-portal']) {
    await goto(path);
    await page.waitForURL('**/technician-field-mode');
    await page.waitForFunction(() => document.getElementById('fieldLoadError')?.hidden && document.querySelector('#visitList [data-visit-index]'));
    assert.equal(await token(), pinToken, 'Wrong portal must keep the valid field session: ' + path);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), pinKey), pinDraft, 'Wrong portal must preserve the exact pending draft: ' + path);
    await selectRegular();
    assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  }
  console.log('PASS real client payment/settings/portal entry returns TEAM_LEADER to field with session and saved draft intact');

  for (const [path, selector, expected] of [
    ['/technician', '#status', 'Rota atualizada'],
    ['/technician-visit?visit=' + visit.id, '#statusBox', 'Ficha da visita pronta'],
    ['/technician-route', '#statusBox', 'Rota carregada com 2'],
    ['/technician-map', '#infoBox', pool.name],
    ['/technician-guide', '#statusBox', 'Modulo pronto'],
    ['/technician-history', '#statusBox', 'Sem visitas concluidas'],
    ['/technician-profile', '#profileGrid', 'TEAM_LEADER'],
    ['/technician-gps', '#gpsStatus', 'Pronto para iniciar GPS'],
  ]) {
    await goto(path);
    await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.textContent.includes(expected), { selector, expected });
    assert.equal(await token(), pinToken, path + ' must keep the authenticated session');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).visibility), 'visible', path);
  }
  console.log('PASS leader entry into modern/legacy field, visit, route, map, guide, history, profile and GPS without logout');

  await goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#loginBtn').click();
  await page.waitForURL('**/technician');
  await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('Rota atualizada'));
  const userToken = await token();
  assert.equal(jwt.decode(userToken).principalType, 'USER');
  assert.equal(jwt.decode(userToken).technicianId, leader.id);
  await goto('/technician-field-mode');
  await selectRegular();
  assert.equal(await page.evaluate(() => CWFieldWriteStore.session().owner), `USER:${user.id}:TECH:${leader.id}`);
  assert.equal(await page.locator('#notes').inputValue(), '', 'PIN draft must not become a USER draft');
  await page.locator('#notes').fill('Rascunho da sessão email');
  await saved();
  const userDraft = await page.evaluate(key => localStorage.getItem(key), userKey);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pinKey), pinDraft);
  await page.locator('#fieldLogoutBtn').click();
  await page.waitForURL('**/login');
  assert.equal(await page.evaluate(() => CristalAuth.getToken()), '');
  assert.deepEqual(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [pinKey, userKey]), [pinDraft, userDraft]);
  await pinLogin(leader.pin);
  await selectRegular();
  assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  console.log('PASS real email login binds USER to technician, isolates PIN/USER drafts, and logout/relogin preserves both');

  await prisma.technician.update({ where: { id: leader.id }, data: { role: 'TECHNICIAN' } });
  assert.equal((await api('/api/technician/today', pinToken)).status, 401);
  await page.evaluate(() => document.getElementById('fieldReloadBtn').click());
  await page.waitForFunction(() => !document.getElementById('fieldLoadError')?.hidden);
  assert.equal(await page.locator('#visitList [data-visit-index]').count(), 0, 'Revoked role must not reuse cached active route');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pinKey), pinDraft);
  assert(await page.locator('#notes').isDisabled());
  assert.equal(await page.locator('#notes').inputValue(), '');
  await prisma.technician.update({ where: { id: leader.id }, data: { role: 'TEAM_LEADER' } });
  await pinLogin(leader.pin);
  await selectRegular();
  assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  await pinLogin(other.pin);
  assert.equal(jwt.decode(await token()).role, 'TECHNICIAN');
  assert.match(await page.locator('#visitList').textContent(), /QA ronda de outro técnico/);
  assert.equal(await page.evaluate(() => CWFieldWriteStore.session().owner), 'TECH:' + other.id);
  assert.equal(errors.length, 0, errors.join('\n'));
  await context.close();
  console.log('PASS revoked TEAM_LEADER loses active route without losing draft; ordinary TECHNICIAN entry remains functional');

  for (const [claimRole, localRole, expiresIn, destination] of [
    ['CLIENT', 'CLIENT', '1h', '/client-portal'],
    ['ADMIN', 'ADMIN', '1h', '/admin-master-control'],
    ['CLIENT', 'TEAM_LEADER', '1h', '/client-portal'],
    ['TEAM_LEADER', 'CLIENT', '1h', '/technician-login'],
    ['TEAM_LEADER', 'TEAM_LEADER', '-1s', '/technician-login'],
    ['UNKNOWN', 'UNKNOWN', '1h', '/technician-login'],
  ]) {
    const isolated = await browser.newContext();
    const credential = jwt.sign({ id: leader.id, role: claimRole }, getJwtSecret(), { expiresIn });
    await isolated.addInitScript(({ credential, localRole, id }) => {
      if (localStorage.getItem('qaGuardInitialized')) return;
      localStorage.setItem('qaGuardInitialized', '1');
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, credential);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: localRole }));
      localStorage.setItem('cwFieldVisitDrafts:guard-fixture', 'preserved');
    }, { credential, localRole, id: leader.id });
    const guarded = await isolated.newPage();
    await guarded.route(base + destination + '**', route => route.fulfill({ contentType: 'text/html', body: '<p>Guard destination</p>' }));
    await guarded.goto(base + '/technician-field-mode');
    await guarded.waitForURL(url => url.pathname === destination);
    assert.equal(await guarded.evaluate(() => localStorage.getItem('cwFieldVisitDrafts:guard-fixture')), 'preserved');
    await isolated.close();
  }
  console.log('PASS client/admin redirect, mismatched token role, expired/unknown session and preserved local records');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
