'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'], words = {"navDayPage": ["O meu dia", "My day", "Ma journée", "Mi día", "Mein Tag"], "navVisit": ["Visita", "Visit", "Visite", "Visita", "Besuch"], "navVehicleDocs": ["Viatura e documentos", "Vehicle and documents", "Véhicule et documents", "Vehículo y documentos", "Fahrzeug und Dokumente"], "navHelp": ["Apoio", "Support", "Assistance", "Ayuda", "Hilfe"], "navToday": ["Hoje", "Today", "Aujourd’hui", "Hoy", "Heute"], "navMap": ["Mapa", "Map", "Carte", "Mapa", "Karte"], "navVehicle": ["Viatura", "Vehicle", "Véhicule", "Vehículo", "Fahrzeug"], "navMore": ["Mais", "More", "Plus", "Más", "Mehr"], "navAria": ["Navegacao do tecnico em campo", "Field technician navigation", "Navigation du technicien sur le terrain", "Navegación del técnico de campo", "Navigation für Außendiensttechniker"], "mapSection": ["Rota", "Route", "Itinéraire", "Ruta", "Route"], "mapSectionHint": ["proximo local", "next location", "prochain lieu", "próximo lugar", "nächster Ort"], "mapNext": ["Próximo local", "Next location", "Prochain lieu", "Próximo lugar", "Nächster Ort"], "mapTitle": ["Mapa da próxima piscina", "Map of the next pool", "Carte de la prochaine piscine", "Mapa de la próxima piscina", "Karte des nächsten Pools"], "mapLoadingLocation": ["A carregar localização do serviço atribuído...", "Loading the assigned service location...", "Chargement du lieu du service attribué…", "Cargando la ubicación del servicio asignado...", "Ort des zugewiesenen Einsatzes wird geladen…"], "mapLoading": ["A carregar mapa...", "Loading map...", "Chargement de la carte…", "Cargando mapa...", "Karte wird geladen…"], "mapFree": ["Hoje livre", "Free today", "Libre aujourd’hui", "Hoy libre", "Heute frei"], "mapNoVisits": ["Não tens visitas atribuídas neste momento.", "You have no assigned visits at the moment.", "Aucune visite ne vous est attribuée pour le moment.", "No tienes visitas asignadas en este momento.", "Zurzeit sind Ihnen keine Besuche zugewiesen."], "mapRefresh": ["Atualiza a agenda ou comunica com o administrador.", "Refresh the schedule or contact the administrator.", "Actualisez le planning ou contactez l’administrateur.", "Actualiza la agenda o contacta con el administrador.", "Aktualisieren Sie den Zeitplan oder kontaktieren Sie den Administrator."], "mapNoNext": ["Sem próxima piscina para navegar.", "No next pool to navigate to.", "Aucune prochaine piscine pour lancer l’itinéraire.", "No hay una próxima piscina a la que navegar.", "Kein nächster Pool für die Navigation."], "mapFrameTitle": ["Mapa da proxima piscina", "Map of the next pool", "Carte de la prochaine piscine", "Mapa de la próxima piscina", "Karte des nächsten Pools"], "mapDestination": ["Destino", "Destination", "Destination", "Destino", "Ziel"], "mapCoordinates": ["Coordenadas: {coordinates}", "Coordinates: {coordinates}", "Coordonnées : {coordinates}", "Coordenadas: {coordinates}", "Koordinaten: {coordinates}"], "mapNoAddress": ["Morada nao indicada", "Address not provided", "Adresse non indiquée", "Dirección no indicada", "Adresse nicht angegeben"], "mapNoGps": ["Sem coordenadas GPS nesta piscina.", "This pool has no GPS coordinates.", "Cette piscine n’a pas de coordonnées GPS.", "Esta piscina no tiene coordenadas GPS.", "Für diesen Pool sind keine GPS-Koordinaten vorhanden."], "mapAddressRoute": ["A navegação abre pela morada/zona registada.", "Navigation uses the recorded address or area.", "L’itinéraire utilise l’adresse ou la zone enregistrée.", "La navegación usa la dirección o zona registrada.", "Die Navigation nutzt die gespeicherte Adresse oder Gegend."], "mapConfirmAddress": ["Sem morada confirmada. Peça a localização ao escritório antes de navegar.", "No confirmed address. Ask the office for the location before navigating.", "Aucune adresse confirmée. Demandez le lieu au bureau avant de lancer l’itinéraire.", "No hay una dirección confirmada. Pide la ubicación a la oficina antes de navegar.", "Keine bestätigte Adresse. Fragen Sie vor der Navigation im Büro nach dem Standort."], "mapAddressUnknown": ["Morada ou zona por confirmar", "Address or area needs confirmation", "Adresse ou zone à confirmer", "Dirección o zona por confirmar", "Adresse oder Gegend muss bestätigt werden"], "mapShow": ["Ver mapa", "View map", "Voir la carte", "Ver mapa", "Karte ansehen"], "navSupport": ["Apoio e conta", "Support and account", "Assistance et compte", "Ayuda y cuenta", "Hilfe und Konto"], "navTeamChat": ["Conversa da equipa", "Team chat", "Discussion d’équipe", "Chat del equipo", "Teamchat"], "navNotifications": ["Notificações", "Notifications", "Notifications", "Notificaciones", "Benachrichtigungen"], "navProfile": ["O meu perfil", "My profile", "Mon profil", "Mi perfil", "Mein Profil"], "navSchedule": ["Agenda", "Schedule", "Planning", "Agenda", "Zeitplan"], "dashNavigate": ["Navegar", "Navigate", "Itinéraire", "Navegar", "Navigieren"], "historyTitle": ["Histórico de alertas", "Alert history", "Historique des alertes", "Historial de alertas", "Alarmverlauf"]};
const fieldIds = ['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
let browser, completed = false, checks = 0;
const deadline = setTimeout(() => { console.error('Map/navigation language scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const day = ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-'), scheduledAt = new Date(day + 'T12:00:00.000Z');
  const vehicle = await prisma.vehicle.create({ data: { plate: 'MAP-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Map owner <b>{day}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Map language client', active: true } });
  const pools = await Promise.all(['REGULAR','EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' map <b>{coordinates}</b>', active: true, latitude: type === 'REGULAR' ? 37.125678 : null, longitude: type === 'REGULAR' ? -8.765432 : null, address: type === 'REGULAR' ? 'Recorded <b>{coordinates}</b>' : 'Address <b>{coordinates}</b>' } })));
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
    for (const [field,value] of Object.entries({ notes: type + ' map draft <b>{coordinates}</b>', ph: type === 'REGULAR' ? '7.4' : '7.1', chlorine: '1.2', alkalinity: '90', salt: '3.2', orp: '680', temperature: '24' })) await page.locator('#' + field).fill(value);
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
  const staticCopies = { '#routeCard > .chip': 'mapNext', '#navLink': 'dashNavigate', '#mapsLink': 'mapShow', '[data-field-navigation-copy=navSupport]': 'navSupport', '[data-field-navigation-copy=navTeamChat]': 'navTeamChat', '[data-field-navigation-copy=navNotifications]': 'navNotifications', '[data-field-navigation-copy=navProfile]': 'navProfile', '[data-field-navigation-copy=navSchedule]': 'navSchedule', '[data-field-navigation-copy=historyTitle]': 'historyTitle' };
  const text = (key,index,params = {}) => words[key][index].replace(/\{(\w+)\}/g,(_,name) => params[name]);
  async function matrix({ name, tab = 'hoje', type = 'REGULAR', gps = false, address = '', empty = false, foreign = false, frameForeign = false, widths = [320,390,1440], pendingCount = 0 }) {
    await waitReads(); await page.locator('[data-field-tab-button=' + tab + ']').click(); await page.locator('#cwLanguageSelect').focus(); await locale('pt'); await page.evaluate(() => window.scrollTo(0,0)); await track(); await settle();
    await page.evaluate(ids => {
      window.qaNetworkBadge = document.getElementById('connectionState'); window.qaNetworkHistory = document.getElementById('fieldDraftHistory'); window.qaNetworkFields = ids.map(id => document.getElementById(id)); window.qaNetworkControls = ['startBtn','finishBtn','fieldReloadBtn'].map(id => document.getElementById(id)); window.qaNetworkHandlers = qaNetworkControls.map(node => node.onclick); window.qaNetworkFocus = document.activeElement;
      window.qaMapNodes = [...document.querySelectorAll('#routeCard, #routeCard *, [data-field-navigation-copy]')]; window.qaMapHandlers = qaMapNodes.map(node => node.onclick);
    }, fieldIds);
    const before = await state(), stored = await raw(), records = await pending(), db = await database(), first = requests.length;
    const attributes = () => page.evaluate(() => ({ links: [...document.querySelectorAll('#navLink,#mapsLink,.field-account-links a')].map(node => [node.id,node.getAttribute('href'),node.getAttribute('target'),node.getAttribute('rel'),node.getAttribute('aria-disabled')]), frame: (() => { const node = document.getElementById('fieldMapFrame'); return node && [node.getAttribute('src'),node.getAttribute('loading')]; })(), card: [document.getElementById('routeCard').hidden,document.body.dataset.fieldTab] }));
    const attrs = await attributes(); assert.equal(records.length,pendingCount); assert(records.every(row => !row.response));
    for (const width of widths) { await page.setViewportSize({ width, height: 1400 }); for (const [index,language] of languages.entries()) {
      await locale(language);
      for (const [selector,key] of Object.entries(staticCopies)) assert.equal(await page.locator(selector).textContent(),text(key,index),'Navigation copy: ' + name + '/' + language + '/' + key);
      assert.equal(await page.locator('#fieldPageTitle').textContent(),text({ hoje: 'navDayPage',agora: 'navVisit',docs: 'navVehicleDocs',more: 'navHelp' }[tab],index)); assert.equal(await page.locator('.field-tabs').getAttribute('aria-label'),text('navAria',index));
      for (const [tab,key] of Object.entries({ hoje: 'navToday', agora: 'navVisit', mapa: 'navMap', docs: 'navVehicle', more: 'navMore' })) assert.equal(await page.locator('[data-field-tab-button=' + tab + ']').textContent(),text(key,index));
      assert.equal(await page.locator('#routeCard .field-tab-title h2').textContent(),text('mapSection',index)); assert.equal(await page.locator('#routeCard .field-tab-title span').textContent(),text('mapSectionHint',index));
      assert.equal(await page.locator('#routeTitle').textContent(),empty ? text('mapFree',index) : type + ' map <b>{coordinates}</b>');
      assert.equal(await page.locator('#routeSummary').textContent(),empty ? text('mapNoVisits',index) : 'Map language client - IN_PROGRESS');
      if (empty) {
        assert.equal(await page.locator('#mapBox .map-fallback').textContent(),text('mapRefresh',index)); assert.equal(await page.locator('#routeMeta').textContent(),text('mapNoNext',index));
        for (const selector of ['#navLink','#mapsLink']) { assert.equal(await page.locator(selector).getAttribute('href'),null); assert.equal(await page.locator(selector).getAttribute('aria-disabled'),'true'); }
      } else if (gps) {
        assert.equal(await page.locator('#mapBox .map-overlay span').textContent(),foreign ? text('mapDestination',0) : text('mapDestination',index)); assert.equal(await page.locator('#mapBox .map-overlay strong').textContent(),type + ' map <b>{coordinates}</b>');
        assert.equal(await page.locator('#fieldMapFrame').getAttribute('title'),frameForeign ? 'External frame <b>{coordinates}</b>' : text('mapFrameTitle',index));
        assert.equal(await page.locator('#routeMeta > span').nth(0).textContent(),foreign ? text('mapCoordinates',0,{ coordinates: '37.125678, -8.765432' }) : text('mapCoordinates',index,{ coordinates: '37.125678, -8.765432' })); assert.equal(await page.locator('#routeMeta > span').nth(1).textContent(),address || text('mapNoAddress',index));
        assert.equal(await page.locator('#navLink').getAttribute('href'),'https://www.google.com/maps/dir/?api=1&destination=37.125678%2C-8.765432&travelmode=driving'); assert.equal(await page.locator('#mapsLink').getAttribute('href'),'https://www.google.com/maps/search/?api=1&query=37.125678%2C-8.765432');
      } else {
        assert.equal(await page.locator('#mapBox strong').textContent(),text('mapNoGps',index)); assert.equal(await page.locator('[data-map-fallback-detail]').textContent(),text(address ? 'mapAddressRoute' : 'mapConfirmAddress',index)); assert.equal(await page.locator('#routeMeta').textContent(),address || text('mapAddressUnknown',index));
        for (const selector of ['#navLink','#mapsLink']) { assert.equal(await page.locator(selector).getAttribute('href'),address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) : null); assert.equal(await page.locator(selector).getAttribute('aria-disabled'),address ? null : 'true'); }
      }
      assert.deepEqual(await state(),before); assert.deepEqual(await raw(),stored); assert.deepEqual(await pending(),records); assert.deepEqual(await database(),db); assert.deepEqual(await attributes(),attrs);
      assert(await page.evaluate(() => qaMapNodes.every((node,index) => node.isConnected && node.onclick === qaMapHandlers[index]) && qaNetworkFields.every(node => node.isConnected && node === document.getElementById(node.id)) && qaNetworkControls.every((node,index) => node.isConnected && node.onclick === qaNetworkHandlers[index]) && document.activeElement === qaNetworkFocus));
      assert.equal(await page.locator('#routeTitle b, #routeSummary b, #routeMeta b, #mapBox .map-overlay b, #routeCard script').count(),0); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),'No page overflow: ' + name + '/' + language + '/' + width);
      assert(await page.locator('#routeCard').evaluate(node => node.hidden || node.scrollWidth <= node.clientWidth + 1),'No map-card overflow: ' + name + '/' + language + '/' + width); checks++;
    }}
    if (process.env.CW_MAP_NAV_CAPTURE && tab === 'hoje' && !empty && !foreign && !frameForeign) {
      await fs.mkdir(process.env.CW_MAP_NAV_CAPTURE,{ recursive: true }); await page.setViewportSize({ width: 320,height: 1400 });
      await page.locator('[data-field-tab-button=hoje]').click(); await page.locator('#routeCard').screenshot({ path: process.env.CW_MAP_NAV_CAPTURE + '/' + name + '-map-de-320.png' });
      await page.locator('[data-field-tab-button=more]').click(); await page.locator('.field-account-links').screenshot({ path: process.env.CW_MAP_NAV_CAPTURE + '/' + name + '-account-de-320.png' }); await page.locator('[data-field-tab-button=hoje]').click(); await page.locator('#cwLanguageSelect').focus(); await page.evaluate(() => window.scrollTo(0,0)); await settle();
    }
    for (const request of requests.slice(first)) { assert.equal(request.path,'/api/settings/language/me'); assert.equal(request.method,'PUT'); assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']); assert.equal(request.auth,'Bearer ' + token); }
    console.log('PASS map/navigation languages ' + JSON.stringify({ name,widths,pendingCount,checks,unchangedDestinations: true,noOperationalWrites: true }));
  }
  let selectedType = 'REGULAR';
  const reload = async () => { await page.locator('#fieldReloadBtn').evaluate(node => node.click()); await ready(selectedType); await waitReads(); await page.waitForFunction(() => document.getElementById('fieldLoadError').hidden); };
  await open('REGULAR'); await fill('REGULAR'); await open('EXTRA'); await fill('EXTRA'); await open('REGULAR'); await track();
  await matrix({ name: 'gps-address',gps: true,address: 'Recorded <b>{coordinates}</b>' });
  for (const tab of ['agora','docs','more']) await matrix({ name: 'context-' + tab,tab,gps: true,address: 'Recorded <b>{coordinates}</b>',widths: [320] });
  await locale('pt'); await page.evaluate(() => { for (const selector of ['#mapBox .map-overlay span','#routeMeta > span']) { const node = document.querySelector(selector); node.replaceChildren(document.createTextNode(node.textContent)); } });
  await matrix({ name: 'foreign-identical-leaves',gps: true,address: 'Recorded <b>{coordinates}</b>',foreign: true });
  for (const selector of ['#mapBox .map-overlay span','#routeMeta > span']) assert.equal(await page.locator(selector).first().getAttribute('data-cw-alert-copy'),null);
  await reload(); await page.locator('#fieldMapFrame').evaluate(node => node.setAttribute('title','External frame <b>{coordinates}</b>')); await matrix({ name: 'foreign-frame-title',gps: true,address: 'Recorded <b>{coordinates}</b>',frameForeign: true,widths: [320] });
  await open('EXTRA'); selectedType = 'EXTRA'; await track(); assert.equal(await page.locator('#notes').inputValue(),'EXTRA map draft <b>{coordinates}</b>'); await matrix({ name: 'extra-address',type: 'EXTRA',address: 'Address <b>{coordinates}</b>' });
  await prisma.pool.update({ where: { id: pools[1].id },data: { address: null } }); await reload(); await matrix({ name: 'extra-missing-location',type: 'EXTRA' });
  await prisma.pool.update({ where: { id: pools[0].id },data: { address: null } }); await open('REGULAR'); selectedType = 'REGULAR'; await track(); await matrix({ name: 'gps-missing-address',gps: true });
  const endpoint = '**/api/technician/today?*'; await page.route(endpoint,route => route.fulfill({ status: 200,json: { ok: true,complete: true,date: day,technicianId: tech.id,total: 0,visits: [] } }));
  await page.locator('#fieldReloadBtn').evaluate(node => node.click()); await page.waitForFunction(() => CWFieldDaySnapshot().visits.length === 0 && document.getElementById('fieldLoadError').hidden); await waitReads(); await matrix({ name: 'empty-round',empty: true }); await page.unroute(endpoint); await reload();
  await page.evaluate(async id => { await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{ visitId: id,notes: 'REGULAR map pending <b>{coordinates}</b>' }); await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{ visitType: 'EXTRA',notes: 'EXTRA map pending <b>{coordinates}</b>' }); },id);
  const originalPending = await pending(),originalDb = await database(); assert.deepEqual(originalPending.map(row => row.scope).sort(),['EXTRA_VISIT_COMPLETION','VISIT_COMPLETION']); assert(originalPending.every(row => row.resourceId === id && row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64 && !row.response)); assert.notEqual(originalPending[0].requestId,originalPending[1].requestId);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller); await context.setOffline(true); await page.waitForFunction(() => document.getElementById('connectionState').dataset.offline === 'true'); await matrix({ name: 'gps-offline-real-event',gps: true,pendingCount: 2 });
  await open('EXTRA'); selectedType = 'EXTRA'; await track(); assert.equal(await page.locator('#notes').inputValue(),'EXTRA map draft <b>{coordinates}</b>'); assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt),null); await matrix({ name: 'extra-offline-cached-shell',type: 'EXTRA',widths: [320],pendingCount: 2 });
  assert.deepEqual(await pending(),originalPending); assert.deepEqual(await database(),originalDb); assert.deepEqual(errors,[]); assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));
  console.log('PASS map/navigation language result ' + JSON.stringify({ checks,scenarios: 12,ownedEntries: 33,languages: 5,typedDraftFields: 13,immutablePending: 2,foreignCopiesLiteral: true,unchangedDestinations: true,cachedExtraShell: true,noOperationalWrites: true })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
