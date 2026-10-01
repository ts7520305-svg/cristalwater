'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt','en','fr','es','de'], words = {"title": ["Cristal Water - Historico Tecnico", "Cristal Water - Technician History", "Cristal Water - Historique du technicien", "Cristal Water - Historial del técnico", "Cristal Water - Technikerverlauf"], "technician": ["Tecnico", "Technician", "Technicien", "Técnico", "Techniker"], "heading": ["Historico de Visitas", "Visit History", "Historique des visites", "Historial de visitas", "Besuchsverlauf"], "intro": ["Consulta rapida das ultimas visitas concluidas, sem escrita.", "Quick view of recent completed visits, read only.", "Consultation rapide des dernières visites terminées, en lecture seule.", "Consulta rápida de las últimas visitas completadas, solo lectura.", "Schnellansicht der letzten abgeschlossenen Besuche im Lesemodus."], "loading": ["A carregar historico.", "Loading history.", "Chargement de l’historique.", "Cargando el historial.", "Verlauf wird geladen."], "empty": ["Sem historico disponivel.", "No history available.", "Aucun historique disponible.", "No hay historial disponible.", "Kein Verlauf verfügbar."], "noDate": ["Sem data", "No date", "Sans date", "Sin fecha", "Kein Datum"], "pool": ["Piscina", "Pool", "Piscine", "Piscina", "Pool"], "client": ["Cliente", "Client", "Client", "Cliente", "Kunde"], "line": ["{date} · Estado {status}", "{date} · Status {status}", "{date} · Statut {status}", "{date} · Estado {status}", "{date} · Status {status}"], "missingTechnician": ["Sessao sem tecnico associado.", "No technician is associated with this session.", "Aucun technicien n’est associé à cette session.", "No hay ningún técnico asociado a esta sesión.", "Dieser Sitzung ist kein Techniker zugeordnet."], "incomplete": ["A resposta não confirma a lista completa. Atualize antes de consultar o histórico.", "The response does not confirm the complete list. Refresh before viewing history.", "La réponse ne confirme pas la liste complète. Actualisez avant de consulter l’historique.", "La respuesta no confirma la lista completa. Actualiza antes de consultar el historial.", "Die Antwort bestätigt keine vollständige Liste. Aktualisieren Sie, bevor Sie den Verlauf ansehen."], "loaded": ["Historico carregado com {count} visita(s).", "History loaded with {count} visit(s).", "Historique chargé avec {count} visite(s).", "Historial cargado con {count} visita(s).", "Verlauf mit {count} Besuch(en) geladen."], "noCompleted": ["Sem visitas concluidas para mostrar.", "No completed visits to show.", "Aucune visite terminée à afficher.", "No hay visitas completadas para mostrar.", "Keine abgeschlossenen Besuche verfügbar."], "loadFailed": ["Falha ao carregar historico.", "Failed to load history.", "Échec du chargement de l’historique.", "Error al cargar el historial.", "Verlauf konnte nicht geladen werden."], "http": ["Falha HTTP {status}", "HTTP failure {status}", "Échec HTTP {status}", "Error HTTP {status}", "HTTP-Fehler {status}"]};
const fieldIds = ['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
let browser, release, completed = false, checks = 0, scenarios = 0;
const deadline = setTimeout(() => { console.error('History language scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const day = ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-'), scheduledAt = new Date(day + 'T12:00:00.000Z');
  const vehicle = await prisma.vehicle.create({ data: { plate: 'PROFILE-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Profile owner <b>{day}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Profile client', active: true } });
  const pools = await Promise.all(['REGULAR','EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' profile <b>{date}</b>', active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date(now) };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: scheduledAt, plannedDate: scheduledAt } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt } });
  for (const table of ['ServiceVisit','ExtraVisit']) await prisma.$queryRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"' + table + '"\',\'id\'),' + id + ',true)');
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-NET-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 30 * 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE','INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 30 * 86400000) } });

  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const source = { id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', name: 'Session source <b>{name}</b> & <img src=x>', zone: 'ZONE-' + 'x'.repeat(95), phone: '+351 999 123 456', privateNote: 'Unexposed <b>{phone}</b>' };
  const leader = await prisma.technician.create({ data: { name: 'Actual profile team leader', role: 'TEAM_LEADER', active: true } });
  const leaderToken = jwt.sign({ id: leader.id, role: 'TEAM_LEADER' }, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const database = () => Promise.all([
    prisma.serviceVisit.findUnique({ where: { id } }), prisma.extraVisit.findUnique({ where: { id } }),
    prisma.workGuide.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } }),
    prisma.transportGuide.findUnique({ where: { id: guide.id } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count(),
    prisma.technicalHistory.findMany({ where: { poolId: { in: pools.map(pool => pool.id) } }, orderBy: { id: 'asc' } }),
    prisma.notification.findMany({ orderBy: { id: 'asc' } }),
    prisma.technician.findMany({ where: { id: { in: [tech.id, leader.id] } }, orderBy: { id: 'asc' } })
  ]);
  async function makeContext(credential, user) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1400 }, timezoneId: 'Europe/Lisbon' });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await context.addInitScript(({ credential, user, origin }) => {
      if (top !== window || location.origin !== origin) return;
      if (!localStorage.getItem('qaProfileLanguages')) {
        for (const key of ['token','cristalwater_jwt','adminToken']) localStorage.setItem(key, credential);
        for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
        localStorage.setItem('cw_language','pt'); localStorage.setItem('qaProfileLanguages','1');
      }
      const scrollIntoView = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function(options) { return scrollIntoView.call(this, options && typeof options === 'object' ? { ...options, behavior: 'instant' } : options); };
      const interval = window.setInterval;
      window.setInterval = (callback, delay, ...args) => [15000,30000,60000].includes(delay) ? 0 : interval(callback, delay, ...args);
      Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
    }, { credential, user, origin: base });
    return context;
  }
  const context = await makeContext(token, source);
  const page = await context.newPage(); page.setDefaultTimeout(10000); await page.clock.setFixedTime(now);
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) requests.push({ path, method: request.method(), body: request.postData(), auth: request.headers().authorization }); });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const locale = async language => { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await settle(); await page.locator('#cwLanguageSelect').selectOption(language); await settle(); };
  const raw = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key, localStorage.getItem(key)])));
  const pending = () => page.evaluate(() => new Promise((resolve,reject) => {
    const request = indexedDB.open('cw-field-writes',1); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, read = db.transaction('requests').objectStore('requests').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a,b) => a.key.localeCompare(b.key))); }; read.onerror = () => reject(read.error); };
  }));
  const openField = async type => {
    await page.goto(base + '/technician-field-mode?selectedVisitId=' + id + '&selectedVisitType=' + type, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(({ id,type }) => window.CWFieldVisitContext?.()?.id === id && CWFieldVisitContext().visitType === type && ['transportGuideBox','workGuideBox','insuranceBox'].every(key => ['live','cache'].includes(document.getElementById(key).dataset.source)) && !['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent), { id,type });
    await page.locator('[data-field-tab-button=agora]').click(); await settle();
  };
  const fill = async type => {
    for (const [field,value] of Object.entries({ notes: type + ' profile draft <b>{name}</b>', ph: type === 'REGULAR' ? '7.4' : '7.1', chlorine: '1.2', alkalinity: '90', salt: '3.2', orp: '680', temperature: '24' })) await page.locator('#' + field).fill(value);
    for (const [field,value] of Object.entries({ cleaned: true, vacuumed: false, basketCleaned: true, brushed: false, waterlineClean: true, backwashDone: false })) await page.locator('#' + field).setChecked(value);
    await page.waitForFunction(({ id,owner,type }) => { const raw = localStorage.getItem('cwFieldVisitDrafts:v2:' + owner); return document.getElementById('fieldSaveStatus').dataset.state === 'saved' && raw && JSON.parse(raw).drafts['visit-' + type + '-' + id]?.values.notes === type + ' profile draft <b>{name}</b>'; }, { id,owner: 'TECH:' + tech.id,type });
  };
  await openField('REGULAR'); await fill('REGULAR'); await openField('EXTRA'); await fill('EXTRA');
  const visitFields = {};
  for (const type of ['REGULAR','EXTRA']) { await openField(type); visitFields[type] = await page.evaluate(ids => ids.map(id => { const node = document.getElementById(id); return [id,node.value,node.checked]; }), fieldIds); }
  // Prepare actual typed requests without attempting any operational submission.
  await page.evaluate(async id => { await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{ visitId: id, notes: 'REGULAR profile pending <b>{name}</b>' }); await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{ visitType: 'EXTRA', notes: 'EXTRA profile pending <b>{name}</b>' }); },id);
  const originalPending = await pending(); assert.equal(originalPending.length,2); assert.deepEqual(originalPending.map(row => row.scope).sort(),['EXTRA_VISIT_COMPLETION','VISIT_COMPLETION']);
  assert(originalPending.every(row => row.resourceId === id && row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64 && !row.response)); assert.notEqual(originalPending[0].requestId,originalPending[1].requestId);

  await prisma.pool.update({ where: { id: pools[0].id },data: { name: 'Piscina' } });
  await prisma.pool.update({ where: { id: pools[1].id },data: { name: 'Extra history source <b>{date}</b> ' + 'x'.repeat(90) } });
  await prisma.client.update({ where: { id: client.id },data: { name: 'Cliente' } });
  await prisma.serviceVisit.update({ where: { id },data: { status: 'DONE',endAt: new Date(now) } });
  await prisma.extraVisit.update({ where: { id },data: { status: 'DONE',endAt: new Date(now - 1000) } });
  const ended = await prisma.serviceVisit.create({ data: { clientId: client.id,poolId: pools[0].id,technicianId: tech.id,status: 'PLANNED',date: scheduledAt,plannedDate: scheduledAt,endAt: new Date(now - 2000) } });
  const planned = await prisma.serviceVisit.create({ data: { clientId: client.id,poolId: pools[0].id,technicianId: tech.id,status: 'PLANNED',date: scheduledAt,plannedDate: scheduledAt } });
  const other = await prisma.technician.create({ data: { name: 'Foreign history owner',active: true } });
  const privatePool = await prisma.pool.create({ data: { clientId: client.id,name: 'PRIVATE HISTORY POOL',active: true } });
  await prisma.serviceVisit.create({ data: { clientId: client.id,poolId: privatePool.id,technicianId: other.id,status: 'DONE',date: scheduledAt,plannedDate: scheduledAt,endAt: new Date(now) } });
  const getRoute = async person => { const response = await fetch(base + '/api/technician/today?technicianId=' + person,{ headers: { Authorization: 'Bearer ' + token } });assert.equal(response.status,200);return response.json(); };
  const sourceRows = await getRoute(tech.id),tamperedQuery = await getRoute(other.id);
  assert(sourceRows.complete === true && sourceRows.total === sourceRows.visits.length);
  assert.deepEqual(sourceRows.visits.map(v => [v.visitType,v.id]),tamperedQuery.visits.map(v => [v.visitType,v.id]));
  assert(sourceRows.visits.every(v => v.technician.id === tech.id));assert(!JSON.stringify(sourceRows.visits).includes('PRIVATE HISTORY'));
  const completedRows = rows => rows.filter(v => Boolean(v.endAt) || String(v.status || '').toUpperCase() === 'DONE');
  assert.equal(sourceRows.visits.length,4);assert.equal(completedRows(sourceRows.visits).length,3);assert(!completedRows(sourceRows.visits).some(v => v.id === planned.id && v.visitType === 'REGULAR'));assert(completedRows(sourceRows.visits).some(v => v.id === ended.id));
  let profile = 'native',held = 0,adaptedRows = null;
  const endpoint = '**/api/technician/today?*';
  const adapted = () => {
    const json = structuredClone(sourceRows);
    if (profile === 'fallbacks') {
      const rows = completedRows(json.visits);
      Object.assign(rows[0],{ pool: null,client: null,endAt: null,startAt: null,plannedDate: null,date: null,status: 'DONE' });
      Object.assign(rows[1],{ endAt: 'invalid-date',startAt: 'invalid-date',plannedDate: 'invalid-date',date: 'invalid-date' });
      Object.assign(rows[2],{ status: 'UNKNOWN <b>{status}</b>' });
    }
    if (profile === 'empty') json.visits = [];
    if (profile === 'incomplete') json.complete = false;
    if (profile === 'total-mismatch') json.total++;
    if (profile === 'visits-not-array') json.visits = {};
    if (profile === 'empty') json.total = 0;
    return json;
  };
  await page.route(endpoint,async route => {
    if (profile === 'native') return route.continue();
    if (profile === 'loading') { held++;await new Promise(resolve => { release = resolve; }); }
    if (profile === 'http') return route.fulfill({ status: 503,body: 'non-json transport detail' });
    if (profile === 'server-identical') return route.fulfill({ status: 503,json: { error: words.incomplete[0] } });
    if (profile === 'server-detail') return route.fulfill({ status: 503,json: { message: 'Source failure <b>{count}</b>' } });
    await route.fulfill({ status: 200,json: adapted() });
  });
  const openHistory = async next => {
    profile = next;release = null;adaptedRows = adapted();
    await page.goto(base + '/technician-history',{ waitUntil: next === 'loading' ? 'domcontentloaded' : 'networkidle' });
    await page.waitForFunction(() => window.CristalI18n);
    await locale('pt');
    if (next === 'loading') { await page.waitForFunction(() => document.getElementById('statusBox').textContent === 'A carregar historico.');assert(held > 0); }
    else await page.waitForFunction(() => document.getElementById('statusBox').textContent !== 'A carregar historico.');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).visibility),'visible');await settle();
  };
  const state = () => page.evaluate(async () => {
    const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value || '')))].map(byte => byte.toString(16).padStart(2,'0')).join('');
    const users = ['user','cristalwater_user'].map(key => { const user = JSON.parse(localStorage.getItem(key));delete user.language;return user; });
    const storage = Object.fromEntries(Object.keys(localStorage).filter(key => !['token','cristalwater_jwt','adminToken','user','cristalwater_user','cw_client_lang'].includes(key) && !/^cw_language(?:$|:)/.test(key)).sort().map(key => [key,localStorage.getItem(key)]));
    return { users,storage,tokens: await Promise.all(['token','cristalwater_jwt','adminToken'].map(key => digest(localStorage.getItem(key)))),
      session: Object.fromEntries(Object.keys(sessionStorage).sort().map(key => [key,sessionStorage.getItem(key)])),
      calls: qaHistoryCalls,tone: document.getElementById('statusBox').getAttribute('data-tone'),aria: document.getElementById('statusBox').getAttribute('aria-live'),
      links: [...document.querySelectorAll('.ds-bottom-nav a')].map(node => [node.getAttribute('href'),node.getAttribute('class')]),
      rawErrors: window.qaHistoryError ? [qaHistoryError.name,qaHistoryError.message,qaHistoryClone.name,qaHistoryClone.message] : null };
  });
  const text = (key,index,params = {}) => words[key][index].replace(/\{(\w+)\}/g,(_,key) => params[key]);
  async function matrix({ name,widths = [320,390,1440],status = 'loaded',rawStatus = '',tone = null,rows = completedRows(adaptedRows.visits || []),empty = false,foreign = false,noList = false }) {
    await locale('pt');await page.locator('#cwLanguageSelect').focus();
    await page.evaluate(() => {
      window.qaHistoryCalls = {};
      if (!window.qaHistoryTracking) {
        qaHistoryTracking = true;
        for (const name of ['loadHistory','render','parseResponse','userData','setStatus']) { const original = window[name];window[name] = (...args) => { qaHistoryCalls[name] = (qaHistoryCalls[name] || 0) + 1;return original(...args); }; }
        const original = CristalAuth.requireAuth;CristalAuth.requireAuth = (...args) => { qaHistoryCalls.auth = (qaHistoryCalls.auth || 0) + 1;return original(...args); };
      }
      window.qaHistoryNodes = [...document.querySelectorAll('main,main *,title')];
      window.qaHistoryTextNodes = qaHistoryNodes.flatMap(node => [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE));
      window.qaHistoryFocus = document.activeElement;window.qaHistoryLinks = [...document.querySelectorAll('.ds-bottom-nav a')];window.qaHistoryHandlers = qaHistoryLinks.map(node => node.onclick);
    });
    const before = await state(),stored = await raw(),records = await pending(),db = await database(),first = requests.length;
    assert.equal(records.length,2);assert.deepEqual(records,originalPending);assert.equal(before.tone,tone);assert.equal(before.aria,'polite');
    const dates = await page.evaluate(rows => rows.map(visit => { const when = visit.endAt || visit.startAt || visit.plannedDate || visit.date;return when ? new Date(when).toLocaleString('pt-PT',{ dateStyle: 'short',timeStyle: 'short' }) : null; }),rows);
    for (const width of widths) { await page.setViewportSize({ width,height: 1400 });for (const [index,language] of languages.entries()) {
      await locale(language);const copyIndex = foreign ? 0 : index;
      assert.equal(await page.title(),words.title[copyIndex]);
      for (const key of ['technician','heading','intro']) assert.equal(await page.locator('[data-cw-history-copy=' + key + ']').textContent(),words[key][copyIndex]);
      assert.equal(await page.locator('#statusBox').textContent(),rawStatus || text(status,copyIndex,{ count: rows.length,status: 503 }));
      const actual = await page.locator('#historyList .item').evaluateAll(nodes => nodes.map(node => [node.querySelector('b').textContent,...[...node.querySelectorAll('small')].map(node => node.textContent)]));
      assert.deepEqual(actual,rows.map((v,pos) => [v.pool?.name || words.pool[copyIndex],v.client?.name || words.client[copyIndex],text('line',copyIndex,{ date: dates[pos] || words.noDate[copyIndex],status: v.status || '-' })]));
      assert.equal(await page.locator('#historyList .empty').count(),empty ? 1 : 0);if (empty) assert.equal(await page.locator('#historyList .empty').textContent(),words.empty[copyIndex]);if (noList) assert.equal(await page.locator('#historyList').textContent(),'');
      assert.deepEqual(await state(),before);assert.deepEqual(await raw(),stored);assert.deepEqual(await pending(),records);assert.deepEqual(await database(),db);
      assert(await page.evaluate(() => qaHistoryNodes.every(node => node.isConnected) && qaHistoryTextNodes.every(node => node.isConnected) && document.activeElement === qaHistoryFocus && qaHistoryLinks.every((node,index) => node.onclick === qaHistoryHandlers[index])));
      assert.equal(await page.locator('#historyList b b,#historyList script,#historyList img').count(),0);assert(!(await page.locator('#historyList').textContent()).includes('PRIVATE HISTORY'));
      assert.equal(await page.locator('main input,main textarea,main button').count(),0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),'History must fit the viewport');
      for (const selector of ['main .card','#statusBox','#historyList','#historyList .item','#historyList .empty']) assert(await page.locator(selector).evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1)),selector);checks++;
      if (process.env.CW_HISTORY_CAPTURE && width === 320 && language === 'de' && !foreign) { await fs.mkdir(process.env.CW_HISTORY_CAPTURE,{ recursive: true });await page.locator('main').screenshot({ path: process.env.CW_HISTORY_CAPTURE + '/' + name + '-de-320.png' });await page.locator('#cwLanguageSelect').focus();await settle(); }
    }}
    for (const request of requests.slice(first)) { assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);assert.equal(request.auth,'Bearer ' + token); }
    scenarios++;console.log('PASS history languages ' + JSON.stringify({ name,checks,scenarios,rows: rows.length,pending: 2,originalDatePrecedenceAndFormat: true,literalNamesAndStatuses: true,noOperationalWrites: true }));
  }
  await openHistory('native');const historyEntryStorage = await raw();await matrix({ name: 'real-complete-own-reg-extra-date-and-filter' });
  await openHistory('fallbacks');await matrix({ name: 'missing-and-invalid-date-and-name-fallbacks' });
  await locale('pt');await page.evaluate(() => { for (const node of [...document.querySelectorAll('[data-cw-history-copy]'),...document.querySelectorAll('#historyList b,#historyList small')]) node.replaceChildren(document.createTextNode(node.textContent)); });await matrix({ name: 'foreign-identical-card-and-status-leaves',widths: [320],foreign: true });
  await openHistory('empty');await matrix({ name: 'empty-complete-list',status: 'noCompleted',tone: 'warning',rows: [],empty: true,widths: [320] });
  await locale('pt');await page.evaluate(() => { for (const node of [...document.querySelectorAll('[data-cw-history-copy]'),document.querySelector('#historyList .empty')]) node.replaceChildren(document.createTextNode(node.textContent)); });await matrix({ name: 'foreign-identical-empty-and-status',status: 'noCompleted',tone: 'warning',rows: [],empty: true,foreign: true,widths: [320] });
  for (const next of ['incomplete','total-mismatch','visits-not-array']) { await openHistory(next);await matrix({ name: next,status: 'incomplete',tone: 'error',rows: [],empty: true,widths: [320] }); }
  await openHistory('http');await matrix({ name: 'owned-http-fallback-original-error',status: 'http',tone: 'error',rows: [],empty: true,widths: [320] });
  await page.evaluate(async () => { window.qaHistoryError = await parseResponse(new Response('{}',{ status: 503 })).catch(error => error);window.qaHistoryClone = new Error(qaHistoryError.message);setStatus(qaHistoryClone.message,'error'); });
  await matrix({ name: 'cloned-error-message-remains-literal',rawStatus: 'Falha HTTP 503',tone: 'error',rows: [],empty: true,widths: [320] });
  await openHistory('server-identical');await matrix({ name: 'server-error-identical-to-own-incomplete',rawStatus: words.incomplete[0],tone: 'error',rows: [],empty: true,widths: [320] });
  await openHistory('server-detail');await matrix({ name: 'literal-server-error-detail',rawStatus: 'Source failure <b>{count}</b>',tone: 'error',rows: [],empty: true,widths: [320] });
  await openHistory('native');await page.evaluate(async () => { const original = window.fetch;window.fetch = (...args) => String(args[0]).startsWith('/api/technician/today?') ? Promise.reject(new Error('')) : original(...args);try { await loadHistory(); } finally { window.fetch = original; } });await matrix({ name: 'original-empty-error-message-catch-fallback',status: 'loadFailed',tone: 'error',rows: [],empty: true,widths: [320] });
  await openHistory('loading');await matrix({ name: 'original-loading-producer-held-real-response',status: 'loading',rows: [],noList: true,widths: [320] });profile = 'native';release();await page.waitForFunction(() => document.querySelectorAll('#historyList .item').length === 3);
  await page.evaluate(() => { for (const key of ['user','cristalwater_user']) localStorage.setItem(key,JSON.stringify({ id: 0,role: 'TECHNICIAN' })); });
  await page.goto(base + '/technician-history',{ waitUntil: 'networkidle' });await page.waitForFunction(() => window.CristalI18n && document.getElementById('statusBox').textContent !== 'A carregar historico.');await matrix({ name: 'original-valid-role-missing-technician-id',status: 'missingTechnician',tone: 'error',rows: [],empty: true,widths: [320] });
  await page.evaluate(source => { for (const key of ['user','cristalwater_user']) localStorage.setItem(key,JSON.stringify(source)); },source);await openHistory('native');
  await page.evaluate(() => navigator.serviceWorker.ready);await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForFunction(async () => { const cache = await caches.open([...await caches.keys()].find(key => key.startsWith('cristalwater-field-')));return !!await cache.match('/technician-history') && !!await cache.match('/technician-history.js'); });
  const beforeOffline = await raw(),dbOffline = await database();await context.setOffline(true);
  await matrix({ name: 'real-in-memory-history-offline' });
  await page.reload({ waitUntil: 'domcontentloaded' });await page.waitForFunction(() => window.CristalI18n && document.getElementById('statusBox').dataset.tone === 'error');
  const rawOffline = await page.locator('#statusBox').textContent();assert.equal(rawOffline,'Failed to fetch');await matrix({ name: 'real-cached-shell-no-invented-history-cache',rawStatus: rawOffline,tone: 'error',rows: [],empty: true,widths: [320] });
  assert.deepEqual(await raw(),beforeOffline);assert.deepEqual(await pending(),originalPending);assert.deepEqual(await database(),dbOffline);
  for (const type of ['REGULAR','EXTRA']) { await openField(type);assert.deepEqual(await page.evaluate(ids => ids.map(id => { const node = document.getElementById(id);return [id,node.value,node.checked]; }),fieldIds),visitFields[type]);assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt),null); }
  assert.deepEqual(await pending(),originalPending);const draftKey = 'cwFieldVisitDrafts:v2:TECH:' + tech.id;assert.equal((await raw())[draftKey],historyEntryStorage[draftKey]);
  assert.deepEqual(errors,[]);assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));await context.close();
  const leaderContext = await makeContext(leaderToken,{ id: leader.id,role: 'TEAM_LEADER',name: leader.name }),leaderPage = await leaderContext.newPage(),leaderErrors = [],leaderRequests = [];
  leaderPage.on('pageerror',error => leaderErrors.push(error.message));leaderPage.on('request',request => { const path = new URL(request.url()).pathname;if (path.startsWith('/api/')) leaderRequests.push({ path,method: request.method(),body: request.postData(),auth: request.headers().authorization }); });
  await leaderPage.goto(base + '/technician-history',{ waitUntil: 'networkidle' });await leaderPage.waitForFunction(() => window.CristalI18n && document.getElementById('statusBox').dataset.tone === 'warning');
  const leaderTokens = await leaderPage.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),leaderDb = await database(),first = leaderRequests.length;
  await leaderPage.evaluate(() => { window.qaLeaderNodes = [...document.querySelectorAll('main,main *,title')];window.qaLeaderCalls = 0;for (const name of ['loadHistory','render','userData']) { const original = window[name];window[name] = (...args) => { qaLeaderCalls++;return original(...args); }; } });
  for (const width of [320,390,1440]) { await leaderPage.setViewportSize({ width,height: 1400 });for (const [index,language] of languages.entries()) {
    await leaderPage.locator('#cwLanguageSelect').selectOption(language);await leaderPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await leaderPage.locator('#statusBox').textContent(),words.noCompleted[index]);assert.equal(await leaderPage.locator('#historyList .empty').textContent(),words.empty[index]);assert.equal(await leaderPage.title(),words.title[index]);
    assert.equal(await leaderPage.evaluate(() => getComputedStyle(document.documentElement).visibility),'visible');assert(await leaderPage.evaluate(() => qaLeaderCalls === 0 && qaLeaderNodes.every(node => node.isConnected) && document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(await leaderPage.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),leaderTokens);assert.deepEqual(await database(),leaderDb);checks++;
    if (process.env.CW_HISTORY_CAPTURE && width === 320 && language === 'de') await leaderPage.locator('main').screenshot({ path: process.env.CW_HISTORY_CAPTURE + '/actual-team-leader-empty-de-320.png' });
  }}
  for (const request of leaderRequests.slice(first)) { assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.equal(request.auth,'Bearer ' + leaderToken); }
  assert.deepEqual(leaderErrors,[]);scenarios++;await leaderContext.close();
  console.log('PASS history language result ' + JSON.stringify({ checks,scenarios,ownedEntries: 16,languages: 5,realScopedFourVisitsThreeCompleted: true,originalDatePrecedenceFormatAndInvalidDateLiteral: true,techAndTeamLeader: true,readOnly: true,typedDraftFields: 13,immutablePending: 2,realOfflineNoHistoryCacheInvented: true,rawErrorsAndSourceNamesLiteral: true,noOperationalWrites: true }));completed = true;
})().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => { if (typeof release === 'function') release();clearTimeout(deadline);await browser?.close();await prisma.$disconnect(); });
