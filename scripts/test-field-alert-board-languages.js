'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser, matrixChecks = 0, crossTabLanguageChecks = 0, userNotificationChecks = 0;
const languages=["pt", "en", "fr", "es", "de"];
const words={
  "chip": [
    "Interrupção operacional",
    "Operational interruption",
    "Interruption opérationnelle",
    "Interrupción operativa",
    "Betriebsunterbrechung"
  ],
  "historyTitle": [
    "Histórico de alertas",
    "Alert history",
    "Historique des alertes",
    "Historial de alertas",
    "Alarmverlauf"
  ],
  "historyIntro": [
    "Leituras registadas nesta conta, neste dispositivo e neste dia. O fecho da causa é confirmado no respetivo registo.",
    "Read acknowledgements for this account, device and day. The cause is closed in its own record.",
    "Lectures enregistrées pour ce compte, cet appareil et ce jour. La clôture de la cause est confirmée dans le dossier concerné.",
    "Lecturas registradas en esta cuenta, este dispositivo y este día. El cierre de la causa se confirma en su registro.",
    "Lesebestätigungen für dieses Konto, dieses Gerät und diesen Tag. Die Behebung der Ursache wird im zugehörigen Eintrag bestätigt."
  ],
  "historyEmpty": [
    "Sem historico local de excecoes.",
    "No local exception history.",
    "Aucun historique local des exceptions.",
    "No hay historial local de excepciones.",
    "Kein lokaler Verlauf von Ausnahmen."
  ],
  "observed": [
    "Alerta observado",
    "Alert observed",
    "Alerte observée",
    "Alerta observada",
    "Alarm wahrgenommen"
  ],
  "handlingHistory": [
    "Em tratamento local",
    "Being handled locally",
    "En cours de traitement local",
    "En tratamiento local",
    "Lokal in Bearbeitung"
  ],
  "readHistory": [
    "Leitura confirmada",
    "Read acknowledgement saved",
    "Lecture confirmée",
    "Lectura confirmada",
    "Lesebestätigung gespeichert"
  ],
  "record": [
    "Registo local",
    "Local record",
    "Enregistrement local",
    "Registro local",
    "Lokaler Eintrag"
  ],
  "exception": [
    "Excecao operacional",
    "Operational exception",
    "Exception opérationnelle",
    "Excepción operativa",
    "Betriebliche Ausnahme"
  ],
  "system": [
    "Sistema",
    "System",
    "Système",
    "Sistema",
    "System"
  ],
  "technician": [
    "Tecnico",
    "Technician",
    "Technicien",
    "Técnico",
    "Techniker"
  ],
  "notice": [
    "{count} alerta(s) por resolver · Ver",
    "{count} unresolved alert(s) · View",
    "{count} alerte(s) à traiter · Voir",
    "{count} alerta(s) por resolver · Ver",
    "{count} ungelöste Alarme · Anzeigen"
  ],
  "empty": [
    "Sem alertas críticos neste momento.",
    "No critical alerts at the moment.",
    "Aucune alerte critique pour le moment.",
    "No hay alertas críticas en este momento.",
    "Derzeit keine kritischen Alarme."
  ],
  "summary": [
    "Trate a causa de cada alerta no respetivo registo. Assumir ou confirmar a leitura neste dispositivo mantém o aviso visível.",
    "Address each alert’s cause in its own record. Taking responsibility or acknowledging it on this device keeps the alert visible.",
    "Traitez la cause de chaque alerte dans le dossier concerné. La prise en charge ou la confirmation de lecture sur cet appareil laisse l’alerte visible.",
    "Trate la causa de cada alerta en su registro. Asumirla o confirmar su lectura en este dispositivo mantiene el aviso visible.",
    "Bearbeiten Sie die Ursache jedes Alarms im zugehörigen Eintrag. Die Übernahme oder Lesebestätigung auf diesem Gerät lässt den Alarm sichtbar."
  ],
  "noCauses": [
    "Sem causas ativas. Histórico de leitura local disponível.",
    "No active causes. Local read history is available.",
    "Aucune cause active. L’historique local des lectures est disponible.",
    "No hay causas activas. Historial local de lectura disponible.",
    "Keine aktiven Ursachen. Der lokale Leseverlauf ist verfügbar."
  ],
  "priority": [
    "Prioridade: {priority} | Leitura local: {status}",
    "Priority: {priority} | Local read status: {status}",
    "Priorité : {priority} | Lecture locale : {status}",
    "Prioridad: {priority} | Lectura local: {status}",
    "Priorität: {priority} | Lokaler Lesestatus: {status}"
  ],
  "unread": [
    "Por ler",
    "Unread",
    "Non lue",
    "Sin leer",
    "Ungelesen"
  ],
  "handling": [
    "Em tratamento",
    "Being handled",
    "En cours de traitement",
    "En tratamiento",
    "In Bearbeitung"
  ],
  "read": [
    "Confirmada",
    "Acknowledged",
    "Confirmée",
    "Confirmada",
    "Bestätigt"
  ],
  "unconfirmed": [
    "Por confirmar",
    "Unconfirmed",
    "À confirmer",
    "Por confirmar",
    "Unbestätigt"
  ],
  "responsibility": [
    "Responsabilidade: criou {created} | recebeu {received}",
    "Responsibility: created by {created} | received by {received}",
    "Responsabilité : créée par {created} | reçue par {received}",
    "Responsabilidad: creó {created} | recibió {received}",
    "Verantwortung: erstellt von {created} | empfangen von {received}"
  ],
  "acknowledgement": [
    "Assumiu neste dispositivo: {assumed} | Confirmou leitura: {confirmed}",
    "Taken on this device by: {assumed} | Read acknowledged by: {confirmed}",
    "Prise en charge sur cet appareil : {assumed} | Lecture confirmée par : {confirmed}",
    "Asumió en este dispositivo: {assumed} | Confirmó la lectura: {confirmed}",
    "Auf diesem Gerät übernommen von: {assumed} | Lesen bestätigt von: {confirmed}"
  ],
  "pending": [
    "pendente",
    "pending",
    "en attente",
    "pendiente",
    "ausstehend"
  ],
  "elapsed": [
    "Tempo em curso: {duration}",
    "Elapsed time: {duration}",
    "Temps écoulé : {duration}",
    "Tiempo transcurrido: {duration}",
    "Verstrichene Zeit: {duration}"
  ],
  "noTime": [
    "Sem tempo em curso",
    "No elapsed time",
    "Aucun temps écoulé",
    "Sin tiempo transcurrido",
    "Keine verstrichene Zeit"
  ],
  "unavailableTime": [
    "duracao indisponivel",
    "duration unavailable",
    "durée indisponible",
    "duración no disponible",
    "Dauer nicht verfügbar"
  ],
  "minutes": [
    "{minutes} minuto(s)",
    "{minutes} minute(s)",
    "{minutes} minute(s)",
    "{minutes} minuto(s)",
    "{minutes} Minute(n)"
  ],
  "hours": [
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m",
    "{hours}h {minutes}m"
  ],
  "resolve": [
    "Tratar causa",
    "Address cause",
    "Traiter la cause",
    "Tratar la causa",
    "Ursache bearbeiten"
  ],
  "assume": [
    "Assumir",
    "Take responsibility",
    "Prendre en charge",
    "Asumir",
    "Übernehmen"
  ],
  "confirm": [
    "Confirmar leitura",
    "Acknowledge reading",
    "Confirmer la lecture",
    "Confirmar lectura",
    "Lesen bestätigen"
  ],
  "retry": [
    "Rever histórico guardado",
    "Review saved history",
    "Revoir l’historique enregistré",
    "Revisar el historial guardado",
    "Gespeicherten Verlauf prüfen"
  ],
  "saved": [
    "Leitura guardada neste dispositivo. O alerta mantém-se até tratar a causa.",
    "Read acknowledgement saved on this device. The alert remains until its cause is addressed.",
    "Lecture enregistrée sur cet appareil. L’alerte reste visible jusqu’au traitement de sa cause.",
    "Lectura guardada en este dispositivo. La alerta se mantiene hasta tratar la causa.",
    "Lesebestätigung auf diesem Gerät gespeichert. Der Alarm bleibt bestehen, bis seine Ursache behoben ist."
  ],
  "writeFailed": [
    "O histórico não ficou guardado. {detail}",
    "The history was not saved. {detail}",
    "L’historique n’a pas été enregistré. {detail}",
    "El historial no se ha guardado. {detail}",
    "Der Verlauf wurde nicht gespeichert. {detail}"
  ],
  "changeFailed": [
    "A alteração não ficou guardada. {detail}",
    "The change was not saved. {detail}",
    "La modification n’a pas été enregistrée. {detail}",
    "El cambio no se ha guardado. {detail}",
    "Die Änderung wurde nicht gespeichert. {detail}"
  ],
  "pumpInstruction": [
    "Confirme o modo automático no registo da bomba. A leitura do alerta não fecha o lembrete.",
    "Confirm automatic mode in the pump record. Acknowledging the alert does not close the reminder.",
    "Confirmez le mode automatique dans le dossier de la pompe. La lecture de l’alerte ne clôture pas le rappel.",
    "Confirme el modo automático en el registro de la bomba. Leer la alerta no cierra el recordatorio.",
    "Bestätigen Sie den Automatikbetrieb im Pumpeneintrag. Die Lesebestätigung des Alarms schließt die Erinnerung nicht."
  ],
  "historyMeta": [
    "{date} | {actor}",
    "{date} | {actor}",
    "{date} | {actor}",
    "{date} | {actor}",
    "{date} | {actor}"
  ],
  "warnings": [
    "{read} {write}",
    "{read} {write}",
    "{read} {write}",
    "{read} {write}",
    "{read} {write}"
  ]
};
const helperWords={
  "session": [
    "A sessão mudou. Reabra os alertas com a conta atual.",
    "The session changed. Reopen the alerts with the current account.",
    "La session a changé. Rouvrez les alertes avec le compte actuel.",
    "La sesión ha cambiado. Vuelva a abrir las alertas con la cuenta actual.",
    "Die Sitzung wurde geändert. Öffnen Sie die Alarme erneut mit dem aktuellen Konto."
  ],
  "role": [
    "Esta conta não permite registar a leitura dos alertas.",
    "This account cannot record alert read acknowledgements.",
    "Ce compte ne permet pas d’enregistrer la lecture des alertes.",
    "Esta cuenta no permite registrar la lectura de las alertas.",
    "Dieses Konto darf keine Lesebestätigungen für Alarme speichern."
  ],
  "changed": [
    "A conta ou o dia mudou. Os registos locais foram preservados.",
    "The account or day changed. Local records were preserved.",
    "Le compte ou le jour a changé. Les enregistrements locaux ont été conservés.",
    "La cuenta o el día ha cambiado. Se han conservado los registros locales.",
    "Das Konto oder der Tag wurde geändert. Die lokalen Einträge bleiben erhalten."
  ],
  "mismatch": [
    "O histórico local não corresponde à conta/dia. Foi preservado.",
    "The local history does not match this account/day. It was preserved.",
    "L’historique local ne correspond pas à ce compte ou à ce jour. Il a été conservé.",
    "El historial local no corresponde a esta cuenta o a este día. Se ha conservado.",
    "Der lokale Verlauf passt nicht zu diesem Konto oder Tag. Er bleibt erhalten."
  ],
  "unreadable": [
    "O histórico local está ilegível. Foi preservado.",
    "The local history is unreadable. It was preserved.",
    "L’historique local est illisible. Il a été conservé.",
    "El historial local es ilegible. Se ha conservado.",
    "Der lokale Verlauf ist unlesbar. Er bleibt erhalten."
  ],
  "action": [
    "A leitura de um alerta não confirma a resolução da sua causa.",
    "Acknowledging an alert does not confirm that its cause is resolved.",
    "La lecture d’une alerte ne confirme pas la résolution de sa cause.",
    "Leer una alerta no confirma la resolución de su causa.",
    "Die Lesebestätigung eines Alarms bestätigt nicht, dass seine Ursache behoben ist."
  ],
  "locks": [
    "Este navegador não permite coordenar a gravação do histórico.",
    "This browser cannot coordinate saving the history.",
    "Ce navigateur ne permet pas de coordonner l’enregistrement de l’historique.",
    "Este navegador no permite coordinar el guardado del historial.",
    "Dieser Browser kann das Speichern des Verlaufs nicht koordinieren."
  ],
  "relevant": [
    "O alerta mudou. Consulte o estado atual antes de confirmar.",
    "The alert changed. Check its current status before acknowledging it.",
    "L’alerte a changé. Consultez son état actuel avant de confirmer.",
    "La alerta ha cambiado. Consulte su estado actual antes de confirmar.",
    "Der Alarm wurde geändert. Prüfen Sie vor der Bestätigung seinen aktuellen Status."
  ],
  "readback": [
    "Não foi possível confirmar a gravação do histórico neste dispositivo.",
    "Saving the history on this device could not be confirmed.",
    "L’enregistrement de l’historique sur cet appareil n’a pas pu être confirmé.",
    "No se ha podido confirmar que el historial se haya guardado en este dispositivo.",
    "Das Speichern des Verlaufs auf diesem Gerät konnte nicht bestätigt werden."
  ],
  "legacy": [
    "Existem registos antigos sem conta comprovada. Foram preservados e não alteram os alertas atuais.",
    "Older records have no verified account. They were preserved and do not change current alerts.",
    "D’anciens enregistrements n’ont pas de compte vérifié. Ils ont été conservés et ne modifient pas les alertes actuelles.",
    "Hay registros antiguos sin una cuenta verificada. Se han conservado y no modifican las alertas actuales.",
    "Ältere Einträge haben kein bestätigtes Konto. Sie bleiben erhalten und ändern die aktuellen Alarme nicht."
  ]
};
async function helperGuardCases() {
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../frontend/cw-field-alert-journal.js'),'utf8');
  function fixture() {
    const memory=new Map(),events=[];
    const session={owner:'TECH:41',technicianId:41,token:'x.'+Buffer.from(JSON.stringify({role:'TECHNICIAN'})).toString('base64url')+'.x'};
    const c={document:{documentElement:{lang:'pt'}},crypto:{randomUUID},same:true,day:'2026-09-30',atob:x=>Buffer.from(x,'base64').toString(),Event:class{constructor(type){this.type=type;}},navigator:{locks:{request:async(_key,fn)=>fn()}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},CWFieldWriteStore:{session:()=>session,same:()=>c.same},CWFieldRouteCache:{today:()=>c.day},dispatchEvent:e=>events.push(e.type)};
    c.window=c;vm.runInNewContext(source,c);const api=c.CWFieldAlertJournal,context=api.scope(),key=api.key(context),now=new Date().toISOString();
    const exception={id:'water-open:REGULAR:qa',title:'P0 - Agua aberta',detail:'Literal <b>{status}</b>',createdBy:'Sistema',createdAt:now};
    return {c,api,context,key,memory,events,exception,record:()=>api.record(context,[exception],'OPEN','pendente')};
  }
  const cases={
    session:f=>{f.c.same=false;f.api.scope();},
    role:f=>{f.context.session.token='x.'+Buffer.from(JSON.stringify({role:'ADMIN'})).toString('base64url')+'.x';f.api.scope();},
    changed:f=>{f.c.day='2026-10-01';f.api.read(f.context);},
    mismatch:f=>{f.memory.set(f.key,'{}');f.api.read(f.context);},
    unreadable:f=>{f.memory.set(f.key,'{broken');f.api.read(f.context);},
    invalidEntry:async f=>{await f.record();const v=JSON.parse(f.memory.get(f.key));v.entries[0].action='RESOLVED';f.memory.set(f.key,JSON.stringify(v));f.api.read(f.context);},
    action:f=>f.api.record(f.context,[f.exception],'RESOLVED','pendente'),
    locks:f=>{f.c.navigator.locks=undefined;return f.record();},
    relevant:f=>f.api.record(f.context,[f.exception],'CONFIRMED','pendente',()=>false),
    readback:f=>{f.c.localStorage.setItem=()=>{};return f.record();}
  };
  for(const [name,exercise] of Object.entries(cases)){
    const f=fixture();let error;try{await exercise(f);}catch(e){error=e;}assert(error,name+' guard');
    const key=name==='invalidEntry'?'unreadable':name;assert.equal(error.message,helperWords[key][0]);
    const value=f.api.presentation.error(error),before=Array.from(f.memory),events=[...f.events];
    for(const [i,lang] of languages.entries()){f.c.document.documentElement.lang=lang;assert.equal(f.api.presentation.format(value),helperWords[key][i]);assert.equal(error.message,helperWords[key][0]);}
    const external=Error(helperWords[key][0]);external.copy={key};assert.equal(f.api.presentation.format(f.api.presentation.error(external)),external.message);assert.equal(f.api.presentation.format({key}),'[object Object]');
    f.c.document.documentElement.lang='unknown';assert.equal(f.api.presentation.format(value),error.message);delete f.c.document;assert.equal(f.api.presentation.format(value),error.message);
    assert.deepEqual(Array.from(f.memory),before);assert.deepEqual(f.events,events);
  }
  const f=fixture();f.memory.set('cw:tech-field:op-exception-state:v1','PRIVATE OLD ACCOUNT');const value=f.api.presentation.legacyWarning(f.context),before=Array.from(f.memory);
  for(const [i,lang] of languages.entries()){f.c.document.documentElement.lang=lang;assert.equal(f.api.presentation.format(value),helperWords.legacy[i]);assert.equal(f.api.legacyWarning(f.context),helperWords.legacy[0]);}
  assert.deepEqual(Array.from(f.memory),before);
  console.log('PASS10 real journal guard cases and legacy warning in five languages; original errors/API, raw external/forged errors, minimal DOM/fallback and bytes preserved');
}

// Added within the browser scenario, after the journal accessors.


(async () => {
  const tech = await prisma.technician.create({ data: { name: 'pendente', active: true } });
  const other = await prisma.technician.create({ data: { name: 'Other alert owner', active: true } });
  const client = await prisma.client.create({ data: { name: 'Alert source client', active: true } });
  const pool = await prisma.pool.create({ data: { name: 'Alert source pool', clientId: client.id, active: true } });
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, technicianId: tech.id, plannedDate: new Date(), date: new Date(), status: 'PLANNED' } });
  const sign = person => jwt.sign({ id: person.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), token = sign(tech), otherToken = sign(other);
  const remote = [];
  for (const kind of ['water', 'pump']) {
    const localId = randomUUID(), response = await fetch(base + '/api/technician/' + kind + '-reminders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ owner: 'TECH:' + tech.id, localId, visitType: 'REGULAR', visitId: visit.id, poolId: pool.id, clientId: client.id, dueAt: new Date(Date.now() + 3600000).toISOString(), openedAt: new Date().toISOString(), note: 'Keep physical alert active', flowState: 'HALF' }) });
    assert.equal(response.status, 200); remote.push({ kind, localId, row: (await response.json()).reminder });
  }
  const legacy = { 'cw:tech-field:op-exception-state:v1': JSON.stringify({ ['water-open:server-' + remote[0].row.id]: { status: 'RESOLVED', openLogged: true, resolvedBy: 'Old unrelated user' } }), 'cw:tech-field:op-exception-history:v1': JSON.stringify([{ id: 'old', action: 'RESOLVED', title: 'PRIVATE OLD ACCOUNT HISTORY', by: 'Old unrelated user', createdAt: new Date().toISOString() }]), 'cw:tech-field:op-exception-command:v1': '[{"private":"OLD LOCAL COMMAND"}]' };
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech, legacy }) => {
    if (!localStorage.getItem('qaAlertSession')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      for (const [key, value] of Object.entries(legacy)) localStorage.setItem(key, value);
      localStorage.setItem('qaAlertSession', '1');
    }
    const interval = window.setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000].includes(delay) ? 0 : interval(callback, delay, ...args);
  }, { token, tech, legacy });
  const page = await context.newPage(), errors = [], requests = []; page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))requests.push({path,method:r.method(),body:r.postData()});}); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept()); page.setDefaultTimeout(10000);
  await page.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' }); await page.evaluate(() => CWFieldReminders.sync()); await page.locator('#cwLanguageSelect').selectOption('en'); assert.equal(await page.locator('#interruptCard > .chip').textContent(),words.chip[1]); await page.locator('#cwLanguageSelect').selectOption('pt'); await helperGuardCases();
  await page.locator('[data-field-tab-button="hoje"]').click();
  assert.equal(await page.locator('#interruptList [data-exception-category="WATER_OPEN"]').count(), 1, 'Old RESOLVED state cannot hide active water');
  await page.locator('#interruptList [data-exception-category="WATER_OPEN"] [data-interrupt-action="resolve"]').click();
  assert.equal(await page.locator('#interruptList [data-exception-category="WATER_OPEN"]').count(), 1, 'Treat cause cannot hide active water');
  assert.equal(await page.locator('#interruptList [data-exception-category="PUMP_MANUAL"]').count(), 1, 'Real pump reminders must reach the main alert board');
  assert(!(await page.locator('#fieldAlertHistoryList').textContent()).includes('PRIVATE OLD ACCOUNT HISTORY'));
  for (const [key, value] of Object.entries(legacy)) assert.equal(await page.evaluate(key => localStorage.getItem(key), key), value);
  const journalKey = await page.evaluate(() => CWFieldAlertJournal.key(CWFieldAlertJournal.scope(CWFieldWriteStore.session())));
  const journal = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), journalKey);
  const raw = () => page.evaluate(key => localStorage.getItem(key), journalKey);

  const locale=async lang=>{await page.locator('#cwLanguageSelect').selectOption(lang);await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);};
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const text=(key,i,params={})=>words[key][i].replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??''));
  const instrument=()=>page.evaluate(()=>{window.qaAlertCalls={};for(const [group,api,names] of [['journal',CWFieldAlertJournal,['scope','read','states','record','legacyWarning']],['reminders',CWFieldReminders,['list','create','mark','sync','context']]])for(const name of names){const fn=api[name];api[name]=(...args)=>{const key=group+':'+name;qaAlertCalls[key]=(qaAlertCalls[key]||0)+1;return fn(...args);};}});
  const database=()=>prisma.operationalReminder.findMany({where:{assignedToTechnicianId:tech.id},orderBy:{id:'asc'}});
  const state=()=>page.evaluate(()=>({focus:document.activeElement.id,focusAction:document.activeElement.dataset.interruptAction,focusTab:document.activeElement.dataset.fieldTabButton,note:document.querySelector('#waterNote').value,context:CWFieldVisitContext(),calls:{...qaAlertCalls},tokens:['token','cristalwater_jwt'].map(k=>localStorage.getItem(k)),stored:Object.keys(localStorage).filter(k=>k.startsWith('cwField')||k.startsWith('cwWater')||k.startsWith('cwPump')||k.startsWith('cw:tech')).sort().map(k=>[k,localStorage.getItem(k)])}));
  async function matrix({warning,toast}={}){
    await locale('pt');await settle();await page.locator('[data-field-tab-button=hoje]').focus();
    const entries=await page.evaluate(()=>Array.from(document.querySelectorAll('#interruptList .interrupt-item')).map(n=>({id:n.dataset.exceptionId,priority:n.querySelector('[data-alert-text=priority]').textContent.match(/^Prioridade: (.*?) \| Leitura local: (.*)$/).slice(1),responsibility:n.querySelector('[data-alert-text=responsibility]').textContent.match(/^Responsabilidade: criou (.*?) \| recebeu (.*)$/).slice(1),ack:n.querySelector('[data-alert-text=acknowledgement]').textContent.match(/^Assumiu neste dispositivo: (.*?) \| Confirmou leitura: (.*)$/).slice(1),duration:n.querySelector('[data-alert-text=elapsed]').textContent.slice('Tempo em curso: '.length)})));
    const history=await page.evaluate(()=>{try{return CWFieldAlertJournal.read(CWFieldAlertJournal.scope()).entries.slice(-6).reverse().map(entry=>({...entry,displayDate:new Date(entry.createdAt).toLocaleString('pt-PT',{dateStyle:'short',timeStyle:'short'})}));}catch{return [];}});
    const statuses=await page.evaluate(()=>{try{return CWFieldAlertJournal.states(CWFieldAlertJournal.read(CWFieldAlertJournal.scope()));}catch{return {};}});
    await page.evaluate(()=>{window.qaAlertNodes=Array.from(document.querySelectorAll('#interruptCard,#interruptCard *,#fieldAlertHistoryList,#fieldAlertHistoryList *,#fieldPriorityNotice,#toast'));});
    const before=await state(),db=await database(),start=requests.length;
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});for(const [i,lang] of languages.entries()){
      await locale(lang);await settle();assert.equal(await page.locator('#interruptCard > .chip').textContent(),words.chip[i]);assert.equal(await page.locator('#fieldAlertHistoryList').locator('xpath=..').locator('summary').textContent(),words.historyTitle[i]);
      assert.equal(await page.locator('#fieldAlertHistoryList > [data-alert-text=intro]').textContent(),words.historyIntro[i]);assert.equal(await page.locator('#interruptSummary').textContent(),words[entries.length?'summary':'empty'][i]);assert.equal(await page.locator('#fieldPriorityNotice').textContent(),text('notice',i,{count:entries.length}));
      for(const entry of entries){const n=page.locator(`#interruptList [data-exception-category][data-exception-id="${entry.id}"]`),s=statuses[entry.id]||{};assert.equal(await n.locator('[data-alert-text=priority]').textContent(),text('priority',i,{priority:entry.priority[0],status:words[({OPEN:'unread',ASSUMED:'handling',CONFIRMED:'read'})[s.status||'OPEN']||'unconfirmed'][i]}));
        assert.equal(await n.locator('[data-alert-text=responsibility]').textContent(),text('responsibility',i,{created:entry.responsibility[0],received:s.receivedBy||words.technician[i]}));assert.equal(await n.locator('[data-alert-text=acknowledgement]').textContent(),text('acknowledgement',i,{assumed:s.assumedBy||words.pending[i],confirmed:s.confirmedBy||words.pending[i]}));
        const minutes=entry.duration.match(/^(\d+) minuto\(s\)$/);assert.equal(await n.locator('[data-alert-text=elapsed]').textContent(),text('elapsed',i,{duration:minutes?text('minutes',i,{minutes:minutes[1]}):entry.duration}));
        for(const action of ['resolve','assume','confirm']){const b=n.locator(`[data-interrupt-action=${action}]`);if(await b.count())assert.equal(await b.textContent(),words[action][i]);}
      }
      for(const entry of history){const n=page.locator(`[data-history-entry="${entry.id}"]`);assert.equal(await n.locator('strong').textContent(),words[({OPEN:'observed',ASSUMED:'handlingHistory',CONFIRMED:'readHistory'})[entry.action]||'record'][i]);assert.equal(await n.locator('[data-alert-text=historyTitle]').textContent(),entry.title||words.exception[i]);assert.equal(await n.locator('[data-alert-text=historyMeta]').textContent(),text('historyMeta',i,{date:entry.displayDate,actor:entry.by||words.system[i]}));}
      if(!history.length)assert.equal(await page.locator('[data-history-empty]').textContent(),words.historyEmpty[i]);
      if(warning)for(const message of await page.locator('[data-alert-text=warning]').allTextContents())assert.equal(message,warning[i]);
      if(toast)assert.equal(await page.locator('#toast').textContent(),Array.isArray(toast)?toast[i]:words[toast][i]);
      matrixChecks++;assert.deepEqual(await state(),before);assert.deepEqual(await database(),db);assert(await page.evaluate(()=>qaAlertNodes.every(n=>n.isConnected)));assert(await page.locator('#interruptCard').evaluate(n=>n.hidden||n.scrollWidth<=n.clientWidth+1));
    }}
    for(const r of requests.slice(start)){assert.equal(r.path,'/api/settings/language/me');assert.equal(r.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(r.body)),['language']);}
    await locale('pt');await settle();
  }

  await instrument(); await matrix({warning:helperWords.legacy});
  // Read-only display fixtures; restore exact history bytes before any actions.
  const initialJournal=await raw(),sample=JSON.parse(initialJournal);
  for(const entry of sample.entries){entry.sourceCreatedAt=new Date(Date.now()-65*60000).toISOString();entry.by='';entry.title='';}
  await page.evaluate(({key,value})=>{localStorage.setItem(key,value);window.dispatchEvent(new Event('cw:alert-journal-updated'));},{key:journalKey,value:JSON.stringify(sample)});
  await matrix({warning:helperWords.legacy});
  await page.evaluate(({key,value})=>{localStorage.setItem(key,value);window.dispatchEvent(new Event('cw:alert-journal-updated'));},{key:journalKey,value:initialJournal});
  assert.equal(await raw(),initialJournal);
  const waterId = await page.locator('#interruptList [data-exception-category="WATER_OPEN"]').getAttribute('data-exception-id');
  const pumpId = await page.locator('#interruptList [data-exception-category="PUMP_MANUAL"]').getAttribute('data-exception-id');
  const click = (id, action) => page.evaluate(({ id, action }) => document.querySelector(`[data-exception-id="${id}"] [data-interrupt-action="${action}"]`).click(), { id, action });
  const status = (id, expected) => page.waitForFunction(({ id, expected }) => CWFieldAlertJournal.states(CWFieldAlertJournal.read(CWFieldAlertJournal.scope(CWFieldWriteStore.session())))[id]?.status === expected, { id, expected });
  await status(waterId, 'OPEN'); await status(pumpId, 'OPEN');
  await click(waterId, 'assume'); await status(waterId, 'ASSUMED'); await matrix({warning:helperWords.legacy,toast:'saved'});
  await page.evaluate(()=>{const node=document.getElementById('toast');node.textContent=node.textContent;});await matrix({warning:helperWords.legacy,toast:languages.map(()=>words.saved[0])});
  const secondPage = await context.newPage(); await secondPage.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' });
  const confirmation = (tab, action) => tab.evaluate(async ({ id, action }) => {
    const context = CWFieldAlertJournal.scope(CWFieldWriteStore.session()), entry = CWFieldAlertJournal.read(context).entries.find(entry => entry.exceptionId === id);
    return CWFieldAlertJournal.record(context, [{ id, title: entry.title, detail: entry.detail, createdAt: entry.sourceCreatedAt, createdBy: entry.createdBy }], action, 'Alert owner');
  }, { id: waterId, action });
  await Promise.all([confirmation(page, 'CONFIRMED'), confirmation(secondPage, 'CONFIRMED')]);
  await status(waterId, 'CONFIRMED'); await confirmation(secondPage, 'ASSUMED');
  assert.deepEqual((await journal()).entries.filter(entry => entry.exceptionId === waterId).map(entry => entry.action), ['OPEN', 'ASSUMED', 'CONFIRMED']);
  // Actual language selection in the second live tab updates the two user
  // records. It must not re-read or replace the first tab's operational board.
  await locale('pt'); await settle();
  secondPage.on('request',request => { const path = new URL(request.url()).pathname; if(path.startsWith('/api/')) requests.push({path,method:request.method(),body:request.postData()}); });
  await page.evaluate(() => {
    window.qaLanguageStorageEvents = [];
    window.qaCrossTabNodes = [...document.querySelectorAll('#interruptCard,#interruptCard *,#fieldAlertHistoryList,#fieldAlertHistoryList *,#fieldPriorityNotice')];
    window.addEventListener('storage',event => {
      if (!['user','cristalwater_user'].includes(event.key)) return;
      let before,after; try { before=JSON.parse(event.oldValue);after=JSON.parse(event.newValue); } catch (_) { return; }
      if (!before || !after) return;
      qaLanguageStorageEvents.push({key:event.key,changed:Object.keys({...before,...after}).filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])).sort()});
    });
  });
  const crossTabBefore=await state(),crossTabDb=await database(),crossTabPending=await page.evaluate(()=>CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)),crossTabJournal=await raw(),crossTabStart=requests.length;
  for(const language of ['en','fr','es','de','pt']){
    const count=await page.evaluate(()=>qaLanguageStorageEvents.length);
    await secondPage.locator('#cwLanguageSelect').selectOption(language);
    await page.waitForFunction(count=>qaLanguageStorageEvents.length>=count+2,count);
    await settle();
    const after=await state();
    assert.deepEqual(after.calls,crossTabBefore.calls,'Language-only user updates from another real tab must not re-read reminders or alert history');
    assert.deepEqual(after,crossTabBefore);assert.deepEqual(await database(),crossTabDb);assert.equal(await raw(),crossTabJournal);
    assert.deepEqual(await page.evaluate(()=>CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)),crossTabPending);
    assert(await page.evaluate(()=>qaCrossTabNodes.every(node=>node.isConnected)));
    const changes=await page.evaluate(count=>qaLanguageStorageEvents.slice(count),count);
    assert(changes.length>=2);for(const change of changes)assert.deepEqual(change.changed,['language']);
    crossTabLanguageChecks++;
  }
  for(const request of requests.slice(crossTabStart)){assert.equal(request.path,'/api/settings/language/me');assert.equal(request.method,'PUT');assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']);}
  // These malformed or changed identity/context event inputs retain the original
  // notifications. Event fixtures do not alter the actual credentials/storage.
  const notificationResult=await page.evaluate(()=>{
    const user=JSON.parse(localStorage.getItem('cristalwater_user')),raw=JSON.stringify(user),events=[];
    const water=()=>events.push('water'),reminders=()=>events.push('reminders');
    window.addEventListener('cw:water-state-updated',water);window.addEventListener('cw:reminders-updated',reminders);
    const cases=[];
    for(const key of ['user','cristalwater_user'])for(const [name,oldValue,newValue]of [
      ['added',null,raw],['removed',raw,null],['malformed',raw,'{broken'],['array',raw,'[]'],
      ['name',raw,JSON.stringify({...user,name:user.name+' changed'})],
      ['role',raw,JSON.stringify({...user,role:'ADMIN'})],
      ['id',raw,JSON.stringify({...user,id:Number(user.id)+100000})],
      ['vehicle',raw,JSON.stringify({...user,vehicleId:100000})]
    ])cases.push({name:key+':'+name,key,oldValue,newValue});
    for(const key of ['token','cristalwater_jwt'])cases.push({name:key,key,oldValue:'old token event',newValue:'new token event'});
    cases.push({name:'clear',key:null,oldValue:null,newValue:null});
    const reminderKey=Object.keys(localStorage).find(key=>key.startsWith('cwFieldReminders:v1:'));
    if(!reminderKey)throw Error('Missing actual current-owner reminder cache');
    cases.push({name:'reminder-data',key:reminderKey,oldValue:localStorage.getItem(reminderKey),newValue:localStorage.getItem(reminderKey)});
    const result=[];
    try{for(const item of cases){const first=events.length;window.dispatchEvent(new StorageEvent('storage',item));result.push({name:item.name,notifications:events.slice(first)});}}
    finally{window.removeEventListener('cw:water-state-updated',water);window.removeEventListener('cw:reminders-updated',reminders);}
    return result;
  });
  assert.equal(notificationResult.length,20);
  for(const result of notificationResult)assert.deepEqual(result.notifications,['water','reminders'],result.name);
  userNotificationChecks=notificationResult.length;
  assert.equal(await raw(),crossTabJournal);assert.deepEqual(await database(),crossTabDb);
  assert.deepEqual(await page.evaluate(()=>CWFieldWriteStore.records(null,CWFieldWriteStore.session(),true)),crossTabPending);
  console.log('PASS actual cross-tab language-only storage '+JSON.stringify({languages:crossTabLanguageChecks,userKeys:2,primaryProducerCallsUnchanged:true,nodesAndFocusAndJournalAndPendingAndSqlExact:true,notificationGuards:userNotificationChecks,operationalWrites:0}));
  await locale('pt');await settle();
  if(process.env.CW_ALERT_BOARD_CAPTURE){await page.locator('[data-field-tab-button=hoje]').click();await locale('de');await page.setViewportSize({width:320,height:900});await page.locator('#interruptCard').screenshot({path:process.env.CW_ALERT_BOARD_CAPTURE.replace('.png','-board.png')});await locale('pt');}
  await click(pumpId, 'resolve'); await matrix({warning:helperWords.legacy,toast:'pumpInstruction'});
  for (const { row } of remote) assert.equal((await prisma.operationalReminder.findUnique({ where: { id: row.id } })).isCompleted, false);
  assert.equal(await page.locator('#interruptList [data-exception-category="WATER_OPEN"]').count(), 1);
  assert.equal(await page.locator('#interruptList [data-exception-category="PUMP_MANUAL"]').count(), 1);
  await secondPage.close();
  console.log('PASS active sources remain visible; physical records stay open; two tabs preserve one monotonic local history');
  const beforeFault = await raw();
  await page.evaluate(() => { window.qaAlertSet = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwFieldAlertJournal:')) throw Error('QA quota'); return qaAlertSet.call(this, key, value); }; });
  await click(pumpId, 'confirm'); await page.waitForFunction(() => document.getElementById('interruptList').textContent.includes('A alteração não ficou guardada'));
  assert.equal(await raw(), beforeFault); await status(pumpId, 'OPEN'); await matrix({warning:languages.map((_,i)=>helperWords.legacy[i]+' '+text('changeFailed',i,{detail:'QA quota'})),toast:languages.map((_,i)=>text('changeFailed',i,{detail:'QA quota'}))});
  await page.evaluate(() => { Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwFieldAlertJournal:')) return; return qaAlertSet.call(this, key, value); }; });
  await click(pumpId, 'confirm'); await page.waitForFunction(() => document.getElementById('interruptList').textContent.includes('confirmar a gravação'));
  await matrix({warning:languages.map((_,i)=>helperWords.legacy[i]+' '+text('changeFailed',i,{detail:helperWords.readback[i]})),toast:languages.map((_,i)=>text('changeFailed',i,{detail:helperWords.readback[i]}))});
  assert.equal(await raw(), beforeFault); await page.evaluate(() => { Storage.prototype.setItem = qaAlertSet; });
  await page.evaluate(key => localStorage.setItem(key, '{damaged'), journalKey); await page.reload({ waitUntil: 'networkidle' });
  await instrument(); await matrix();
  assert.match(await page.locator('#interruptList').textContent(), /ilegível/); assert.equal(await raw(), '{damaged');
  assert.equal(await page.locator('#interruptList [data-exception-category="WATER_OPEN"]').count(), 1);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: journalKey, value: beforeFault });
  await page.evaluate(() => document.querySelector('[data-interrupt-action="retry"]').click()); await status(waterId, 'CONFIRMED');
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await status(waterId, 'CONFIRMED');
  assert.equal(await raw(), beforeFault); assert.equal(await page.locator('#interruptList [data-exception-category="PUMP_MANUAL"]').count(), 1);
  await instrument(); await matrix({warning:helperWords.legacy});
  await page.locator('[data-field-tab-button="hoje"]').click();
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  await context.setOffline(false);
  console.log('PASS quota, no readback and corruption preserve bytes and visible causes; cold offline reload retains both alerts and the account journal');
  await page.evaluate(id => document.querySelector(`[data-water-close="${id}"]`).click(), await page.evaluate(() => CWFieldReminders.list('WATER_OPEN').find(row => row.status !== 'CLOSED').localId));
  await page.waitForFunction(() => CWFieldReminders.list('WATER_OPEN').every(row => row.status === 'CLOSED'));
  await page.evaluate(id => document.querySelector(`[data-pump-reminder="${id}"] button`).click(), await page.evaluate(() => CWFieldReminders.list('PUMP_MANUAL').find(row => row.status !== 'CLOSED').localId));
  await page.waitForFunction(() => CWFieldReminders.list('PUMP_MANUAL').every(row => row.status === 'CLOSED')); await page.evaluate(() => CWFieldReminders.sync());
  assert.equal(await page.locator('#interruptList [data-exception-category="WATER_OPEN"]').count(), 0); assert.equal(await page.locator('#interruptList [data-exception-category="PUMP_MANUAL"]').count(), 0);
  for (const { row } of remote) assert.equal((await prisma.operationalReminder.findUnique({ where: { id: row.id } })).isCompleted, true);
  assert((await journal()).entries.every(entry => entry.action !== 'RESOLVED'));
  await matrix({warning:helperWords.legacy});
  if(process.env.CW_ALERT_BOARD_CAPTURE){await locale('de');await page.setViewportSize({width:320,height:900});await page.locator('#fieldAlertHistoryList').locator('xpath=..').evaluate(n=>n.open=true);await page.locator('[data-field-tab-button=more]').click();await page.locator('#fieldAlertHistoryList').locator('xpath=..').screenshot({path:process.env.CW_ALERT_BOARD_CAPTURE});await locale('pt');}
  console.log('PASS only physical-close controls remove water/pump alerts and confirm closure on the server');
  const beforeSwitch = await raw();
  await page.evaluate(async key => {
    window.qaLockEntered = new Promise(resolve => { navigator.locks.request(key, async () => { resolve(); await new Promise(release => { window.qaAlertRelease = release; }); }); }); await qaLockEntered;
    const context = CWFieldAlertJournal.scope(CWFieldWriteStore.session()), entry = CWFieldAlertJournal.read(context).entries.find(entry => entry.action === 'OPEN');
    window.qaAlertPending = CWFieldAlertJournal.record(context, [{ id: 'test-alert:late-session', title: entry.title, detail: entry.detail, createdAt: entry.sourceCreatedAt }], 'OPEN', 'Old account').then(() => 'unexpected success', error => error.message);
  }, journalKey);
  await page.evaluate(({ token, user }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify(user)); }, { token: otherToken, user: { id: other.id, name: other.name, role: 'TECHNICIAN' } });
  assert.match(await page.evaluate(async () => { qaAlertRelease(); return qaAlertPending; }), /conta|sessão/);
  assert.equal(await raw(), beforeSwitch); await page.waitForSelector('#fieldRouteSessionChanged'); await page.goto(base + '/technician-field-mode', { waitUntil: 'networkidle' });
  assert(!(await page.locator('#fieldAlertHistoryList').textContent()).includes('Bomba em manual')); assert(!(await page.locator('#fieldAlertHistoryList').textContent()).includes('PRIVATE OLD ACCOUNT HISTORY'));
  const separation = await page.evaluate(() => { const original = CWFieldRouteCache.today, first = CWFieldAlertJournal.scope(); CWFieldRouteCache.today = () => '2099-01-01'; try { const next = CWFieldAlertJournal.scope(); return { changed: CWFieldAlertJournal.key(first) !== CWFieldAlertJournal.key(next), same: CWFieldAlertJournal.same(first), entries: CWFieldAlertJournal.read(next).entries.length }; } finally { CWFieldRouteCache.today = original; } });
  assert.deepEqual(separation, { changed: true, same: false, entries: 0 }); assert.equal(await raw(), beforeSwitch);
  for (const [key, value] of Object.entries(legacy)) assert.equal(await page.evaluate(key => localStorage.getItem(key), key), value);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS cross-tab language result '+JSON.stringify({matrixChecks,crossTabLanguageChecks,userNotificationChecks,activeSecondTabRetained:true,allOriginalConcurrentMonotonicHistoryAndPhysicalClosureAndAccountDayIsolationChecksRetained:true}));
  console.log('PASS journal/board languages at320/390/1440; same nodes/focus/data/SQL and no language-triggered producers or operational requests; original history stays literal');
  console.log('PASS locked writes cannot cross session changes; other accounts/days do not inherit the journal; legacy bytes stay untouched');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await prisma.$disconnect(); });
