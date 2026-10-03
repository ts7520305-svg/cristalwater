'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken'), bcrypt = require('bcrypt'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  title: ['Cristal Water - Login Cliente', 'Cristal Water - Client login', 'Cristal Water - Connexion client', 'Cristal Water - Acceso del cliente', 'Cristal Water - Kundenanmeldung'],
  heading: ['Área do Cliente', 'Client area', 'Espace client', 'Área del cliente', 'Kundenbereich'],
  email: ['Email', 'Email', 'E-mail', 'Correo electrónico', 'E-Mail'],
  password: ['Password', 'Password', 'Mot de passe', 'Contraseña', 'Passwort'],
  enter: ['Entrar', 'Sign in', 'Se connecter', 'Entrar', 'Anmelden'],
  pending: ['A entrar...', 'Signing in...', 'Connexion en cours...', 'Iniciando sesión...', 'Anmeldung läuft...'],
  required: ['Preencha todos os campos.', 'Complete all fields.', 'Remplissez tous les champs.', 'Completa todos los campos.', 'Füllen Sie alle Felder aus.'],
  invalid: ['Login inválido', 'Invalid login', 'Connexion non valide', 'Inicio de sesión no válido', 'Ungültige Anmeldung'],
  notClient: ['Conta não é cliente.', 'This is not a client account.', 'Ce compte n’est pas un compte client.', 'Esta cuenta no es de cliente.', 'Dies ist kein Kundenkonto.'],
  connection: ['Erro ligação servidor.', 'Could not connect to the server.', 'Impossible de se connecter au serveur.', 'No se ha podido conectar con el servidor.', 'Verbindung zum Server fehlgeschlagen.'],
};
let browser, completed = false, checks = 0, fixtureClientId, fixtureTechnicianId;
const deadline = setTimeout(() => { console.error('Client login language QA deadline'); process.exit(1); }, 150000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
const raw = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key, localStorage.getItem(key)])));
const pending = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('cw-field-writes', 1); request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, read = db.transaction('requests').objectStore('requests').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a, b) => a.key.localeCompare(b.key))); }; read.onerror = () => reject(read.error); };
}));
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const capture = async (page, name) => {
  if (!process.env.CW_CLIENT_LOGIN_CAPTURE) return;
  await fs.mkdir(process.env.CW_CLIENT_LOGIN_CAPTURE, { recursive: true });
  await page.screenshot({ path: path.join(process.env.CW_CLIENT_LOGIN_CAPTURE, name + '.png') });
};
(async () => {
  const unique = randomUUID(), secretPassword = '  qa-' + unique + ' senha {key} <b>  ';
  const client = await prisma.client.create({ data: { name: 'Cliente <b>{key}</b> & literal', email: 'qa501-' + unique + '@example.test', password: await bcrypt.hash(secretPassword, 10), active: true } });
  fixtureClientId = client.id;
  const tech = await prisma.technician.create({ data: { name: 'Client login previous technician {key}', active: true } });
  fixtureTechnicianId = tech.id;
  const oldToken = jwt.sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN', techAuthVersion: tech.authVersion }, getJwtSecret(), { expiresIn: '1h' });
  const oldUser = { id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', name: tech.name, language: 'pt' };
  const work = {
    ['cwFieldVisitDrafts:v2:TECH:' + tech.id]: JSON.stringify({ version: 2, owner: 'TECH:' + tech.id, drafts: { 'visit-REGULAR-701': { values: { notes: 'REGULAR literal {key}', ph: '7.4' } }, 'visit-EXTRA-701': { values: { notes: 'EXTRA literal <b>data</b>', ph: '7.1' } } } }),
    ['cwFieldDocuments:v3:TECH:' + tech.id + ':TECHNICIAN:17:2026-10-01']: '{"unmodified":"document bytes {key}"}',
    ['cwFieldRouteCache:v2:TECH:' + tech.id]: '{"unmodified":"route bytes"}',
    'cwFieldLegacyCorrupt:keep': '{broken work bytes',
    ['cw:tech:' + tech.id + ':draft']: 'legacy draft unchanged',
  };
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  // Only fault responses and destination documents are controlled. Actual
  // client login, language preferences, session persistence and DB stay native.
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Lisbon', serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const requests = [], errors = [], logs = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => logs.push(message.text()));
  page.on('request', request => { const pathname = new URL(request.url()).pathname; if (pathname.startsWith('/api/')) requests.push({ path: pathname, method: request.method(), body: request.postData() }); });
  await page.goto(base + '/client-login'); await page.locator('#cwLanguageSelect').waitFor();
  await page.evaluate(({ work, user, token }) => {
    for (const [key, value] of Object.entries(work)) localStorage.setItem(key, value);
    for (const key of ['token', 'cristalwater_jwt', 'adminToken']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user));
  }, { work, user: oldUser, token: oldToken });
  await page.addScriptTag({ url: base + '/cw-field-write-store.js' });
  await page.evaluate(async () => {
    await CWFieldWriteStore.prepare('VISIT_COMPLETION', 701, { visitId: 701, notes: 'REGULAR actual pending' });
    await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION', 701, { visitType: 'EXTRA', notes: 'EXTRA actual pending' });
  });
  const originalPending = await pending(page), stored = await raw(page);
  assert.equal(originalPending.length, 2); assert.notEqual(originalPending[0].requestId, originalPending[1].requestId);
  assert(originalPending.every(row => row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64));
  const database = () => Promise.all([prisma.client.findUnique({ where: { id: client.id } }), prisma.technician.findUnique({ where: { id: tech.id } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count(), prisma.serviceVisit.count(), prisma.extraVisit.count()]);
  const savedDatabase = await database();
  const preserve = async (session = true) => {
    assert.deepEqual(await raw(page), stored); assert.deepEqual(await pending(page), originalPending); assert.deepEqual(await database(), savedDatabase);
    if (session) assert.deepEqual(await page.evaluate(() => ['token', 'cristalwater_jwt', 'adminToken'].map(key => localStorage.getItem(key))), Array(3).fill(oldToken));
  };
  const locale = async language => { await page.locator('#cwLanguageSelect').selectOption(language); await settle(page); assert.equal(await page.evaluate(() => document.documentElement.lang), language); };
  const loginRequests = () => requests.filter(request => request.path === '/api/client-auth/login');
  async function labels(state, literal) {
    const before = await page.evaluate(() => {
      window.qaClientLoginNodes = [...document.querySelectorAll('.login-box, .login-box *')];
      window.qaClientLoginTextNodes = qaClientLoginNodes.flatMap(node => [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE));
      const password = document.getElementById('password');
      return { email: document.getElementById('email').value, password: password.value, disabled: document.getElementById('loginBtn').disabled, focus: document.activeElement.id, selection: [password.selectionStart, password.selectionEnd] };
    });
    const beforeRequests = loginRequests().length;
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, language] of languages.entries()) {
        await locale(language);
        assert.equal(await page.title(), words.title[index]); assert.equal((await page.locator('.login-box h2').textContent()).trim(), words.heading[index]);
        for (const field of ['email', 'password']) {
          assert.equal(await page.locator('#' + field).getAttribute('placeholder'), words[field][index]);
          assert.equal(await page.locator('#' + field).getAttribute('aria-label'), words[field][index]);
        }
        assert.equal((await page.locator('#loginBtn').textContent()).trim(), words[state === 'pending' ? 'pending' : 'enter'][index]);
        if (!['initial', 'pending'].includes(state)) assert.equal(await page.locator('#error').textContent(), literal ?? words[state][index]);
        assert.deepEqual(await page.evaluate(() => { const password = document.getElementById('password'); return { email: document.getElementById('email').value, password: password.value, disabled: document.getElementById('loginBtn').disabled, focus: document.activeElement.id, selection: [password.selectionStart, password.selectionEnd] }; }), before);
        assert(await page.evaluate(() => qaClientLoginNodes.every(node => node.isConnected) && qaClientLoginTextNodes.every(node => node.isConnected)));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.login-box, #email, #password, #loginBtn')].every(node => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }) && ['email', 'password', 'loginBtn'].every(id => document.getElementById(id).getBoundingClientRect().height >= 44)));
        assert.equal(loginRequests().length, beforeRequests, 'Changing language does not repeat login');
        await preserve(); checks++;
        if (width === 320 && ['initial', 'connection', 'literal'].includes(state)) await capture(page, state + '-' + language + '-320');
      }
    }
    console.log('PASS client login labels ' + JSON.stringify({ state, widths: [320, 390, 1440], languages: 5, emailPasswordNodesAndFocusPreserved: true, pendingRequests: 2 }));
  }
  await page.locator('#email').fill(' typed@example.test '); await page.locator('#password').fill(' typed password {key} <b> '); await page.locator('#password').focus(); await page.evaluate(() => document.getElementById('password').setSelectionRange(2, 8));
  await labels('initial');
  await page.locator('#email').fill(''); await page.evaluate(() => login()); await labels('required'); assert.equal(loginRequests().length, 0);
  let arrived;
  const hold = route => { arrived?.(route); arrived = null; };
  const begin = async () => {
    const arrival = new Promise(resolve => { arrived = resolve; });
    await page.evaluate(() => { void login(); }); await page.waitForFunction(() => document.getElementById('loginBtn').disabled);
    return arrival;
  };
  await page.route('**/api/client-auth/login', hold);
  const firstArrival = new Promise(resolve => { arrived = resolve; });
  await page.locator('#email').fill(' ' + client.email + ' '); await page.locator('#password').press('Enter');
  const first = await firstArrival; await page.locator('#password').press('Enter'); await page.evaluate(() => { void login(); void login(); });
  assert.equal(loginRequests().length, 1); assert.equal(JSON.parse(loginRequests()[0].body).email, client.email); assert.equal(JSON.parse(loginRequests()[0].body).password, ' typed password {key} <b> ');
  await labels('pending'); await first.fulfill({ status: 401, json: { ok: false } }); await page.waitForFunction(() => !document.getElementById('loginBtn').disabled);
  await labels('invalid');
  for (const literal of ['Credenciais <b>{key}</b> & ' + 'x'.repeat(95), '{"key":"connection","params":{"name":"literal"}}']) {
    const held = await begin(); await held.fulfill({ status: 401, json: { ok: false, error: literal } }); await page.waitForFunction(() => !document.getElementById('loginBtn').disabled);
    assert.equal(await page.locator('#error b').count(), 0); await labels('literal', literal);
  }
  const invalidAccounts = [
    { ok: true, token: 'QA-not-a-client-token', user: { id: client.id, role: 'ADMIN' } },
    ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(id => ({ ok: true, token: 'QA-not-a-client-token', user: { id, role: 'CLIENT' } })),
    { ok: true, client: { id: client.id, role: 'CLIENT' } },
    { ok: true, token: 'QA-not-a-client-token' },
  ];
  for (const [index, response] of invalidAccounts.entries()) {
    const held = await begin(); await held.fulfill({ status: 200, json: response }); await page.waitForFunction(() => !document.getElementById('loginBtn').disabled);
    if (index === 0) await labels('notClient');
    else { const language = await page.evaluate(() => document.documentElement.lang); assert.equal(await page.locator('#error').textContent(), words.notClient[languages.indexOf(language)]); await preserve(); checks++; }
  }
  const network = await begin(); await network.abort('failed'); await page.waitForFunction(() => !document.getElementById('loginBtn').disabled && document.getElementById('error').textContent.length > 0); await labels('connection');
  await page.unroute('**/api/client-auth/login', hold);
  await page.route('**/client-portal', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Client destination</title><body>Client destination</body>' }));
  await page.route('**/invoice-document?*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Invoice destination</title><body>Invoice destination</body>' }));
  for (const returnTo of [null, '/invoice-document?id=501']) {
    if (new URL(page.url()).pathname !== '/client-login' || returnTo) { await page.goto(base + '/client-login' + (returnTo ? '?returnTo=' + encodeURIComponent(returnTo) : '')); await page.locator('#cwLanguageSelect').waitFor(); }
    await page.locator('#email').fill(' ' + client.email + ' '); await page.locator('#password').fill(secretPassword); await page.locator('#password').press('Enter');
    await page.waitForURL(base + (returnTo || '/client-portal'));
    const body = JSON.parse(loginRequests().at(-1).body); assert.equal(body.email, client.email); assert.equal(body.password, secretPassword);
    const session = await page.evaluate(() => ({ tokens: ['token', 'cristalwater_jwt', 'adminToken'].map(key => localStorage.getItem(key)), users: ['user', 'cristalwater_user'].map(key => JSON.parse(localStorage.getItem(key))), ids: ['cw_client_id', 'clientId'].map(key => localStorage.getItem(key)) }));
    assert(session.tokens.every(token => token === session.tokens[0])); const claims = jwt.verify(session.tokens[0], getJwtSecret());
    assert.equal(claims.id, client.id); assert.equal(claims.role, 'CLIENT'); assert.equal(claims.type, 'client');
    assert.deepEqual(session.users[0], session.users[1]); assert.equal(session.users[0].name, client.name); assert.equal(session.users[0].role, 'CLIENT'); assert.equal(session.users[0].clientId, client.id); assert.deepEqual(session.ids, Array(2).fill(String(client.id)));
    await preserve(false); checks++; console.log('PASS native client login ' + JSON.stringify({ exactTrimmedEmail: true, exactPasswordIncludingSpaces: true, literalName: true, redirect: returnTo || '/client-portal', pendingRequests: 2 }));
  }
  // Ownership is attached to original leaves/attributes, not public markers.
  for (const control of ['changed-text', 'replaced-node', 'changed-attributes']) {
    await page.goto(base + '/client-login'); await page.locator('#cwLanguageSelect').waitFor();
    await page.evaluate(control => {
      const heading = document.querySelector('.login-box h2'), password = document.getElementById('password');
      if (control === 'changed-text') { heading.firstChild.nodeValue = 'Login do operador <b>{key}</b>'; document.title = 'Título privado {key}'; }
      if (control === 'replaced-node') { const clone = heading.cloneNode(); clone.textContent = 'Novo título literal {key}'; heading.replaceWith(clone); }
      if (control === 'changed-attributes') { password.placeholder = 'Password do operador {key}'; password.setAttribute('aria-label', 'Password do operador {key}'); }
      window.qaForeignClientNode = document.querySelector('.login-box h2');
    }, control);
    for (const language of languages) {
      await locale(language);
      if (control === 'changed-text') { assert.equal(await page.locator('.login-box h2').textContent(), 'Login do operador <b>{key}</b>'); assert.equal(await page.title(), 'Título privado {key}'); }
      if (control === 'replaced-node') { assert.equal(await page.locator('.login-box h2').textContent(), 'Novo título literal {key}'); assert(await page.evaluate(() => document.querySelector('.login-box h2') === qaForeignClientNode)); }
      if (control === 'changed-attributes') { assert.equal(await page.locator('#password').getAttribute('placeholder'), 'Password do operador {key}'); assert.equal(await page.locator('#password').getAttribute('aria-label'), 'Password do operador {key}'); }
      await preserve(false); checks++;
    }
    console.log('PASS client login ownership ' + control);
  }
  assert.deepEqual(errors, []); assert(!logs.some(log => log.includes(secretPassword) || log.includes(oldToken)), 'Credentials must not reach console');
  assert.deepEqual(requests.filter(request => request.method !== 'GET' && !['/api/client-auth/login', '/api/settings/language/me'].includes(request.path)), [], 'No operational producer called');
  await context.close();
  // Use the original worker, warmed through actual network requests, offline.
  const offlineContext = await browser.newContext({ viewport: { width: 320, height: 900 }, timezoneId: 'Europe/Lisbon' });
  const offlinePage = await offlineContext.newPage(), offlineErrors = []; offlinePage.setDefaultTimeout(12000); offlinePage.on('pageerror', error => offlineErrors.push(error.message));
  await offlinePage.goto(base + '/client-login'); await offlinePage.locator('#cwLanguageSelect').waitFor(); await offlinePage.evaluate(() => navigator.serviceWorker.ready); await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await offlinePage.goto(base + '/client-login'); await offlinePage.locator('#cwLanguageSelect').waitFor();
  await offlinePage.waitForFunction(async () => { const cache = await caches.open('cristalwater-field-20261003-v336'); return Boolean(await cache.match('/client-login')) && Boolean(await cache.match('/client-login.js')) && Boolean(await cache.match('/cw-i18n.js')); });
  for (const [url, file] of [['/client-login', 'client-login.html'], ['/client-login.js', 'client-login.js'], ['/cw-auth.js', 'cw-auth.js'], ['/cw-i18n.js', 'cw-i18n.js']]) {
    const current = await fs.readFile(path.join(__dirname, '../frontend', file), 'utf8');
    assert.equal(await offlinePage.evaluate(async url => (await (await caches.open('cristalwater-field-20261003-v336')).match(url)).text(), url), current);
  }
  await offlinePage.evaluate(({ work, token, user }) => { for (const [key, value] of Object.entries(work)) localStorage.setItem(key, value); for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { work, token: oldToken, user: oldUser });
  await offlinePage.addScriptTag({ url: base + '/cw-field-write-store.js' });
  await offlinePage.evaluate(async () => { await CWFieldWriteStore.prepare('VISIT_COMPLETION', 701, { visitId: 701, notes: 'OFFLINE REGULAR actual pending' }); await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION', 701, { visitType: 'EXTRA', notes: 'OFFLINE EXTRA actual pending' }); await CristalAuth.clearSession(); localStorage.setItem('cw_language', 'de'); localStorage.setItem('cw_client_lang', 'de'); });
  const offlinePending = await pending(offlinePage), offlineWork = await raw(offlinePage); assert.equal(offlinePending.length, 2); assert(offlinePending.every(row => row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64));
  await offlineContext.setOffline(true); await offlinePage.goto(base + '/client-login?offline-shell=1'); await offlinePage.locator('#cwLanguageSelect').waitFor();
  assert.equal(await offlinePage.locator('.login-box h2').textContent(), words.heading[4]);
  await offlinePage.locator('#email').fill(' offline@example.test '); await offlinePage.locator('#password').fill(' offline password spaces '); await offlinePage.locator('#password').press('Enter');
  await offlinePage.waitForFunction(() => !document.getElementById('loginBtn').disabled && document.getElementById('error').textContent.length > 0);
  for (const [index, language] of languages.entries()) {
    await offlinePage.locator('#cwLanguageSelect').selectOption(language); await settle(offlinePage);
    assert.equal(await offlinePage.locator('#error').textContent(), words.connection[index]); assert.equal(await offlinePage.locator('#password').inputValue(), ' offline password spaces '); assert.equal(await offlinePage.locator('#email').inputValue(), 'offline@example.test');
    assert.equal(await offlinePage.locator('#loginBtn').textContent(), words.enter[index]); assert.equal(await offlinePage.evaluate(() => localStorage.getItem('cristalwater_jwt')), null);
    assert.deepEqual(await raw(offlinePage), offlineWork); assert.deepEqual(await pending(offlinePage), offlinePending); assert.deepEqual(await database(), savedDatabase);
    assert(await offlinePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks++;
  }
  await capture(offlinePage, 'cached-offline-de-320'); assert.deepEqual(offlineErrors, []); await offlineContext.close();
  console.log('PASS client login language result ' + JSON.stringify({ checks, languages: 5, widths: [320, 390, 1440], invalidAccountControls: invalidAccounts.length, nativeLogins: 2, enterSerialized: true, exactPassword: true, literalServerErrors: true, typedPendingRequests: 2, ownershipControls: 3, actualCachedShellOffline: true, noOperationalWrites: true }));
  completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearTimeout(deadline); await browser?.close();
  if (fixtureClientId || fixtureTechnicianId) {
    const keys = [fixtureClientId && 'LANGUAGE:CLIENT:' + fixtureClientId, fixtureTechnicianId && 'LANGUAGE:TECHNICIAN:' + fixtureTechnicianId].filter(Boolean);
    await prisma.systemSetting.deleteMany({ where: { key: { in: keys } } });
    if (fixtureClientId) await prisma.client.delete({ where: { id: fixtureClientId } });
    if (fixtureTechnicianId) await prisma.technician.delete({ where: { id: fixtureTechnicianId } });
    assert.equal(await prisma.client.count({ where: { id: fixtureClientId || -1 } }), 0); assert.equal(await prisma.technician.count({ where: { id: fixtureTechnicianId || -1 } }), 0);
    console.log('PASS client login fixtures removed');
  }
  await prisma.$disconnect();
});
