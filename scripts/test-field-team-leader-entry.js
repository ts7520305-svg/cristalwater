'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const stamp = Date.now(), email = `leader-${stamp}@qa.test`, password = `QA-${stamp}-password`;
  const vehicle = await prisma.vehicle.create({ data: { plate: 'LEADER-' + stamp, active: true } });
  const leader = await prisma.technician.create({ data: { name: 'QA chefe de equipa', email, pin: String(stamp), role: 'TEAM_LEADER', vehicleId: vehicle.id, active: true } });
  const other = await prisma.technician.create({ data: { name: 'QA outro técnico', pin: String(stamp + 1), active: true } });
  const user = await prisma.user.create({ data: { name: leader.name, email, password: await bcrypt.hash(password, 10), role: 'TEAM_LEADER', active: true } });
  const client = await prisma.client.create({ data: { name: 'QA cliente da equipa', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'QA ronda do chefe', clientId: client.id, active: true } });
  const foreignPool = await prisma.pool.create({ data: { name: 'QA ronda de outro técnico', clientId: client.id, active: true } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: leader.id, plannedDate: new Date(), date: new Date(), status: 'PLANNED' } });
  const foreign = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: foreignPool.id, technicianId: other.id, plannedDate: new Date(), date: new Date(), status: 'PLANNED' } });
  const extra = await prisma.extraVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: leader.id, scheduledAt: new Date(), status: 'PLANNED', billingMode: 'NO_CHARGE', isBillable: false } });
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'LEADER-' + stamp, status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: leader.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(Date.now() + 86400000 * 30) } });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Keep the entry test independent of optional external maps/fonts.
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const goto = async path => { await page.goto(base + path, { waitUntil: 'networkidle' }); };
  const mobileMenu = async () => {
    assert.equal(await page.locator('.cw-v2-shell-sidebar').isVisible(), false, 'Desktop navigation must stay hidden on a phone');
    await page.locator('.cw-v2-shell-topbar [data-cw-open-drawer]').click();
    const menu = page.locator('.cw-v2-drawer.is-open');
    await menu.waitFor({ state: 'visible' });
    return menu;
  };
  const token = () => page.evaluate(() => CristalAuth.getToken());
  const api = (path, credential) => fetch(base + path, { headers: { Authorization: 'Bearer ' + credential } });
  const pinLogin = async pin => {
    await goto('/technician-login');
    await page.locator('#pin').fill(pin);
    await page.locator('#loginBox button').click();
    await page.waitForURL('**/technician-field-mode');
    await page.waitForFunction(() => document.getElementById('fieldLoadError')?.hidden && document.querySelector('#visitList [data-visit-index]'));
  };
  const selectRegular = async () => {
    await page.locator('#poolSegments [data-pool-filter="TODO"]').evaluate(button => button.click());
    await page.locator('#visitList [data-visit-index]').first().evaluate(button => button.click());
    await page.locator('[data-field-tab-button="agora"]').click();
    await page.waitForFunction(() => document.getElementById('fieldSaveStatus')?.dataset.state !== 'saving');
  };
  const saved = () => page.waitForFunction(() => document.getElementById('fieldSaveStatus')?.dataset.state === 'saved');
  const pinKey = 'cwFieldVisitDrafts:v2:TECH:' + leader.id;
  const userKey = `cwFieldVisitDrafts:v2:USER:${user.id}:TECH:${leader.id}`;
  await pinLogin(leader.pin);
  const pinToken = await token();
  assert.equal(jwt.decode(pinToken).role, 'TEAM_LEADER');
  assert.equal(await page.evaluate(() => CWFieldWriteStore.session().owner), 'TECH:' + leader.id);
  await page.waitForFunction(() => document.getElementById('fieldDocsValue')?.textContent === 'Válidos');
  const routeResponse = await api('/api/technician/today?technicianId=' + other.id, pinToken);
  assert.equal(routeResponse.status, 200);
  const route = await routeResponse.json();
  assert.equal(route.technicianId, leader.id);
  assert.deepEqual(route.visits.map(row => row.visitType + ':' + row.id).sort(), ['REGULAR:' + visit.id, 'EXTRA:' + extra.id].sort());
  assert.equal((await api('/api/visits/' + visit.id, pinToken)).status, 200);
  assert.equal((await api('/api/visits/' + foreign.id, pinToken)).status, 403);
  assert.equal((await api('/api/users', pinToken)).status, 403);
  await selectRegular();
  await page.locator('#notes').fill('Rascunho da sessão PIN');
  await saved();
  const pinDraft = await page.evaluate(key => localStorage.getItem(key), pinKey);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await selectRegular();
  assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  assert(!(await page.locator('#visitList').textContent()).includes(foreignPool.name));
  await context.setOffline(false);
  console.log('PASS real TEAM_LEADER PIN login, assigned REGULAR/EXTRA route, forbidden foreign/admin resources and offline draft recovery');

  for (const path of ['/client-payments', '/client-portal']) {
    await goto(path);
    await page.waitForURL('**/technician-field-mode');
    await page.waitForFunction(() => document.getElementById('fieldLoadError')?.hidden && document.querySelector('#visitList [data-visit-index]'));
    assert.equal(await token(), pinToken, 'Wrong portal must keep the valid field session: ' + path);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), pinKey), pinDraft, 'Wrong portal must preserve the exact pending draft: ' + path);
    await selectRegular();
    assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  }
  await goto('/config-notifications');
  await page.waitForURL(base + '/settings');
  await page.waitForFunction(() => document.getElementById('settingsStatus')?.dataset.state === 'unavailable');
  assert.equal(await page.locator('#list select').count(), 0, 'PIN identity must not get User preferences by numeric ID');
  assert.equal(await token(), pinToken); assert.equal(await page.evaluate(key => localStorage.getItem(key), pinKey), pinDraft);
  assert.equal(await page.locator('#settingsNotices').getAttribute('href'), '/technician-chat#noticesTitle');
  console.log('PASS client payment/portal entry returns TEAM_LEADER to field; account settings explains PIN refusal without losing session or draft');

  for (const [path, selector, expected] of [
    ['/technician', '#status', 'Rota atualizada'],
    ['/technician-visit?visit=' + visit.id, '#statusBox', 'Ficha da visita pronta'],
    ['/technician-route', '#statusBox', 'Rota carregada com 2'],
    ['/technician-map', '#infoBox', pool.name],
    ['/technician-guide', '#statusBox', 'Módulo pronto'],
    ['/technician-history', '#statusBox', 'Sem visitas concluidas'],
    ['/technician-profile', '#profileGrid', 'TEAM_LEADER'],
    ['/technician-gps', '#gpsStatus', 'Pronto para iniciar GPS'],
  ]) {
    if (['/technician-guide', '/technician-history', '/technician-profile'].includes(path)) {
      await goto('/technician');
      const menu = await mobileMenu();
      assert.equal(await menu.locator('a[href^="/admin-"]').count(), 0, 'Technical menu must not offer administrative pages');
      assert.equal(await menu.locator('a[href="/settings"]').count(), 0, 'PIN menu must not advertise unavailable User preferences');
      await menu.locator(`a[href="${path}"]`).first().click();
      await page.waitForURL(base + path);
    } else await goto(path);
    await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.textContent.includes(expected), { selector, expected });
    assert.equal(await token(), pinToken, path + ' must keep the authenticated session');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).visibility), 'visible', path);
  }
  console.log('PASS leader entry into modern/legacy field, visit, route, map and GPS; actual menu opens guide/history/profile without logout or administrative shortcuts');

  await (await mobileMenu()).locator('a[href="/help-center"]').click();
  await page.waitForURL(base + '/help-center');
  await page.locator('#topics [data-topic="safety"]').click();
  assert.equal(await page.locator('#detail a').getAttribute('href'), '/technician-field-mode');
  assert.equal(await page.locator('#topics [data-topic="aiAdmin"]').count(), 0);
  await page.keyboard.press('Control+k');
  await page.locator('.cw-command').waitFor();
  assert.equal(await page.locator('.cw-command-results a[href^="/admin-"]').count(), 0);
  await page.keyboard.press('Escape');
  await page.locator('#detail a').click();
  await page.waitForURL(base + '/technician-field-mode');
  await page.waitForFunction(() => document.querySelector('#visitList [data-visit-index]'));
  await selectRegular();
  assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  assert.equal(await token(), pinToken);
  console.log('PASS actual TEAM_LEADER menu, role help and quick commands return to the real route with original session and draft');

  await goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#loginBtn').click();
  await page.waitForURL('**/technician');
  await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('Rota atualizada'));
  const userToken = await token();
  assert.equal(jwt.decode(userToken).principalType, 'USER');
  assert.equal(jwt.decode(userToken).technicianId, leader.id);
  await goto('/technician-field-mode');
  await selectRegular();
  assert.equal(await page.evaluate(() => CWFieldWriteStore.session().owner), `USER:${user.id}:TECH:${leader.id}`);
  assert.equal(await page.locator('#notes').inputValue(), '', 'PIN draft must not become a USER draft');
  await page.locator('#notes').fill('Rascunho da sessão email');
  await saved();
  const userDraft = await page.evaluate(key => localStorage.getItem(key), userKey);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pinKey), pinDraft);
  await goto('/technician');
  await (await mobileMenu()).locator('a[href="/settings"]').click();
  await page.waitForURL(base + '/settings');
  await page.waitForFunction(() => document.getElementById('settingsStatus')?.dataset.state === 'ready');
  await page.locator('[data-setting-type="ARRIVAL"]').selectOption('false');
  await page.waitForFunction(() => document.getElementById('settingsStatus')?.dataset.state === 'saved');
  assert.equal((await prisma.userNotificationSetting.findUniqueOrThrow({ where: { userId_type: { userId: user.id, type: 'ARRIVAL' } } })).sound, false);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('settingsStatus')?.dataset.state === 'ready');
  assert.equal(await page.locator('[data-setting-type="ARRIVAL"]').inputValue(), 'false');
  assert.equal(await token(), userToken); assert.equal(await page.evaluate(key => localStorage.getItem(key), userKey), userDraft);
  await goto('/technician-field-mode'); await selectRegular();
  assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão email');
  await page.locator('#fieldLogoutBtn').click();
  await page.waitForURL('**/login');
  assert.equal(await page.evaluate(() => CristalAuth.getToken()), '');
  assert.deepEqual(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [pinKey, userKey]), [pinDraft, userDraft]);
  await pinLogin(leader.pin);
  await selectRegular();
  assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  console.log('PASS real email login binds USER to technician, isolates PIN/USER drafts, and logout/relogin preserves both');

  await prisma.technician.update({ where: { id: leader.id }, data: { role: 'TECHNICIAN' } });
  assert.equal((await api('/api/technician/today', pinToken)).status, 401);
  await page.evaluate(() => document.getElementById('fieldReloadBtn').click());
  await page.waitForFunction(() => !document.getElementById('fieldLoadError')?.hidden);
  assert.equal(await page.locator('#visitList [data-visit-index]').count(), 0, 'Revoked role must not reuse cached active route');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pinKey), pinDraft);
  assert(await page.locator('#notes').isDisabled());
  assert.equal(await page.locator('#notes').inputValue(), '');
  await prisma.technician.update({ where: { id: leader.id }, data: { role: 'TEAM_LEADER' } });
  await pinLogin(leader.pin);
  await selectRegular();
  assert.equal(await page.locator('#notes').inputValue(), 'Rascunho da sessão PIN');
  await pinLogin(other.pin);
  assert.equal(jwt.decode(await token()).role, 'TECHNICIAN');
  assert.match(await page.locator('#visitList').textContent(), /QA ronda de outro técnico/);
  assert.equal(await page.evaluate(() => CWFieldWriteStore.session().owner), 'TECH:' + other.id);
  assert.equal(errors.length, 0, errors.join('\n'));
  await context.close();
  console.log('PASS revoked TEAM_LEADER loses active route without losing draft; ordinary TECHNICIAN entry remains functional');

  for (const [claimRole, localRole, expiresIn, destination] of [
    ['CLIENT', 'CLIENT', '1h', '/client-portal'],
    ['ADMIN', 'ADMIN', '1h', '/admin-master-control'],
    ['CLIENT', 'TEAM_LEADER', '1h', '/client-portal'],
    ['TEAM_LEADER', 'CLIENT', '1h', '/technician-login'],
    ['TEAM_LEADER', 'TEAM_LEADER', '-1s', '/technician-login'],
    ['UNKNOWN', 'UNKNOWN', '1h', '/technician-login'],
  ]) {
    const isolated = await browser.newContext();
    const credential = jwt.sign({ id: leader.id, role: claimRole }, getJwtSecret(), { expiresIn });
    await isolated.addInitScript(({ credential, localRole, id }) => {
      if (localStorage.getItem('qaGuardInitialized')) return;
      localStorage.setItem('qaGuardInitialized', '1');
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, credential);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: localRole }));
      localStorage.setItem('cwFieldVisitDrafts:guard-fixture', 'preserved');
    }, { credential, localRole, id: leader.id });
    const guarded = await isolated.newPage();
    await guarded.route(base + destination + '**', route => route.fulfill({ contentType: 'text/html', body: '<p>Guard destination</p>' }));
    await guarded.goto(base + '/technician-field-mode');
    await guarded.waitForURL(url => url.pathname === destination);
    assert.equal(await guarded.evaluate(() => localStorage.getItem('cwFieldVisitDrafts:guard-fixture')), 'preserved');
    await isolated.close();
  }
  console.log('PASS client/admin redirect, mismatched token role, expired/unknown session and preserved local records');
  // Active visit boundaries use real JWT/SQL reads; only explicit write failures are intercepted.
  const guardContext=await browser.newContext({viewport:{width:390,height:1000},timezoneId:'Europe/Lisbon'}),guardPage=await guardContext.newPage(),guardErrors=[],guardRequests=[];
  await guardPage.clock.setFixedTime(Date.now());guardPage.setDefaultTimeout(10000);guardPage.on('pageerror',e=>guardErrors.push(e.message));
  await guardContext.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const actorA={id:leader.id,name:leader.name,role:'TEAM_LEADER'},actorB={id:other.id,name:other.name,role:'TECHNICIAN'},actorUser={id:leader.id,userId:user.id,principalType:'USER',technicianId:leader.id,name:user.name,role:'TEAM_LEADER'};
  const guardTokenB=jwt.sign({id:other.id,role:'TECHNICIAN'},getJwtSecret(),{expiresIn:'1h'}),renewed=jwt.sign({id:leader.id,role:'TEAM_LEADER',qaRenewal:'different-token'},getJwtSecret(),{expiresIn:'1h'});
  await guardContext.addInitScript(({credential,actor,pinKey,pinDraft,userKey,userDraft})=>{if(localStorage.getItem('qaVisitGuard'))return;localStorage.setItem('qaVisitGuard','1');for(const k of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(k,credential);for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify(actor));localStorage.setItem(pinKey,pinDraft);localStorage.setItem(userKey,userDraft);const interval=setInterval;window.setInterval=(fn,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(fn,delay,...args);Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});},{credential:pinToken,actor:actorA,pinKey,pinDraft,userKey,userDraft});
  guardPage.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/'))guardRequests.push({path,method:request.method(),body:request.postData(),authorization:request.headers().authorization});});
  await guardPage.goto(base+'/technician-field-mode?selectedVisitId='+visit.id+'&selectedVisitType=REGULAR',{waitUntil:'networkidle'});await guardPage.waitForFunction(id=>CWFieldVisitContext()?.id===id&&CWFieldVisitContext().visitType==='REGULAR'&&document.getElementById('fieldSaveStatus').dataset.state==='saved',visit.id);
  await guardPage.evaluate(()=>navigator.serviceWorker.ready);await guardPage.waitForFunction(()=>!!navigator.serviceWorker.controller);await guardContext.setOffline(true);await guardPage.waitForFunction(()=>document.getElementById('connectionState').dataset.offline==='true');
  await guardPage.evaluate(async id=>{await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{visitId:id,notes:'Original PIN pending <b>{id}</b>'});await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{visitType:'EXTRA',notes:'Original EXTRA pending <b>{id}</b>'});},visit.id);
  const guardPending=()=>guardPage.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('cw-field-writes',1);q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,r=db.transaction('requests').objectStore('requests').getAll();r.onsuccess=()=>{db.close();resolve(r.result.sort((a,b)=>a.key.localeCompare(b.key)));};r.onerror=()=>reject(r.error);};}));
  const savedGuardPending=await guardPending();assert.equal(savedGuardPending.length,2);assert(savedGuardPending.every(r=>!r.attemptedAt&&!r.response&&r.owner==='TECH:'+leader.id&&r.resourceId===visit.id&&r.payloadHash.length===64));assert.notEqual(savedGuardPending[0].requestId,savedGuardPending[1].requestId);
  await guardPage.goto(base+'/icons/icon-192.png',{waitUntil:'load'});const guardRaw=()=>guardPage.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>/^cwField|^cw:tech/.test(k)).sort().map(k=>[k,localStorage.getItem(k)]))),savedGuardRaw=await guardRaw();await guardContext.setOffline(false);
  const guardDb=()=>Promise.all([prisma.serviceVisit.findUnique({where:{id:visit.id}}),prisma.serviceVisit.findUnique({where:{id:foreign.id}}),prisma.extraVisit.findUnique({where:{id:extra.id}}),prisma.fieldWriteRequest.count(),prisma.stockMovement.count(),prisma.visitPhoto.count(),prisma.technicalHistory.count()]);const savedGuardDb=await guardDb();
  const guardCopy={"accountChanged": ["A conta mudou. Atualiza a ficha com a conta atual.", "Account changed. Refresh the record using the current account.", "Le compte a changé. Actualisez la fiche avec le compte actuel.", "La cuenta ha cambiado. Actualiza la ficha con la cuenta actual.", "Das Konto wurde gewechselt. Formular mit dem aktuellen Konto neu laden."], "accountUnavailable": ["A sessão já não permite esta visita. Volta a entrar com a conta original.", "The session no longer permits this visit. Sign in again with the original account.", "La session ne permet plus cette visite. Reconnectez-vous avec le compte initial.", "La sesión ya no permite esta visita. Vuelve a entrar con la cuenta original.", "Die Sitzung erlaubt diesen Besuch nicht mehr. Erneut mit dem ursprünglichen Konto anmelden."]},langs=['pt','en','fr','es','de'],words={toLoad:['Por carregar','Not loaded yet','À charger','Por cargar','Noch nicht geladen'],ready:['Ficha da visita pronta para registo de leituras e fecho.','Visit record ready for readings and completion.','Fiche de visite prête pour les mesures et la clôture.','Ficha de la visita lista para registrar lecturas y cerrar.','Besuchsformular ist bereit für Messwerte und Abschluss.'],visitUnavailable:['Visita indisponível.','Visit unavailable.','Visite indisponible.','Visita no disponible.','Besuch nicht verfügbar.']};
  let guardMode='native',guardHeld=0,guardRelease,guardClosing=false,guardReadIndex=0,guardCases=0,guardLocaleNoSubmit=0;const guardNativeStatuses=[],controlledWrites=[];
  const guardHandler=async route=>{const request=route.request(),path=new URL(request.url()).pathname;try{
    if(request.method()==='POST'){controlledWrites.push({path,body:request.postData(),authorization:request.headers().authorization});assert.equal(guardMode,'late-write');guardHeld++;await new Promise(resolve=>{guardRelease=resolve;});return await route.fulfill({status:503,json:{error:'PRIVATE_OLD_WRITE_FAILURE <b>{id}</b>'}});}
    if(path!=='/api/visits/'+visit.id)return await route.continue();
    if(guardMode==='wrong-id'){const response=await route.fetch();assert.equal(response.status(),200);const data=await response.json();data.visit.id=foreign.id;data.visit.pool.name='FORBIDDEN_WRONG_POOL';return await route.fulfill({status:200,json:data});}
    if(guardMode==='old-failure'&&guardReadIndex++===0){guardHeld++;await new Promise(resolve=>{guardRelease=resolve;});return await route.fulfill({status:503,json:{error:'PRIVATE_OLD_READ_FAILURE'}});}
    if(guardMode==='late-native'){const response=await route.fetch();guardNativeStatuses.push(response.status());assert.equal(response.status(),200);guardHeld++;await new Promise(resolve=>{guardRelease=resolve;});return await route.fulfill({response});}
    return await route.continue();
  }catch(error){if(!guardClosing)throw error;}};
  await guardPage.route('**/api/visits/**',guardHandler);
  const switchGuard=async(credential,actor,event=true)=>guardPage.evaluate(({credential,actor,event})=>{for(const k of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(k,credential);for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify(actor));if(event)window.dispatchEvent(new Event('cw:session-change'));},{credential,actor,event});
  const guardSettle=()=>guardPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))),guardFields=['ph','chlorine','alkalinity','salt','temperature','orp','cleaned','brushed','notes','notDoneReason','photo'];
  const guardState=()=>guardPage.evaluate(async ids=>{const file=document.getElementById('photo').files[0],hash=file?[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''):null;return {fields:ids.map(id=>{const n=document.getElementById(id);return[id,n.type==='file'?Array.from(n.files).map(f=>[f.name,f.size,f.type,f.lastModified]):n.type==='checkbox'?n.checked:n.value,n.disabled];}),photoHash:hash,busy:['uploadBtn','completeBtn','notDoneBtn','refreshBtn'].map(id=>[id,document.getElementById(id).disabled]),focus:document.activeElement.id};},guardFields);
  async function guardMatrix({name,key='ready',raw=null,cleared=false}={}){
    await guardPage.locator('#cwLanguageSelect').focus();await guardSettle();const before=await guardState(),first=guardRequests.length,writeFirst=controlledWrites.length;
    await guardPage.evaluate(()=>{window.qaGuardLeaves=[...document.querySelectorAll('#statusBox,#info .visit-empty,#heroPool,#heroClient,#photoMeta')].map(node=>({node,parent:node.parentNode,leaf:node.firstChild}));});
    for(const [index,language] of langs.entries()){
      await guardPage.locator('#cwLanguageSelect').selectOption(language);await guardSettle();assert.equal(await guardPage.locator('html').getAttribute('lang'),language);
      assert.equal(await guardPage.locator('#statusBox').textContent(),raw??(guardCopy[key]||words[key])[index],name+'/'+language);assert.deepEqual(await guardState(),before,name+' keeps fields, File bytes, focus and disabled states');
      assert(await guardPage.evaluate(()=>qaGuardLeaves.every(({node,parent,leaf})=>node.isConnected&&node.parentNode===parent&&node.firstChild===leaf)),'Guard language repaint keeps its nodes and leaves');
      if(cleared){assert.equal(await guardPage.locator('#heroPool').textContent(),words.toLoad[index]);assert.equal(await guardPage.locator('#heroClient').textContent(),words.toLoad[index]);for(const id of guardFields){if(['cleaned','brushed'].includes(id))assert.equal(await guardPage.locator('#'+id).isChecked(),false);else if(id==='photo')assert.equal(await guardPage.locator('#photo').evaluate(n=>n.files.length),0);else assert.equal(await guardPage.locator('#'+id).inputValue(),'');}for(const id of ['uploadBtn','completeBtn','notDoneBtn'])assert(await guardPage.locator('#'+id).isDisabled());}
      assert(!await guardPage.locator('body').textContent().then(s=>s.includes('FORBIDDEN_WRONG_POOL')||s.includes('PRIVATE_OLD_WRITE_FAILURE')||s.includes('PRIVATE_OLD_READ_FAILURE')));guardCases++;
      if(process.env.CW_VISIT_GUARD_CAPTURE&&language==='de'&&['changed-owner','late-native','late-write'].includes(name)){await require('node:fs/promises').mkdir(process.env.CW_VISIT_GUARD_CAPTURE,{recursive:true});await guardPage.locator('main.visit-shell').screenshot({path:process.env.CW_VISIT_GUARD_CAPTURE+'/'+name+'-de-390.png'});await guardPage.locator('#cwLanguageSelect').focus();}
    }
    for(const request of guardRequests.slice(first)){assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);guardLocaleNoSubmit++;}assert.equal(controlledWrites.length,writeFirst);
    assert.deepEqual(await guardDb(),savedGuardDb);assert.deepEqual(await guardRaw(),savedGuardRaw);assert.deepEqual(await guardPending(),savedGuardPending);assert.deepEqual(guardErrors,[]);console.log('PASS active visit boundary '+JSON.stringify({name,guardCases,noSqlOperationalWrites:true}));
  }
  const guardReady=()=>guardPage.waitForFunction(()=>document.getElementById('statusBox').dataset.tone==='success'),refreshGuard=async()=>{await guardPage.locator('#refreshBtn').click();await guardReady();await guardSettle();},waitHeld=async previous=>{const started=Date.now();while(guardHeld===previous&&Date.now()-started<10000)await new Promise(r=>setTimeout(r,20));assert(guardHeld>previous,'The real handler must reach its held response before switching account');};
  await guardPage.goto(base+'/technician-visit?visit='+visit.id+'&lang=de',{waitUntil:'networkidle'});await guardReady();assert.equal(await guardPage.locator('#heroPool').textContent(),pool.name);
  const privateValues={ph:'7,48',chlorine:'1.75',alkalinity:'95',salt:'3700',temperature:'26,5',orp:'715',notes:'PRIVATE_PIN_INPUT <b>{id}</b>',notDoneReason:'Private original reason'};for(const [id,value] of Object.entries(privateValues))await guardPage.locator('#'+id).fill(value);await guardPage.locator('#cleaned').check();await guardPage.locator('#brushed').check();await guardPage.locator('#photo').setInputFiles({name:'Private PIN photo.png',mimeType:'image/png',buffer:Buffer.alloc(1024,17)});
  await guardMatrix({name:'native-fields'});const originalGuardFields=(await guardState()).fields.map(([id,value])=>[id,value]),originalFileHash=(await guardState()).photoHash;
  const sameFirst=guardRequests.length;await switchGuard(renewed,{...actorA,name:'Updated same principal'});await guardMatrix({name:'same-owner-renewal'});assert(!guardRequests.slice(sameFirst).some(r=>r.path.startsWith('/api/visits/')));
  await switchGuard(guardTokenB,actorB);await guardMatrix({name:'changed-owner',key:'accountChanged',cleared:true});assert.equal((await api('/api/visits/'+visit.id,guardTokenB)).status,403);await guardPage.evaluate(()=>{completeVisit();markNotDone();uploadPhoto();});assert.equal(controlledWrites.length,0);
  await guardPage.locator('#refreshBtn').click();await guardPage.waitForFunction(()=>document.getElementById('statusBox').dataset.tone==='error');await guardMatrix({name:'new-owner-native-denied',raw:'Acesso negado',cleared:true});
  await switchGuard(userToken,actorUser);await guardMatrix({name:'pin-to-user',key:'accountChanged',cleared:true});await refreshGuard();assert.equal(await guardPage.locator('#notes').inputValue(),'','PIN fields must not become USER fields for the same technician');await guardPage.locator('#notes').fill('PRIVATE_USER_INPUT');await guardPage.locator('#ph').fill('6.99');await guardMatrix({name:'user-fields'});
  await switchGuard(renewed,actorA);await refreshGuard();assert.deepEqual((await guardState()).fields.map(([id,value])=>[id,value]),originalGuardFields);assert.equal((await guardState()).photoHash,originalFileHash);await guardMatrix({name:'original-pin-restored'});
  // Refreshing this same principal must preserve later edits, rather than an older saved in-memory copy.
  await guardPage.locator('#notes').fill('PRIVATE_PIN_LATER_EDIT');privateValues.notes='PRIVATE_PIN_LATER_EDIT';await refreshGuard();assert.equal(await guardPage.locator('#notes').inputValue(),privateValues.notes);await guardMatrix({name:'same-owner-refresh-keeps-latest-edit'});
  guardMode='late-native';let previous=guardHeld;await guardPage.locator('#refreshBtn').click();await waitHeld(previous);await switchGuard(guardTokenB,actorB);guardRelease();guardRelease=null;await guardPage.waitForLoadState('networkidle');await guardMatrix({name:'late-native',key:'accountChanged',cleared:true});
  guardMode='native';await switchGuard(renewed,actorA);await refreshGuard();assert.equal(await guardPage.locator('#notes').inputValue(),privateValues.notes);assert.equal((await guardState()).photoHash,originalFileHash);
  guardMode='late-native';previous=guardHeld;await guardPage.locator('#refreshBtn').click();await waitHeld(previous);await switchGuard(guardTokenB,actorB,false);guardRelease();guardRelease=null;await guardPage.waitForLoadState('networkidle');await guardMatrix({name:'late-native-no-session-event',key:'accountChanged',cleared:true});
  guardMode='native';await switchGuard(renewed,actorA);await refreshGuard();guardMode='late-write';previous=guardHeld;await guardPage.locator('#completeBtn').click();await waitHeld(previous);assert.equal(controlledWrites.length,1);assert.equal(controlledWrites[0].path,'/api/visits/complete');assert.equal(controlledWrites[0].authorization,'Bearer '+renewed);assert.deepEqual(JSON.parse(controlledWrites[0].body),{visitId:visit.id,ph:7.48,chlorine:1.75,alkalinity:95,salt:3700,temperature:26.5,orp:715,cleaned:true,brushed:true,notes:privateValues.notes});await switchGuard(guardTokenB,actorB);guardRelease();guardRelease=null;await guardPage.waitForLoadState('networkidle');await guardMatrix({name:'late-write',key:'accountChanged',cleared:true});
  guardMode='native';await switchGuard(renewed,actorA);await refreshGuard();guardMode='old-failure';guardReadIndex=0;previous=guardHeld;await guardPage.locator('#refreshBtn').click();await waitHeld(previous);await guardPage.locator('#refreshBtn').click();await guardReady();guardRelease();guardRelease=null;await guardPage.waitForLoadState('networkidle');await guardMatrix({name:'same-owner-old-error-ignored'});
  guardMode='wrong-id';await guardPage.locator('#refreshBtn').click();await guardPage.waitForFunction(()=>document.getElementById('statusBox').dataset.tone==='error');await guardMatrix({name:'wrong-visit-id',key:'visitUnavailable'});const blockedWrites=controlledWrites.length;await guardPage.evaluate(()=>{completeVisit();markNotDone();uploadPhoto();});assert.equal(controlledWrites.length,blockedWrites);
  guardMode='native';await refreshGuard();const second=await guardContext.newPage();await second.goto(base+'/icons/icon-192.png');await second.evaluate(({credential,actor})=>{for(const k of ['token','cristalwater_jwt','adminToken'])localStorage.setItem(k,credential);for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify(actor));},{credential:guardTokenB,actor:actorB});await guardPage.waitForFunction(()=>document.getElementById('notes').disabled&&document.getElementById('notes').value==='');await guardMatrix({name:'real-cross-tab-storage',key:'accountChanged',cleared:true});await second.close();await switchGuard(renewed,actorA);await refreshGuard();assert.equal(await guardPage.locator('#notes').inputValue(),privateValues.notes);assert.equal((await guardState()).photoHash,originalFileHash);await guardMatrix({name:'cross-tab-original-owner-restored'});
  const guardJs=await require('node:fs/promises').readFile(require('node:path').join(__dirname,'../frontend/technician-visit.js'),'utf8'),guardHtml=await require('node:fs/promises').readFile(require('node:path').join(__dirname,'../frontend/technician-visit.html'),'utf8'),worker=await require('node:fs/promises').readFile(require('node:path').join(__dirname,'../frontend/sw.js'),'utf8'),version=worker.match(/^const CACHE = '([^']+)';$/m)[1];let exact=false;const cacheStarted=Date.now();do{exact=await guardPage.evaluate(async({version,js,html})=>{const c=await caches.open(version),j=await c.match('/technician-visit.js'),h=await c.match('/technician-visit',{ignoreSearch:true});return !!j&&!!h&&(await j.text())===js&&(await h.text())===html;},{version,js:guardJs,html:guardHtml});if(exact)break;await new Promise(r=>setTimeout(r,50));}while(Date.now()-cacheStarted<10000);assert.equal(exact,true,'Exact visit HTML/JS must be present in the declared cache within10000ms');
  assert.equal(guardNativeStatuses.length,2);assert(guardNativeStatuses.every(s=>s===200));assert.deepEqual(await guardDb(),savedGuardDb);assert.deepEqual(await guardRaw(),savedGuardRaw);assert.deepEqual(await guardPending(),savedGuardPending);assert.deepEqual(guardErrors,[]);guardClosing=true;await guardPage.unroute('**/api/visits/**',guardHandler);await guardContext.close();
  console.log('PASS active visit guard result '+JSON.stringify({guardCases,languages:5,realPinAndUserIdentities:true,nativeAssigned200AndForeign403:true,realOldHeldSqlResponses:2,sessionEventAndNoEventAndCrossTabStorage:true,samePrincipalRenewalAndLatestEditsRetained:true,pinUserFieldsIsolated:true,originalFileMetadataAndBytesRestored:true,explicitLateWriteFailure:1,originalPayload:true,readGenerationAndWrongResourceChecked:true,immutableTypedPending:2,fieldDraftBytesPreserved:true,localePreferenceWritesOnly:guardLocaleNoSubmit,exactDeclaredCache:version,exactHtmlAndJs:true,noOperationalSqlWrites:true}));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
