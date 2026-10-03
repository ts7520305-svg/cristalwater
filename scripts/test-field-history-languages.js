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
let browser, release, completed = false, checks = 0, scenarios = 0, emptyProviderChecks = 0, actualEmptyBadgeChecks = 0;
const sharedEmptyLabels = ['Sem dados','No data','Aucune donnée','Sin datos','Keine Daten'];
async function sharedEmptyProvider(page, index) {
  const actual = await page.evaluate(() => {
    // Detached QA probes verify all four shared selectors while their body is
    // source text, identical to the Portuguese badge, and must stay literal.
    const probe = document.createElement('div'); probe.dataset.cwNoI18n = '';
    probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;pointer-events:none;';
    const nodes = ['cw-v2-state-empty','empty','empty-box',null].map(className => {
      const node = document.createElement('div'); if (className) node.className = className; else node.dataset.cwState = 'empty';
      node.textContent = 'Sem dados'; probe.appendChild(node); return node;
    });
    document.body.appendChild(probe);
    try { return nodes.map(node => ({ content: getComputedStyle(node,'::before').content, body: node.textContent })); }
    finally { probe.remove(); }
  });
  assert.deepEqual(actual,Array.from({ length: 4 },() => ({ content: JSON.stringify(sharedEmptyLabels[index]),body: 'Sem dados' })));
  emptyProviderChecks += 4;
}

const deadline = setTimeout(() => { console.error('History language scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
// Await the resolved cache predicate in Node; a Promise itself is truthy.
async function waitForCache(page, predicate, expected) {
  const started=Date.now();let actual;
  do {
    actual=await page.evaluate(predicate,expected);
    if (actual === true) return;
    await new Promise(resolve=>setTimeout(resolve,50));
  } while (Date.now()-started < 10000);
  assert.equal(actual,true,'Exact cached application files must be ready within 10000ms');
}
(async () => {
  const now = Date.now(), parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const day = ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-'), scheduledAt = new Date(day + 'T12:00:00.000Z');
  const vehicle = await prisma.vehicle.create({ data: { plate: 'PROFILE-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Profile owner <b>{day}</b>', email: 'history-tech-'+now+'@qa.test', vehicleId: vehicle.id, active: true } });
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
  const leader = await prisma.technician.create({ data: { name: 'Actual profile team leader', email: 'history-leader-'+now+'@qa.test', role: 'TEAM_LEADER', active: true } });
  const associatedUsers=await Promise.all([tech,leader].map(person=>prisma.user.create({data:{email:person.email,name:person.name,role:person.role,password:'unused',active:true}})));
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

  await prisma.pool.update({ where: { id: pools[0].id },data: { name: 'Piscina', zone: 'Zona' } });
  await prisma.pool.update({ where: { id: pools[1].id },data: { name: 'Extra history source <b>{date}</b> ' + 'x'.repeat(90) } });
  await prisma.client.update({ where: { id: client.id },data: { name: 'Cliente', zone: 'Zona' } });
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
    if (profile === 'wrong-owner') json.technicianId = other.id;
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
      await sharedEmptyProvider(page,index);
      assert.equal(await page.title(),words.title[copyIndex]);
      for (const key of ['technician','heading','intro']) assert.equal(await page.locator('[data-cw-history-copy=' + key + ']').textContent(),words[key][copyIndex]);
      assert.equal(await page.locator('#statusBox').textContent(),rawStatus || text(status,copyIndex,{ count: rows.length,status: 503 }));
      const actual = await page.locator('#historyList .item').evaluateAll(nodes => nodes.map(node => [node.querySelector('b').textContent,...[...node.querySelectorAll('small')].map(node => node.textContent)]));
      assert.deepEqual(actual,rows.map((v,pos) => [v.pool?.name || words.pool[copyIndex],v.client?.name || words.client[copyIndex],text('line',copyIndex,{ date: dates[pos] || words.noDate[copyIndex],status: v.status || '-' })]));
      assert.equal(await page.locator('#historyList .empty').count(),empty ? 1 : 0);if (empty) assert.equal(await page.locator('#historyList .empty').textContent(),words.empty[copyIndex]);if (noList) assert.equal(await page.locator('#historyList').textContent(),'');
      if (empty) { assert.equal(await page.locator('#historyList .empty').evaluate(node => getComputedStyle(node,'::before').content),JSON.stringify(sharedEmptyLabels[index]));actualEmptyBadgeChecks++; }
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
  for (const next of ['incomplete','total-mismatch','visits-not-array','wrong-owner']) { await openHistory(next);await matrix({ name: next,status: 'incomplete',tone: 'error',rows: [],empty: true,widths: [320] }); }
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
  const visibleHistory=await page.locator('#historyList').innerHTML(),sameCount=requests.length;
  await page.evaluate(()=>dispatchEvent(new CustomEvent('cw:session-change')));assert.equal(await page.locator('#historyList').innerHTML(),visibleHistory);assert.equal(requests.length,sameCount);
  let readEntered;const readBegun=new Promise(resolve=>readEntered=resolve),readGate=new Promise(resolve=>{release=resolve;});
  await page.route(endpoint,async route=>{const response=await route.fetch();readEntered();await readGate;await route.fulfill({response}).catch(()=>{});},{times:1});
  await page.evaluate(()=>{window.qaHistoryRead=loadHistory();});await readBegun;
  const nativeAbort=page.waitForEvent('requestfailed',{predicate:request=>new URL(request.url()).pathname==='/api/technician/today',timeout:10000});nativeAbort.catch(()=>{});
  const foreignToken=jwt.sign({id:other.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'});
  const cleared=await page.evaluate(({foreignToken,other})=>{
    const keys=['token','cristalwater_jwt','adminToken','user','cristalwater_user'],before=keys.map(key=>localStorage.getItem(key)),view=()=>({items:document.querySelectorAll('#historyList .item').length,empty:document.querySelectorAll('#historyList .empty').length});
    for(const key of keys.slice(0,3))localStorage.setItem(key,foreignToken);for(const key of keys.slice(3))localStorage.setItem(key,JSON.stringify({id:other.id,role:'TECHNICIAN'}));dispatchEvent(new CustomEvent('cw:session-change'));const changed=view();
    keys.forEach((key,index)=>before[index]===null?localStorage.removeItem(key):localStorage.setItem(key,before[index]));dispatchEvent(new CustomEvent('cw:session-change'));return {changed,returned:view()};
  },{foreignToken,other});
  assert.deepEqual(cleared,{changed:{items:0,empty:0},returned:{items:0,empty:0}},'History must clear synchronously and cannot reopen after rapid account return');await nativeAbort;release();release=null;await page.evaluate(()=>qaHistoryRead);
  assert.equal(await page.locator('#historyList').innerHTML(),'');const closedCount=requests.length;await page.evaluate(()=>loadHistory());assert.equal(requests.length,closedCount);assert.deepEqual(await pending(),originalPending);
  for(const language of languages){await locale(language);assert.equal(await page.locator('#statusBox').textContent(),await page.evaluate(language=>CWFieldWriteStore.message('sessionPreserved',language),language));assert.equal(await page.locator('#historyList').innerHTML(),'');}
  await openHistory('native');assert.equal(await page.locator('#historyList .item').count(),3);
  console.log('PASS history session event: same owner retained, synchronous A-B-A clear, native GET abort, five-language refusal, own reload and original typed pending bytes');
  await page.evaluate(() => navigator.serviceWorker.ready);await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const sharedEmptyCss = await fs.readFile('frontend/ui/components/empty-state.css','utf8');
  const routeWorker=await fs.readFile('frontend/sw.js','utf8'),routeCacheDeclarations=[...routeWorker.matchAll(/^const CACHE = '(cristalwater-field-[0-9]{8}-v[0-9]+)';$/gm)];
  assert.equal(routeCacheDeclarations.length,1,'One exact application cache declaration is required');
  const routeCacheVersion=routeCacheDeclarations[0][1];
  const historySources=await Promise.all([['/technician-history','frontend/technician-history.html'],['/technician-history.js','frontend/technician-history.js'],['/cw-field-write-store.js','frontend/cw-field-write-store.js']].map(async([url,file])=>[url,await fs.readFile(file,'utf8')]));
  await waitForCache(page,async expected => { const cache = await caches.open(expected.version),css = await cache.match('/ui/components/empty-state.css');if(!css||await css.text()!==expected.css)return false;for(const[url,source]of expected.sources){const response=await cache.match(url);if(!response||await response.text()!==source)return false;}return true; },{css:sharedEmptyCss,version:routeCacheVersion,sources:historySources});
  const beforeOffline = await raw(),dbOffline = await database();await context.setOffline(true);
  await matrix({ name: 'real-in-memory-history-offline' });
  await page.reload({ waitUntil: 'domcontentloaded' });await page.waitForFunction(() => window.CristalI18n && document.getElementById('statusBox').dataset.tone === 'error');
  const rawOffline = await page.locator('#statusBox').textContent();assert.equal(rawOffline,'Failed to fetch');await matrix({ name: 'real-cached-shell-no-invented-history-cache',rawStatus: rawOffline,tone: 'error',rows: [],empty: true,widths: [320] });
  assert(await page.evaluate(foreignToken=>{const keys=['token','cristalwater_jwt','adminToken'],saved=keys.map(key=>localStorage.getItem(key));for(const key of keys)localStorage.setItem(key,foreignToken);dispatchEvent(new CustomEvent('cw:session-change'));const changed=document.getElementById('historyList').childElementCount===0;keys.forEach((key,i)=>saved[i]===null?localStorage.removeItem(key):localStorage.setItem(key,saved[i]));dispatchEvent(new CustomEvent('cw:session-change'));return changed&&document.getElementById('historyList').childElementCount===0&&document.getElementById('statusBox').textContent===CWFieldWriteStore.message('sessionPreserved');},foreignToken));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('statusBox')?.dataset.tone==='error');assert.equal(await page.locator('#statusBox').textContent(),'Failed to fetch');
  assert.deepEqual(await raw(),beforeOffline);assert.deepEqual(await pending(),originalPending);assert.deepEqual(await database(),dbOffline);
  for (const type of ['REGULAR','EXTRA']) { await openField(type);assert.deepEqual(await page.evaluate(ids => ids.map(id => { const node = document.getElementById(id);return [id,node.value,node.checked]; }),fieldIds),visitFields[type]);assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt),null); }
  assert.deepEqual(await pending(),originalPending);const draftKey = 'cwFieldVisitDrafts:v2:TECH:' + tech.id;assert.equal((await raw())[draftKey],historyEntryStorage[draftKey]);
  // The legacy route shares the original authenticated fixtures and typed outbox.
  // Keep history assertions/timers intact; only explicit GET fault profiles below
  // replace native responses. The healthy response and scoped IDs remain real.
  // Leave the write-capable field page while still offline, so reconnecting
  // cannot start its normal queued-work sender before the read-only phase.
  await page.goto(base + '/technician-history',{ waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => window.CristalI18n && document.getElementById('statusBox').dataset.tone === 'error');
  await context.setOffline(false); profile = 'native';
  const routeWords = {"title": ["Cristal Water - Rota Tecnica", "Cristal Water - Technician Route", "Cristal Water - Itinéraire du technicien", "Cristal Water - Ruta del técnico", "Cristal Water - Technikerroute"], "shift": ["Turno tecnico", "Technician shift", "Service du technicien", "Turno del técnico", "Technikerschicht"], "heading": ["Rota do Dia", "Today’s Route", "Itinéraire du jour", "Ruta del día", "Tagesroute"], "intro": ["Consulte a sequência de piscinas planeadas para hoje.", "View the sequence of pools planned for today.", "Consultez la liste des piscines prévues pour aujourd’hui.", "Consulta la secuencia de piscinas previstas para hoy.", "Sehen Sie die Reihenfolge der heute geplanten Pools."], "back": ["Voltar", "Back", "Retour", "Volver", "Zurück"], "refresh": ["Atualizar rota", "Refresh route", "Actualiser l’itinéraire", "Actualizar ruta", "Route aktualisieren"], "field": ["Modo campo", "Field mode", "Mode terrain", "Modo de campo", "Außendienst"], "planned": ["Piscinas planeadas", "Planned pools", "Piscines prévues", "Piscinas previstas", "Geplante Pools"], "suggestions": ["Sugestoes", "Suggestions", "Suggestions", "Sugerencias", "Hinweise"], "preparing": ["A preparar rota tecnica.", "Preparing technician route.", "Préparation de l’itinéraire du technicien.", "Preparando la ruta del técnico.", "Technikerroute wird vorbereitet."], "emptyRoute": ["Sem rota planeada para hoje.", "No route planned for today.", "Aucun itinéraire prévu pour aujourd’hui.", "No hay ruta prevista para hoy.", "Für heute ist keine Route geplant."], "client": ["Cliente {id}", "Client {id}", "Client {id}", "Cliente {id}", "Kunde {id}"], "unnamedPool": ["Piscina sem nome", "Unnamed pool", "Piscine sans nom", "Piscina sin nombre", "Unbenannter Pool"], "location": ["Local por confirmar", "Location to confirm", "Lieu à confirmer", "Ubicación por confirmar", "Ort noch zu bestätigen"], "noTime": ["Sem hora", "No time", "Sans heure", "Sin hora", "Keine Uhrzeit"], "stop": ["Paragem {number}", "Stop {number}", "Étape {number}", "Parada {number}", "Stopp {number}"], "locationTime": ["{location} · {time}", "{location} · {time}", "{location} · {time}", "{location} · {time}", "{location} · {time}"], "emptySuggestions": ["Sem sugestoes para mostrar.", "No suggestions to show.", "Aucune suggestion à afficher.", "No hay sugerencias para mostrar.", "Keine Hinweise verfügbar."], "pool": ["Piscina", "Pool", "Piscine", "Piscina", "Pool"], "zone": ["Zona {zone}", "Zone {zone}", "Zone {zone}", "Zona {zone}", "Gebiet {zone}"], "zoneUnset": ["Zona por definir", "Zone to define", "Zone à définir", "Zona por definir", "Gebiet noch festzulegen"], "traffic": ["Verificar transito e acessos antes de sair.", "Check traffic and access before leaving.", "Vérifiez la circulation et les accès avant de partir.", "Comprueba el tráfico y los accesos antes de salir.", "Prüfen Sie Verkehr und Zufahrt vor der Abfahrt."], "noSuggestions": ["Sem dados suficientes para sugestoes automáticas.", "Not enough data for automatic suggestions.", "Données insuffisantes pour proposer des suggestions automatiques.", "No hay datos suficientes para sugerencias automáticas.", "Nicht genügend Daten für automatische Hinweise."], "missingTech": ["Sessao tecnica sem tecnico associado.", "No technician is associated with this session.", "Aucun technicien n’est associé à cette session.", "No hay ningún técnico asociado a esta sesión.", "Dieser Sitzung ist kein Techniker zugeordnet."], "missingSession": ["Nao foi possivel determinar o tecnico da sessao.", "Could not identify the session’s technician.", "Impossible d’identifier le technicien de la session.", "No se pudo identificar al técnico de la sesión.", "Der Techniker dieser Sitzung konnte nicht ermittelt werden."], "loading": ["A carregar rota do dia.", "Loading today’s route.", "Chargement de l’itinéraire du jour.", "Cargando la ruta del día.", "Tagesroute wird geladen."], "incomplete": ["A resposta não confirma a rota completa. Atualize antes de navegar.", "The response does not confirm the complete route. Refresh before navigating.", "La réponse ne confirme pas l’itinéraire complet. Actualisez avant de naviguer.", "La respuesta no confirma la ruta completa. Actualiza antes de navegar.", "Die Antwort bestätigt keine vollständige Route. Aktualisieren Sie vor der Navigation."], "loaded": ["Rota carregada com {count} paragem(ns).", "Route loaded with {count} stop(s).", "Itinéraire chargé avec {count} étape(s).", "Ruta cargada con {count} parada(s).", "Route mit {count} Stopp(s) geladen."], "noStops": ["Sem paragens para hoje.", "No stops for today.", "Aucune étape pour aujourd’hui.", "No hay paradas para hoy.", "Keine Stopps für heute."], "failed": ["Falha ao carregar rota.", "Failed to load route.", "Échec du chargement de l’itinéraire.", "Error al cargar la ruta.", "Route konnte nicht geladen werden."], "http": ["Falha HTTP {status}", "HTTP failure {status}", "Échec HTTP {status}", "Error HTTP {status}", "HTTP-Fehler {status}"], "routeUnavailable": ["Não foi possível carregar a rota. Atualize para tentar novamente.", "Could not load the route. Refresh to try again.", "Impossible de charger l’itinéraire. Actualisez pour réessayer.", "No se pudo cargar la ruta. Actualiza para volver a intentarlo.", "Route konnte nicht geladen werden. Aktualisieren Sie, um es erneut zu versuchen."], "suggestionsUnavailable": ["Não foi possível carregar as sugestões.", "Could not load suggestions.", "Impossible de charger les suggestions.", "No se pudieron cargar las sugerencias.", "Hinweise konnten nicht geladen werden."]}, routeTokens = await page.evaluate(() => ['token','cristalwater_jwt','adminToken','user','cristalwater_user'].map(key => localStorage.getItem(key)));
  let routeFault = 'native', routeRelease, routeHeld = 0, routeClosing = false, routeCases = 0, routeOwnershipChecks = 0, routeEmptyBadgeChecks = {error:0,empty:0};
  const routePayload = () => {
    const json = structuredClone(sourceRows);
    if (routeFault === 'empty') { json.visits = []; json.total = 0; }
    if (routeFault === 'incomplete') json.complete = false;
    if (routeFault === 'wrong-owner') json.technicianId = other.id;
    if (routeFault === 'total-mismatch') json.total++;
    if (routeFault === 'visits-not-array') json.visits = {};
    if (routeFault === 'fallbacks') {
      Object.assign(json.visits[0], { pool: null, client: null, plannedDate: null, startAt: null, date: null });
      Object.assign(json.visits[1], { pool: { name: 'Piscina', zone: 'Zona', location: 'Local por confirmar' }, client: { name: 'Cliente' }, plannedDate: 'invalid-date' });
    }
    if (routeFault === 'no-zones') for (const visit of json.visits) { if (visit.pool) visit.pool.zone = null; if (visit.client) visit.client.zone = null; }
    return json;
  };
  const routeHandler = async route => {
    try {
      if (routeFault === 'native') return await route.continue();
      if (routeFault === 'loading') { routeHeld++; await new Promise(resolve => { routeRelease = resolve; }); return await route.continue(); }
      if (routeFault === 'http') return await route.fulfill({ status: 503, json: {} });
      if (routeFault === 'server-identical') return await route.fulfill({ status: 503, json: { error: routeWords.incomplete[0] } });
      if (routeFault === 'server-detail') return await route.fulfill({ status:503,json:{ message:'Source route failure <b>{count}</b>' } });
      return await route.fulfill({ status: 200, json: routePayload() });
    } catch (error) { if (!routeClosing) throw error; }
  };
  await page.route(endpoint, routeHandler);
  const routeText = (key, index, params = {}) => routeWords[key][index].replace(/\{(\w+)\}/g, (_, key) => String(params[key]));
  const routeSession = () => page.evaluate(() => ({ tokens:['token','cristalwater_jwt','adminToken'].map(key=>localStorage.getItem(key)), actors:['user','cristalwater_user'].map(key=>{const actor=JSON.parse(localStorage.getItem(key));delete actor.language;return actor;}) }));
  async function openRoute(fault = 'native') {
    routeFault = fault; routeRelease = null;
    await page.goto(base + '/technician-route?lang=de', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.CristalI18n && document.getElementById('cwLanguageSelect'));
    if (fault === 'loading') await page.waitForFunction(() => document.getElementById('refreshBtn').disabled);
    else { await page.waitForFunction(() => !document.getElementById('refreshBtn').disabled); await page.waitForLoadState('networkidle'); }
    await settle();
  }
  async function routeMatrix({ name = routeFault, status = 'loaded', rawStatus, tone = '', rows = routeFault === 'fallbacks' ? routePayload().visits : sourceRows.visits, widths = [320,390,1440], empty = false, unavailable = false, missing = false, busy = false, ownership = false } = {}) {
    const before = { raw: await raw(), pending: await pending(), db: await database(), tokens: await routeSession() }, first = requests.length;
    await page.evaluate(() => {
      window.qaRouteNodes = [...document.querySelectorAll('main.route-shell,main.route-shell *,title')]; window.qaRouteLeaves = qaRouteNodes.map(node => node.firstChild);
      window.qaRouteCalls = {};
      for (const name of ['loadRoute','renderRoute','renderSuggestions','renderEmpty','parseResponse','userData','setStatus']) { const original = window[name]; window[name] = (...args) => { qaRouteCalls[name] = (qaRouteCalls[name] || 0) + 1; return original(...args); }; }
      document.getElementById('refreshBtn').focus();
    });
    for (const width of widths) { await page.setViewportSize({ width, height: 1400 }); for (const [index, language] of languages.entries()) {
      const focus = await page.evaluate(() => document.activeElement.id);
      await page.evaluate(language => CristalI18n.applyLanguage(language), language); await settle();
      assert.equal(await page.title(), ownership ? 'Foreign route title <b>{literal}</b>' : routeWords.title[index]);
      assert.equal(await page.locator('.route-header .route-title').textContent(), ownership ? 'Foreign heading' : routeWords.heading[index]);
      assert.equal(await page.locator('#refreshBtn').textContent(), ownership ? 'Refresh leaf replaced' : routeWords.refresh[index]);
      assert.equal(await page.locator('#refreshBtn').isDisabled(), busy);
      for (const [selector, key] of [['.route-header .route-muted:first-of-type','shift'], ['.route-header .route-muted:nth-of-type(2)','intro'], ['.route-actions [data-cw-back]','back'], ['.route-actions a[href="/technician-field-mode"]','field'], ['main > section:nth-of-type(1) h2','planned'], ['main > section:nth-of-type(2) h2','suggestions']]) {
        if (ownership && key === 'planned') { assert.equal(await page.locator(selector).textContent(), 'Original replaced leaf'); continue; }
        assert.equal(await page.locator(selector).textContent(), routeWords[key][index]);
      }
      assert.equal(await page.locator('#statusBox').textContent(), rawStatus ?? routeText(status,index,{ count: rows.length, status: 503 }));
      assert.equal((await page.locator('#statusBox').getAttribute('data-tone')) || '', tone);
      assert.equal(await page.locator('#statusBox').getAttribute('role'),tone === 'error' ? 'alert' : 'status');
      assert.equal(await page.locator('#statusBox').getAttribute('aria-live'),tone === 'error' ? 'assertive' : 'polite');
      if (empty || missing) {
        assert.equal(await page.locator('#route .empty').textContent(), routeWords[missing ? 'missingSession' : unavailable ? 'routeUnavailable' : 'emptyRoute'][index]);
        assert.equal(await page.locator('#route .empty').getAttribute('data-cw-state'),unavailable || missing ? 'error' : 'empty');
        assert.equal(await page.locator('#route .empty').getAttribute('role'),'status');
        if (!missing) { assert.equal(await page.locator('#suggestions .empty').textContent(),routeWords[unavailable ? 'suggestionsUnavailable' : 'emptySuggestions'][index]);assert.equal(await page.locator('#suggestions .empty').getAttribute('data-cw-state'),unavailable ? 'error' : 'empty'); }
      } else if (!busy) {
        assert.equal(await page.locator('#route > .route-item').count(), rows.length);
        for (const [order, visit] of rows.entries()) {
          const article = page.locator('#route > .route-item').nth(order), when = visit.plannedDate || visit.startAt || visit.date;
          assert.equal(await article.locator('small').nth(0).textContent(), routeText('stop',index,{ number: order + 1 }));
          assert.equal(await article.locator('b').textContent(), visit.pool?.name || routeWords.unnamedPool[index]);
          assert.equal(await article.locator('small').nth(1).textContent(), visit.client?.name || routeText('client',index,{ id: visit.clientId || '-' }));
          const formatted = when ? new Date(when).toLocaleString('pt-PT',{ dateStyle: 'short', timeStyle: 'short' }) : routeWords.noTime[index];
          assert.equal(await article.locator('small').nth(2).textContent(), (visit.pool?.location || visit.pool?.address || routeWords.location[index]) + ' · ' + formatted);
          assert.equal(await article.locator('b b,img').count(),0);
        }
        const suggestions = rows.filter(visit => Boolean(visit.pool?.zone || visit.client?.zone)).slice(0,4);
        assert.equal(await page.locator('#suggestions > .route-item').count(),suggestions.length);
        for (const [order, visit] of suggestions.entries()) {
          const article = page.locator('#suggestions > .route-item').nth(order);
          assert.equal(await article.locator('b').textContent(),visit.pool?.name || routeWords.pool[index]);
          assert.equal(await article.locator('small').nth(0).textContent(),routeText('zone',index,{ zone: visit.pool?.zone || visit.client?.zone }));
          assert.equal(await article.locator('small').nth(1).textContent(),routeWords.traffic[index]);
        }
        if (!suggestions.length) assert.equal(await page.locator('#suggestions .empty').textContent(),routeWords.noSuggestions[index]);
      }
      const routeBadges=await page.locator('#route > .empty,#suggestions > .empty').evaluateAll(nodes=>nodes.map(node=>({box:node.parentElement.id,display:getComputedStyle(node,'::before').display,content:getComputedStyle(node,'::before').content})));
      for(const badge of routeBadges){
        const expectedError=unavailable || (missing && badge.box==='route');
        assert.equal(badge.display==='none',expectedError,JSON.stringify({name,language,card:badge.box,expectedError,actualBadge:badge.content}));
        assert.equal(badge.content,expectedError?'none':JSON.stringify(sharedEmptyLabels[index]));
        routeEmptyBadgeChecks[expectedError?'error':'empty']++;
      }
      assert.equal(await page.evaluate(() => document.activeElement.id),focus);
      assert(await page.evaluate(() => qaRouteNodes.every((node,index) => node.isConnected && node.firstChild === qaRouteLeaves[index]) && Object.keys(qaRouteCalls).length === 0));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await page.locator('.route-actions > button,.route-actions > a').evaluateAll(nodes => nodes.every(node => { const box=node.getBoundingClientRect();return box.height>=44 && box.width>=44 && box.left>=0 && box.right<=innerWidth; })));
      for (const selector of ['.route-card','#statusBox','#route .route-item','#suggestions .route-item']) {
        const overflow=await page.locator(selector).evaluateAll(nodes=>nodes.map((node,index)=>({index,scroll:node.scrollWidth,client:node.clientWidth})).filter(node=>node.scroll>node.client+1));
        if (overflow.length && process.env.CW_HISTORY_CAPTURE) await page.locator('main').screenshot({path:process.env.CW_HISTORY_CAPTURE+'/legacy-route-overflow-'+name+'-'+language+'-'+width+'.png'});
        assert.deepEqual(overflow,[],selector+' '+language+' '+width);
      }
      assert.deepEqual(await raw(),before.raw); assert.deepEqual(await pending(),before.pending); assert.deepEqual(await database(),before.db);
      assert.deepEqual(await routeSession(),before.tokens);
      assert.deepEqual(await page.evaluate(() => ['user','cristalwater_user'].map(key=>JSON.parse(localStorage.getItem(key)).language)),[language,language]);
      for (const request of requests.slice(first)) { assert.equal(request.path,'/api/settings/language/me'); assert.equal(request.method,'PUT'); assert.equal(request.auth,'Bearer ' + token); }
      // The real selector changes locale without calling any route producer.
      await page.locator('#cwLanguageSelect').selectOption(language); await settle();
      assert(await page.evaluate(() => Object.keys(qaRouteCalls).length === 0)); routeCases++;
      if (ownership) { assert.equal(await page.locator('#qaRouteClone').textContent(),'Stale clone'); routeOwnershipChecks += 5; }
      if (process.env.CW_HISTORY_CAPTURE && !ownership && language === 'de' && [320,1440].includes(width) && ['native','empty','incomplete','loading'].includes(name)) await page.locator('main').screenshot({ path:process.env.CW_HISTORY_CAPTURE+'/legacy-route-'+name+'-de-'+width+'.png' });
    } }
    console.log('PASS legacy route languages ' + JSON.stringify({ name,routeCases,routeOwnershipChecks,rows:rows.length,pending:2,noOperationalWrites:true }));
  }
  await openRoute(); await routeMatrix();
  assert.deepEqual(await pending(),originalPending); assert.deepEqual(await page.evaluate(() => ['token','cristalwater_jwt','adminToken','user','cristalwater_user'].map(key => localStorage.getItem(key))),routeTokens);
  const routeSource=await fs.readFile('frontend/technician-route.js','utf8'),routeShell=await fs.readFile('frontend/technician-route.html','utf8');
  console.log('PRECONDITION declared route cache ' + JSON.stringify(await page.evaluate(async expected=>{const cache=await caches.open(expected.version),script=await cache.match('/technician-route.js'),plain=await cache.match('/technician-route'),shell=await cache.match('/technician-route',{ignoreSearch:true});return {version:expected.version,routeUrls:(await cache.keys()).map(request=>new URL(request.url).pathname+new URL(request.url).search).filter(url=>url.startsWith('/technician-route')),plainShellPresent:!!plain,navigationShellPresent:!!shell,exactScript:!!script && await script.text()===expected.script,exactShell:!!shell && await shell.text()===expected.shell};},{script:routeSource,shell:routeShell,version:routeCacheVersion})));
  // Use the same ignoreSearch rule as the worker for navigation; scripts stay exact.
  await waitForCache(page,async expected=>{const cache=await caches.open(expected.version),script=await cache.match('/technician-route.js'),shell=await cache.match('/technician-route',{ignoreSearch:true}),store=await cache.match('/cw-field-write-store.js');return !!shell && await shell.text()===expected.shell && !!await cache.match('/cw-i18n.js') && !!script && await script.text()===expected.script && !!store && await store.text()===expected.store;},{script:routeSource,shell:routeShell,store:await fs.readFile('frontend/cw-field-write-store.js','utf8'),version:routeCacheVersion});
  // Repainting a real cached page offline cannot invent a route cache or send work.
  await context.setOffline(true); await routeMatrix({ name:'real-in-memory-route-offline' });
  await page.reload({ waitUntil:'domcontentloaded' }); await page.waitForFunction(() => window.CristalI18n && document.getElementById('statusBox').dataset.tone === 'error');
  const routeOfflineError = await page.locator('#statusBox').textContent(); assert.equal(routeOfflineError,'Failed to fetch');
  await routeMatrix({ name:'real-cached-shell-without-invented-route-cache',rawStatus:routeOfflineError,tone:'error',rows:[],empty:true,unavailable:true,widths:[320] });
  assert(await page.evaluate(foreignToken=>{const keys=['token','cristalwater_jwt','adminToken'],saved=keys.map(key=>localStorage.getItem(key));keys.forEach(key=>localStorage.setItem(key,foreignToken));dispatchEvent(new CustomEvent('cw:session-change'));const closed=document.getElementById('route').childElementCount===0&&document.getElementById('suggestions').childElementCount===0&&document.getElementById('refreshBtn').disabled;keys.forEach((key,i)=>saved[i]===null?localStorage.removeItem(key):localStorage.setItem(key,saved[i]));dispatchEvent(new CustomEvent('cw:session-change'));return closed&&document.getElementById('route').childElementCount===0&&document.getElementById('suggestions').childElementCount===0&&document.getElementById('refreshBtn').disabled;},foreignToken));
  assert.equal(await page.locator('#statusBox').textContent(),await page.evaluate(()=>CWFieldWriteStore.message('sessionPreserved')));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.CristalI18n&&document.getElementById('statusBox').dataset.tone==='error'&&!document.getElementById('refreshBtn').disabled);assert.equal(await page.locator('#statusBox').textContent(),routeOfflineError);assert.deepEqual(await pending(),originalPending);
  await context.setOffline(false);
  await openRoute('server-detail'); await routeMatrix({ name:'literal-server-error-detail',rawStatus:'Source route failure <b>{count}</b>',tone:'error',rows:[],empty:true,unavailable:true,widths:[320] });
  for (const fault of ['fallbacks','empty','incomplete','total-mismatch','visits-not-array','wrong-owner','http','server-identical']) {
    await openRoute(fault);
    const failed = ['incomplete','total-mismatch','visits-not-array','wrong-owner','http','server-identical'].includes(fault);
    await routeMatrix({ status: fault === 'empty' ? 'noStops' : failed ? fault === 'http' ? 'http' : 'incomplete' : 'loaded', rawStatus: fault === 'server-identical' ? routeWords.incomplete[0] : undefined, tone: fault === 'empty' ? 'warning' : failed ? 'error' : '', rows: failed || fault === 'empty' ? [] : routePayload().visits, empty: failed || fault === 'empty', unavailable:failed, widths: [320] });
  }
  await openRoute('incomplete');assert.equal(await page.locator('#route .empty').getAttribute('data-cw-state'),'error');routeFault='native';
  await page.locator('#refreshBtn').click();await page.waitForFunction(()=>!document.getElementById('refreshBtn').disabled && document.querySelectorAll('#route > .route-item').length===4);
  assert.equal(await page.locator('#route .empty').count(),0);assert.equal(await page.locator('#statusBox').getAttribute('data-cw-state'),'ready');
  await routeMatrix({ name:'explicit-refresh-recovers-only-after-complete-read',widths:[320] });
  await openRoute('no-zones'); await routeMatrix({ name:'original-no-zone-suggestions',rows:routePayload().visits,widths:[320] });
  await openRoute('http');
  await page.evaluate(async () => { const original=await parseResponse(new Response('{}',{status:503})).catch(error=>error); const clone=new Error(original.message);setStatus(clone.message,'error'); });
  await routeMatrix({ name:'cloned-owned-error-remains-literal',rawStatus:routeWords.http[0].replace('{status}','503'),tone:'error',rows:[],empty:true,unavailable:true,widths:[320] });
  await openRoute('native'); await page.evaluate(async () => { const original=window.fetch;window.fetch=(...args)=>String(args[0]).startsWith('/api/technician/today?')?Promise.reject(new Error('')):original(...args);try{await loadRoute();}finally{window.fetch=original;} });
  await routeMatrix({ name:'original-empty-error-message-catch-fallback',status:'failed',tone:'error',rows:[],empty:true,unavailable:true,widths:[320] });
  const savedRouteActors=await page.evaluate(()=>['user','cristalwater_user'].map(key=>localStorage.getItem(key)));
  await page.evaluate(()=>{for(const key of ['user','cristalwater_user']){const actor=JSON.parse(localStorage.getItem(key));delete actor.id;delete actor.technicianId;localStorage.setItem(key,JSON.stringify(actor));}});
  await openRoute('native'); await routeMatrix({ name:'original-valid-role-missing-technician-id',status:'missingTech',tone:'error',rows:[],missing:true,widths:[320] });
  await page.evaluate(saved=>['user','cristalwater_user'].forEach((key,index)=>localStorage.setItem(key,saved[index])),savedRouteActors);
  await openRoute('loading'); await routeMatrix({ status:'loading', rows:[], widths:[320], busy:true }); assert(routeHeld > 0); routeFault = 'native'; routeRelease(); await page.waitForFunction(() => !document.getElementById('refreshBtn').disabled); await page.locator('#refreshBtn').click(); await page.waitForFunction(() => !document.getElementById('refreshBtn').disabled); assert.equal(await page.locator('#route > .route-item').count(),sourceRows.visits.length);
  await page.evaluate(() => { document.title='Foreign route title <b>{literal}</b>'; document.querySelector('.route-title').textContent='Foreign heading'; document.getElementById('refreshBtn').firstChild.nodeValue='Refresh leaf replaced'; const original=document.querySelector('main > section h2');original.replaceChildren(document.createTextNode('Original replaced leaf')); const clone=document.querySelector('.route-title').cloneNode(true);clone.id='qaRouteClone';clone.textContent='Stale clone';document.querySelector('main').appendChild(clone); });
  await routeMatrix({ ownership:true,widths:[320] });
  await openRoute('native');
  const routeBefore=await page.locator('#route').innerHTML(),suggestionsBefore=await page.locator('#suggestions').innerHTML(),sameRouteStart=requests.length,routePrivacyDb=await database(),routePrivacyRaw=await raw();
  await page.evaluate(()=>dispatchEvent(new CustomEvent('cw:session-change')));assert.equal(await page.locator('#route').innerHTML(),routeBefore);assert.equal(await page.locator('#suggestions').innerHTML(),suggestionsBefore);assert.equal(requests.length,sameRouteStart);
  let routeEntered;const routeBegun=new Promise(resolve=>routeEntered=resolve),routeGate=new Promise(resolve=>{release=resolve;});
  await page.route(endpoint,async route=>{const response=await route.fetch();assert.equal(response.status(),200);assert.equal((await response.json()).technicianId,tech.id);routeEntered();await routeGate;await route.fulfill({response}).catch(()=>{});},{times:1});
  await page.evaluate(()=>{window.qaRouteRead=loadRoute();});await routeBegun;
  const routeAborted=page.waitForEvent('requestfailed',{predicate:r=>new URL(r.url()).pathname==='/api/technician/today',timeout:10000});routeAborted.catch(()=>{});
  const routePrivacy=await page.evaluate(({foreignToken,leader})=>{
    const keys=['token','cristalwater_jwt','adminToken','user','cristalwater_user'],saved=keys.map(key=>localStorage.getItem(key));
    for(const key of keys.slice(0,3))localStorage.setItem(key,foreignToken);for(const key of keys.slice(3))localStorage.setItem(key,JSON.stringify({id:leader.id,role:leader.role}));
    dispatchEvent(new CustomEvent('cw:session-change'));
    const state=()=>({route:document.getElementById('route').childElementCount,suggestions:document.getElementById('suggestions').childElementCount,disabled:document.getElementById('refreshBtn').disabled}),changed=state();
    keys.forEach((key,i)=>saved[i]===null?localStorage.removeItem(key):localStorage.setItem(key,saved[i]));dispatchEvent(new CustomEvent('cw:session-change'));return{changed,returned:state()};
  },{foreignToken,leader});
  assert.deepEqual(routePrivacy,{changed:{route:0,suggestions:0,disabled:true},returned:{route:0,suggestions:0,disabled:true}},'Route and suggestions must clear synchronously and remain closed after a rapid account return');
  await routeAborted;release();release=null;await page.evaluate(()=>qaRouteRead);
  const blockedRouteStart=requests.length;await page.evaluate(()=>loadRoute());assert.equal(requests.length,blockedRouteStart);
  for(const language of languages){await locale(language);assert.equal(await page.locator('#statusBox').textContent(),await page.evaluate(language=>CWFieldWriteStore.message('sessionPreserved',language),language));assert.equal(await page.locator('#route').innerHTML(),'');assert.equal(await page.locator('#suggestions').innerHTML(),'');assert(await page.locator('#refreshBtn').isDisabled());}
  assert.deepEqual(await pending(),originalPending);await openRoute('native');assert.equal(await page.locator('#route > .route-item').count(),sourceRows.visits.length);
  assert.deepEqual(await database(),routePrivacyDb);assert.deepEqual(await raw(),routePrivacyRaw);
  await page.clock.setFixedTime(now+3600001);assert(await page.evaluate(()=>{dispatchEvent(new Event('focus'));return document.getElementById('route').childElementCount===0&&document.getElementById('suggestions').childElementCount===0&&document.getElementById('refreshBtn').disabled;}));
  console.log('PASS legacy route native GET abort, synchronous privacy, same-account preservation, terminal rapid-return state and own reload');
  assert.deepEqual(await pending(),originalPending); assert.deepEqual(await page.evaluate(()=>['token','cristalwater_jwt','adminToken','user','cristalwater_user'].map(key=>localStorage.getItem(key))),routeTokens); assert.deepEqual(errors,[]); routeClosing=true; await page.unroute(endpoint,routeHandler);
  console.log('PASS legacy route language result ' + JSON.stringify({ routeCases,routeOwnershipChecks,routeEmptyBadgeChecks,ownedEntries:34,languages:5,widths:[320,390,1440],nativeRouteIds:sourceRows.visits.map(v=>[v.visitType,v.id]),nativeSuggestions:sourceRows.visits.filter(v=>Boolean(v.pool?.zone||v.client?.zone)).slice(0,4).length,actualQueryLanguage:true,actualSelector:true,explicitRefreshes:2,originalDatePrecedenceFormatAndInvalidDateLiteral:true,originalNodesFocusBusyGuardRetained:true,literalNamesLocationsZonesAndServerErrors:true,exactFinalRouteJsAndShellInDeclaredCacheAndRealColdOffline:true,cacheVersion:routeCacheVersion,targets44AndRowsFit:true,typedPending:2,noOperationalWrites:true }));
  assert.deepEqual(errors,[]);assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));await context.close();
  const leaderContext = await makeContext(leaderToken,{ id: leader.id,role: 'TEAM_LEADER',name: leader.name }),leaderPage = await leaderContext.newPage(),leaderErrors = [],leaderRequests = [];
  leaderPage.on('pageerror',error => leaderErrors.push(error.message));leaderPage.on('request',request => { const path = new URL(request.url()).pathname;if (path.startsWith('/api/')) leaderRequests.push({ path,method: request.method(),body: request.postData(),auth: request.headers().authorization }); });
  await leaderPage.goto(base + '/technician-history',{ waitUntil: 'networkidle' });await leaderPage.waitForFunction(() => window.CristalI18n && document.getElementById('statusBox').dataset.tone === 'warning');
  const leaderTokens = await leaderPage.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),leaderDb = await database(),first = leaderRequests.length;
  await leaderPage.evaluate(() => { window.qaLeaderNodes = [...document.querySelectorAll('main,main *,title')];window.qaLeaderCalls = 0;for (const name of ['loadHistory','render','userData']) { const original = window[name];window[name] = (...args) => { qaLeaderCalls++;return original(...args); }; } });
  for (const width of [320,390,1440]) { await leaderPage.setViewportSize({ width,height: 1400 });for (const [index,language] of languages.entries()) {
    await leaderPage.locator('#cwLanguageSelect').selectOption(language);await leaderPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await leaderPage.locator('#statusBox').textContent(),words.noCompleted[index]);assert.equal(await leaderPage.locator('#historyList .empty').textContent(),words.empty[index]);assert.equal(await leaderPage.title(),words.title[index]);
    await sharedEmptyProvider(leaderPage,index);assert.equal(await leaderPage.locator('#historyList .empty').evaluate(node => getComputedStyle(node,'::before').content),JSON.stringify(sharedEmptyLabels[index]));actualEmptyBadgeChecks++;
    assert.equal(await leaderPage.evaluate(() => getComputedStyle(document.documentElement).visibility),'visible');assert(await leaderPage.evaluate(() => qaLeaderCalls === 0 && qaLeaderNodes.every(node => node.isConnected) && document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(await leaderPage.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),leaderTokens);assert.deepEqual(await database(),leaderDb);checks++;
    if (process.env.CW_HISTORY_CAPTURE && width === 320 && language === 'de') await leaderPage.locator('main').screenshot({ path: process.env.CW_HISTORY_CAPTURE + '/actual-team-leader-empty-de-320.png' });
  }}
  for (const request of leaderRequests.slice(first)) { assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.equal(request.auth,'Bearer ' + leaderToken); }
  assert.deepEqual(leaderErrors,[]);scenarios++;await leaderContext.close();
  const sessionDb=await database();
  for(const [person,user]of [[tech,associatedUsers[0]],[leader,associatedUsers[1]],[leader,null]]){
    const actor=user?{id:user.id,userId:user.id,technicianId:person.id,role:person.role,principalType:'USER'}:{id:person.id,role:person.role},credential=jwt.sign(actor,getJwtSecret(),{expiresIn:'1h'}),owned=await makeContext(credential,actor),ownedPage=await owned.newPage();ownedPage.setDefaultTimeout(10000);
    const pageErrors=[],pageRequests=[];ownedPage.on('pageerror',e=>pageErrors.push(e.message));ownedPage.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))pageRequests.push(r.method());});
    await ownedPage.goto(base+'/technician-history',{waitUntil:'networkidle'});await ownedPage.waitForFunction(()=>['warning',''].includes(document.getElementById('statusBox').dataset.tone||'')&&!document.getElementById('statusBox').textContent.includes('A carregar'));
    assert.equal(await ownedPage.locator('#historyList .item').count(),person.id===tech.id?3:0);const before=await ownedPage.locator('#historyList').innerHTML(),first=pageRequests.length;
    await ownedPage.evaluate(()=>dispatchEvent(new CustomEvent('cw:session-change')));assert.equal(await ownedPage.locator('#historyList').innerHTML(),before);assert.equal(pageRequests.length,first);
    let entered;const begun=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>{release=resolve;});await ownedPage.route(endpoint,async route=>{const response=await route.fetch();entered();await gate;await route.fulfill({response}).catch(()=>{});},{times:1});
    await ownedPage.evaluate(()=>{window.qaRead=loadHistory();});await begun;const aborted=ownedPage.waitForEvent('requestfailed',{predicate:r=>new URL(r.url()).pathname==='/api/technician/today',timeout:10000});aborted.catch(()=>{});
    assert(await ownedPage.evaluate(foreignToken=>{const keys=['token','cristalwater_jwt','adminToken','user','cristalwater_user'],saved=keys.map(key=>localStorage.getItem(key));for(const key of keys.slice(0,3))localStorage.setItem(key,foreignToken);dispatchEvent(new CustomEvent('cw:session-change'));const changed=document.getElementById('historyList').childElementCount===0;keys.forEach((key,i)=>saved[i]===null?localStorage.removeItem(key):localStorage.setItem(key,saved[i]));dispatchEvent(new CustomEvent('cw:session-change'));return changed&&document.getElementById('historyList').childElementCount===0;},foreignToken));
    await aborted;release();release=null;await ownedPage.evaluate(()=>qaRead);assert.equal(await ownedPage.locator('#statusBox').textContent(),await ownedPage.evaluate(()=>CWFieldWriteStore.message('sessionPreserved')));
    await ownedPage.reload({waitUntil:'networkidle'});await ownedPage.waitForFunction(()=>document.querySelector('#historyList .item,#historyList .empty'));assert.equal(await ownedPage.locator('#historyList .item').count(),person.id===tech.id?3:0);
    await ownedPage.clock.setFixedTime(Date.now()+3600001);assert(await ownedPage.evaluate(()=>{dispatchEvent(new Event('focus'));return document.getElementById('historyList').childElementCount===0;}));
    await ownedPage.clock.setFixedTime(Date.now());assert.equal(await ownedPage.locator('#historyList').innerHTML(),'');
    const ownRoute=await owned.newPage();ownRoute.setDefaultTimeout(10000);ownRoute.on('pageerror',e=>pageErrors.push(e.message));ownRoute.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))pageRequests.push(r.method());});
    await ownRoute.goto(base+'/technician-route',{waitUntil:'networkidle'});await ownRoute.waitForFunction(()=>!document.getElementById('refreshBtn').disabled);assert.equal(await ownRoute.locator('#route .route-item').count(),person.id===tech.id?4:0);
    const ownRouteBefore=await ownRoute.locator('#route').innerHTML(),ownSuggestionsBefore=await ownRoute.locator('#suggestions').innerHTML(),ownRouteFirst=pageRequests.length;
    await ownRoute.evaluate(()=>dispatchEvent(new CustomEvent('cw:session-change')));assert.equal(await ownRoute.locator('#route').innerHTML(),ownRouteBefore);assert.equal(await ownRoute.locator('#suggestions').innerHTML(),ownSuggestionsBefore);assert.equal(pageRequests.length,ownRouteFirst);
    let ownRouteEntered;const ownRouteBegun=new Promise(resolve=>ownRouteEntered=resolve),ownRouteGate=new Promise(resolve=>{release=resolve;});await ownRoute.route(endpoint,async route=>{const response=await route.fetch();assert.equal(response.status(),200);assert.equal((await response.json()).technicianId,person.id);ownRouteEntered();await ownRouteGate;await route.fulfill({response}).catch(()=>{});},{times:1});
    await ownRoute.evaluate(()=>{window.qaRouteRead=loadRoute();});await ownRouteBegun;const ownRouteAborted=ownRoute.waitForEvent('requestfailed',{predicate:r=>new URL(r.url()).pathname==='/api/technician/today',timeout:10000});ownRouteAborted.catch(()=>{});
    assert(await ownRoute.evaluate(foreignToken=>{const keys=['token','cristalwater_jwt','adminToken'],saved=keys.map(key=>localStorage.getItem(key));keys.forEach(key=>localStorage.setItem(key,foreignToken));dispatchEvent(new CustomEvent('cw:session-change'));const cleared=()=>document.getElementById('route').childElementCount===0&&document.getElementById('suggestions').childElementCount===0&&document.getElementById('refreshBtn').disabled,changed=cleared();keys.forEach((key,i)=>saved[i]===null?localStorage.removeItem(key):localStorage.setItem(key,saved[i]));dispatchEvent(new CustomEvent('cw:session-change'));return changed&&cleared();},foreignToken));
    await ownRouteAborted;release();release=null;await ownRoute.evaluate(()=>qaRouteRead);const closedFirst=pageRequests.length;await ownRoute.evaluate(()=>loadRoute());assert.equal(pageRequests.length,closedFirst);assert(await ownRoute.locator('#refreshBtn').isDisabled());
    await ownRoute.reload({waitUntil:'networkidle'});await ownRoute.waitForFunction(()=>!document.getElementById('refreshBtn').disabled);assert.equal(await ownRoute.locator('#route .route-item').count(),person.id===tech.id?4:0);
    await ownRoute.clock.setFixedTime(Date.now()+3600001);assert(await ownRoute.evaluate(()=>{dispatchEvent(new Event('focus'));return document.getElementById('route').childElementCount===0&&document.getElementById('suggestions').childElementCount===0&&document.getElementById('refreshBtn').disabled;}));assert.deepEqual(pageErrors,[]);assert(pageRequests.every(method=>method==='GET'));await owned.close();
    console.log('PASS history '+person.role+'/'+(user?'USER':'TECHNICIAN')+': native owner scope, same-account event, rapid account return, GET abort, own reload and expiry');
    console.log('PASS legacy route '+person.role+'/'+(user?'USER':'TECHNICIAN')+': native owner scope, same-account event, rapid account return, GET abort, own reload and expiry');
  }
  assert.deepEqual(await database(),sessionDb);
  console.log('PASS history language result ' + JSON.stringify({ checks,scenarios,emptyProviderChecks,actualEmptyBadgeChecks,sharedSelectors: 4,sharedBadgeLanguages: 5,sourceBodyLiteral: true,exactSharedCssCachedAndRealOffline: true,ownedEntries: 17,languages: 5,realScopedFourVisitsThreeCompleted: true,originalDatePrecedenceFormatAndInvalidDateLiteral: true,techAndTeamLeader: true,readOnly: true,typedDraftFields: 13,immutablePending: 2,realOfflineNoHistoryCacheInvented: true,rawErrorsAndSourceNamesLiteral: true,noOperationalWrites: true }));completed = true;
})().catch(error => { console.error(error);process.exitCode = 1; }).finally(async () => { if (typeof release === 'function') release();clearTimeout(deadline);await browser?.close();await prisma.$disconnect(); });
