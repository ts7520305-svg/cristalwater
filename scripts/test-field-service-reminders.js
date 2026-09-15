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
  const client = await prisma.client.create({ data: { name: 'Recorrência QA', active: true } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina dos lembretes' } });
  const technician = await prisma.technician.create({ data: { name: 'Técnico dos lembretes', active: true } });
  const create = values => prisma.generalReminder.create({ data: {
    title: 'Limpar filtro QA', description: 'Fechar a válvula marcada.', category: 'TECHNICAL_PERIODIC_SERVICE', priority: 'HIGH',
    status: 'PENDING', dueAt: new Date('2028-01-31T10:30:00.000Z'), repeatRule: 'EVERY_1_MONTHS',
    poolId: pool.id, clientId: client.id, technicianId: technician.id, ...values,
  } });
  const endpoint = id => `/api/core/pools/${pool.id}/service-reminders/${id}/complete`;
  async function post(path, expected = 200, authToken = token) {
    const r = await fetch(base + path, { method: 'POST', headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
    const body = await r.json(); assert.equal(r.status, expected, JSON.stringify(body)); return body;
  }
  const first = await create({ title: 'Sequential replay QA' });
  const completed = await post(endpoint(first.id));
  const replay = await post(endpoint(first.id));
  assert.equal(await prisma.generalReminder.count({ where: { title: first.title, poolId: pool.id } }), 2, 'Repeated completion must create exactly one successor');
  assert.equal(replay.reminder.completedAt, completed.reminder.completedAt, 'Original completion time must survive retry');
  assert.equal(completed.nextReminder.dueAt, '2028-02-29T10:30:00.000Z');
  for (const key of ['title', 'description', 'category', 'priority', 'poolId', 'clientId', 'technicianId', 'repeatRule']) assert.equal(completed.nextReminder[key], first[key]);
  assert.equal(replay.nextReminder, null); assert.equal(replay.idempotent, true);
  console.log('PASS repeated completion, stable timestamp, exactly one successor, leap-month date and copied instructions');
  const concurrent = await create({ title: 'Concurrent completion QA' });
  const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => post(i % 2 ? endpoint(concurrent.id) : `/api/crm/reminders/${concurrent.id}/complete`)));
  assert.equal(responses.filter(r => r.nextReminder).length, 1);
  assert.equal(new Set(responses.map(r => r.reminder.completedAt)).size, 1);
  assert.equal(await prisma.generalReminder.count({ where: { poolId: pool.id, title: concurrent.title } }), 2);
  const agenda = await create({ title: 'Agenda first QA', category: 'POOL_SERVICE_REMINDER', repeatRule: 'WEEKLY' });
  assert((await post(`/api/agenda/reminders/${agenda.id}/complete`)).nextReminder);
  assert.equal((await post(endpoint(agenda.id))).idempotent, true);
  console.log('PASS eight concurrent core/CRM completions and agenda alias share one transaction and successor');

  for (const status of ['CANCELLED', 'CANCELED']) {
    const row = await create({ title: 'Cancelled QA', status });
    await post(endpoint(row.id), 409); await post(`/api/crm/reminders/${row.id}/complete`, 409);
    assert.equal((await prisma.generalReminder.findUniqueOrThrow({ where: { id: row.id } })).status, status);
  }
  for (const status of ['DONE', 'COMPLETED', 'CLOSED', 'RESOLVED']) {
    const row = await create({ title: 'Closed historical QA', status });
    assert.equal((await post(endpoint(row.id))).idempotent, true);
  }
  const stale = await create({ title: 'Old status QA', completedAt: new Date('2028-01-01Z') });
  assert.equal((await post(endpoint(stale.id))).idempotent, true);
  const invalid = await create({ title: 'Invalid recurrence QA', repeatRule: 'EVERY_0_DAYS' });
  await post(endpoint(invalid.id), 409);
  assert.equal((await prisma.generalReminder.findUniqueOrThrow({ where: { id: invalid.id } })).completedAt, null);
  const once = await create({ title: 'Once QA', repeatRule: 'NONE' });
  assert.equal((await post(endpoint(once.id))).nextReminder, null);
  const general = await create({ title: 'General QA', category: 'GENERAL' });
  await post(endpoint(general.id), 404);
  assert.equal((await post(`/api/crm/reminders/${general.id}/complete`)).nextReminder, null, 'General CRM reminders keep their existing one-off behavior');
  await post(`/api/core/pools/${pool.id + 100000}/service-reminders/${first.id}/complete`, 404);
  for (const suffix of ['.5', 'e0', 'x']) await post(endpoint(String(first.id) + suffix), 400);
  await post(endpoint(2147483647), 404);
  await post(endpoint(first.id), 401, '');
  const techToken = jwt.sign({ id: technician.id, technicianId: technician.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  await post(endpoint(first.id), 403, techToken);
  await post(`/api/crm/reminders/${first.id}/complete`, 403, techToken);
  console.log('PASS cancelled/closed history, malformed rules and IDs, one-off behavior, exact pool/category scope and authorization');

  const fault = await create({ title: 'Rollback QA' });
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_reminder_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title = 'Rollback QA' THEN RAISE EXCEPTION 'QA simulated next occurrence failure'; END IF; RETURN NEW; END $$`);
  try {
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_reminder_insert_failure BEFORE INSERT ON "GeneralReminder" FOR EACH ROW EXECUTE FUNCTION qa_reminder_insert_failure()');
    await post(endpoint(fault.id), 500);
    const rolledBack = await prisma.generalReminder.findUniqueOrThrow({ where: { id: fault.id } });
    assert.equal(rolledBack.status, 'PENDING'); assert.equal(rolledBack.completedAt, null);
    assert.equal(await prisma.generalReminder.count({ where: { title: fault.title, poolId: pool.id } }), 1);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_reminder_insert_failure ON "GeneralReminder"');
    await prisma.$executeRawUnsafe('DROP FUNCTION qa_reminder_insert_failure()');
  }
  assert((await post(endpoint(fault.id))).nextReminder);
  console.log('PASS database failure during successor insert rolls back completion and permits a safe retry');

  const { chromium } = require('playwright');
  const visual = await create({ title: 'Browser lost response QA' });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, admin }) => {
    localStorage.setItem('token', token); localStorage.setItem('cristalwater_jwt', token);
    const user = JSON.stringify({ id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN' });
    localStorage.setItem('user', user); localStorage.setItem('cristalwater_user', user);
  }, { token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + `/admin-pool-technical.html?poolId=${pool.id}`, { waitUntil: 'networkidle' });
  const button = page.locator(`[data-complete-reminder="${visual.id}"]`);
  let calls = 0, release;
  const blocked = new Promise(resolve => { release = resolve; });
  const url = base + endpoint(visual.id);
  await page.route(url, async route => { calls++; await blocked; await route.fetch(); await route.abort('failed'); });
  await button.click();
  assert(await button.isDisabled());
  await page.evaluate(id => completeServiceReminder(id), visual.id);
  release();
  await page.waitForFunction(() => document.querySelector('#reminderStatus').textContent.includes('Nao foi possivel confirmar'));
  assert.equal(calls, 1, 'Double submission must be suppressed in the browser');
  assert.equal(await prisma.generalReminder.count({ where: { title: visual.title, poolId: pool.id } }), 2, 'Server committed before the response was lost');
  await page.unroute(url);
  await button.click();
  await page.locator(`[data-complete-reminder="${visual.id}"]`).waitFor({ state: 'detached' });
  assert.equal(await prisma.generalReminder.count({ where: { title: visual.title, poolId: pool.id } }), 2, 'Retry after a lost acknowledgment must not duplicate');
  assert((await page.locator('#reminderStatus').textContent()).includes('Lembrete concluido.'));
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator(`[data-complete-reminder="${visual.id}"]`).count(), 0);
  const next = await prisma.generalReminder.findFirstOrThrow({ where: { title: visual.title, poolId: pool.id, status: 'PENDING' } });
  assert.equal(await page.locator(`[data-complete-reminder="${next.id}"]`).count(), 1);
  const invalidAck = await create({ title: 'Browser acknowledgment QA' });
  await page.reload({ waitUntil: 'networkidle' });
  const ackUrl = base + endpoint(invalidAck.id);
  await page.route(ackUrl, route => route.fulfill({ json: { ok: true, reminder: { id: first.id, status: 'DONE' } } }));
  await page.locator(`[data-complete-reminder="${invalidAck.id}"]`).click();
  await page.waitForFunction(() => document.querySelector('#reminderStatus').textContent.includes('Resposta de conclusao invalida'));
  assert.equal((await prisma.generalReminder.findUniqueOrThrow({ where: { id: invalidAck.id } })).completedAt, null);
  await page.unroute(ackUrl);
  const listUrl = `${base}/api/core/pools/${pool.id}/service-reminders`;
  await page.route(listUrl, route => route.fulfill({ status: 503, json: { ok: false, error: 'QA unavailable list' } }));
  await page.locator(`[data-complete-reminder="${invalidAck.id}"]`).click();
  await page.waitForFunction(() => document.querySelector('#reminderStatus').textContent.includes('Lembrete concluido. Atualiza a pagina'));
  assert.equal(await prisma.generalReminder.count({ where: { title: invalidAck.title, poolId: pool.id } }), 2);
  await page.unroute(listUrl);
  const switched = await create({ title: 'Browser session switch QA' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.route(base + endpoint(switched.id), async route => {
    const response = await route.fetch();
    await page.evaluate(() => { localStorage.setItem('token', 'changed-session'); document.querySelector('#reminderStatus').textContent = 'Nova sessao'; });
    await route.fulfill({ response });
  });
  await page.locator(`[data-complete-reminder="${switched.id}"]`).click();
  await page.waitForFunction(id => !completingReminders.has(String(id)) && localStorage.getItem('token') === 'changed-session', switched.id);
  assert.equal(await page.locator('#reminderStatus').textContent(), 'Nova sessao');
  assert.equal(await prisma.generalReminder.count({ where: { title: switched.title, poolId: pool.id } }), 2);
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS real mobile page, double click, lost response after commit, explicit retry, refresh, invalid acknowledgment, unavailable list and session switch');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
