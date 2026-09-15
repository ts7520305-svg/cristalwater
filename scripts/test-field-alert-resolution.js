'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const water = require('../src/services/waterReminderService');
const { resolutionVersion } = require('../src/services/alertResolutionStateService');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const user = { id: admin.id, role: 'ADMIN' };
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function resolve(reference, body = {}) {
    const response = await fetch(base + `/api/alerts/${reference}/resolve`, { method: 'PUT', headers, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  const client = await prisma.client.create({ data: { name: 'Resolução de alertas QA' } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina dos alertas críticos QA' } });
  const visit = await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, status: 'IN_PROGRESS' } });
  const opened = await water.create(user, { visitId: visit.id, minutes: 10 });
  const alarm = await water.transition(user, opened.reminder.id, 'alarm');
  const attempted = await resolve(`technical-${alarm.alert.id}`);
  const persisted = await prisma.technicalAlert.findUniqueOrThrow({ where: { id: alarm.alert.id } });
  console.log(JSON.stringify({ genericResolutionStatus: attempted.status, criticalAlertStatus: persisted.status,
    waterStillOpen: !(await prisma.operationalReminder.findUniqueOrThrow({ where: { id: opened.reminder.id } })).isCompleted }));
  assert.equal(attempted.status, 409, 'Generic resolution must require the physical water-close workflow');
  assert.equal(persisted.status, 'OPEN');
  await prisma.technicalAlert.update({ where: { id: alarm.alert.id }, data: { type: 'LEGACY_GENERIC_ALERT' } });
  assert.equal((await resolve(`technical-${alarm.alert.id}`)).status, 409, 'Linked water reminders remain protected even with a generic legacy alert type');
  await prisma.technicalAlert.update({ where: { id: alarm.alert.id }, data: { type: 'AGUA_ABERTA' } });
  for (const notice of [opened.notification, ...alarm.notifications]) {
    assert.equal((await resolve(`notification-${notice.id}`)).status, 409);
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: notice.id } })).status, 'PENDING');
  }
  const pump = await water.create(user, { visitId: visit.id, minutes: 10 }, 'PUMP_MANUAL');
  const pumpAlarm = await water.transition(user, pump.reminder.id, 'alarm');
  assert.equal((await resolve(`technical-${pumpAlarm.alert.id}`)).status, 409);
  for (const kind of [opened, pump]) {
    const path = kind === pump ? 'pump-reminders' : 'water-reminders';
    const response = await fetch(base + `/api/technician/${path}/${kind.reminder.id}/close`, { method: 'POST', headers, body: '{}' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reminder.isCompleted, true);
  }
  assert.equal((await prisma.technicalAlert.findUniqueOrThrow({ where: { id: alarm.alert.id } })).status, 'RESOLVED');
  assert.equal((await prisma.technicalAlert.findUniqueOrThrow({ where: { id: pumpAlarm.alert.id } })).status, 'RESOLVED');
  assert.equal((await resolve(`notification-${opened.notification.id}`)).status, 200, 'A historical creation notice can be dismissed after confirmed physical closure');
  assert.equal((await resolve(`notification-${pump.notification.id}`)).status, 200);
  for (const status of ['NOT_DONE', 'BLOCKED', 'RETAINED', 'IMPEDIDO', 'INCOMPLETE']) {
    const blocked = await prisma.serviceVisit.create({ data: { poolId: pool.id, status, alerts: 'Manutencao impedida QA', internalNotes: 'Manter esta nota QA' } });
    assert.equal((await resolve(`visit-${blocked.id}`)).status, 409);
    assert.equal((await prisma.serviceVisit.findUniqueOrThrow({ where: { id: blocked.id } })).alerts, blocked.alerts);
  }
  console.log('PASS water/pump notices require the physical workflow; valid close still works; blocked visits retain their operational state');
  const create = {
    technical: values => prisma.technicalAlert.create({ data: { poolId: pool.id, type: 'FILTER_LEAK', message: 'Junta da bomba substituida QA', ...values } }),
    notification: values => prisma.notification.create({ data: { clientId: client.id, type: 'ALERT', message: 'Aviso simples QA', ...values } }),
    generic: values => prisma.alert.create({ data: { type: 'ALERT', message: 'Aviso geral QA', ...values } }),
    visit: values => prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, status: 'DONE', alerts: 'Cesto reparado QA', internalNotes: 'Nota interna original QA', ph: 7.4, ...values } }),
  };
  const model = { technical: 'technicalAlert', notification: 'notification', generic: 'alert', visit: 'serviceVisit' };
  const receipts = reference => prisma.operationalReminder.findMany({ where: { sourceKey: { startsWith: `alert-resolution:${reference}:` } } });
  for (const source of Object.keys(create)) {
    const original = await create[source]({}), reference = `${source}-${original.id}`;
    const body = { expectedVersion: resolutionVersion(source, original) };
    const replies = await Promise.all(Array.from({ length: 8 }, (_, i) => resolve(source === 'notification' && i % 2 ? original.id : reference, body)));
    for (const reply of replies) assert.equal(reply.status, 200, JSON.stringify(reply));
    const ack = replies[0].body;
    assert(replies.every(reply => reply.body.resolvedAt === ack.resolvedAt));
    assert(replies.every(reply => reply.body.reference === reference));
    assert.equal((await receipts(reference)).length, 1);
    const audit = (await receipts(reference))[0];
    assert.equal(audit.metadata.actor, `ADMIN:${admin.id}`);
    assert.deepEqual(audit.metadata.original, JSON.parse(JSON.stringify(original)));
    assert.equal(audit.isCompleted, true);
    const after = await prisma[model[source]].findUniqueOrThrow({ where: { id: original.id } });
    if (source === 'visit') {
      assert.equal(after.alerts, null); assert.equal(after.internalNotes, original.internalNotes);
      assert.equal(after.status, original.status); assert.equal(after.ph, original.ph);
    } else assert.equal(after.status, 'RESOLVED');
    assert.equal((await resolve(reference)).body.resolvedAt, ack.resolvedAt);
    const newer = await prisma[model[source]].update({ where: { id: original.id }, data: source === 'visit' ? { alerts: 'Novo problema QA' } : { status: 'OPEN', message: 'Novo problema QA', ...(source === 'generic' ? { active: true } : {}) } });
    assert.equal((await resolve(reference, body)).status, 409);
    assert.equal((await receipts(reference)).length, 1);
    assert.equal((await resolve(reference, { expectedVersion: resolutionVersion(source, newer) })).status, 200);
    assert.equal((await receipts(reference)).length, 2, `New episode audit for ${source}`);
  }
  console.log('PASS eight concurrent requests per source produce one resolution and one original audit; exact replays preserve time; new incidents reject old versions');
  const strict = await create.notification({});
  for (const bad of [`unknown-${strict.id}`, `${strict.id}e0`, `notification-0${strict.id}`, 'notification-2147483648', '0', 'null']) assert.equal((await resolve(bad)).status, 400);
  assert.equal((await resolve(`notification-${strict.id}`, { expectedVersion: null })).status, 400);
  assert.equal((await resolve(`notification-${strict.id}`, [])).status, 400);
  const badConversion = await fetch(base + `/api/alerts/unknown-${strict.id}/convert`, { method: 'POST', headers, body: JSON.stringify({ price: 10 }) });
  assert.equal(badConversion.status, 400);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: strict.id } })).status, 'PENDING');
  assert.equal((await resolve('technical-2147483647')).status, 404);
  const fault = await create.technical({}), faultRef = `technical-${fault.id}`;
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_alert_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."sourceKey" LIKE 'alert-resolution:%' THEN RAISE EXCEPTION 'QA simulated audit failure'; END IF; RETURN NEW; END $$`);
  try {
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_alert_receipt_failure BEFORE INSERT ON "OperationalReminder" FOR EACH ROW EXECUTE FUNCTION qa_alert_receipt_failure()');
    for (const source of Object.keys(create)) {
      const row = source === 'technical' ? fault : await create[source]({}), reference = `${source}-${row.id}`;
      assert.equal((await resolve(reference)).status, 500);
      assert.deepEqual(await prisma[model[source]].findUniqueOrThrow({ where: { id: row.id } }), row);
      assert.equal((await receipts(reference)).length, 0);
    }
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_alert_receipt_failure ON "OperationalReminder"');
    await prisma.$executeRawUnsafe('DROP FUNCTION qa_alert_receipt_failure()');
  }
  assert.equal((await resolve(faultRef)).status, 200);
  console.log('PASS strict references never target a different source; audit failure rolls back the resolution');

  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers, body: JSON.stringify({ language: 'pt' }) });
  const { chromium } = require('playwright');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => {
    for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token);
    for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN', name: 'Resolucao QA' }));
  }, { token, id: admin.id });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const first = await create.technical({ message: 'Resolucao browser QA <b>literal</b>' });
  const button = row => page.locator(`[data-resolve-alert="technical-${row.id}"]`);
  const status = page.locator('#alertsStatus'), endpoint = row => base + `/api/alerts/technical-${row.id}/resolve`;
  const url = base + '/admin-alerts?q=browser%20QA';
  await page.goto(url, { waitUntil: 'networkidle' });
  await button(first).click();
  assert.match(await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).textContent(), /<b>literal<\/b>/);
  assert.equal(await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).locator('b').count(), 0);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert(size.scroll <= size.width + 1, JSON.stringify(size));
  }
  await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal((await receipts(`technical-${first.id}`)).length, 0);
  let sent = 0;
  await page.route(endpoint(first), async route => { sent++; assert(route.request().postDataJSON().expectedVersion); const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort('failed'); });
  await button(first).click();
  await page.evaluate(id => resolveAlert(`technical-${id}`), first.id);
  await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await status.filter({ hasText: 'Nao foi possivel confirmar' }).waitFor();
  assert.equal(sent, 1); assert.equal((await receipts(`technical-${first.id}`)).length, 1);
  assert.equal(await button(first).count(), 1);
  await page.unroute(endpoint(first));
  await button(first).click(); await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await button(first).waitFor({ state: 'hidden' });
  assert.equal((await receipts(`technical-${first.id}`)).length, 1);
  console.log('PASS literal confirmation, cancellation, duplicate clicks, actually committed lost response and safe browser retry');

  const stale = await create.technical({ message: 'Alteracao browser QA' });
  await page.reload({ waitUntil: 'networkidle' }); await button(stale).click();
  await prisma.technicalAlert.update({ where: { id: stale.id }, data: { message: 'Novo relato browser QA' } });
  await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await status.filter({ hasText: 'O alerta foi alterado' }).waitFor();
  assert.equal((await receipts(`technical-${stale.id}`)).length, 0);
  assert.equal((await prisma.technicalAlert.findUniqueOrThrow({ where: { id: stale.id } })).status, 'OPEN');
  const mismatch = await create.technical({ message: 'Resposta trocada browser QA' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.route(endpoint(mismatch), async route => { const response = await route.fetch(), result = await response.json(); await route.fulfill({ response, json: { ...result, reference: `technical-${stale.id}` } }); });
  await button(mismatch).click(); await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await status.filter({ hasText: 'Nao foi possivel confirmar' }).waitFor(); assert.equal(await button(mismatch).count(), 1);
  await page.unroute(endpoint(mismatch));
  await page.route(base + '/api/alerts', route => route.fulfill({ status: 503, json: { ok: false } }));
  await button(mismatch).click(); await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await status.filter({ hasText: 'Alerta resolvido. Nao foi possivel atualizar' }).waitFor();
  assert.equal(await button(mismatch).count(), 0);
  await page.unroute(base + '/api/alerts');
  const physical = await create.technical({ type: 'BOMBA_MANUAL', message: 'Confirmacao fisica browser QA' });
  await page.reload({ waitUntil: 'networkidle' });
  assert.match(await button(physical).locator('..').textContent(), /Confirme primeiro o fecho da agua/);
  await button(physical).click(); await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await status.filter({ hasText: 'Confirme primeiro' }).waitFor();
  assert.equal((await prisma.technicalAlert.findUniqueOrThrow({ where: { id: physical.id } })).status, 'OPEN');

  const repairSource = await create.technical({ message: 'Criar reparacao browser QA' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#openRepairModal').click();
  await page.locator('#repairContextSelect').selectOption(`alert:technical-${repairSource.id}`);
  await page.locator('#repairProblemInput').fill('Reparacao criada apesar de resposta de resolucao perdida QA');
  await page.route(endpoint(repairSource), async route => { const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort('failed'); });
  await page.locator('#repairSubmitBtn').click();
  await status.filter({ hasText: 'criada. A resolucao do alerta nao foi confirmada' }).waitFor();
  assert.equal(await prisma.repair.count({ where: { poolId: pool.id, problem: 'Reparacao criada apesar de resposta de resolucao perdida QA' } }), 1);
  assert.equal(await page.getByRole('dialog', { name: 'Nova reparacao contextual' }).isVisible(), false);
  await page.unroute(endpoint(repairSource));
  await button(repairSource).click(); await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await button(repairSource).waitFor({ state: 'hidden' });
  console.log('PASS repair creation remains explicitly confirmed when its separate alert-resolution response is lost');

  await button(stale).click();
  await page.evaluate(() => localStorage.setItem('token', 'changed-session'));
  await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await status.filter({ hasText: 'A sessao mudou' }).waitFor();
  assert.equal((await receipts(`technical-${stale.id}`)).length, 0);
  await page.reload({ waitUntil: 'networkidle' });
  let release, started;
  const gate = new Promise(resolve => { release = resolve; }), entered = new Promise(resolve => { started = resolve; });
  await page.route(endpoint(stale), async route => { const response = await route.fetch(); started(); await gate; await route.fulfill({ response }); });
  await button(stale).click(); await page.getByRole('dialog', { name: 'Confirmar resolucao', exact: true }).getByRole('button', { name: 'Resolver', exact: true }).click();
  await entered;
  try { await page.evaluate(() => localStorage.setItem('token', 'changed-session-after-send')); }
  finally { release(); }
  await status.filter({ hasText: 'A sessao mudou' }).waitFor();
  assert.equal(await page.locator('[data-resolve-alert]').count(), 0);
  assert.equal((await receipts(`technical-${stale.id}`)).length, 1);
  assert.deepEqual(errors, []);
  console.log('PASS changed report and wrong acknowledgement stay unconfirmed; confirmed resolution survives read failure; critical notices and changed sessions cannot be dismissed');
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
