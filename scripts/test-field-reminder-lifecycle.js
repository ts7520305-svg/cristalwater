'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  async function api(path, options = {}, expected = 200) {
    const response = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } });
    const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
  }
  const client = await prisma.client.create({ data: { name: 'Lista lembretes QA' } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina com histórico' } });
  const dueAt = new Date('2028-01-01T10:00:00Z');
  const seed = (status, count) => prisma.generalReminder.createMany({ data: Array.from({ length: count }, (_, i) => ({ title: `${status} ${i}`, poolId: pool.id, clientId: client.id, category: 'TECHNICAL_PERIODIC_SERVICE', dueAt, status, ...(status === 'DONE' ? { completedAt: dueAt } : {}) })) });
  await seed('DONE', 105); await seed('PENDING', 505);
  const other = await prisma.generalReminder.create({ data: { title: 'Other pool QA', poolId: pool.id + 100000, category: 'TECHNICAL_PERIODIC_SERVICE', dueAt } });
  const list = (await api(`/api/core/pools/${pool.id}/service-reminders`)).reminders;
  assert.equal(list.filter(r => r.status === 'PENDING').length, 505, 'Pending reminders must not disappear behind history or a result cap');
  assert.equal(list.length, 610); assert(!list.some(r => r.id === other.id));
  assert.equal(list[0].status, 'PENDING'); assert.equal(list.at(-1).status, 'DONE');
  const crm = (await api('/api/crm/reminders?category=TECHNICAL_PERIODIC_SERVICE')).reminders;
  assert.equal(crm.filter(r => r.poolId === pool.id).length, 610);
  assert.equal((await api('/api/agenda/reminders?status=PENDING&category=TECHNICAL_PERIODIC_SERVICE')).reminders.filter(r => r.poolId === pool.id).length, 505);
  const closed = (await api('/api/crm/reminders?status=DONE')).reminders;
  assert.equal(closed.filter(r => r.poolId === pool.id).length, 105); assert(closed.every(r => r.status === 'DONE'));
  assert.equal(await prisma.generalReminder.count({ where: { poolId: pool.id } }), 610);
  console.log('PASS 505 pending + 105 historical reminders, pending-first order, exact pool, CRM/agenda filters and read-only history');
  const { randomUUID } = require('node:crypto');
  const request = { title: 'Criação repetida QA', dueAt: dueAt.toISOString(), repeatRule: 'MONTHLY', requestId: randomUUID() };
  const endpoint = `/api/core/pools/${pool.id}/service-reminders`;
  const send = (body, path = endpoint, expected = 201) => api(path, { method: 'POST', body: JSON.stringify(body) }, expected);
  const first = await send(request), replay = await send(request);
  assert.equal(replay.reminder.id, first.reminder.id, 'Retry must return the original reminder instead of creating another');
  assert.equal(await prisma.generalReminder.count({ where: { poolId: pool.id, title: request.title } }), 1);
  assert.equal(replay.idempotent, true); assert.equal(replay.requestId, request.requestId);
  console.log('PASS creation retry returns one original reminder');
  const concurrent = { ...request, title: 'Concurrent creation QA', requestId: randomUUID() };
  const simultaneous = await Promise.all(Array.from({ length: 8 }, () => send(concurrent)));
  assert.equal(new Set(simultaneous.map(r => r.reminder.id)).size, 1);
  assert.equal(simultaneous.filter(r => !r.idempotent).length, 1);
  assert.equal(await prisma.generalReminder.count({ where: { poolId: pool.id, title: concurrent.title } }), 1);
  await send({ ...request, title: 'Changed' }, endpoint, 409);
  await send({ ...request, dueAt: '2029-01-01T10:00:00Z' }, endpoint, 409);
  const equivalent = await send({ ...request, repeatRule: 'EVERY_1_MONTHS' });
  assert.equal(equivalent.reminder.id, first.reminder.id);
  const general = { title: 'CRM creation QA', dueAt: request.dueAt, category: 'GENERAL', requestId: randomUUID() };
  const aliases = await Promise.all([send(general, '/api/crm/reminders'), send(general, '/api/agenda/reminders')]);
  assert.equal(aliases[0].reminder.id, aliases[1].reminder.id);
  await send(request, '/api/crm/reminders', 409);
  const otherAdmin = await prisma.user.create({ data: { name: 'Other admin QA', email: `other-reminders-${Date.now()}@qa.test`, password: 'unused', role: 'ADMIN', active: true } });
  const otherToken = jwt.sign({ id: otherAdmin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  await api(endpoint, { method: 'POST', body: JSON.stringify(request), headers: { Authorization: `Bearer ${otherToken}` } }, 409);
  console.log('PASS eight concurrent creates, changed-data/actor/entry-point rejection, normalized recurrence and shared CRM/agenda receipt');
  await api(`${endpoint}/${first.reminder.id}/complete`, { method: 'POST' });
  assert.equal((await send(request)).reminder.id, first.reminder.id);
  await prisma.generalReminder.delete({ where: { id: first.reminder.id } });
  await send(request);
  assert.equal(await prisma.generalReminder.count({ where: { id: first.reminder.id } }), 0, 'Replaying a deleted reminder must not recreate it');
  const fault = { ...request, title: 'Receipt rollback QA', requestId: randomUUID() };
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_reminder_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."sourceKey" LIKE 'reminder-create:%' THEN RAISE EXCEPTION 'QA receipt failure'; END IF; RETURN NEW; END $$`);
  try {
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_reminder_receipt_failure BEFORE INSERT ON "OperationalReminder" FOR EACH ROW EXECUTE FUNCTION qa_reminder_receipt_failure()');
    await send(fault, endpoint, 500);
    assert.equal(await prisma.generalReminder.count({ where: { poolId: pool.id, title: fault.title } }), 0);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_reminder_receipt_failure ON "OperationalReminder"');
    await prisma.$executeRawUnsafe('DROP FUNCTION qa_reminder_receipt_failure()');
  }
  await send(fault); await send(fault);
  assert.equal(await prisma.generalReminder.count({ where: { poolId: pool.id, title: fault.title } }), 1);
  for (const change of [{ title: {} }, { dueAt: true }, { requestId: '' }, { technicianId: 1.5 }, { repeatRule: 'EVERY_0_DAYS' }]) await send({ ...request, ...change }, endpoint, 400);
  await send({ ...request, requestId: randomUUID() }, '/api/core/pools/2147483647/service-reminders', 404);
  const legacy = await send({ title: 'Legacy client QA', dueAt: request.dueAt, repeatRule: 'NONE' });
  assert(legacy.reminder.id); assert.equal(legacy.requestId, undefined);
  console.log('PASS original receipt survives completion/deletion, failed receipt rolls back creation, safe retry, validation and legacy compatibility');
  const { chromium } = require('playwright');
  const fs = require('node:fs'), path = require('node:path');
  const output = path.resolve(__dirname, '../reports/field-visual/reminder-creation-' + Date.now()); fs.mkdirSync(output, { recursive: true });
  const uiClient = await prisma.client.create({ data: { name: 'Quinta da Luz' } });
  const uiPool = await prisma.pool.create({ data: { clientId: uiClient.id, name: 'Piscina do jardim' } });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, locale: 'pt-PT' });
  await context.addInitScript(({ token, id }) => {
    localStorage.setItem('token', token); localStorage.setItem('cristalwater_jwt', token);
    const user = JSON.stringify({ id, name: 'Gestão Cristal Water', role: 'ADMIN' });
    localStorage.setItem('user', user); localStorage.setItem('cristalwater_user', user);
  }, { token, id: admin.id });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  const cases = [
    { scope: `pool:${uiPool.id}`, url: `/admin-pool-technical.html?poolId=${uiPool.id}`, path: `/api/core/pools/${uiPool.id}/service-reminders`, button: '#createServiceReminderBtn', status: '#reminderStatus', fields: { reminderTitle: 'Verificar cobertura', reminderDueAt: '2028-06-10T10:00', reminderDescription: 'Confirmar o fecho e fotografar as lâminas.' } },
    { scope: 'crm-pool', url: '/admin-crm.html', path: `/api/core/pools/${uiPool.id}/service-reminders`, button: '#createPoolReminderBtn', status: '#poolReminderStatus', fields: { poolReminderPool: String(uiPool.id), poolReminderTitle: 'Ligar aquecimento', poolReminderEventAt: '2028-06-12T12:00', poolReminderDaysBefore: '2', poolReminderDescription: 'Preparar a piscina para a chegada dos hóspedes.' } },
    { scope: 'crm-general', url: '/admin-crm.html', path: '/api/crm/reminders', button: '#createGeneralReminderBtn', status: '#generalReminderStatus', fields: { generalReminderTitle: 'Confirmar visita ao cliente', generalReminderDueAt: '2028-06-15T09:00', generalReminderDescription: 'Ligar antes da deslocação.' } },
  ];
  async function fill(test) {
    await page.goto(base + test.url, { waitUntil: 'networkidle' });
    for (const [id, value] of Object.entries(test.fields)) {
      const field = page.locator('#' + id);
      if (await field.evaluate(n => n.tagName === 'SELECT')) await field.selectOption(value); else await field.fill(value);
    }
  }
  for (const test of cases) {
    await fill(test);
    const requests = [], routeUrl = base + test.path;
    let firstRequest = true;
    await page.route(routeUrl, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      requests.push(route.request().postDataJSON());
      if (firstRequest) { firstRequest = false; const response = await route.fetch(); assert.equal(response.status(), 201); return route.abort('failed'); }
      return route.continue();
    });
    await page.locator(test.button).click();
    await page.locator(test.status).filter({ hasText: 'Ainda não foi possível' }).waitFor();
    assert.equal(requests.length, 1);
    const title = requests[0].title;
    assert.equal(await prisma.generalReminder.count({ where: { title } }), 1);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator(test.status).filter({ hasText: 'Pedido pendente recuperado' }).waitFor();
    assert.equal(requests.length, 1, 'Reload must not send automatically');
    for (const [id, value] of Object.entries(test.fields)) { assert.equal(await page.locator('#' + id).inputValue(), value); assert(await page.locator('#' + id).isDisabled()); }
    assert(await page.locator(test.button).isDisabled());
    const pendingPanel = page.locator('[data-reminder-pending]').filter({ hasText: title });
    if (test.scope === 'crm-pool') {
      for (const [language, label] of [['en', 'Retry confirmation'], ['fr', 'Réessayer la confirmation'], ['es', 'Reintentar confirmación'], ['de', 'Bestätigung erneut versuchen']]) {
        await page.evaluate(language => CristalI18n.applyLanguage(language), language);
        await pendingPanel.getByRole('button', { name: label, exact: true }).waitFor();
        assert((await pendingPanel.locator('[data-cw-no-i18n]').textContent()).includes(title));
      }
      await page.evaluate(() => CristalI18n.applyLanguage('pt'));
      await pendingPanel.getByRole('button', { name: 'Repetir confirmação', exact: true }).waitFor();
    }
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await pendingPanel.evaluate(panel => panel.scrollWidth <= panel.clientWidth + 1));
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    if (test.scope === 'crm-pool') await page.locator('#poolReminderForm').screenshot({ path: path.join(output, 'lembrete-recuperado.png') });
    await pendingPanel.getByRole('button', { name: 'Repetir confirmação' }).click();
    await page.locator(test.status).filter({ hasText: 'Foi recuperado o lembrete original' }).waitFor();
    assert.deepEqual(requests[1], requests[0]);
    assert.equal(await prisma.generalReminder.count({ where: { title } }), 1);
    await page.waitForFunction(selector => !document.querySelector(selector).disabled, test.button);
    await page.unroute(routeUrl);
  }
  console.log('PASS all three real forms: lost creation response, durable reload, unchanged fields, exact explicit retry, one reminder and 320/390/1280 layouts');
  const technical = cases[0], createUrl = base + technical.path;
  await fill(technical);
  await page.locator('#reminderTitle').fill('Duas janelas QA');
  const secondPage = await context.newPage(); secondPage.setDefaultTimeout(12000);
  await secondPage.goto(base + technical.url, { waitUntil: 'networkidle' });
  await secondPage.locator('#reminderTitle').fill('Outra intenção QA'); await secondPage.locator('#reminderDueAt').fill('2028-06-15T10:00');
  let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(createUrl, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    calls++; await gate;
    const response = await route.fetch(), body = await response.json();
    await route.fulfill({ json: { ...body, requestId: randomUUID() } });
  });
  await page.locator(technical.button).click();
  await secondPage.locator(technical.button).click();
  await secondPage.locator(technical.status).filter({ hasText: 'noutra janela' }).waitFor();
  assert.equal(calls, 1);
  release();
  await page.locator(technical.status).filter({ hasText: 'Ainda não foi possível' }).waitFor();
  assert.equal(await prisma.generalReminder.count({ where: { title: 'Duas janelas QA' } }), 1);
  await secondPage.locator(technical.button).click();
  await secondPage.locator(technical.status).filter({ hasText: 'Pedido pendente recuperado' }).waitFor();
  assert.equal(await secondPage.locator('#reminderTitle').inputValue(), 'Duas janelas QA');
  await secondPage.getByRole('button', { name: 'Repetir confirmação' }).click();
  await secondPage.locator(technical.status).filter({ hasText: 'Foi recuperado o lembrete original' }).waitFor();
  assert.equal(await prisma.generalReminder.count({ where: { title: 'Outra intenção QA' } }), 0);
  assert.equal(await prisma.generalReminder.count({ where: { title: 'Duas janelas QA' } }), 1);
  await page.unroute(createUrl); await secondPage.close();
  console.log('PASS two tabs cannot submit concurrently or overwrite the pending request; mismatched acknowledgment stays pending');

  await fill(technical);
  await page.locator('#reminderTitle').fill('Quota QA');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith('cwReminderCreate:')) throw new DOMException('quota', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  let forbiddenRequests = 0;
  await page.route(createUrl, route => { if (route.request().method() === 'POST') forbiddenRequests++; return route.continue(); });
  await page.locator(technical.button).click();
  await page.locator(technical.status).filter({ hasText: 'Nenhum pedido foi enviado' }).waitFor();
  assert.equal(forbiddenRequests, 0);
  await page.reload({ waitUntil: 'networkidle' });
  const storageKey = `cwReminderCreate:v1:ADMIN:${admin.id}:pool:${uiPool.id}`;
  await page.evaluate(key => localStorage.setItem(key, '{broken'), storageKey);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator(technical.status).filter({ hasText: 'conservado para revisão' }).waitFor();
  assert(await page.locator(technical.button).isDisabled());
  assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), '{broken');
  assert.equal(forbiddenRequests, 0);
  await page.evaluate(key => localStorage.removeItem(key), storageKey); await page.unroute(createUrl);
  console.log('PASS storage failure sends nothing and corrupt pending data is retained without replay');

  await fill(technical); await page.locator('#reminderTitle').fill('Rejected creation QA');
  await page.route(createUrl, route => route.request().method() === 'POST' ? route.fulfill({ status: 400, json: { ok: false, error: 'QA rejected title' } }) : route.continue());
  await page.locator(technical.button).click(); await page.getByRole('button', { name: 'Corrigir dados' }).waitFor();
  const rejected = JSON.parse(await page.evaluate(key => localStorage.getItem(key), storageKey));
  assert.equal(rejected.rejection.status, 400);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Corrigir dados' }).click();
  await page.locator('#reminderTitle').fill('Corrected creation QA');
  await page.unroute(createUrl);
  const newRequests = [];
  await page.route(createUrl, route => {
    if (route.request().method() === 'POST') { newRequests.push(route.request().postDataJSON()); return route.continue(); }
    return route.fulfill({ status: 503, json: { ok: false, error: 'QA list unavailable' } });
  });
  await page.locator(technical.button).click();
  await page.locator(technical.status).filter({ hasText: 'Lembrete criado. Atualiza' }).waitFor();
  assert.notEqual(newRequests[0].requestId, rejected.requestId);
  assert.equal(await prisma.generalReminder.count({ where: { title: 'Corrected creation QA' } }), 1);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null);
  await page.unroute(createUrl);
  console.log('PASS explicit correction after persisted rejection creates a fresh request; list refresh failure preserves confirmed success');

  await fill(technical); await page.locator('#reminderTitle').fill('Session creation QA');
  await page.route(createUrl, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    await page.evaluate(() => { localStorage.setItem('token', 'new-session'); localStorage.setItem('cristalwater_jwt', 'new-session'); });
    await route.fulfill({ response });
  });
  await page.locator(technical.button).click();
  await page.locator(technical.status).filter({ hasText: 'A sessão mudou' }).waitFor();
  assert(await page.evaluate(key => localStorage.getItem(key), storageKey));
  assert.equal(await page.locator('#reminderTitle').inputValue(), '');
  assert.equal(await prisma.generalReminder.count({ where: { title: 'Session creation QA' } }), 1);
  await page.unroute(createUrl);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator(technical.status).filter({ hasText: 'Pedido pendente recuperado' }).waitFor();
  await page.getByRole('button', { name: 'Repetir confirmação' }).click();
  await page.locator(technical.status).filter({ hasText: 'Foi recuperado o lembrete original' }).waitFor();
  assert.equal(await prisma.generalReminder.count({ where: { title: 'Session creation QA' } }), 1);
  console.log('PASS late response after session change cannot confirm or remove the original account pending creation');
  await page.route(base + '/api/crm/leads', route => route.fulfill({ status: 503, json: { ok: false, error: 'QA initial load failure' } }));
  await page.goto(base + '/admin-crm.html', { waitUntil: 'networkidle' });
  assert(await page.locator('#createPoolReminderBtn').isDisabled()); assert(await page.locator('#createGeneralReminderBtn').isDisabled());
  await page.unroute(base + '/api/crm/leads'); await page.locator('#refreshAll').click();
  await page.waitForFunction(() => !document.querySelector('#createPoolReminderBtn').disabled && !document.querySelector('#createGeneralReminderBtn').disabled);
  console.log('PASS failed initial CRM load keeps forms blocked; explicit refresh initializes both creators after recovery');
  assert.deepEqual(errors, []);
  console.log('Reminder visual evidence: ' + output);
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
