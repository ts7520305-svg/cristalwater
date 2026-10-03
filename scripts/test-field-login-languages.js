'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const pins = require('../src/services/technicianPinService');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const languages = ['pt','en','fr','es','de'];
const words = {
  title: ['Técnico - Cristal Water','Technician - Cristal Water','Technicien - Cristal Water','Técnico - Cristal Water','Techniker - Cristal Water'],
  heading: ['Login Técnico','Technician login','Connexion du technicien','Acceso del técnico','Techniker-Anmeldung'],
  pin: ['PIN do técnico','Technician PIN','PIN du technicien','PIN del técnico','Techniker-PIN'],
  enter: ['Entrar','Sign in','Se connecter','Entrar','Anmelden'],
  leave: ['Sair','Sign out','Se déconnecter','Salir','Abmelden'],
  required: ['Introduza o PIN do técnico.','Enter the technician PIN.','Saisissez le PIN du technicien.','Introduce el PIN del técnico.','Geben Sie die Techniker-PIN ein.'],
  pending: ['A entrar...','Signing in...','Connexion en cours...','Iniciando sesión...','Anmeldung läuft...'],
  invalid: ['PIN inválido.','Invalid PIN.','PIN incorrect.','PIN no válido.','Ungültige PIN.'],
  connection: ['Erro de ligação ao servidor.','Could not connect to the server.','Impossible de se connecter au serveur.','No se ha podido conectar con el servidor.','Verbindung zum Server fehlgeschlagen.'],
  connectionNoSession: ['Ligação instável. Verifique a rede e tente novamente.','Unstable connection. Check the network and try again.','Connexion instable. Vérifiez le réseau et réessayez.','Conexión inestable. Comprueba la red y vuelve a intentarlo.','Instabile Verbindung. Prüfen Sie die Netzwerkverbindung und versuchen Sie es erneut.'],
  connectionRetained: ['Ligação instável. A sessão foi mantida e os dados serão preservados.','Unstable connection. Your session was retained and your data will be preserved.','Connexion instable. La session a été conservée et les données seront préservées.','Conexión inestable. Se ha mantenido la sesión y se conservarán los datos.','Instabile Verbindung. Die Sitzung wurde beibehalten und Ihre Daten bleiben erhalten.'],
  welcome: ['Bem-vindo ','Welcome ','Bienvenue ','Bienvenido ','Willkommen '],
  technician: ['Técnico','Technician','Technicien','Técnico','Techniker'],
};
let browser, completed = false, checks = 0;
const deadline = setTimeout(() => { console.error('Technician login language QA deadline'); process.exit(1); },150000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const unique = randomUUID(), secretPin = 'qa-' + unique;
  const tech = await prisma.technician.create({ data: { name: 'Técnico <b>{name}</b> & ' + 'x'.repeat(95),pin: await pins.hash(secretPin),active: true } });
  const leaderPin = 'leader-' + unique;
  const leader = await prisma.technician.create({ data: { name: 'TEAM LEADER literal {name}',role: 'TEAM_LEADER',pin: await pins.hash(leaderPin),active: true } });
  const oldToken = jwt.sign({ id: tech.id,technicianId: tech.id,role: 'TECHNICIAN',principalType: 'TECHNICIAN',techAuthVersion: tech.authVersion },getJwtSecret(),{ expiresIn: '1h' });
  const user = { id: tech.id,technicianId: tech.id,role: 'TECHNICIAN',name: tech.name,language: 'pt' };
  const work = {
    ['cwFieldVisitDrafts:v2:TECH:' + tech.id]: JSON.stringify({ version: 2,owner: 'TECH:' + tech.id,drafts: { 'visit-REGULAR-701': { values: { notes: 'REGULAR literal {name}',ph: '7.4' } },'visit-EXTRA-701': { values: { notes: 'EXTRA literal <b>data</b>',ph: '7.1' } } } }),
    ['cwFieldDocuments:v3:TECH:' + tech.id + ':TECHNICIAN:17:2026-10-01']: '{"unmodified":"document bytes {name}"}',
    ['cwFieldRouteCache:v2:TECH:' + tech.id]: '{"unmodified":"route bytes"}',
    'cwFieldLegacyCorrupt:keep': '{broken work bytes',
    ['cw:tech:' + tech.id + ':draft']: 'legacy draft unchanged',
  };
  browser = await chromium.launch({ headless: true,executablePath: process.env.CW_CHROMIUM_PATH,args: ['--no-sandbox','--disable-dev-shm-usage'] });
  // Fault-response and navigation probes select network responses explicitly.
  // The separate final context exercises the original worker and cache offline.
  const context = await browser.newContext({ viewport: { width: 390,height: 900 },timezoneId: 'Europe/Lisbon',serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  // This isolated boundary returns the original rejected Error to the shared
  // fetch wrapper; real login/settings requests keep their native path.
  await context.addInitScript(() => {
    const native = window.fetch.bind(window),get = Storage.prototype.getItem;
    window.qaConnectionReadFailure = false;
    Storage.prototype.getItem = function(key) { if (qaConnectionReadFailure && key === 'cristalwater_jwt') throw new DOMException('QA credential read unavailable','SecurityError'); return get.call(this,key); };
    window.fetch = (input,options) => {
      if (new URL(typeof input === 'string' ? input : input.url,location.href).pathname !== '/api/qa-connection-toast') return native(input,options);
      window.qaConnectionAuthorization = new Headers(options?.headers).get('Authorization');
      return new Promise((resolve,reject) => { window.qaConnectionRelease = kind => { window.qaConnectionOriginalError = kind === 'abort' ? new DOMException('QA original cancellation','AbortError') : new TypeError('QA original network failure'); reject(qaConnectionOriginalError); }; });
    };
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [],requests = [],logs = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => logs.push(message.text()));
  page.on('request', request => { const pathname = new URL(request.url()).pathname; if (pathname.startsWith('/api/')) requests.push({ path: pathname,method: request.method(),body: request.postData() }); });
  await page.goto(base + '/technician-login'); await page.locator('#cwLanguageSelect').waitFor();
  await page.evaluate(({ work,user,token }) => {
    for (const [key,value] of Object.entries(work)) localStorage.setItem(key,value);
    for (const key of ['token','cristalwater_jwt','adminToken']) localStorage.setItem(key,token);
    for (const key of ['user','cristalwater_user']) localStorage.setItem(key,JSON.stringify(user));
  },{ work,user,token: oldToken });
  await page.addScriptTag({ url: base + '/cw-field-write-store.js' });
  await page.evaluate(async () => {
    await CWFieldWriteStore.prepare('VISIT_COMPLETION',701,{ visitId: 701,notes: 'REGULAR actual pending' });
    await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',701,{ visitType: 'EXTRA',notes: 'EXTRA actual pending' });
  });
  const raw = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key,localStorage.getItem(key)])));
  const pending = () => page.evaluate(() => new Promise((resolve,reject) => {
    const request = indexedDB.open('cw-field-writes',1); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result,read = db.transaction('requests').objectStore('requests').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a,b) => a.key.localeCompare(b.key))); }; read.onerror = () => reject(read.error); };
  }));
  const originalPending = await pending(),stored = await raw();
  assert.equal(originalPending.length,2); assert.notEqual(originalPending[0].requestId,originalPending[1].requestId);
  assert(originalPending.every(row => row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64));
  const database = () => Promise.all([prisma.technician.findMany({ where: { id: { in: [tech.id,leader.id] } },orderBy: { id: 'asc' } }),prisma.fieldWriteRequest.count(),prisma.stockMovement.count(),prisma.serviceVisit.count(),prisma.extraVisit.count()]);
  const savedDatabase = await database();
  const preserve = async (session = true) => {
    assert.deepEqual(await raw(),stored); assert.deepEqual(await pending(),originalPending); assert.deepEqual(await database(),savedDatabase);
    if (session) assert.deepEqual(await page.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),Array(3).fill(oldToken));
  };
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const locale = async language => { await page.locator('#cwLanguageSelect').selectOption(language); await settle(); assert.equal(await page.evaluate(() => document.documentElement.lang),language); };
  const loginRequests = () => requests.filter(request => request.path === '/api/technician-auth/login');
  async function labels(state, literal) {
    const nodes = await page.evaluate(() => {
      window.qaLoginNodes = [...document.querySelectorAll('#loginBox,#loginBox *,#sessionBox,#sessionBox *')];
      window.qaLoginTextNodes = qaLoginNodes.flatMap(node => [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE));
      return { pin: document.getElementById('pin').value,disabled: document.querySelector('#loginBox button').disabled,focus: document.activeElement.id,selection: [document.getElementById('pin').selectionStart,document.getElementById('pin').selectionEnd] };
    });
    for (const width of [320,390,1440]) {
      await page.setViewportSize({ width,height: 900 });
      for (const [index,language] of languages.entries()) {
        await locale(language);
        assert.equal(await page.title(),words.title[index]);
        assert.equal(await page.locator('#loginBox h3').textContent(),words.heading[index]);
        assert.equal(await page.locator('#pin').getAttribute('placeholder'),words.pin[index]);
        assert.equal(await page.locator('#pin').getAttribute('aria-label'),words.pin[index]);
        assert.equal(await page.locator('#loginBox button').textContent(),words[state === 'pending' ? 'pending' : 'enter'][index]);
        assert.equal(await page.locator('#sessionBox button').textContent(),words.leave[index]);
        if (state !== 'initial' && state !== 'pending') assert.equal(await page.locator('#loginError').textContent(),literal ?? words[state][index]);
        assert.deepEqual(await page.evaluate(() => ({ pin: document.getElementById('pin').value,disabled: document.querySelector('#loginBox button').disabled,focus: document.activeElement.id,selection: [document.getElementById('pin').selectionStart,document.getElementById('pin').selectionEnd] })),nodes);
        assert(await page.evaluate(() => qaLoginNodes.every(node => node.isConnected) && qaLoginTextNodes.every(node => node.isConnected)));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.getElementById('pin').getBoundingClientRect().right <= innerWidth));
        await preserve(); checks++;
        if (process.env.CW_LOGIN_CAPTURE && width === 320 && ['initial','connection','literal'].includes(state)) {
          await fs.mkdir(process.env.CW_LOGIN_CAPTURE,{ recursive: true }); await page.screenshot({ path: path.join(process.env.CW_LOGIN_CAPTURE,state + '-' + language + '-320.png') });
        }
      }
    }
    console.log('PASS technician login labels ' + JSON.stringify({ state,widths: [320,390,1440],languages: 5,pinAndNodesPreserved: true,pendingRequests: 2 }));
  }
  await page.locator('#pin').fill(' typed PIN {name} '); await page.locator('#pin').focus(); await page.evaluate(() => document.getElementById('pin').setSelectionRange(2,7));
  await labels('initial');
  await page.locator('#pin').fill('   '); await page.evaluate(() => login()); await labels('required'); assert.equal(loginRequests().length,0);

  let held, arrived;
  const hold = route => { held = route; arrived?.(route); arrived = null; };
  const begin = async () => {
    const arrival = new Promise(resolve => { arrived = resolve; });
    await page.evaluate(() => { void login(); });
    await page.waitForFunction(() => document.querySelector('#loginBox button').disabled);
    return arrival;
  };
  await page.route('**/api/technician-auth/login',hold);
  const enterArrival = new Promise(resolve => { arrived = resolve; });
  await page.locator('#pin').fill('  wrong literal {name}  '); await page.locator('#pin').press('Enter'); await enterArrival;
  await page.waitForFunction(() => document.querySelector('#loginBox button').disabled);
  await page.evaluate(() => { login(); login(); }); await page.locator('#pin').press('Enter');
  await labels('pending'); assert.equal(loginRequests().length,1); assert.deepEqual(JSON.parse(loginRequests()[0].body),{ pin: 'wrong literal {name}' });
  // The real endpoint error remains literal, including if its words match a UI label.
  const nativeInvalid = await fetch(base + '/api/technician-auth/login',{ method: 'POST',headers: { 'Content-Type': 'application/json' },body: JSON.stringify({ pin: 'wrong literal {name}' }) });
  const invalidJson = await nativeInvalid.json(); assert.equal(nativeInvalid.status,401); assert.equal(invalidJson.message,'Credenciais inválidas');
  await held.fulfill({ status: nativeInvalid.status,json: invalidJson }); await page.waitForFunction(() => !document.querySelector('#loginBox button').disabled); await labels('literal',invalidJson.message);
  await begin(); await held.fulfill({ status: 401,json: { ok: false,message: 'Entrar <b>{name}</b> ' + 'x'.repeat(120) } }); await page.waitForFunction(() => !document.querySelector('#loginBox button').disabled);
  const literal = 'Entrar <b>{name}</b> ' + 'x'.repeat(120); await labels('literal',literal); assert.equal(await page.locator('#loginError b').count(),0);
  await begin(); await held.fulfill({ status: 401,json: { ok: false } }); await page.waitForFunction(() => !document.querySelector('#loginBox button').disabled); await labels('invalid');
  await begin(); await held.abort('failed'); await page.waitForFunction(() => !document.querySelector('#loginBox button').disabled); await labels('connection');
  await begin(); await held.fulfill({ status: 200,json: { ok: true,token: 'unaccepted-test-token',user: { id: tech.id,role: 'ADMIN' } } }); await page.waitForFunction(() => !document.querySelector('#loginBox button').disabled); await preserve();

  await page.unroute('**/api/technician-auth/login',hold);
  // Capture the real visible welcome before navigation; evaluating a page from
  // its paused navigation route would block its own document transition.
  const rememberWelcome = () => window.addEventListener('beforeunload',() => {
    if (document.getElementById('loginBox')?.style.display !== 'none') return;
    sessionStorage.setItem('qaLoginSuccessSnapshot',JSON.stringify({ language: document.documentElement.lang,welcome: document.getElementById('welcome').textContent,markup: document.getElementById('welcome').innerHTML,loginHidden: document.getElementById('loginBox').style.display,sessionShown: document.getElementById('sessionBox').style.display }));
  });
  await page.addInitScript(rememberWelcome); await page.evaluate(rememberWelcome);
  await page.route('**/technician-field-mode',route => route.fulfill({ contentType: 'text/html',body: '<!doctype html><title>Field destination</title><body>Field destination</body>' }));
  for (const person of [{ tech,pin: secretPin },{ tech: leader,pin: leaderPin }]) {
    if (new URL(page.url()).pathname !== '/technician-login') { await page.goto(base + '/technician-login'); await page.locator('#cwLanguageSelect').waitFor(); }
    await page.locator('#pin').fill(' ' + person.pin + ' '); await page.locator('#pin').press('Enter'); await page.waitForURL(base + '/technician-field-mode');
    const welcomeSnapshot = await page.evaluate(() => JSON.parse(sessionStorage.getItem('qaLoginSuccessSnapshot')));
    assert.equal(welcomeSnapshot.welcome,words.welcome[languages.indexOf(welcomeSnapshot.language)] + person.tech.name); assert(!welcomeSnapshot.markup.includes('<b>')); assert.equal(welcomeSnapshot.loginHidden,'none'); assert.equal(welcomeSnapshot.sessionShown,'block');
    const session = await page.evaluate(() => ({ tokens: ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key)),users: ['user','cristalwater_user'].map(key => JSON.parse(localStorage.getItem(key))) }));
    assert(session.tokens.every(token => token === session.tokens[0]));
    const claims = jwt.verify(session.tokens[0],getJwtSecret()); assert.equal(claims.id,person.tech.id); assert.equal(claims.role,person.tech.role); assert.equal(session.users[0].id,person.tech.id); assert.deepEqual(session.users[0],session.users[1]);
    await preserve(false); console.log('PASS native technician PIN login ' + JSON.stringify({ role: person.tech.role,exactTrimmedPin: JSON.parse(loginRequests().at(-1).body).pin === person.pin,literalName: true,redirect: '/technician-field-mode',pendingRequests: 2 }));
  }
  await page.goto(base + '/technician-login'); await page.locator('#cwLanguageSelect').waitFor(); await page.evaluate(() => logout()); await page.waitForFunction(() => !localStorage.getItem('cristalwater_jwt')); await page.waitForURL(base + '/technician-login');
  await preserve(false); assert.deepEqual(await page.evaluate(() => ['token','cristalwater_jwt','adminToken','user','cristalwater_user'].map(key => localStorage.getItem(key))),Array(5).fill(null));
  let connectionControls = 0;
  const renewedToken = jwt.sign({ id: tech.id,technicianId: tech.id,role: 'TECHNICIAN',principalType: 'TECHNICIAN',techAuthVersion: tech.authVersion },getJwtSecret(),{ expiresIn: '1h',jwtid: randomUUID() });
  async function connectionControl(name,{ captured = null,current = captured,readFailure = false,cancelled = false,retained = false } = {}) {
    if (captured) await page.evaluate(({ token,user }) => CristalAuth.persistSession(token,user),{ token: captured,user });
    else await page.evaluate(() => CristalAuth.clearSession());
    const beforeTimer = await page.evaluate(() => document.getElementById('cw-v21-toast')?._t);
    await page.evaluate(() => { window.qaConnectionDone = false; window.qaConnectionRelease = null; void fetch('/api/qa-connection-toast').catch(error => { window.qaConnectionReadFailure = false; window.qaConnectionSameError = error === qaConnectionOriginalError; window.qaConnectionDone = true; }); });
    await page.waitForFunction(() => typeof qaConnectionRelease === 'function');
    assert.equal(await page.evaluate(() => qaConnectionAuthorization),captured ? 'Bearer ' + captured : null);
    if (current !== captured) {
      if (current) await page.evaluate(({ token,user }) => CristalAuth.persistSession(token,user),{ token: current,user });
      else await page.evaluate(() => CristalAuth.clearSession());
    }
    await page.evaluate(({ readFailure,cancelled }) => { qaConnectionReadFailure = readFailure; qaConnectionRelease(cancelled ? 'abort' : 'network'); },{ readFailure,cancelled });
    await page.waitForFunction(() => qaConnectionDone); assert.equal(await page.evaluate(() => qaConnectionSameError),true,'The caller receives the identical original Error even if credential reads fail');
    if (cancelled) assert.equal(await page.evaluate(() => document.getElementById('cw-v21-toast')?._t),beforeTimer,'Cancellation must not create or restart a connection notice');
    else { const language = await page.evaluate(() => document.documentElement.lang); assert.equal(await page.locator('#cw-v21-toast').textContent(),words[retained ? 'connectionRetained' : 'connectionNoSession'][languages.indexOf(language)]); }
    assert.equal(await page.evaluate(() => localStorage.getItem('cristalwater_jwt')),current); await preserve(false);
    assert.equal(new URL(page.url()).pathname,'/technician-login'); connectionControls++; console.log('PASS connection toast boundary ' + JSON.stringify({ name,retained,cancelled,originalErrorPreserved: true,pendingRequests: 2 }));
  }
  await connectionControl('anonymous');
  await connectionControl('same authenticated session',{ captured: oldToken,retained: true });
  await connectionControl('renewed while request pending',{ captured: oldToken,current: renewedToken });
  await connectionControl('logged out while request pending',{ captured: oldToken,current: null });
  await connectionControl('credential read failure',{ captured: oldToken,readFailure: true });
  await connectionControl('cancelled anonymous read',{ cancelled: true });
  assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => ['/api/technician-auth/login','/api/settings/language/me'].includes(request.path)));
  assert.deepEqual(errors,[]); assert(!logs.some(log => log.includes(secretPin) || log.includes(oldToken)));
  await context.close();

  const offlineContext = await browser.newContext({ viewport: { width: 320,height: 900 },timezoneId: 'Europe/Lisbon' });
  const offlinePage = await offlineContext.newPage(); offlinePage.setDefaultTimeout(15000);
  const offlineErrors = []; offlinePage.on('pageerror', error => offlineErrors.push(error.message));
  await offlinePage.goto(base + '/technician-login'); await offlinePage.locator('#cwLanguageSelect').waitFor();
  await offlinePage.evaluate(() => navigator.serviceWorker.ready);
  await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await offlinePage.waitForFunction(async () => { const cache = await caches.open('cristalwater-field-20261003-v332'); return Boolean(await cache.match('/technician-login.js')) && Boolean(await cache.match('/cw-i18n.js')); });
  const source = await fs.readFile(path.join(__dirname,'../frontend/technician-login.js'),'utf8');
  assert.equal(await offlinePage.evaluate(async () => (await (await caches.open('cristalwater-field-20261003-v332')).match('/technician-login.js')).text()),source);
  const authSource = await fs.readFile(path.join(__dirname,'../frontend/cw-auth.js'),'utf8');
  assert.equal(await offlinePage.evaluate(async () => (await (await caches.open('cristalwater-field-20261003-v332')).match('/cw-auth.js')).text()),authSource);
  await offlinePage.evaluate(work => { for (const [key,value] of Object.entries(work)) localStorage.setItem(key,value); localStorage.setItem('cw_language','de'); localStorage.setItem('cw_client_lang','de'); },work);
  await offlineContext.setOffline(true); await offlinePage.goto(base + '/technician-login?offline-shell=1'); await offlinePage.locator('#cwLanguageSelect').waitFor();
  assert.equal(await offlinePage.locator('#loginBox h3').textContent(),words.heading[4]); await offlinePage.locator('#pin').fill('offline PIN unchanged'); await offlinePage.locator('#pin').press('Enter');
  await offlinePage.waitForFunction(() => !document.querySelector('#loginBox button').disabled && document.getElementById('loginError').textContent.length > 0);
  for (const [index,language] of languages.entries()) {
    await offlinePage.locator('#cwLanguageSelect').selectOption(language); await offlinePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await offlinePage.locator('#loginError').textContent(),words.connection[index]); assert.equal(await offlinePage.locator('#pin').inputValue(),'offline PIN unchanged');
    assert.equal(await offlinePage.locator('#cw-v21-toast').textContent(),words.connectionNoSession[index]);
    assert.equal(await offlinePage.evaluate(() => localStorage.getItem('cristalwater_jwt')),null); assert.deepEqual(await offlinePage.evaluate(keys => Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)])),Object.keys(work)),work);
    assert(await offlinePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks++;
  }
  if (process.env.CW_LOGIN_CAPTURE) await offlinePage.screenshot({ path: path.join(process.env.CW_LOGIN_CAPTURE,'cached-offline-de-320.png') });
  assert.deepEqual(offlineErrors,[]); await offlineContext.close();
  console.log('PASS technician login language result ' + JSON.stringify({ checks,connectionControls,languages: 5,widths: [320,390,1440],nativeRoles: ['TECHNICIAN','TEAM_LEADER'],enterSerialized: true,serverMessagesLiteral: true,typedPendingRequests: 2,actualCachedShellOffline: true,noOperationalWrites: true })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
