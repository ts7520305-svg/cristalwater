'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const waitBrowserState = require('./fixtures/wait-browser-state');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'], words = {"title": ["Cristal Water - Perfil Tecnico", "Cristal Water - Technician Profile", "Cristal Water - Profil du technicien", "Cristal Water - Perfil del técnico", "Cristal Water - Technikerprofil"], "technician": ["Tecnico", "Technician", "Technicien", "Técnico", "Techniker"], "heading": ["Perfil", "Profile", "Profil", "Perfil", "Profil"], "intro": ["Dados operacionais da sessao atual, sem exposicao de contactos proibidos.", "Operational data for the current session, without exposing restricted contact details.", "Données opérationnelles de la session actuelle, sans divulguer les coordonnées à accès restreint.", "Datos operativos de la sesión actual, sin exponer datos de contacto restringidos.", "Operative Daten der aktuellen Sitzung; geschützte Kontaktdaten werden nicht angezeigt."], "preparing": ["A preparar perfil.", "Preparing profile.", "Préparation du profil.", "Preparando el perfil.", "Profil wird vorbereitet."], "loaded": ["Perfil carregado em modo leitura.", "Profile loaded in read-only mode.", "Profil chargé en lecture seule.", "Perfil cargado en modo de lectura.", "Profil im Lesemodus geladen."], "name": ["Nome", "Name", "Nom", "Nombre", "Name"], "role": ["Perfil", "Role", "Profil", "Perfil", "Rolle"], "id": ["ID tecnico", "Technician ID", "ID du technicien", "ID del técnico", "Techniker-ID"], "session": ["Sessao", "Session", "Session", "Sesión", "Sitzung"], "zone": ["Zona", "Zone", "Zone", "Zona", "Zone"], "phone": ["Telefone", "Phone", "Téléphone", "Teléfono", "Telefon"], "nameMissing": ["Tecnico", "Technician", "Technicien", "Técnico", "Techniker"], "active": ["Ativa", "Active", "Active", "Activa", "Aktiv"], "zoneMissing": ["Nao definida", "Not defined", "Non définie", "No definida", "Nicht festgelegt"], "phoneAvailable": ["Disponivel no sistema", "Available in the system", "Disponible dans le système", "Disponible en el sistema", "Im System verfügbar"], "phoneMissing": ["Nao definido", "Not defined", "Non défini", "No definido", "Nicht festgelegt"]};
const fieldIds = ['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
let browser, completed = false, checks = 0, scenarios = 0;
const deadline = setTimeout(() => { console.error('Profile language scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
async function switchProfile(page, token, user) {
  return page.evaluate(({token,user}) => {
    const keys=['token','cristalwater_jwt','adminToken','user','cristalwater_user'],saved=keys.map(key=>localStorage.getItem(key));
    for(const key of keys.slice(0,3))localStorage.setItem(key,token);
    for(const key of keys.slice(3))localStorage.setItem(key,JSON.stringify(user));
    dispatchEvent(new CustomEvent('cw:session-change'));
    const changed=document.getElementById('profileGrid').childElementCount;
    keys.forEach((key,i)=>saved[i]===null?localStorage.removeItem(key):localStorage.setItem(key,saved[i]));
    dispatchEvent(new CustomEvent('cw:session-change'));
    return {changed,returned:document.getElementById('profileGrid').childElementCount};
  },{token,user});
}
(async () => {
  const now = Date.now(), parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const day = ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-'), scheduledAt = new Date(day + 'T12:00:00.000Z');
  const vehicle = await prisma.vehicle.create({ data: { plate: 'PROFILE-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Profile owner <b>{day}</b>', email: 'profile-tech-'+now+'@qa.test', vehicleId: vehicle.id, active: true } });
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

  // Reproduce issuance after fixture preparation with the real JWT issuer.
  const tokenIssueDelay = Number(process.env.CW_PROFILE_TOKEN_ISSUE_DELAY_MS || 0);
  assert(Number.isInteger(tokenIssueDelay) && tokenIssueDelay >= 0 && tokenIssueDelay <= 2000, 'QA token issue delay must be between 0 and 2000ms');
  if (tokenIssueDelay) await new Promise(resolve => setTimeout(resolve, tokenIssueDelay));
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const tokenExpiresAt = jwt.decode(token).exp * 1000;
  assert(Number.isSafeInteger(tokenExpiresAt));
  const source = { id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', name: 'Session source <b>{name}</b> & <img src=x>', zone: 'ZONE-' + 'x'.repeat(95), phone: '+351 999 123 456', privateNote: 'Unexposed <b>{phone}</b>' };
  const leader = await prisma.technician.create({ data: { name: 'Actual profile team leader', email: 'profile-leader-'+now+'@qa.test', role: 'TEAM_LEADER', active: true } });
  const associatedUsers=await Promise.all([tech,leader].map(person=>prisma.user.create({data:{email:person.email,name:person.name,role:person.role,password:'unused',active:true}})));
  const leaderToken = jwt.sign({ id: leader.id, role: 'TEAM_LEADER' }, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const database = () => Promise.all([
    prisma.serviceVisit.findUnique({ where: { id } }), prisma.extraVisit.findUnique({ where: { id } }),
    prisma.workGuide.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } }),
    prisma.transportGuide.findUnique({ where: { id: guide.id } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count(),
    prisma.technicalHistory.findMany({ where: { poolId: { in: pools.map(pool => pool.id) } }, orderBy: { id: 'asc' } }),
    prisma.notification.findMany({ orderBy: { id: 'asc' } }),
    prisma.technician.findMany({ where: { id: { in: [tech.id, leader.id] } }, orderBy: { id: 'asc' } }),
    prisma.user.findMany({where:{id:{in:associatedUsers.map(user=>user.id)}},orderBy:{id:'asc'}})
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
  const openProfile = async user => {
    if (user) await page.evaluate(user => { for (const key of ['user','cristalwater_user']) localStorage.setItem(key,JSON.stringify(user)); },user);
    await page.goto(base + '/technician-profile', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.CristalI18n && document.querySelectorAll('#profileGrid .field').length === 6);
    await locale('pt'); assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).visibility),'visible');
  };
  const state = () => page.evaluate(async () => {
    const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value || '')))].map(byte => byte.toString(16).padStart(2,'0')).join('');
    const users = ['user','cristalwater_user'].map(key => { const user = JSON.parse(localStorage.getItem(key)); delete user.language; return user; });
    const storage = Object.fromEntries(Object.keys(localStorage).filter(key => !['token','cristalwater_jwt','adminToken','user','cristalwater_user','cw_client_lang'].includes(key) && !/^cw_language(?:$|:)/.test(key)).sort().map(key => [key,localStorage.getItem(key)]));
    return { users, storage, tokens: await Promise.all(['token','cristalwater_jwt','adminToken'].map(key => digest(localStorage.getItem(key)))),
      session: Object.fromEntries(Object.keys(sessionStorage).sort().map(key => [key,sessionStorage.getItem(key)])),
      calls: qaProfileCalls, tone: document.getElementById('statusBox').getAttribute('data-tone'),
      links: [...document.querySelectorAll('.ds-bottom-nav a')].map(node => [node.getAttribute('href'),node.getAttribute('class'),node.onclick]),
      inputs: [...document.querySelectorAll('input,textarea,select:not(#cwLanguageSelect),button')].map(node => [node.id,node.value,node.checked,node.disabled,node.hidden,node.readOnly]) };
  });
  const rowKeys = ['name','role','id','session','zone','phone'];
  const expectedValues = (user,index) => [user.name || words.nameMissing[index], String(user.role || '').toUpperCase() || 'TECHNICIAN',String(user.technicianId || user.id || '-'),words.active[index],user.zone || words.zoneMissing[index],user.phone ? words.phoneAvailable[index] : words.phoneMissing[index]];
  async function matrix({ name,user = source,widths = [320,390,1440],foreign = false,status = 'loaded',rawStatus = '',empty = false,pendingCount = 2 }) {
    await locale('pt'); await page.locator('#cwLanguageSelect').focus();
    await page.evaluate(() => {
      window.qaProfileCalls = {};
      if (!window.qaProfileTracking) {
        qaProfileTracking = true;
        for (const name of ['loadProfile','renderProfile','userData','setStatus']) { const original = window[name]; window[name] = (...args) => { qaProfileCalls[name] = (qaProfileCalls[name] || 0) + 1; return original(...args); }; }
        const original = CristalAuth.requireAuth; CristalAuth.requireAuth = (...args) => { qaProfileCalls.auth = (qaProfileCalls.auth || 0) + 1; return original(...args); };
      }
      window.qaProfileNodes = [...document.querySelectorAll('main,main *,title')];
      window.qaProfileTextNodes = qaProfileNodes.flatMap(node => [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE));
      window.qaProfileFocus = document.activeElement;
      window.qaProfileLinks = [...document.querySelectorAll('.ds-bottom-nav a')]; window.qaProfileHandlers = qaProfileLinks.map(node => node.onclick);
    });
    const before = await state(),stored = await raw(),records = await pending(),db = await database(),first = requests.length;
    assert.equal(records.length,pendingCount); assert(records.every(row => !row.response));
    for (const width of widths) { await page.setViewportSize({ width,height: 1400 }); for (const [index,language] of languages.entries()) {
      await locale(language);
      assert.equal(await page.title(),words.title[foreign ? 0 : index]);
      for (const key of ['technician','heading','intro']) assert.equal(await page.locator('[data-cw-profile-copy=' + key + ']').textContent(),words[key][foreign ? 0 : index]);
      assert.equal(await page.locator('#statusBox').textContent(),rawStatus || words[status][foreign ? 0 : index]);
      const rows = await page.locator('#profileGrid .field').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').textContent,node.querySelector('b').textContent]));
      if (empty) assert.deepEqual(rows,[]); else assert.deepEqual(rows,rowKeys.map((key,pos) => [words[key][foreign ? 0 : index],expectedValues(user,foreign ? 0 : index)[pos]]));
      assert.deepEqual(await state(),before); assert.deepEqual(await raw(),stored); assert.deepEqual(await pending(),records); assert.deepEqual(await database(),db);
      assert(await page.evaluate(() => qaProfileNodes.every(node => node.isConnected) && qaProfileTextNodes.every(node => node.isConnected) && document.activeElement === qaProfileFocus && qaProfileLinks.every((node,index) => node.onclick === qaProfileHandlers[index])));
      assert.equal(await page.locator('#profileGrid b b,#profileGrid img,#profileGrid script').count(),0);
      assert(!(await page.locator('main').textContent()).includes(source.phone)); assert(!(await page.locator('main').textContent()).includes(source.privateNote));
      assert.equal(await page.locator('main input,main textarea,main button,main a[href^="tel:"]').count(),0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),'Profile must fit the viewport');
      assert(await page.locator('#profileGrid').evaluate(node => node.scrollWidth <= node.clientWidth + 1),'Profile fields must fit');
      for (const selector of ['main .card','#statusBox','#profileGrid .field']) assert(await page.locator(selector).evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1)),selector);
      checks++;
      if (process.env.CW_PROFILE_CAPTURE && width === 320 && language === 'de' && !foreign) { await fs.mkdir(process.env.CW_PROFILE_CAPTURE,{ recursive: true }); await page.locator('main').screenshot({ path: process.env.CW_PROFILE_CAPTURE + '/' + name + '-de-320.png' }); await page.locator('#cwLanguageSelect').focus(); await settle(); }
    }}
    for (const request of requests.slice(first)) { assert.equal(request.path,'/api/settings/language/me'); assert.equal(request.method,'PUT'); assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']); assert.equal(request.auth,'Bearer ' + token); }
    scenarios++; console.log('PASS profile languages ' + JSON.stringify({ name,checks,scenarios,pendingCount,producerCalls: before.calls,unchangedReadOnlyFields: true,literalSources: true,noOperationalWrites: true }));
  }
  await openProfile(source); const profileEntryStorage = await raw(); await matrix({ name: 'real-tech-session-literal-sources' });
  const missing = { id: tech.id,role: 'TECHNICIAN',name: '',zone: '',phone: '' };
  await openProfile(missing); await matrix({ name: 'original-missing-value-fallbacks',user: missing });
  const identical = { ...source,name: 'Tecnico',zone: 'Nao definida',phone: source.phone };
  await openProfile(identical); await matrix({ name: 'real-values-identical-to-portuguese-copy',user: identical,widths: [320] });
  await locale('pt');
  await page.evaluate(() => { for (const node of [...document.querySelectorAll('[data-cw-profile-copy]'),...document.querySelectorAll('#profileGrid span,#profileGrid b')]) node.replaceChildren(document.createTextNode(node.textContent)); });
  await matrix({ name: 'foreign-identical-leaves-lose-ownership',user: identical,widths: [320],foreign: true });
  await openProfile(source); await page.evaluate(() => setStatus('Perfil carregado em modo leitura.','error')); await matrix({ name: 'generic-status-identical-to-own-copy',rawStatus: words.loaded[0],widths: [320] });
  // Exercise the original read parser after a valid session guard; this is not a malformed-user page entry bypass.
  await page.evaluate(() => { const saved = ['user','cristalwater_user'].map(key => localStorage.getItem(key)); localStorage.setItem('cristalwater_user','{broken'); const parsed = userData(); for (const [index,key] of ['user','cristalwater_user'].entries()) localStorage.setItem(key,saved[index]); renderProfile(parsed); });
  await matrix({ name: 'original-malformed-parser-empty-fallbacks',user: {},rawStatus: words.loaded[0],widths: [320] });
  await openProfile(source); await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const profileBefore=await page.locator('#profileGrid').innerHTML(),profileRequests=requests.length,profileDb=await database(),profileRaw=await raw();
  await page.evaluate(()=>dispatchEvent(new CustomEvent('cw:session-change')));assert.equal(await page.locator('#profileGrid').innerHTML(),profileBefore);assert.equal(requests.length,profileRequests);
  const privacy=await switchProfile(page,leaderToken,{id:leader.id,role:leader.role});
  assert.deepEqual(privacy,{changed:0,returned:0},'Private profile fields must clear in the session event and remain closed after rapid return');
  await page.evaluate(()=>{loadProfile();renderProfile(userData());});assert.equal(await page.locator('#profileGrid').innerHTML(),'');assert.equal(requests.length,profileRequests);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1400});for(const language of languages){await locale(language);assert.equal(await page.locator('#statusBox').textContent(),await page.evaluate(language=>CWFieldWriteStore.message('sessionPreserved',language),language));assert.equal(await page.locator('#profileGrid').innerHTML(),'');assert(await page.locator('#statusBox').evaluate(node=>node.scrollWidth<=node.clientWidth+1));}}
  assert.deepEqual(await raw(),profileRaw);assert.deepEqual(await pending(),originalPending);assert.deepEqual(await database(),profileDb);
  await openProfile(source);assert.equal(await page.locator('#profileGrid .field').count(),6);
  const cacheVersion=(await fs.readFile('frontend/sw.js','utf8')).match(/const CACHE = '([^']+)'/)[1];
  await waitBrowserState(page,async expected=>{const cache=await caches.open(expected.version);for(const [url,source]of expected.files){const response=await cache.match(url);if(!response||await response.text()!==source)return false;}return true;},{version:cacheVersion,files:await Promise.all([['/technician-profile','frontend/technician-profile.html'],['/technician-profile.js','frontend/technician-profile.js'],['/cw-field-write-store.js','frontend/cw-field-write-store.js']].map(async([url,file])=>[url,await fs.readFile(file,'utf8')]))});
  const beforeOffline = await raw(),dbOffline = await database();
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.CristalI18n && document.querySelectorAll('#profileGrid .field').length === 6); await matrix({ name: 'actual-cached-profile-offline' });
  assert.deepEqual(await switchProfile(page,leaderToken,{id:leader.id,role:leader.role}),{changed:0,returned:0});assert.equal(await page.locator('#statusBox').textContent(),await page.evaluate(()=>CWFieldWriteStore.message('sessionPreserved')));
  await page.evaluate(()=>{loadProfile();renderProfile(userData());});assert.equal(await page.locator('#profileGrid').innerHTML(),'');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.CristalI18n&&document.querySelectorAll('#profileGrid .field').length===6);assert.equal(await page.locator('#profileGrid .field b').first().textContent(),source.name);
  assert.deepEqual(await raw(),beforeOffline); assert.deepEqual(await pending(),originalPending); assert.deepEqual(await database(),dbOffline);
  for (const type of ['REGULAR','EXTRA']) { await openField(type); assert.deepEqual(await page.evaluate(ids => ids.map(id => { const node = document.getElementById(id); return [id,node.value,node.checked]; }),fieldIds),visitFields[type]); assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt),null); }
  assert.deepEqual(await pending(),originalPending);
  const draftKey = 'cwFieldVisitDrafts:v2:TECH:' + tech.id; assert.equal((await raw())[draftKey],profileEntryStorage[draftKey]);
  await page.goto(base+'/technician-profile',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('#profileGrid .field').length===6);
  const beforeExpiryProfile=await page.locator('#profileGrid').innerHTML(),beforeExpiryReads=requests.length,beforeExpiryRaw=await raw(),beforeExpiryPending=await pending(),beforeExpiryDatabase=await database();
  await page.evaluate(()=>{window.qaProfileExpiryNodes=[...document.querySelectorAll('#profileGrid,#profileGrid *')];});
  await page.clock.setFixedTime(tokenExpiresAt-1);await page.evaluate(()=>dispatchEvent(new Event('focus')));
  assert.equal(await page.locator('#profileGrid').innerHTML(),beforeExpiryProfile);assert.equal(requests.length,beforeExpiryReads);
  assert(await page.evaluate(()=>qaProfileExpiryNodes.every(node=>node.isConnected)));await page.evaluate(()=>delete window.qaProfileExpiryNodes);
  assert.deepEqual(await raw(),beforeExpiryRaw);assert.deepEqual(await pending(),beforeExpiryPending);assert.deepEqual(await database(),beforeExpiryDatabase);
  await page.clock.setFixedTime(tokenExpiresAt+1);
  assert(await page.evaluate(()=>{dispatchEvent(new Event('focus'));return document.getElementById('profileGrid').childElementCount===0;}));assert.deepEqual(await pending(),originalPending);assert.deepEqual(await database(),dbOffline);
  assert.equal(requests.length,beforeExpiryReads);
  console.log('PASS profile expiry clock '+JSON.stringify({tokenIssueDelay,legacyClockBeforeActualExpiryMs:tokenExpiresAt-(now+3600001),actualJwtBoundaryMinusAndPlus1ms:true,validProfileNodesRetained:true,noRefetch:true,originalExpiredAssertionRetained:true}));
  assert.deepEqual(errors,[]); assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));
  await context.close();
  // A separate context with no registered worker selects the QA source before the final producer call.
  // The original synchronous auth guard runs; this is initial-copy inspection, not offline acceptance.
  const productSource = await fs.readFile('frontend/technician-profile.js','utf8'); assert(/loadProfile\(\);\s*$/.test(productSource));
  const initialContext = await makeContext(token,source), initialPage = await initialContext.newPage(), initialErrors = [],initialRequests = [];
  initialPage.on('pageerror',error => initialErrors.push(error.message));
  initialPage.on('request',request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) initialRequests.push({ path,method: request.method(),body: request.postData(),auth: request.headers().authorization }); });
  await initialContext.route('**/technician-profile.js',route => route.fulfill({ contentType: 'application/javascript',body: productSource.replace(/loadProfile\(\);\s*$/,'') }),{ times: 1 });
  await initialPage.goto(base + '/technician-profile',{ waitUntil: 'networkidle' }); await initialPage.waitForFunction(() => window.CristalI18n);
  assert.equal(await initialPage.locator('#profileGrid .field').count(),0); assert.equal(await initialPage.evaluate(() => getComputedStyle(document.documentElement).visibility),'visible');
  await initialPage.evaluate(() => { window.qaInitialNodes = [...document.querySelectorAll('main,main *,title')];window.qaInitialCalls = {};for (const name of ['loadProfile','renderProfile','userData','setStatus']) { const original = window[name];window[name] = (...args) => { qaInitialCalls[name] = (qaInitialCalls[name] || 0) + 1;return original(...args); }; } });
  const initialTokens = await initialPage.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),initialDb = await database(),initialFirst = initialRequests.length;
  for (const width of [320,390,1440]) { await initialPage.setViewportSize({ width,height: 1400 });for (const [index,language] of languages.entries()) {
    await initialPage.locator('#cwLanguageSelect').selectOption(language);await initialPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const key of ['title','technician','heading','intro','preparing']) assert.equal(await initialPage.locator('[data-cw-profile-copy=' + key + ']').textContent(),words[key][index]);
    assert.equal(await initialPage.locator('#profileGrid .field').count(),0);assert(await initialPage.evaluate(() => qaInitialNodes.every(node => node.isConnected) && Object.keys(qaInitialCalls).length === 0 && document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(await initialPage.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),initialTokens);assert.deepEqual(await database(),initialDb);checks++;
    if (process.env.CW_PROFILE_CAPTURE && width === 320 && language === 'de') await initialPage.locator('main').screenshot({ path: process.env.CW_PROFILE_CAPTURE + '/initial-html-preparing-de-320.png' });
  }}
  scenarios++;console.log('PASS profile languages ' + JSON.stringify({ name: 'initial-html-original-producer-held',checks,scenarios,pendingCount: 0,sourceSelectionInSeparateContext: true,noOperationalWrites: true }));
  await initialPage.evaluate(() => loadProfile());assert.deepEqual(await initialPage.evaluate(() => qaInitialCalls),{ loadProfile: 1,userData: 1,renderProfile: 1,setStatus: 1 });
  const initialProducerCalls = await initialPage.evaluate(() => qaInitialCalls);
  await initialPage.setViewportSize({ width: 320,height: 1400 });
  for (const [index,language] of languages.entries()) {
    await initialPage.locator('#cwLanguageSelect').selectOption(language);await initialPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await initialPage.locator('#statusBox').textContent(),words.loaded[index]);assert.deepEqual(await initialPage.locator('#profileGrid .field').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').textContent,node.querySelector('b').textContent])),rowKeys.map((key,pos) => [words[key][index],expectedValues(source,index)[pos]]));
    assert.deepEqual(await initialPage.evaluate(() => qaInitialCalls),initialProducerCalls);assert.deepEqual(await database(),initialDb);checks++;
    if (process.env.CW_PROFILE_CAPTURE && language === 'de') await initialPage.locator('main').screenshot({ path: process.env.CW_PROFILE_CAPTURE + '/initial-producer-resumed-de-320.png' });
  }
  for (const request of initialRequests.slice(initialFirst)) { assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);assert.equal(request.auth,'Bearer ' + token); }
  assert.deepEqual(initialErrors,[]);scenarios++;await initialContext.close();
  // TEAM_LEADER uses its own actual credential and the unchanged TECHNICIAN requireAuth grant.
  const leaderSource = { id: leader.id,technicianId: leader.id,name: leader.name,role: 'TEAM_LEADER',zone: 'Leader zone <b>{zone}</b>',phone: 'Restricted leader contact' };
  const leaderContext = await makeContext(leaderToken,leaderSource), leaderPage = await leaderContext.newPage(), leaderErrors = [];
  leaderPage.on('pageerror',error => leaderErrors.push(error.message));
  await leaderPage.goto(base + '/technician-profile',{ waitUntil: 'networkidle' }); await leaderPage.waitForFunction(() => window.CristalI18n && document.querySelectorAll('#profileGrid .field').length === 6);
  const leaderStorage = await leaderPage.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),leaderDb = await database();
  await leaderPage.evaluate(() => { window.qaLeaderNodes = [...document.querySelectorAll('main,main *,title')]; window.qaLeaderCalls = 0; for (const name of ['loadProfile','renderProfile','userData']) { const original = window[name]; window[name] = (...args) => { qaLeaderCalls++; return original(...args); }; } });
  for (const width of [320,390,1440]) { await leaderPage.setViewportSize({ width,height: 1400 }); for (const [index,language] of languages.entries()) {
    await leaderPage.locator('#cwLanguageSelect').selectOption(language); await leaderPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await leaderPage.locator('#profileGrid .field').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').textContent,node.querySelector('b').textContent])),rowKeys.map((key,pos) => [words[key][index],expectedValues(leaderSource,index)[pos]]));
    assert.equal(await leaderPage.locator('#statusBox').textContent(),words.loaded[index]); assert.equal(await leaderPage.evaluate(() => getComputedStyle(document.documentElement).visibility),'visible');
    assert(await leaderPage.evaluate(() => qaLeaderCalls === 0 && qaLeaderNodes.every(node => node.isConnected) && document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(await leaderPage.evaluate(() => ['token','cristalwater_jwt','adminToken'].map(key => localStorage.getItem(key))),leaderStorage); assert.deepEqual(await database(),leaderDb); checks++;
    if (process.env.CW_PROFILE_CAPTURE && width === 320 && language === 'de') await leaderPage.locator('main').screenshot({ path: process.env.CW_PROFILE_CAPTURE + '/actual-team-leader-de-320.png' });
  }}
  assert.deepEqual(leaderErrors,[]); scenarios++; await leaderContext.close();
  const sessionDb=await database();
  for(const [person,user]of [[tech,associatedUsers[0]],[leader,associatedUsers[1]],[leader,null]]){
    const actor=user?{id:user.id,userId:user.id,technicianId:person.id,role:person.role,principalType:'USER',name:person.name}:{id:person.id,role:person.role,name:person.name},credential=jwt.sign(actor,getJwtSecret(),{expiresIn:'1h'}),own=await makeContext(credential,actor),ownPage=await own.newPage(),ownErrors=[],ownRequests=[];
    ownPage.on('pageerror',e=>ownErrors.push(e.message));ownPage.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))ownRequests.push(r.method());});
    await ownPage.goto(base+'/technician-profile',{waitUntil:'networkidle'});assert.equal(await ownPage.locator('#profileGrid .field').count(),6);assert.equal(await ownPage.locator('#profileGrid .field').nth(2).locator('b').textContent(),String(person.id));
    const before=await ownPage.locator('#profileGrid').innerHTML(),first=ownRequests.length;await ownPage.evaluate(()=>dispatchEvent(new CustomEvent('cw:session-change')));assert.equal(await ownPage.locator('#profileGrid').innerHTML(),before);assert.equal(ownRequests.length,first);
    const foreign=person.id===tech.id?leader:tech;assert.deepEqual(await switchProfile(ownPage,person.id===tech.id?leaderToken:token,{id:foreign.id,role:foreign.role}),{changed:0,returned:0});
    await ownPage.evaluate(()=>{loadProfile();renderProfile(userData());});assert.equal(await ownPage.locator('#profileGrid').innerHTML(),'');assert.equal(ownRequests.length,first);assert.equal(await ownPage.locator('#statusBox').textContent(),await ownPage.evaluate(()=>CWFieldWriteStore.message('sessionPreserved')));
    await ownPage.reload({waitUntil:'networkidle'});assert.equal(await ownPage.locator('#profileGrid .field b').first().textContent(),person.name);assert.equal(await ownPage.locator('#profileGrid .field').nth(2).locator('b').textContent(),String(person.id));
    await ownPage.clock.setFixedTime(Date.now()+3600001);assert(await ownPage.evaluate(()=>{dispatchEvent(new Event('focus'));return document.getElementById('profileGrid').childElementCount===0;}));await ownPage.evaluate(()=>{loadProfile();renderProfile(userData());});assert.equal(await ownPage.locator('#profileGrid').innerHTML(),'');assert.deepEqual(ownErrors,[]);assert(ownRequests.every(method=>method==='GET'));await own.close();
    console.log('PASS profile '+person.role+'/'+(user?'USER':'TECHNICIAN')+': native principal, same-account preservation, synchronous rapid-return closure, own reload, expiry and no profile GET');
  }
  assert.deepEqual(await database(),sessionDb);
  console.log('PASS profile language result ' + JSON.stringify({ checks,scenarios,ownedEntries: 18,languages: 5,sessionPrincipals:4,originalProfileSourceFallbacks: true,readOnly: true,contactsNeverExposed: true,techAndTeamLeader: true,typedDraftFields: 13,immutablePending: 2,realCachedProfileOffline: true,exactDeclaredCache:cacheVersion,foreignLeavesLiteral: true,noOperationalWrites: true })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
