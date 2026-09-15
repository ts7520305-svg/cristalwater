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
  const client = await prisma.client.create({ data: { name: 'Remoção QA' } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina da remoção QA' } });
  const create = values => prisma.generalReminder.create({ data: { title: 'Eliminar aviso QA', dueAt: new Date('2028-01-01T10:00:00Z'), category: 'TECHNICAL_PERIODIC_SERVICE', clientId: client.id, poolId: pool.id, status: 'PENDING', repeatRule: 'WEEKLY', ...values } });
  const url = (id, targetPool = pool.id) => `/api/core/pools/${targetPool}/service-reminders/${id}`;
  async function request(path, options = {}, authToken = token) {
    const r = await fetch(base + path, { method: 'DELETE', ...options, headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) } });
    return { status: r.status, body: await r.json() };
  }
  async function remove(row, expected = 200, path = url(row.id), options = {}) {
    const result = await request(path, { body: JSON.stringify({ expectedUpdatedAt: row.updatedAt.toISOString() }), ...options });
    assert.equal(result.status, expected, JSON.stringify(result)); return result.body;
  }
  const decimal = await create(), general = await create({ category: 'GENERAL' });
  const wrongDecimal = await request(url(decimal.id + '.5')), wrongCategory = await request(url(general.id));
  console.log(JSON.stringify({ malformedIdStatus: wrongDecimal.status, foreignCategoryStatus: wrongCategory.status }));
  assert.equal(wrongDecimal.status, 400, 'A decimal ID must never delete its integer neighbour');
  assert.equal(wrongCategory.status, 404, 'The pool service route must not delete a general CRM reminder');
  assert(await prisma.generalReminder.findUnique({ where: { id: decimal.id } }));
  assert(await prisma.generalReminder.findUnique({ where: { id: general.id } }));
  console.log('PASS malformed IDs and wrong categories cannot delete reminders');
  for (const badId of ['0', '-1', '01', `${decimal.id}e0`, '2147483648', 'Infinity']) await remove(decimal, 400, url(badId));
  await remove(decimal, 400, url(decimal.id, `${pool.id}.5`));
  await remove(decimal, 404, url(decimal.id, pool.id + 100000));
  await remove({ ...decimal, id: 2147483647 }, 404);
  assert.equal((await request(url(decimal.id), {}, '')).status, 401);
  const technician = await prisma.technician.create({ data: { name: 'Remoção técnico QA', active: true } });
  const techToken = jwt.sign({ id: technician.id, technicianId: technician.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  assert.equal((await request(url(decimal.id), {}, techToken)).status, 403);
  for (const expectedUpdatedAt of [null, true, {}, 'invalid', '2028-02-30T10:00:00.000Z']) {
    await remove(decimal, 400, url(decimal.id), { body: JSON.stringify({ expectedUpdatedAt }) });
  }
  assert(await prisma.generalReminder.findUnique({ where: { id: decimal.id } }));
  const modified = await prisma.generalReminder.update({ where: { id: decimal.id }, data: { title: 'Alterado depois da confirmação', updatedAt: new Date(decimal.updatedAt.getTime() + 1000) } });
  await remove(decimal, 409);
  assert.equal((await prisma.generalReminder.findUniqueOrThrow({ where: { id: decimal.id } })).title, modified.title);
  console.log('PASS exact destination, stale versions, malformed input and real admin authorization');

  const concurrent = await create({ title: 'Eliminar uma vez QA', category: 'POOL_SERVICE_REMINDER' });
  const responses = await Promise.all(Array.from({ length: 8 }, () => remove(concurrent)));
  assert.equal(responses.filter(r => r.idempotent).length, 7);
  assert.equal(new Set(responses.map(r => r.deletedAt)).size, 1);
  assert.equal(await prisma.generalReminder.count({ where: { id: concurrent.id } }), 0);
  const receipt = await prisma.operationalReminder.findUniqueOrThrow({ where: { sourceKey: `reminder-delete:${concurrent.id}` } });
  assert.equal(receipt.metadata.reminder.title, concurrent.title);
  assert.equal(receipt.metadata.reminder.repeatRule, concurrent.repeatRule);
  assert.equal(receipt.metadata.actor, `ADMIN:${admin.id}`);
  assert.equal(receipt.isCompleted, true); assert.equal(receipt.assignedToTechnicianId, null);
  assert.equal(receipt.poolId, null); assert.equal(receipt.clientId, null);
  await remove(concurrent, 404, url(concurrent.id, pool.id + 100000));
  await remove({ ...concurrent, updatedAt: new Date(concurrent.updatedAt.getTime() + 1000) }, 409);
  const legacy = await create({ title: 'Legado QA' });
  assert.equal((await request(url(legacy.id))).status, 200);
  assert.equal((await request(url(legacy.id))).body.idempotent, true);
  console.log('PASS eight simultaneous deletions, durable replay, preserved audit snapshot and legacy API compatibility');

  const fault = await create({ title: 'Eliminar rollback QA' });
  await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_reminder_delete_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."sourceKey" LIKE 'reminder-delete:%' THEN RAISE EXCEPTION 'QA simulated deletion receipt failure'; END IF; RETURN NEW; END $$`);
  try {
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_reminder_delete_failure BEFORE INSERT ON "OperationalReminder" FOR EACH ROW EXECUTE FUNCTION qa_reminder_delete_failure()');
    await remove(fault, 500);
    assert(await prisma.generalReminder.findUnique({ where: { id: fault.id } }));
    assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `reminder-delete:${fault.id}` } }), 0);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_reminder_delete_failure ON "OperationalReminder"');
    await prisma.$executeRawUnsafe('DROP FUNCTION qa_reminder_delete_failure()');
  }
  await remove(fault);
  const completed = await create({ title: 'Concluído antes de eliminar QA' });
  assert.equal((await request(url(completed.id) + '/complete', { method: 'POST' })).status, 200);
  await remove(completed, 409);
  assert.equal(await prisma.generalReminder.count({ where: { title: completed.title, poolId: pool.id } }), 2);
  const removed = await create({ title: 'Eliminado antes de concluir QA' });
  await remove(removed);
  assert.equal((await request(url(removed.id) + '/complete', { method: 'POST' })).status, 404);
  assert.equal(await prisma.generalReminder.count({ where: { title: removed.title, poolId: pool.id } }), 0);
  for (let i = 0; i < 4; i++) {
    const race = await create({ title: `Concluir e eliminar em simultâneo QA ${i}` });
    const [del, done] = await Promise.all([
      request(url(race.id), { body: JSON.stringify({ expectedUpdatedAt: race.updatedAt.toISOString() }) }),
      request(url(race.id) + '/complete', { method: 'POST' }),
    ]);
    const count = await prisma.generalReminder.count({ where: { title: race.title, poolId: pool.id } });
    if (del.status === 200) { assert.equal(done.status, 404); assert.equal(count, 0); }
    else { assert.equal(del.status, 409); assert.equal(done.status, 200); assert.equal(count, 2); }
  }
  console.log('PASS transaction rollback, completed-before-delete, deleted-before-complete and four real concurrent races');

  const { chromium } = require('playwright');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, admin }) => {
    localStorage.setItem('token', token); localStorage.setItem('cristalwater_jwt', token);
    const user = JSON.stringify({ id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN' });
    localStorage.setItem('user', user); localStorage.setItem('cristalwater_user', user);
  }, { token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const kind of ['technical', 'crm']) {
    const pageUrl = kind === 'technical' ? `/admin-pool-technical.html?poolId=${pool.id}` : `/admin-crm.html?poolId=${pool.id}`;
    const status = page.locator(kind === 'technical' ? '#reminderStatus' : '#poolReminderStatus');
    const button = row => page.locator(`[data-delete-reminder="${row.id}"]`);
    const modal = page.locator('.cw-ui-modal');
    const accept = () => modal.locator('.cw-ui-btn-danger').click();
    const open = async row => { await button(row).click(); await modal.waitFor(); };
    let calls = 0;
    const target = await create({ title: `Rever SQL <img src=x onerror=alert(1)> ${kind} ` + 'Filtro'.repeat(40) });
    await page.goto(base + pageUrl, { waitUntil: 'networkidle' });
    await page.evaluate(() => CristalI18n.applyLanguage('pt'));
    await page.route(base + url(target.id), async route => {
      if (route.request().method() !== 'DELETE') return route.continue();
      calls++;
      assert.equal(route.request().postDataJSON().expectedUpdatedAt, target.updatedAt.toISOString());
      if (calls === 1) { const response = await route.fetch(); assert.equal(response.status(), 200); return route.abort('failed'); }
      return route.continue();
    });
    await open(target);
    await page.evaluate(id => document.querySelector(`[data-delete-reminder="${id}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), target.id);
    assert.equal(await modal.count(), 1);
    assert((await modal.locator('.cw-ui-modal-details').textContent()).includes(target.title));
    assert((await modal.locator('.cw-ui-modal-details').textContent()).includes(pool.name));
    assert.equal(await modal.locator('img').count(), 0);
    for (const [language, label] of [['en', 'Delete reminder'], ['fr', 'Supprimer le rappel'], ['es', 'Eliminar recordatorio'], ['de', 'Erinnerung löschen']]) {
      await page.evaluate(language => CristalI18n.applyLanguage(language), language);
      await modal.locator('.cw-ui-modal-head').filter({ hasText: label }).waitFor();
      assert((await modal.locator('.cw-ui-modal-details').textContent()).includes(target.title));
    }
    await page.evaluate(() => CristalI18n.applyLanguage('pt'));
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await modal.evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.getBoundingClientRect().width <= innerWidth));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.qaOldDeleteAccept = document.querySelector('.cw-ui-btn-danger'); });
    await modal.locator('.cw-ui-btn-muted').press('Enter');
    await modal.waitFor({ state: 'hidden' });
    assert.equal(calls, 0); assert(await prisma.generalReminder.findUnique({ where: { id: target.id } }));
    await open(target);
    await page.evaluate(() => window.qaOldDeleteAccept.click());
    assert.equal(await modal.count(), 1); assert.equal(calls, 0);
    await accept();
    await status.filter({ hasText: 'Ainda não foi possível confirmar a eliminação' }).waitFor();
    assert.equal(calls, 1); assert.equal(await prisma.generalReminder.count({ where: { id: target.id } }), 0);
    assert.equal(await button(target).count(), 1);
    await open(target); await accept();
    await status.filter({ hasText: 'já tinha sido eliminado' }).waitFor();
    await button(target).waitFor({ state: 'hidden' }); assert.equal(calls, 2);
    assert.equal(await page.locator(`[data-complete-reminder="${target.id}"]`).count(), 0);
    await page.unroute(base + url(target.id));

    const stale = await create({ title: `Confirmação antiga ${kind}` });
    await page.reload({ waitUntil: 'networkidle' }); await open(stale);
    assert.equal((await request(url(stale.id) + '/complete', { method: 'POST' })).status, 200);
    await accept(); await status.filter({ hasText: 'mudou ou já não está disponível' }).waitFor();
    assert.equal(await prisma.generalReminder.count({ where: { title: stale.title, poolId: pool.id } }), 2);
    const refreshed = await create({ title: `Lista alterada ${kind}` });
    await page.reload({ waitUntil: 'networkidle' }); await open(refreshed);
    await prisma.generalReminder.update({ where: { id: refreshed.id }, data: { title: `Novo título ${kind}`, updatedAt: new Date(refreshed.updatedAt.getTime() + 1000) } });
    let forbidden = 0;
    await page.route(base + url(refreshed.id), route => { if (route.request().method() === 'DELETE') forbidden++; return route.continue(); });
    await page.evaluate(kind => kind === 'technical' ? loadReminders() : loadPoolReminders(), kind);
    await accept(); await status.filter({ hasText: 'O lembrete mudou.' }).waitFor(); assert.equal(forbidden, 0);
    await page.unroute(base + url(refreshed.id));

    const wrong = await create({ title: `Resposta trocada ${kind}` });
    await page.reload({ waitUntil: 'networkidle' });
    await page.route(base + url(wrong.id), async route => {
      const response = await route.fetch(), body = await response.json();
      return route.fulfill({ response, json: { ...body, reminderId: wrong.id + 100000 } });
    });
    await open(wrong); await accept();
    await status.filter({ hasText: 'Ainda não foi possível' }).waitFor(); assert.equal(await button(wrong).count(), 1);
    await page.unroute(base + url(wrong.id));
    const listPath = kind === 'technical' ? `/api/core/pools/${pool.id}/service-reminders` : '/api/crm/reminders?category=TECHNICAL_PERIODIC_SERVICE';
    await page.route(base + listPath, route => route.fulfill({ status: 503, json: { ok: false, error: 'QA list unavailable' } }));
    await open(wrong); await accept();
    await status.filter({ hasText: 'Lembrete eliminado. Atualiza a página' }).waitFor();
    assert.equal(await button(wrong).count(), 0);
    await page.unroute(base + listPath);

    const sessionRow = await create({ title: `Sessão mudou ${kind}` });
    await page.reload({ waitUntil: 'networkidle' });
    if (kind === 'crm') {
      let releaseCompletion;
      const completionGate = new Promise(resolve => { releaseCompletion = resolve; });
      await page.route(base + url(sessionRow.id) + '/complete', async route => { await completionGate; return route.fulfill({ status: 503, json: { ok: false, error: 'QA unavailable' } }); });
      const completing = page.evaluate(({ id, poolId }) => completePoolReminder(id, poolId).catch(() => {}), sessionRow);
      await page.waitForFunction(id => document.querySelector(`[data-delete-reminder="${id}"]`).disabled, sessionRow.id);
      releaseCompletion(); await completing;
      assert.equal(await button(sessionRow).isDisabled(), false, 'A failed completion must release the deletion button');
      await page.unroute(base + url(sessionRow.id) + '/complete');
    }
    await open(sessionRow);
    await page.route(base + url(sessionRow.id), route => { forbidden++; return route.continue(); });
    await page.evaluate(() => { localStorage.setItem('token', 'other-session'); localStorage.setItem('cristalwater_jwt', 'other-session'); });
    await accept(); await status.filter({ hasText: 'A sessão mudou' }).waitFor();
    assert.equal(forbidden, 0); assert(await prisma.generalReminder.findUnique({ where: { id: sessionRow.id } }));
    await page.unroute(base + url(sessionRow.id));
    await page.evaluate(token => { localStorage.setItem('token', token); localStorage.setItem('cristalwater_jwt', token); }, token);
    await page.reload({ waitUntil: 'networkidle' });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let committed = false;
    await page.route(base + url(sessionRow.id), async route => {
      const response = await route.fetch(); assert.equal(response.status(), 200); committed = true;
      await gate; return route.fulfill({ response });
    });
    await open(sessionRow); await accept();
    await page.waitForFunction(() => document.querySelector('.cw-ui-modal') === null);
    for (let i = 0; !committed && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert(committed);
    await page.evaluate(() => { localStorage.setItem('token', 'late-session'); localStorage.setItem('cristalwater_jwt', 'late-session'); });
    release(); await status.filter({ hasText: 'A sessão mudou' }).waitFor();
    assert.equal(await button(sessionRow).count(), 1, 'A previous session response must not update the current list');
    assert.equal(await prisma.generalReminder.count({ where: { id: sessionRow.id } }), 0);
    await page.unroute(base + url(sessionRow.id));
    await page.evaluate(token => { localStorage.setItem('token', token); localStorage.setItem('cristalwater_jwt', token); }, token);
    console.log(`PASS ${kind}: exact safe target, five languages, mobile/desktop, cancel/late click, lost response replay, stale and refreshed versions, wrong acknowledgment, failed refresh and changed session`);
  }
  assert.deepEqual(errors, []);
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
