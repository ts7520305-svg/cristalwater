'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const jwt = require('jsonwebtoken');
const { chromium } = require('playwright');
const { prisma } = require('../src/prismaClient');
const { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const languages = ['pt', 'en', 'fr', 'es', 'de'];
const words = {
  title: ['Documentos', 'Documents', 'Documents', 'Documentos', 'Dokumente'],
  hint: ['AT, obra e seguro', 'AT, work and insurance', 'AT, travaux et assurance', 'AT, trabajo y seguro', 'AT, Arbeit und Versicherung'],
  legal: ['Documentos legais', 'Legal documents', 'Documents légaux', 'Documentos legales', 'Rechtliche Dokumente'],
  help: ['Guias, seguro e stock da viatura quando for preciso apresentar.', 'Guides, insurance and vehicle stock when you need to show them.', 'Documents, assurance et stock du véhicule à présenter au besoin.', 'Guías, seguro y existencias del vehículo para mostrarlos cuando sea necesario.', 'Dokumente, Versicherung und Fahrzeugbestand bei Bedarf vorlegen.'],
  vehicle: ['ID da viatura', 'Vehicle ID', 'ID du véhicule', 'ID del vehículo', 'Fahrzeug-ID'],
  technician: ['ID do técnico', 'Technician ID', 'ID du technicien', 'ID del técnico', 'Techniker-ID'],
  show: ['Mostrar documentos', 'Show documents', 'Afficher les documents', 'Mostrar documentos', 'Dokumente anzeigen'],
  guides: ['Consultar guias', 'View guides', 'Consulter les documents', 'Consultar guías', 'Dokumente einsehen'],
  maintenance: ['Manutenção da viatura', 'Vehicle maintenance', 'Entretien du véhicule', 'Mantenimiento del vehículo', 'Fahrzeugwartung'],
};
let browser, completed = false;
const deadline = setTimeout(() => { console.error('Document toolbar scenario incomplete'); process.exit(1); }, 110000);
process.on('exit', code => { if (!code && !completed) process.exitCode = 1; });
(async () => {
  const vehicle = await prisma.vehicle.create({ data: { plate: 'TOOLBAR-' + Date.now(), name: 'Original <b>{id}</b>', status: 'ACTIVE', active: true } });
  const technician = await prisma.technician.create({ data: { name: 'Toolbar <b>{id}</b>', vehicleId: vehicle.id, active: true } });
  const other = await prisma.technician.create({ data: { name: 'Other toolbar', vehicleId: vehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Toolbar client', active: true } });
  const pools = await Promise.all(['REGULAR', 'EXTRA'].map(type => prisma.pool.create({ data: { clientId: client.id, name: type + ' <b>{id}</b>', active: true } })));
  const maxima = await Promise.all([prisma.serviceVisit.aggregate({ _max: { id: true } }), prisma.extraVisit.aggregate({ _max: { id: true } })]);
  const id = Math.max(...maxima.map(row => row._max.id || 0)) + 1;
  const common = { id, clientId: client.id, technicianId: technician.id, status: 'IN_PROGRESS', startAt: new Date() };
  await prisma.serviceVisit.create({ data: { ...common, poolId: pools[0].id, date: new Date(), plannedDate: new Date() } });
  await prisma.extraVisit.create({ data: { ...common, poolId: pools[1].id, scheduledAt: new Date() } });
  for (const table of ['ServiceVisit', 'ExtraVisit']) await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"','id'),${id},true)`);
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'AT-TOOLBAR-' + vehicle.id, status: 'ACTIVE', validUntil: new Date(Date.now() + 86400000 * 30), isDraft: false } });
  await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: technician.id, guideId: guide.id, status: 'OPEN', isDraft: false } });
  for (const type of ['INSURANCE', 'INSPECTION']) await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type, title: type, status: 'ACTIVE', dueDate: new Date(Date.now() + 86400000 * 30) } });
  const sign = person => jwt.sign({ id: person.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const token = sign(technician);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1300 }, timezoneId: 'Europe/Lisbon' });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await context.addInitScript(({ token, technician }) => {
    if (!localStorage.getItem('qaToolbar')) {
      for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
      for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: technician.id, role: 'TECHNICIAN', name: technician.name }));
      localStorage.setItem('qaToolbar', '1');
    }
    const interval = window.setInterval;
    window.setInterval = (callback, ms, ...args) => [15000, 30000, 60000].includes(ms) ? 0 : interval(callback, ms, ...args);
    Object.defineProperty(navigator, 'geolocation', { value: { watchPosition: () => 1, clearWatch() {} } });
  }, { token, technician });
  const page = await context.newPage(), requests = [], errors = [];
  page.setDefaultTimeout(9000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push({ path: new URL(request.url()).pathname, method: request.method(), body: request.postData() }); });
  const ready = () => page.waitForFunction(() => CWFieldVisitContext() && ['transportGuideBox', 'workGuideBox', 'insuranceBox'].every(id => ['live', 'cache', 'unavailable'].includes(document.getElementById(id).dataset.source)));
  async function open(type) {
    await page.goto(base + '/technician-field-mode?selectedVisitId=' + id + '&selectedVisitType=' + type, { waitUntil: 'domcontentloaded' });
    await ready();
    await page.locator('[data-field-tab-button=agora]').click();
    await page.locator('#notes').fill(type + ' preserved <b>{id}</b>');
    await page.waitForFunction(() => document.getElementById('fieldSaveStatus').dataset.state === 'saved');
    await page.locator('[data-field-tab-button=docs]').click();
    await page.evaluate(() => {
      window.qaToolbarLoads = 0;
      const load = CWFieldDocuments.load;
      CWFieldDocuments.load = (...args) => Promise.resolve(load(...args)).finally(() => { qaToolbarLoads++; });
      window.qaToolbarNodes = [...document.querySelectorAll('.field-panel-docs > .doc-tools *, .field-panel-docs > .actions *, .field-panel-docs > .field-tab-title *')];
      window.qaToolbarHandler = document.getElementById('loadGuidesBtn').onclick;
    });
  }
  const database = () => Promise.all([prisma.serviceVisit.findUnique({ where: { id } }), prisma.extraVisit.findUnique({ where: { id } }), prisma.transportGuide.findUnique({ where: { id: guide.id } }), prisma.workGuide.findMany({ where: { vehicleId: vehicle.id } }), prisma.vehicleMaintenanceRecord.findMany({ where: { vehicleId: vehicle.id }, orderBy: { id: 'asc' } })]);
  const state = () => page.evaluate(async () => ({
    storage: Object.keys(localStorage).filter(key => /^cwField|^cw:tech/.test(key) || ['token', 'cristalwater_jwt'].includes(key)).sort().map(key => [key, localStorage.getItem(key)]),
    outbox: await CWFieldWriteStore.records(null, CWFieldWriteStore.session(), true),
    context: CWFieldVisitContext(),
    values: ['vehicleId', 'technicianId', 'notes'].map(id => { const node = document.getElementById(id); return [id, node.value, node.readOnly, node.disabled]; }),
    sources: ['transportGuideBox', 'workGuideBox', 'insuranceBox'].map(id => { const node = document.getElementById(id); return [node.dataset.source, node.dataset.confirmedAt]; }),
    links: [...document.querySelectorAll('.field-panel-docs > .actions a')].map(node => [node.getAttribute('href'), node.target, node.rel]),
    buttons: ['startBtn', 'finishBtn'].map(id => document.getElementById(id).disabled),
    loads: qaToolbarLoads,
  }));
  let checks = 0;
  async function matrix(label, widths = [320]) {
    await page.locator('#vehicleId').focus();
    await page.locator('#vehicleId').evaluate(node => node.setSelectionRange(0, node.value.length));
    const before = await state(), db = await database(), requestCount = requests.length;
    const selection = await page.locator('#vehicleId').evaluate(node => [node.selectionStart, node.selectionEnd]);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1300 });
      for (const [index, language] of languages.entries()) {
        await page.locator('#cwLanguageSelect').selectOption(language);
        await page.waitForFunction(language => document.documentElement.lang === language, language);
        const card = page.locator('.field-panel-docs').filter({ has: page.locator('#transportGuideBox') });
        assert.equal(await card.locator(':scope > .chip').textContent(), words.legal[index], 'Toolbar label follows chosen language ' + language);
        assert.equal(await card.locator(':scope > .muted').textContent(), words.help[index]);
        assert.equal(await card.locator('.field-tab-title h2').textContent(), words.title[index]);
        assert.equal(await card.locator('.field-tab-title span').textContent(), words.hint[index]);
        assert.equal(await page.locator('#loadGuidesBtn').textContent(), words.show[index]);
        assert.equal(await card.locator(':scope > .actions a[href="/technician-guide"]').textContent(), words.guides[index]);
        assert.equal(await card.locator(':scope > .actions a[href="/vehicle-maintenance"]').textContent(), words.maintenance[index]);
        for (const [id, word] of [['vehicleId', 'vehicle'], ['technicianId', 'technician']]) {
          assert.equal(await page.locator('#' + id).getAttribute('placeholder'), words[word][index]);
          assert.equal(await page.locator('#' + id).getAttribute('aria-label'), words[word][index]);
        }
        assert.deepEqual(await state(), before);
        assert.deepEqual(await database(), db);
        assert.deepEqual(await page.locator('#vehicleId').evaluate(node => [node.selectionStart, node.selectionEnd]), selection);
        assert(await page.evaluate(() => qaToolbarNodes.every(node => node.isConnected) && qaToolbarHandler === document.getElementById('loadGuidesBtn').onclick));
        assert(await card.evaluate(card => [...card.querySelectorAll(':scope > .doc-tools, :scope > .actions, :scope > .field-tab-title, :scope > .chip, :scope > .muted')].every(node => node.scrollWidth <= node.clientWidth + 1)), 'Toolbar fits ' + width + ' ' + language);
        checks++;
        if (process.env.CW_TOOLBAR_CAPTURE && label === 'live' && width === 320 && language === 'de') {
          await fs.mkdir(process.env.CW_TOOLBAR_CAPTURE, { recursive: true });
          await page.locator('#toast.show').waitFor({ state: 'hidden' });
          for (const [index, selector] of ['.field-tab-title', ':scope > .doc-tools', ':scope > .actions'].entries()) await card.locator(selector).screenshot({ path: process.env.CW_TOOLBAR_CAPTURE + '/toolbar-' + index + '.png' });
        }
      }
    }
    for (const request of requests.slice(requestCount)) {
      assert.equal(request.path, '/api/settings/language/me');
      assert.equal(request.method, 'PUT');
      assert.deepEqual(Object.keys(JSON.parse(request.body)), ['language']);
    }
    console.log('PASS document toolbar ' + JSON.stringify({ label, widths, languages }));
  }
  await open('REGULAR');
  await page.locator('#cwLanguageSelect').selectOption('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.locator('.field-panel-docs').filter({ has: page.locator('#transportGuideBox') }).locator(':scope > .chip').textContent(), words.legal[1], 'Owned toolbar follows the actual language selector');
  await matrix('live', [320, 390, 1440]);
  const loads = await page.evaluate(() => qaToolbarLoads);
  await page.locator('#loadGuidesBtn').click();
  await page.waitForFunction(loads => qaToolbarLoads > loads, loads);
  await ready();
  await matrix('refreshed');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  await page.locator('[data-field-tab-button=docs]').click();
  await page.evaluate(() => { window.qaToolbarLoads = 0; window.qaToolbarNodes = [...document.querySelectorAll('.field-panel-docs > .doc-tools *, .field-panel-docs > .actions *, .field-panel-docs > .field-tab-title *')]; window.qaToolbarHandler = document.getElementById('loadGuidesBtn').onclick; });
  assert.equal(await page.locator('#transportGuideBox').getAttribute('data-source'), 'cache');
  await matrix('offline');
  await context.setOffline(false);
  await open('EXTRA');
  await matrix('typed-extra');
  const drafts = await page.evaluate(() => CWFieldDraftSnapshot());
  assert.equal(drafts['visit-REGULAR-' + id].values.notes, 'REGULAR preserved <b>{id}</b>');
  assert.equal(drafts['visit-EXTRA-' + id].values.notes, 'EXTRA preserved <b>{id}</b>');
  const before = await state(), requestCount = requests.length;
  await page.evaluate(({ token, other }) => {
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id: other.id, role: 'TECHNICIAN', name: other.name }));
  }, { token: sign(other), other });
  await page.locator('#loadGuidesBtn').evaluate(node => node.onclick());
  assert.equal(requests.length, requestCount, 'Changed account cannot refresh original documents');
  const preserved = before.storage.filter(([key]) => !['token', 'cristalwater_jwt'].includes(key));
  assert.deepEqual(await page.evaluate(rows => rows.map(([key]) => [key, localStorage.getItem(key)]), preserved), preserved);
  assert.deepEqual(errors, []);
  assert(requests.filter(request => !['GET', 'HEAD'].includes(request.method)).every(request => request.method === 'PUT' && request.path === '/api/settings/language/me'));
  console.log('PASS toolbar ' + JSON.stringify({ checks, typedDrafts: true, originalHandler: true, operationalWrites: 0 }));
  completed = true;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { clearTimeout(deadline); await browser?.close(); await prisma.$disconnect(); });
