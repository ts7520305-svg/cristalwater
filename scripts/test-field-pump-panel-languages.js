'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  title: ['Bomba em manual', 'Pump in manual mode', 'Pompe en mode manuel', 'Bomba en modo manual', 'Pumpe im Handbetrieb'],
  intro: ['Registe quando coloca a bomba em manual. Confirme aqui depois de a colocar novamente em automático.', 'Record when you switch the pump to manual mode. Confirm here after switching it back to automatic.', 'Enregistrez le passage de la pompe en mode manuel. Confirmez ici après l’avoir remise en mode automatique.', 'Registre cuándo pone la bomba en modo manual. Confirme aquí después de volver a ponerla en automático.', 'Erfassen Sie, wenn Sie die Pumpe auf Handbetrieb umstellen. Bestätigen Sie hier, nachdem Sie sie wieder auf Automatik gestellt haben.'],
  minutes: ['Lembrar dentro de (minutos)', 'Remind me in (minutes)', 'Me rappeler dans (minutes)', 'Recordar dentro de (minutos)', 'Erinnern in (Minuten)'],
  create: ['Registar bomba em manual', 'Record pump in manual mode', 'Enregistrer la pompe en mode manuel', 'Registrar bomba en modo manual', 'Pumpe im Handbetrieb erfassen'],
  close: ['Já coloquei em automático', 'I have switched it back to automatic', 'Je l’ai remise en mode automatique', 'Ya la he puesto en automático', 'Ich habe sie wieder auf Automatik gestellt'],
  confirm: ['Confirma que colocou fisicamente esta bomba em automático?', 'Do you confirm that you physically switched this pump back to automatic mode?', 'Confirmez-vous avoir physiquement remis cette pompe en mode automatique ?', '¿Confirma que ha puesto físicamente esta bomba en modo automático?', 'Bestätigen Sie, dass Sie diese Pumpe vor Ort wieder auf Automatik gestellt haben?'],
  invalid: ['Escolha um prazo entre 1 e 1440 minutos.', 'Choose a time between 1 and 1440 minutes.', 'Choisissez un délai entre 1 et 1440 minutes.', 'Elija un plazo entre 1 y 1440 minutos.', 'Wählen Sie einen Zeitraum zwischen 1 und 1440 Minuten.'],
  saved: ['Registo guardado neste telemóvel. A confirmar no servidor.', 'Record saved on this phone. Awaiting server confirmation.', 'Enregistrement conservé sur ce téléphone. En attente de confirmation du serveur.', 'Registro guardado en este teléfono. Pendiente de confirmación del servidor.', 'Eintrag auf diesem Telefon gespeichert. Serverbestätigung ausstehend.'],
  pool: ['Piscina', 'Pool', 'Piscine', 'Piscina', 'Pool'],
  technician: ['Técnico responsável', 'Responsible technician', 'Technicien responsable', 'Técnico responsable', 'Zuständiger Techniker'],
  pending: ['Por enviar ao servidor.', 'Awaiting upload to the server.', 'En attente d’envoi au serveur.', 'Pendiente de envío al servidor.', 'Übermittlung an den Server ausstehend.'],
  recorded: ['Registo no servidor.', 'Recorded on the server.', 'Enregistré sur le serveur.', 'Registrado en el servidor.', 'Auf dem Server erfasst.'],
  automatic: ['Automático confirmado no telemóvel, envio pendente', 'Automatic mode confirmed on the phone, upload pending', 'Mode automatique confirmé sur le téléphone, envoi en attente', 'Modo automático confirmado en el teléfono, envío pendiente', 'Automatik auf dem Telefon bestätigt, Übermittlung ausstehend'],
  manual: ['Bomba em manual: ', 'Pump in manual mode: ', 'Pompe en mode manuel : ', 'Bomba en modo manual: ', 'Pumpe im Handbetrieb: '],
  due: [' min até ao lembrete', ' min until the reminder', ' min avant le rappel', ' min hasta el recordatorio', ' Min. bis zur Erinnerung'],
  now: ['confirmar agora', 'confirm now', 'confirmer maintenant', 'confirmar ahora', 'jetzt bestätigen'],
  elapsed: [' min em curso. ', ' min elapsed. ', ' min écoulées. ', ' min transcurridos. ', ' Min. vergangen. ']
};
let browser, completed = false; const releases = [];
const deadline = setTimeout(() => { console.error('Pump panel language scenario did not finish'); process.exit(1); }, 90000);
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
  const panel = page.locator('#pumpReminderCard'), banner = page.locator('#pumpReminderBanner');
  const key = `cwFieldReminders:v1:TECH:${tech.id}`, endpoint = '/api/technician/pump-reminders';
  const raw = () => page.evaluate(key => localStorage.getItem(key), key), rows = async () => Object.values(JSON.parse(await raw() || '{}'));
  const database = async () => ({ reminders: await prisma.operationalReminder.findMany({ where: { assignedToTechnicianId: tech.id }, orderBy: { id: 'asc' } }), history: await prisma.technicalHistory.findMany({ where: { poolId: { in: [regularPool.id, extraPool.id] } }, orderBy: { id: 'asc' } }) });
  const locale = async lang => { await page.locator('#cwLanguageSelect').selectOption(lang); await page.waitForFunction(lang => document.documentElement.lang === lang, lang); };
  const instrument = () => page.evaluate(() => { window.qaPumpCalls = {}; for (const name of ['create', 'mark', 'list', 'sync', 'context', 'legacyWarning']) { const fn = CWFieldReminders[name]; CWFieldReminders[name] = (...args) => { qaPumpCalls[name] = (qaPumpCalls[name] || 0) + 1; return fn(...args); }; } });
  const state = () => page.evaluate(() => ({ focus: document.activeElement.id, selection: [document.activeElement.selectionStart, document.activeElement.selectionEnd], minutes: document.getElementById('pumpReminderMinutes').value, notes: document.getElementById('notes').value, disabled: document.getElementById('pumpReminderCreate').disabled, calls: { ...qaPumpCalls }, context: CWFieldVisitContext(), token: localStorage.getItem('token'), alternateToken: localStorage.getItem('cristalwater_jwt'), drafts: Object.keys(localStorage).filter(k => k.startsWith('cwField') || k.startsWith('cwWater') || k.startsWith('cwPump')).sort().map(k => [k, localStorage.getItem(k)]) }));
  async function matrix(feedback = '', literal = null, display = []) {
    await page.evaluate(() => { document.getElementById('pumpReminderMinutes').focus(); window.qaPumpNodes = Array.from(document.querySelectorAll('#pumpReminderCard,#pumpReminderCard *,#pumpReminderBanner,#pumpReminderBanner *')); });
    const before = await state(), stored = await raw(), db = await database(), count = requests.length;
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [index, lang] of languages.entries()) {
        await locale(lang);
        for (const [selector, word] of [['h2', 'title'], ['[data-cw-pump-text=intro]', 'intro'], ['label', 'minutes'], ['#pumpReminderCreate', 'create']]) assert.equal(await panel.locator(selector).textContent(), words[word][index]);
        assert.equal(await page.locator('#pumpReminderFeedback').textContent(), literal === null ? feedback ? words[feedback][index] : '' : literal);
        for (const item of display) {
          const row = banner.locator(`[data-pump-reminder="${item.localId}"]`);
          const expected = (item.poolName || words.pool[index]) + ' · ' + (item.technicianName || words.technician[index]) + ' — ' + (item.closed ? words.automatic[index] : words.manual[index] + (item.remaining > 0 ? item.remaining + words.due[index] : words.now[index])) + '. ' + (item.openedAt ? item.elapsed + words.elapsed[index] : '') + (item.serverId ? words.recorded[index] : words.pending[index]);
          assert.equal(await row.locator('p').textContent(), expected);
          assert.equal(await row.locator('button').count(), item.closed ? 0 : 1);
          if (!item.closed) assert.equal(await row.locator('button').textContent(), words.close[index]);
        }
        assert.deepEqual(await raw(), stored); assert.deepEqual(await state(), before); assert.deepEqual(await database(), db);
        assert(await page.evaluate(() => qaPumpNodes.every(node => node.isConnected)));
        for (const selector of ['#pumpReminderCard', '#pumpReminderBanner']) assert(await page.locator(selector).evaluate(n => n.hidden || n.scrollWidth <= n.clientWidth + 1), selector + ' fits');
      }
    }
    for (const r of requests.slice(count)) { assert.equal(r.path, '/api/settings/language/me'); assert.equal(r.method, 'PUT'); assert.deepEqual(Object.keys(JSON.parse(r.body)), ['language']); }
  }
  const displayRows = async () => (await rows()).filter(x => !x.closed || !x.closeSyncedAt).map(x => ({ ...x, remaining: Math.ceil((Date.parse(x.dueAt) - Date.now()) / 60000), elapsed: Math.max(0, Math.floor((Date.now() - Date.parse(x.openedAt)) / 60000)) }));
  const selectExtra = async () => { await page.locator('[data-field-tab-button=hoje]').click(); await page.locator('[data-pool-filter=TODO]').click(); await page.locator('#visitList [data-visit-index]').filter({ hasText: extraPool.name }).click(); await page.waitForFunction(() => CWFieldVisitContext()?.visitType === 'EXTRA'); await page.locator('[data-field-tab-button=agora]').click(); };
  await page.goto(base + `/technician-field-mode?selectedVisitId=${id}&selectedVisitType=REGULAR`, { waitUntil: 'networkidle' });
  await page.waitForFunction(id => CWFieldVisitContext()?.id === id && CWFieldVisitContext().visitType === 'REGULAR', id); await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.locator('[data-field-tab-button=agora]').click(); await locale('en');
  assert.equal(await page.locator('#pumpReminderCreate').textContent(), words.create[1]);
  await page.locator('#notes').fill('Original <b>notes</b> {minutes}'); await instrument(); await matrix();
  await page.locator('#pumpReminderMinutes').fill('0'); await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(text => document.getElementById('pumpReminderFeedback').textContent === text, words.invalid[4]); await matrix('invalid'); assert.equal(await raw(), null);
  await page.locator('#pumpReminderMinutes').fill('30'); await context.setOffline(true);
  await page.evaluate(({ key, literal }) => { window.qaStorageWrite = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === key) throw Error(literal); return qaStorageWrite.call(this, k, v); }; }, { key, literal: words.invalid[0] });
  await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(text => document.getElementById('pumpReminderFeedback').textContent === text, words.invalid[0]); await matrix('', words.invalid[0]); assert.equal(await raw(), null);
  await page.evaluate(() => { Storage.prototype.setItem = qaStorageWrite; });
  await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(key => Object.keys(JSON.parse(localStorage.getItem(key) || '{}')).length === 1, key); await page.evaluate(() => CWPumpReminders.sync());
  let display = await displayRows(); const regular = display[0]; assert.equal(regular.visitType, 'REGULAR'); assert.equal(regular.poolId, regularPool.id); assert.equal(regular.payloadHash.length, 64); await matrix('saved', null, display);
  for (const [index, lang] of languages.entries()) { await locale(lang); const before = await raw(); const dialog = page.waitForEvent('dialog'); const click = banner.locator(`[data-pump-reminder="${regular.localId}"] button`).click(); const d = await dialog; assert.equal(d.message(), words.confirm[index]); await d.dismiss(); await click; assert.equal(await raw(), before); }
  await selectExtra(); await page.locator('#pumpReminderCreate').click(); await page.waitForFunction(key => Object.keys(JSON.parse(localStorage.getItem(key))).length === 2, key); await page.evaluate(() => CWPumpReminders.sync());
  const original = await raw(), extra = (await rows()).find(x => x.visitType === 'EXTRA'); assert(extra); assert.equal(extra.visitId, regular.visitId); assert.equal(extra.poolId, extraPool.id); assert.notEqual(extra.localId, regular.localId);
  await matrix('saved', null, await displayRows()); assert.equal((await database()).reminders.length, 0);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => CWFieldReminders && CWPumpReminders && CWFieldVisitContext()); await instrument(); await page.locator('[data-field-tab-button=agora]').click(); assert.equal(await raw(), original); await matrix('', null, await displayRows());
  console.log('PASS actual pump controls and validation in five languages at320/390/1440; focus/draft/minutes/nodes/payloads preserved; identical external errors stay literal; REGULAR/EXTRA collision survives offline cache; confirmation cancellation writes nothing');
  const sample = JSON.parse(original), sampleRow = sample['PUMP_MANUAL:' + extra.localId]; sampleRow.poolName = ''; sampleRow.technicianName = ''; sampleRow.openedAt = new Date(Date.now() - 13 * 60000).toISOString(); sampleRow.dueAt = new Date(Date.now() - 60000).toISOString(); sampleRow.serverId = 999999;
  await page.evaluate(({ key, sample }) => { localStorage.setItem(key, sample); CWPumpReminders.render(); }, { key, sample: JSON.stringify(sample) });
  await matrix('', null, await displayRows()); assert(await page.evaluate(() => qaPumpTimers.includes(CWPumpReminders.render)));
  await page.evaluate(({ key, original }) => { localStorage.setItem(key, original); CWPumpReminders.render(); }, { key, original }); assert.equal(await raw(), original);
  const legacy = '[{"note":"unowned <b>{minutes}</b>"}]'; await page.evaluate(value => { localStorage.setItem('cwPumpReminders:' + CWFieldWriteStore.session().technicianId, value); CWPumpReminders.render(); }, legacy);
  const warning = await banner.locator(':scope > p').textContent(); await matrix('', null, await displayRows()); assert.equal(await banner.locator(':scope > p').textContent(), warning);
  await page.evaluate(() => { localStorage.removeItem('cwPumpReminders:' + CWFieldWriteStore.session().technicianId); CWPumpReminders.render(); });
  if (process.env.CW_PUMP_LANGUAGE_CAPTURE) { await page.setViewportSize({ width: 320, height: 900 }); await locale('de'); await panel.screenshot({ path: process.env.CW_PUMP_LANGUAGE_CAPTURE }); }
  await locale('de'); const closeDialog = page.waitForEvent('dialog'), closing = banner.locator(`[data-pump-reminder="${regular.localId}"] button`).click(); const dialog = await closeDialog; assert.equal(dialog.message(), words.confirm[4]); await dialog.accept(); await closing;
  await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key))['PUMP_MANUAL:' + id].closed, { key, id: regular.localId }); await page.evaluate(() => CWPumpReminders.sync()); await matrix('', null, await displayRows());
  let mode = 'deny', release, entered; const gate = new Promise(r => { release = r; releases.push(r); }), started = new Promise(r => { entered = r; }); const posts = [];
  await page.route(base + endpoint + '**', async route => {
    const r = route.request(); if (r.method() === 'GET') return route.fulfill({ json: { ok: true, reminders: [] } });
    const body = r.postDataJSON(); posts.push({ path: new URL(r.url()).pathname, body, authorization: r.headers().authorization });
    if (mode === 'deny') return route.fulfill({ status: 403, json: { error: '<b>QA denied {minutes}</b>' } });
    const response = await route.fetch(); assert.equal(response.status(), 200); const data = await response.json();
    if (mode === 'lose' && body.localId === extra.localId) { entered(); await gate; return route.abort('connectionfailed'); }
    if (mode === 'badClose' && r.url().endsWith('/close')) return route.fulfill({ json: { ...data, reminder: { ...data.reminder, isCompleted: false } } });
    return route.fulfill({ response });
  });
  await context.setOffline(false); await page.evaluate(() => CWPumpReminders.sync()); assert((await rows()).every(x => x.syncError === '<b>QA denied {minutes}</b>')); assert.equal((await database()).reminders.length, 0);
  await matrix('', null, await displayRows());
  mode = 'lose'; const sending = page.evaluate(() => CWPumpReminders.sync()); await started;
  const beforeLost = await raw(); await matrix('', null, await displayRows()); assert.equal(await raw(), beforeLost); assert.equal((await database()).reminders.length, 2); release(); await sending;
  assert(!(await rows()).find(x => x.localId === extra.localId).serverId); mode = 'accept'; await page.evaluate(() => CWPumpReminders.sync());
  const retry = posts.filter(x => x.body.localId === extra.localId && x.path === endpoint); assert(retry.length >= 3); assert(retry.every(x => JSON.stringify(x) === JSON.stringify(retry[0]))); assert.equal(retry[0].authorization, 'Bearer ' + token);
  assert.equal(retry[0].body.visitType, 'EXTRA'); assert.equal(retry[0].body.visitId, id); assert.equal(retry[0].body.poolId, extraPool.id);
  let db = await database(); assert.equal(db.reminders.length, 2); assert(db.reminders.find(x => x.metadata.localId === regular.localId).isCompleted); assert(!db.reminders.find(x => x.metadata.localId === extra.localId).isCompleted);
  assert((await rows()).find(x => x.localId === regular.localId).closeSyncedAt); await matrix('', null, await displayRows());
  await context.setOffline(true); const extraDialog = page.waitForEvent('dialog'), extraClick = banner.locator(`[data-pump-reminder="${extra.localId}"] button`).click(); const d = await extraDialog; assert.equal(d.message(), words.confirm[4]); await d.accept(); await extraClick; await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key))['PUMP_MANUAL:' + id].closed, { key, id: extra.localId }); await page.evaluate(() => CWPumpReminders.sync());
  await matrix('', null, await displayRows()); mode = 'badClose'; await context.setOffline(false); await page.evaluate(() => CWPumpReminders.sync());
  assert(!(await rows()).find(x => x.localId === extra.localId).closeSyncedAt); assert(!(await banner.isHidden()));
  mode = 'accept'; await page.evaluate(() => CWPumpReminders.sync()); assert((await rows()).every(x => x.closeSyncedAt && !x.syncError)); assert(await banner.isHidden());
  db = await database(); assert.equal(db.reminders.length, 2); assert(db.reminders.every(x => x.isCompleted));
  assert.equal(db.history.filter(x => x.type === 'PUMP_MANUAL' && x.message === 'OPEN').length, 2); assert.equal(db.history.filter(x => x.type === 'PUMP_MANUAL' && x.message === 'CLOSED').length, 2);
  assert.equal(await banner.locator('b').count(), 0); assert.deepEqual(errors, []);
  console.log('PASS fallback names/overdue/elapsed/server states, exact legacy warning, physical offline closure,403 preservation, language changes during a held response, identical lost-response replay and incomplete close rejection; two typed reminders each open/close once');
  completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); for (const release of releases) release(); if (browser) await browser.close(); await prisma.$disconnect(); });
