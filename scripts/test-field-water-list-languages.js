'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  "title": [
    "Agua aberta",
    "Running water",
    "Eau ouverte",
    "Agua abierta",
    "Wasser läuft"
  ],
  "chip": [
    "Água aberta",
    "Running water",
    "Eau ouverte",
    "Agua abierta",
    "Wasser läuft"
  ],
  "hint": [
    "alarme obrigatorio",
    "mandatory alarm",
    "alarme obligatoire",
    "alarma obligatoria",
    "Alarm erforderlich"
  ],
  "intro": [
    "Defina tempo ou hora para fechar e evitar esquecimentos.",
    "Set a delay or closing time so you do not forget.",
    "Définissez un délai ou une heure de fermeture pour éviter les oublis.",
    "Indique un plazo o una hora de cierre para no olvidarse.",
    "Legen Sie eine Frist oder Uhrzeit zum Schließen fest, damit Sie es nicht vergessen."
  ],
  "minutesPlaceholder": [
    "Minutos. Ex: 25",
    "Minutes. E.g. 25",
    "Minutes. Ex. : 25",
    "Minutos. Ej.: 25",
    "Minuten. Z. B. 25"
  ],
  "timeLabel": [
    "Hora para fechar a água",
    "Time to turn off the water",
    "Heure de fermeture de l’eau",
    "Hora para cerrar el agua",
    "Uhrzeit zum Abstellen des Wassers"
  ],
  "notePlaceholder": [
    "Nota opcional",
    "Optional note",
    "Note facultative",
    "Nota opcional",
    "Optionale Notiz"
  ],
  "open": [
    "Marcar água aberta",
    "Record running water",
    "Enregistrer l’ouverture de l’eau",
    "Registrar agua abierta",
    "Laufendes Wasser erfassen"
  ],
  "empty": [
    "Sem lembretes de agua aberta.",
    "No running-water reminders.",
    "Aucun rappel d’eau ouverte.",
    "No hay recordatorios de agua abierta.",
    "Keine Erinnerungen an laufendes Wasser."
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
  "location": [
    "Localizacao por confirmar",
    "Location unconfirmed",
    "Emplacement à confirmer",
    "Ubicación por confirmar",
    "Standort unbestätigt"
  ],
  "note": [
    "Sem nota adicional",
    "No additional note",
    "Aucune note supplémentaire",
    "Sin nota adicional",
    "Keine weitere Notiz"
  ],
  "place": [
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}",
    "{client} - {location}"
  ],
  "pending": [
    "Por confirmar",
    "Unconfirmed",
    "À confirmer",
    "Por confirmar",
    "Unbestätigt"
  ],
  "recorded": [
    "Registado",
    "Recorded",
    "Enregistré",
    "Registrado",
    "Erfasst"
  ],
  "syncing": [
    "A sincronizar",
    "Synchronizing",
    "Synchronisation",
    "Sincronizando",
    "Synchronisierung"
  ],
  "closing": [
    "Fecho por enviar",
    "Closure awaiting upload",
    "Fermeture à envoyer",
    "Cierre pendiente de envío",
    "Schließen noch zu übermitteln"
  ],
  "alarm": [
    "ALARME",
    "ALARM",
    "ALARME",
    "ALARMA",
    "ALARM"
  ],
  "opened": [
    "Aberta",
    "Open",
    "Ouverte",
    "Abierta",
    "Offen"
  ],
  "close": [
    "Agua fechada",
    "Water turned off",
    "Eau fermée",
    "Agua cerrada",
    "Wasser abgestellt"
  ],
  "alert": [
    "Alertar equipa",
    "Alert the team",
    "Alerter l’équipe",
    "Avisar al equipo",
    "Team alarmieren"
  ],
  "unknownTime": [
    "Hora por confirmar",
    "Time unconfirmed",
    "Heure à confirmer",
    "Hora por confirmar",
    "Uhrzeit unbestätigt"
  ],
  "closedLabel": [
    "Torneira fechada; confirmação no servidor pendente",
    "Tap closed; server confirmation pending",
    "Robinet fermé ; confirmation du serveur en attente",
    "Grifo cerrado; confirmación del servidor pendiente",
    "Wasserhahn geschlossen; Serverbestätigung ausstehend"
  ],
  "overdueLabel": [
    "Água por confirmar - previsto {when}",
    "Water status unconfirmed - due {when}",
    "État de l’eau à confirmer - prévu {when}",
    "Agua por confirmar - previsto {when}",
    "Wasserstatus unbestätigt - vorgesehen {when}"
  ],
  "lateLabel": [
    "Atrasado desde {when}",
    "Overdue since {when}",
    "En retard depuis {when}",
    "Atrasado desde {when}",
    "Überfällig seit {when}"
  ],
  "dueLabel": [
    "Lembrar em {when}",
    "Reminder at {when}",
    "Rappel à {when}",
    "Recordar a las {when}",
    "Erinnerung um {when}"
  ],
  "alarmHeader": [
    "ALARME: agua aberta por fechar.",
    "ALARM: running water must be turned off.",
    "ALARME : l’eau ouverte doit être fermée.",
    "ALARMA: hay agua abierta por cerrar.",
    "ALARM: Laufendes Wasser muss abgestellt werden."
  ],
  "alarmPool": [
    "Piscina: {name}",
    "Pool: {name}",
    "Piscine : {name}",
    "Piscina: {name}",
    "Pool: {name}"
  ],
  "alarmClient": [
    "Cliente: {name}",
    "Client: {name}",
    "Client : {name}",
    "Cliente: {name}",
    "Kunde: {name}"
  ],
  "alarmNote": [
    "Nota: {note}",
    "Note: {note}",
    "Note : {note}",
    "Nota: {note}",
    "Notiz: {note}"
  ],
  "alarmAction": [
    "Verificar ou fechar imediatamente.",
    "Check or turn it off immediately.",
    "Vérifiez ou fermez immédiatement.",
    "Compruebe o cierre inmediatamente.",
    "Sofort prüfen oder abstellen."
  ],
  "alarmMessage": [
    "{header}{pool}{client}{note}\n{action}",
    "{header}{pool}{client}{note}\n{action}",
    "{header}{pool}{client}{note}\n{action}",
    "{header}{pool}{client}{note}\n{action}",
    "{header}{pool}{client}{note}\n{action}"
  ],
  "alarmLine": [
    "\n{text}",
    "\n{text}",
    "\n{text}",
    "\n{text}",
    "\n{text}"
  ],
  "alarmSaved": [
    "ALARME: verificar água aberta. A confirmar no servidor.",
    "ALARM: check the running water. Awaiting server confirmation.",
    "ALARME : vérifiez l’eau ouverte. En attente de confirmation du serveur.",
    "ALARMA: compruebe el agua abierta. Pendiente de confirmación del servidor.",
    "ALARM: Laufendes Wasser prüfen. Serverbestätigung ausstehend."
  ],
  "exceptionTitle": [
    "P0 - Agua aberta",
    "P0 - Running water",
    "P0 - Eau ouverte",
    "P0 - Agua abierta",
    "P0 - Wasser läuft"
  ]
};
let browser, completed = false; const releases = [];
const deadline = setTimeout(() => { console.error('Water list language scenario did not finish'); process.exit(1); }, 90000);
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
    const timeout = setTimeout; window.qaWaterAlarmTimers = []; window.setTimeout = (fn, delay, ...args) => { if (String(fn).includes('escalateWaterReminder')) { qaWaterAlarmTimers.push(fn); return 0; } if (delay === 3300) return 0; return timeout(fn, delay, ...args); };
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
  const text = (key,index,params={}) => words[key][index].replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??''));
  const helperUnreadable=['Lembretes ilegíveis. Preserve os dados deste telemóvel e contacte o escritório.','Unreadable reminders. Keep the data on this phone and contact the office.','Rappels illisibles. Conservez les données de ce téléphone et contactez le bureau.','Recordatorios ilegibles. Conserve los datos de este teléfono y contacte con la oficina.','Unlesbare Erinnerungen. Bewahren Sie die Daten auf diesem Telefon auf und kontaktieren Sie das Büro.'];
  const helperInvalid=['Lembretes inválidos. Preserve os dados deste telemóvel e contacte o escritório.','Invalid reminders. Keep the data on this phone and contact the office.','Rappels invalides. Conservez les données de ce téléphone et contactez le bureau.','Recordatorios no válidos. Conserve los datos de este teléfono y contacte con la oficina.','Ungültige Erinnerungen. Bewahren Sie die Daten auf diesem Telefon auf und kontaktieren Sie das Büro.'];
  const state=()=>page.evaluate(()=>({focus:document.activeElement.id,selection:[document.activeElement.selectionStart,document.activeElement.selectionEnd],note:document.getElementById('waterNote').value,flow:document.getElementById('waterFlowState').value,calls:{...qaPumpCalls},popupCalls:qaWaterPopupCalls,context:CWFieldVisitContext(),token:localStorage.getItem('token'),alternateToken:localStorage.getItem('cristalwater_jwt'),data:Object.keys(localStorage).filter(k=>k.startsWith('cwField')||k.startsWith('cwWater')||k.startsWith('cwPump')||k.startsWith('cw:tech')).sort().map(k=>[k,localStorage.getItem(k)])}));
  function popupMessage(row,index){return [words.alarmHeader[index],row.poolName?text('alarmPool',index,{name:row.poolName}):'',row.clientName?text('alarmClient',index,{name:row.clientName}):'',row.note?text('alarmNote',index,{note:row.note}):'',words.alarmAction[index]].filter(Boolean).join('\n');}
  async function matrix({display=[],failure=null,toast=null,popup=null}={}){
    await settle();await page.locator('#waterNote').focus();await page.evaluate(()=>{window.qaWaterListNodes=Array.from(document.querySelectorAll('.water-card,.water-card *,#interruptList [data-exception-category=WATER_OPEN],#interruptList [data-exception-category=WATER_OPEN] *,#toast,.cw-ui-toast'));});
    const before=await state(),stored=await raw(),db=await database(),count=requests.length;
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const [index,lang] of languages.entries()){
      await locale(lang);await settle();assert.equal(await panel.locator('.field-tab-title h2').textContent(),words.title[index]);assert.equal(await panel.locator('.field-tab-title span').textContent(),words.hint[index]);assert.equal(await page.locator('#openWaterBtn').textContent(),words.open[index]);assert.equal(await page.locator('#waterMinutes').getAttribute('placeholder'),words.minutesPlaceholder[index]);assert.equal(await page.locator('#waterCloseTime').getAttribute('aria-label'),words.timeLabel[index]);
      if(failure!==null)assert.equal(await page.locator('#waterReminderList').textContent(),Array.isArray(failure)?failure[index]:failure);else if(!display.length)assert.equal(await page.locator('#waterReminderList').textContent(),words.empty[index]);
      for(const row of display){const n=page.locator(`[data-water-id="${row.localId}"]`),overdue=row.status==='OVERDUE'||Date.parse(row.dueAt)<=Date.now();for(const [part,expected] of Object.entries({pool:row.poolName||words.pool[index],place:text('place',index,{client:row.clientName||words.client[index],location:row.location||words.location[index]}),note:row.note||words.note[index],status:words[row.status==='CLOSED'?'closing':overdue?'alarm':'opened'][index],sync:words[row.syncError?'pending':row.serverId?'recorded':'syncing'][index],close:words.close[index],alert:words.alert[index]}))assert.equal(await n.locator(`[data-water-list-text=${part}]`).textContent(),expected);
        if(row.syncError)assert.equal(await n.locator('.water-line > div:first-child > .muted').last().textContent(),' '+row.syncError);
        assert.equal(await n.locator('.water-actions').evaluate(x=>x.style.display==='none'),row.status==='CLOSED');
        const item=page.locator(`[data-exception-category="WATER_OPEN"][data-exception-id="water-open:${row.visitType}:${row.localId}"]`);assert.equal(await item.count(),row.status==='CLOSED'?0:1);if(row.status!=='CLOSED'){assert.equal(await item.locator(':scope > strong').textContent(),words.exceptionTitle[index]);const detail=await item.locator(':scope > strong + div').textContent();assert(detail.includes(row.poolName||(['Piscina','Pool','Piscine','Piscina','Pool'][index])));assert(detail.includes(['Água aberta há','Water has been running for','L’eau coule depuis','Agua abierta desde hace','Wasser läuft seit'][index]));}
      }
      if(toast)assert.equal(await page.locator('#toast').textContent(),Array.isArray(toast)?toast[index]:words[toast][index]);if(popup)assert.equal(await page.locator('.cw-ui-toast-error').textContent(),popupMessage(popup,index));
      assert.equal(await raw(),stored);assert.deepEqual(await state(),before);assert.deepEqual(await database(),db);assert(await page.evaluate(()=>qaWaterListNodes.every(n=>n.isConnected)));assert(await panel.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'water list fits');
    }}
    for(const r of requests.slice(count)){assert.equal(r.path,'/api/settings/language/me');assert.equal(r.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']);}
  }
  const selectExtra=async()=>{await page.locator('[data-field-tab-button=hoje]').click();await page.locator('[data-pool-filter=TODO]').click();await page.locator('#visitList [data-visit-index]').filter({hasText:extraPool.name}).click();await page.waitForFunction(()=>CWFieldVisitContext()?.visitType==='EXTRA');await page.locator('[data-field-tab-button=more]').click();await settle();};
  await page.goto(base+`/technician-field-mode?selectedVisitId=${id}&selectedVisitType=REGULAR`,{waitUntil:'networkidle'});await page.waitForFunction(id=>CWFieldVisitContext()?.id===id,id);await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.locator('[data-field-tab-button=more]').click();await locale('en');await settle();assert.equal(await page.locator('#openWaterBtn').textContent(),words.open[1]);
  await page.evaluate(()=>{window.qaWaterPopupCalls=0;const original=CwUi.error;CwUi.error=(message)=>{qaWaterPopupCalls++;return original(message);};});await instrument();await page.locator('#waterNote').fill('Unsubmitted <b>{when}</b>');await matrix();await context.setOffline(true);
  for(const [data,expected] of [['{broken',helperUnreadable],['[]',helperInvalid]]){await page.evaluate(({key,data})=>{localStorage.setItem(key,data);window.dispatchEvent(new Event('cw:water-state-updated'));},{key,data});await matrix({failure:expected});assert.equal(await raw(),data);}
  await page.evaluate(key=>{localStorage.removeItem(key);window.qaWaterList=CWFieldReminders.list;CWFieldReminders.list=kind=>{if(kind==='WATER_OPEN'){const e=Error('Lembretes ilegíveis. Preserve os dados deste telemóvel e contacte o escritório.');e.copy={key:'unreadable'};throw e;}return qaWaterList(kind);};window.dispatchEvent(new Event('cw:water-state-updated'));},key);await matrix({failure:helperUnreadable[0]});assert.equal(await raw(),null);
  await page.evaluate(()=>{CWFieldReminders.list=qaWaterList;window.dispatchEvent(new Event('cw:water-state-updated'));});await matrix();
  await page.locator('#waterFlowState').selectOption('HALF');await page.locator('#waterNote').fill('Aberta');await page.locator('#openWaterBtn').click();await page.waitForFunction(key=>Object.keys(JSON.parse(localStorage.getItem(key)||'{}')).length===1,key);await settle();let regular=(await rows())[0];assert.equal(regular.visitType,'REGULAR');assert.equal(regular.note,'Aberta');await matrix({display:await rows()});
  // Invoke the actual scheduled callback; only long reminder timers are isolated, not session guards.
  await page.evaluate(()=>{const callback=qaWaterAlarmTimers.at(-1);if(!callback)throw Error('Scheduled water alarm missing');return callback();});await page.waitForFunction(key=>Object.values(JSON.parse(localStorage.getItem(key)))[0].status==='OVERDUE',key);await page.locator('.cw-ui-toast-error').waitFor();await settle();regular=(await rows())[0];assert.equal(await page.evaluate(()=>qaWaterPopupCalls),1);await matrix({display:await rows(),toast:'alarmSaved',popup:regular});
  await page.evaluate(()=>document.querySelector('.cw-ui-toast-error').remove());assert.equal(await page.evaluate(()=>qaWaterPopupCalls),1);
  await selectExtra();await page.locator('#waterFlowState').selectOption('DRIP');await page.locator('#waterNote').fill('Extra <b>{when}</b>');await page.locator('#openWaterBtn').click();await page.waitForFunction(key=>Object.keys(JSON.parse(localStorage.getItem(key))).length===2,key);await settle();let extra=(await rows()).find(x=>x.visitType==='EXTRA');assert(extra);assert.equal(extra.visitId,regular.visitId);assert.notEqual(extra.poolId,regular.poolId);assert.notEqual(extra.localId,regular.localId);
  await page.locator(`[data-water-alarm="${extra.localId}"]`).click();await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key))['WATER_OPEN:'+id].status==='OVERDUE',{key,id:extra.localId});await matrix({display:await rows(),toast:'alarmSaved'});assert.equal(await page.evaluate(()=>qaWaterPopupCalls),1);
  const original=await raw();await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>CWFieldReminders&&CWWaterReminders&&CWFieldVisitContext());await page.locator('[data-field-tab-button=more]').click();await page.evaluate(()=>{window.qaWaterPopupCalls=0;});await instrument();await settle();assert.equal(await raw(),original);await matrix({display:await rows()});
  // Read-only fallback/badge fixtures; restore exact bytes before returning to the server.
  for(const delivered of [false,true]){const sample=JSON.parse(original),row=sample['WATER_OPEN:'+extra.localId];row.poolName='';row.clientName='';row.location='';row.note='';row.syncError='';if(delivered)row.serverId=999999;else delete row.serverId;row.status='OPEN';await page.evaluate(({key,sample})=>{localStorage.setItem(key,sample);window.dispatchEvent(new Event('cw:water-state-updated'));},{key,sample:JSON.stringify(sample)});await matrix({display:await rows()});}
  await page.evaluate(({key,original})=>{localStorage.setItem(key,original);window.dispatchEvent(new Event('cw:water-state-updated'));},{key,original});await settle();assert.equal(await raw(),original);
  for(const lang of languages){await locale(lang);const before=await raw(),dialog=page.waitForEvent('dialog'),click=page.locator(`[data-water-close="${regular.localId}"]`).click();await(await dialog).dismiss();await click;assert.equal(await raw(),before);}
  await locale('de');const dialogEvent=page.waitForEvent('dialog'),closing=page.locator(`[data-water-close="${regular.localId}"]`).click();await(await dialogEvent).accept();await closing;await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key))['WATER_OPEN:'+id].status==='CLOSED',{key,id:regular.localId});await matrix({display:await rows()});
  if(process.env.CW_WATER_LIST_CAPTURE){await page.setViewportSize({width:320,height:900});await locale('de');await panel.screenshot({path:process.env.CW_WATER_LIST_CAPTURE});}
  console.log('PASS water labels/status/badges/fallbacks/errors in five languages at320/390/1440; same nodes/focus/selection/values/typed identity/bytes/SQL and no producer reads; owned errors versus forged/raw copy; real scheduled popup updates once, manual alarm, cache and cancellation');
  let mode='deny',release,entered;const gate=new Promise(r=>{release=r;releases.push(r);}),started=new Promise(r=>{entered=r;});const posts=[];
  await page.route(base+endpoint+'**',async route=>{const r=route.request();if(r.method()==='GET')return route.fulfill({json:{ok:true,reminders:[]}});const body=r.postDataJSON();posts.push({path:new URL(r.url()).pathname,body,authorization:r.headers().authorization});if(mode==='deny')return route.fulfill({status:403,json:{error:'Por confirmar'}});const response=await route.fetch();assert.equal(response.status(),200);if(mode==='lose'&&body.localId===extra.localId){entered();await gate;return route.abort('connectionfailed');}if(mode==='badClose'&&r.url().endsWith('/close')){const data=await response.json();return route.fulfill({json:{...data,reminder:{...data.reminder,isCompleted:false}}});}return route.fulfill({response});});
  await context.setOffline(false);await page.evaluate(()=>CWFieldReminders.sync());await settle();assert((await rows()).every(x=>x.syncError==='Por confirmar'));assert.equal((await database()).reminders.length,0);await matrix({display:await rows()});
  mode='lose';const sending=page.evaluate(()=>CWFieldReminders.sync());await started;await settle();const held=await raw();await matrix({display:(await rows()).filter(x=>!x.closeSyncedAt)});assert.equal(await raw(),held);assert.equal((await database()).reminders.length,2);release();await sending;assert(!(await rows()).find(x=>x.localId===extra.localId).serverId);
  mode='accept';await page.evaluate(()=>CWFieldReminders.sync());await settle();const retry=posts.filter(p=>p.path===endpoint&&p.body.localId===extra.localId);assert(retry.length>=3);assert(retry.every(p=>JSON.stringify(p)===JSON.stringify(retry[0])));assert.equal(retry[0].authorization,'Bearer '+token);assert.equal(retry[0].body.visitType,'EXTRA');assert.equal(retry[0].body.poolId,extraPool.id);await matrix({display:(await rows()).filter(x=>!x.closeSyncedAt)});
  await context.setOffline(true);const extraDialog=page.waitForEvent('dialog'),extraClose=page.locator(`[data-water-close="${extra.localId}"]`).click();await(await extraDialog).accept();await extraClose;await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key))['WATER_OPEN:'+id].status==='CLOSED',{key,id:extra.localId});await matrix({display:(await rows()).filter(x=>!x.closeSyncedAt)});
  mode='badClose';await context.setOffline(false);await page.evaluate(()=>CWFieldReminders.sync());await settle();assert(!(await rows()).find(x=>x.localId===extra.localId).closeSyncedAt);await matrix({display:(await rows()).filter(x=>!x.closeSyncedAt)});mode='accept';await page.evaluate(()=>CWFieldReminders.sync());await settle();await matrix();
  const db=await database();assert.equal(db.reminders.length,2);assert(db.reminders.every(x=>x.isCompleted));assert.equal(db.history.filter(x=>x.type==='WATER_OPEN'&&x.message==='OPEN').length,2);assert.equal(db.history.filter(x=>x.type==='WATER_OPEN'&&x.message==='CLOSED').length,2);assert.equal(db.history.filter(x=>x.type==='WATER_OPEN'&&x.message==='OVERDUE').length,1);assert((await rows()).every(x=>x.closeSyncedAt&&!x.syncError));assert.equal(await panel.locator('b').count(),0);assert.deepEqual(errors,[]);
  console.log('PASS strict typed exception titles/details,403 literal server text, actual held/lost response and identical retry, single server escalation, malformed close rejected and physical offline closure; two SQL reminders each open/close once');
  completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(deadline);for(const release of releases)release();if(browser)await browser.close();await prisma.$disconnect();});
