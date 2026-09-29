'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
const { requestReceipt } = require('../src/services/visitReceiptService');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const words = {
  pt: { handover: 'Passar responsabilidade', receipt: 'Novas visitas atribuídas', reason: 'Motivo da passagem', target: 'Técnico destinatário', request: 'Pedir passagem', accept: 'Aceitar responsabilidade', cancel: 'Cancelar pedido', pending: 'Continua responsável.', received: 'Receção confirmada no escritório.', offline: 'Sem ligação.', unknown: 'Sem confirmação do servidor.', confirm: 'Confirma que consegue assumir este lembrete a partir de agora?', regular: 'visita #', extra: 'visita extra #', future: 'visita(s) de dias futuros', failure: 'Receção não confirmada:', empty: 'Sem novas atribuições por confirmar no servidor.' },
  en: { handover: 'Hand over responsibility', receipt: 'Newly assigned visits', reason: 'Reason for handover', target: 'Receiving technician', request: 'Request handover', accept: 'Accept responsibility', cancel: 'Cancel request', pending: 'You remain responsible.', received: 'Receipt confirmed with the office.', offline: 'Offline.', unknown: 'No server confirmation.', confirm: 'Can you confirm that you can take responsibility for this reminder from now on?', regular: 'visit #', extra: 'extra visit #', future: 'visit(s) on future days', failure: 'Receipt not confirmed:', empty: 'No new assignments awaiting confirmation on the server.' },
  fr: { handover: 'Transmettre la responsabilité', receipt: 'Nouvelles visites attribuées', reason: 'Motif de la transmission', target: 'Technicien destinataire', request: 'Demander la transmission', accept: 'Accepter la responsabilité', cancel: 'Annuler la demande', pending: 'Vous restez responsable.', received: 'Réception confirmée auprès du bureau.', offline: 'Hors ligne.', unknown: 'Aucune confirmation du serveur.', confirm: 'Confirmez-vous pouvoir assumer ce rappel à partir de maintenant ?', regular: 'visite n°', extra: 'visite supplémentaire n°', future: 'visite(s) à venir', failure: 'Réception non confirmée :', empty: 'Aucune nouvelle attribution à confirmer sur le serveur.' },
  es: { handover: 'Transferir la responsabilidad', receipt: 'Nuevas visitas asignadas', reason: 'Motivo del traspaso', target: 'Técnico destinatario', request: 'Solicitar traspaso', accept: 'Aceptar la responsabilidad', cancel: 'Cancelar solicitud', pending: 'Sigue siendo responsable.', received: 'Recepción confirmada con la oficina.', offline: 'Sin conexión.', unknown: 'Sin confirmación del servidor.', confirm: '¿Confirma que puede asumir este recordatorio a partir de ahora?', regular: 'visita #', extra: 'visita extra #', future: 'visita(s) de días futuros', failure: 'Recepción no confirmada:', empty: 'No hay nuevas asignaciones por confirmar en el servidor.' },
  de: { handover: 'Verantwortung übergeben', receipt: 'Neu zugewiesene Besuche', reason: 'Grund der Übergabe', target: 'Übernehmender Techniker', request: 'Übergabe anfragen', accept: 'Verantwortung übernehmen', cancel: 'Anfrage zurückziehen', pending: 'Sie bleiben verantwortlich.', received: 'Empfang beim Büro bestätigt.', offline: 'Offline.', unknown: 'Keine Serverbestätigung.', confirm: 'Bestätigen Sie, dass Sie ab jetzt die Verantwortung für diese Erinnerung übernehmen können?', regular: 'Besuch #', extra: 'Zusatzbesuch #', future: 'Besuch(e) an künftigen Tagen', failure: 'Empfang nicht bestätigt:', empty: 'Keine neuen Zuweisungen auf dem Server zu bestätigen.' }
};
let browser, completed = false;
const releases = [];
const deadline = setTimeout(() => { console.error('Handover/receipt language assertions did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const tech = await prisma.technician.create({ data: { name: 'Handover language owner', active: true } });
  const other = await prisma.technician.create({ data: { name: 'Colega literal {reason}', active: true } });
  const client = await prisma.client.create({ data: { name: 'Handover language client', active: true } });
  const literal = 'Piscina <img src=x onerror=window.qaInjected=true> {name}';
  const reason = 'Motivo original <b>Guardar</b> {reason}';
  const pool = await prisma.pool.create({ data: { name: literal, clientId: client.id, active: true } });
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1;
  const common = { id, clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'PLANNED' };
  const regular = await prisma.serviceVisit.create({ data: { ...common, date: new Date(), plannedDate: new Date() } });
  const extra = await prisma.extraVisit.create({ data: { ...common, scheduledAt: new Date(), internalNote: 'Original visit' } });
  const futureVisit = await prisma.serviceVisit.create({ data: { ...common, id: id + 1, date: new Date(Date.now() + 172800000), plannedDate: new Date(Date.now() + 172800000) } });
  for (const name of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${name}"','id'),${id + 1},true)`);
  const receipts = [];
  for (const visit of [{ ...regular, visitType: 'REGULAR' }, { ...extra, visitType: 'EXTRA' }, { ...futureVisit, visitType: 'REGULAR' }]) receipts.push(await requestReceipt(prisma, visit, randomUUID(), 'QA_LANGUAGES'));
  const sign = user => jwt.sign({ id: user.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const token = sign(tech), otherToken = sign(other);
  async function api(method, path, body, credential = token) {
    const response = await fetch(base + '/api/technician/' + path, { method, headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data;
  }
  const outgoing = (await api('POST', 'water-reminders', { owner: `TECH:${tech.id}`, localId: randomUUID(), visitId: id, visitType: 'REGULAR', poolId: pool.id, clientId: client.id, dueAt: new Date(Date.now() + 3600000).toISOString(), openedAt: new Date().toISOString(), note: reason, flowState: 'HALF' })).reminder;
  const incoming = await prisma.operationalReminder.create({ data: { title: literal, sourceKey: `pump:${other.id}:${randomUUID()}`, assignedToTechnicianId: other.id, poolId: pool.id, clientId: client.id, dueDate: new Date(Date.now() + 3600000), metadata: { localId: randomUUID(), poolName: literal, kind: 'PUMP_MANUAL' } } });
  await api('POST', `reminder-handovers/${incoming.id}/request`, { technicianId: tech.id, reason }, otherToken);
  const dbState = () => prisma.operationalReminder.findMany({ where: { id: { in: [outgoing.id, incoming.id, ...receipts.map(row => row.id)] } }, orderBy: { id: 'asc' } });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Lisbon' });
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaHandoverLanguages')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('qaHandoverLanguages', '1');
    }
    const original = window.setInterval;
    window.setInterval = (callback, delay, ...args) => [15000, 30000, 60000].includes(delay) ? 0 : original(callback, delay, ...args);
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
    window.alert = () => {};
  }, { token, tech, origin: new URL(base).origin });
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push({ url: request.url(), method: request.method(), body: request.postData() }); });
  function assertLanguageOnlySince(index) {
    // The real selector saves the user's language preference. Every other API request is forbidden here.
    for (const request of requests.slice(index)) {
      assert.equal(new URL(request.url).pathname, '/api/settings/language/me', 'Unexpected operational request during language change: ' + JSON.stringify(request));
      assert.equal(request.method, 'PUT');
      const payload = JSON.parse(request.body); assert.deepEqual(Object.keys(payload), ['language']); assert(Object.hasOwn(words, payload.language));
    }
  }
  const card = row => page.locator(`[data-handover-reminder="${row.id}"]`);
  const locale = value => page.locator('#cwLanguageSelect').selectOption(value);
  const bytes = () => page.evaluate(async () => ({ local: Object.fromEntries(Object.keys(localStorage).filter(key => /^(cwField|cwWater|cwPump)/.test(key)).sort().map(key => [key, localStorage.getItem(key)])), records: await CWFieldWriteStore.records(null, CWFieldWriteStore.session(), true) }));
  const refresh = id => page.evaluate(async id => { await document.getElementById(id).onclick(); }, id);
  await page.goto(base + `/technician-field-mode?selectedVisitId=${id}&selectedVisitType=REGULAR`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CristalI18n && window.CWFieldReminders && window.CWFieldEquipment && window.CWFieldWriteStore);
  await page.evaluate(() => CWFieldReminders.sync());
  await page.locator('[data-field-tab-button="hoje"]').click();
  await refresh('handoverRefresh'); await refresh('receiptRefresh');
  await card(outgoing).locator('select').selectOption(String(other.id));
  await card(outgoing).locator('textarea').fill(reason);
  await page.locator('#receiptList details').evaluate(node => { node.open = true; });
  await page.evaluate(() => { window.qaNodes = Array.from(document.querySelectorAll('#handoverPanel,#handoverPanel *,#visitReceiptPanel,#visitReceiptPanel *')); });
  const stored = await bytes(), rows = await dbState(), requestCount = requests.length;
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [lang, w] of Object.entries(words)) {
      await locale(lang);
      assert.equal(await page.locator('#handoverPanel h2').textContent(), w.handover);
      assert.equal(await page.locator('#visitReceiptPanel h2').textContent(), w.receipt);
      assert.equal(await card(outgoing).locator('textarea').getAttribute('placeholder'), w.reason);
      assert.equal(await card(outgoing).locator('textarea').getAttribute('aria-label'), w.reason);
      assert.equal(await card(outgoing).locator('select').getAttribute('aria-label'), w.target);
      assert.equal(await card(outgoing).locator('button').textContent(), w.request);
      assert.equal(await card(incoming).locator('button').textContent(), w.accept);
      assert((await card(incoming).textContent()).includes(reason));
      assert.equal(await card(outgoing).locator('textarea').inputValue(), reason);
      assert.equal(await card(outgoing).locator('select').inputValue(), String(other.id));
      assert((await page.locator(`[data-receipt="${receipts[0].id}"]`).locator('..').textContent()).includes(w.regular + id));
      assert((await page.locator(`[data-receipt="${receipts[1].id}"]`).locator('..').textContent()).includes(w.extra + id));
      assert((await page.locator('#receiptList summary').textContent()).includes(w.future));
      assert((await page.locator('#receiptList').textContent()).includes(literal));
      const state = await page.evaluate(lang => {
        const input = document.querySelector('#handoverList textarea'); input.focus(); input.setSelectionRange(3, 10); CristalI18n.applyLanguage(lang);
        return { same: qaNodes.every(node => node.isConnected), focus: document.activeElement === input, start: input.selectionStart, end: input.selectionEnd, open: document.querySelector('#receiptList details').open, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      }, lang);
      assert.deepEqual(state, { same: true, focus: true, start: 3, end: 10, open: true, overflow: false });
      assert.deepEqual(await bytes(), stored);
    }
  }
  assertLanguageOnlySince(requestCount);
  assert.deepEqual(await dbState(), rows);
  await page.evaluate(() => CristalI18n.applyLanguage('fr', { silent: true }));
  await page.waitForFunction(title => document.querySelector('#handoverPanel h2').textContent === title, words.fr.handover);
  if (process.env.CW_CAPTURE_UI) {
    fs.mkdirSync('reports/field-ui', { recursive: true }); await page.setViewportSize({ width: 320, height: 900 }); await locale('de');
    for (const [id, name] of [['handoverPanel', 'HANDOVER'], ['visitReceiptPanel', 'VISIT_RECEIPTS']]) { await page.locator('#' + id).scrollIntoViewIfNeeded(); await page.locator('#' + id).screenshot({ path: `reports/field-ui/${name}_DE_320.png` }); }
  }
  console.log('PASS five languages at 320/390/1440, typed visit ID collision, literal data, fields/nodes/focus/selection/disclosure/storage/SQL preserved; no language requests');

  await locale('en');
  await card(outgoing).locator('button').evaluate(async node => { await node.onclick(); });
  assert((await card(outgoing).textContent()).includes(words.en.pending));
  const proposed = await prisma.operationalReminder.findUniqueOrThrow({ where: { id: outgoing.id } });
  assert.equal(proposed.assignedToTechnicianId, tech.id); assert.equal(proposed.metadata.handover.reason, reason);
  const beforePending = requests.length;
  for (const [lang, w] of Object.entries(words)) { await locale(lang); assert((await card(outgoing).textContent()).includes(w.pending)); assert.equal(await card(outgoing).locator('button').textContent(), w.cancel); }
  assertLanguageOnlySince(beforePending);
  await card(outgoing).locator('button').evaluate(async node => { await node.onclick(); });
  assert.equal((await prisma.operationalReminder.findUniqueOrThrow({ where: { id: outgoing.id } })).metadata.handover.status, 'CANCELLED');
  for (const [lang, w] of Object.entries(words)) {
    await locale(lang); const count = requests.length;
    const dialog = page.waitForEvent('dialog'); const click = card(incoming).locator('button').click(); const question = await dialog;
    assert.equal(question.message(), w.confirm); await question.dismiss(); await click; assertLanguageOnlySince(count);
  }
  page.once('dialog', dialog => dialog.accept());
  await card(incoming).locator('button').evaluate(async node => { await node.onclick(); });
  const accepted = await prisma.operationalReminder.findUniqueOrThrow({ where: { id: incoming.id } });
  assert.equal(accepted.assignedToTechnicianId, tech.id); assert.equal(accepted.isCompleted, false); assert.equal(accepted.metadata.handover.status, 'ACCEPTED');
  const regularAfterHandover = await prisma.serviceVisit.findUniqueOrThrow({ where: { id } });
  assert.equal(regularAfterHandover.status, regular.status); assert.equal(regularAfterHandover.startAt, null); assert.equal(regularAfterHandover.endAt, null);
  for (const event of ['OPEN', 'HANDOVER_REQUESTED', 'HANDOVER_CANCELLED']) assert(regularAfterHandover.internalNotes.includes(event));
  console.log('PASS real request and cancellation keep the owner; translated confirmations cancel without requests; explicit acceptance transfers an active reminder');

  const failure = 'Resposta indisponível <b>original</b> {reason}';
  const fault = route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: failure }) });
  await page.route(`**/visit-receipts/${receipts[0].id}/acknowledge`, fault);
  await page.locator(`[data-receipt="${receipts[0].id}"]`).evaluate(async node => { await node.closest('#receiptList').onclick({ target: node }); });
  const failedRequests = requests.length;
  for (const [lang, w] of Object.entries(words)) { await locale(lang); const status = await page.locator('#receiptStatus').textContent(); assert(status.startsWith(w.failure)); assert(status.includes(failure)); }
  assertLanguageOnlySince(failedRequests); await page.unroute(`**/visit-receipts/${receipts[0].id}/acknowledge`, fault);
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; }); releases.push(release);
  const hold = async route => { const response = await route.fetch(); entered(); await gate; await route.fulfill({ response }); };
  await page.route(`**/visit-receipts/${receipts[1].id}/acknowledge`, hold);
  const sending = page.locator(`[data-receipt="${receipts[1].id}"]`).evaluate(async node => { await node.closest('#receiptList').onclick({ target: node }); });
  await started; const duringSend = requests.length;
  for (const lang of Object.keys(words)) { await locale(lang); assert(await page.locator(`[data-receipt="${receipts[1].id}"]`).isDisabled()); }
  assertLanguageOnlySince(duringSend); release(); await sending;
  await page.unroute(`**/visit-receipts/${receipts[1].id}/acknowledge`, hold);
  for (const [lang, w] of Object.entries(words)) { await locale(lang); assert((await page.locator('#receiptStatus').textContent()).startsWith(w.received)); }
  assert.equal(await page.locator(`[data-receipt="${receipts[1].id}"]`).count(), 0);
  assert.equal(await page.locator(`[data-receipt="${receipts[0].id}"]`).count(), 1);
  assert.equal(await prisma.technicalHistory.count({ where: { poolId: pool.id, type: 'VISIT_ASSIGNMENT_RECEIVED' } }), 1);
  assert.deepEqual(await prisma.serviceVisit.findUnique({ where: { id } }), regularAfterHandover);
  // A receipt records acknowledgement only; handover above belongs to a separate reminder.
  const extraAfter = await prisma.extraVisit.findUnique({ where: { id } }); assert.deepEqual(extraAfter, extra);
  console.log('PASS literal server refusal, delayed real receipt with stable disabled action, exactly one typed acknowledgement; visits remain unstarted');

  await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true);
  for (const [lang, w] of Object.entries(words)) { await locale(lang); assert((await page.locator('#receiptStatus').textContent()).startsWith(w.offline)); }
  const offlinePosts = requests.filter(row => row.method === 'POST').length;
  await page.locator(`[data-receipt="${receipts[0].id}"]`).evaluate(async node => { await node.closest('#receiptList').onclick({ target: node }); });
  assert.equal(requests.filter(row => row.method === 'POST').length, offlinePosts);
  await refresh('handoverRefresh'); assert((await page.locator('#handoverStatus').textContent()).startsWith(words.de.unknown));
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.CristalI18n && window.CWFieldReminders);
  assert.equal(await page.locator('#visitReceiptPanel h2').textContent(), words.de.receipt);
  const cacheName = fs.readFileSync('frontend/sw.js', 'utf8').match(/const CACHE = '([^']+)'/)[1];
  assert(await page.evaluate(name => caches.keys().then(keys => keys.includes(name)), cacheName));
  await context.setOffline(false); await page.evaluate(() => CWFieldReminders.sync()); await refresh('handoverRefresh'); await refresh('receiptRefresh');
  await page.route('**/api/technician/visit-receipts', route => route.fulfill({ contentType: 'application/json', body: '{"ok":true,"receipts":[]}' })); await refresh('receiptRefresh');
  for (const [lang, w] of Object.entries(words)) { await locale(lang); assert.equal(await page.locator('#receiptStatus').textContent(), w.empty); }
  assert.deepEqual(errors, []); assert.equal(await page.evaluate(() => window.qaInjected), undefined);
  console.log('PASS offline controls send no acknowledgement, cached reload uses the selected language, empty states and no injected markup/page errors');
  completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const release of releases) release(); await browser?.close(); await prisma.$disconnect(); clearTimeout(deadline); });
