'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const publicKey = require('web-push').generateVAPIDKeys().publicKey;
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  enable: ['Ativar avisos no telemóvel', 'Enable phone alerts', 'Activer les alertes sur le téléphone', 'Activar avisos en el móvil', 'Handy-Hinweise aktivieren'],
  enabled: ['Avisos ativados', 'Alerts enabled', 'Alertes activées', 'Avisos activados', 'Hinweise aktiviert'],
  unsupported: ['Este navegador não disponibiliza avisos com a aplicação fechada.', 'This browser does not support alerts while the application is closed.', 'Ce navigateur ne permet pas les alertes lorsque l’application est fermée.', 'Este navegador no permite avisos con la aplicación cerrada.', 'Dieser Browser unterstützt keine Hinweise bei geschlossener Anwendung.'],
  permissionHint: ['Permita notificações para receber avisos com o ecrã bloqueado.', 'Allow notifications to receive alerts while the screen is locked.', 'Autorisez les notifications pour recevoir des alertes lorsque l’écran est verrouillé.', 'Permite las notificaciones para recibir avisos con la pantalla bloqueada.', 'Erlauben Sie Benachrichtigungen, um Hinweise bei gesperrtem Bildschirm zu erhalten.'],
  unconfigured: ['Avisos com ecrã bloqueado ainda indisponíveis. Contacte a administração.', 'Alerts with the screen locked are not available yet. Contact the administrator.', 'Les alertes avec l’écran verrouillé ne sont pas encore disponibles. Contactez l’administration.', 'Los avisos con la pantalla bloqueada aún no están disponibles. Contacta con la administración.', 'Hinweise bei gesperrtem Bildschirm sind noch nicht verfügbar. Wenden Sie sich an die Verwaltung.'],
  network: ['Ligue-se à rede para ativar os avisos.', 'Connect to the network to enable alerts.', 'Connectez-vous au réseau pour activer les alertes.', 'Conéctate a la red para activar los avisos.', 'Verbinden Sie sich mit dem Netzwerk, um Hinweise zu aktivieren.'],
  permissionDenied: ['Permissão de notificações não concedida.', 'Notification permission was not granted.', 'L’autorisation des notifications n’a pas été accordée.', 'No se ha concedido permiso para las notificaciones.', 'Die Berechtigung für Benachrichtigungen wurde nicht erteilt.'],
  failure: ['Falha ao ativar avisos', 'Failed to enable alerts', 'Échec de l’activation des alertes', 'Error al activar los avisos', 'Hinweise konnten nicht aktiviert werden'],
  registered: ['Dispositivo inscrito. Confirme com a administração a receção de um aviso de teste.', 'Device registered. Confirm receipt of a test alert with the administrator.', 'Appareil inscrit. Confirmez avec l’administration la réception d’une alerte de test.', 'Dispositivo registrado. Confirma con la administración la recepción de un aviso de prueba.', 'Gerät registriert. Bestätigen Sie mit der Verwaltung den Empfang eines Testhinweises.'],
};
let browser, completed = false;
const deadline = setTimeout(() => { console.error('Push language scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), vehicle = await prisma.vehicle.create({ data: { plate: 'PUSH-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Push <b>{owner}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Push language client', active: true } });
  const pools = await Promise.all(['REGULAR', 'EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' push', active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date() };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: new Date(), plannedDate: new Date() } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt: new Date() } });
  for (const table of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-PUSH-LANG-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 30 * 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 30 * 86400000) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const draft = { v: 2, owner: 'TECH:' + tech.id, drafts: Object.fromEntries(['REGULAR', 'EXTRA'].map(type => ['visit-' + type + '-' + id, { values: { notes: type + ' push draft <b>{owner}</b>' }, checks: {} }])) };
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const database = () => Promise.all([prisma.serviceVisit.findUnique({ where: { id } }), prisma.extraVisit.findUnique({ where: { id } }), prisma.transportGuide.findUnique({ where: { id: guide.id } }), prisma.workGuide.findMany({ where: { vehicleId: vehicle.id } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count()]);
  let checks = 0;
  async function scenario({ name, mode = 'ready', action = null, expected = 'permissionHint', disabled = false, enabled = false, type = 'REGULAR', widths = [320] }) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1500 }, timezoneId: 'Europe/Lisbon' }), requests = [], errors = [], posts = [];
    let conflicts = 0;
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await context.route(base + '/api/push/**', route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (path.endsWith('/public-key')) return mode === 'network' ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: { configured: mode !== 'unconfigured', publicKey } });
      assert.equal(path, '/api/push/subscriptions'); assert.equal(request.method(), 'POST'); assert.equal(request.headers().authorization, 'Bearer ' + token); posts.push(request.postDataJSON());
      if (action === 'failure') return route.fulfill({ status: 503, json: {} });
      if (action === 'server') return route.fulfill({ status: 503, json: { error: words.permissionDenied[0] } });
      if (action === 'conflict' && !conflicts++) return route.fulfill({ status: 409, json: { error: 'Original conflict' } });
      return route.fulfill({ json: { ok: true } });
    });
    await context.addInitScript(({ token, tech, draft, now, origin, mode, action }) => {
      if (top !== window || location.origin !== origin) return;
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('cwFieldVisitDrafts:v2:TECH:' + tech.id, JSON.stringify(draft)); Date.now = () => now;
      const interval = window.setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000, 60000].includes(delay) ? 0 : interval(callback, delay, ...args);
      Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
      window.qaPushCalls = { permission: 0, register: [], get: 0, subscribe: [], unsubscribe: [] }; window.qaPushMock = false; window.qaPushSubscription = null;
      if (mode === 'unsupported') { delete window.PushManager; return; }
      const serviceWorker = navigator.serviceWorker, register = serviceWorker.register.bind(serviceWorker), ready = serviceWorker.ready;
      const make = endpoint => ({ endpoint, toJSON() { return { endpoint, keys: { p256dh: 'QA-literal-key', auth: 'QA-literal-auth' } }; }, async unsubscribe() { qaPushCalls.unsubscribe.push(endpoint); return true; } });
      const registration = { pushManager: { async getSubscription() { qaPushCalls.get++; return qaPushSubscription; }, async subscribe(options) { qaPushCalls.subscribe.push({ userVisibleOnly: options.userVisibleOnly, bytes: [...options.applicationServerKey] }); if (action === 'foreign') throw Error('Permissão de notificações não concedida.'); return qaPushSubscription = make('https://push.invalid/qa-' + qaPushCalls.subscribe.length); } } };
      serviceWorker.register = (...args) => { if (!qaPushMock) return register(...args); qaPushCalls.register.push(args); return Promise.resolve(registration); };
      Object.defineProperty(serviceWorker, 'ready', { configurable: true, get: () => qaPushMock ? Promise.resolve(registration) : ready });
      Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default', requestPermission() { qaPushCalls.permission++; return Promise.resolve(action === 'denied' ? 'denied' : 'granted'); } } });
    }, { token, tech, draft, now, origin: base, mode, action });
    const page = await context.newPage(); page.setDefaultTimeout(9000); page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) requests.push({ path, method: request.method(), body: request.postData() }); });
    await page.goto(base + '/technician-field-mode?selectedVisitId=' + id + '&selectedVisitType=' + type, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(type => CWFieldVisitContext()?.visitType === type && ['transportGuideBox', 'workGuideBox', 'insuranceBox'].every(id => document.getElementById(id).dataset.source === 'live') && !['…', ''].includes(document.getElementById('fieldPhotosValue')?.textContent), type);
    await page.locator('[data-field-tab-button=more]').click();
    const button = page.locator('.water-card > button.btn'), status = page.locator('.water-card > div[role=status]');
    assert.equal(await button.count(), 1); assert.equal(await status.count(), 1); await page.waitForFunction(() => !!document.querySelector('.water-card > div[role=status]')?.textContent);
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const locale = async language => { await page.locator('#cwLanguageSelect').selectOption(language); await page.waitForFunction(language => document.documentElement.lang === language, language); await settle(); };
    await locale('en'); assert.equal(await button.textContent(), words.enable[1], 'Push control follows the actual language selector');
    if (action) { await page.evaluate(() => { qaPushMock = true; }); await button.click(); await page.waitForFunction(() => document.querySelector('.water-card > div[role=status]').textContent !== 'Allow notifications to receive alerts while the screen is locked.'); }
    await page.locator('[data-field-tab-button=more]').focus(); await settle();
    await page.evaluate(() => { window.qaPushNodes = [...document.querySelectorAll('.water-card > button.btn, .water-card > div[role=status]')]; window.qaPushHandler = qaPushNodes[0].onclick; });
    const state = () => page.evaluate(async () => ({ context: CWFieldVisitContext(), calls: qaPushCalls, token: ['token', 'cristalwater_jwt'].map(key => localStorage.getItem(key)), users: ['user', 'cristalwater_user'].map(key => { const user = JSON.parse(localStorage.getItem(key)); delete user.language; return user; }), stored: Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key, localStorage.getItem(key)]), writes: await CWFieldWriteStore.records(null, CWFieldWriteStore.session(), true), fields: ['notes', 'ph', 'chlorine', 'vehicleId', 'technicianId', 'startBtn', 'finishBtn'].map(id => { const node = document.getElementById(id); return [id, node.value, node.disabled, node.readOnly, node.hidden]; }), push: qaPushNodes.map(node => ({ type: node.type, disabled: node.disabled, role: node.getAttribute('role') })), focus: document.activeElement.dataset.fieldTabButton }));
    const before = await state(), db = await database(), first = requests.length, originalPosts = structuredClone(posts);
    for (const width of widths) { await page.setViewportSize({ width, height: 1500 }); for (const [i, language] of languages.entries()) {
      await locale(language); assert.equal(await button.textContent(), words[enabled ? 'enabled' : 'enable'][i]); assert.equal(await status.textContent(), expected === 'literal' ? words.permissionDenied[0] : words[expected][i]); assert.equal(await button.isDisabled(), disabled);
      assert.deepEqual(await state(), before); assert.deepEqual(await database(), db); assert.deepEqual(posts, originalPosts);
      assert(await page.evaluate(() => qaPushNodes.every(node => node.isConnected) && qaPushHandler === qaPushNodes[0].onclick));
      for (const node of [button, status]) assert(await node.evaluate(node => node.scrollWidth <= node.clientWidth + 1), name + ' fits ' + width + ' ' + language);
      checks++; if (process.env.CW_PUSH_CAPTURE && name === 'registered' && width === 320 && language === 'de') { await fs.mkdir(process.env.CW_PUSH_CAPTURE, { recursive: true }); await status.screenshot({ path: process.env.CW_PUSH_CAPTURE + '/push-registered-de-320.png' }); }
    } }
    for (const request of requests.slice(first)) { assert.equal(request.path, '/api/settings/language/me'); assert.equal(request.method, 'PUT'); assert.deepEqual(Object.keys(JSON.parse(request.body)), ['language']); }
    const calls = await page.evaluate(() => qaPushCalls), bytes = [...Buffer.from(publicKey.replace(/-/g, '+').replace(/_/g, '/'), 'base64')];
    if (action && action !== 'denied') { assert.equal(calls.permission, 1); assert.deepEqual(calls.register, [['/sw.js']]); for (const options of calls.subscribe) assert.deepEqual(options, { userVisibleOnly: true, bytes }); }
    if (action === 'denied') { assert.equal(calls.permission, 1); assert.equal(calls.register.length, 0); assert.equal(posts.length, 0); }
    if (action === 'conflict') { assert.equal(posts.length, 2); assert.equal(calls.subscribe.length, 2); assert.deepEqual(calls.unsubscribe, [posts[0].endpoint]); assert.notEqual(posts[0].endpoint, posts[1].endpoint); }
    for (const post of posts) assert.deepEqual(post.keys, { p256dh: 'QA-literal-key', auth: 'QA-literal-auth' });
    const drafts = await page.evaluate(() => CWFieldDraftSnapshot()); for (const type of ['REGULAR', 'EXTRA']) assert.equal(drafts['visit-' + type + '-' + id].values.notes, type + ' push draft <b>{owner}</b>');
    assert.deepEqual(errors, []); assert(requests.filter(request => !['GET', 'HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT' || request.path === '/api/push/subscriptions' && request.method === 'POST'));
    console.log('PASS push languages ' + JSON.stringify({ name, mode, action, expected, widths, type, posts: posts.length })); await context.close();
  }
  await scenario({ name: 'ready', widths: [320, 390, 1440] });
  await scenario({ name: 'unsupported', mode: 'unsupported', expected: 'unsupported', disabled: true });
  await scenario({ name: 'unconfigured', mode: 'unconfigured', expected: 'unconfigured', disabled: true });
  await scenario({ name: 'network', mode: 'network', expected: 'network', disabled: true });
  await scenario({ name: 'denied', action: 'denied', expected: 'permissionDenied' });
  await scenario({ name: 'registered', action: 'success', expected: 'registered', enabled: true, disabled: true, widths: [320, 390, 1440] });
  await scenario({ name: 'fallback', action: 'failure', expected: 'failure' });
  await scenario({ name: 'server-literal', action: 'server', expected: 'literal' });
  await scenario({ name: 'browser-literal', action: 'foreign', expected: 'literal' });
  await scenario({ name: 'conflict', action: 'conflict', expected: 'registered', enabled: true, disabled: true });
  await scenario({ name: 'typed-extra', action: 'success', expected: 'registered', enabled: true, disabled: true, type: 'EXTRA' });
  console.log('PASS push language result ' + JSON.stringify({ checks, typedDrafts: true, originalSubscriptionPayload: true, originalRegistrationOptions: true, noDeliveryAttempt: true, operationalWrites: 0 })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
