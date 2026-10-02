'use strict';
require('../src/loadEnv')();
const assert=require('node:assert/strict'),jwt=require('jsonwebtoken'),{chromium}=require('playwright');
const {prisma}=require('../src/prismaClient'),{getJwtSecret}=require('../src/utils/jwtSecret');
if(process.env.NODE_ENV!=='test'||process.env.QA_MODE!=='true'||process.env.QA_ENVIRONMENT_SAFE!=='true')throw Error('Isolated QA required');
const base=process.env.CW_BASE_URL||'http://127.0.0.1:3002';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const languages=['pt','en','fr','es','de'];
const words={
  "sourcePumpTitle": [
    "P0 - Bomba em manual",
    "P0 - Pump in manual mode",
    "P0 - Pompe en mode manuel",
    "P0 - Bomba en modo manual",
    "P0 - Pumpe im Handbetrieb"
  ],
  "sourcePumpSignal": [
    "Quem ativou: {who} | Piscina: {pool} | Duração: {duration} | Estado: {status}",
    "Activated by: {who} | Pool: {pool} | Duration: {duration} | Status: {status}",
    "Activée par : {who} | Piscine : {pool} | Durée : {duration} | État : {status}",
    "Activó: {who} | Piscina: {pool} | Duración: {duration} | Estado: {status}",
    "Aktiviert von: {who} | Pool: {pool} | Dauer: {duration} | Status: {status}"
  ],
  "sourceActivatorUnknown": [
    "por confirmar",
    "to be confirmed",
    "à confirmer",
    "por confirmar",
    "noch zu bestätigen"
  ],
  "sourcePoolUnknown": [
    "Piscina por confirmar",
    "Pool to be confirmed",
    "Piscine à confirmer",
    "Piscina por confirmar",
    "Pool noch zu bestätigen"
  ],
  "sourcePumpReminder": [
    "{pool} | {client} | Confirmar modo automático até {when}",
    "{pool} | {client} | Confirm automatic mode by {when}",
    "{pool} | {client} | Confirmer le mode automatique avant {when}",
    "{pool} | {client} | Confirmar el modo automático antes de {when}",
    "{pool} | {client} | Automatikbetrieb bis {when} bestätigen"
  ],
  "sourcePool": [
    "Piscina",
    "Pool",
    "Piscine",
    "Piscina",
    "Pool"
  ],
  "sourceClient": [
    "Cliente",
    "Client",
    "Client",
    "Cliente",
    "Kunde"
  ],
  "sourceUnavailableTitle": [
    "P0 - Água e bombas por confirmar",
    "P0 - Water and pumps need confirmation",
    "P0 - Eau et pompes à confirmer",
    "P0 - Agua y bombas por confirmar",
    "P0 - Wasser und Pumpen noch zu bestätigen"
  ],
  "sourceCriticalTitle": [
    "P0 - Problema critico",
    "P0 - Critical problem",
    "P0 - Problème critique",
    "P0 - Problema crítico",
    "P0 - Kritisches Problem"
  ],
  "sourceCriticalDetail": [
    "{count} problema(s) critico(s) pendente(s).",
    "{count} critical problem(s) pending.",
    "{count} problème(s) critique(s) en attente.",
    "{count} problema(s) crítico(s) pendiente(s).",
    "{count} kritische Probleme ausstehend."
  ],
  "sourceDelayedTitle": [
    "P1 - Visita atrasada",
    "P1 - Delayed visit",
    "P1 - Visite en retard",
    "P1 - Visita atrasada",
    "P1 - Verspäteter Besuch"
  ],
  "sourceDelayedDetail": [
    "{pool} com atraso face ao planeado.",
    "{pool} is behind schedule.",
    "{pool} est en retard sur le planning.",
    "{pool} lleva retraso respecto a lo previsto.",
    "{pool} liegt hinter dem Zeitplan."
  ],
  "sourceDocsTitle": [
    "P1 - Documento obrigatorio em falta",
    "P1 - Required document missing",
    "P1 - Document obligatoire manquant",
    "P1 - Falta un documento obligatorio",
    "P1 - Erforderliches Dokument fehlt"
  ],
  "sourceDocsFallback": [
    "Documentacao da viatura incompleta para operacao segura.",
    "Vehicle documentation is incomplete for safe operation.",
    "Les documents du véhicule sont incomplets pour une utilisation sûre.",
    "La documentación del vehículo está incompleta para operar con seguridad.",
    "Die Fahrzeugunterlagen sind für einen sicheren Betrieb unvollständig."
  ],
  "sourceDocsReason": [
    "Bloqueio documental - {blockers}",
    "Document restriction - {blockers}",
    "Blocage documentaire - {blockers}",
    "Bloqueo documental - {blockers}",
    "Dokumentensperre - {blockers}"
  ],
  "sourceDocBlocker": [
    "{name}: {state}",
    "{name}: {state}",
    "{name} : {state}",
    "{name}: {state}",
    "{name}: {state}"
  ],
  "sourceDocTransport": [
    "Guia AT",
    "AT transport document",
    "Document de transport AT",
    "Documento de transporte AT",
    "AT-Transportdokument"
  ],
  "sourceDocWork": [
    "Guia de obra",
    "Work document",
    "Document de travail",
    "Documento de trabajo",
    "Arbeitsdokument"
  ],
  "sourceDocInsurance": [
    "Seguro",
    "Insurance",
    "Assurance",
    "Seguro",
    "Versicherung"
  ],
  "sourceDocInspection": [
    "Inspeção",
    "Inspection",
    "Contrôle technique",
    "Inspección",
    "Fahrzeugprüfung"
  ],
  "sourceDocUnavailable": [
    "Indisponível",
    "Unavailable",
    "Indisponible",
    "No disponible",
    "Nicht verfügbar"
  ],
  "sourceDocExpired": [
    "Expirado",
    "Expired",
    "Expiré",
    "Caducado",
    "Abgelaufen"
  ],
  "sourceDocPending": [
    "Pendente",
    "Pending",
    "En attente",
    "Pendiente",
    "Ausstehend"
  ],
  "sourceDocValid": [
    "Válido",
    "Valid",
    "Valide",
    "Válido",
    "Gültig"
  ],
  "sourceDocConfirm": [
    "Documentos por confirmar para a sessão, viatura e dia atuais",
    "Documents need confirmation for the current session, vehicle and day",
    "Documents à confirmer pour la session, le véhicule et le jour actuels",
    "Documentos por confirmar para la sesión, el vehículo y el día actuales",
    "Dokumente für die aktuelle Sitzung, das Fahrzeug und den Tag noch zu bestätigen"
  ],
  "sourceDocMismatch": [
    "As guias AT e de obra não correspondem. Atualize os documentos.",
    "The AT transport and work documents do not match. Refresh the documents.",
    "Les documents de transport AT et de travail ne correspondent pas. Actualisez les documents.",
    "Los documentos de transporte AT y de trabajo no coinciden. Actualice los documentos.",
    "AT-Transportdokument und Arbeitsdokument stimmen nicht überein. Aktualisieren Sie die Dokumente."
  ]
};
let browser,completed=false;
const deadline=setTimeout(()=>{console.error('Alert source language scenario did not finish');process.exit(1);},105000);
process.on('exit',code=>{if(!code&&!completed)process.exitCode=1;});
(async()=>{
 // Keep the delayed visit on today's Lisbon business day, even just after midnight.
 const fixtureTime=new Date();fixtureTime.setHours(12,0,0,0);const now=fixtureTime.getTime();
 const vehicle=await prisma.vehicle.create({data:{plate:'QA-SOURCE-'+Date.now(),active:true}});
 const tech=await prisma.technician.create({data:{name:'Sistema',active:true,vehicleId:vehicle.id}});
 const client=await prisma.client.create({data:{name:'Cliente',active:true}});
 const regularPool=await prisma.pool.create({data:{name:'Piscina',clientId:client.id,active:true}}),extraPool=await prisma.pool.create({data:{name:'Extra <b>{pool}</b>',clientId:client.id,active:true}});
 const max=await Promise.all([prisma.serviceVisit.aggregate({_max:{id:true}}),prisma.extraVisit.aggregate({_max:{id:true}})]),id=Math.max(...max.map(x=>x._max.id||0))+1,planned=new Date(now-45*60000),common={id,clientId:client.id,technicianId:tech.id,status:'PLANNED'};
 await prisma.serviceVisit.create({data:{...common,poolId:regularPool.id,date:planned,plannedDate:planned}});await prisma.extraVisit.create({data:{...common,poolId:extraPool.id,scheduledAt:planned}});
 for(const table of ['ServiceVisit','ExtraVisit'])await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
 const token=jwt.sign({id:tech.id,role:'TECHNICIAN',iat:Math.floor(now/1000)},getJwtSecret(),{expiresIn:'1h'});
 const initialDraft={v:2,owner:'TECH:'+tech.id,drafts:{['visit-REGULAR-'+id]:{values:{notes:'Literal <b>{who}</b>'},checks:{},pendingProblems:[{severity:'Urgente',visitId:id,message:'Original <b>{count}</b>',createdAt:planned.toISOString()},{severity:'URGENTE',visitId:id,message:'Segunda ocorrência',createdAt:planned.toISOString()},{severity:'Normal',visitId:id,message:'Not critical',createdAt:planned.toISOString()}]}}};
 browser=await chromium.launch({headless:true,executablePath:process.env.CW_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Europe/Lisbon'});await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await context.addInitScript(({token,tech,vehicle,initialDraft,origin})=>{
  if(top!==window||location.origin!==origin)return;
  if(!localStorage.getItem('qaAlertSource')){for(const k of ['token','cristalwater_jwt'])localStorage.setItem(k,token);for(const k of ['user','cristalwater_user'])localStorage.setItem(k,JSON.stringify({id:tech.id,name:tech.name,role:'TECHNICIAN'}));localStorage.setItem('cwVehicleId',String(vehicle.id));localStorage.setItem('cwFieldVisitDrafts:v2:TECH:'+tech.id,JSON.stringify(initialDraft));localStorage.setItem('qaAlertSource','1');}
  const interval=setInterval;window.setInterval=(fn,delay,...args)=>[15000,30000,60000].includes(delay)?0:interval(fn,delay,...args);
  Object.defineProperty(navigator,'geolocation',{value:{watchPosition:()=>1,clearWatch(){}}});
 },{token,tech,vehicle,initialDraft,origin:base});
 const page=await context.newPage(),errors=[],requests=[];await page.clock.setFixedTime(now);page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))requests.push({path,method:r.method(),body:r.postData(),authorization:r.headers().authorization});});
 const locale=async lang=>{await page.locator('#cwLanguageSelect').selectOption(lang);await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);};
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const text=(key,i,params={})=>words[key][i].replace(/\{(\w+)\}/g,(_,key)=>String(params[key]??''));
 const open=async()=>{await page.goto(base+`/technician-field-mode?selectedVisitId=${id}&selectedVisitType=REGULAR`,{waitUntil:'domcontentloaded'});await page.waitForFunction(id=>CWFieldVisitContext()?.id===id,id);await page.locator('[data-field-tab-button=hoje]').click();await page.locator('#interruptList [data-exception-category=VISIT_DELAYED]').waitFor();await page.locator('#interruptList [data-exception-category=DOC_MISSING]').waitFor();await settle();};
 const reminderKey='cwFieldReminders:v1:TECH:'+tech.id,raw=()=>page.evaluate(key=>localStorage.getItem(key),reminderKey),reminders=async()=>Object.values(JSON.parse(await raw()||'{}'));
 const database=()=>Promise.all([prisma.operationalReminder.findMany({where:{assignedToTechnicianId:tech.id},orderBy:{id:'asc'}}),prisma.technicalHistory.findMany({where:{poolId:{in:[regularPool.id,extraPool.id]}},orderBy:{id:'asc'}}),prisma.serviceVisit.findUnique({where:{id}}),prisma.extraVisit.findUnique({where:{id}})]);
 const instrument=()=>page.evaluate(()=>{window.qaSourceCalls={};window.qaSourceGuardCalls=0;const same=CWFieldDocuments.same;CWFieldDocuments.same=(...args)=>{qaSourceGuardCalls++;return same(...args);};for(const [group,api,names]of [['reminder',CWFieldReminders,['list','create','mark','sync','context','legacyWarning']],['journal',CWFieldAlertJournal,['scope','read','record','states','legacyWarning']],['docs',CWFieldDocuments,['load','scope']],['route',CWFieldRouteCache,['scope','read','save','update']]])for(const name of names){const fn=api[name];api[name]=(...args)=>{const key=group+':'+name;qaSourceCalls[key]=(qaSourceCalls[key]||0)+1;return fn(...args);};}});
 const state=()=>page.evaluate(()=>({focus:document.activeElement.id,tab:document.activeElement.dataset.fieldTabButton,note:document.querySelector('#waterNote').value,notes:document.querySelector('#notes').value,visit:CWFieldVisitContext(),calls:{...qaSourceCalls},tokens:['token','cristalwater_jwt'].map(k=>localStorage.getItem(k)),stored:Object.keys(localStorage).filter(k=>k.startsWith('cwField')||k.startsWith('cwWater')||k.startsWith('cwPump')||k.startsWith('cw:tech')).sort().map(k=>[k,localStorage.getItem(k)])}));
 const helperUnreadable=['Lembretes ilegíveis. Preserve os dados deste telemóvel e contacte o escritório.','Unreadable reminders. Keep the data on this phone and contact the office.','Rappels illisibles. Conservez les données de ce téléphone et contactez le bureau.','Recordatorios ilegibles. Conserve los datos de este teléfono y contacte con la oficina.','Unlesbare Erinnerungen. Bewahren Sie die Daten auf diesem Telefon auf und kontaktieren Sie das Büro.'];
 async function matrix({critical=2,pool=regularPool.name,pumps=[],signal=null,unavailable=null}={}){
  await settle();await page.locator('[data-field-tab-button=hoje]').focus();
  const dates=await page.evaluate(rows=>Object.fromEntries(rows.map(row=>[row.localId,new Date(row.dueAt).toLocaleString('pt-PT',{dateStyle:'short',timeStyle:'short'})])),pumps);
  await page.evaluate(()=>{window.qaSourceNodes=Array.from(document.querySelectorAll('#interruptCard,#interruptCard *,#fieldAlertHistoryList,#fieldAlertHistoryList *'));});
  const before=await state(),db=await database(),start=requests.length;
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const [i,lang]of languages.entries()){
   await locale(lang);await settle();
   const delayed=page.locator('#interruptList [data-exception-category=VISIT_DELAYED]');assert.equal(await delayed.count(),1);assert.equal(await delayed.locator(':scope > strong').textContent(),words.sourceDelayedTitle[i]);assert.equal(await delayed.locator(':scope > strong + div').textContent(),text('sourceDelayedDetail',i,{pool:pool||words.sourcePool[i]}));
   const urgent=page.locator('#interruptList [data-exception-category=CRITICAL_PROBLEM]');assert.equal(await urgent.count(),critical?1:0);if(critical){assert.equal(await urgent.locator(':scope > strong').textContent(),words.sourceCriticalTitle[i]);assert.equal(await urgent.locator(':scope > strong + div').textContent(),text('sourceCriticalDetail',i,{count:critical}));}
   const docs=page.locator('#interruptList [data-exception-category=DOC_MISSING]');assert.equal(await docs.count(),1);assert.equal(await docs.locator(':scope > strong').textContent(),words.sourceDocsTitle[i]);const blockers=['Transport','Work','Insurance','Inspection'].map(name=>text('sourceDocBlocker',i,{name:words['sourceDoc'+name][i],state:words.sourceDocUnavailable[i]}));assert.equal(await docs.locator(':scope > strong + div').textContent(),text('sourceDocsReason',i,{blockers:blockers.join(' | ')}));
   const pumpNodes=page.locator('#interruptList [data-exception-category=PUMP_MANUAL]');assert.equal(await pumpNodes.count(),pumps.length+(signal?1:0));
   for(const row of pumps){const n=page.locator(`#interruptList [data-exception-category=PUMP_MANUAL][data-exception-id="pump-manual:${row.visitType}:${row.localId}"]`);assert.equal(await n.count(),1);assert.equal(await n.locator(':scope > strong').textContent(),words.sourcePumpTitle[i]);assert.equal(await n.locator(':scope > strong + div').textContent(),text('sourcePumpReminder',i,{pool:row.poolName||words.sourcePool[i],client:row.clientName||words.sourceClient[i],when:dates[row.localId]}));}
   if(signal){const n=pumpNodes.first();assert.equal(await n.locator(':scope > strong').textContent(),words.sourcePumpTitle[i]);assert.equal(await n.locator(':scope > strong + div').textContent(),text('sourcePumpSignal',i,{who:signal.who||words.sourceActivatorUnknown[i],pool:signal.pool||words.sourcePoolUnknown[i],duration:Array.isArray(signal.duration)?signal.duration[i]:signal.duration,status:'MANUAL'}));}
   const warning=page.locator('#interruptList [data-exception-category=REMINDER_UNAVAILABLE]');assert.equal(await warning.count(),unavailable?1:0);if(unavailable){assert.equal(await warning.locator(':scope > strong').textContent(),words.sourceUnavailableTitle[i]);assert.equal(await warning.locator(':scope > strong + div').textContent(),Array.isArray(unavailable)?unavailable[i]:unavailable);}
   assert.deepEqual(await state(),before);assert.deepEqual(await database(),db);assert(await page.evaluate(()=>qaSourceNodes.every(n=>n.isConnected)));assert(await page.locator('#interruptCard').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  }}
  for(const r of requests.slice(start)){assert.equal(r.path,'/api/settings/language/me');assert.equal(r.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']);}
 }
 await open();await locale('en');assert.equal(await page.locator('#interruptList [data-exception-category=VISIT_DELAYED] > strong').textContent(),words.sourceDelayedTitle[1]);
 await instrument();await matrix();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);
 await page.evaluate(key=>{localStorage.setItem(key,'{broken');window.dispatchEvent(new Event('cw:water-state-updated'));},reminderKey);await matrix({unavailable:helperUnreadable});assert.equal(await raw(),'{broken');
 await page.evaluate(key=>{try{CWFieldReminders.list('PUMP_MANUAL');}catch(error){window.qaOwnedReminderError=error;}window.qaSourceList=CWFieldReminders.list;localStorage.removeItem(key);CWFieldReminders.list=kind=>{if(kind==='PUMP_MANUAL')throw qaOwnedReminderError;return qaSourceList(kind);};window.dispatchEvent(new Event('cw:water-state-updated'));},reminderKey);
 await matrix({unavailable:helperUnreadable});
 assert.equal(await page.evaluate(()=>CWFieldReminders.presentation.format(CWFieldReminders.presentation.error(qaOwnedReminderError),'en')),helperUnreadable[1]);
 await page.evaluate(message=>{const external=Error(message);external.copy={key:'unreadable'};CWFieldReminders.list=kind=>{if(kind==='PUMP_MANUAL')throw external;return qaSourceList(kind);};window.dispatchEvent(new Event('cw:water-state-updated'));},helperUnreadable[0]);await matrix({unavailable:helperUnreadable[0]});
 await page.evaluate(()=>{CWFieldReminders.list=qaSourceList;window.dispatchEvent(new Event('cw:water-state-updated'));});await matrix();
 const routeKey=await page.evaluate(()=>CWFieldRouteCache.key(CWFieldRouteCache.scope())),routeRaw=await page.evaluate(key=>localStorage.getItem(key),routeKey);
 const journalKey=await page.evaluate(()=>CWFieldAlertJournal.key(CWFieldAlertJournal.scope()));
 const unavailableDuration=['duracao indisponivel','duration unavailable','durée indisponible','duración no disponible','Dauer nicht verfügbar'];
 for(const fallback of [false,true]){
  const sample=JSON.parse(routeRaw),row=sample.visits.find(v=>v.id===id&&v.visitType==='REGULAR');
  row.pool.equipment={pumpMode:'MANUAL',pumpManualAt:fallback?'not-a-date':new Date(now-65*60000).toISOString(),...(fallback?{}:{pumpManualBy:'pendente backend'})};if(fallback){row.pool.name='';delete row.pumpManualBy;delete row.manualBy;delete row.lastUpdatedBy;}
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:routeKey,value:JSON.stringify(sample)});await open();await instrument();await matrix({pool:row.pool.name,signal:{who:fallback?'':'pendente backend',pool:row.pool.name,duration:fallback?unavailableDuration:'1h 05m'}});
  const signalId=await page.locator('#interruptList [data-exception-category=PUMP_MANUAL]').getAttribute('data-exception-id');
  assert.equal(signalId,`pump-manual:visit-REGULAR-${id}:${row.pool.equipment.pumpManualAt}`);
  const history=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).entries, journalKey),signalEntry=history.find(e=>e.exceptionId===signalId);
  assert(signalEntry);assert.equal(signalEntry.title,words.sourcePumpTitle[0]);assert(signalEntry.detail.startsWith('Quem ativou: pendente backend | Piscina: '));
 }
 await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:routeKey,raw:routeRaw});await open();await instrument();assert.equal(await page.evaluate(key=>localStorage.getItem(key),routeKey),routeRaw);await matrix();
 console.log('PASS real critical/delayed/document alerts, original history, matching literal names, unavailable helper errors versus forged external errors and legacy pump signals/fallbacks across five languages at320/390/1440; original route bytes restored before actions');
 await page.locator('[data-field-tab-button=agora]').click();await page.locator('#pumpReminderMinutes').fill('30');await page.locator('#pumpReminderCreate').click();await page.waitForFunction(key=>Object.keys(JSON.parse(localStorage.getItem(key)||'{}')).length===1,reminderKey);await matrix({pumps:await reminders()});
 const regular=(await reminders())[0];assert.equal(regular.visitType,'REGULAR');
 await page.locator('[data-field-tab-button=hoje]').click();await page.locator('[data-pool-filter=TODO]').click();await page.locator('#visitList [data-visit-index]').filter({hasText:extraPool.name}).click();await page.waitForFunction(()=>CWFieldVisitContext()?.visitType==='EXTRA');await page.locator('[data-field-tab-button=agora]').click();await page.locator('#pumpReminderMinutes').fill('30');await page.locator('#pumpReminderCreate').click();await page.waitForFunction(key=>Object.keys(JSON.parse(localStorage.getItem(key))).length===2,reminderKey);
 const extra=(await reminders()).find(r=>r.visitType==='EXTRA');assert(extra);assert.equal(extra.visitId,regular.visitId);assert.notEqual(extra.poolId,regular.poolId);assert.notEqual(extra.localId,regular.localId);await matrix({critical:0,pool:extraPool.name,pumps:await reminders()});
 // Current row fallbacks are read-only display fixtures, never sent to the server.
 const actual=await raw(),sample=JSON.parse(actual);sample['PUMP_MANUAL:'+extra.localId].poolName='';sample['PUMP_MANUAL:'+extra.localId].clientName='';await page.evaluate(({key,data})=>{localStorage.setItem(key,data);window.dispatchEvent(new Event('cw:water-state-updated'));window.dispatchEvent(new Event('cw:reminders-updated'));},{key:reminderKey,data:JSON.stringify(sample)});await matrix({critical:0,pool:extraPool.name,pumps:await reminders()});await page.evaluate(({key,data})=>{localStorage.setItem(key,data);window.dispatchEvent(new Event('cw:water-state-updated'));window.dispatchEvent(new Event('cw:reminders-updated'));},{key:reminderKey,data:actual});assert.equal(await raw(),actual);
 const item=page.locator(`#interruptList [data-exception-category=PUMP_MANUAL][data-exception-id="pump-manual:REGULAR:${regular.localId}"]`);
 await item.locator('[data-interrupt-action=confirm]').evaluate(n=>n.click());await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).entries.some(e=>e.exceptionId===id&&e.action==='CONFIRMED'),{key:journalKey,id:'pump-manual:REGULAR:'+regular.localId});assert.equal((await reminders()).find(r=>r.localId===regular.localId).status,'OPEN');await matrix({critical:0,pool:extraPool.name,pumps:await reminders()});
 if(process.env.CW_ALERT_SOURCE_CAPTURE){await page.locator('[data-field-tab-button=hoje]').click();await locale('de');await page.setViewportSize({width:320,height:900});await page.locator('#interruptCard').screenshot({path:process.env.CW_ALERT_SOURCE_CAPTURE});}
 await context.setOffline(false);await page.evaluate(()=>CWFieldReminders.sync());await settle();await matrix({critical:0,pool:extraPool.name,pumps:await reminders()});
 let db=await database();assert.equal(db[0].length,2);assert(db[0].every(r=>!r.isCompleted));assert.equal(db[1].filter(r=>r.type==='PUMP_MANUAL'&&r.message==='OPEN').length,2);
 await context.setOffline(true);await page.locator('[data-field-tab-button=agora]').click();
 for(const lang of languages){await locale(lang);const before=await raw(),dialog=page.waitForEvent('dialog'),click=page.locator(`[data-pump-reminder="${regular.localId}"] button`).click();await(await dialog).dismiss();await click;assert.equal(await raw(),before);}
 for(const row of [regular,extra]){const dialog=page.waitForEvent('dialog'),click=page.locator(`[data-pump-reminder="${row.localId}"] button`).click();await(await dialog).accept();await click;await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key))['PUMP_MANUAL:'+id].status==='CLOSED',{key:reminderKey,id:row.localId});}
 await matrix({critical:0,pool:extraPool.name});await context.setOffline(false);await page.evaluate(()=>CWFieldReminders.sync());await settle();await matrix({critical:0,pool:extraPool.name});
 db=await database();assert.equal(db[0].length,2);assert(db[0].every(r=>r.isCompleted));assert.equal(db[1].filter(r=>r.type==='PUMP_MANUAL'&&r.message==='OPEN').length,2);assert.equal(db[1].filter(r=>r.type==='PUMP_MANUAL'&&r.message==='CLOSED').length,2);
 const journal=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),journalKey);assert(journal.entries.every(e=>e.action!=='RESOLVED'));assert(journal.entries.filter(e=>e.exceptionId.startsWith('pump-manual:')).every(e=>e.title===words.sourcePumpTitle[0]));assert.equal(await page.locator('#interruptList b').count(),0);
 assert((await page.evaluate(()=>qaSourceGuardCalls))>0,'Document/session guards stay active');
 console.log('PASS typed REGULAR/EXTRA reminders with the same numeric visit ID, literal payload/dates/history, language changes without producer reads/writes or node replacement, read confirmation keeps causes open, five-language physical cancellation and exactly two server opens/closes');

 assert.deepEqual(errors,[]);completed=true;
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(deadline);await browser?.close();await prisma.$disconnect();});
