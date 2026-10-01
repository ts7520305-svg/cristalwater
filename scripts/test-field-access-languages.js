'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA with external operations disabled required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt','en','fr','es','de'], words = {"accessTitle": ["Acesso e avisos", "Access and notices", "Accès et consignes", "Acceso y avisos", "Zugang und Hinweise"], "accessLoading": ["A carregar chave ou código desta piscina...", "Loading the key or code for this pool...", "Chargement de la clé ou du code de cette piscine…", "Cargando la llave o el código de esta piscina...", "Schlüssel oder Code für diesen Pool wird geladen…"], "accessSectionHint": ["chaves e codigos", "keys and codes", "clés et codes", "llaves y códigos", "Schlüssel und Codes"], "accessGeneric": ["Acesso", "Access", "Accès", "Acceso", "Zugang"], "accessGate": ["Portao", "Gate", "Portail", "Puerta", "Tor"], "accessAlarm": ["Alarme", "Alarm", "Alarme", "Alarma", "Alarm"], "accessKeyBox": ["Caixa de chaves", "Key box", "Boîte à clés", "Caja de llaves", "Schlüsselkasten"], "accessKey": ["Chave", "Key", "Clé", "Llave", "Schlüssel"], "accessCode": ["Codigo", "Code", "Code", "Código", "Code"], "accessPoolKey": ["Chave / codigo da piscina", "Pool key / code", "Clé / code de la piscine", "Llave / código de la piscina", "Poolschlüssel / Code"], "accessClientKey": ["Chave / codigo do cliente", "Client key / code", "Clé / code du client", "Llave / código del cliente", "Kundenschlüssel / Code"], "accessRequired": ["obrigatorio", "required", "obligatoire", "obligatorio", "erforderlich"], "accessNoCode": ["Sem codigo", "No code", "Aucun code", "Sin código", "Kein Code"], "accessWeekly": ["Repeticao semanal", "Repeats weekly", "Répétition hebdomadaire", "Repetición semanal", "Wöchentliche Wiederholung"], "accessMonthly": ["Repeticao mensal", "Repeats monthly", "Répétition mensuelle", "Repetición mensual", "Monatliche Wiederholung"], "accessQuarterly": ["Repeticao trimestral", "Repeats quarterly", "Répétition trimestrielle", "Repetición trimestral", "Vierteljährliche Wiederholung"], "accessSemiannual": ["Repeticao semestral", "Repeats every six months", "Répétition semestrielle", "Repetición semestral", "Halbjährliche Wiederholung"], "accessYearly": ["Repeticao anual", "Repeats yearly", "Répétition annuelle", "Repetición anual", "Jährliche Wiederholung"], "accessCustom": ["Repeticao personalizada: {detail}", "Custom repetition: {detail}", "Répétition personnalisée : {detail}", "Repetición personalizada: {detail}", "Benutzerdefinierte Wiederholung: {detail}"], "accessReminder": ["Lembrete", "Reminder", "Rappel", "Recordatorio", "Erinnerung"], "accessRecurringLate": ["Lembrete recorrente atrasado", "Overdue recurring reminder", "Rappel récurrent en retard", "Recordatorio recurrente vencido", "Überfällige wiederkehrende Erinnerung"], "accessLate": ["Lembrete atrasado", "Overdue reminder", "Rappel en retard", "Recordatorio vencido", "Überfällige Erinnerung"], "accessRecurring": ["Lembrete recorrente", "Recurring reminder", "Rappel récurrent", "Recordatorio recurrente", "Wiederkehrende Erinnerung"], "accessOneTime": ["Lembrete pontual", "One-time reminder", "Rappel ponctuel", "Recordatorio puntual", "Einmalige Erinnerung"], "accessNoDate": ["Sem data definida", "No date set", "Aucune date définie", "Sin fecha definida", "Kein Datum festgelegt"], "accessWhen": ["Quando: {date}", "When: {date}", "Quand : {date}", "Cuándo: {date}", "Wann: {date}"], "accessPoolNotes": ["Notas da piscina", "Pool notes", "Consignes de la piscine", "Notas de la piscina", "Poolhinweise"], "accessAttention": ["Atencao antes de entrar", "Check before entering", "À vérifier avant d’entrer", "Atención antes de entrar", "Vor dem Betreten prüfen"], "accessReturn": ["Regresso agendado pelo escritório", "Return scheduled by the office", "Retour planifié par le bureau", "Regreso programado por la oficina", "Rückkehr vom Büro geplant"], "accessConfirmReturn": ["Confirme as instruções com o escritório", "Confirm the instructions with the office", "Confirmez les consignes avec le bureau", "Confirma las instrucciones con la oficina", "Bestätigen Sie die Anweisungen mit dem Büro"], "accessConfirm": ["Confirma codigos, chaves e instrucoes desta piscina antes de iniciar ou concluir a visita.", "Check this pool’s codes, keys and instructions before starting or completing the visit.", "Vérifiez les codes, clés et consignes de cette piscine avant de commencer ou de terminer la visite.", "Confirma los códigos, llaves e instrucciones de esta piscina antes de iniciar o completar la visita.", "Prüfen Sie die Codes, Schlüssel und Anweisungen dieses Pools, bevor Sie den Besuch beginnen oder abschließen."], "accessCount": ["{count} acesso(s)", "{count} access item(s)", "{count} accès", "{count} acceso(s)", "{count} Zugangshinweise"], "accessReminderCount": ["{count} lembrete(s)", "{count} reminder(s)", "{count} rappel(s)", "{count} recordatorio(s)", "{count} Erinnerungen"], "accessToast": ["Atencao: esta visita tem {count} aviso(s), notas ou lembretes.", "Attention: this visit has {count} notice(s), notes or reminders.", "Attention : cette visite comporte {count} consigne(s), notes ou rappels.", "Atención: esta visita tiene {count} aviso(s), notas o recordatorios.", "Achtung: Dieser Besuch hat {count} Hinweise, Notizen oder Erinnerungen."], "accessNoPool": ["Sem piscina selecionada.", "No pool selected.", "Aucune piscine sélectionnée.", "No hay una piscina seleccionada.", "Kein Pool ausgewählt."], "accessNone": ["Sem código, nota ou lembrete registado", "No access code, note or reminder recorded", "Aucun code d’accès, consigne ou rappel enregistré", "No hay códigos, notas ni recordatorios registrados", "Kein Zugangscode, Hinweis oder Erinnerung gespeichert"], "accessRegister": ["Se esta piscina precisar de codigo de portao, alarme, chave ou aviso permanente, o administrador deve registar na ficha do cliente ou da piscina.", "If this pool needs a gate code, alarm, key or permanent notice, the administrator must record it in the client or pool record.", "Si cette piscine nécessite un code de portail, une alarme, une clé ou une consigne permanente, l’administrateur doit l’enregistrer dans la fiche du client ou de la piscine.", "Si esta piscina necesita un código de puerta, una alarma, una llave o un aviso permanente, el administrador debe registrarlo en la ficha del cliente o de la piscina.", "Benötigt dieser Pool einen Torcode, einen Alarm, einen Schlüssel oder einen dauerhaften Hinweis, muss der Administrator dies im Kunden- oder Pooldatensatz eintragen."], "sourcePool": ["Piscina", "Pool", "Piscine", "Piscina", "Pool"], "sourceClient": ["Cliente", "Client", "Client", "Cliente", "Kunde"]};
const fieldIds = ['notes','ph','chlorine','alkalinity','salt','orp','temperature','cleaned','vacuumed','basketCleaned','brushed','waterlineClean','backwashDone'];
let browser, completed = false, checks = 0;
const deadline = setTimeout(() => { console.error('Access language scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const day = ['year','month','day'].map(name => parts.find(part => part.type === name).value).join('-'), scheduledAt = new Date(day + 'T12:00:00.000Z');
  const vehicle = await prisma.vehicle.create({ data: { plate: 'ACCESS-LANG-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Access owner <b>{day}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Access language client', active: true } });
  const pools = await Promise.all(['REGULAR','EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' access <b>{date}</b>', notes: type === 'REGULAR' ? 'Acesso e avisos\nPool note <b>{date}</b>' : null, active: true } })));
  const poolAccess = [], clientAccess = [], reminderRows = [];
  for (const [code,required] of [['Portao',true],['OPTIONAL <b>{date}</b>',false]]) {
    await prisma.keyAccess.create({ data: { keyCode: code + ':' + now, description: 'Pool instructions: Sem codigo <b>{date}</b>', requiredForVisit: required, active: true, visibleToTechnician: true,pools: { connect: { id: pools[0].id } } } });
    poolAccess.push({ code: code + ':' + now,type: 'accessKey',source: 'sourcePool',required,titleKey: 'accessPoolKey',instructions: 'Pool instructions: Sem codigo <b>{date}</b>' });
  }
  for (const type of ['GATE','ALARM','BOX','KEY','CODE','OTHER']) {
    const code = type === 'CODE' ? null : 'Client code ' + type + ' <b>{date}</b>',title = type === 'GATE' ? 'Chave / codigo do cliente' : type === 'KEY' ? null : 'Client title ' + type + ' <b>{date}</b>',instructions = 'Client instructions: Sem codigo <b>{date}</b>';
    await prisma.clientAccess.create({ data: { clientId: client.id,accessType: type,codeValue: code,title,instructions,active: true,visibleToTechnician: true } });
    clientAccess.push({ code,type: { GATE: 'accessGate',ALARM: 'accessAlarm',BOX: 'accessKeyBox',KEY: 'accessKey',CODE: 'accessCode',OTHER: 'accessGeneric' }[type],source: 'sourceClient',required: true,title,titleKey: 'accessClientKey',instructions });
  }
  await prisma.keyAccess.create({ data: { keyCode: 'PRIVATE HIDDEN KEY:' + now,active: true,visibleToTechnician: false,pools: { connect: { id: pools[0].id } } } });
  await prisma.clientAccess.create({ data: { clientId: client.id,codeValue: 'PRIVATE HIDDEN CLIENT',instructions: 'Private instruction',active: true,visibleToTechnician: false } });
  const rules = ['WEEKLY','MONTHLY','QUARTERLY','SEMIANNUAL','YEARLY','ANNUAL','CUSTOM:<b>{date}</b>','Repeticao semanal','NONE','NONE'];
  for (const [index,rule] of rules.entries()) {
    const due = new Date(now + (index % 2 ? 1 : -1) * 86400000),title = index === 9 ? '' : 'Reminder ' + index + ' <b>{date}</b>',description = 'Reminder description: Lembrete <b>{date}</b>';
    await prisma.generalReminder.create({ data: { clientId: client.id,poolId: pools[0].id,title,description,dueAt: due,repeatRule: rule,status: 'PENDING' } });
    reminderRows.push({ pool: true,title,description,due: due.toISOString(),rule,overdue: index % 2 === 0 });
  }
  for (const pool of [true,false]) {
    const due = new Date(now - 86400000),title = pool ? 'Operation <b>{date}</b>' : 'Client operation <b>{date}</b>',description = 'Operational description <b>{date}</b>';
    await prisma.operationalReminder.create({ data: { clientId: client.id,...(pool ? { poolId: pools[0].id } : {}),title,description,dueDate: due,assignedToTechnicianId: tech.id,isCompleted: false } });
    reminderRows.push({ pool,title,description,due: due.toISOString(),rule: '',overdue: true });
  }
  const clientDue = new Date(now + 86400000);
  await prisma.generalReminder.create({ data: { clientId: client.id,title: 'Lembrete',description: 'Client reminder description <b>{date}</b>',dueAt: clientDue,repeatRule: 'NONE',status: 'PENDING' } });
  reminderRows.push({ pool: false,title: 'Lembrete',description: 'Client reminder description <b>{date}</b>',due: clientDue.toISOString(),rule: 'NONE',overdue: false });
  await prisma.generalReminder.create({ data: { clientId: client.id,poolId: pools[0].id,title: 'PRIVATE COMPLETED REMINDER',dueAt: new Date(now),status: 'PENDING',completedAt: new Date(now) } });
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1, common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date(now) };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: scheduledAt, plannedDate: scheduledAt } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt } });
  for (const table of ['ServiceVisit','ExtraVisit']) await prisma.$queryRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"' + table + '"\',\'id\'),' + id + ',true)');
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-NET-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 30 * 86400000), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE','INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 30 * 86400000) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }), legacyKey = 'cwFieldVisitDrafts:' + tech.id;
  const archive = JSON.stringify({ owner: 'TECH:999999', drafts: { ['visit-' + id]: { notes: 'PRIVATE UNOWNED DRAFT <b>{day}</b>', ph: '99' } } });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1400 }, timezoneId: 'Europe/Lisbon' }), requests = [], errors = [];
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaConnectionLanguages')) {
      for (const key of ['token','cristalwater_jwt','adminToken']) localStorage.setItem(key, token);
      for (const key of ['user','cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('qaConnectionLanguages','1');
    }
    // Keep the tab click real while removing animated movement from snapshot timing.
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(options) { return scrollIntoView.call(this, options && typeof options === 'object' ? { ...options,behavior: 'instant' } : options); };
    const interval = window.setInterval;
    window.setInterval = (callback, delay, ...args) => [15000,30000,60000].includes(delay) ? 0 : interval(callback, delay, ...args);
    Object.defineProperty(navigator,'geolocation',{ value: { watchPosition: () => 1, clearWatch() {} } });
  }, { token, tech, origin: base });
  const page = await context.newPage(); page.setDefaultTimeout(10000); await page.clock.setFixedTime(now);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) requests.push({ path, method: request.method(), body: request.postData(), auth: request.headers().authorization }); });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const locale = async language => { await settle(); await page.evaluate(() => window.scrollTo({ top: 0,behavior: 'instant' })); await settle(); await page.locator('#cwLanguageSelect').selectOption(language); await settle(); };
  const ready = async type => {
    await page.waitForFunction(({ id, type }) => window.CWFieldVisitContext?.()?.id === id && CWFieldVisitContext().visitType === type && ['transportGuideBox','workGuideBox','insuranceBox'].every(key => ['live','cache'].includes(document.getElementById(key).dataset.source)) && !['…',''].includes(document.getElementById('fieldPhotosValue')?.textContent), { id, type });
    await page.locator('[data-field-tab-button=agora]').click(); await settle();
  };
  const open = async type => { await page.goto(base + '/technician-field-mode?selectedVisitId=' + id + '&selectedVisitType=' + type, { waitUntil: 'domcontentloaded' }); await ready(type); };
  const fill = async type => {
    for (const [field,value] of Object.entries({ notes: type + ' access draft <b>{date}</b>', ph: type === 'REGULAR' ? '7.4' : '7.1', chlorine: '1.2', alkalinity: '90', salt: '3.2', orp: '680', temperature: '24' })) await page.locator('#' + field).fill(value);
    for (const [field,value] of Object.entries({ cleaned: true, vacuumed: false, basketCleaned: true, brushed: false, waterlineClean: true, backwashDone: false })) await page.locator('#' + field).setChecked(value);
    await page.waitForFunction(({ id,owner,type }) => { const raw = localStorage.getItem('cwFieldVisitDrafts:v2:' + owner); return document.getElementById('fieldSaveStatus').dataset.state === 'saved' && raw && JSON.parse(raw).drafts['visit-' + type + '-' + id]?.values.notes === type + ' access draft <b>{date}</b>'; },{ id,owner: 'TECH:' + tech.id,type });
  };
  const raw = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key)).sort().map(key => [key,localStorage.getItem(key)])));
  const pending = () => page.evaluate(() => new Promise((resolve,reject) => {
    const request = indexedDB.open('cw-field-writes',1); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, read = db.transaction('requests').objectStore('requests').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.sort((a,b) => a.key.localeCompare(b.key))); }; read.onerror = () => reject(read.error); };
  }));
  const database = () => Promise.all([prisma.serviceVisit.findUnique({ where: { id } }), prisma.extraVisit.findUnique({ where: { id } }), prisma.transportGuide.findUnique({ where: { id: guide.id } }), prisma.workGuide.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count(),prisma.clientAccess.findMany({ where: { clientId: client.id },orderBy: { id: 'asc' } }),prisma.generalReminder.findMany({ where: { clientId: client.id },orderBy: { id: 'asc' } }),prisma.operationalReminder.findMany({ where: { clientId: client.id },orderBy: { id: 'asc' } }),prisma.keyAccess.findMany({ where: { pools: { some: { id: pools[0].id } } },orderBy: { id: 'asc' } }),prisma.pool.findMany({ where: { id: { in: pools.map(pool => pool.id) } },orderBy: { id: 'asc' } })]);
  const track = () => page.evaluate(() => {
    window.qaNetworkCalls = {};
    if (window.qaNetworkTracking) return;
    window.qaNetworkTracking = true; window.qaNetworkReads = 0;
    for (const [group,api,names] of [['route',CWFieldRouteCache,['read','save','update','fromResponse']],['documents',CWFieldDocuments,['load']],['photos',CWFieldPhotos,['list','save','sync']],['draft',CWFieldVisitDrafts,['save','prepare','load']],['writes',CWFieldWriteStore,['prepare','attempt','acknowledge']]]) for (const name of names) {
      const original = api?.[name]; if (typeof original !== 'function') continue;
      api[name] = (...args) => { const key = group + ':' + name; qaNetworkCalls[key] = (qaNetworkCalls[key] || 0) + 1; const result = original(...args); if (result?.then) { qaNetworkReads++; result.then(() => qaNetworkReads--,() => qaNetworkReads--); } return result; };
    }
  });
  const waitReads = () => page.waitForFunction(() => !window.qaNetworkReads);
  const state = () => page.evaluate(async () => {
    const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value || '')))].map(byte => byte.toString(16).padStart(2,'0')).join('');
    const session = Object.fromEntries(Object.keys(sessionStorage).sort().map(key => { const raw = sessionStorage.getItem(key); if (key === 'cw:ctx:/technician-field-mode') { const copy = JSON.parse(raw); delete copy.fields?.cwLanguageSelect; return [key,copy]; } return [key,raw]; }));
    return { day: CWFieldDaySnapshot(), visit: CWFieldVisitContext(), calls: qaNetworkCalls, tokens: await Promise.all(['token','cristalwater_jwt','adminToken'].map(key => digest(localStorage.getItem(key)))), users: ['user','cristalwater_user'].map(key => { const user = JSON.parse(localStorage.getItem(key)); delete user.language; return user; }), session, fields: qaNetworkFields.map(node => [node.id,node.value,node.checked,node.disabled,node.readOnly,node.hidden]), badge: { offline: qaNetworkBadge.dataset.offline, hidden: qaNetworkBadge.hidden, className: qaNetworkBadge.className }, history: { hidden: qaNetworkHistory.hidden, role: qaNetworkHistory.getAttribute('role'), manual: qaNetworkHistory.getAttribute('data-cw-state-managed') }, controls: qaNetworkControls.map(node => [node.id,node.hidden,node.disabled]) };
  });
  const text = (key,index,params = {}) => words[key][index].replace(/\{(\w+)\}/g,(_,name) => params[name]);
  const selectedAccess = type => type === 'REGULAR' ? [...poolAccess,...clientAccess] : clientAccess;
  const selectedReminders = type => reminderRows.filter(row => type === 'REGULAR' || !row.pool);
  const repeatText = (rule,index) => {
    const keys = { WEEKLY: 'accessWeekly',MONTHLY: 'accessMonthly',QUARTERLY: 'accessQuarterly',SEMIANNUAL: 'accessSemiannual',YEARLY: 'accessYearly',ANNUAL: 'accessYearly' };
    if (Object.hasOwn(keys,rule)) return text(keys[rule],index);
    if (rule.startsWith('CUSTOM')) return text('accessCustom',index,{ detail: rule.replace(/^CUSTOM[:|]?/i,'') });
    return rule === 'NONE' ? '' : rule;
  };
  const display = () => page.locator('#accessList').evaluate(list => ({
    access: [...list.querySelectorAll('.access-code-item')].map(row => ({ chip: row.querySelector('.chip').textContent,code: row.querySelector('.access-code').textContent,meta: [...row.querySelector('.access-meta').childNodes].filter(node => node.nodeName !== 'BR').map(node => node.textContent) })),
    reminders: [...list.querySelectorAll('.access-item:not(.access-code-item):not([data-pool-notes])')].filter(row => row.querySelector('.chip')).map(row => ({ label: row.querySelector('.chip > span').textContent,source: row.querySelector('.chip > span:last-child').textContent,title: row.querySelector('.access-code').textContent,meta: [...row.querySelector('.access-meta').childNodes].filter(node => node.nodeName !== 'BR').map(node => node.textContent),className: row.className })),
    notes: list.querySelector('[data-pool-notes] .access-meta')?.textContent || '',notesLabel: list.querySelector('[data-pool-notes] .chip')?.textContent || '',
    strip: (() => { const strip = document.getElementById('visitNoticeStrip'); return { hidden: strip.hidden,title: strip.querySelector('b')?.textContent || '',instructions: strip.querySelector('p')?.textContent || '',hint: strip.querySelector('small')?.textContent || '',pills: [...strip.querySelectorAll('.visit-notice-pill')].map(node => node.textContent) }; })()
  }));
  async function matrix({ name,type = 'REGULAR',empty = false,noNotices = false,noDate = false,foreign = false,returning = false,instructions = '',widths = [320,390,1440],pendingCount = 0 }) {
    await waitReads(); await page.locator('[data-field-tab-button=agora]').click(); await page.locator('#cwLanguageSelect').focus(); await locale('pt'); await track(); await settle();
    await page.evaluate(ids => { window.qaNetworkBadge = document.getElementById('connectionState'); window.qaNetworkHistory = document.getElementById('fieldDraftHistory'); window.qaNetworkFields = ids.map(id => document.getElementById(id)); window.qaNetworkControls = ['startBtn','finishBtn','fieldReloadBtn'].map(id => document.getElementById(id)); window.qaNetworkHandlers = qaNetworkControls.map(node => node.onclick); window.qaNetworkFocus = document.activeElement; window.qaAccessNodes = [...document.querySelectorAll('#accessCard,#accessCard *,#visitNoticeStrip,#visitNoticeStrip *')]; },fieldIds);
    const before = await state(),stored = await raw(),records = await pending(),db = await database(),first = requests.length;
    const accesses = selectedAccess(type),reminders = selectedReminders(type).map(row => noDate && row.title === reminderRows[0].title ? { ...row,due: null,overdue: false } : row),notes = type === 'REGULAR' ? 'Acesso e avisos\nPool note <b>{date}</b>' : '';
    const dates = await page.evaluate(values => values.map(raw => raw ? new Date(raw).toLocaleString('pt-PT',{ dateStyle: 'short',timeStyle: 'short' }) : null),reminders.map(row => row.due));
    assert.equal(records.length,pendingCount); assert(records.every(row => !row.response));
    for (const width of widths) { await page.setViewportSize({ width,height: 1400 }); for (const [index,language] of languages.entries()) {
      await locale(language); const shown = await display();
      assert.equal(await page.locator('#accessCard > .chip').textContent(),text('accessTitle',index)); assert.equal(await page.locator('#accessCard .field-tab-title h2').textContent(),text('accessGeneric',index)); assert.equal(await page.locator('#accessCard .field-tab-title span').textContent(),text('accessSectionHint',index));
      if (empty || noNotices) {
        assert.equal(await page.locator('#accessList .access-code').count(),noNotices ? 1 : 0);
        assert.equal(await page.locator(empty ? '#accessList .muted' : '#accessList .access-code').textContent(),text(empty ? 'accessNoPool' : 'accessNone',index));
        if (noNotices) assert.equal(await page.locator('#accessList .access-meta').textContent(),text('accessRegister',index));
        assert.deepEqual(shown.access,[]); assert.deepEqual(shown.reminders,[]); assert.equal(shown.strip.hidden,true);
      } else {
        assert.equal(shown.access.length,accesses.length); assert.equal(shown.reminders.length,reminders.length); assert.equal(shown.notes,notes); if (notes) assert.equal(shown.notesLabel,text('accessPoolNotes',index));
        for (const [position,access] of accesses.entries()) {
          const code = access.code || text('accessNoCode',index),row = shown.access.find(row => row.code === code); assert(row,'Key/code retained: ' + code);
          const part = [text(access.type,index),text(access.source,index),...(access.required ? [text('accessRequired',index)] : [])].join(' - ');
          assert.equal(row.chip,foreign && position === 0 ? [text(access.type,0),text(access.source,0),...(access.required ? [text('accessRequired',0)] : [])].join(' - ') : part);
          assert.deepEqual(row.meta,[access.title || text(access.titleKey,index),access.instructions]);
        }
        for (const [position,reminder] of reminders.entries()) {
          const title = reminder.title || text('accessReminder',index),source = text(reminder.pool ? 'sourcePool' : 'sourceClient',index),matching = shown.reminders.filter(row => row.title === title && row.source === source); assert.equal(matching.length,1,'Reminder retained once in its source: ' + source + '/' + title); const row = matching[0];
          const recurring = !!reminder.rule && reminder.rule !== 'NONE',label = reminder.overdue ? recurring ? 'accessRecurringLate' : 'accessLate' : recurring ? 'accessRecurring' : 'accessOneTime';
          assert.equal(row.label,text(label,index)); assert.equal(row.source,text(reminder.pool ? 'sourcePool' : 'sourceClient',index));
          assert.deepEqual(row.meta,[reminder.description,text('accessWhen',index,{ date: dates[position] || text('accessNoDate',index) }),repeatText(reminder.rule,index)].filter(Boolean)); assert.equal(row.className,'access-item ' + (reminder.overdue ? 'reminder-overdue' : recurring ? 'reminder-permanent' : 'reminder-temporary'));
        }
        assert.equal(shown.strip.hidden,false); assert.equal(shown.strip.title,foreign ? text('accessAttention',0) : text(returning ? 'accessReturn' : 'accessAttention',index)); assert.equal(shown.strip.hint,text('accessConfirm',index)); assert.equal(shown.strip.instructions,returning ? instructions || text('accessConfirmReturn',index) : '');
        assert.deepEqual(shown.strip.pills,[...(notes ? [text('accessPoolNotes',index)] : []),text('accessCount',index,{ count: accesses.length }),text('accessReminderCount',index,{ count: reminders.length })]);
        assert(await page.locator('.visit-notice-pills').evaluate(node => { const boxes = [...node.children].map(child => child.getBoundingClientRect()),host = node.getBoundingClientRect(); return boxes.every((box,index) => box.left >= host.left - 1 && box.right <= host.right + 1 && (!index || box.top >= boxes[index-1].bottom + 1 || box.left >= boxes[index-1].right + 1)); }),'Notice counts remain distinct and within the card');
      }
      assert.deepEqual(await state(),before); assert.deepEqual(await raw(),stored); assert.deepEqual(await pending(),records); assert.deepEqual(await database(),db);
      assert(await page.evaluate(() => qaAccessNodes.every(node => node.isConnected) && qaNetworkFields.every(node => node.isConnected && node === document.getElementById(node.id)) && qaNetworkControls.every((node,index) => node.isConnected && node.onclick === qaNetworkHandlers[index]) && document.activeElement === qaNetworkFocus));
      assert.equal(await page.locator('#accessList b,#accessList script,#visitNoticeStrip p b').count(),0); assert(!(await page.locator('#accessList').textContent()).includes('PRIVATE'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),'Page bounds ' + name + '/' + language + '/' + width);
      assert(await page.locator('#accessCard').evaluate(node => node.scrollWidth <= node.clientWidth + 1),'Access card bounds ' + name + '/' + language + '/' + width); checks++;
    }}
    if (process.env.CW_ACCESS_CAPTURE && !empty && !foreign) { await fs.mkdir(process.env.CW_ACCESS_CAPTURE,{ recursive: true }); await page.setViewportSize({ width: 320,height: 1400 }); await page.locator('#accessCard').screenshot({ path: process.env.CW_ACCESS_CAPTURE + '/' + name + '-access-de-320.png' }); if (!noNotices) await page.locator('#visitNoticeStrip').screenshot({ path: process.env.CW_ACCESS_CAPTURE + '/' + name + '-notice-de-320.png' }); await page.locator('#cwLanguageSelect').focus(); await page.evaluate(() => window.scrollTo({ top: 0,behavior: 'instant' })); await settle(); }
    for (const request of requests.slice(first)) { assert.equal(request.path,'/api/settings/language/me'); assert.equal(request.method,'PUT'); assert.deepEqual(Object.keys(JSON.parse(request.body)),['language']); assert.equal(request.auth,'Bearer ' + token); }
    console.log('PASS access languages ' + JSON.stringify({ name,widths,checks,pendingCount,noOperationalWrites: true,originalCodesInstructionsDates: true }));
  }
  let selectedType = 'REGULAR'; const reload = async () => { await page.locator('#fieldReloadBtn').evaluate(node => node.click()); await ready(selectedType); await waitReads(); await page.waitForFunction(() => document.getElementById('fieldLoadError').hidden); };
  await open('REGULAR');
  for (const [index,language] of languages.entries()) { await locale(language); assert.equal(await page.locator('#toast').textContent(),text('accessToast',index,{ count: poolAccess.length + clientAccess.length + reminderRows.length + 1 })); checks++; }
  await locale('pt'); await fill('REGULAR'); await open('EXTRA'); await fill('EXTRA'); await open('REGULAR'); await track(); await matrix({ name: 'regular-full' });
  await locale('pt'); await page.evaluate(code => { const row = [...document.querySelectorAll('#accessList .access-code-item')].find(row => row.querySelector('.access-code').textContent === code); for (const node of [row.querySelector('.chip > span'),document.querySelector('#visitNoticeStrip b')]) node.replaceChildren(document.createTextNode(node.textContent)); },poolAccess[0].code); await matrix({ name: 'foreign-identical-owned-leaves',foreign: true,widths: [320] });
  const endpoint = '**/api/technician/today?*'; let returnInstructions = 'Levar peça <b>{date}</b>';
  await page.route(endpoint,async route => { const response = await route.fetch(),json = await response.json(); json.visits = json.visits.map(visit => visit.id === id && visit.visitType === 'REGULAR' ? { ...visit,reason: 'INCOMPLETE_RETURN',returnInstructions } : visit); await route.fulfill({ response,json }); });
  await reload(); await matrix({ name: 'return-source-instructions',returning: true,instructions: returnInstructions }); returnInstructions = ''; await reload(); await matrix({ name: 'return-fallback-instructions',returning: true,widths: [320] }); await page.unroute(endpoint);
  await page.route(endpoint,async route => { const response = await route.fetch(),json = await response.json(); for (const visit of json.visits) if (visit.id === id && visit.visitType === 'REGULAR') for (const reminder of visit.pool.generalReminders) if (reminder.title === reminderRows[0].title) { reminder.dueAt = null; reminder.dueDate = null; } await route.fulfill({ response,json }); });
  await reload(); await matrix({ name: 'source-reminder-without-date',noDate: true,widths: [320] }); await page.unroute(endpoint);
  await open('EXTRA'); selectedType = 'EXTRA'; await track(); await matrix({ name: 'extra-client-notices',type: 'EXTRA' });
  await prisma.clientAccess.updateMany({ where: { clientId: client.id },data: { active: false } }); await prisma.generalReminder.updateMany({ where: { clientId: client.id,poolId: null },data: { completedAt: new Date(now) } }); await prisma.operationalReminder.updateMany({ where: { clientId: client.id,poolId: null },data: { isCompleted: true } }); await reload(); await matrix({ name: 'extra-no-instructions',type: 'EXTRA',noNotices: true });
  await page.route(endpoint,route => route.fulfill({ status: 200,json: { ok: true,complete: true,date: day,technicianId: tech.id,total: 0,visits: [] } })); await page.locator('#fieldReloadBtn').evaluate(node => node.click()); await page.waitForFunction(() => CWFieldDaySnapshot().visits.length === 0 && document.getElementById('fieldLoadError').hidden); await waitReads(); await matrix({ name: 'no-selected-pool',empty: true,widths: [320] }); await page.unroute(endpoint);
  await prisma.clientAccess.updateMany({ where: { clientId: client.id },data: { active: true } }); await prisma.generalReminder.updateMany({ where: { clientId: client.id,poolId: null },data: { completedAt: null } }); await prisma.operationalReminder.updateMany({ where: { clientId: client.id,poolId: null },data: { isCompleted: false } });
  await open('REGULAR'); selectedType = 'REGULAR'; await track(); await locale('en');
  await page.evaluate(async id => { await CWFieldWriteStore.prepare('VISIT_COMPLETION',id,{ visitId: id,notes: 'REGULAR access pending <b>{date}</b>' }); await CWFieldWriteStore.prepare('EXTRA_VISIT_COMPLETION',id,{ visitType: 'EXTRA',notes: 'EXTRA access pending <b>{date}</b>' }); },id);
  const originalPending = await pending(),originalDb = await database(); assert.deepEqual(originalPending.map(row => row.scope).sort(),['EXTRA_VISIT_COMPLETION','VISIT_COMPLETION']); assert(originalPending.every(row => row.resourceId === id && row.owner === 'TECH:' + tech.id && row.payloadHash.length === 64 && !row.response)); assert.notEqual(originalPending[0].requestId,originalPending[1].requestId);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller); await context.setOffline(true); await page.waitForFunction(() => document.getElementById('connectionState').dataset.offline === 'true'); await matrix({ name: 'regular-offline-event',pendingCount: 2 });
  await open('EXTRA'); selectedType = 'EXTRA'; await track(); assert.equal(await page.locator('#notes').inputValue(),'EXTRA access draft <b>{date}</b>'); assert.equal(await page.evaluate(() => CWFieldDaySnapshot().confirmedAt),null); await matrix({ name: 'extra-offline-cached-shell',type: 'EXTRA',widths: [320],pendingCount: 2 });
  assert.deepEqual(await pending(),originalPending); assert.deepEqual(await database(),originalDb); assert.deepEqual(errors,[]); assert(requests.filter(request => !['GET','HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));
  console.log('PASS access language result ' + JSON.stringify({ checks,scenarios: 10,ownedEntries: 37,languages: 5,typedDraftFields: 13,immutablePending: 2,originalCodesInstructionsDates: true,foreignCopiesLiteral: true,cachedExtraShell: true,noOperationalWrites: true })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
