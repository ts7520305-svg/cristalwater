'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const copy = {
  pt: { offline: 'GPS guardado neste dispositivo; aguarda rede.', unreadable: 'Registo GPS ilegível. Os dados foram preservados; peça apoio ao escritório.', invalid: 'Leitura GPS inválida.', unconfirmed: 'GPS por confirmar. O ponto foi conservado para repetir o mesmo envio.', permission: 'GPS indisponível ou sem permissão.', savedError: 'Não foi possível guardar o GPS: ', history: 'Existem pontos GPS antigos sem conta confirmada. Foram preservados; peça apoio ao escritório.', confirmed: 'Envios GPS confirmados.' },
  en: { offline: 'GPS saved on this device; awaiting a connection.', unreadable: 'Unreadable GPS record. The data was preserved; ask the office for help.', invalid: 'Invalid GPS reading.', unconfirmed: 'GPS awaiting confirmation. The point was kept to repeat the same send.', permission: 'GPS unavailable or permission denied.', savedError: 'Could not save GPS: ', history: 'Older GPS points without a confirmed account were preserved; ask the office for help.', confirmed: 'GPS sends confirmed.' },
  fr: { offline: 'GPS enregistré sur cet appareil ; en attente de connexion.', unreadable: 'Enregistrement GPS illisible. Les données ont été conservées ; demandez de l’aide au bureau.', invalid: 'Relevé GPS invalide.', unconfirmed: 'GPS en attente de confirmation. Le point a été conservé pour répéter le même envoi.', permission: 'GPS indisponible ou autorisation refusée.', savedError: 'Impossible d’enregistrer le GPS : ', history: 'Les anciens points GPS sans compte confirmé ont été conservés ; demandez de l’aide au bureau.', confirmed: 'Envois GPS confirmés.' },
  es: { offline: 'GPS guardado en este dispositivo; esperando conexión.', unreadable: 'Registro GPS ilegible. Los datos se han conservado; pida ayuda a la oficina.', invalid: 'Lectura GPS no válida.', unconfirmed: 'GPS pendiente de confirmación. Se ha conservado el punto para repetir el mismo envío.', permission: 'GPS no disponible o permiso denegado.', savedError: 'No se ha podido guardar el GPS: ', history: 'Se han conservado los puntos GPS antiguos sin cuenta confirmada; pida ayuda a la oficina.', confirmed: 'Envíos GPS confirmados.' },
  de: { offline: 'GPS auf diesem Gerät gespeichert; Verbindung ausstehend.', unreadable: 'Unlesbarer GPS-Eintrag. Die Daten bleiben erhalten; bitten Sie das Büro um Hilfe.', invalid: 'Ungültige GPS-Messung.', unconfirmed: 'GPS-Bestätigung ausstehend. Der Punkt bleibt für denselben erneuten Versand erhalten.', permission: 'GPS nicht verfügbar oder Berechtigung verweigert.', savedError: 'GPS konnte nicht gespeichert werden: ', history: 'Ältere GPS-Punkte ohne bestätigtes Konto bleiben erhalten; bitten Sie das Büro um Hilfe.', confirmed: 'GPS-Sendungen bestätigt.' }
};
const syncText = {
  waiting: ['Em espera', 'Waiting', 'En attente', 'En espera', 'Wartend'],
  pending: ['Por confirmar', 'Awaiting confirmation', 'À confirmer', 'Por confirmar', 'Bestätigung ausstehend'],
  reviewing: ['A rever', 'Needs review', 'À vérifier', 'Por revisar', 'Prüfung erforderlich'],
  synchronized: ['Sincronizado', 'Synchronized', 'Synchronisé', 'Sincronizado', 'Synchronisiert'],
  updating: ['A atualizar', 'Updating', 'À actualiser', 'Por actualizar', 'Aktualisierung erforderlich'],
  empty: ['Sem pendências', 'Nothing pending', 'Aucun envoi en attente', 'Sin pendientes', 'Keine ausstehenden Punkte'],
  changed: ['Sessão alterada', 'Session changed', 'Session modifiée', 'Sesión cambiada', 'Sitzung geändert']
};
let browser, completed = false; const releases = [];
const deadline = setTimeout(() => { console.error('GPS language scenario did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'GPS language QA', active: true } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Lisbon' });
  await context.addInitScript(({ token, id, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaGpsLanguages')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'TECHNICIAN' }));
      localStorage.setItem('qaGpsLanguages', '1');
    }
    window.qaGps = { current: [], watchers: [], cleared: [] };
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (success, error) => qaGps.current.push({ success, error }), watchPosition: (success, error) => (qaGps.watchers.push({ success, error }), qaGps.watchers.length), clearWatch: id => qaGps.cleared.push(id) } });
  }, { token, id: tech.id, origin: base });
  const page = await context.newPage(), errors = [], requests = [];
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  const endpoint = base + '/api/gps/update';
  page.on('request', request => { if (request.url() === endpoint) requests.push({ method: request.method(), body: request.postData(), headers: request.headers() }); });
  await page.goto(base + '/technician-gps', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.waitForSelector('#cwLanguageSelect');
  const language = async lang => { await page.locator('#cwLanguageSelect').selectOption(lang); await page.waitForFunction(lang => document.documentElement.lang === lang, lang); };
  const stored = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('cwGpsPoint:v2:') || key === 'cristalwater_offline_gps').sort().map(key => [key, localStorage.getItem(key)]));
  const tracks = () => prisma.technicianTrack.count({ where: { technicianId: tech.id } });
  const idle = () => page.waitForFunction(() => !document.getElementById('sendNowBtn').disabled && !document.getElementById('gpsRetryBtn').disabled);
  const emit = time => page.evaluate(time => qaGps.current.at(-1).success({ coords: { latitude: 37.04, longitude: -8.67, accuracy: 9 }, timestamp: time }), time);
  const matrix = async (selector, key, state, prefix = '') => {
    const count = requests.length;
    await page.evaluate(() => { window.qaGpsNodes = Array.from(document.querySelectorAll('#cwLegacyGpsStatus,#gpsStatus,#sendNowBtn,#gpsRetryBtn,#startBtn,#syncKpi,#accuracyKpi,#lastKpi')); document.getElementById('gpsRetryBtn').focus(); });
    const before = await page.evaluate(() => ({ focus: document.activeElement.id, controls: ['startBtn','sendNowBtn','gpsRetryBtn'].map(id => document.getElementById(id).disabled), calls: window.qaGpsCalls && { ...qaGpsCalls }, kpis: ['syncKpi','accuracyKpi','lastKpi'].map(id => document.getElementById(id).textContent) }));
    const syncKey = Object.keys(syncText).find(key => syncText[key].includes(before.kpis[0])); assert(syncKey, 'known GPS synchronization state');
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const lang of Object.keys(copy)) {
        await language(lang); await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent === text, { selector, text: prefix + copy[lang][key] });
        assert.deepEqual(await stored(), state); assert(await page.evaluate(() => qaGpsNodes.every(node => node.isConnected)));
        const after = await page.evaluate(() => ({ focus: document.activeElement.id, controls: ['startBtn','sendNowBtn','gpsRetryBtn'].map(id => document.getElementById(id).disabled), calls: window.qaGpsCalls && { ...qaGpsCalls }, kpis: ['syncKpi','accuracyKpi','lastKpi'].map(id => document.getElementById(id).textContent) }));
        assert.equal(after.kpis[0], syncText[syncKey][Object.keys(copy).indexOf(lang)]);
        assert.deepEqual(after.kpis.slice(1), before.kpis.slice(1)); assert.deepEqual({ ...after, kpis: undefined }, { ...before, kpis: undefined });
        assert(await page.locator(selector).evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'GPS text fits the available width');
      }
    }
    assert.equal(requests.length, count);
  };
  const instrument = () => page.evaluate(() => { window.qaGpsCalls = {}; for (const name of ['save','send','flush','start','stop','status']) { const original = CWGps[name]; CWGps[name] = (...args) => { qaGpsCalls[name] = (qaGpsCalls[name] || 0) + 1; return original(...args); }; } });
  // The first assertion reproduces the untranslated notice on the real GPS page.
  await language('en'); await context.setOffline(true); await page.locator('#sendNowBtn').click(); await emit(Date.now()); await idle();
  assert.equal(await page.locator('#cwLegacyGpsStatus').textContent(), copy.en.offline);
  const original = await stored(); assert.equal(original.length, 1); assert.equal(await tracks(), 0);
  const point = JSON.parse(original[0][1]); assert.equal(point.owner, 'TECH:' + tech.id); assert.equal(original[0][0], 'cwGpsPoint:v2:' + point.owner + ':' + point.id);
  await instrument(); await matrix('#cwLegacyGpsStatus', 'offline', original);
  console.log('PASS five-language GPS notices at320/390/1440 preserve nodes, focus, controls, numeric KPI values and translated synchronization state, exact stored point and request count');
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload({ waitUntil: 'networkidle' }); await idle(); assert.deepEqual(await stored(), original);
  console.log('PASS cached offline reload preserves the exact GPS point');
  const cache = fs.readFileSync('frontend/sw.js', 'utf8').match(/const CACHE = '([^']+)'/)[1]; assert(await page.evaluate(name => caches.keys().then(names => names.includes(name)), cache));
  await instrument();
  const corruptKey = 'cwGpsPoint:v2:TECH:' + tech.id + ':' + randomUUID(), corruptRaw = '{broken GPS <img src=x onerror=window.qaInjected=true>';
  await page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [corruptKey, corruptRaw]); await page.locator('#gpsRetryBtn').click(); await idle();
  const corrupt = await stored(); await matrix('#gpsStatus', 'unreadable', corrupt);
  const owned = await page.evaluate(() => { try { CWGps.save({ latitude: 37, longitude: -8 }); } catch (error) { window.qaOwnedGpsError = error; return { message: error.message, frozen: Object.isFrozen(CWGpsErrors.copy(error)) }; } });
  assert.equal(owned.message, copy.pt.unreadable); assert.equal(owned.frozen, true);
  await page.evaluate(() => { const error = Error(qaOwnedGpsError.message); error.copy = CWGpsErrors.copy(qaOwnedGpsError); gpsError(error); });
  for (const lang of Object.keys(copy)) { await language(lang); assert.equal(await page.locator('#gpsStatus').textContent(), copy.pt.unreadable); assert.deepEqual(await stored(), corrupt); }
  await page.evaluate(() => gpsError(qaOwnedGpsError)); await matrix('#gpsStatus', 'unreadable', corrupt);
  await page.evaluate(key => localStorage.removeItem(key), corruptKey); assert.deepEqual(await stored(), original);
  console.log('PASS corrupt GPS storage survives language changes; error identity distinguishes owned errors from external errors with identical text or a forged copy');
  for (const lang of Object.keys(copy)) {
    await language(lang);
    const invalid = await page.evaluate(async () => { try { await CWGps.send(0, 0); } catch (error) { return error.message; } });
    assert.equal(invalid, copy.pt.invalid); assert.equal(await page.locator('#cwLegacyGpsStatus').textContent(), copy[lang].savedError + copy[lang].invalid); assert.deepEqual(await stored(), original);
  }
  const quotaText = 'QA storage denied <b>{error}</b>';
  await page.evaluate(text => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith('cwGpsPoint:v2:')) throw Error(text); return qaSetItem.call(this, key, value); }; }, quotaText);
  await page.evaluate(async () => { try { await CWGps.send(37, -8); } catch (_) {} });
  for (const lang of Object.keys(copy)) { await language(lang); await page.waitForFunction(text => document.getElementById('cwLegacyGpsStatus').textContent === text, copy[lang].savedError + quotaText); assert.deepEqual(await stored(), original); }
  await page.evaluate(() => { Storage.prototype.setItem = qaSetItem; });
  await page.locator('#startBtn').click(); await page.evaluate(() => qaGps.watchers.at(-1).error()); await matrix('#cwLegacyGpsStatus', 'permission', original); await matrix('#gpsStatus', 'permission', original);
  if (process.env.CW_GPS_LANGUAGE_CAPTURE) { await page.setViewportSize({ width: 320, height: 900 }); await language('de'); await page.locator('#cwLegacyGpsStatus').screenshot({ path: process.env.CW_GPS_LANGUAGE_CAPTURE }); }
  console.log('PASS invalid coordinates, storage failure and actual permission callback preserve the original point and translate only owned text, including nested errors');
  await context.setOffline(false); await page.waitForLoadState('networkidle');
  for (const body of [{ ok: true, success: true }, { ok: true, success: true, acknowledgement: { scope: 'GPS_READING', owner: 'TECH:999999' } }]) {
    await page.route(endpoint, route => route.fulfill({ status: 200, json: body })); await page.locator('#gpsRetryBtn').click(); await idle(); await page.unroute(endpoint);
    await matrix('#gpsStatus', 'unconfirmed', original); assert.equal(await tracks(), 0);
  }
  let release, entered; const gate = new Promise(resolve => { release = resolve; releases.push(resolve); }), started = new Promise(resolve => { entered = resolve; }); const sends = [];
  await page.route(endpoint, async route => {
    sends.push({ body: route.request().postDataJSON(), headers: route.request().headers() }); const response = await route.fetch(), data = await response.json();
    assert.equal(response.status(), 200); assert.equal(data.acknowledgement.pointId, point.id);
    if (sends.length === 1) { entered(); await gate; await route.abort('connectionfailed'); } else await route.fulfill({ response });
  });
  await page.locator('#gpsRetryBtn').click(); await started;
  const sending = await stored(), requestCount = requests.length;
  const identities = await page.evaluate(() => { window.qaSendingNodes = Array.from(document.querySelectorAll('#gpsStatus,#cwLegacyGpsStatus,#gpsRetryBtn,#sendNowBtn,#startBtn')); return { disabled: document.getElementById('gpsRetryBtn').disabled }; }); assert.equal(identities.disabled, true);
  for (const lang of Object.keys(copy)) { await language(lang); assert.deepEqual(await stored(), sending); assert(await page.evaluate(() => qaSendingNodes.every(node => node.isConnected) && document.getElementById('gpsRetryBtn').disabled)); }
  assert.equal(requests.length, requestCount); assert.equal(sends.length, 1); assert.equal(await tracks(), 1);
  release(); await idle(); assert.deepEqual(await stored(), original);
  await page.locator('#gpsRetryBtn').click(); await idle(); assert.deepEqual(await stored(), []); assert.equal(await tracks(), 1); assert.equal(sends.length, 2);
  assert.deepEqual(sends[0].body, sends[1].body); assert.equal(sends[0].body.pointId, point.id); for (const send of sends) assert.equal(send.headers.authorization, 'Bearer ' + token);
  await page.unroute(endpoint);
  const oldRaw = '[{"latitude":37,"longitude":-8,"notes":"antigo <b>{error}</b>"}]'; await page.evaluate(raw => localStorage.setItem('cristalwater_offline_gps', raw), oldRaw);
  await page.locator('#gpsRetryBtn').click(); await idle(); await matrix('#cwLegacyGpsStatus', 'history', [['cristalwater_offline_gps', oldRaw]]);
  await page.evaluate(() => localStorage.removeItem('cristalwater_offline_gps')); await page.locator('#gpsRetryBtn').click(); await idle(); await matrix('#cwLegacyGpsStatus', 'confirmed', []);
  const location = await prisma.technicianLocation.findFirstOrThrow({ where: { technicianId: tech.id } }); assert.equal(location.latitude, point.latitude); assert.equal(location.longitude, point.longitude);
  assert.equal(await page.evaluate(() => window.qaInjected), undefined); assert.deepEqual(errors, []);
  console.log('PASS original UUID/coordinates/time/owner survive incomplete acknowledgements and a lost real response; retry confirms one history point and old unowned history remains exact');
  completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); for (const release of releases) release(); if (browser) await browser.close(); await prisma.$disconnect(); });
