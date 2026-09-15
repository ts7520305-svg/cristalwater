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
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
