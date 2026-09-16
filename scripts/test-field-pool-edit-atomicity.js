'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const aliases = ['/api/pools', '/api/core/pools'];
let failureTable;
const json = value => JSON.parse(JSON.stringify(value));
async function removeFailure() {
  if (!failureTable) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_pool_edit_injected ON "' + failureTable + '"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_pool_edit_injected()');
  failureTable = null;
}
async function injectFailure(table, operation) {
  assert(['TechnicalHistory', 'TechnicalSheet', 'ServiceVisit'].includes(table));
  failureTable = table;
  await prisma.$executeRawUnsafe("CREATE FUNCTION qa_pool_edit_injected() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA mandatory pool edit write failed'; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_pool_edit_injected BEFORE ' + operation + ' ON "' + table + '" FOR EACH ROW EXECUTE FUNCTION qa_pool_edit_injected()');
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const clients = [];
  for (const name of ['Original owner', 'New owner']) clients.push(await prisma.client.create({ data: {
    name, active: true, status: 'ACTIVE', contractActive: true, billingActive: true, creditBalance: 25.75,
    password: 'private-password-fixture', pin: 'private-pin-fixture',
  } }));
  const pool = await prisma.pool.create({ data: {
    name: 'Pool edit QA', type: 'POOL', clientId: clients[0].id, volumeM3: 45, notes: 'General notes', monthlyAmount: 130.5,
    technicalSheet: { create: { volumeM3: 47, disinfectionType: 'SAL', specialObservations: 'Measured and checked', filterBrandModel: 'Filter original' } },
    equipment: { create: { notes: 'Equipment original' } },
    technicalRoom: { create: { notes: 'Room original' } },
    calculationProfile: { create: { volumeM3: 47, notes: 'Calculation original' } },
  } });
  const include = { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true };
  const row = () => prisma.pool.findUniqueOrThrow({ where: { id: pool.id }, include });
  const history = () => prisma.technicalHistory.findMany({ where: { poolId: pool.id, type: 'TECHNICAL_SHEET_CHANGE' }, orderBy: { id: 'asc' } });
  const visits = () => prisma.serviceVisit.findMany({ where: { poolId: pool.id }, orderBy: { id: 'asc' } });
  const now = new Date();
  const visitData = [
    { status: 'PLANNED' }, { status: 'PENDING' }, { status: 'SCHEDULED' },
    { status: 'IN_PROGRESS', startAt: now }, { status: 'DONE', endAt: now }, { status: 'COMPLETED' }, { status: 'CANCELLED' },
    { status: 'CLOSED' }, { status: 'PLANNED', startAt: now }, { status: 'PLANNED', endAt: now },
    { status: 'PLANNED', billed: true }, { status: 'PLANNED', billedAt: now }, { status: 'PLANNED', completionRequestId: randomUUID() },
  ];
  for (const data of visitData) await prisma.serviceVisit.create({ data: { clientId: clients[0].id, poolId: pool.id, ...data } });
  const originalVisits = await visits(), eligibleIds = new Set(originalVisits.slice(0, 3).map(v => v.id));
  const invoice = await prisma.invoice.create({ data: { clientId: clients[0].id, total: 200, totalCents: 20000, status: 'PARTIAL',
    amountPaid: 25, amountOpen: 175, payments: { create: { amount: 25, amountCents: 2500, method: 'MANUAL' } } } });
  const invoiceBefore = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
  async function call(alias, body, credential = token, target = pool.id) {
    const response = await fetch(base + alias + '/' + target, { method: 'PUT', headers: {
      Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json', 'x-user-email': 'forged@pool.test',
    }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const without = (object, fields) => Object.fromEntries(Object.entries(object).filter(([key]) => !fields.includes(key)));
  for (const alias of aliases) {
    const before = await row(), count = (await history()).length;
    const result = await call(alias, { name: 'Renamed ' + alias, actor: 'FORGED' });
    assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.data.ok, true);
    const after = await row(); assert.deepEqual(without(after, ['name', 'updatedAt']), without(before, ['name', 'updatedAt']));
    assert(!('password' in result.data.pool.client)); assert(!('pin' in result.data.pool.client));
    const records = await history(); assert.equal(records.length, count + 1);
    const change = JSON.parse(records.at(-1).description);
    assert.equal(change.actor, 'USER:' + admin.id); assert.deepEqual(change.before, json(before)); assert.deepEqual(change.after, json(after));
    assert(!records.at(-1).description.includes('FORGED')); assert(!records.at(-1).description.includes('private-password-fixture'));
    const technicalBefore = after.technicalSheet;
    assert.equal((await call(alias, { type: 'JACUZZI', notes: 'Changed general notes' })).status, 200);
    assert.deepEqual((await row()).technicalSheet, technicalBefore);
    assert.equal((await call(alias, { volumeM3: null })).status, 200); assert.equal((await row()).volumeM3, null);
    assert.deepEqual((await row()).technicalSheet, technicalBefore);
  }
  console.log('PASS both pool edit APIs preserve omitted technical, equipment and calculation data, separate pool type/notes and record authenticated snapshots');
  assert.equal((await call(aliases[0], { technicalSheet: { disinfectionType: 'BROMO', specialObservations: null, targetPhMin: 7.1 } })).status, 200);
  assert.equal((await row()).technicalSheet.disinfectionType, 'BROMO'); assert.equal((await row()).technicalSheet.specialObservations, null);
  assert.equal((await row()).type, 'JACUZZI');
  for (const alias of aliases) {
    for (const [table, operation] of [['TechnicalHistory', 'INSERT'], ['TechnicalSheet', 'UPDATE'], ['ServiceVisit', 'UPDATE']]) {
      const before = await row(), priorVisits = await visits(), priorHistory = await history();
      await injectFailure(table, operation);
      try {
        const response = await call(alias, { name: 'MUST ROLLBACK', clientId: clients[1].id, technicalSheet: { filterBrandModel: 'MUST ROLLBACK' } });
        assert.equal(response.status, 500, JSON.stringify(response)); assert.equal(response.data.ok, false);
        assert(!JSON.stringify(response.data).includes('QA mandatory'));
        assert.deepEqual(await row(), before); assert.deepEqual(await visits(), priorVisits); assert.deepEqual(await history(), priorHistory);
      } finally { await removeFailure(); }
    }
  }
  console.log('PASS history, sheet and visit failures roll back every related write on both aliases');
  for (let index = 0; index < aliases.length; index++) {
    const destination = clients[index === 0 ? 1 : 0];
    const result = await call(aliases[index], { clientId: destination.id });
    assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.data.reassignedVisits, 3);
    assert.equal((await row()).clientId, destination.id);
    const currentVisits = await visits();
    for (const visit of currentVisits) {
      const original = originalVisits.find(v => v.id === visit.id);
      if (eligibleIds.has(visit.id)) {
        assert.equal(visit.clientId, destination.id);
        assert.deepEqual(without(visit, ['clientId', 'updatedAt']), without(original, ['clientId', 'updatedAt']));
      } else assert.deepEqual(visit, original);
    }
    assert.equal(JSON.parse((await history()).at(-1).description).reassignedVisits, 3);
  }
  const beforeInvalid = await row(), beforeInvalidHistory = await history();
  for (const body of [{ name: '' }, { volumeM3: -1 }, { notes: {} }, { technicalSheet: [] }, { targetPhMin: 15 }, { targetPhMin: 8 }, { clientId: null }, { monthlyAmount: 'abc' }]) {
    assert.equal((await call(aliases[0], body)).status, 400, JSON.stringify(body));
    assert.deepEqual(await row(), beforeInvalid); assert.deepEqual(await history(), beforeInvalidHistory);
  }
  await prisma.client.update({ where: { id: clients[1].id }, data: { active: false } });
  assert.equal((await call(aliases[1], { clientId: clients[1].id })).status, 400);
  assert.deepEqual(await row(), beforeInvalid); assert.deepEqual(await history(), beforeInvalidHistory);
  const leader = await prisma.technician.create({ data: { name: 'Pool edit leader QA', role: 'TEAM_LEADER', active: true } });
  for (const alias of aliases) {
    assert.equal((await call(alias, { name: 'Anonymous' }, '')).status, 401);
    for (const claims of [{ id: clients[0].id, clientId: clients[0].id, role: 'CLIENT' }, { id: leader.id, role: 'TEAM_LEADER' }]) {
      assert.equal((await call(alias, { name: 'Forbidden' }, jwt.sign(claims, getJwtSecret(), { expiresIn: '1h' }))).status, 403);
    }
    assert.equal((await call(alias, { name: 'Missing' }, token, 2147483647)).status, 404);
  }
  const concurrent = await Promise.all([call(aliases[0], { name: 'Concurrent name' }), call(aliases[1], { notes: 'Concurrent notes' })]);
  assert(concurrent.every(result => result.status === 200));
  assert.equal((await row()).name, 'Concurrent name'); assert.equal((await row()).notes, 'Concurrent notes');
  const finalHistory = await history();
  assert.deepEqual(JSON.parse(finalHistory.at(-1).description).before, JSON.parse(finalHistory.at(-2).description).after);
  const emptyPool = await prisma.pool.create({ data: { name: 'Missing sheet QA', clientId: clients[0].id, type: 'POOL', volumeM3: 20 } });
  await injectFailure('TechnicalHistory', 'INSERT');
  try {
    assert.equal((await call(aliases[1], { name: 'Must not create sheet' }, token, emptyPool.id)).status, 500);
    assert.equal(await prisma.technicalSheet.count({ where: { poolId: emptyPool.id } }), 0);
    assert.equal((await prisma.pool.findUniqueOrThrow({ where: { id: emptyPool.id } })).name, emptyPool.name);
  } finally { await removeFailure(); }
  const createdSheet = await call(aliases[1], { name: 'Default sheet safely created' }, token, emptyPool.id);
  assert.equal(createdSheet.status, 200); assert.equal(createdSheet.data.technicalSheet.disinfectionType, 'CLORO');
  assert.equal(createdSheet.data.technicalSheet.volumeM3, 20);
  await prisma.pool.update({ where: { id: pool.id }, data: { active: false, archiveStatus: 'ARQUIVADO', deletedAt: now, scheduleMode: 'ARCHIVED' } });
  for (const alias of aliases) {
    const archived = await row(); assert.equal((await call(alias, { notes: 'Archive annotation' })).status, 200);
    assert.deepEqual(without(await row(), ['notes', 'updatedAt']), without(archived, ['notes', 'updatedAt']));
  }
  assert.deepEqual(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } }), invoiceBefore);
  for (const client of clients) {
    const current = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    for (const field of ['creditBalance', 'contractActive', 'billingActive']) assert.equal(current[field], client[field]);
  }
  console.log('PASS reassignment moves only unstarted/unbilled visits, preserves financial/completed history, enforces access, serializes patches and preserves archive');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await removeFailure(); await prisma.$disconnect(); });
