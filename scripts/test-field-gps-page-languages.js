'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'], locales = ['pt-PT', 'en-GB', 'fr-FR', 'es-ES', 'de-DE'];
const text = {
  documentTitle: ['Cristal Water - GPS Técnico', 'Cristal Water - Technician GPS', 'Cristal Water - GPS Technicien', 'Cristal Water - GPS Técnico', 'Cristal Water - Techniker-GPS'],
  operation: ['Operação técnica', 'Technical operations', 'Opérations techniques', 'Operación técnica', 'Technischer Einsatz'],
  heading: ['GPS de Campo', 'Field GPS', 'GPS de terrain', 'GPS de campo', 'GPS im Außendienst'],
  intro: ['Leitura ao sol e estado de sincronização em tempo real.', 'Readable in sunlight with live synchronization status.', 'Lisible au soleil avec état de synchronisation en temps réel.', 'Lectura al sol y estado de sincronización en tiempo real.', 'Im Sonnenlicht lesbar, mit aktuellem Synchronisierungsstatus.'],
  start: ['Iniciar tracking', 'Start tracking', 'Démarrer le suivi', 'Iniciar seguimiento', 'Ortung starten'],
  send: ['Enviar ponto agora', 'Send point now', 'Envoyer un point maintenant', 'Enviar punto ahora', 'Punkt jetzt senden'],
  retry: ['Confirmar pontos guardados', 'Confirm saved points', 'Confirmer les points enregistrés', 'Confirmar puntos guardados', 'Gespeicherte Punkte bestätigen'],
  summary: ['Estado rápido', 'Quick status', 'État rapide', 'Estado rápido', 'Statusübersicht'],
  synchronization: ['Sincronização', 'Synchronization', 'Synchronisation', 'Sincronización', 'Synchronisierung'],
  accuracy: ['Precisão', 'Accuracy', 'Précision', 'Precisión', 'Genauigkeit'],
  last: ['Último envio', 'Last send', 'Dernier envoi', 'Último envío', 'Letzter Versand'],
  waiting: ['Em espera', 'Waiting', 'En attente', 'En espera', 'Wartend'],
  pending: ['Por confirmar', 'Awaiting confirmation', 'À confirmer', 'Por confirmar', 'Bestätigung ausstehend'],
  reviewing: ['A rever', 'Needs review', 'À vérifier', 'Por revisar', 'Prüfung erforderlich'],
  synchronized: ['Sincronizado', 'Synchronized', 'Synchronisé', 'Sincronizado', 'Synchronisiert'],
  updating: ['A atualizar', 'Updating', 'À actualiser', 'Por actualizar', 'Aktualisierung erforderlich'],
  empty: ['Sem pendências', 'Nothing pending', 'Aucun envoi en attente', 'Sin pendientes', 'Keine ausstehenden Punkte'],
  changed: ['Sessão alterada', 'Session changed', 'Session modifiée', 'Sesión cambiada', 'Sitzung geändert'],
  ready: ['Pronto para iniciar GPS.', 'Ready to start GPS.', 'Prêt à démarrer le GPS.', 'Listo para iniciar GPS.', 'Bereit zum Starten von GPS.'],
  acquiring: ['A obter ponto atual.', 'Getting the current point.', 'Acquisition du point actuel.', 'Obteniendo el punto actual.', 'Aktueller Punkt wird ermittelt.'],
  tracking: ['A obter leituras GPS. Os pontos são guardados antes do envio.', 'Getting GPS readings. Points are saved before sending.', 'Acquisition des relevés GPS. Les points sont enregistrés avant l’envoi.', 'Obteniendo lecturas GPS. Los puntos se guardan antes del envío.', 'GPS-Messungen werden erfasst. Punkte werden vor dem Versand gespeichert.'],
  confirming: ['A confirmar pontos guardados…', 'Confirming saved points…', 'Confirmation des points enregistrés…', 'Confirmando puntos guardados…', 'Gespeicherte Punkte werden bestätigt…'],
  pendingCount: ['{count} ponto(s) GPS guardado(s) neste dispositivo por confirmar.', '{count} GPS point(s) saved on this device awaiting confirmation.', '{count} point(s) GPS enregistré(s) sur cet appareil à confirmer.', '{count} punto(s) GPS guardado(s) en este dispositivo por confirmar.', '{count} GPS-Punkt(e) auf diesem Gerät warten auf Bestätigung.'],
  history: ['Existem pontos GPS antigos sem conta confirmada. Foram preservados; peça apoio ao escritório.', 'Older GPS points without a confirmed account were preserved; ask the office for help.', 'Les anciens points GPS sans compte confirmé ont été conservés ; demandez de l’aide au bureau.', 'Se han conservado los puntos GPS antiguos sin cuenta confirmada; pida ayuda a la oficina.', 'Ältere GPS-Punkte ohne bestätigtes Konto bleiben erhalten; bitten Sie das Büro um Hilfe.'],
  confirmed: ['Localização confirmada.', 'Location confirmed.', 'Position confirmée.', 'Ubicación confirmada.', 'Standort bestätigt.'],
  old: ['Leituras antigas reconhecidas sem atualizar a posição atual. Obtenha uma leitura atual.', 'Older readings acknowledged without updating the current position. Get a current reading.', 'Anciens relevés reconnus sans modifier la position actuelle. Obtenez un relevé actuel.', 'Lecturas antiguas reconocidas sin actualizar la posición actual. Obtenga una lectura actual.', 'Ältere Messungen bestätigt, ohne die aktuelle Position zu ändern. Erfassen Sie eine aktuelle Messung.'],
  nothing: ['Não há envios GPS pendentes nesta conta.', 'There are no pending GPS sends for this account.', 'Aucun envoi GPS en attente pour ce compte.', 'No hay envíos GPS pendientes en esta cuenta.', 'Für dieses Konto sind keine GPS-Sendungen ausstehend.'],
  session: ['A sessão mudou. Reabra o GPS com a sua conta; os pontos guardados foram preservados.', 'The session changed. Reopen GPS with your account; saved points were preserved.', 'La session a changé. Rouvrez le GPS avec votre compte ; les points enregistrés ont été conservés.', 'La sesión ha cambiado. Vuelva a abrir el GPS con su cuenta; los puntos guardados se han conservado.', 'Die Sitzung hat sich geändert. Öffnen Sie GPS erneut mit Ihrem Konto; gespeicherte Punkte bleiben erhalten.'],
  unsupported: ['GPS não suportado neste dispositivo.', 'GPS is not supported on this device.', 'GPS non pris en charge sur cet appareil.', 'GPS no compatible con este dispositivo.', 'GPS wird auf diesem Gerät nicht unterstützt.'],
  permission: ['GPS indisponível ou sem permissão.', 'GPS unavailable or permission denied.', 'GPS indisponible ou autorisation refusée.', 'GPS no disponible o permiso denegado.', 'GPS nicht verfügbar oder Berechtigung verweigert.'],
  fallback: ['GPS por confirmar. Os pontos guardados foram preservados.', 'GPS awaiting confirmation. Saved points were preserved.', 'GPS à confirmer. Les points enregistrés ont été conservés.', 'GPS por confirmar. Los puntos guardados se han conservado.', 'GPS-Bestätigung ausstehend. Gespeicherte Punkte bleiben erhalten.']
};
let browser, completed = false; const releases = [];
const deadline = setTimeout(() => { console.error('GPS page language scenario did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'GPS page language QA', active: true } });
  const other = await prisma.technician.create({ data: { name: 'GPS page other account', active: true } });
  const credential = id => jwt.sign({ id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), token = credential(tech.id);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Lisbon' });
  await context.addInitScript(({ token, id, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaGpsPageLanguages')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'TECHNICIAN' }));
      localStorage.setItem('qaGpsPageLanguages', '1');
    }
    window.qaGps = { current: [], watchers: [], cleared: [] };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success, error) => qaGps.current.push({ success, error }), watchPosition: (success, error) => (qaGps.watchers.push({ success, error }), qaGps.watchers.length), clearWatch: id => qaGps.cleared.push(id) } });
  }, { token, id: tech.id, origin: base });
  const page = await context.newPage(), errors = [], requests = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  const endpoint = base + '/api/gps/update';
  page.on('request', request => { if (request.url() === endpoint) requests.push({ method: request.method(), body: request.postData(), authorization: request.headers().authorization }); });
  await page.goto(base + '/technician-gps', { waitUntil: 'networkidle' }); await page.waitForFunction(() => navigator.serviceWorker.controller);
  const language = async lang => { await page.locator('#cwLanguageSelect').selectOption(lang); await page.waitForFunction(lang => document.documentElement.lang === lang, lang); };
  const stored = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('cwGpsPoint:v2:') || key === 'cristalwater_offline_gps').sort().map(key => [key, localStorage.getItem(key)]));
  const database = async () => ({ location: await prisma.technicianLocation.findFirst({ where: { technicianId: tech.id } }), tracks: await prisma.technicianTrack.findMany({ where: { technicianId: tech.id }, orderBy: { id: 'asc' } }) });
  const idle = () => page.waitForFunction(() => !document.getElementById('sendNowBtn').disabled && !document.getElementById('gpsRetryBtn').disabled);
  const emit = time => page.evaluate(time => qaGps.current.at(-1).success({ coords: { latitude: 37.04, longitude: -8.67, accuracy: 9.4 }, timestamp: time }), time);
  const instrument = () => page.evaluate(() => {
    window.qaGpsCalls = {}; for (const name of ['save', 'send', 'flush', 'start', 'stop', 'status']) { const original = CWGps[name]; CWGps[name] = (...args) => { qaGpsCalls[name] = (qaGpsCalls[name] || 0) + 1; return original(...args); }; }
    window.qaPageGpsError = gpsError; gpsError = error => { window.qaLastGpsError = error; qaPageGpsError(error); };
  });
  const state = () => page.evaluate(() => ({ focus: document.activeElement.id, controls: ['startBtn', 'sendNowBtn', 'gpsRetryBtn'].map(id => document.getElementById(id).disabled), calls: { ...qaGpsCalls }, geo: [qaGps.current.length, qaGps.watchers.length, qaGps.cleared.length], accuracy: document.getElementById('accuracyKpi').textContent, tone: document.getElementById('gpsStatus').dataset.tone, credentials: ['token', 'cristalwater_jwt'].map(key => localStorage.getItem(key)), users: ['user', 'cristalwater_user'].map(key => { const { language, ...identity } = JSON.parse(localStorage.getItem(key)); return identity; }) }));
  const matrix = async (status, sync, params = {}, recordedAt = null, literal = null) => {
    await page.evaluate(() => { window.qaGpsPageNodes = Array.from(document.querySelectorAll('[data-cw-gps-text],#gpsStatus,#syncKpi,#accuracyKpi,#lastKpi')); if (!document.activeElement.id || document.activeElement.disabled) document.querySelector('.gps-shell button:not(:disabled),#cwLanguageSelect')?.focus(); });
    const before = await state(), beforeStored = await stored(), beforeDb = await database(), count = requests.length;
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, lang] of languages.entries()) {
        await language(lang);
        const expected = literal === null ? text[status][index].replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? '')) : literal;
        await page.waitForFunction(expected => document.getElementById('gpsStatus').textContent === expected, expected);
        assert.equal(await page.locator('#syncKpi').textContent(), text[sync][index]);
        const actual = await page.locator('[data-cw-gps-text]').evaluateAll(nodes => nodes.map(node => [node.dataset.cwGpsText, node.textContent]));
        assert.equal(actual.length, 11); for (const [key, value] of actual) assert.equal(value, text[key][index]);
        assert.equal(await page.title(), text.documentTitle[index]);
        if (recordedAt) assert.equal(await page.locator('#lastKpi').textContent(), new Date(recordedAt).toLocaleTimeString(locales[index], { timeZone: 'Europe/Lisbon' }));
        else assert.equal(await page.locator('#lastKpi').textContent(), '—');
        assert.deepEqual(await page.evaluate(() => ['user', 'cristalwater_user'].map(key => JSON.parse(localStorage.getItem(key)).language)), [lang, lang]);
        assert.deepEqual(await state(), before); assert.deepEqual(await stored(), beforeStored); assert.deepEqual(await database(), beforeDb);
        assert(await page.evaluate(() => qaGpsPageNodes.every(node => node.isConnected)));
        assert(await page.locator('.gps-shell').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'GPS content fits the available width');
        for (const selector of ['#startBtn', '#sendNowBtn', '#gpsRetryBtn', '#gpsStatus', '#syncKpi']) assert(await page.locator(selector).evaluate(node => node.scrollWidth <= node.clientWidth + 1), selector + ' fits');
      }
    }
    assert.equal(requests.length, count);
  };
  // Reproduce the existing defect before any GPS operation or new localization.
  await language('en'); assert.equal(await page.locator('#startBtn').textContent(), text.start[1]);
  await instrument(); await matrix('ready', 'waiting');
  await page.locator('#sendNowBtn').click(); await matrix('acquiring', 'waiting');
  await context.setOffline(true); await emit(Date.now()); await idle();
  const original = await stored(); assert.equal(original.length, 1); const point = JSON.parse(original[0][1]);
  assert.equal(original[0][0], 'cwGpsPoint:v2:TECH:' + tech.id + ':' + point.id); assert.equal(point.owner, 'TECH:' + tech.id); assert.equal(point.accuracy, 9.4);
  await page.locator('#gpsRetryBtn').focus(); await matrix('pendingCount', 'pending', { count: 1 });
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload({ waitUntil: 'networkidle' }); await instrument(); await idle(); assert.deepEqual(await stored(), original);
  await matrix('pendingCount', 'pending', { count: 1 });
  const cache = fs.readFileSync('frontend/sw.js', 'utf8').match(/const CACHE = '([^']+)'/)[1]; assert(await page.evaluate(name => caches.keys().then(names => names.includes(name)), cache));
  console.log('PASS real page title/actions/labels, ready/current acquisition and offline pending states in five languages at320/390/1440 preserve DOM, focus, controls, credentials, GPS calls, exact point and SQL; cached offline reload remains recoverable');

  await page.evaluate(() => { window.qaGeolocation = navigator.geolocation; Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined }); });
  await page.locator('#sendNowBtn').click(); assert.equal(await page.evaluate(() => qaLastGpsError.message), text.unsupported[0]); await matrix('unsupported', 'pending');
  await page.evaluate(() => { const error = Error(qaLastGpsError.message); error.copy = { key: 'unsupported' }; gpsError(error); }); await matrix('unsupported', 'pending', {}, null, text.unsupported[0]);
  const external = '<b>QA external {count}</b>'; await page.evaluate(message => gpsError(Error(message)), external); await matrix('unsupported', 'pending', {}, null, external);
  await page.evaluate(() => gpsError(Error(''))); await matrix('fallback', 'pending');
  await page.evaluate(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: qaGeolocation }));
  await page.locator('#sendNowBtn').click(); await page.evaluate(() => qaGps.current.at(-1).error()); await idle(); assert.equal(await page.evaluate(() => qaLastGpsError.message), text.permission[0]); await matrix('permission', 'pending');
  await page.locator('#startBtn').click(); await matrix('tracking', 'pending'); await page.evaluate(() => qaGps.watchers.at(-1).error()); await matrix('permission', 'pending');
  const oldRaw = '[{"latitude":37,"longitude":-8,"notes":"antigo <b>{count}</b>"}]'; await page.evaluate(raw => localStorage.setItem('cristalwater_offline_gps', raw), oldRaw);
  await page.locator('#gpsRetryBtn').click(); await idle(); await matrix('history', 'reviewing'); assert.equal(await page.evaluate(() => localStorage.getItem('cristalwater_offline_gps')), oldRaw);
  await page.evaluate(() => localStorage.removeItem('cristalwater_offline_gps')); assert.deepEqual(await stored(), original);
  console.log('PASS unsupported/current-position/watch permission callbacks and recovery states keep original Error.message; identical/forged/external errors remain literal and legacy GPS bytes are preserved');

  await context.setOffline(false); await page.waitForLoadState('networkidle');
  let release, entered; const gate = new Promise(resolve => { release = resolve; releases.push(resolve); }), started = new Promise(resolve => { entered = resolve; }); const sends = [];
  await page.route(endpoint, async route => {
    sends.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization }); const response = await route.fetch(), data = await response.json();
    assert.equal(response.status(), 200); assert.equal(data.acknowledgement.pointId, point.id);
    if (sends.length === 1) { entered(); await gate; await route.abort('connectionfailed'); } else await route.fulfill({ response });
  });
  await page.locator('#gpsRetryBtn').click(); await started; await matrix('confirming', 'reviewing'); assert.equal(sends.length, 1); assert.deepEqual(await stored(), original);
  assert.equal((await database()).tracks.length, 1); release(); await idle(); assert.deepEqual(await stored(), original);
  await page.locator('#gpsRetryBtn').click(); await idle(); assert.deepEqual(await stored(), []); assert.equal((await database()).tracks.length, 1); assert.equal(sends.length, 2);
  assert.deepEqual(sends[0], sends[1]); assert.equal(sends[0].authorization, 'Bearer ' + token); assert.equal(sends[0].body.pointId, point.id);
  await matrix('old', 'updating'); await page.unroute(endpoint);
  await page.locator('#gpsRetryBtn').click(); await idle(); await matrix('nothing', 'empty');
  await page.locator('#sendNowBtn').click(); await matrix('acquiring', 'empty'); await emit(Date.now() + 1000); await idle();
  const acknowledged = requests.at(-1), sent = JSON.parse(acknowledged.body); assert.equal(sent.accuracy, 9.4); assert.equal(sent.latitude, point.latitude); assert.equal(sent.longitude, point.longitude);
  assert.equal(await page.locator('#accuracyKpi').textContent(), '9 m'); await matrix('confirmed', 'synchronized', {}, sent.recordedAt);
  const confirmedDb = await database(); assert.equal(confirmedDb.tracks.length, 2); assert.equal(confirmedDb.location.latitude, point.latitude); assert.equal(confirmedDb.location.longitude, point.longitude);
  if (process.env.CW_GPS_PAGE_LANGUAGE_CAPTURE) { await page.setViewportSize({ width: 320, height: 1100 }); await language('de'); await page.locator('#cw-v21-toast').waitFor({ state: 'hidden' }); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: process.env.CW_GPS_PAGE_LANGUAGE_CAPTURE, fullPage: true }); }
  console.log('PASS changing language during a held real confirmation does not send again; lost-response retry uses identical UUID/payload/auth with one history row; older/current acknowledgements, accuracy and original measurement time render accurately');

  await context.setOffline(true); await page.locator('#sendNowBtn').click(); await emit(Date.now() + 2000); await idle(); const pending = await stored(); assert.equal(pending.length, 1);
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'TECHNICIAN' })); }, { token: credential(other.id), id: other.id });
  await page.waitForFunction(() => ['startBtn', 'sendNowBtn', 'gpsRetryBtn'].every(id => document.getElementById(id).disabled)); await matrix('session', 'changed'); assert.deepEqual(await stored(), pending);
  await page.evaluate(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'TECHNICIAN' })); }, { token, id: tech.id });
  await matrix('session', 'changed'); await page.reload({ waitUntil: 'networkidle' }); await instrument(); await idle(); await matrix('pendingCount', 'pending', { count: 1 }); assert.deepEqual(await stored(), pending);
  assert.equal(await prisma.technicianTrack.count({ where: { technicianId: other.id } }), 0); assert.equal((await database()).tracks.length, 2);
  assert.equal(await page.locator('#gpsStatus b').count(), 0); assert.deepEqual(errors, []);
  console.log('PASS account change disables the same controls in all languages and preserves the exact pending point; restoring credentials does not unlock the old page, and cached reopen recovers only the original account');
  completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); for (const release of releases) release(); if (browser) await browser.close(); await prisma.$disconnect(); });
