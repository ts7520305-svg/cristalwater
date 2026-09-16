'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const children = []; let failureTable;
async function start() {
  const child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); children.push(child);
  return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA startup timed out')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }); });
}
async function stop(child) { if (child.exitCode !== null) return; await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function dropTrigger() {
  if (!failureTable) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_pool_edit_receipt_fail ON "' + failureTable + '"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_pool_edit_receipt_fail()'); failureTable = null;
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' }), actorKey = 'USER:' + admin.id;
  const clients = [];
  for (const name of ['Original pool owner', 'New pool owner', 'Other pool owner']) clients.push(await prisma.client.create({ data: { name, active: true, status: 'ACTIVE', contractActive: true, billingActive: true, creditBalance: 14, password: 'QA private password', pin: 'QA private pin' } }));
  const pool = await prisma.pool.create({ data: { name: 'Pool version QA', clientId: clients[0].id, monthlyAmount: 80, notes: 'General note',
    technicalSheet: { create: { volumeM3: 48, disinfectionType: 'SAL', specialObservations: 'Technical note' } },
    equipment: { create: { notes: 'Equipment' } }, technicalRoom: { create: { notes: 'Room' } }, calculationProfile: { create: { volumeM3: 48 } } } });
  const otherPool = await prisma.pool.create({ data: { name: 'Other pool', clientId: clients[0].id } });
  const include = { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true };
  const row = () => prisma.pool.findUniqueOrThrow({ where: { id: pool.id }, include });
  const counts = async () => ({ history: await prisma.technicalHistory.count({ where: { poolId: pool.id, type: 'TECHNICAL_SHEET_CHANGE' } }), receipts: await prisma.poolEditRequest.count({ where: { poolId: pool.id } }) });
  async function state(alias = '/api/pools') {
    const response = await fetch(base + alias + '/' + pool.id + '/edit-state', { headers: { Authorization: 'Bearer ' + token } }); assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.ok, true); assert.equal(result.scope, 'POOL_EDIT'); assert.equal(result.poolId, pool.id); assert.equal(result.pool.id, pool.id);
    assert.match(result.version, /^pool-v1:[0-9a-f]{64}$/); assert(!JSON.stringify(result).includes('QA private')); assert(result.clients.some(c => c.id === clients[0].id)); return result;
  }
  async function send(body, options = {}) {
    const response = await fetch((options.base || base) + (options.alias || '/api/pools') + '/' + (options.id || pool.id), { method: 'PUT', headers: { Authorization: 'Bearer ' + (options.token === undefined ? token : options.token), 'Content-Type': 'application/json', ...(options.drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  let second = await start();
  for (const alias of ['/api/pools', '/api/core/pools']) {
    const original = await state(alias), before = await row(), countBefore = await counts();
    const request = { requestId: randomUUID(), expectedVersion: original.version, name: 'Guarded ' + alias };
    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => send(request, index % 2 ? { base: second } : { alias })));
    assert(results.every(r => r.status === 200), JSON.stringify(results)); assert.equal(results.filter(r => !r.body.replayed).length, 1);
    const saved = results.find(r => !r.body.replayed).body;
    assert.equal(saved.receipt.scope, 'POOL_EDIT'); assert.equal(saved.receipt.actorKey, actorKey); assert.equal(saved.receipt.requestId, request.requestId); assert.equal(saved.receipt.poolId, pool.id);
    assert.equal(saved.version, (await state()).version); assert.equal(saved.receipt.historyId > 0, true); assert.equal(saved.reassignedVisits, 0);
    assert.deepEqual((await row()).technicalSheet, before.technicalSheet); assert.deepEqual(await counts(), { history: countBefore.history + 1, receipts: countBefore.receipts + 1 });
    assert(!JSON.stringify(saved).includes('QA private'));
    for (const result of results) assert.deepEqual(result.body, { ...saved, replayed: result.body.replayed });
    assert.equal((await send({ ...request, name: 'Different content' })).body.code, 'POOL_EDIT_REQUEST_REUSED');
    assert.equal((await send(request, { id: otherPool.id })).body.code, 'POOL_EDIT_REQUEST_REUSED');
    assert.equal((await send({ ...request, requestId: randomUUID() })).body.code, 'POOL_VERSION_CONFLICT');
    await prisma.pool.update({ where: { id: pool.id }, data: { zone: 'Another writer' } });
    await prisma.technicalHistory.delete({ where: { id: saved.receipt.historyId } });
    assert.deepEqual((await send({ ...request, requestId: request.requestId.toUpperCase() })).body, { ...saved, replayed: true }); assert.equal((await row()).zone, 'Another writer');
  }
  console.log('PASS both pool edit APIs, two processes, one immutable history/receipt and replay after later edits or history deletion');

  const snapshot = await state();
  const competing = await Promise.all([send({ requestId: randomUUID(), expectedVersion: snapshot.version, notes: 'Window A' }), send({ requestId: randomUUID(), expectedVersion: snapshot.version, name: 'Window B' }, { base: second })]);
  assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
  for (const model of ['technicalSheet', 'poolEquipment', 'technicalRoom', 'poolCalculationProfile']) {
    const before = await state(), poolBefore = await row();
    const relation = await prisma[model].findUniqueOrThrow({ where: { poolId: pool.id } });
    const patch = model === 'technicalSheet' ? { specialObservations: randomUUID() } : { notes: randomUUID() };
    await prisma[model].update({ where: { poolId: pool.id }, data: { ...patch, updatedAt: relation.updatedAt } });
    assert.notEqual((await state()).version, before.version); assert.equal((await row()).updatedAt.toISOString(), poolBefore.updatedAt.toISOString());
    assert.equal((await send({ requestId: randomUUID(), expectedVersion: before.version, name: 'Stale relation' })).body.code, 'POOL_VERSION_CONFLICT');
  }
  console.log('PASS competing UUIDs and child-only legacy changes cannot overwrite an obsolete pool version');

  const visit = await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: clients[0].id, status: 'PLANNED' } });
  const done = await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: clients[0].id, status: 'DONE', endAt: new Date() } });
  const invoice = await prisma.invoice.create({ data: { clientId: clients[0].id, total: 150, totalCents: 15000, amountPaid: 20, amountOpen: 130, status: 'PARTIAL', payments: { create: { amount: 20, amountCents: 2000, method: 'MANUAL' } } } });
  const invoiceBefore = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
  const transferState = await state();
  const transfer = { requestId: randomUUID(), expectedVersion: transferState.version, expectedClientVersion: transferState.clients.find(c => c.id === clients[1].id).version, clientId: clients[1].id, monthlyAmount: 110.25, notes: 'Transfer with recovery' };
  await assert.rejects(send(transfer, { base: second, drop: true }));
  assert.equal((await row()).clientId, clients[1].id); assert.equal((await prisma.serviceVisit.findUniqueOrThrow({ where: { id: visit.id } })).clientId, clients[1].id);
  assert.equal((await prisma.serviceVisit.findUniqueOrThrow({ where: { id: done.id } })).clientId, clients[0].id);
  const replay = await send(transfer); assert.equal(replay.body.replayed, true); assert.equal(replay.body.reassignedVisits, 1); assert.equal(replay.body.receipt.previousClientId, clients[0].id); assert.equal(replay.body.receipt.clientId, clients[1].id);
  const laterVisit = await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: clients[0].id, status: 'PLANNED' } });
  await prisma.client.update({ where: { id: clients[1].id }, data: { active: false, archiveStatus: 'ARQUIVADO' } });
  await stop(children.at(-1)); second = await start();
  assert.deepEqual((await send(transfer, { base: second })).body, replay.body); assert.equal((await prisma.serviceVisit.findUniqueOrThrow({ where: { id: laterVisit.id } })).clientId, clients[0].id);
  assert.deepEqual(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } }), invoiceBefore);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: clients[0].id } })).creditBalance, 14);
  const inactiveState = await state();
  const notAllowed = await send({ requestId: randomUUID(), expectedVersion: inactiveState.version, expectedClientVersion: inactiveState.clients.find(c => c.id === clients[1].id).version, clientId: clients[1].id }); assert.equal(notAllowed.status, 409); assert.equal(notAllowed.body.code, 'POOL_EDIT_RECIPIENT_CHANGED');
  const oldRecipient = { requestId: randomUUID(), expectedVersion: inactiveState.version, expectedClientVersion: inactiveState.clients.find(c => c.id === clients[2].id).version, clientId: clients[2].id };
  await prisma.client.update({ where: { id: clients[2].id }, data: { active: false } });
  assert.equal((await send(oldRecipient)).body.code, 'POOL_EDIT_RECIPIENT_CHANGED');
  await prisma.client.update({ where: { id: clients[2].id }, data: { active: true } });
  assert.equal((await send(oldRecipient)).body.code, 'POOL_EDIT_RECIPIENT_CHANGED', 'A previously rejected transfer must remain obsolete after recipient reactivation');
  console.log('PASS transfer/lost reply/restart replays original counts without moving later or completed visits or financial history, even after recipient archival');

  for (const table of ['TechnicalHistory', 'PoolEditRequest']) {
    const before = await row(), countBefore = await counts(), visitsBefore = await prisma.serviceVisit.findMany({ where: { poolId: pool.id }, orderBy: { id: 'asc' } });
    const current = await state();
    const request = { requestId: randomUUID(), expectedVersion: current.version, expectedClientVersion: current.clients.find(c => c.id === clients[2].id).version, clientId: clients[2].id, technicalSheet: { filterBrandModel: 'Atomic ' + table }, name: 'Atomic ' + table };
    failureTable = table;
    await prisma.$executeRawUnsafe("CREATE FUNCTION qa_pool_edit_receipt_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA mandatory pool edit receipt failed'; END $$");
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_pool_edit_receipt_fail BEFORE INSERT ON "' + table + '" FOR EACH ROW EXECUTE FUNCTION qa_pool_edit_receipt_fail()');
    try { const failed = await send(request); assert.equal(failed.status, 500, JSON.stringify(failed)); assert(!JSON.stringify(failed.body).includes('QA mandatory')); assert.deepEqual(await row(), before); assert.deepEqual(await counts(), countBefore); assert.deepEqual(await prisma.serviceVisit.findMany({ where: { poolId: pool.id }, orderBy: { id: 'asc' } }), visitsBefore); }
    finally { await dropTrigger(); }
    assert.equal((await send(request)).status, 200);
  }
  const current = await state(), prior = await row(), beforeInvalid = await counts();
  for (const body of [{ requestId: randomUUID(), name: 'Missing version' }, { expectedVersion: current.version, name: 'Missing UUID' },
    { requestId: randomUUID(), expectedVersion: current.version, clientId: clients[2].id }, { requestId: randomUUID(), expectedVersion: current.version, clientId: clients[2].id, expectedClientVersion: current.version },
    { requestId: randomUUID(), expectedVersion: current.version, actor: 'FORGED', name: 'Spoof' }, { requestId: randomUUID(), expectedVersion: current.version, technicalSheet: { unknown: 1 } },
    { requestId: randomUUID(), expectedVersion: current.version, monthlyAmount: 'NaN' }, { requestId: randomUUID(), expectedVersion: current.version, monthlyAmount: -1 }]) assert.equal((await send(body)).status, 400);
  assert.deepEqual(await row(), prior); assert.deepEqual(await counts(), beforeInvalid);
  const forbidden = { requestId: randomUUID(), expectedVersion: current.version, name: 'Denied' };
  assert.equal((await send(forbidden, { token: '' })).status, 401); assert.equal((await send(forbidden, { token: jwt.sign({ id: clients[0].id, role: 'CLIENT' }, getJwtSecret(), { expiresIn: '1h' }) })).status, 403);
  assert.equal((await send({ notes: 'Legacy edit' })).status, 200); assert.equal((await send(forbidden)).body.code, 'POOL_VERSION_CONFLICT');
  const archive = await state(); await prisma.pool.update({ where: { id: pool.id }, data: { active: false, archiveStatus: 'ARQUIVADO', deletedAt: new Date() } });
  assert.equal((await send({ ...forbidden, expectedVersion: archive.version })).body.code, 'POOL_VERSION_CONFLICT'); assert.equal((await row()).active, false);
  console.log('PASS required history/receipt rollback, invalid requests, access checks, legacy edits and archive version changes');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await dropTrigger(); for (const child of children) await stop(child); await prisma.$disconnect(); });
