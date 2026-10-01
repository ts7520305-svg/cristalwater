'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ["pt", "en", "fr", "es", "de"], words = {"problemModuleUnavailable": ["Ocorrências indisponíveis. Conserve o texto e reabra a página.", "Problem reports unavailable. Keep the text and reopen the page.", "Signalements indisponibles. Conservez le texte et rouvrez la page.", "Incidencias no disponibles. Conserva el texto y vuelve a abrir la página.", "Problemmeldungen sind nicht verfügbar. Bewahren Sie den Text auf und öffnen Sie die Seite erneut."], "stockModuleUnavailable": ["Pedidos de material indisponíveis. Conserve o texto e reabra a página.", "Material requests unavailable. Keep the text and reopen the page.", "Demandes de matériel indisponibles. Conservez le texte et rouvrez la page.", "Solicitudes de material no disponibles. Conserva el texto y vuelve a abrir la página.", "Materialanfragen sind nicht verfügbar. Bewahren Sie den Text auf und öffnen Sie die Seite erneut."]};
const fieldIds = ['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
const moduleFields = ['problemCategory','problemType','problemSeverity','problemText','adminAlertType','adminAlertPriority','stockProductName','stockQuantity','stockUnit','adminAlertMessage'];
let browser,completed = false,checks = 0,scenarios = 0;
const deadline = setTimeout(() => { console.error('Module fallback language scenario incomplete');process.exit(1); },110000);
process.on('exit',code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const day = ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-'), scheduledAt = new Date(day + 'T12:00:00.000Z');
  const vehicle = await prisma.vehicle.create({ data: { plate: 'MODULE-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Module fallback owner <b>{day}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Module fallback client', active: true } });
  const pools = await Promise.all(['REGULAR','EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' module <b>{date}</b>', active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date(now) };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: scheduledAt, plannedDate: scheduledAt } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt } });
  for (const table of ['ServiceVisit','ExtraVisit']) await prisma.$queryRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"' + table + '"\',\'id\'),' + id + ',true)');
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-NET-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 30 * 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE','INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 30 * 86400000) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), legacyKey = 'cwFieldVisitDrafts:' + tech.id;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1400 }, timezoneId: 'Europe/Lisbon' }), requests = [], errors = [];
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaModuleFallbackLanguages')) {
      for (const key of ['token','cristalwater_jwt','adminToken']) localStorage.setItem(key, token);
      for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('qaModuleFallbackLanguages','1');
    }
    // Keep the tab click real while removing animated movement from snapshot timing.
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) { return scrollIntoView.call(this, options && typeof options === 'object' ? { ...options,behavior: 'instant' } : options); };
    const interval = window.setInterval;
    window.setInterval = (callback, delay, ...args) => [15000,30000,60000].includes(delay) ? 0 : interval(callback, delay, ...args);
    Object.defineProperty(navigator,'geolocation',{ value: { watchPosition: () => 1, clearWatch() {} } });
  }, { token, tech, origin: base });
  const page = await context.newPage(); page.setDefaultTimeout(10000); await page.clock.setFixedTime(now);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) requests.push({ path, method: request.method(), body: request.postData(), auth: request.headers().authorization }); });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const locale = async language => { await settle(); await page.evaluate(() => window.scrollTo({ top: 0,behavior: 'instant' })); await settle(); await page.locator('#cwLanguageSelect').selectOption(language); await settle(); };
  const ready = async type => {
    await page.waitForFunction(({ id, type }) => window.CWFieldVisitContext?.()?.id === id && CWFieldVisitContext().visitType === type && ['transportGuideBox','workGuideBox','insuranceBox'].every(key => ['live','cache'].includes(document.getElementById(key).dataset.source)) && !['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent), { id, type });
    await page.locator('[data-field-tab-button=agora]').click(); await settle();
  };
  const open = async type => { await page.goto(base + '/technician-field-mode?selectedVisitId=' + id + '&selectedVisitType=' + type, { waitUntil: 'domcontentloaded' }); await ready(type); };
  const fill = async type => {
    for (const [field,value] of Object.entries({ notes: type + ' module fallback draft <b>{date}</b>', ph: type === 'REGULAR' ? '7.4' : '7.1', chlorine: '1.2', alkalinity: '90', salt: '3.2', orp: '680', temperature: '24' })) await page.locator('#' + field).fill(value);
    for (const [field,value] of Object.entries({ cleaned: true, vacuumed: false, basketCleaned: true, brushed: false, waterlineClean: true, backwashDone: false })) await page.locator('#' + field).setChecked(value);
    await page.waitForFunction(({ id,owner,type }) => { const raw = localStorage.getItem('cwFieldVisitDrafts:v2:' + owner); return document.getElementById('fieldSaveStatus').dataset.state === 'saved' && raw && JSON.parse(raw).drafts['visit-' + type + '-' + id]?.values.notes === type + ' module fallback draft <b>{date}</b>'; },{ id,owner: 'TECH:' + tech.id,type });
  };
  const raw = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key,localStorage.getItem(key)])));
  const pending = () => page.evaluate(() => new Promise((resolve,reject) => {
    const request = indexedDB.open('cw-field-writes',1); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, read = db.transaction('requests').objectStore('requests').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a,b) => a.key.localeCompare(b.key))); }; read.onerror = () => reject(read.error); };
  }));

  const database = () => Promise.all([prisma.serviceVisit.findUnique({ where: { id } }),prisma.extraVisit.findUnique({ where: { id } }),prisma.transportGuide.findUnique({ where: { id: guide.id } }),prisma.workGuide.findMany({ where: { vehicleId: vehicle.id },orderBy: { id: 'asc' } }),prisma.fieldWriteRequest.count(),prisma.stockMovement.count(),prisma.technicalHistory.findMany({ where: { poolId: { in: pools.map(pool => pool.id) } },orderBy: { id: 'asc' } }),prisma.notification.findMany({ orderBy: { id: 'asc' } })]);
  const track = () => page.evaluate(() => {
    window.qaNetworkCalls = {};
    if (window.qaNetworkTracking) return;
    window.qaNetworkTracking = true; window.qaNetworkReads = 0;
    for (const [group,api,names] of [['route',CWFieldRouteCache,['read','save','update','fromResponse']],['documents',CWFieldDocuments,['load']],['photos',CWFieldPhotos,['list','save','sync']],['draft',CWFieldVisitDrafts,['save','prepare','load']],['writes',CWFieldWriteStore,['prepare','attempt','acknowledge']]]) for (const name of names) {
      const original = api?.[name]; if (typeof original !== 'function') continue;
      api[name] = (...args) => { const key = group + ':' + name; qaNetworkCalls[key] = (qaNetworkCalls[key] || 0) + 1; const result = original(...args); if (result?.then) { qaNetworkReads++; result.then(() => qaNetworkReads--,() => qaNetworkReads--); } return result; };
    }
  });
  const waitReads = () => page.waitForFunction(() => !window.qaNetworkReads);
  const state = () => page.evaluate(async () => {
    const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value || '')))].map(byte => byte.toString(16).padStart(2,'0')).join('');
    const session = Object.fromEntries(Object.keys(sessionStorage).sort().map(key => { const raw = sessionStorage.getItem(key); if (key === 'cw:ctx:/technician-field-mode') { const copy = JSON.parse(raw); delete copy.fields?.cwLanguageSelect; return [key,copy]; } return [key,raw]; }));
    return { day: CWFieldDaySnapshot(), visit: CWFieldVisitContext(), calls: qaNetworkCalls, tokens: await Promise.all(['token','cristalwater_jwt','adminToken'].map(key => digest(localStorage.getItem(key)))), users: ['user','cristalwater_user'].map(key => { const user = JSON.parse(localStorage.getItem(key)); delete user.language; return user; }), session, fields: qaNetworkFields.map(node => [node.id,node.value,node.checked,node.disabled,node.readOnly,node.hidden]), badge: { offline: qaNetworkBadge.dataset.offline, hidden: qaNetworkBadge.hidden, className: qaNetworkBadge.className }, history: { hidden: qaNetworkHistory.hidden, role: qaNetworkHistory.getAttribute('role'), manual: qaNetworkHistory.getAttribute('data-cw-state-managed') }, controls: qaNetworkControls.map(node => [node.id,node.hidden,node.disabled]) };
  });

  const removeModules = () => page.evaluate(() => { window.qaModuleCalls = {};for (const [name,api] of [['problem',CWFieldProblemReport],['stock',CWFieldStockRequest]]) for (const method of ['send','refresh','contextChanged','pendingSummary']) { const original = api[method];api[method] = (...args) => { qaModuleCalls[name + ':' + method] = (qaModuleCalls[name + ':' + method] || 0)+1;return original(...args); }; }window.qaOriginalModules = [CWFieldProblemReport,CWFieldStockRequest];window.CWFieldProblemReport = null;window.CWFieldStockRequest = null; });
  const moduleState = () => page.evaluate(() => ({ calls: qaModuleCalls,fields: qaModuleFields.map(node => [node.id,node.value,node.checked,node.disabled,node.readOnly,node.hidden]),controls: qaModuleButtons.map(node => [node.id,node.disabled,node.hidden]),modulesAbsent: [CWFieldProblemReport === null,CWFieldStockRequest === null],panelHidden: document.getElementById('problemPanel').hidden }));
  const text = (key,index) => words[key][index];
  const fillModules = async () => {
    await page.locator('[data-field-tab-button=more]').click();await page.locator('#problemBtn').click();
    await page.locator('#problemCategory').selectOption('Extra / reparacao');await page.locator('#problemType').selectOption('Equipamento');await page.locator('#problemSeverity').selectOption('Urgente');await page.locator('#problemText').fill('Problem draft <b>{date}</b>');
    await page.locator('#adminAlertType').selectOption('STOCK_REQUEST');await page.locator('#adminAlertPriority').selectOption('HIGH');
    for (const [key,value] of Object.entries({ stockProductName: 'Material <b>{date}</b>',stockQuantity: '2.5',stockUnit: 'kg',adminAlertMessage: 'Stock draft <b>{date}</b>' })) await page.locator('#' + key).fill(value);await settle();
  };
  async function matrix({ name,key = '',foreign = false,widths = [320,390,1440],pendingCount = 0,extra = false }) {
    await waitReads();await page.locator('[data-field-tab-button=more]').click();await track();await settle();
    await page.evaluate(({ ids,moduleFields }) => { window.qaNetworkBadge = document.getElementById('connectionState');window.qaNetworkHistory = document.getElementById('fieldDraftHistory');window.qaNetworkFields = ids.map(id => document.getElementById(id));window.qaNetworkControls = ['startBtn','finishBtn','fieldReloadBtn'].map(id => document.getElementById(id));window.qaNetworkHandlers = qaNetworkControls.map(node => node.onclick);window.qaModuleFields = moduleFields.map(id => document.getElementById(id));window.qaModuleButtons = ['saveProblemBtn','sendAdminAlertBtn'].map(id => document.getElementById(id));window.qaModuleHandlers = qaModuleButtons.map(node => node.onclick);window.qaModuleNodes = [...qaModuleFields,...qaModuleButtons,document.getElementById('toast')]; },{ ids: fieldIds,moduleFields });
    for (const width of widths) {
      await page.setViewportSize({ width,height: 1400 });await locale('pt');
      await page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'));
      await page.locator('#cwLanguageSelect').focus();await page.evaluate(() => { window.qaNetworkFocus = document.activeElement; });
      const before = await state(),moduleBefore = await moduleState(),stored = await raw(),records = await pending(),db = await database(),first = requests.length;
      assert.equal(records.length,pendingCount);assert(records.every(row => !row.response));
      if (extra) { assert(await page.locator('#saveProblemBtn').isDisabled());assert(await page.locator('#sendAdminAlertBtn').isDisabled());await page.locator('#saveProblemBtn,#sendAdminAlertBtn').evaluateAll(nodes => nodes.forEach(node => node.click())); }
      else { const button = key === 'problemModuleUnavailable' ? '#saveProblemBtn' : '#sendAdminAlertBtn';assert(await page.locator(button).isEnabled());await page.locator(button).click();await page.waitForFunction(expected => document.getElementById('toast').textContent === expected && document.getElementById('toast').classList.contains('show'),text(key,0));if (foreign) await page.locator('#toast').evaluate(node => node.replaceChildren(document.createTextNode(node.textContent))); }
      await page.locator('#cwLanguageSelect').focus();await page.evaluate(() => { window.qaNetworkFocus = document.activeElement; });
      for (const [index,language] of languages.entries()) {
        await locale(language);
        if (!extra) { assert.equal(await page.locator('#toast').textContent(),text(key,foreign ? 0 : index));assert(await page.locator('#toast').evaluate(node => node.classList.contains('show')),'Original toast timer still visible during repaint'); }
        assert.deepEqual(await state(),before);assert.deepEqual(await moduleState(),moduleBefore);assert.deepEqual(await raw(),stored);assert.deepEqual(await pending(),records);assert.deepEqual(await database(),db);
        assert(await page.evaluate(() => qaModuleNodes.every(node => node.isConnected) && qaNetworkFields.every(node => node === document.getElementById(node.id)) && qaModuleFields.every(node => node === document.getElementById(node.id)) && qaNetworkControls.every((node,index) => node.onclick === qaNetworkHandlers[index]) && qaModuleButtons.every((node,index) => node.onclick === qaModuleHandlers[index]) && document.activeElement === qaNetworkFocus));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));if (!extra) assert(await page.locator('#toast').evaluate(node => { const box = node.getBoundingClientRect();return box.left >= -1 && box.right <= innerWidth+1 && node.scrollWidth <= node.clientWidth+1; }));checks++;
      }
      for (const request of requests.slice(first)) { assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);assert(request.auth === 'Bearer ' + token); }
      if (process.env.CW_MODULE_CAPTURE && width === 320 && !extra && !foreign) { await fs.mkdir(process.env.CW_MODULE_CAPTURE,{ recursive: true });await page.locator('#toast').screenshot({ path: process.env.CW_MODULE_CAPTURE + '/' + name + '-de-320.png' }); }
    }
    scenarios++;console.log('PASS module fallback languages ' + JSON.stringify({ name,checks,scenarios,pendingCount,extraGuard: extra,fieldsPreserved: 23,originalHandlersAndTimer: true,noOperationalWrites: true }));
  }
  await open('REGULAR');await fill('REGULAR');await open('EXTRA');await fill('EXTRA');await open('REGULAR');await fillModules();await removeModules();
  // Drain the original 2400ms notices from setup before measuring a new notice.
  // Product timers and callbacks remain live and unchanged.
  await page.waitForTimeout(2500);
  await matrix({ name: 'problem-missing-module',key: 'problemModuleUnavailable' });await matrix({ name: 'stock-missing-module',key: 'stockModuleUnavailable' });
  await matrix({ name: 'problem-foreign-identical-toast',key: 'problemModuleUnavailable',foreign: true,widths: [320] });await matrix({ name: 'stock-foreign-identical-toast',key: 'stockModuleUnavailable',foreign: true,widths: [320] });
  await page.evaluate(async id => { await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{ visitId: id,notes: 'REGULAR module fallback pending <b>{date}</b>' });await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{ visitType: 'EXTRA',notes: 'EXTRA module fallback pending <b>{date}</b>' }); },id);
  const originalPending = await pending(),originalDb = await database();assert.deepEqual(originalPending.map(row => row.scope).sort(),['EXTRA_VISIT_COMPLETION','VISIT_COMPLETION']);assert(originalPending.every(row => row.resourceId === id && row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64 && !row.response));assert.notEqual(originalPending[0].requestId,originalPending[1].requestId);
  await page.evaluate(() => navigator.serviceWorker.ready);await page.waitForFunction(() => !!navigator.serviceWorker.controller);await context.setOffline(true);await page.waitForFunction(() => document.getElementById('connectionState').dataset.offline === 'true');
  await matrix({ name: 'problem-missing-module-offline',key: 'problemModuleUnavailable',pendingCount: 2 });await matrix({ name: 'stock-missing-module-offline',key: 'stockModuleUnavailable',pendingCount: 2 });
  await open('EXTRA');await track();await removeModules();assert.equal(await page.locator('#notes').inputValue(),'EXTRA module fallback draft <b>{date}</b>');assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt),null);await matrix({ name: 'extra-cached-shell-original-disabled-guards',pendingCount: 2,extra: true });
  assert.deepEqual(await pending(),originalPending);assert.deepEqual(await database(),originalDb);assert.deepEqual(errors,[]);assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));
  console.log('PASS module fallback language result ' + JSON.stringify({ checks,scenarios,ownedEntries: 2,languages: 5,typedDraftFields: 13,reportAndStockFields: 10,immutablePending: 2,realOffline: true,originalDisabledExtraGuards: true,foreignToastLiteral: true,noOperationalWrites: true }));completed = true;
})().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => { clearTimeout(deadline);await browser?.close();await prisma.$disconnect(); });
