'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const incomplete = require('../src/business/technician/IncompleteVisitBusiness');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const words = {
  pt: { title: 'Química a preparar', refresh: 'Atualizar necessidades', receive: 'Confirmar receção de química', transfer: 'Transferência para a viatura', quantity: 'Quantidade recebida', submit: 'Recebi esta quantidade', cancel: 'Cancelar', available: 'Disponível para confirmar:', unknown: 'Quantidade por confirmar', returned: 'Devolvido ao armazém:', missing: 'Sem transferência correspondente registada', storage: 'Não foi possível guardar o pedido', retry: 'Pode repetir com os mesmos dados.', offline: 'Sem rede.', open: 'Termine ou cancele a receção em aberto', empty: 'Sem faltas de química reportadas por resolver.', complete: 'Quantidade reportada recebida.' },
  en: { title: 'Chemicals to prepare', refresh: 'Refresh requirements', receive: 'Confirm chemical receipt', transfer: 'Transfer to the vehicle', quantity: 'Quantity received', submit: 'I received this quantity', cancel: 'Cancel', available: 'Available to confirm:', unknown: 'Quantity to be confirmed', returned: 'Returned to the warehouse:', missing: 'No matching transfer has been recorded', storage: 'Could not save the request', retry: 'You can retry with the same details.', offline: 'Offline.', open: 'Finish or cancel the open receipt', empty: 'No reported chemical shortages remain unresolved.', complete: 'Reported quantity received.' },
  fr: { title: 'Produits chimiques à préparer', refresh: 'Actualiser les besoins', receive: 'Confirmer la réception des produits', transfer: 'Transfert vers le véhicule', quantity: 'Quantité reçue', submit: 'J’ai reçu cette quantité', cancel: 'Annuler', available: 'Disponible à confirmer :', unknown: 'Quantité à confirmer', returned: 'Retourné à l’entrepôt :', missing: 'Aucun transfert correspondant n’a été enregistré', storage: 'Impossible d’enregistrer la demande', retry: 'Vous pouvez réessayer avec les mêmes données.', offline: 'Hors ligne.', open: 'Terminez ou annulez la réception en cours', empty: 'Aucun manque de produits chimiques signalé ne reste à traiter.', complete: 'Quantité signalée reçue.' },
  es: { title: 'Productos químicos a preparar', refresh: 'Actualizar necesidades', receive: 'Confirmar recepción de productos', transfer: 'Transferencia al vehículo', quantity: 'Cantidad recibida', submit: 'He recibido esta cantidad', cancel: 'Cancelar', available: 'Disponible para confirmar:', unknown: 'Cantidad por confirmar', returned: 'Devuelto al almacén:', missing: 'No se ha registrado una transferencia correspondiente', storage: 'No se pudo guardar la solicitud', retry: 'Puede repetir con los mismos datos.', offline: 'Sin conexión.', open: 'Termine o cancele la recepción abierta', empty: 'No hay faltas de productos químicos reportadas por resolver.', complete: 'Cantidad reportada recibida.' },
  de: { title: 'Chemikalien vorbereiten', refresh: 'Bedarf aktualisieren', receive: 'Chemikalienempfang bestätigen', transfer: 'Umlagerung ins Fahrzeug', quantity: 'Erhaltene Menge', submit: 'Diese Menge habe ich erhalten', cancel: 'Abbrechen', available: 'Zur Bestätigung verfügbar:', unknown: 'Menge noch zu bestätigen', returned: 'Ins Lager zurückgegeben:', missing: 'Keine passende Umlagerung wurde erfasst', storage: 'Die Anfrage konnte nicht gespeichert werden', retry: 'Sie können es mit denselben Angaben erneut versuchen.', offline: 'Offline.', open: 'Schließen Sie die offene Empfangsbestätigung ab', empty: 'Keine gemeldeten Chemikalienfehlmengen sind noch offen.', complete: 'Gemeldete Menge erhalten.' }
};
let browser, completed = false;
const releases = [], deadline = setTimeout(() => { console.error('Chemical preparation language assertions did not finish'); process.exit(1); }, 90000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const vehicle = await prisma.vehicle.create({ data: { plate: 'LANG-' + Date.now(), active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Chemical language technician', active: true, vehicleId: vehicle.id } });
  const client = await prisma.client.create({ data: { name: 'Chemical language client', active: true } });
  const literal = 'Piscina <img src=x onerror=window.qaInjected=true> {quantity}';
  const product = 'Cloro literal <b>Original</b> {name}';
  const pool = await prisma.pool.create({ data: { name: literal, clientId: client.id, active: true } });
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1;
  const common = { id, clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'PLANNED' };
  await prisma.serviceVisit.create({ data: { ...common, date: new Date(), plannedDate: new Date() } });
  await prisma.extraVisit.create({ data: { ...common, scheduledAt: new Date(), execution: { notes: 'Original execution' } } });
  for (const table of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
  const user = { id: tech.id, role: 'TECHNICIAN' }, token = jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  async function report(visitType, quantity) { const view = await incomplete.view(user, id, { visitType }); return incomplete.report(user, id, { visitType, poolId: pool.id, baseVersion: view.baseVersion, requestId: randomUUID(), reason: 'CHEMICAL_MISSING', nextStep: 'Levar o produto original em falta', chemicalShortage: { productName: product + (visitType === 'EXTRA' ? ' EXTRA' : ''), quantity, unit: 'L' } }); }
  const regular = await report('REGULAR', 4), extra = await report('EXTRA', null);
  const visits = { regular: await prisma.serviceVisit.findUnique({ where: { id } }), extra: await prisma.extraVisit.findUnique({ where: { id } }) };
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Europe/Lisbon' });
  await context.addInitScript(({ token, tech, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaChemicalLanguages')) { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, role: 'TECHNICIAN', name: tech.name })); localStorage.setItem('qaChemicalLanguages', '1'); }
    const interval = window.setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000, 60000].includes(delay) ? 0 : interval(callback, delay, ...args);
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } }); window.alert = () => {};
  }, { token, tech, origin: new URL(base).origin });
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  const errors = [], requests = []; page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push({ path: new URL(request.url()).pathname, method: request.method(), body: request.postData() }); });
  const panel = page.locator('#fieldShortagePreparation'), row = reminder => page.locator(`[data-shortage="${reminder.id}"]`), regularRow = row(regular.reminder), extraRow = row(extra.reminder);
  const form = () => panel.locator('form'), status = () => page.locator('#shortageStatus').textContent();
  const locale = language => page.locator('#cwLanguageSelect').selectOption(language);
  const refresh = () => page.evaluate(() => document.getElementById('shortageRefresh').onclick());
  const submit = () => form().evaluate(node => node.onsubmit({ preventDefault() {}, currentTarget: node }));
  const chemicalPosts = () => requests.filter(r => r.method === 'POST' && /^\/api\/technician\/chemical-shortages\//.test(r.path));
  const bytes = () => page.evaluate(async () => ({ storage: Object.fromEntries(Object.keys(localStorage).filter(k => /^(cwField|cwWater|cwPump|cwChemicalDelivery)/.test(k)).sort().map(k => [k, localStorage.getItem(k)])), outbox: await CWFieldWriteStore.records(null, CWFieldWriteStore.session(), true) }));
  function onlyLanguageSince(index) { for (const r of requests.slice(index)) { assert.equal(r.path, '/api/settings/language/me', JSON.stringify(r)); assert.equal(r.method, 'PUT'); const body = JSON.parse(r.body); assert.deepEqual(Object.keys(body), ['language']); assert(Object.hasOwn(words, body.language)); } }
  async function open(reminder) { await row(reminder).locator('[data-delivery-options]').click(); await page.waitForFunction(id => { const card = document.querySelector(`[data-shortage="${id}"]`); return card?.querySelector('form') && !card.querySelector('[data-delivery-options]').disabled; }, reminder.id); }
  await page.goto(base + `/technician-field-mode?selectedVisitId=${id}&selectedVisitType=REGULAR`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.CristalI18n && window.CWFieldReminders && window.CWFieldWriteStore && window.CWFieldEquipment);
  await page.evaluate(() => CWFieldReminders.sync()); await page.locator('[data-field-tab-button="hoje"]').click(); await refresh();
  await locale('en'); assert.equal(await panel.locator('h2').textContent(), words.en.title);
  assert((await regularRow.textContent()).includes('visit #' + id)); assert((await extraRow.textContent()).includes('extra visit #' + id));
  await regularRow.locator('[data-delivery-options]').click(); await page.waitForFunction(id => !document.querySelector(`[data-delivery-options="${id}"]`).disabled && document.querySelector(`[data-shortage="${id}"] [data-delivery-form]`).textContent.length, regular.reminder.id);
  for (const [language, w] of Object.entries(words)) { await locale(language); assert((await regularRow.locator('[data-delivery-form]').textContent()).startsWith(w.missing)); }
  const movement = await prisma.stockMovement.create({ data: { movementType: 'TRANSFER_TO_VEHICLE', scopeTo: 'VEHICLE', vehicleId: vehicle.id, productName: product, unit: 'L', quantity: 10 } });
  const second = await prisma.stockMovement.create({ data: { movementType: 'TRANSFER_TO_VEHICLE', scopeTo: 'VEHICLE', vehicleId: vehicle.id, productName: product, unit: 'L', quantity: 6 } });
  const stockBefore = await prisma.stockMovement.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } });
  await open(regular.reminder); await form().locator('[name=movement]').selectOption(String(movement.id)); await form().locator('[name=quantity]').fill('1.25');
  await page.evaluate(() => { window.qaChemicalNodes = Array.from(document.querySelectorAll('#fieldShortagePreparation,#fieldShortagePreparation *')); });
  const stored = await bytes(), beforeRequests = requests.length;
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const [language, w] of Object.entries(words)) {
    await locale(language); assert.equal(await panel.locator('h2').textContent(), w.title); assert.equal(await page.locator('#shortageRefresh').textContent(), w.refresh);
    assert((await form().locator('label').nth(0).textContent()).startsWith(w.transfer)); assert((await form().locator('label').nth(1).textContent()).startsWith(w.quantity));
    assert.equal(await form().locator('[type=submit]').textContent(), w.submit); assert.equal(await form().locator('[data-delivery-cancel]').textContent(), w.cancel);
    assert((await form().locator('[data-delivery-details]').textContent()).startsWith(w.available)); assert((await extraRow.textContent()).includes(w.unknown));
    assert((await panel.textContent()).includes(product)); assert((await panel.textContent()).includes(literal));
    assert.equal(await form().locator('[name=quantity]').inputValue(), '1.25'); assert.equal(await form().locator('[name=movement]').inputValue(), String(movement.id));
    const state = await page.evaluate(language => { const input = document.querySelector('#fieldShortagePreparation [name=quantity]'); input.focus(); CristalI18n.applyLanguage(language); return { nodes: qaChemicalNodes.every(n => n.isConnected), focus: document.activeElement === input, disabled: input.disabled, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; }, language);
    assert.deepEqual(state, { nodes: true, focus: true, disabled: false, overflow: false }); assert.deepEqual(await bytes(), stored);
  } } onlyLanguageSince(beforeRequests);
  await page.evaluate(() => CristalI18n.applyLanguage('fr', { silent: true })); await page.waitForFunction(title => document.querySelector('#fieldShortagePreparation h2').textContent === title, words.fr.title);
  // Optional screenshots must not decide the language used by subsequent assertions.
  await locale('de');
  if (process.env.CW_CAPTURE_UI) { fs.mkdirSync('reports/field-ui', { recursive: true }); await page.setViewportSize({ width: 320, height: 900 }); await panel.scrollIntoViewIfNeeded(); await panel.screenshot({ path: 'reports/field-ui/CHEMICAL_PREPARATION_DE_320.png' }); }
  await extraRow.locator('[data-delivery-options]').click(); assert((await status()).startsWith(words.de.open)); assert.equal(await form().count(), 1);
  console.log('PASS five languages/three widths, same-ID visit types, unknown need, literal names/markup, missing transfer recovery, stable form nodes/focus/values/storage and language-only preference writes');

  const beforeQuota = chemicalPosts().length;
  await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) { if (key.startsWith('cwChemicalDelivery:')) throw Error('QA quota'); return qaSetItem.call(this, key, value); }; }); await submit();
  for (const [language, w] of Object.entries(words)) { await locale(language); assert((await form().locator('[role=status]').textContent()).startsWith(w.storage)); }
  assert.equal(chemicalPosts().length, beforeQuota); assert.equal(await form().locator('[name=quantity]').inputValue(), '1.25'); await page.evaluate(() => { Storage.prototype.setItem = qaSetItem; });
  const literalError = 'Falha ao confirmar <b>detalhe original</b> {quantity}', path = `**/api/technician/chemical-shortages/${regular.reminder.id}/deliveries`;
  const denied = route => route.request().method() === 'POST' ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: literalError }) }) : route.continue(); await page.route(path, denied); await submit();
  const request = chemicalPosts().at(-1), pendingBytes = await bytes(), failedCount = requests.length;
  for (const [language, w] of Object.entries(words)) { await locale(language); assert.equal(await form().locator('[role=status]').textContent(), literalError + ' ' + w.retry); assert.deepEqual(await bytes(), pendingBytes); } onlyLanguageSince(failedCount); await page.unroute(path, denied);
  let release, entered; const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; }); releases.push(release);
  const lost = async route => { if (route.request().method() !== 'POST') return route.continue(); const response = await route.fetch(); assert.equal(response.status(), 200); entered(); await gate; await route.abort('failed'); };
  await page.route(path, lost); const sending = submit(); await started; const heldCount = requests.length;
  for (const language of Object.keys(words)) { await locale(language); assert(await page.locator('#shortageRefresh').isDisabled()); assert(await form().locator('[name=quantity]').isDisabled()); assert.deepEqual(await bytes(), pendingBytes); } onlyLanguageSince(heldCount);
  release(); await sending; await page.unroute(path, lost); assert.deepEqual(chemicalPosts().at(-1), request);
  const body = JSON.parse(request.body), sourceKey = 'chemical-delivery:' + body.requestId;
  assert.equal(await prisma.operationalReminder.count({ where: { sourceKey } }), 1); assert.deepEqual(await bytes(), pendingBytes);
  await submit(); assert.deepEqual(chemicalPosts().at(-1), request); assert.equal(await prisma.operationalReminder.count({ where: { sourceKey } }), 1); assert.equal(await form().count(), 0);
  assert((await regularRow.textContent()).includes('1.25 L')); assert((await regularRow.textContent()).includes('2.75 L'));
  assert(!(await bytes()).storage[Object.keys(pendingBytes.storage).find(key => key.startsWith('cwChemicalDelivery:'))]);
  assert.deepEqual(await prisma.stockMovement.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } }), stockBefore);
  assert.deepEqual(await prisma.serviceVisit.findUnique({ where: { id } }), visits.regular); assert.deepEqual(await prisma.extraVisit.findUnique({ where: { id } }), visits.extra);
  console.log('PASS quota sends nothing; literal refusal, lost real response and exact UUID/payload retry create one receipt; stock and visits unchanged');

  await open(regular.reminder); await form().locator('[name=movement]').selectOption(String(second.id)); await form().locator('[name=quantity]').fill('2.75');
  await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); const offlinePosts = chemicalPosts().length; await submit();
  for (const [language, w] of Object.entries(words)) { await locale(language); assert((await form().locator('[role=status]').textContent()).startsWith(w.offline)); assert.equal(await form().locator('[name=quantity]').inputValue(), '2.75'); }
  assert.equal(chemicalPosts().length, offlinePosts); await context.setOffline(false); await page.evaluate(() => CWFieldReminders.sync());
  await submit(); assert.equal(await form().count(), 0);
  for (const [language, w] of Object.entries(words)) { await locale(language); assert((await regularRow.textContent()).includes(w.complete)); }
  assert.equal(await regularRow.locator('[data-delivery-options]').count(), 0); assert.equal(await extraRow.locator('[data-delivery-options]').count(), 1);
  // A controlled read overlays a returned quantity to exercise its presentation without inventing a physical stock return.
  const returned = async route => { const response = await route.fetch(), data = await response.json(); data.rows.find(row => row.shortageId === regular.reminder.id).returnedQuantity = 0.5; await route.fulfill({ response, json: data }); };
  await page.route('**/api/technician/chemical-shortages', returned); await refresh(); const returnedCount = requests.length;
  for (const [language, w] of Object.entries(words)) { await locale(language); assert((await regularRow.textContent()).includes(w.returned + ' 0.5 L')); } onlyLanguageSince(returnedCount); await page.unroute('**/api/technician/chemical-shortages', returned);
  await page.route('**/api/technician/chemical-shortages', route => route.fulfill({ contentType: 'application/json', body: '{"ok":true,"rows":[]}' })); await refresh();
  for (const [language, w] of Object.entries(words)) { await locale(language); assert((await status()).startsWith(w.empty)); } await page.unroute('**/api/technician/chemical-shortages');
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.CristalI18n && document.querySelector('#shortageStatus')?.textContent);
  assert.equal(await panel.locator('h2').textContent(), words.de.title); assert((await status()).startsWith(words.de.offline));
  const cacheName = fs.readFileSync('frontend/sw.js', 'utf8').match(/const CACHE = '([^']+)'/)[1]; assert(await page.evaluate(name => caches.keys().then(keys => keys.includes(name)), cacheName));
  assert.deepEqual(await prisma.stockMovement.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } }), stockBefore);
  assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: { startsWith: 'chemical-delivery:' }, assignedToTechnicianId: tech.id } }), 2);
  assert.deepEqual(errors, []); assert.equal(await page.evaluate(() => window.qaInjected), undefined);
  console.log('PASS offline guard, remaining quantity completed once, separate unknown need, returned-quantity presentation, empty states and cached language; exactly two receipts and no stock mutation'); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const release of releases) release(); await browser?.close(); await prisma.$disconnect(); clearTimeout(deadline); });
