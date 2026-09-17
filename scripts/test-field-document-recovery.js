'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser; const releases = [];
(async () => {
  const vehicle = await prisma.vehicle.create({ data: { plate: 'DOCS-' + Date.now(), active: true } });
  const foreignVehicle = await prisma.vehicle.create({ data: { plate: 'FOREIGN-DOCS-' + Date.now(), active: true } });
  const privatePin = 'DOCS-PRIVATE-PIN-' + Date.now();
  const tech = await prisma.technician.create({ data: { name: 'Document owner', pin: privatePin, vehicleId: vehicle.id, active: true } });
  const other = await prisma.technician.create({ data: { name: 'Other document owner', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Document recovery client', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Document recovery pool', clientId: client.id, active: true } });
  for (const person of [tech, other]) await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: person.id, plannedDate: new Date(), date: new Date(), status: 'PLANNED' } });
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'DOCS-AT-' + Date.now(), status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  const work = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  await prisma.transportGuideItem.create({ data: { guideId: guide.id, name: 'Document chlorine', type: 'CHEMICAL', unit: 'KG', quantity: 10 } });
  const stock = await prisma.workGuideItem.create({ data: { workGuideId: work.id, name: 'Document chlorine', type: 'CHEMICAL', unit: 'KG', initialQty: 10, quantity: 10 } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(Date.now() + 86400000 * 30) } });
  const sign = person => jwt.sign({ id: person.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), token = sign(tech), otherToken = sign(other);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech, vehicleId }) => {
    if (!localStorage.getItem('qaDocumentSession')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('cw:tech-field:docs-cache:v1:' + vehicleId, '{"private":"UNATTRIBUTED DOCUMENT"}');
      localStorage.setItem('qaDocumentSession', '1');
    }
    const interval = setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000].includes(delay) ? 0 : interval(callback, delay, ...args);
  }, { token, tech, vehicleId: vehicle.id });
  const page = await context.newPage(), errors = [], visitWrites = []; page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/operational-state\/visits\/\d+\/state/.test(request.url())) visitWrites.push(request.url()); });
  const open = async () => { await page.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' }); };
  const ready = () => page.waitForFunction(() => document.getElementById('fieldDocsValue')?.textContent === 'Válidos');
  const refresh = async () => { await page.evaluate(() => document.getElementById('loadGuidesBtn').click()); await page.waitForFunction(() => document.getElementById('fieldDocsValue')?.textContent !== 'A validar'); };
  const keyFor = async () => page.evaluate(id => CWFieldDocuments.key(CWFieldDocuments.scope(CWFieldWriteStore.session(), id)), vehicle.id);
  const raw = key => page.evaluate(key => localStorage.getItem(key), key);
  await open(); await ready(); const key = await keyFor(), original = await raw(key), saved = JSON.parse(original);
  assert.equal(Object.keys(saved.sections).length, 3); assert(!original.includes(token)); assert(!original.includes(privatePin)); assert.match(await page.locator('#documentCenterBox').textContent(), /Fonte: online/);
  const directStock = await fetch(base + '/api/guides/stock/' + vehicle.id, { headers: { Authorization: 'Bearer ' + token } }).then(response => response.json());
  assert(!Object.hasOwn(directStock.workGuide.technician, 'pin')); assert(!JSON.stringify(directStock).includes(privatePin));
  const controller = require('../src/controllers/guideController');
  for (const [model, method, handler, params] of [
    ['systemSetting', 'findMany', 'getLatestTransportGuide', { vehicleId: String(vehicle.id) }],
    ['systemSetting', 'findUnique', 'getVehicleStock', { vehicleId: String(vehicle.id) }],
    ['vehicleStockMovement', 'findMany', 'getVehicleStock', { vehicleId: String(vehicle.id) }],
    ['vehicleStockMovement', 'findMany', 'downloadWorkGuidePdf', { id: String(work.id) }],
    ['vehicle', 'findUnique', 'getVehicleInsurance', { id: String(vehicle.id) }],
  ]) {
    const previous = prisma[model][method], result = { status: 200 };
    try {
      prisma[model][method] = async () => { throw Error('QA document query failure'); };
      await controller[handler]({ params, query: { technicianId: String(tech.id) }, headers: {} }, { status(code) { result.status = code; return this; }, json(payload) { result.payload = payload; } });
      assert.equal(result.status, 500, handler + ':' + model); assert.equal(result.payload.ok, false);
    } finally { prisma[model][method] = previous; }
  }
  const documentKey = 'transport_guide_at_document_' + guide.id;
  await prisma.systemSetting.upsert({ where: { key: documentKey }, create: { key: documentKey, value: '{broken' }, update: { value: '{broken' } });
  const corruptDocument = await fetch(base + '/api/guides/transport/latest/' + vehicle.id, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(corruptDocument.status, 500); assert.equal((await corruptDocument.json()).ok, false);
  await prisma.systemSetting.delete({ where: { key: documentKey } });
  console.log('PASS guide responses omit related credentials; failed document/stock/vehicle reads and corrupt official-document metadata cannot claim an empty successful response');
  assert.equal(await page.evaluate(id => localStorage.getItem('cw:tech-field:docs-cache:v1:' + id), vehicle.id), '{"private":"UNATTRIBUTED DOCUMENT"}');
  const workEndpoint = '**/api/guides/stock/' + vehicle.id + '?*', insuranceEndpoint = '**/api/guides/vehicles/' + vehicle.id + '/insurance';
  await page.route(workEndpoint, route => route.fulfill({ status: 503, json: { ok: false } }));
  await prisma.workGuideItem.update({ where: { id: stock.id }, data: { quantity: 7, usedQty: 3 } });
  await refresh(); assert.match(await page.locator('#documentCenterBox').textContent(), /Fonte: parcial/);
  const mixed = JSON.parse(await raw(key)); assert.equal(mixed.sections.work.confirmedAt, saved.sections.work.confirmedAt); assert.equal(mixed.sections.work.data.stock[0].quantity, 10);
  assert.match(await page.locator('#fieldDocsMeta').textContent(), /Cópia de hoje por confirmar/);
  await page.unroute(workEndpoint); await refresh(); await ready(); assert.equal(JSON.parse(await raw(key)).sections.work.data.stock[0].quantity, 7);
  console.log('PASS real documents grouped by typed account/role/vehicle/day; legacy bytes preserved; mixed refresh keeps original section timestamp and current source honest');

  const beforeQuota = await raw(key);
  await page.evaluate(() => { window.qaSet = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwFieldDocuments:')) throw new DOMException('QA quota', 'QuotaExceededError'); return qaSet.call(this, key, value); }; });
  await prisma.workGuideItem.update({ where: { id: stock.id }, data: { quantity: 6, usedQty: 4 } }); await refresh();
  assert.match(await page.locator('#documentCenterBox').textContent(), /não ficaram guardados/); assert.equal(await raw(key), beforeQuota);
  await page.evaluate(() => { Storage.prototype.setItem = qaSet; }); await refresh();
  const beforeNoop = await raw(key);
  await page.evaluate(() => { Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwFieldDocuments:')) return; return qaSet.call(this, key, value); }; });
  await prisma.workGuideItem.update({ where: { id: stock.id }, data: { quantity: 5, usedQty: 5 } }); await refresh();
  assert.match(await page.locator('#documentCenterBox').textContent(), /confirmar a gravação/); assert.equal(await raw(key), beforeNoop);
  await page.evaluate(() => { Storage.prototype.setItem = qaSet; }); await refresh();
  const beforeCorrupt = await raw(key); await page.evaluate(key => localStorage.setItem(key, '{damaged'), key); await refresh();
  assert.match(await page.locator('#documentCenterBox').textContent(), /ilegíveis/); assert.equal(await raw(key), '{damaged');
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw: beforeCorrupt });
  await page.route(insuranceEndpoint, async route => { const response = await route.fetch(), data = await response.json(); await route.fulfill({ response, json: { ...data, vehicle: { ...data.vehicle, id: foreignVehicle.id, plate: foreignVehicle.plate } } }); });
  await refresh(); assert(!String(await raw(key)).includes(foreignVehicle.plate)); assert(!(await page.locator('#documentCenterBox').textContent()).includes(foreignVehicle.plate)); assert.match(await page.locator('#documentCenterBox').textContent(), /Fonte: parcial/);
  await page.unroute(insuranceEndpoint);
  console.log('PASS quota, missing readback, corrupt cache and wrong vehicle do not overwrite saved bytes or claim offline persistence');

  let release, entered; const gate = new Promise(resolve => { release = resolve; releases.push(resolve); }), started = new Promise(resolve => { entered = resolve; }); let first = true;
  await page.route(workEndpoint, async route => { if (!first) return route.continue(); first = false; const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }).catch(() => {}); });
  await page.evaluate(() => document.getElementById('loadGuidesBtn').click()); await started;
  await page.evaluate(() => document.getElementById('startBtn').click()); await page.locator('#cwFieldCheckinConfirm').click();
  await page.waitForSelector('#cwFieldCheckinOverlay', { state: 'hidden' }); assert.equal(visitWrites.length, 0);
  assert.equal((await prisma.serviceVisit.findFirst({ where: { technicianId: tech.id, poolId: pool.id } })).status, 'PLANNED');
  await prisma.workGuideItem.update({ where: { id: stock.id }, data: { quantity: 4, usedQty: 6 } }); await refresh();
  const newer = await raw(key); const oldFinished = page.waitForResponse(response => response.url().includes('/api/guides/stock/'));
  release(); await oldFinished; await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await raw(key), newer); assert.equal(JSON.parse(newer).sections.work.data.stock[0].quantity, 4);
  await page.unroute(workEndpoint);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  assert.match(await page.locator('#documentCenterBox').textContent(), /Fonte: cópia guardada/); assert.match(await page.locator('#documentCenterBox').textContent(), /PDFs precisam de ligação/);
  assert.equal(await raw(key), newer);
  await context.setOffline(false); await open(); await ready();
  await page.route(workEndpoint, route => route.fulfill({ status: 403, contentType: 'text/html', body: 'Forbidden' }));
  const beforeDenied = await raw(key); await refresh();
  assert.equal(await page.locator('#fieldDocsValue').textContent(), 'Rever'); assert.match(await page.locator('#documentCenterBox').textContent(), /Acesso aos documentos recusado/);
  assert.equal(await raw(key), beforeDenied);
  assert(!(await page.locator('#workGuideBox').textContent()).includes('Document chlorine'));
  await page.evaluate(() => document.getElementById('startBtn').click()); await page.locator('#cwFieldCheckinConfirm').click();
  await page.waitForSelector('#cwFieldCheckinOverlay', { state: 'hidden' }); assert.equal(visitWrites.length, 0);
  assert.equal((await prisma.serviceVisit.findFirst({ where: { technicianId: tech.id, poolId: pool.id } })).status, 'PLANNED');
  await page.unroute(workEndpoint); await refresh(); await ready();
  console.log('PASS late reply cannot replace newer documents; cold offline reload retains section provenance; even a non-JSON 403 blocks cached operational documents');

  await page.locator('[data-field-tab-button="docs"]').click();
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  await page.locator('#vehicleId').fill(String(foreignVehicle.id));
  assert.equal(await page.locator('#fieldDocsValue').textContent(), 'A validar'); assert(!(await page.locator('#workGuideBox').textContent()).includes('Document chlorine'));
  await refresh(); assert.match(await page.locator('#documentCenterBox').textContent(), /recusado/);
  await page.locator('#vehicleId').fill(String(vehicle.id)); await refresh(); await ready();
  const accountRaw = await raw(key);
  let accountRelease, accountEntered;
  const accountGate = new Promise(resolve => { accountRelease = resolve; releases.push(resolve); }), accountStarted = new Promise(resolve => { accountEntered = resolve; });
  await page.route(insuranceEndpoint, async route => { const response = await route.fetch(); accountEntered(); await accountGate; await route.fulfill({ response }).catch(() => {}); });
  await page.evaluate(() => document.getElementById('loadGuidesBtn').click()); await accountStarted;
  await page.evaluate(({ token, user }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { token: otherToken, user: { id: other.id, name: other.name, role: 'TECHNICIAN' } });
  await page.waitForSelector('#fieldRouteSessionChanged');
  const accountFinished = page.waitForResponse(response => response.url().includes('/insurance'));
  accountRelease(); await accountFinished; await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await raw(key), accountRaw); assert(!(await page.locator('main.field').isVisible()));
  await page.unroute(insuranceEndpoint);
  await page.route('**/api/guides/**', route => route.abort('failed'));
  await open(); await page.waitForFunction(() => document.getElementById('fieldDocsValue')?.textContent === 'Rever');
  const otherKey = await keyFor(); assert.notEqual(otherKey, key); assert.equal(await raw(otherKey), null); assert.equal(await raw(key), accountRaw);
  assert(!(await page.locator('#workGuideBox').textContent()).includes('Document chlorine'));
  await page.unroute('**/api/guides/**'); await refresh(); await ready();
  assert.equal(JSON.parse(await raw(otherKey)).owner, 'TECH:' + other.id, 'A shared vehicle guide is allowed only after this account receives its own server confirmation');
  const daySeparation = await page.evaluate(id => {
    const current = CWFieldDocuments.scope(CWFieldWriteStore.session(), id), original = CWFieldRouteCache.today;
    CWFieldRouteCache.today = () => '2099-01-01';
    try { const next = CWFieldDocuments.scope(CWFieldWriteStore.session(), id); return { distinct: CWFieldDocuments.key(current) !== CWFieldDocuments.key(next), currentAllowed: CWFieldDocuments.same(current), fresh: (() => { try { return CWFieldDocuments.read(next); } catch (_) { return null; } })() }; }
    finally { CWFieldRouteCache.today = original; }
  }, vehicle.id);
  assert.deepEqual(daySeparation, { distinct: true, currentAllowed: false, fresh: null });
  const otherRaw = await raw(otherKey);
  await page.evaluate(() => { CWFieldRouteCache.today = () => '2099-01-01'; window.dispatchEvent(new Event('storage')); });
  assert(!(await page.locator('#workGuideBox').textContent()).includes('Document chlorine'));
  assert.notEqual(await page.locator('#fieldDocsValue').textContent(), 'Válidos'); assert.equal(await raw(otherKey), otherRaw);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS editing vehicle invalidates visible documents; another account on the same vehicle cannot inherit cache; current account must consult again and day changes invalidate provenance');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const release of releases) release(); await browser?.close(); await prisma.$disconnect(); });
