'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const children = []; let triggerTable;
async function start() {
  const child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); children.push(child);
  return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA startup timed out')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }); });
}
async function stop(child) { if (child.exitCode !== null) return; await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function dropTrigger() {
  if (!triggerTable) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_client_edit_receipt_fail ON "' + triggerTable + '"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_client_edit_receipt_fail()'); triggerTable = null;
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const oldHash = await bcrypt.hash('Initial-QA-password', 4);
  const client = await prisma.client.create({ data: { name: 'Client edit recovery QA', active: true, status: 'ACTIVE', contractActive: true, billingActive: true,
    password: oldHash, pin: await bcrypt.hash('4321', 4), email: 'recovery@edit.test', creditBalance: 25.75 } });
  const other = await prisma.client.create({ data: { name: 'Other edit QA', active: true } });
  const actorKey = 'USER:' + admin.id;
  const row = () => prisma.client.findUniqueOrThrow({ where: { id: client.id } });
  const counts = async () => ({ audits: await prisma.userAuditLog.count({ where: { entity: 'Client', entityId: String(client.id), action: 'CLIENT_UPDATED' } }), requests: await prisma.clientEditRequest.count({ where: { clientId: client.id } }) });
  async function send(body, options = {}) {
    const response = await fetch((options.base || base) + (options.alias || '/api/core/clients') + '/' + (options.id || client.id), {
      method: 'PUT', headers: { Authorization: 'Bearer ' + (options.token === undefined ? token : options.token), 'Content-Type': 'application/json', ...(options.drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  async function state(alias = '/api/core/clients') {
    const response = await fetch(base + alias + '/' + client.id + '/edit-state', { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status, 200); const value = await response.json();
    assert.equal(value.ok, true); assert.equal(value.scope, 'CLIENT_EDIT'); assert.equal(value.clientId, client.id); assert.equal(value.client.id, client.id);
    assert.match(value.version, /^client-v1:[0-9a-f]{64}$/); assert(!('password' in value.client)); assert(!('pin' in value.client)); return value;
  }
  let second = await start();
  let original;
  for (const alias of ['/api/core/clients', '/api/clients']) {
    const snapshot = await state(alias), before = await counts();
    const request = { requestId: randomUUID(), expectedVersion: snapshot.version, name: 'Guarded ' + alias };
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, index) => send(request, index % 2 ? { base: second, alias: '/api/clients' } : { alias })));
    assert(attempts.every(result => result.status === 200), JSON.stringify(attempts));
    assert.equal(attempts.filter(result => !result.body.replayed).length, 1);
    original = attempts.find(result => !result.body.replayed).body;
    assert.equal(original.receipt.scope, 'CLIENT_EDIT'); assert.equal(original.receipt.actorKey, actorKey);
    assert.equal(original.receipt.requestId, request.requestId); assert.equal(original.receipt.expectedVersion, snapshot.version);
    assert.equal(original.version, original.receipt.version); assert.equal((await state()).version, original.version);
    assert.deepEqual(await counts(), { audits: before.audits + 1, requests: before.requests + 1 });
    for (const result of attempts) assert.deepEqual(result.body, { ...original, replayed: result.body.replayed });
    assert.equal((await send({ ...request, name: 'Wrong contents' })).status, 409);
    assert.equal((await send(request, { id: other.id })).status, 409);
    const stale = await send({ ...request, requestId: randomUUID(), notes: 'Must not overwrite' });
    assert.equal(stale.status, 409); assert.equal(stale.body.code, 'CLIENT_VERSION_CONFLICT');
    const immutable = await row(); await prisma.client.update({ where: { id: client.id }, data: { phone: 'Changed elsewhere' } });
    await prisma.userAuditLog.delete({ where: { id: original.receipt.auditId } });
    assert.deepEqual((await send({ ...request, requestId: request.requestId.toUpperCase() })).body, { ...original, replayed: true });
    assert.equal((await row()).phone, 'Changed elsewhere'); assert.equal((await row()).password, immutable.password);
  }
  console.log('PASS opaque versions, both APIs, two processes, one audit/receipt, stale rejection and immutable replay after later edits and audit deletion');
  const snapshot = await state();
  const competing = await Promise.all([send({ requestId: randomUUID(), expectedVersion: snapshot.version, name: 'Concurrent A' }), send({ requestId: randomUUID(), expectedVersion: snapshot.version, phone: 'Concurrent B' }, { base: second, alias: '/api/clients' })]);
  assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
  const password = 'New-QA-secret-' + randomUUID(), pin = '9876';
  const guarded = { requestId: randomUUID(), expectedVersion: (await state()).version, credentialIntent: { password: true, pin: true }, email: 'changed@edit.test' };
  const beforeMissing = await row(), countMissing = await counts();
  const missing = await send(guarded); assert.equal(missing.status, 428); assert.equal(missing.body.code, 'CLIENT_EDIT_CREDENTIAL_REQUIRED');
  assert.deepEqual(missing.body.fields, ['password', 'pin']); assert.deepEqual(await row(), beforeMissing); assert.deepEqual(await counts(), countMissing);
  await assert.rejects(send({ ...guarded, password, pin }, { base: second, alias: '/api/clients', drop: true }));
  const changed = await row(), afterSecretCounts = await counts();
  assert(await bcrypt.compare(password, changed.password)); assert(await bcrypt.compare(pin, changed.pin));
  const replay = await send(guarded); assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true);
  assert.deepEqual(await row(), changed); assert.deepEqual(await counts(), afterSecretCounts);
  assert.equal((await send({ ...guarded, password: 'Different secret' })).status, 409);
  assert.equal((await send({ ...guarded, pin: '0000' })).status, 409);
  assert.equal((await send({ ...guarded, password, pin })).body.replayed, true);
  const saved = await prisma.clientEditRequest.findUniqueOrThrow({ where: { actorKey_requestId: { actorKey, requestId: guarded.requestId } } });
  assert.match(saved.passwordProof, /^[0-9a-f]{64}$/); assert.match(saved.pinProof, /^[0-9a-f]{64}$/);
  const publicRecords = JSON.stringify({ response: saved.response, audits: await prisma.userAuditLog.findMany({ where: { entity: 'Client', entityId: String(client.id) } }) });
  for (const secret of [password, changed.password, changed.pin, oldHash, saved.passwordProof, saved.pinProof]) assert(!publicRecords.includes(secret));
  assert(!JSON.stringify(saved).includes(password));
  await stop(children.at(-1)); second = await start();
  assert.deepEqual((await send(guarded, { base: second, alias: '/api/clients' })).body, replay.body);
  console.log('PASS concurrent editors, lost response, credential re-entry only before commit, safe replay without secrets and recovery after process restart');
  for (const table of ['UserAuditLog', 'ClientEditRequest']) {
    const before = await row(), initial = await counts();
    const request = { requestId: randomUUID(), expectedVersion: (await state()).version, notes: 'Audit and receipt rollback', password: 'Rollback-' + randomUUID() };
    triggerTable = table;
    await prisma.$executeRawUnsafe("CREATE FUNCTION qa_client_edit_receipt_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA client edit mandatory write failed'; END $$");
    await prisma.$executeRawUnsafe('CREATE TRIGGER qa_client_edit_receipt_fail BEFORE INSERT ON "' + table + '" FOR EACH ROW EXECUTE FUNCTION qa_client_edit_receipt_fail()');
    try {
      const failed = await send(request); assert.equal(failed.status, 500); assert(!JSON.stringify(failed.body).includes('QA client edit'));
      assert.deepEqual(await row(), before); assert.deepEqual(await counts(), initial);
    } finally { await dropTrigger(); }
    assert.equal((await send(request)).status, 200);
  }
  const staleVersion = (await state()).version;
  assert.equal((await send({ zone: 'Legacy edit' })).status, 200);
  assert.equal((await send({ requestId: randomUUID(), expectedVersion: staleVersion, zone: 'Old form' })).status, 409);
  const snapshotBeforeRaw = await state(), rawRow = await row();
  await prisma.client.update({ where: { id: client.id }, data: { password: await bcrypt.hash('Another QA secret', 4), updatedAt: rawRow.updatedAt } });
  assert.notEqual((await state()).version, snapshotBeforeRaw.version, 'Version must cover credential changes even if a legacy writer preserves updatedAt');
  const fresh = await state(), prior = await row(), priorCount = await counts();
  for (const body of [{ requestId: randomUUID(), name: 'Missing version' }, { expectedVersion: fresh.version, name: 'Missing request' },
    { requestId: randomUUID(), expectedVersion: fresh.version, actor: 'FORGED', name: 'Wrong property' },
    { requestId: randomUUID(), expectedVersion: fresh.version, credentialIntent: { password: false }, password: 'Mismatch' },
    { requestId: randomUUID(), expectedVersion: fresh.version, monthlyFee: 'NaN' }]) assert.equal((await send(body)).status, 400);
  assert.deepEqual(await row(), prior); assert.deepEqual(await counts(), priorCount);
  const denied = { requestId: randomUUID(), expectedVersion: fresh.version, name: 'Not allowed' };
  assert.equal((await send(denied, { token: '' })).status, 401);
  assert.equal((await send(denied, { token: jwt.sign({ id: client.id, role: 'CLIENT' }, getJwtSecret(), { expiresIn: '1h' }) })).status, 403);
  await prisma.client.update({ where: { id: client.id }, data: { active: false, status: 'ARCHIVED', archiveStatus: 'ARQUIVADO' } });
  assert.equal((await send(denied)).status, 409); assert.equal((await row()).status, 'ARCHIVED');
  assert.equal((await row()).creditBalance, 25.75); assert.equal((await row()).contractActive, true); assert.equal((await row()).billingActive, true);
  console.log('PASS required audit/receipt rollback, invalid inputs, existing writer/version changes, authenticated access and preserved lifecycle/credit');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await dropTrigger(); for (const child of children) await stop(child); await prisma.$disconnect(); });
