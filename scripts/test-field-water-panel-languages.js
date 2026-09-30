'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  "drip": [
    "A pingar",
    "Dripping",
    "Goutte à goutte",
    "Goteando",
    "Tropfend"
  ],
  "half": [
    "Meia aberta",
    "Half open",
    "À moitié ouverte",
    "Medio abierta",
    "Halb geöffnet"
  ],
  "full": [
    "Totalmente aberta",
    "Fully open",
    "Complètement ouverte",
    "Totalmente abierta",
    "Vollständig geöffnet"
  ],
  "unknownTime": [
    "tempo por confirmar",
    "time unconfirmed",
    "durée à confirmer",
    "tiempo por confirmar",
    "Zeit unbestätigt"
  ],
  "minutes": [
    "{minutes} min",
    "{minutes} min",
    "{minutes} min",
    "{minutes} min",
    "{minutes} Min."
  ],
  "hours": [
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours} Std. {minutes} Min."
  ],
  "days": [
    "{days}d {hours}h",
    "{days}d {hours}h",
    "{days}j {hours}h",
    "{days}d {hours}h",
    "{days} T. {hours} Std."
  ],
  "flowLabel": [
    "Estado da torneira ou caudal",
    "Tap or flow state",
    "État du robinet ou débit",
    "Estado del grifo o caudal",
    "Zustand des Wasserhahns oder Durchfluss"
  ],
  "notePlaceholder": [
    "Nota opcional. Ex: encher até meio do skimmer",
    "Optional note. E.g. fill to the middle of the skimmer",
    "Note facultative. Ex. : remplir jusqu’au milieu du skimmer",
    "Nota opcional. Ej.: llenar hasta la mitad del skimmer",
    "Optionale Notiz. Z. B. bis zur Mitte des Skimmers auffüllen"
  ],
  "helper": [
    "Indica como ficou a água. O aviso mantém-se ativo até confirmares que a torneira está fechada; o tempo é contado automaticamente.",
    "Indicate how you left the water. The warning stays active until you confirm the tap is closed; elapsed time is counted automatically.",
    "Indiquez comment vous avez laissé l’eau. L’avertissement reste actif jusqu’à la confirmation de la fermeture du robinet ; la durée est calculée automatiquement.",
    "Indique cómo ha dejado el agua. El aviso permanece activo hasta que confirme que el grifo está cerrado; el tiempo se cuenta automáticamente.",
    "Geben Sie an, wie Sie das Wasser hinterlassen haben. Die Warnung bleibt aktiv, bis Sie bestätigen, dass der Wasserhahn geschlossen ist; die Zeit wird automatisch erfasst."
  ],
  "closedPending": [
    "Fecho físico confirmado; envio pendente",
    "Physical closure confirmed; upload pending",
    "Fermeture physique confirmée ; envoi en attente",
    "Cierre físico confirmado; envío pendiente",
    "Schließen vor Ort bestätigt; Übermittlung ausstehend"
  ],
  "openSince": [
    "Água aberta há {elapsed}",
    "Water has been running for {elapsed}",
    "L’eau coule depuis {elapsed}",
    "Agua abierta desde hace {elapsed}",
    "Wasser läuft seit {elapsed}"
  ],
  "flowDetail": [
    "Caudal: {flow}{note}",
    "Flow: {flow}{note}",
    "Débit : {flow}{note}",
    "Caudal: {flow}{note}",
    "Durchfluss: {flow}{note}"
  ],
  "unknownFlow": [
    "Por confirmar",
    "Unconfirmed",
    "À confirmer",
    "Por confirmar",
    "Unbestätigt"
  ],
  "pool": [
    "Piscina",
    "Pool",
    "Piscine",
    "Piscina",
    "Pool"
  ],
  "client": [
    "Cliente",
    "Client",
    "Client",
    "Cliente",
    "Kunde"
  ],
  "interrupt": [
    "{pool} | {client} | {open} | {flow}",
    "{pool} | {client} | {open} | {flow}",
    "{pool} | {client} | {open} | {flow}",
    "{pool} | {client} | {open} | {flow}",
    "{pool} | {client} | {open} | {flow}"
  ],
  "missing": [
    "Reabra a página para recuperar os lembretes.",
    "Reopen the page to recover reminders.",
    "Rouvrez la page pour récupérer les rappels.",
    "Vuelva a abrir la página para recuperar los recordatorios.",
    "Öffnen Sie die Seite erneut, um die Erinnerungen wiederherzustellen."
  ],
  "savedOpen": [
    "Água aberta guardada neste telemóvel. A confirmar no servidor.",
    "Running water recorded on this phone. Awaiting server confirmation.",
    "Ouverture de l’eau enregistrée sur ce téléphone. En attente de confirmation du serveur.",
    "Agua abierta registrada en este teléfono. Pendiente de confirmación del servidor.",
    "Laufendes Wasser auf diesem Telefon erfasst. Serverbestätigung ausstehend."
  ],
  "confirm": [
    "Confirma que a torneira está totalmente fechada?",
    "Do you confirm that the tap is fully closed?",
    "Confirmez-vous que le robinet est complètement fermé ?",
    "¿Confirma que el grifo está totalmente cerrado?",
    "Bestätigen Sie, dass der Wasserhahn vollständig geschlossen ist?"
  ],
  "savedClosed": [
    "Fecho guardado neste telemóvel. A confirmar no servidor.",
    "Closure saved on this phone. Awaiting server confirmation.",
    "Fermeture enregistrée sur ce téléphone. En attente de confirmation du serveur.",
    "Cierre guardado en este teléfono. Pendiente de confirmación del servidor.",
    "Schließen auf diesem Telefon gespeichert. Serverbestätigung ausstehend."
  ]
};
let browser, completed = false; const releases = [];
const deadline = setTimeout(() => { console.error('Water panel language scenario did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Técnico <b>{minutes}</b>', active: true } });
  const client = await prisma.client.create({ data: { name: 'Pump panel client', active: true } });
  const regularPool = await prisma.pool.create({ data: { name: 'REGULAR <b>{minutes}</b>', clientId: client.id, active: true } });
  const extraPool = await prisma.pool.create({ data: { name: 'EXTRA <b>{minutes}</b>', clientId: client.id, active: true } });
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(x => x._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'PLANNED' };
  await prisma.serviceVisit.create({ data: { ...common, poolId: regularPool.id, date: new Date(), plannedDate: new Date() } });
  await prisma.extraVisit.create({ data: { ...common, poolId: extraPool.id, scheduledAt: new Date() } });
  for (const table of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Lisbon' });
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaPumpPanel')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, role: 'TECHNICIAN', name: tech.name }));
      localStorage.setItem('qaPumpPanel', '1');
    }
    // Isolate presentation from background refresh; keep session guards running.
    const interval = setInterval; window.qaPumpTimers = [];
    window.setInterval = (fn, delay, ...args) => { if ([15000, 30000, 60000].includes(delay)) { if (delay === 30000) qaPumpTimers.push(fn); return 0; } return interval(fn, delay, ...args); };
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } }); window.alert = () => {};
  }, { token, tech, origin: base });
  const page = await context.newPage(), errors = [], requests = []; page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', r => { const path = new URL(r.url()).pathname; if (path.startsWith('/api/')) requests.push({ path, method: r.method(), body: r.postData(), authorization: r.headers().authorization }); });
  const panel = page.locator('.water-card');
  const key = `cwFieldReminders:v1:TECH:${tech.id}`, endpoint = '/api/technician/water-reminders';
  const raw = () => page.evaluate(key => localStorage.getItem(key), key), rows = async () => Object.values(JSON.parse(await raw() || '{}'));
  const database = async () => ({ reminders: await prisma.operationalReminder.findMany({ where: { assignedToTechnicianId: tech.id }, orderBy: { id: 'asc' } }), history: await prisma.technicalHistory.findMany({ where: { poolId: { in: [regularPool.id, extraPool.id] } }, orderBy: { id: 'asc' } }) });
  const locale = async lang => { await page.locator('#cwLanguageSelect').selectOption(lang); await page.waitForFunction(lang => document.documentElement.lang === lang, lang); };
  const instrument = () => page.evaluate(() => { window.qaPumpCalls = {}; for (const name of ['create', 'mark', 'list', 'sync', 'context', 'legacyWarning']) { const fn = CWFieldReminders[name]; CWFieldReminders[name] = (...args) => { qaPumpCalls[name] = (qaPumpCalls[name] || 0) + 1; return fn(...args); }; } });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const flowKeys = { DRIP: 'drip', HALF: 'half', FULL: 'full' };
  const text = (key, index, params = {}) => words[key][index].replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
  function elapsed(row, index) {
    const date = new Date(row.createdAt || 0); if (Number.isNaN(date.getTime())) return words.unknownTime[index];
    const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)), hours = Math.floor(mins / 60);
    return mins < 60 ? text('minutes', index, { minutes: mins }) : hours < 24 ? text('hours', index, { hours, minutes: String(mins % 60).padStart(2, '0') }) : text('days', index, { days: Math.floor(hours / 24), hours: hours % 24 });
  }
  const state = () => page.evaluate(() => ({ focus: document.activeElement.id, selection: [document.activeElement.selectionStart, document.activeElement.selectionEnd], note: document.getElementById('waterNote').value, flow: document.getElementById('waterFlowState').value, hidden: ['waterMinutes','waterCloseTime'].map(id => { const n = document.getElementById(id); return [n.value,n.hidden,n.tabIndex,n.getAttribute('aria-hidden')]; }), calls: { ...qaPumpCalls }, context: CWFieldVisitContext(), token: localStorage.getItem('token'), alternateToken: localStorage.getItem('cristalwater_jwt'), data: Object.keys(localStorage).filter(k => k.startsWith('cwField') || k.startsWith('cwWater') || k.startsWith('cwPump') || k.startsWith('cw:tech')).sort().map(k => [k,localStorage.getItem(k)]) }));
  async function matrix(toastKey, literal = null, display = []) {
    await settle(); await page.locator('#waterNote').focus();
    await page.evaluate(() => { window.qaWaterNodes = Array.from(document.querySelectorAll('.water-card,.water-card *,#interruptList [data-exception-category=WATER_OPEN],#interruptList [data-exception-category=WATER_OPEN] *,#toast')); });
    const before = await state(), stored = await raw(), db = await database(), count = requests.length;
    for (const width of [320,390,1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, lang] of languages.entries()) {
        await locale(lang); await settle();
        assert.equal(await page.locator('#waterFlowState').getAttribute('aria-label'), words.flowLabel[index]);
        for (const [flow,key] of Object.entries(flowKeys)) assert.equal(await page.locator(`#waterFlowState option[value=${flow}]`).textContent(), words[key][index]);
        assert.equal(await page.locator('#waterNote').getAttribute('placeholder'), words.notePlaceholder[index]); assert.equal(await page.locator('[data-water-state-helper]').textContent(), words.helper[index]);
        if (toastKey !== undefined || literal !== null) assert.equal(await page.locator('#toast').textContent(), literal === null ? (Array.isArray(toastKey) ? toastKey[index] : words[toastKey][index]) : literal);
        for (const row of display) {
          const node = page.locator(`[data-water-id="${row.localId}"]`), open = text('openSince',index,{elapsed:elapsed(row,index)}), flow = words[flowKeys[row.flowState] || 'unknownFlow'][index];
          assert.equal(await node.locator('.doc-number').textContent(), row.status === 'CLOSED' ? words.closedPending[index] : open);
          assert.equal(await node.locator('[data-water-flow-detail]').textContent(), text('flowDetail',index,{flow,note:row.userNote ? ' · '+row.userNote : ''}));
          const detail = page.locator(`[data-exception-id="water-open:${row.localId}"] > strong + div`);
          if (await detail.count()) assert.equal(await detail.textContent(), text('interrupt',index,{pool:row.poolName||words.pool[index],client:row.clientName||words.client[index],open,flow:text('flowDetail',index,{flow,note:''})}));
        }
        assert.equal(await raw(), stored); assert.deepEqual(await state(), before); assert.deepEqual(await database(), db); assert(await page.evaluate(() => qaWaterNodes.every(node => node.isConnected)));
        assert(await panel.evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'water panel fits');
      }
    }
    for (const r of requests.slice(count)) { assert.equal(r.path,'/api/settings/language/me'); assert.equal(r.method,'PUT'); assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']); }
  }
  const selectExtra = async () => { await page.locator('[data-field-tab-button=hoje]').click(); await page.locator('[data-pool-filter=TODO]').click(); await page.locator('#visitList [data-visit-index]').filter({hasText:extraPool.name}).click(); await page.waitForFunction(() => CWFieldVisitContext()?.visitType === 'EXTRA'); await page.locator('[data-field-tab-button=more]').click(); await settle(); };
  await page.goto(base+`/technician-field-mode?selectedVisitId=${id}&selectedVisitType=REGULAR`,{waitUntil:'networkidle'}); await page.waitForFunction(id => CWFieldVisitContext()?.id === id,id); await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.locator('[data-field-tab-button=more]').click(); await locale('en'); await settle();
  assert.equal(await page.locator('#waterFlowState').getAttribute('aria-label'),words.flowLabel[1]);
  await instrument(); await page.locator('#waterFlowState').selectOption('HALF'); await page.locator('#waterNote').fill('Literal <b>{elapsed}</b> note'); await matrix();
  assert(await page.locator('#waterMinutes').isHidden()); assert(await page.locator('#waterCloseTime').isHidden());
  await context.setOffline(true);
  await page.evaluate(({key,literal}) => { window.qaWrite = Storage.prototype.setItem; Storage.prototype.setItem = function(k,v) { if(k===key) { const e=Error(literal);e.copy={key:'missing'};throw e; } return qaWrite.call(this,k,v); }; },{key,literal:words.missing[0]});
  await page.locator('#openWaterBtn').click(); await page.waitForFunction(text => document.getElementById('toast').textContent === text,words.missing[0]); await matrix(undefined,words.missing[0]); assert.equal(await raw(),null);
  await page.evaluate(() => { Storage.prototype.setItem=qaWrite; });
  await page.locator('#openWaterBtn').click(); await page.waitForFunction(key => Object.keys(JSON.parse(localStorage.getItem(key)||'{}')).length===1,key); await page.waitForFunction(() => document.querySelector('[data-water-flow-detail]')); await settle();
  let regular=(await rows())[0]; assert.equal(regular.flowState,'HALF'); assert.equal(regular.note,'Literal <b>{elapsed}</b> note'); assert.equal(await page.locator('#waterNote').inputValue(),''); assert.equal(regular.visitType,'REGULAR');
  await page.locator('#waterNote').fill('Unsubmitted water note'); await matrix('savedOpen',null,await rows());
  // Replacing a shared toast with identical raw text loses the old presentation identity.
  await locale('pt'); await page.evaluate(value => { document.getElementById('toast').textContent=value; },words.savedOpen[0]); await matrix(undefined,words.savedOpen[0],await rows());
  for (const [index,lang] of languages.entries()) { await locale(lang); const before=await raw(),dialog=page.waitForEvent('dialog'),click=page.locator(`[data-water-close="${regular.localId}"]`).click(); const d=await dialog; assert.equal(d.message(),words.confirm[index]); await d.dismiss(); await click; assert.equal(await raw(),before); }
  await page.locator('#openWaterBtn').click(); await page.waitForFunction(() => document.getElementById('toast').textContent.includes('bereits eine aktive Erinnerung')); await matrix(['Esta visita já tem este lembrete ativo.','This visit already has an active reminder of this kind.','Cette visite a déjà un rappel actif de ce type.','Esta visita ya tiene un recordatorio activo de este tipo.','Für diesen Besuch gibt es bereits eine aktive Erinnerung dieser Art.'],null,await rows());
  await selectExtra(); await page.locator('#waterFlowState').selectOption('DRIP'); await page.locator('#waterNote').fill('Extra water note <b>{flow}</b>'); await page.locator('#openWaterBtn').click(); await page.waitForFunction(key => Object.keys(JSON.parse(localStorage.getItem(key))).length===2,key); await settle();
  const original=await raw(),extra=(await rows()).find(row=>row.visitType==='EXTRA'); assert(extra);assert.equal(extra.visitId,regular.visitId);assert.notEqual(extra.localId,regular.localId);assert.equal(extra.poolId,extraPool.id);await matrix('savedOpen',null,await rows());
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>CWFieldReminders&&CWWaterReminders&&CWFieldVisitContext());await page.locator('[data-field-tab-button=more]').click();await instrument();await settle();assert.equal(await raw(),original);await matrix(undefined,null,await rows());
  console.log('PASS real water controls in five languages at320/390/1440; no producer reads or operational HTTP on language changes; same nodes/focus/selection/flow/note/hidden fields/bytes/SQL; raw external and overwritten shared toast literal; physical cancellation; offline REGULAR/EXTRA collision and cache');
  // Read-only presentation fixtures keep payload/hash/due date intact and restore original bytes before any network.
  for (const age of [13*60000,125*60000,49*3600000,'invalid']) {
    const sample=JSON.parse(original),row=sample['WATER_OPEN:'+extra.localId];row.createdAt=age==='invalid'?'invalid':new Date(Date.now()-age).toISOString();row.flowState=age===13*60000?'FULL':'UNKNOWN';row.userNote='literal <b>{elapsed}</b>';row.poolName='';row.clientName='';
    await page.evaluate(({key,raw,timer})=>{localStorage.setItem(key,raw);if(timer){const tick=qaPumpTimers.find(fn=>String(fn).includes('decorate()'));if(!tick)throw Error('Water refresh timer missing');tick();}else window.dispatchEvent(new Event('cw:water-state-updated'));},{key,raw:JSON.stringify(sample),timer:age===125*60000});await settle();await matrix(undefined,null,await rows());
  }
  await page.evaluate(({key,original})=>{localStorage.setItem(key,original);window.dispatchEvent(new Event('cw:water-state-updated'));},{key,original});await settle();assert.equal(await raw(),original);
  if(process.env.CW_WATER_LANGUAGE_CAPTURE){await page.setViewportSize({width:320,height:900});await locale('de');await panel.screenshot({path:process.env.CW_WATER_LANGUAGE_CAPTURE});}
  await locale('de');const dialogEvent=page.waitForEvent('dialog'),closing=page.locator(`[data-water-close="${regular.localId}"]`).click();const dialog=await dialogEvent;assert.equal(dialog.message(),words.confirm[4]);await dialog.accept();await closing;await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key))['WATER_OPEN:'+id].status==='CLOSED',{key,id:regular.localId});await settle();await matrix('savedClosed',null,await rows());
  let mode='deny',release,entered;const gate=new Promise(r=>{release=r;releases.push(r);}),started=new Promise(r=>{entered=r;});const posts=[];
  await page.route(base+endpoint+'**',async route=>{const r=route.request();if(r.method()==='GET')return route.fulfill({json:{ok:true,reminders:[]}});const body=r.postDataJSON();posts.push({path:new URL(r.url()).pathname,body,authorization:r.headers().authorization});if(mode==='deny')return route.fulfill({status:403,json:{error:'Raw <b>{flow}</b> server refusal'}});const response=await route.fetch();assert.equal(response.status(),200);if(mode==='lose'&&body.localId===extra.localId){entered();await gate;return route.abort('connectionfailed');}if(mode==='badClose'&&r.url().endsWith('/close')){const data=await response.json();return route.fulfill({json:{...data,reminder:{...data.reminder,isCompleted:false}}});}return route.fulfill({response});});
  await context.setOffline(false);await page.evaluate(()=>CWFieldReminders.sync());await settle();assert((await rows()).every(row=>row.syncError==='Raw <b>{flow}</b> server refusal'));assert.equal((await database()).reminders.length,0);await matrix(undefined,null,await rows());
  mode='lose';const sending=page.evaluate(()=>CWFieldReminders.sync());await started;await settle();const held=await raw();await matrix(undefined,null,(await rows()).filter(row=>!row.closeSyncedAt));assert.equal(await raw(),held);assert.equal((await database()).reminders.length,2);release();await sending;assert(!(await rows()).find(row=>row.localId===extra.localId).serverId);
  mode='accept';await page.evaluate(()=>CWFieldReminders.sync());await settle();const retry=posts.filter(p=>p.body.localId===extra.localId&&p.path===endpoint);assert(retry.length>=3);assert(retry.every(p=>JSON.stringify(p)===JSON.stringify(retry[0])));assert.equal(retry[0].authorization,'Bearer '+token);assert.equal(retry[0].body.flowState,'DRIP');assert.equal(retry[0].body.visitType,'EXTRA');assert.equal(retry[0].body.poolId,extraPool.id);
  await context.setOffline(true);const extraDialog=page.waitForEvent('dialog'),extraClose=page.locator(`[data-water-close="${extra.localId}"]`).click();const d=await extraDialog;assert.equal(d.message(),words.confirm[4]);await d.accept();await extraClose;await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key))['WATER_OPEN:'+id].status==='CLOSED',{key,id:extra.localId});await settle();await matrix('savedClosed',null,(await rows()).filter(row=>!row.closeSyncedAt));
  mode='badClose';await context.setOffline(false);await page.evaluate(()=>CWFieldReminders.sync());await settle();assert(!(await rows()).find(row=>row.localId===extra.localId).closeSyncedAt);await matrix(undefined,null,(await rows()).filter(row=>!row.closeSyncedAt));mode='accept';await page.evaluate(()=>CWFieldReminders.sync());await settle();
  const db=await database();assert.equal(db.reminders.length,2);assert(db.reminders.every(r=>r.isCompleted));assert.equal(db.history.filter(r=>r.type==='WATER_OPEN'&&r.message==='OPEN').length,2);assert.equal(db.history.filter(r=>r.type==='WATER_OPEN'&&r.message==='CLOSED').length,2);assert((await rows()).every(r=>r.closeSyncedAt&&!r.syncError));assert.equal(await page.locator('[data-water-id]').count(),0);assert.equal(await panel.locator('b').count(),0);assert.deepEqual(errors,[]);
  console.log('PASS elapsed minutes/hours/days/unknown and fallback flow/names with literal parameters;403 and malformed close remain pending; held/lost actual response and identical replay; two typed water reminders each open/close exactly once');
  completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(deadline);for(const release of releases)release();if(browser)await browser.close();await prisma.$disconnect();});
