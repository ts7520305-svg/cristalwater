'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  saved: ['Registo guardado', 'Saved record', 'Enregistrement sauvegardé', 'Registro guardado', 'Gespeicherter Eintrag'],
  help: ['Esta visita já foi feita. Pode ajustar e guardar correção.', 'This visit is complete. You can adjust it and save a correction.', 'Cette visite est terminée. Vous pouvez la modifier et enregistrer une correction.', 'Esta visita ya se ha realizado. Puedes ajustarla y guardar una corrección.', 'Dieser Besuch ist abgeschlossen. Sie können ihn anpassen und eine Korrektur speichern.'],
  done: ['Feita', 'Completed', 'Terminée', 'Completada', 'Abgeschlossen'],
  labels: [
    ['Checklist', 'Checklist', 'Checklist', 'Lista de comprobación', 'Checkliste'],
    ['pH', 'pH', 'pH', 'pH', 'pH'],
    ['Cloro', 'Chlorine', 'Chlore', 'Cloro', 'Chlor'],
    ['Alcalinidade', 'Alkalinity', 'Alcalinité', 'Alcalinidad', 'Alkalinität'],
    ['ORP', 'ORP', 'ORP', 'ORP', 'ORP'],
    ['Temperatura', 'Temperature', 'Température', 'Temperatura', 'Temperatur'],
    ['Produtos', 'Products', 'Produits', 'Productos', 'Produkte'],
    ['Fotos', 'Photos', 'Photos', 'Fotos', 'Fotos'],
    ['Estado', 'Status', 'État', 'Estado', 'Status'],
  ],
  checks: [
    ['Limpeza', 'Cleaning', 'Nettoyage', 'Limpieza', 'Reinigung'],
    ['Aspiracao', 'Vacuuming', 'Aspiration', 'Aspiración', 'Absaugen'],
    ['Cesto', 'Basket', 'Panier', 'Cesta', 'Korb'],
    ['Escovagem', 'Brushing', 'Brossage', 'Cepillado', 'Bürsten'],
    ['Linha de agua', 'Waterline', 'Ligne d’eau', 'Línea de agua', 'Wasserlinie'],
    ['Filtro', 'Filter', 'Filtre', 'Filtro', 'Filter'],
  ],
  noChecks: ['Sem checklist marcada', 'No checklist items marked', 'Aucun élément de checklist coché', 'Sin elementos marcados en la lista', 'Keine Punkte der Checkliste markiert'],
  noReading: ['Sem registo', 'No reading recorded', 'Aucune mesure enregistrée', 'Sin lectura registrada', 'Kein Messwert erfasst'],
  noProducts: ['Sem produtos', 'No products', 'Aucun produit', 'Sin productos', 'Keine Produkte'],
  photos: [['foto', 'photo', 'photo', 'foto', 'Foto'], ['fotos', 'photos', 'photos', 'fotos', 'Fotos']],
  state: ['Correção aberta', 'Correction open', 'Correction ouverte', 'Corrección abierta', 'Korrektur offen'],
  notes: ['Notas guardadas:', 'Saved notes:', 'Notes enregistrées :', 'Notas guardadas:', 'Gespeicherte Notizen:'],
  noNotes: ['Sem notas registadas nesta visita.', 'No notes recorded for this visit.', 'Aucune note enregistrée pour cette visite.', 'Sin notas registradas en esta visita.', 'Keine Notizen für diesen Besuch erfasst.'],
  noDate: ['Sem data definida', 'No date specified', 'Aucune date définie', 'Sin fecha definida', 'Kein Datum festgelegt'],
};
let browser, completed = false;
const deadline = setTimeout(() => { console.error('Correction-summary scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), endAt = new Date(now - 60000), rawNotes = 'Sem notas registadas nesta visita. <b>{count}</b>';
  const vehicle = await prisma.vehicle.create({ data: { plate: 'SUMMARY-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Summary <b>{count}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Summary client', active: true } });
  const pools = await Promise.all(['REGULAR', 'EXTRA', 'PLANNED'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' <b>{count}</b>', active: true } })));
  const max = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...max.map(row => row._max.id || 0)) + 1;
  const checks = ['cleaned', 'vacuumed', 'basketCleaned', 'brushed', 'waterlineClean', 'backwashDone'];
  const common = { id, clientId: client.id, technicianId: tech.id, status: 'DONE', startAt: new Date(now - 3600000), endAt };
  const chemicals = [{ name: 'Sem produtos', quantity: 0, unit: 'kg' }, { name: 'Cloro <b>{count}</b>', quantity: '1,25', unit: 'l' }];
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: new Date(), plannedDate: new Date(), notes: rawNotes, ph: 0, chlorine: 0, alkalinity: 123.5, orpMv: 650, temperature: 21.25, chemicalsJson: chemicals, ...Object.fromEntries(checks.map(key => [key, true])) } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt: new Date(), notes: 'Planeamento literal', execution: { notes: '', chemicalsJson: [], ...Object.fromEntries(checks.map(key => [key, false])) } } });
  for (const table of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
  const planned = await prisma.serviceVisit.create({ data: { clientId: client.id, technicianId: tech.id, poolId: pools[2].id, status: 'PLANNED', date: new Date(), plannedDate: new Date() } });
  for (let n = 0; n < 2; n++) await prisma.visitPhoto.create({ data: { visitId: id, url: base + '/qa-summary-' + n + '.png', type: 'AFTER' } });
  await prisma.extraVisitPhoto.create({ data: { extraVisitId: id, url: base + '/qa-summary-extra.png', type: 'AFTER' } });
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-SUMMARY-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 86400000 * 30), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 86400000 * 30) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const draft = { v: 2, owner: 'TECH:' + tech.id, drafts: Object.fromEntries(['REGULAR', 'EXTRA'].map(type => ['visit-' + type + '-' + id, { values: { notes: 'Rascunho ' + type + ' <b>{count}</b>' }, checks: {} }])) };
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1400 }, timezoneId: 'Europe/Lisbon' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech, vehicle, draft, now, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaCorrectionSummary')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, name: tech.name, role: 'TECHNICIAN' }));
      localStorage.setItem('cwVehicleId', String(vehicle.id));
      localStorage.setItem('cwFieldVisitDrafts:v2:TECH:' + tech.id, JSON.stringify(draft));
      localStorage.setItem('qaCorrectionSummary', '1');
    }
    Date.now = () => now;
    const interval = window.setInterval;
    window.setInterval = (callback, ms, ...args) => [15000, 30000, 60000].includes(ms) ? 0 : interval(callback, ms, ...args);
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
  }, { token, tech, vehicle, draft, now, origin: base });
  const page = await context.newPage(), requests = [], errors = [];
  page.setDefaultTimeout(9000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) requests.push({ path, method: request.method(), body: request.postData() }); });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = async () => { await page.waitForFunction(() => !['…', ''].includes(document.getElementById('fieldPhotosValue')?.textContent) && /^(Válidos|Valid|Valides|Gültig)$/.test(document.getElementById('fieldDocsValue')?.textContent || '') && ['saved', 'review', 'empty'].includes(document.getElementById('fieldSaveStatus')?.dataset.state)); await settle(); };
  const instrument = () => page.evaluate(() => {
    window.qaSummaryCalls = {}; window.qaSummaryLoads = 0; window.qaSummaryPending = 0;
    for (const [group, api, names] of [['reminder', CWFieldReminders, ['list', 'create', 'mark', 'sync', 'context']], ['journal', CWFieldAlertJournal, ['scope', 'read', 'record', 'states']], ['documents', CWFieldDocuments, ['load', 'scope']], ['offline', CWFieldOffline, ['pending']], ['photos', CWFieldPhotos, ['list', 'save', 'sync']], ['route', CWFieldRouteCache, ['read', 'save', 'update']]]) for (const name of names) {
      const original = api[name]; api[name] = (...args) => { const key = group + ':' + name; qaSummaryCalls[key] = (qaSummaryCalls[key] || 0) + 1; if (group === 'documents' && name === 'load') { qaSummaryLoads++; qaSummaryPending++; return original(...args).finally(() => { qaSummaryPending--; }); } return original(...args); };
    }
  });
  async function open(type, visitId = id) {
    await page.goto(base + '/technician-field-mode?selectedVisitId=' + visitId + '&selectedVisitType=' + type, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(({ type, visitId }) => CWFieldVisitContext()?.id === visitId && CWFieldVisitContext().visitType === type, { type, visitId });
    await ready(); await page.locator('[data-field-tab-button=agora]').click(); await instrument();
  }
  const database = () => Promise.all([prisma.serviceVisit.findMany({ where: { id: { in: [id, planned.id] } }, orderBy: { id: 'asc' }, include: { photos: true } }), prisma.extraVisit.findUnique({ where: { id }, include: { photos: true } }), prisma.technicalHistory.findMany({ where: { poolId: { in: pools.map(pool => pool.id) } } }), prisma.chemicalUsage.findMany({ where: { visitId: id } })]);
  const state = () => page.evaluate(async () => ({
    context: CWFieldVisitContext(), calls: { ...qaSummaryCalls }, focus: document.activeElement.id, tab: document.activeElement.dataset.fieldTabButton,
    local: Object.keys(localStorage).filter(key => /^cwField|^cwWater|^cwPump|^cw:tech/.test(key) || ['token', 'cristalwater_jwt'].includes(key)).sort().map(key => [key, localStorage.getItem(key)]),
    session: Object.keys(sessionStorage).filter(key => key.startsWith('cw:tech-field:')).sort().map(key => [key, sessionStorage.getItem(key)]),
    writes: await CWFieldWriteStore.records(null, CWFieldWriteStore.session(), true),
    form: ['notes', 'ph', 'chlorine', 'alkalinity', 'orp', 'temperature', 'startBtn', 'finishBtn'].map(id => { const node = document.getElementById(id); return [id, node.value, node.readOnly, node.disabled, node.hidden, node.dataset.cwCheckinTarget]; }),
    checks: ['cleaned', 'vacuumed', 'basketCleaned', 'brushed', 'waterlineClean', 'backwashDone'].map(id => { const node = document.getElementById(id); return [id, node.checked, node.disabled]; }),
  }));
  let count = 0;
  async function matrix({ label, all = false, subset = [], photos = 0, date = endAt.toISOString(), invalidDate = false, hidden = false, widths = [320] }) {
    await settle(); await page.locator('[data-field-tab-button=agora]').focus();
    await page.evaluate(() => { window.qaSummaryNodes = [...document.querySelectorAll('#correctionSummaryCard, #correctionSummaryCard *')]; window.qaSummaryHandler = document.getElementById('finishBtn').onclick; });
    const before = await state(), db = await database(), start = requests.length;
    for (const width of widths) { await page.setViewportSize({ width, height: 1400 }); for (const [i, language] of languages.entries()) {
      await page.locator('#cwLanguageSelect').selectOption(language); await page.waitForFunction(language => document.documentElement.lang === language, language); await settle();
      assert.equal(await page.locator('#correctionSummaryCard').isVisible(), !hidden, label + ' card visibility');
      assert.equal(await page.locator('#correctionSummaryCard .service-summary-head > div > .chip').textContent(), words.saved[i], 'Correction heading follows language ' + language);
      assert.equal(await page.locator('#correctionSummaryCard .service-summary-head .muted').textContent(), words.help[i]);
      if (hidden) assert.equal(await page.locator('#correctionSummary').textContent(), '');
      else {
        const expectedDate = date ? invalidDate ? words.noDate[i] : await page.evaluate(({ date, language }) => new Date(date).toLocaleString({ pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' }[language], { dateStyle: 'short', timeStyle: 'short' }), { date, language }) : words.done[i];
        assert.equal(await page.locator('#correctionSavedAt').textContent(), expectedDate);
        assert.deepEqual(await page.locator('#correctionSummary .service-summary-item > span').allTextContents(), words.labels.map(row => row[i]));
        const checklist = all ? words.checks.map(row => row[i]).join(' / ') : subset.length ? subset.map(index => words.checks[index][i]).join(' / ') : words.noChecks[i];
        const values = [checklist, ...(all ? ['0', '0 ppm', '123.5 ppm', '650 mV', '21.25 C'] : Array(5).fill(words.noReading[i])), all ? 'Sem produtos 0 kg / Cloro <b>{count}</b> 1,25 l' : words.noProducts[i], photos + ' ' + words.photos[photos === 1 ? 0 : 1][i], words.state[i]];
        assert.deepEqual(await page.locator('#correctionSummary .service-summary-item > b').allTextContents(), values);
        assert.equal(await page.locator('#correctionSummary .service-summary-note > strong').textContent(), words.notes[i]);
        assert.equal((await page.locator('#correctionSummary .service-summary-note').textContent()).replace(words.notes[i], '').trim(), all ? rawNotes : words.noNotes[i]);
        assert.equal(await page.locator('#correctionSummary .service-summary-note b,#correctionSummary .service-summary-item b b').count(), 0, 'Saved text remains escaped');
        assert(await page.locator('#correctionSummaryCard').evaluate(card => card.scrollWidth <= card.clientWidth + 1 && [...card.querySelectorAll('.service-summary-item')].every(node => node.scrollWidth <= node.clientWidth + 1)), label + ' fits ' + width + ' ' + language);
      }
      assert.deepEqual(await state(), before); assert.deepEqual(await database(), db);
      assert(await page.evaluate(() => qaSummaryNodes.every(node => node.isConnected) && qaSummaryHandler === document.getElementById('finishBtn').onclick), 'Language change retains summary nodes and correction handler');
      count++;
      if (process.env.CW_CORRECTION_CAPTURE && label === 'regular' && width === 320 && language === 'de') { await fs.mkdir(process.env.CW_CORRECTION_CAPTURE, { recursive: true }); await page.locator('#correctionSummaryCard').screenshot({ path: process.env.CW_CORRECTION_CAPTURE + '/summary-de-320.png' }); }
    } }
    for (const request of requests.slice(start)) { assert.equal(request.path, '/api/settings/language/me'); assert.equal(request.method, 'PUT'); assert.deepEqual(Object.keys(JSON.parse(request.body)), ['language']); }
    console.log('PASS correction summary ' + JSON.stringify({ label, widths, languages }));
  }
  await open('REGULAR');
  await page.locator('#cwLanguageSelect').selectOption('en'); await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.locator('#correctionSummaryCard .service-summary-head > div > .chip').textContent(), words.saved[1], 'Owned correction heading follows the actual selector');
  await matrix({ label: 'regular', all: true, photos: 2, widths: [320, 390, 1440] });
  await open('EXTRA'); await matrix({ label: 'extra', photos: 1 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller); await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await page.locator('[data-field-tab-button=agora]').click(); await instrument();
  await matrix({ label: 'offline-extra', photos: 1 });
  const key = await page.evaluate(() => CWFieldRouteCache.key(CWFieldRouteCache.scope())), raw = await page.evaluate(key => localStorage.getItem(key), key);
  for (const sample of [{ label: 'no-date-zero-photos', date: null, subset: [0, 5] }, { label: 'invalid-date', date: 'invalid-date', invalidDate: true }, { label: 'planned-hidden', date: null, hidden: true }]) {
    const cache = JSON.parse(raw), row = cache.visits.find(row => row.id === id && row.visitType === 'EXTRA');
    Object.assign(row, { endAt: sample.date, status: sample.hidden ? 'PLANNED' : 'DONE', photos: [], ...Object.fromEntries(checks.map((key, i) => [key, (sample.subset || []).includes(i)])) });
    const loads = await page.evaluate(() => qaSummaryLoads); await page.evaluate(({ key, value }) => { localStorage.setItem(key, value); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); }, { key, value: JSON.stringify(cache) });
    await page.waitForFunction(loads => qaSummaryLoads > loads && !qaSummaryPending, loads); await ready();
    await matrix(sample);
  }
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  await context.setOffline(false); await open('REGULAR', planned.id); await matrix({ label: 'real-planned-hidden', hidden: true });
  await open('REGULAR'); await matrix({ label: 'regular-return', all: true, photos: 2 });
  const stored = await page.evaluate(() => CWFieldDraftSnapshot());
  for (const type of ['REGULAR', 'EXTRA']) assert.equal(stored['visit-' + type + '-' + id].values.notes, 'Rascunho ' + type + ' <b>{count}</b>');
  assert.deepEqual(errors, []); assert.deepEqual((await database()).slice(2), [[], []]);
  assert(requests.filter(request => !['GET', 'HEAD'].includes(request.method)).every(request => request.method === 'PUT' && request.path === '/api/settings/language/me'));
  console.log('PASS correction-summary ' + JSON.stringify({ checks: count, typedDrafts: true, escapedData: true, operationalWrites: 0 })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
