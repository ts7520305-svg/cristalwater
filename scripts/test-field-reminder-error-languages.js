'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  "session": [
    "A sessão mudou. Reabra a página com a conta original. Os lembretes foram preservados.",
    "The session changed. Reopen the page with the original account. Reminders were preserved.",
    "La session a changé. Rouvrez la page avec le compte d’origine. Les rappels ont été conservés.",
    "La sesión ha cambiado. Vuelva a abrir la página con la cuenta original. Los recordatorios se han conservado.",
    "Die Sitzung hat sich geändert. Öffnen Sie die Seite erneut mit dem ursprünglichen Konto. Die Erinnerungen bleiben erhalten."
  ],
  "unreadable": [
    "Lembretes ilegíveis. Preserve os dados deste telemóvel e contacte o escritório.",
    "Unreadable reminders. Keep the data on this phone and contact the office.",
    "Rappels illisibles. Conservez les données de ce téléphone et contactez le bureau.",
    "Recordatorios ilegibles. Conserve los datos de este teléfono y contacte con la oficina.",
    "Unlesbare Erinnerungen. Bewahren Sie die Daten auf diesem Telefon auf und kontaktieren Sie das Büro."
  ],
  "invalid": [
    "Lembretes inválidos. Preserve os dados deste telemóvel e contacte o escritório.",
    "Invalid reminders. Keep the data on this phone and contact the office.",
    "Rappels invalides. Conservez les données de ce téléphone et contactez le bureau.",
    "Recordatorios no válidos. Conserve los datos de este teléfono y contacte con la oficina.",
    "Ungültige Erinnerungen. Bewahren Sie die Daten auf diesem Telefon auf und kontaktieren Sie das Büro."
  ],
  "saveLocks": [
    "Este navegador não permite guardar lembretes em segurança.",
    "This browser cannot save reminders safely.",
    "Ce navigateur ne permet pas d’enregistrer les rappels en toute sécurité.",
    "Este navegador no permite guardar recordatorios de forma segura.",
    "Dieser Browser kann Erinnerungen nicht sicher speichern."
  ],
  "notSaved": [
    "A gravação do lembrete não ficou confirmada.",
    "Saving the reminder was not confirmed.",
    "L’enregistrement du rappel n’a pas été confirmé.",
    "No se ha confirmado que el recordatorio se haya guardado.",
    "Das Speichern der Erinnerung wurde nicht bestätigt."
  ],
  "context": [
    "Selecione uma visita com piscina confirmada.",
    "Select a visit with a confirmed pool.",
    "Sélectionnez une visite dont la piscine est confirmée.",
    "Seleccione una visita con una piscina confirmada.",
    "Wählen Sie einen Besuch mit bestätigtem Pool."
  ],
  "kind": [
    "Lembrete inválido.",
    "Invalid reminder.",
    "Rappel invalide.",
    "Recordatorio no válido.",
    "Ungültige Erinnerung."
  ],
  "deadline": [
    "Indique um prazo até 24 horas e uma nota até 4000 caracteres.",
    "Set a deadline within 24 hours and a note of up to 4000 characters.",
    "Indiquez un délai de 24 heures maximum et une note de 4000 caractères maximum.",
    "Indique un plazo máximo de 24 horas y una nota de hasta 4000 caracteres.",
    "Geben Sie eine Frist von höchstens 24 Stunden und eine Notiz mit höchstens 4000 Zeichen an."
  ],
  "duplicate": [
    "Esta visita já tem este lembrete ativo.",
    "This visit already has an active reminder of this kind.",
    "Cette visite a déjà un rappel actif de ce type.",
    "Esta visita ya tiene un recordatorio activo de este tipo.",
    "Für diesen Besuch gibt es bereits eine aktive Erinnerung dieser Art."
  ],
  "missing": [
    "Lembrete não encontrado. Atualize a página.",
    "Reminder not found. Refresh the page.",
    "Rappel introuvable. Actualisez la page.",
    "No se ha encontrado el recordatorio. Actualice la página.",
    "Erinnerung nicht gefunden. Aktualisieren Sie die Seite."
  ],
  "offline": [
    "Sem ligação. O lembrete permanece neste telemóvel.",
    "No connection. The reminder remains on this phone.",
    "Aucune connexion. Le rappel reste sur ce téléphone.",
    "Sin conexión. El recordatorio permanece en este teléfono.",
    "Keine Verbindung. Die Erinnerung bleibt auf diesem Telefon."
  ],
  "expired": [
    "Sessão expirada. Volte a entrar com a mesma conta.",
    "Session expired. Sign in again with the same account.",
    "Session expirée. Reconnectez-vous avec le même compte.",
    "Sesión caducada. Vuelva a entrar con la misma cuenta.",
    "Sitzung abgelaufen. Melden Sie sich erneut mit demselben Konto an."
  ],
  "server": [
    "O servidor ainda não confirmou o lembrete.",
    "The server has not confirmed the reminder yet.",
    "Le serveur n’a pas encore confirmé le rappel.",
    "El servidor aún no ha confirmado el recordatorio.",
    "Der Server hat die Erinnerung noch nicht bestätigt."
  ],
  "interrupted": [
    "Ligação interrompida. O registo continua neste telemóvel.",
    "Connection interrupted. The record remains on this phone.",
    "Connexion interrompue. L’enregistrement reste sur ce téléphone.",
    "Conexión interrumpida. El registro permanece en este teléfono.",
    "Verbindung unterbrochen. Der Eintrag bleibt auf diesem Telefon."
  ],
  "incomplete": [
    "Resposta incompleta. Conserve o lembrete original.",
    "Incomplete response. Keep the original reminder.",
    "Réponse incomplète. Conservez le rappel d’origine.",
    "Respuesta incompleta. Conserve el recordatorio original.",
    "Unvollständige Antwort. Bewahren Sie die ursprüngliche Erinnerung auf."
  ],
  "wrongVisit": [
    "A confirmação pertence a outra visita. Conserve o lembrete original.",
    "The confirmation belongs to another visit. Keep the original reminder.",
    "La confirmation concerne une autre visite. Conservez le rappel d’origine.",
    "La confirmación pertenece a otra visita. Conserve el recordatorio original.",
    "Die Bestätigung gehört zu einem anderen Besuch. Bewahren Sie die ursprüngliche Erinnerung auf."
  ],
  "wrongRequest": [
    "O servidor não confirmou o pedido original.",
    "The server did not confirm the original request.",
    "Le serveur n’a pas confirmé la demande d’origine.",
    "El servidor no ha confirmado la solicitud original.",
    "Der Server hat die ursprüngliche Anfrage nicht bestätigt."
  ],
  "stale": [
    "Estado antigo recebido. O fecho confirmado foi preservado.",
    "An older state was received. The confirmed closure was preserved.",
    "Un ancien état a été reçu. La clôture confirmée a été conservée.",
    "Se ha recibido un estado antiguo. El cierre confirmado se ha conservado.",
    "Ein älterer Status wurde empfangen. Der bestätigte Abschluss bleibt erhalten."
  ],
  "syncLocks": [
    "Este navegador não permite coordenar os lembretes. Preserve os dados.",
    "This browser cannot coordinate reminders. Keep the data.",
    "Ce navigateur ne permet pas de coordonner les rappels. Conservez les données.",
    "Este navegador no permite coordinar los recordatorios. Conserve los datos.",
    "Dieser Browser kann Erinnerungen nicht koordinieren. Bewahren Sie die Daten auf."
  ],
  "list": [
    "Lista de lembretes incompleta.",
    "Incomplete reminder list.",
    "Liste de rappels incomplète.",
    "Lista de recordatorios incompleta.",
    "Unvollständige Erinnerungsliste."
  ],
  "tampered": [
    "O pedido guardado foi alterado. Preserve os dados e peça revisão.",
    "The saved request was changed. Keep the data and ask for a review.",
    "La demande enregistrée a été modifiée. Conservez les données et demandez une vérification.",
    "La solicitud guardada ha sido modificada. Conserve los datos y solicite una revisión.",
    "Die gespeicherte Anfrage wurde geändert. Bewahren Sie die Daten auf und bitten Sie um eine Prüfung."
  ],
  "unconfirmed": [
    "A alteração ainda não ficou confirmada.",
    "The change has not been confirmed yet.",
    "La modification n’a pas encore été confirmée.",
    "El cambio aún no se ha confirmado.",
    "Die Änderung wurde noch nicht bestätigt."
  ],
  "legacy": [
    "Existem lembretes antigos neste telemóvel. Preserve os dados e confirme água/bombas com o escritório.",
    "There are older reminders on this phone. Keep the data and confirm water and pump status with the office.",
    "Ce téléphone contient d’anciens rappels. Conservez les données et confirmez l’état de l’eau et des pompes avec le bureau.",
    "Hay recordatorios antiguos en este teléfono. Conserve los datos y confirme el estado del agua y las bombas con la oficina.",
    "Auf diesem Telefon gibt es ältere Erinnerungen. Bewahren Sie die Daten auf und klären Sie den Wasser- und Pumpenstatus mit dem Büro."
  ]
};
async function helperGuardCases() {
  const vm = require('node:vm'), { createHash, randomUUID } = require('node:crypto');
  const source = fs.readFileSync(require('node:path').join(__dirname, '../frontend/cw-field-reminders.js'), 'utf8');
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  async function fixture() {
    const memory = new Map(), made = [], calls = [], key = 'cwFieldReminders:v1:TECH:41', session = { owner: 'TECH:41', technicianId: 41, token: 'qa-token' };
    const visit = { id: 5, poolId: 9, clientId: 3, visitType: 'REGULAR' };
    const openedAt = new Date().toISOString(), dueAt = new Date(Date.now() + 1800000).toISOString();
    const payload = { visitType: 'REGULAR', visitId: 5, poolId: 9, clientId: 3, dueAt, note: 'literal {key}', flowState: 'FULL', openedAt };
    const row = { ...payload, kind: 'PUMP_MANUAL', localId: randomUUID(), payload, payloadHash: hash({ kind: 'PUMP_MANUAL', ...payload }), owner: session.owner, status: 'OPEN', syncError: 'Por confirmar no servidor' };
    const remote = () => ({ id: 7, poolId: 9, clientId: 3, dueDate: dueAt, createdAt: openedAt, isCompleted: false, sourceKey: 'pump:' + session.owner + ':' + row.localId, assignedToTechnicianId: 41, metadata: { ...payload, owner: session.owner, localId: row.localId, payloadHash: row.payloadHash } });
    const c = vm.createContext({ Date, crypto: { randomUUID }, AbortController, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, Event: class {}, document: { documentElement: { lang: 'pt' } }, navigator: { onLine: false, locks: { request: async (...args) => args.at(-1)({}) } }, localStorage: { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) }, Error: message => { const error = Error(message); made.push(error); return error; } });
    c.window = c; c.addEventListener = () => {}; c.dispatchEvent = () => {}; c.same = true;
    c.CWFieldWriteStore = { session: () => session, same: () => c.same, hash: async v => hash(v) }; c.CWFieldVisitContext = () => visit;
    c.reply = async () => ({ status: 200, json: async () => ({ ok: true, reminders: [] }) });
    c.fetch = async (...args) => { calls.push(args); return c.reply(...args); };
    vm.runInContext(source, c); const api = c.CWFieldReminders; await api.sync();
    const seed = () => memory.set(key, JSON.stringify({ ['PUMP_MANUAL:' + row.localId]: row }));
    const sync = async () => { c.navigator.onLine = true; await api.sync(); };
    const create = () => api.create('PUMP_MANUAL', { dueAt });
    const reply = data => ({ status: 200, json: async () => data });
    return { c, api, memory, made, calls, key, row, remote, seed, sync, create, reply };
  }
  const cases = {
    session: f => { f.c.same = false; f.api.list('PUMP_MANUAL'); },
    unreadable: f => { f.memory.set(f.key, '{broken'); f.api.list('PUMP_MANUAL'); },
    invalid: f => { f.memory.set(f.key, '[]'); f.api.list('PUMP_MANUAL'); },
    saveLocks: f => { f.c.navigator.locks = undefined; return f.create(); },
    notSaved: f => { let written = false; const get = f.c.localStorage.getItem, set = f.c.localStorage.setItem; f.c.localStorage.getItem = k => written && k === f.key ? '{}' : get(k); f.c.localStorage.setItem = (k, v) => { set(k, v); written = true; }; return f.create(); },
    context: f => { f.c.CWFieldVisitContext = () => null; return f.create(); },
    kind: f => f.api.create('UNKNOWN', {}),
    deadline: f => f.api.create('PUMP_MANUAL', { dueAt: new Date(Date.now() - 1000).toISOString() }),
    duplicate: f => { f.seed(); return f.create(); },
    missing: f => f.api.mark('PUMP_MANUAL', 'missing', 'close'),
    offline: f => { let reads = 0; Object.defineProperty(f.c.navigator, 'onLine', { get: () => ++reads === 1 }); return f.api.sync(); },
    expired: f => { f.c.CristalAuth = { isSessionExpired: () => true }; return f.sync(); },
    server: f => { f.c.reply = async () => ({ status: 202, json: async () => ({ ok: true }) }); return f.sync(); },
    interrupted: f => { f.c.reply = async () => { throw TypeError('transport'); }; return f.sync(); },
    incomplete: f => { f.c.reply = async () => f.reply({ ok: true, reminders: [{}] }); return f.sync(); },
    wrongVisit: f => { f.row.serverId = 7; f.seed(); const remote = f.remote(); remote.metadata.visitId = 6; f.c.reply = async () => f.reply({ ok: true, reminders: [remote] }); return f.sync(); },
    wrongRequest: f => { f.row.serverId = 7; f.seed(); const remote = f.remote(); remote.metadata.payloadHash = 'different'; f.c.reply = async () => f.reply({ ok: true, reminders: [remote] }); return f.sync(); },
    stale: f => { f.row.serverId = 7; f.row.status = 'CLOSED'; f.row.syncError = ''; f.row.closeSyncedAt = new Date().toISOString(); f.seed(); f.c.reply = async (url) => f.reply({ ok: true, reminders: url.endsWith('/pump-reminders') ? [f.remote()] : [] }); return f.sync(); },
    syncLocks: f => { f.c.navigator.locks = undefined; return f.sync(); },
    list: f => { f.c.reply = async () => f.reply({ ok: true, reminders: null }); return f.sync(); },
    tampered: f => { f.row.payloadHash = 'changed'; f.seed(); return f.sync(); },
    unconfirmed: f => { f.row.serverId = 7; f.row.status = 'CLOSED'; f.seed(); f.c.reply = async (_, options) => f.reply(options.method === 'GET' ? { ok: true, reminders: [] } : { ok: true, reminder: f.remote() }); return f.sync(); }
  };
  assert.equal(Object.keys(cases).length, 22);
  for (const [name, exercise] of Object.entries(cases)) {
    const f = await fixture(); try { await exercise(f); } catch (error) { assert(f.made.includes(error), name + ' must throw an owned error'); }
    const error = f.made.find(error => error.message === words[name][0]); assert(error, name + ' guard was exercised');
    const value = f.api.presentation.error(error), before = Array.from(f.memory), count = f.calls.length;
    for (const [index, lang] of languages.entries()) { f.c.document.documentElement.lang = lang; assert.equal(f.api.presentation.format(value), words[name][index], name + '/' + lang); assert.equal(error.message, words[name][0]); }
    const external = Error(words[name][0]); external.copy = { key: name }; assert.equal(f.api.presentation.format(f.api.presentation.error(external)), words[name][0]); assert.equal(f.api.presentation.format({ key: name }), '[object Object]');
    f.c.document.documentElement.lang = 'unknown'; assert.equal(f.api.presentation.format(value), words[name][0]); delete f.c.document; assert.equal(f.api.presentation.format(value), words[name][0]);
    assert.deepEqual(Array.from(f.memory), before); assert.equal(f.calls.length, count);
  }
  const f = await fixture(); f.memory.set('cwWaterReminders', '[{"note":"old {key}"}]'); const before = Array.from(f.memory), warning = f.api.presentation.legacyWarning();
  for (const [index, lang] of languages.entries()) { f.c.document.documentElement.lang = lang; assert.equal(f.api.presentation.format(warning), words.legacy[index]); assert.equal(f.api.legacyWarning(), words.legacy[0]); }
  assert.deepEqual(Array.from(f.memory), before);
  console.log('PASS22 actual helper guards plus legacy warning across all five languages; original Error.message/API preserved, unknown/minimal-DOM fallback and forged/external copies literal; formatting has no writes or network');
}

let browser, completed = false; const releases = [];
const deadline = setTimeout(() => { console.error('Reminder helper language scenario did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  await helperGuardCases();
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
  const panel = page.locator('#pumpReminderCard'), banner = page.locator('#pumpReminderBanner');
  const key = `cwFieldReminders:v1:TECH:${tech.id}`, endpoint = '/api/technician/pump-reminders';
  const raw = () => page.evaluate(key => localStorage.getItem(key), key), rows = async () => Object.values(JSON.parse(await raw() || '{}'));
  const database = async () => ({ reminders: await prisma.operationalReminder.findMany({ where: { assignedToTechnicianId: tech.id }, orderBy: { id: 'asc' } }), history: await prisma.technicalHistory.findMany({ where: { poolId: { in: [regularPool.id, extraPool.id] } }, orderBy: { id: 'asc' } }) });
  const locale = async lang => { await page.locator('#cwLanguageSelect').selectOption(lang); await page.waitForFunction(lang => document.documentElement.lang === lang, lang); };
  const instrument = () => page.evaluate(() => { window.qaPumpCalls = {}; for (const name of ['create', 'mark', 'list', 'sync', 'context', 'legacyWarning']) { const fn = CWFieldReminders[name]; CWFieldReminders[name] = (...args) => { qaPumpCalls[name] = (qaPumpCalls[name] || 0) + 1; return fn(...args); }; } });
  const state = () => page.evaluate(() => ({ focus: document.activeElement.id, selection: [document.activeElement.selectionStart, document.activeElement.selectionEnd], minutes: document.getElementById('pumpReminderMinutes').value, notes: document.getElementById('notes').value, disabled: document.getElementById('pumpReminderCreate').disabled, calls: { ...qaPumpCalls }, context: CWFieldVisitContext(), token: localStorage.getItem('token'), alternateToken: localStorage.getItem('cristalwater_jwt'), drafts: Object.keys(localStorage).filter(k => k.startsWith('cwField') || k.startsWith('cwWater') || k.startsWith('cwPump')).sort().map(k => [k, localStorage.getItem(k)]) }));
  async function matrix(selector, word, literal = null) {
    await page.evaluate(() => { document.getElementById('pumpReminderMinutes').focus(); window.qaPumpNodes = Array.from(document.querySelectorAll('#pumpReminderCard,#pumpReminderCard *,#pumpReminderBanner,#pumpReminderBanner *')); });
    const before = await state(), stored = await raw(), db = await database(), count = requests.length;
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, lang] of languages.entries()) {
        await locale(lang);
        assert.equal(await page.locator(selector).textContent(), literal === null ? words[word][index] : literal);
        assert.equal(await raw(), stored); assert.deepEqual(await state(), before); assert.deepEqual(await database(), db);
        assert(await page.evaluate(() => qaPumpNodes.every(node => node.isConnected)));
        for (const target of ['#pumpReminderCard', '#pumpReminderBanner']) assert(await page.locator(target).evaluate(n => n.hidden || n.scrollWidth <= n.clientWidth + 1), target + ' fits');
      }
    }
    for (const r of requests.slice(count)) { assert.equal(r.path, '/api/settings/language/me'); assert.equal(r.method, 'PUT'); assert.deepEqual(Object.keys(JSON.parse(r.body)), ['language']); }
  }
  await page.goto(base + `/technician-field-mode?selectedVisitId=${id}&selectedVisitType=REGULAR`, { waitUntil: 'networkidle' });
  await page.waitForFunction(id => CWFieldVisitContext()?.id === id, id); await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.locator('[data-field-tab-button=agora]').click(); await locale('en'); await instrument(); await context.setOffline(true);
  const original = await raw();
  await page.evaluate(key => { localStorage.setItem(key, '{broken'); CWPumpReminders.render(); }, key);
  assert.equal(await banner.textContent(), words.unreadable[1]);
  // Keep one real draft lock pending long enough to exercise snapshot readiness.
  await page.evaluate(() => { window.qaDraftLockRequest = navigator.locks.request; let delayed = false; navigator.locks.request = function (name, ...args) { const callback = args.pop(); return qaDraftLockRequest.call(this, name, ...args, async lock => { if (!delayed && name.startsWith('cwFieldVisitDrafts:v2:')) { delayed = true; await new Promise(resolve => setTimeout(resolve, 500)); } return callback(lock); }); }; });
  await page.locator('#notes').fill('Keep <b>{key}</b> exactly');
  await page.waitForFunction(({ id, owner }) => { const raw = localStorage.getItem('cwFieldVisitDrafts:v2:' + owner); return document.getElementById('fieldSaveStatus').dataset.state === 'saved' && raw && JSON.parse(raw).drafts['visit-REGULAR-' + id]?.values.notes === 'Keep <b>{key}</b> exactly'; }, { id, owner: 'TECH:' + tech.id });
  await page.evaluate(() => { navigator.locks.request = qaDraftLockRequest; });
  await matrix('#pumpReminderBanner', 'unreadable');
  await page.evaluate(key => { localStorage.setItem(key, '[]'); CWPumpReminders.render(); }, key); await matrix('#pumpReminderBanner', 'invalid');
  await page.evaluate(({ key, original }) => { if (original === null) localStorage.removeItem(key); else localStorage.setItem(key, original); CWPumpReminders.render(); }, { key, original });
  const feedback = '#pumpReminderFeedback';
  await page.evaluate(() => { window.qaVisitContext = CWFieldVisitContext; window.CWFieldVisitContext = () => null; });
  await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(text => document.getElementById('pumpReminderFeedback').textContent === text, words.context[4]);
  await page.evaluate(() => { window.CWFieldVisitContext = qaVisitContext; }); await matrix(feedback, 'context');
  await page.evaluate(() => { window.qaReminderLocks = navigator.locks; Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });
  await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(text => document.getElementById('pumpReminderFeedback').textContent === text, words.saveLocks[4]);
  await page.evaluate(() => { Object.defineProperty(navigator, 'locks', { configurable: true, value: qaReminderLocks }); }); await matrix(feedback, 'saveLocks');
  // A matching external error (including a forged copy field) must stay literal.
  await page.evaluate(({ key, literal }) => { window.qaStorageWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === key) { const error = Error(literal); error.copy = { key: 'unreadable' }; throw error; } return qaStorageWrite.call(this, k, v); }; }, { key, literal: words.unreadable[0] });
  await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(text => document.getElementById('pumpReminderFeedback').textContent === text, words.unreadable[0]); await matrix(feedback, '', words.unreadable[0]); assert.equal(await raw(), original);
  await page.evaluate(() => { Storage.prototype.setItem = qaStorageWrite; });
  await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(key => Object.keys(JSON.parse(localStorage.getItem(key) || '{}')).length === 1, key); await page.evaluate(() => CWPumpReminders.sync());
  const pending = (await rows())[0], saved = await raw(); assert.equal(pending.syncError, 'Por confirmar no servidor'); assert.equal(pending.visitType, 'REGULAR'); assert.equal(pending.poolId, regularPool.id);
  await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(text => document.getElementById('pumpReminderFeedback').textContent === text, words.duplicate[4]); await matrix(feedback, 'duplicate'); assert.equal(await raw(), saved);
  const legacy = '[{"note":"literal <b>{key}</b>","visitId":999}]';
  await page.evaluate(value => { localStorage.setItem('cwPumpReminders:' + CWFieldWriteStore.session().technicianId, value); CWPumpReminders.render(); }, legacy);
  await matrix('#pumpReminderBanner > p', 'legacy'); assert.equal(await page.evaluate(() => CWFieldReminders.legacyWarning()), words.legacy[0]);
  assert.equal(await page.evaluate(() => localStorage.getItem('cwPumpReminders:' + CWFieldWriteStore.session().technicianId)), legacy);
  if (process.env.CW_REMINDER_LANGUAGE_CAPTURE) { await page.setViewportSize({ width: 320, height: 900 }); await locale('de'); await banner.screenshot({ path: process.env.CW_REMINDER_LANGUAGE_CAPTURE }); }
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => CWFieldReminders && CWPumpReminders && CWFieldVisitContext()); await instrument(); await page.locator('[data-field-tab-button=agora]').click(); assert.equal(await raw(), saved); await matrix('#pumpReminderBanner > p', 'legacy');
  await page.evaluate(() => { document.documentElement.lang = 'zz'; window.dispatchEvent(new Event('cw-language-change')); }); assert.equal(await banner.locator(':scope > p').textContent(), words.legacy[0]); await locale('de');
  // Account guard still rejects the real reminder read; restore the account before comparison.
  await page.evaluate(() => { const token = localStorage.getItem('token'); localStorage.setItem('token', 'changed'); CWPumpReminders.render(); localStorage.setItem('token', token); }); await matrix('#pumpReminderBanner', 'session'); assert.equal(await raw(), saved);
  await page.evaluate(() => { localStorage.removeItem('cwPumpReminders:' + CWFieldWriteStore.session().technicianId); CWPumpReminders.render(); });
  console.log('PASS helper errors and legacy warning in five languages at320/390/1440; nodes/focus/notes/context/credentials/SQL and damaged/original/cache bytes preserved; external matching errors remain literal; duplicate and session guards preserved');
  let mode = 'deny', release, entered; const gate = new Promise(r => { release = r; releases.push(r); }), started = new Promise(r => { entered = r; }); const posts = [];
  await page.route(base + endpoint + '**', async route => {
    const r = route.request(); if (r.method() === 'GET') return route.fulfill({ json: { ok: true, reminders: [] } });
    posts.push({ path: new URL(r.url()).pathname, body: r.postDataJSON(), authorization: r.headers().authorization });
    if (mode === 'deny') return route.fulfill({ status: 403, json: { error: words.unreadable[0] } });
    const response = await route.fetch(); assert.equal(response.status(), 200);
    if (mode === 'lose') { entered(); await gate; return route.abort('connectionfailed'); }
    return route.fulfill({ response });
  });
  await context.setOffline(false); await page.evaluate(() => CWPumpReminders.sync()); assert.equal((await rows())[0].syncError, words.unreadable[0]); assert.equal((await database()).reminders.length, 0);
  // Durable server text has no trusted copy provenance and is never rewritten by language changes.
  await page.evaluate(key => { window.qaDenied = localStorage.getItem(key); }, key);
  mode = 'lose'; const sending = page.evaluate(() => CWPumpReminders.sync()); await started;
  const held = await raw(); for (const lang of languages) await locale(lang); assert.equal(await raw(), held); assert.equal((await database()).reminders.length, 1); release(); await sending;
  assert(!(await rows())[0].serverId); assert.equal((await rows())[0].syncError, words.interrupted[0]);
  const durable = await raw(); for (const lang of languages) await locale(lang); assert.equal(await raw(), durable);
  mode = 'accept'; await page.evaluate(() => CWPumpReminders.sync()); assert((await rows())[0].serverId); assert.equal((await rows())[0].syncError, '');
  const attempts = posts.filter(x => x.path === endpoint); assert(attempts.length >= 3); assert(attempts.every(x => JSON.stringify(x) === JSON.stringify(attempts[0]))); assert.equal(attempts[0].authorization, 'Bearer ' + token); assert.equal(attempts[0].body.localId, pending.localId);
  await context.setOffline(true); const dialogEvent = page.waitForEvent('dialog'), clicking = banner.locator(`[data-pump-reminder="${pending.localId}"] button`).click(); const dialog = await dialogEvent; await dialog.accept(); await clicking;
  await page.waitForFunction(key => Object.values(JSON.parse(localStorage.getItem(key)))[0].status === 'CLOSED', key); await page.evaluate(() => CWPumpReminders.sync());
  const closed = await raw(); for (const lang of languages) await locale(lang); assert.equal(await raw(), closed); await context.setOffline(false); await page.evaluate(() => CWPumpReminders.sync());
  const db = await database(); assert.equal(db.reminders.length, 1); assert(db.reminders[0].isCompleted); assert.equal(db.history.filter(x => x.type === 'PUMP_MANUAL' && x.message === 'OPEN').length, 1); assert.equal(db.history.filter(x => x.type === 'PUMP_MANUAL' && x.message === 'CLOSED').length, 1); assert(await banner.isHidden()); assert((await rows())[0].closeSyncedAt);
  assert.equal(await banner.locator('b').count(), 0); assert.deepEqual(errors, []);
  console.log('PASS raw persisted server/owned errors unchanged;403 preservation, language switches while actual response held/lost, identical retry and physical offline closure; exactly one SQL reminder/open/close');
  completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); for (const release of releases) release(); if (browser) await browser.close(); await prisma.$disconnect(); });
