'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'], words = {"connectionAvailable":["Rede disponível","Connection available","Connexion disponible","Conexión disponible","Verbindung verfügbar"],"connectionUnavailable":["Sem rede","No connection","Sans connexion","Sin conexión","Keine Verbindung"],"routeLegacyDraftHistory":["Existem rascunhos antigos sem conta e tipo de visita confirmados. Foram conservados para revisão pelo escritório; não limpe os dados da aplicação.","Old drafts have no confirmed account or visit type. They were kept for office review; do not clear the app data.","Des brouillons anciens n’ont pas de compte ni de type de visite confirmés. Ils ont été conservés pour examen par le bureau ; n’effacez pas les données de l’application.","Hay borradores antiguos sin cuenta ni tipo de visita confirmados. Se han conservado para que la oficina los revise; no borres los datos de la aplicación.","Alte Entwürfe haben kein bestätigtes Konto und keinen bestätigten Besuchstyp. Sie bleiben zur Prüfung durch das Büro erhalten; löschen Sie die App-Daten nicht."],"routeSessionPending":["Sessão por validar","Session needs validation","Session à valider","Sesión pendiente de validar","Sitzung muss bestätigt werden"]};
const fieldIds = ['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
let browser, completed = false, checks = 0;
const deadline = setTimeout(() => { console.error('Connection language scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const day = ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-'), scheduledAt = new Date(day + 'T12:00:00.000Z');
  const vehicle = await prisma.vehicle.create({ data: { plate: 'NET-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Network owner <b>{day}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Network language client', active: true } });
  const pools = await Promise.all(['REGULAR','EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' network <b>{day}</b>', active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date(now) };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: scheduledAt, plannedDate: scheduledAt } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt } });
  for (const table of ['ServiceVisit','ExtraVisit']) await prisma.$queryRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"' + table + '"\',\'id\'),' + id + ',true)');
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-NET-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 30 * 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE','INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 30 * 86400000) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), legacyKey = 'cwFieldVisitDrafts:' + tech.id;
  const archive = JSON.stringify({ owner: 'TECH:999999', drafts: { ['visit-' + id]: { notes: 'PRIVATE UNOWNED DRAFT <b>{day}</b>', ph: '99' } } });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1400 }, timezoneId: 'Europe/Lisbon' }), requests = [], errors = [];
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaConnectionLanguages')) {
      for (const key of ['token','cristalwater_jwt','adminToken']) localStorage.setItem(key, token);
      for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('qaConnectionLanguages','1');
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
    for (const [field,value] of Object.entries({ notes: type + ' network draft <b>{day}</b>', ph: type === 'REGULAR' ? '7.4' : '7.1', chlorine: '1.2', alkalinity: '90', salt: '3.2', orp: '680', temperature: '24' })) await page.locator('#' + field).fill(value);
    for (const [field,value] of Object.entries({ cleaned: true, vacuumed: false, basketCleaned: true, brushed: false, waterlineClean: true, backwashDone: false })) await page.locator('#' + field).setChecked(value);
    await page.waitForFunction(() => document.getElementById('fieldSaveStatus').dataset.state === 'saved');
  };
  const raw = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key,localStorage.getItem(key)])));
  const pending = () => page.evaluate(() => new Promise((resolve,reject) => {
    const request = indexedDB.open('cw-field-writes',1); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, read = db.transaction('requests').objectStore('requests').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a,b) => a.key.localeCompare(b.key))); }; read.onerror = () => reject(read.error); };
  }));
  const database = () => Promise.all([prisma.serviceVisit.findUnique({ where: { id } }), prisma.extraVisit.findUnique({ where: { id } }), prisma.transportGuide.findUnique({ where: { id: guide.id } }), prisma.workGuide.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count()]);
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
  async function matrix({ name, badgeKey = 'connectionAvailable', historyHidden = false, literalBadge, literalHistory, widths = [320,390,1440], pendingCount = 0 }) {
    await waitReads(); await page.locator('#cwLanguageSelect').focus(); await locale('pt'); await track(); await settle();
    await page.evaluate(ids => { window.qaNetworkBadge = document.getElementById('connectionState'); window.qaNetworkHistory = document.getElementById('fieldDraftHistory'); window.qaNetworkFields = ids.map(id => document.getElementById(id)); window.qaNetworkControls = ['startBtn','finishBtn','fieldReloadBtn'].map(id => document.getElementById(id)); window.qaNetworkHandlers = qaNetworkControls.map(node => node.onclick); window.qaNetworkFocus = document.activeElement; }, fieldIds);
    const before = await state(), stored = await raw(), records = await pending(), db = await database(), first = requests.length;
    assert.equal(before.history.hidden,historyHidden); assert.equal(before.history.role,'status'); assert.equal(before.history.manual,'manual'); assert.equal(records.length,pendingCount);
    assert(records.every(row => !row.response));
    for (const width of widths) { await page.setViewportSize({ width, height: 1400 }); for (const [index,language] of languages.entries()) {
      await locale(language);
      assert.equal(await page.locator('#connectionState').textContent(),literalBadge === undefined ? words[badgeKey][index] : literalBadge,'Owned connection label: ' + name + '/' + language);
      assert.equal(await page.locator('#fieldDraftHistory').textContent(),literalHistory === undefined ? words.routeLegacyDraftHistory[index] : literalHistory,'Owned legacy warning: ' + name + '/' + language);
      assert.deepEqual(await state(),before); assert.deepEqual(await raw(),stored); assert.deepEqual(await pending(),records); assert.deepEqual(await database(),db);
      assert(await page.evaluate(() => qaNetworkBadge === document.getElementById('connectionState') && qaNetworkHistory === document.getElementById('fieldDraftHistory') && qaNetworkFields.every(node => node.isConnected && node === document.getElementById(node.id)) && qaNetworkControls.every((node,index) => node.isConnected && node.onclick === qaNetworkHandlers[index]) && document.activeElement === qaNetworkFocus));
      assert.equal(await page.locator('#fieldDraftHistory b, #fieldDraftHistory script').count(),0);
      assert(!(await page.locator('main.field').textContent()).includes('PRIVATE UNOWNED DRAFT'));
      assert(await page.locator('#fieldDraftHistory').evaluate(node => node.hidden || node.scrollWidth <= node.clientWidth + 1));
      const badgeBounds = await page.locator('#connectionState').evaluate(node => { const box = node.getBoundingClientRect(), brand = document.querySelector('.brand-block').getBoundingClientRect(); return { left: box.left, right: box.right, width: innerWidth, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, noOverlap: box.left >= brand.right - 1 || box.top >= brand.bottom - 1 || box.bottom <= brand.top + 1 }; });
      assert(badgeBounds.scrollWidth <= badgeBounds.clientWidth + 1 && badgeBounds.left >= -1 && badgeBounds.right <= badgeBounds.width + 1,'Connection badge bounds: ' + JSON.stringify({ name, language, ...badgeBounds }));
      assert(badgeBounds.noOverlap,'Connection badge must not overlap the visit heading: ' + name + '/' + language);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      checks++;
    }}
    if (process.env.CW_CONNECTION_CAPTURE && literalBadge === undefined) {
      await page.setViewportSize({ width: 320, height: 1400 });
      await fs.mkdir(process.env.CW_CONNECTION_CAPTURE,{ recursive: true });
      await page.evaluate(() => window.scrollTo(0,0));
      const headerBounds = await page.locator('header.top').boundingBox();
      assert(headerBounds && headerBounds.y >= 0 && headerBounds.y + headerBounds.height <= 1400,'Capture the whole field header after the offline banner');
      await page.screenshot({ path: process.env.CW_CONNECTION_CAPTURE + '/' + name + '-header-de-320.png', clip: { x: 0, y: 0, width: 320, height: Math.ceil(headerBounds.y + headerBounds.height) } });
      if (!historyHidden) await page.locator('#fieldDraftHistory').screenshot({ path: process.env.CW_CONNECTION_CAPTURE + '/' + name + '-history-de-320.png' });
    }
    for (const request of requests.slice(first)) { assert.equal(request.path,'/api/settings/language/me'); assert.equal(request.method,'PUT'); assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']); assert(request.auth === 'Bearer ' + token,'Language request preserves the current session'); }
    console.log('PASS connection languages ' + JSON.stringify({ name, widths, historyHidden, pendingCount, checks, badgeOffline: before.badge.offline, typedDrafts: true, noOperationalWrites: true }));
  }
  const reload = async () => { await page.locator('#fieldReloadBtn').evaluate(node => node.click()); await ready('REGULAR'); await waitReads(); await page.waitForFunction(() => document.getElementById('fieldLoadError').hidden); };
  await open('REGULAR'); await fill('REGULAR'); await open('EXTRA'); await fill('EXTRA'); await open('REGULAR'); await track();
  assert.equal(await page.locator('#notes').inputValue(),'REGULAR network draft <b>{day}</b>');
  await matrix({ name: 'no-legacy', historyHidden: true });
  await page.evaluate(key => localStorage.setItem(key,'{}'),legacyKey); await reload();
  await matrix({ name: 'empty-legacy', historyHidden: true });
  await page.evaluate(({ key,archive }) => localStorage.setItem(key,archive),{ key: legacyKey, archive }); await reload();
  await matrix({ name: 'unattributed-legacy' });
  await locale('pt'); await page.evaluate(() => { for (const id of ['connectionState','fieldDraftHistory']) { const node = document.getElementById(id); node.replaceChildren(document.createTextNode(node.textContent)); } });
  await matrix({ name: 'foreign-identical-node', literalBadge: words.connectionAvailable[0], literalHistory: words.routeLegacyDraftHistory[0] });
  for (const id of ['connectionState','fieldDraftHistory']) { assert.equal(await page.locator('#' + id).getAttribute('data-cw-alert-copy'),null); assert.notEqual(await page.locator('#' + id).getAttribute('data-cw-no-i18n'),null); }
  await open('REGULAR'); await track();
  const endpoint = '**/api/technician/today?*';
  await page.route(endpoint,route => route.fulfill({ status: 403, json: {} })); await page.locator('#fieldReloadBtn').evaluate(node => node.click());
  await page.waitForFunction(() => !document.getElementById('fieldLoadError').hidden); await waitReads();
  await matrix({ name: 'session-pending-is-not-network', badgeKey: 'routeSessionPending' });
  await page.unroute(endpoint); await reload();
  await open('EXTRA'); await track(); assert.equal(await page.locator('#notes').inputValue(),'EXTRA network draft <b>{day}</b>');
  await matrix({ name: 'extra-online', widths: [320] });
  await open('REGULAR'); await track(); await locale('en');
  await page.evaluate(async id => { await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{ visitId: id, notes: 'REGULAR network pending <b>{day}</b>' }); await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{ visitType: 'EXTRA', notes: 'EXTRA network pending <b>{day}</b>' }); },id);
  const originalPending = await pending(), originalDb = await database();
  assert.deepEqual(originalPending.map(row => row.scope).sort(),['EXTRA_VISIT_COMPLETION','VISIT_COMPLETION']); assert(originalPending.every(row => row.resourceId === id && row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64 && !row.response)); assert.notEqual(originalPending[0].requestId,originalPending[1].requestId);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true); await page.waitForFunction(() => document.getElementById('connectionState').dataset.offline === 'true');
  assert.equal(await page.locator('#connectionState').textContent(),words.connectionUnavailable[1],'Real offline event follows the selected language');
  await matrix({ name: 'offline-real-event', badgeKey: 'connectionUnavailable', pendingCount: 2 });
  await locale('pt'); const external = 'External <b>{day}</b>';
  await page.evaluate(external => { document.getElementById('connectionState').textContent = external; document.getElementById('fieldDraftHistory').textContent = external; },external);
  await matrix({ name: 'foreign-markup-offline', literalBadge: external, literalHistory: external, pendingCount: 2 });
  await open('EXTRA'); await track(); assert.equal(await page.locator('#notes').inputValue(),'EXTRA network draft <b>{day}</b>');
  assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt),null);
  await matrix({ name: 'extra-offline-cached-shell', badgeKey: 'connectionUnavailable', widths: [320], pendingCount: 2 });
  assert.deepEqual(await pending(),originalPending); assert.deepEqual(await database(),originalDb); assert.deepEqual(errors,[]);
  assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));
  assert.equal(await page.evaluate(key => localStorage.getItem(key),legacyKey),archive);
  console.log('PASS connection language result ' + JSON.stringify({ checks, scenarios: 9, ownedEntries: 3, languages: 5, typedDraftFields: 13, immutablePending: 2, privateLegacyHidden: true, foreignCopiesLiteral: true, realOfflineEvent: true, cachedExtraShell: true, noOperationalWrites: true })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
