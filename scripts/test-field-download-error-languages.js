'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), jwt = require('jsonwebtoken'), { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  INVALID_DOCUMENT: ['Documento fora da aplicação ou link inválido.', 'The document is outside the application or the link is invalid.', 'Le document est hors de l’application ou le lien est invalide.', 'El documento está fuera de la aplicación o el enlace no es válido.', 'Das Dokument liegt außerhalb der Anwendung oder der Link ist ungültig.'],
  SESSION: ['A sessão mudou ou expirou. Entre novamente para abrir o documento.', 'The session has changed or expired. Sign in again to open the document.', 'La session a changé ou a expiré. Connectez-vous à nouveau pour ouvrir le document.', 'La sesión ha cambiado o ha caducado. Inicia sesión de nuevo para abrir el documento.', 'Die Sitzung hat sich geändert oder ist abgelaufen. Melden Sie sich erneut an, um das Dokument zu öffnen.'],
  POPUP: ['Permita a abertura de uma nova janela para consultar o documento.', 'Allow a new window to open to view the document.', 'Autorisez l’ouverture d’une nouvelle fenêtre pour consulter le document.', 'Permite abrir una nueva ventana para consultar el documento.', 'Erlauben Sie das Öffnen eines neuen Fensters, um das Dokument anzusehen.'],
  UNAVAILABLE: ['A sua sessão não permite consultar este documento ou o documento já não está disponível.', 'Your session does not permit access to this document, or it is no longer available.', 'Votre session ne permet pas de consulter ce document ou il n’est plus disponible.', 'Tu sesión no permite consultar este documento o ya no está disponible.', 'Ihre Sitzung erlaubt keinen Zugriff auf dieses Dokument oder es ist nicht mehr verfügbar.'],
  UNCONFIRMED: ['A resposta não confirma o documento selecionado. Volte a tentar.', 'The response does not confirm the selected document. Try again.', 'La réponse ne confirme pas le document sélectionné. Réessayez.', 'La respuesta no confirma el documento seleccionado. Vuelve a intentarlo.', 'Die Antwort bestätigt das ausgewählte Dokument nicht. Versuchen Sie es erneut.'],
  INCOMPLETE: ['O documento recebido está incompleto. Volte a tentar.', 'The received document is incomplete. Try again.', 'Le document reçu est incomplet. Réessayez.', 'El documento recibido está incompleto. Vuelve a intentarlo.', 'Das empfangene Dokument ist unvollständig. Versuchen Sie es erneut.'],
  TIMEOUT: ['O documento demorou demasiado. Volte a tentar.', 'The document took too long. Try again.', 'Le document a mis trop de temps à arriver. Réessayez.', 'El documento ha tardado demasiado. Vuelve a intentarlo.', 'Das Dokument hat zu lange gebraucht. Versuchen Sie es erneut.'],
  CANCELLED: ['A abertura foi cancelada. Pode abrir novamente o documento.', 'Opening was cancelled. You can open the document again.', 'L’ouverture a été annulée. Vous pouvez ouvrir à nouveau le document.', 'Se ha cancelado la apertura. Puedes abrir el documento de nuevo.', 'Das Öffnen wurde abgebrochen. Sie können das Dokument erneut öffnen.'],
  RETRY: ['Não foi possível abrir o documento. Volte a tentar.', 'The document could not be opened. Try again.', 'Impossible d’ouvrir le document. Réessayez.', 'No se ha podido abrir el documento. Vuelve a intentarlo.', 'Das Dokument konnte nicht geöffnet werden. Versuchen Sie es erneut.'],
};
let browser, completed = false;
const deadline = setTimeout(() => { console.error('Download-error language scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const now = Date.now(), vehicle = await prisma.vehicle.create({ data: { plate: 'DOWNLOAD-' + now, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'Download <b>{code}</b>', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Download client', active: true } });
  const pools = await Promise.all(['REGULAR', 'EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' download', active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1;
  const common = { id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt: new Date() };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: new Date(), plannedDate: new Date() } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt: new Date() } });
  for (const table of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-DOWNLOAD-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(now + 86400000 * 30), isDraft: false } });
  const work = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(now + 86400000 * 30) } });
  const token = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1300 }, timezoneId: 'Europe/Lisbon' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, tech, now, origin }) => {
    if (top !== window || location.origin !== origin) return;
    if (!localStorage.getItem('qaDownloadLanguages')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: tech.id, role: 'TECHNICIAN', name: tech.name }));
      localStorage.setItem('qaDownloadLanguages', '1');
    }
    Date.now = () => now;
    const interval = window.setInterval; window.setInterval = (callback, delay, ...args) => [15000, 30000, 60000].includes(delay) ? 0 : interval(callback, delay, ...args);
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
  }, { token, tech, now, origin: base });
  const page = await context.newPage(), errors = [], requests = [];
  page.setDefaultTimeout(9000); page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) requests.push({ path, method: request.method(), body: request.postData(), auth: request.headers().authorization }); });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const locale = async language => { await page.locator('#cwLanguageSelect').selectOption(language); await page.waitForFunction(language => document.documentElement.lang === language, language); await settle(); };
  const path = '/api/guides/work/' + work.id + '/pdf';
  const link = () => page.locator('#workGuideBox a[href="' + path + '"]');
  async function open(type) {
    await page.goto(base + '/technician-field-mode?selectedVisitId=' + id + '&selectedVisitType=' + type, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(type => CWFieldVisitContext()?.visitType === type && ['transportGuideBox', 'workGuideBox', 'insuranceBox'].every(id => document.getElementById(id).dataset.source === 'live') && !['…', ''].includes(document.getElementById('fieldPhotosValue')?.textContent), type);
    await page.locator('[data-field-tab-button=agora]').click(); await page.locator('#notes').fill(type + ' download draft <b>{code}</b>');
    await page.waitForFunction(() => document.getElementById('fieldSaveStatus').dataset.state === 'saved'); await page.locator('[data-field-tab-button=docs]').click(); await settle();
    await page.evaluate(async path => {
      const response = await fetch(path, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }); if (response.status !== 200) throw Error('Real work PDF unavailable');
      window.qaPdf = { bytes: await response.arrayBuffer(), headers: [...response.headers] };
      window.qaDownloadOriginal = { fetch: window.fetch.bind(window), open: window.open, timeout: window.setTimeout.bind(window), create: URL.createObjectURL.bind(URL), toast: CristalAuth.toast.bind(CristalAuth) };
      window.qaDownloadNoticeCount = 0;
      CristalAuth.toast = (...args) => { qaDownloadNoticeCount++; return qaDownloadOriginal.toast(...args); };
      window.qaDownloadKind = 'REAL'; window.qaDownloadCalls = { fetch: 0, popup: 0, blob: 0 }; window.qaDownloadPopup = null;
      window.open = () => { qaDownloadCalls.popup++; if (qaDownloadKind === 'POPUP') return null; return qaDownloadPopup = { closed: false, location: {}, close() { this.closed = true; } }; };
      URL.createObjectURL = value => { qaDownloadCalls.blob++; return qaDownloadOriginal.create(value); };
      window.setTimeout = (fn, delay, ...args) => qaDownloadOriginal.timeout(fn, delay === 20000 && qaDownloadKind === 'TIMEOUT' ? 15 : delay, ...args);
      window.fetch = async (input, options) => {
        if (new URL(typeof input === 'string' ? input : input.url, location.href).pathname !== path) return qaDownloadOriginal.fetch(input, options);
        qaDownloadCalls.fetch++;
        if (qaDownloadKind === 'REAL') return qaDownloadOriginal.fetch(input, options);
        if (qaDownloadKind === 'TIMEOUT') return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
        if (qaDownloadKind === 'RETRY') throw TypeError('Original network failure');
        if (qaDownloadKind === 'FOREIGN') throw Object.assign(Error('Original <b>{code}</b>'), { code: 'RETRY' });
        const headers = new Headers(qaPdf.headers);
        if (qaDownloadKind === 'UNCONFIRMED') headers.set('X-CW-Document-Id', '2147483647');
        if (qaDownloadKind === 'SESSION') localStorage.setItem('user', '{different-account');
        if (qaDownloadKind === 'CANCELLED') qaDownloadPopup.closed = true;
        return new Response(qaDownloadKind === 'INCOMPLETE' ? '%PDF-1.7 unfinished' : qaPdf.bytes, { status: qaDownloadKind === 'UNAVAILABLE' ? 403 : 200, headers });
      };
      window.qaProducerCalls = {};
      for (const [group, api, names] of [['documents', CWFieldDocuments, ['load', 'scope']], ['draft', CWFieldRouteCache, ['read', 'save', 'update']], ['photos', CWFieldPhotos, ['list', 'save', 'sync']], ['offline', CWFieldOffline, ['pending']]]) for (const name of names) { const fn = api[name]; api[name] = (...args) => { const key = group + ':' + name; qaProducerCalls[key] = (qaProducerCalls[key] || 0) + 1; return fn(...args); }; }
    }, path);
  }
  const database = () => Promise.all([prisma.serviceVisit.findUnique({ where: { id } }), prisma.extraVisit.findUnique({ where: { id } }), prisma.transportGuide.findUnique({ where: { id: guide.id } }), prisma.workGuide.findUnique({ where: { id: work.id } }), prisma.fieldWriteRequest.count(), prisma.stockMovement.count()]);
  const state = () => page.evaluate(async () => ({
    context: CWFieldVisitContext(), downloads: { ...qaDownloadCalls }, notices: qaDownloadNoticeCount, producers: { ...qaProducerCalls }, popup: qaDownloadPopup && { closed: qaDownloadPopup.closed, location: qaDownloadPopup.location, opener: qaDownloadPopup.opener },
    local: Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key) || ['token', 'cristalwater_jwt'].includes(key)).sort().map(key => [key, localStorage.getItem(key)]),
    users: ['user', 'cristalwater_user'].map(key => { const user = JSON.parse(localStorage.getItem(key)); delete user.language; return [key, user]; }),
    writes: await CWFieldWriteStore.records(null, CWFieldWriteStore.session(), true),
    fields: ['notes', 'ph', 'chlorine', 'vehicleId', 'technicianId', 'startBtn', 'finishBtn'].map(id => { const node = document.getElementById(id); return [id, node.value, node.readOnly, node.disabled, node.hidden]; }),
    sources: ['transportGuideBox', 'workGuideBox', 'insuranceBox'].map(id => { const node = document.getElementById(id); return [id, node.dataset.source, node.dataset.confirmedAt]; }),
    toastTimer: document.getElementById('cw-v21-toast')._t,
  }));
  async function failure(code) {
    await locale('en'); await page.evaluate(code => { qaDownloadKind = code; }, code);
    const originalUser = await page.evaluate(() => localStorage.getItem('user'));
    if (code === 'INVALID_DOCUMENT') await link().evaluate(node => { node.dataset.qaOriginalHref = node.getAttribute('href'); node.href = 'https://invalid.example/api/guides/work/1/pdf'; });
    const notices = await page.evaluate(() => qaDownloadNoticeCount);
    await (code === 'INVALID_DOCUMENT' ? page.locator('#workGuideBox a[data-qa-original-href]') : link()).click();
    await page.waitForFunction(notices => qaDownloadNoticeCount > notices && document.getElementById('cw-v21-toast')?.style.display === 'block', notices);
    await page.evaluate(originalUser => localStorage.setItem('user', originalUser), originalUser);
    if (code === 'INVALID_DOCUMENT') await page.locator('#workGuideBox a[data-qa-original-href]').evaluate(node => { node.setAttribute('href', node.dataset.qaOriginalHref); delete node.dataset.qaOriginalHref; });
    assert.equal(await page.locator('#cw-v21-toast').textContent(), words[code][1], 'Download failure follows chosen language ' + code);
    const raw = await page.evaluate(async ({ code, path }) => {
      const user = localStorage.getItem('user');
      try { await CristalDownloads.open(code === 'INVALID_DOCUMENT' ? 'https://invalid.example/api/guides/work/1/pdf' : path); throw Error('Failure unexpectedly opened'); }
      catch (error) { window.qaDownloadError = error; window.qaDownloadEntry = CristalDownloads.presentation.error(error); return { code: error.code, message: error.message, owned: !!qaDownloadEntry }; }
      finally { localStorage.setItem('user', user); }
    }, { code, path });
    assert.deepEqual(raw, { code, message: words[code][0], owned: true });
  }
  let count = 0;
  async function matrix(code, widths = [320, 390, 1440]) {
    await page.locator('[data-field-tab-button=docs]').focus(); await page.evaluate(() => { qaDownloadToast = document.getElementById('cw-v21-toast'); qaDownloadNodes = [...document.querySelectorAll('#workGuideBox, #workGuideBox *')]; });
    const before = await state(), db = await database(), start = requests.length;
    for (const width of widths) { await page.setViewportSize({ width, height: 1300 }); for (const [i, language] of languages.entries()) {
      await locale(language); assert.equal(await page.locator('#cw-v21-toast').textContent(), words[code][i]); assert(await page.locator('#cw-v21-toast').isVisible());
      assert.deepEqual(await page.evaluate(() => ['user', 'cristalwater_user'].map(key => JSON.parse(localStorage.getItem(key)).language)), [language, language], 'Only the existing language preference changes in account metadata');
      assert.deepEqual(await state(), before); assert.deepEqual(await database(), db);
      assert(await page.evaluate(() => qaDownloadToast === document.getElementById('cw-v21-toast') && qaDownloadNodes.every(node => node.isConnected)));
      assert(await page.locator('#cw-v21-toast').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'Download error fits ' + width + ' ' + language);
      assert.deepEqual(await page.evaluate(language => ({ code: qaDownloadError.code, raw: qaDownloadError.message, text: CristalDownloads.presentation.format(qaDownloadEntry, language) }), language), { code, raw: words[code][0], text: words[code][i] }); count++;
      if (process.env.CW_DOWNLOAD_CAPTURE && code === 'SESSION' && width === 320 && language === 'de') { await fs.mkdir(process.env.CW_DOWNLOAD_CAPTURE, { recursive: true }); await page.locator('#cw-v21-toast').screenshot({ path: process.env.CW_DOWNLOAD_CAPTURE + '/download-session-de-320.png' }); }
    } }
    for (const request of requests.slice(start)) { assert.equal(request.path, '/api/settings/language/me'); assert.equal(request.method, 'PUT'); assert.deepEqual(Object.keys(JSON.parse(request.body)), ['language']); }
    console.log('PASS download error ' + JSON.stringify({ code, widths, languages }));
  }
  await open('REGULAR'); await failure('UNAVAILABLE'); await matrix('UNAVAILABLE');
  for (const code of Object.keys(words).filter(code => code !== 'UNAVAILABLE')) { await failure(code); await matrix(code); }
  // A later notification with exactly the same original text is not owned by downloads.
  const literal = words.RETRY[0]; await page.evaluate(literal => CristalAuth.toast(literal), literal); await settle(); await locale('de'); assert.equal(await page.locator('#cw-v21-toast').textContent(), literal); assert.equal(await page.locator('#cw-v21-toast').getAttribute('data-cw-download-copy'), null);
  await page.evaluate(() => { qaDownloadKind = 'FOREIGN'; }); await link().click(); await page.waitForFunction(() => document.getElementById('cw-v21-toast')?.textContent === 'Original <b>{code}</b>'); await locale('fr'); assert.equal(await page.locator('#cw-v21-toast').textContent(), 'Original <b>{code}</b>'); assert.equal(await page.locator('#cw-v21-toast b').count(), 0);
  await page.evaluate(() => { qaDownloadKind = 'REAL'; }); const downloads = await page.evaluate(() => qaDownloadCalls.fetch); await link().click(); await page.waitForFunction(() => qaDownloadPopup?.location.href?.startsWith('blob:')); assert.equal(await page.evaluate(async () => (await (await qaDownloadOriginal.fetch(qaDownloadPopup.location.href)).text()).slice(0, 5)), '%PDF-'); assert.equal(await page.evaluate(() => qaDownloadCalls.fetch), downloads + 1); await page.evaluate(() => CristalDownloads.cancel());
  assert(requests.some(request => request.path === path && request.method === 'GET' && request.auth === 'Bearer ' + token));
  await open('EXTRA'); await failure('SESSION'); await matrix('SESSION', [320]);
  const drafts = await page.evaluate(() => CWFieldDraftSnapshot()); for (const type of ['REGULAR', 'EXTRA']) assert.equal(drafts['visit-' + type + '-' + id].values.notes, type + ' download draft <b>{code}</b>');
  assert.deepEqual(errors, []); assert(requests.filter(request => !['GET', 'HEAD'].includes(request.method)).every(request => request.path === '/api/settings/language/me' && request.method === 'PUT'));
  console.log('PASS download-errors ' + JSON.stringify({ checks: count, rawErrorsPreserved: true, typedDrafts: true, realPdf: true, operationalWrites: 0 })); completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
