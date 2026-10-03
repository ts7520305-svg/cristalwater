'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken'), bcrypt = require('bcrypt'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const contracts = {
  "admin-login": {
    "title": [
      "Login Administração",
      "Administration login",
      "Connexion administration",
      "Acceso de administración",
      "Anmeldung zur Administration"
    ],
    "heading": [
      "Administração",
      "Administration",
      "Administration",
      "Administración",
      "Administration"
    ],
    "email": [
      "Email",
      "Email",
      "E-mail",
      "Correo electrónico",
      "E-Mail"
    ],
    "password": [
      "Password",
      "Password",
      "Mot de passe",
      "Contraseña",
      "Passwort"
    ],
    "enter": [
      "Entrar",
      "Sign in",
      "Se connecter",
      "Entrar",
      "Anmelden"
    ],
    "required": [
      "Preencha email e password.",
      "Enter email and password.",
      "Saisissez votre e-mail et votre mot de passe.",
      "Introduce el correo electrónico y la contraseña.",
      "Geben Sie E-Mail und Passwort ein."
    ],
    "pending": [
      "A entrar...",
      "Signing in...",
      "Connexion en cours...",
      "Iniciando sesión...",
      "Anmeldung läuft..."
    ],
    "invalid": [
      "Erro login",
      "Login error",
      "Erreur de connexion",
      "Error de inicio de sesión",
      "Anmeldefehler"
    ],
    "connection": [
      "Erro ligação servidor.",
      "Could not connect to the server.",
      "Impossible de se connecter au serveur.",
      "No se ha podido conectar con el servidor.",
      "Verbindung zum Server fehlgeschlagen."
    ],
    "restricted": [
      "Acesso reservado ao administrador.",
      "Access is reserved for the administrator.",
      "Accès réservé à l’administrateur.",
      "Acceso reservado al administrador.",
      "Der Zugang ist dem Administrator vorbehalten."
    ],
    "notAllowed": [
      "Acesso reservado ao administrador.",
      "Access is reserved for the administrator.",
      "Accès réservé à l’administrateur.",
      "Acceso reservado al administrador.",
      "Der Zugang ist dem Administrator vorbehalten."
    ]
  },
  "login": {
    "title": [
      "Cristal Water - Login",
      "Cristal Water - Sign in",
      "Cristal Water - Connexion",
      "Cristal Water - Acceso",
      "Cristal Water - Anmeldung"
    ],
    "mainLabel": [
      "Login Cristal Water",
      "Cristal Water sign in",
      "Connexion Cristal Water",
      "Acceso a Cristal Water",
      "Cristal Water Anmeldung"
    ],
    "access": [
      "Acesso reservado aos perfis autorizados da Cristal Water.",
      "Access is reserved for authorised Cristal Water profiles.",
      "Accès réservé aux profils autorisés de Cristal Water.",
      "Acceso reservado a los perfiles autorizados de Cristal Water.",
      "Der Zugang ist autorisierten Cristal Water Profilen vorbehalten."
    ],
    "security": [
      "Segurança",
      "Security",
      "Sécurité",
      "Seguridad",
      "Sicherheit"
    ],
    "trustData": [
      "Dados sensíveis protegidos para operação diária.",
      "Sensitive data protected for daily operations.",
      "Données sensibles protégées pour les opérations quotidiennes.",
      "Datos sensibles protegidos para las operaciones diarias.",
      "Sensible Daten für den täglichen Betrieb geschützt."
    ],
    "trustSession": [
      "Sessões autenticadas com controlo por perfil.",
      "Authenticated sessions with access control by profile.",
      "Sessions authentifiées avec contrôle d’accès par profil.",
      "Sesiones autenticadas con control de acceso por perfil.",
      "Authentifizierte Sitzungen mit Zugangskontrolle je Profil."
    ],
    "trustAudit": [
      "Registos de atividade para auditoria e suporte.",
      "Activity records for auditing and support.",
      "Historique d’activité pour l’audit et l’assistance.",
      "Registros de actividad para auditoría y soporte.",
      "Aktivitätsprotokolle für Prüfung und Support."
    ],
    "heading": [
      "Entrar no sistema",
      "Sign in to the system",
      "Se connecter au système",
      "Entrar en el sistema",
      "Beim System anmelden"
    ],
    "credentials": [
      "Use as credenciais atribuídas para aceder ao seu espaço de trabalho.",
      "Use your assigned credentials to access your workspace.",
      "Utilisez les identifiants qui vous ont été attribués pour accéder à votre espace de travail.",
      "Utiliza las credenciales asignadas para acceder a tu espacio de trabajo.",
      "Verwenden Sie Ihre zugewiesenen Zugangsdaten, um Ihren Arbeitsbereich zu öffnen."
    ],
    "email": [
      "Email",
      "Email",
      "E-mail",
      "Correo electrónico",
      "E-Mail"
    ],
    "password": [
      "Password",
      "Password",
      "Mot de passe",
      "Contraseña",
      "Passwort"
    ],
    "enter": [
      "Entrar",
      "Sign in",
      "Se connecter",
      "Entrar",
      "Anmelden"
    ],
    "required": [
      "Preencha email e password.",
      "Enter email and password.",
      "Saisissez votre e-mail et votre mot de passe.",
      "Introduce el correo electrónico y la contraseña.",
      "Geben Sie E-Mail und Passwort ein."
    ],
    "pending": [
      "A entrar...",
      "Signing in...",
      "Connexion en cours...",
      "Iniciando sesión...",
      "Anmeldung läuft..."
    ],
    "invalid": [
      "Erro login",
      "Login error",
      "Erreur de connexion",
      "Error de inicio de sesión",
      "Anmeldefehler"
    ],
    "connection": [
      "Erro ligação servidor.",
      "Could not connect to the server.",
      "Impossible de se connecter au serveur.",
      "No se ha podido conectar con el servidor.",
      "Verbindung zum Server fehlgeschlagen."
    ],
    "passwordPlaceholder": [
      "A sua password",
      "Your password",
      "Votre mot de passe",
      "Tu contraseña",
      "Ihr Passwort"
    ],
    "show": [
      "Mostrar",
      "Show",
      "Afficher",
      "Mostrar",
      "Anzeigen"
    ],
    "hide": [
      "Ocultar",
      "Hide",
      "Masquer",
      "Ocultar",
      "Ausblenden"
    ],
    "invalidResponse": [
      "Resposta de autenticação inválida.",
      "Invalid authentication response.",
      "Réponse d’authentification non valide.",
      "Respuesta de autenticación no válida.",
      "Ungültige Authentifizierungsantwort."
    ],
    "invalidRole": [
      "Tipo inválido: {role}",
      "Invalid type: {role}",
      "Type non valide : {role}",
      "Tipo no válido: {role}",
      "Ungültiger Typ: {role}"
    ],
    "notAllowed": [
      "Resposta de autenticação inválida.",
      "Invalid authentication response.",
      "Réponse d’authentification non valide.",
      "Respuesta de autenticación no válida.",
      "Ungültige Authentifizierungsantwort."
    ]
  }
};
let browser, completed = false, checks = 0;
const fixtureUserIds = [], fixtureTechnicianIds = [], fixtureLanguageKeys = new Set(), savedLanguageRows = new Map(), pageResults = [];
const deadline = setTimeout(() => { console.error('General/admin login language QA deadline'); process.exit(1); }, 150000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
const raw = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key, localStorage.getItem(key)])));
const pending = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('cw-field-writes', 1); request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, read = db.transaction('requests').objectStore('requests').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a, b) => a.key.localeCompare(b.key))); }; read.onerror = () => reject(read.error); };
}));
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const capture = async (page, name) => {
  name = new URL(page.url()).pathname.slice(1) + '-' + name;
  if (!process.env.CW_ENTRY_LOGIN_CAPTURE) return;
  await fs.mkdir(process.env.CW_ENTRY_LOGIN_CAPTURE, { recursive: true });
  await page.screenshot({ path: path.join(process.env.CW_ENTRY_LOGIN_CAPTURE, name + '.png') });
};
async function scenario(kind) {
  const words = contracts[kind], startChecks = checks;
  const unique = randomUUID(), secretPassword = '  qa-' + unique + ' senha {key} <b>  ';
  const people = [];
  for (const role of ['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER']) {
    const person = await prisma.user.create({ data: { name: role + ' <b>{key}</b> & literal', email: 'qa502-' + unique + '-' + role.toLowerCase() + '@example.test', password: await bcrypt.hash(secretPassword, 10), role, active: true } });
    fixtureUserIds.push(person.id);
    if (['TECHNICIAN', 'TEAM_LEADER'].includes(role)) {
      const linked = await prisma.technician.create({ data: { name: person.name, email: person.email, role, active: true } });
      fixtureTechnicianIds.push(linked.id); person.technician = linked;
    }
    people.push(person);
  }
  const client = people[0];
  const tech = await prisma.technician.create({ data: { name: 'Login previous technician {key}', active: true } });
  fixtureTechnicianIds.push(tech.id);
  const languageKeys = people.flatMap(person => ['LANGUAGE:' + person.role + ':' + person.id, ...(person.technician ? ['LANGUAGE:' + person.role + ':' + person.technician.id] : [])]).concat('LANGUAGE:TECHNICIAN:' + tech.id);
  const originalLanguageRows = await prisma.systemSetting.findMany({ where: { key: { in: languageKeys } } });
  for (const key of languageKeys) if (!fixtureLanguageKeys.has(key)) { fixtureLanguageKeys.add(key); savedLanguageRows.set(key, originalLanguageRows.find(row => row.key === key) || null); }
  const oldToken = jwt.sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN', techAuthVersion: tech.authVersion }, getJwtSecret(), { expiresIn: '1h' });
  const oldUser = { id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', name: tech.name, language: 'pt' };
  const work = {
    ['cwFieldVisitDrafts:v2:TECH:' + tech.id]: JSON.stringify({ version: 2, owner: 'TECH:' + tech.id, drafts: { 'visit-REGULAR-701': { values: { notes: 'REGULAR literal {key}', ph: '7.4' } }, 'visit-EXTRA-701': { values: { notes: 'EXTRA literal <b>data</b>', ph: '7.1' } } } }),
    ['cwFieldDocuments:v3:TECH:' + tech.id + ':TECHNICIAN:17:2026-10-01']: '{"unmodified":"document bytes {key}"}',
    ['cwFieldRouteCache:v2:TECH:' + tech.id]: '{"unmodified":"route bytes"}',
    'cwFieldLegacyCorrupt:keep': '{broken work bytes',
    ['cw:tech:' + tech.id + ':draft']: 'legacy draft unchanged',
  };
  if (!browser) browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  // Only fault responses and destination documents are controlled. Actual
  // general/admin login, language preferences, session persistence and DB stay native.
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Lisbon', serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const requests = [], errors = [], logs = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => logs.push(message.text()));
  page.on('request', request => { const pathname = new URL(request.url()).pathname; if (pathname.startsWith('/api/')) requests.push({ path: pathname, method: request.method(), body: request.postData() }); });
  await page.goto(base + '/' + kind); await page.locator('#cwLanguageSelect').waitFor();
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
  const database = () => Promise.all([prisma.user.findMany({ where: { id: { in: people.map(person => person.id) } }, orderBy: { id: 'asc' } }), prisma.technician.findMany({ where: { id: { in: [tech.id, ...people.filter(person => person.technician).map(person => person.technician.id)] } }, orderBy: { id: 'asc' } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count(), prisma.serviceVisit.count(), prisma.extraVisit.count()]);
  const savedDatabase = await database();
  const preserve = async (session = true) => {
    assert.deepEqual(await raw(page), stored); assert.deepEqual(await pending(page), originalPending); assert.deepEqual(await database(), savedDatabase);
    if (session) assert.deepEqual(await page.evaluate(() => ['token', 'cristalwater_jwt', 'adminToken'].map(key => localStorage.getItem(key))), Array(3).fill(oldToken));
  };
  const locale = async language => { await page.locator('#cwLanguageSelect').selectOption(language); await settle(page); assert.equal(await page.evaluate(() => document.documentElement.lang), language); };
  const loginRequests = () => requests.filter(request => request.path === '/api/auth/login');
  async function labels(state, literal) {
    const before = await page.evaluate(() => {
      window.qaClientLoginNodes = [...document.querySelectorAll('[data-cw-entry-copy], [data-cw-entry-aria], [data-cw-entry-placeholder], #error')];
      window.qaClientLoginTextNodes = qaClientLoginNodes.flatMap(node => [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE));
      const password = document.getElementById('password');
      return { email: document.getElementById('email').value, password: password.value, disabled: document.getElementById('loginBtn').disabled, focus: document.activeElement.id, selection: [password.selectionStart, password.selectionEnd], type: password.type, pressed: document.getElementById('togglePassword')?.getAttribute('aria-pressed') || null };
    });
    const beforeRequests = loginRequests().length;
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, language] of languages.entries()) {
        await locale(language);
        assert.equal(await page.title(), words.title[index]); assert.equal((await page.locator('h2[data-cw-entry-copy=heading]').textContent()).trim(), words.heading[index]);
        for (const field of ['email', 'password']) {
          assert.equal(await page.locator('#' + field).getAttribute('placeholder'), (kind === 'login' ? (field === 'email' ? 'nome@empresa.pt' : words.passwordPlaceholder[index]) : words[field][index]));
          assert.equal(await page.locator('#' + field).getAttribute('aria-label'), words[field][index]);
        }
        if (kind === 'login') {
          assert.equal(await page.locator('main').getAttribute('aria-label'), words.mainLabel[index]);
          assert.equal(await page.locator('.cw-login-trust').getAttribute('aria-label'), words.security[index]);
          for (const key of ['access', 'trustData', 'trustSession', 'trustAudit', 'credentials', 'email', 'password']) assert.equal((await page.locator('[data-cw-entry-copy=' + key + ']').textContent()).trim(), words[key][index]);
          const shown = await page.locator('#togglePassword').getAttribute('aria-pressed') === 'true';
          assert.equal(await page.locator('#password').getAttribute('type'), shown ? 'text' : 'password');
          assert.equal(await page.locator('#togglePassword').textContent(), words[shown ? 'hide' : 'show'][index]);
          assert.equal(await page.locator('#togglePassword').getAttribute('aria-controls'), 'password');
        }
        assert.equal((await page.locator('#loginBtn').textContent()).trim(), words[state === 'pending' ? 'pending' : 'enter'][index]);
        if (!['initial', 'pending', 'visible', 'hidden'].includes(state)) assert.equal(await page.locator('#error').textContent(), literal ?? words[state][index]);
        assert.deepEqual(await page.evaluate(() => { const password = document.getElementById('password'); return { email: document.getElementById('email').value, password: password.value, disabled: document.getElementById('loginBtn').disabled, focus: document.activeElement.id, selection: [password.selectionStart, password.selectionEnd], type: password.type, pressed: document.getElementById('togglePassword')?.getAttribute('aria-pressed') || null }; }), before);
        assert(await page.evaluate(() => qaClientLoginNodes.every(node => node.isConnected) && qaClientLoginTextNodes.every(node => node.isConnected)));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('#email, #password, #loginBtn, #togglePassword')].every(node => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44; })));
        assert.equal(loginRequests().length, beforeRequests, 'Changing language does not repeat login');
        await preserve(); checks++;
        if (width === 320 && ['initial', 'connection', 'literal'].includes(state)) await capture(page, state + '-' + language + '-320');
      }
    }
    console.log('PASS general/admin login labels ' + JSON.stringify({ kind, state, widths: [320, 390, 1440], languages: 5, emailPasswordNodesAndFocusPreserved: true, pendingRequests: 2 }));
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
  await page.route('**/api/auth/login', hold);
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
    ...(kind === 'admin-login' ? ['CLIENT', 'TECHNICIAN', 'TEAM_LEADER', 'UNKNOWN', null] : ['UNKNOWN', null, '', '  other  ', {}]).map(role => ({ ok: true, token: 'QA-invalid-account-token', user: { id: client.id, role } })),
    { ok: true, user: { id: client.id, role: 'ADMIN' } },
    { ok: true, token: 'QA-invalid-account-token' },
  ];
  for (const [index, response] of invalidAccounts.entries()) {
    const held = await begin(); await held.fulfill({ status: 200, json: response }); await page.waitForFunction(() => !document.getElementById('loginBtn').disabled);
    if (index === 0) await labels('notAllowed');
    else { const language = await page.evaluate(() => document.documentElement.lang); assert.equal(await page.locator('#error').textContent(), words.notAllowed[languages.indexOf(language)]); await preserve(); checks++; }
  }
  const network = await begin(); await network.abort('failed'); await page.waitForFunction(() => !document.getElementById('loginBtn').disabled && document.getElementById('error').textContent.length > 0); await labels('connection');
  await page.unroute('**/api/auth/login', hold);
  for (const route of ['/admin-menu', '/client-portal', '/technician', '/invoice-document?*']) await page.route('**' + route, request => request.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Native route destination</title><body>Native route destination</body>' }));
  const nativeCases = (kind === 'admin-login' ? [people[0]] : people).flatMap(person => [null, '/invoice-document?id=502'].map(returnTo => ({ person, returnTo })));
  for (const { person, returnTo } of nativeCases) {
    await page.goto(base + '/' + kind + (returnTo ? '?returnTo=' + encodeURIComponent(returnTo) : '')); await page.locator('#cwLanguageSelect').waitFor();
    await page.locator('#email').fill(' ' + person.email + ' '); await page.locator('#password').fill(secretPassword); await page.locator('#password').press('Enter');
    const destination = kind === 'login' && returnTo && ['ADMIN', 'CLIENT'].includes(person.role) ? returnTo : person.role === 'ADMIN' ? '/admin-menu' : person.role === 'CLIENT' ? '/client-portal' : '/technician';
    await page.waitForURL(base + destination);
    const body = JSON.parse(loginRequests().at(-1).body); assert.equal(body.email, person.email); assert.equal(body.password, secretPassword);
    const session = await page.evaluate(() => ({ tokens: ['token', 'cristalwater_jwt', 'adminToken'].map(key => localStorage.getItem(key)), users: ['user', 'cristalwater_user'].map(key => JSON.parse(localStorage.getItem(key))) }));
    assert(session.tokens.every(token => token === session.tokens[0])); const claims = jwt.verify(session.tokens[0], getJwtSecret());
    assert.equal(claims.userId, person.id); assert.equal(claims.role, person.role); assert.equal(claims.principalType, 'USER');
    assert.deepEqual(session.users[0], session.users[1]); assert.equal(session.users[0].name, person.name); assert.equal(session.users[0].role, person.role);
    if (person.technician) { assert.equal(claims.id, person.technician.id); assert.equal(claims.technicianId, person.technician.id); assert.equal(claims.techAuthVersion, person.technician.authVersion); }
    await preserve(false); checks++; console.log('PASS native general/admin login ' + JSON.stringify({ kind, role: person.role, exactTrimmedEmail: true, exactPasswordIncludingSpaces: true, literalName: true, redirect: destination, pendingRequests: 2 }));
  }
  if (kind === 'login') {
    await page.goto(base + '/' + kind); await page.locator('#cwLanguageSelect').waitFor();
    await page.evaluate(({ token, user }) => CristalAuth.persistSession(token, user), { token: oldToken, user: oldUser });
    await page.locator('#email').fill('visibility@example.test'); await page.locator('#password').fill(' visible password bytes ');
    for (const state of ['visible', 'hidden']) {
      await page.locator('#togglePassword').click(); await settle(page); await page.locator('#password').focus(); await page.evaluate(() => document.getElementById('password').setSelectionRange(2, 8));
      assert.equal(await page.locator('#password').getAttribute('type'), state === 'visible' ? 'text' : 'password');
      await labels(state);
    }
  }
  // Ownership is attached to original leaves/attributes, not public markers.
  for (const control of ['changed-text', 'replaced-node', 'changed-attributes']) {
    await page.goto(base + '/' + kind); await page.locator('#cwLanguageSelect').waitFor();
    await page.evaluate(control => {
      const heading = document.querySelector('h2[data-cw-entry-copy=heading]'), password = document.getElementById('password');
      if (control === 'changed-text') { heading.firstChild.nodeValue = 'Login do operador <b>{key}</b>'; document.title = 'Título privado {key}'; }
      if (control === 'replaced-node') { const clone = heading.cloneNode(); clone.textContent = 'Novo título literal {key}'; heading.replaceWith(clone); }
      if (control === 'changed-attributes') { password.placeholder = 'Password do operador {key}'; password.setAttribute('aria-label', 'Password do operador {key}'); }
      window.qaForeignClientNode = document.querySelector('h2[data-cw-entry-copy=heading]');
    }, control);
    for (const language of languages) {
      await locale(language);
      if (control === 'changed-text') { assert.equal(await page.locator('h2[data-cw-entry-copy=heading]').textContent(), 'Login do operador <b>{key}</b>'); assert.equal(await page.title(), 'Título privado {key}'); }
      if (control === 'replaced-node') { assert.equal(await page.locator('h2[data-cw-entry-copy=heading]').textContent(), 'Novo título literal {key}'); assert(await page.evaluate(() => document.querySelector('h2[data-cw-entry-copy=heading]') === qaForeignClientNode)); }
      if (control === 'changed-attributes') { assert.equal(await page.locator('#password').getAttribute('placeholder'), 'Password do operador {key}'); assert.equal(await page.locator('#password').getAttribute('aria-label'), 'Password do operador {key}'); }
      await preserve(false); checks++;
    }
    console.log('PASS general/admin login ownership ' + control);
  }
  assert.deepEqual(errors, []); assert(!logs.some(log => log.includes(secretPassword) || log.includes(oldToken)), 'Credentials must not reach console');
  assert.deepEqual(requests.filter(request => request.method !== 'GET' && !['/api/auth/login', '/api/settings/language/me'].includes(request.path)), [], 'No operational producer called');
  await context.close();
  // The general entry does not register a worker. Warm the existing admin
  // registration first, then load the entry through its actual shared worker.
  const offlineContext = await browser.newContext({ viewport: { width: 320, height: 900 }, timezoneId: 'Europe/Lisbon' });
  const offlinePage = await offlineContext.newPage(), offlineErrors = []; offlinePage.setDefaultTimeout(12000); offlinePage.on('pageerror', error => offlineErrors.push(error.message));
  await offlinePage.goto(base + '/' + (kind === 'login' ? 'admin-login' : kind)); await offlinePage.locator('#cwLanguageSelect').waitFor(); await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller)); await offlinePage.evaluate(() => navigator.serviceWorker.ready);
  await offlinePage.goto(base + '/' + kind); await offlinePage.locator('#cwLanguageSelect').waitFor();
  await offlinePage.waitForFunction(async kind => { const cache = await caches.open('cristalwater-field-20261003-v324'); return Boolean(await cache.match('/' + kind)) && Boolean(await cache.match('/' + kind + '.js')) && Boolean(await cache.match('/cw-i18n.js')); }, kind);
  for (const [url, file] of [['/' + kind, kind + '.html'], ['/' + kind + '.js', kind + '.js'], ['/cw-auth.js', 'cw-auth.js'], ['/cw-i18n.js', 'cw-i18n.js']]) {
    const current = await fs.readFile(path.join(__dirname, '../frontend', file), 'utf8');
    assert.equal(await offlinePage.evaluate(async url => (await (await caches.open('cristalwater-field-20261003-v324')).match(url)).text(), url), current);
  }
  await offlinePage.evaluate(({ work, token, user }) => { for (const [key, value] of Object.entries(work)) localStorage.setItem(key, value); for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { work, token: oldToken, user: oldUser });
  await offlinePage.addScriptTag({ url: base + '/cw-field-write-store.js' });
  await offlinePage.evaluate(async () => { await CWFieldWriteStore.prepare('VISIT_COMPLETION', 701, { visitId: 701, notes: 'OFFLINE REGULAR actual pending' }); await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION', 701, { visitType: 'EXTRA', notes: 'OFFLINE EXTRA actual pending' }); await CristalAuth.clearSession(); localStorage.setItem('cw_language', 'de'); localStorage.setItem('cw_client_lang', 'de'); });
  const offlinePending = await pending(offlinePage), offlineWork = await raw(offlinePage); assert.equal(offlinePending.length, 2); assert(offlinePending.every(row => row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64));
  await offlineContext.setOffline(true); await offlinePage.goto(base + '/' + kind + '?offline-shell=1'); await offlinePage.locator('#cwLanguageSelect').waitFor();
  assert.equal(await offlinePage.locator('h2[data-cw-entry-copy=heading]').textContent(), words.heading[4]);
  await offlinePage.locator('#email').fill(' offline@example.test '); await offlinePage.locator('#password').fill(' offline password spaces '); await offlinePage.locator('#password').press('Enter');
  await offlinePage.waitForFunction(() => !document.getElementById('loginBtn').disabled && document.getElementById('error').textContent.length > 0);
  for (const [index, language] of languages.entries()) {
    await offlinePage.locator('#cwLanguageSelect').selectOption(language); await settle(offlinePage);
    assert.equal(await offlinePage.locator('#error').textContent(), words.connection[index]); assert.equal(await offlinePage.locator('#password').inputValue(), ' offline password spaces '); assert.equal(await offlinePage.locator('#email').inputValue(), kind === 'login' ? 'offline@example.test' : ' offline@example.test ');
    assert.equal(await offlinePage.locator('#loginBtn').textContent(), words.enter[index]); assert.equal(await offlinePage.evaluate(() => localStorage.getItem('cristalwater_jwt')), null);
    assert.deepEqual(await raw(offlinePage), offlineWork); assert.deepEqual(await pending(offlinePage), offlinePending); assert.deepEqual(await database(), savedDatabase);
    assert(await offlinePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks++;
  }
  await capture(offlinePage, 'cached-offline-de-320'); assert.deepEqual(offlineErrors, []); await offlineContext.close();
  console.log('PASS general/admin login language result ' + JSON.stringify({ checks, languages: 5, widths: [320, 390, 1440], kind, invalidAccountControls: invalidAccounts.length, nativeLogins: nativeCases.length, enterSerialized: true, exactPassword: true, literalServerErrors: true, typedPendingRequests: 2, ownershipControls: 3, actualCachedShellOffline: true, noOperationalWrites: true }));
  pageResults.push({ kind, checks: checks - startChecks, nativeLogins: nativeCases.length, invalidAccountControls: invalidAccounts.length, visibilityStates: kind === 'login' ? 2 : 0 });
}
(async () => {
  for (const kind of ['login', 'admin-login'].filter(kind => !process.env.CW_LOGIN_NEGATIVE_KIND || kind === process.env.CW_LOGIN_NEGATIVE_KIND)) await scenario(kind);
  console.log('PASS general/admin login result ' + JSON.stringify({ checks, pages: pageResults })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearTimeout(deadline); await browser?.close();
  if (fixtureUserIds.length || fixtureTechnicianIds.length) {
    await prisma.systemSetting.deleteMany({ where: { key: { in: [...fixtureLanguageKeys] } } });
    const original = [...savedLanguageRows.values()].filter(Boolean);
    if (original.length) await prisma.systemSetting.createMany({ data: original });
    await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
    await prisma.technician.deleteMany({ where: { id: { in: fixtureTechnicianIds } } });
    assert.equal(await prisma.user.count({ where: { id: { in: fixtureUserIds } } }), 0); assert.equal(await prisma.technician.count({ where: { id: { in: fixtureTechnicianIds } } }), 0);
    const restored = await prisma.systemSetting.findMany({ where: { key: { in: [...fixtureLanguageKeys] } }, orderBy: { key: 'asc' } });
    assert.deepEqual(restored, original.sort((a, b) => a.key.localeCompare(b.key)));
    console.log('PASS general/admin login fixtures removed and previous language settings restored');
  }
  await prisma.$disconnect();
});
