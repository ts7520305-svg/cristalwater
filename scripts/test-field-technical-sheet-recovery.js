'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const children = []; let injected = false;
async function start() {
  const child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); children.push(child);
  return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA startup timed out')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }); });
}
async function stop(child) { if (child.exitCode !== null) return; await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function cleanup() {
  if (!injected) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_sheet_receipt_fail ON "TechnicalSheetEditRequest"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_sheet_receipt_fail()'); injected = false;
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'Sheet recovery owner', password: 'Private recovery password', pin: 'Private recovery PIN' } });
  const pool = await prisma.pool.create({ data: { name: 'Sheet recovery', clientId: client.id, monthlyAmount: 95, volumeM3: 48,
    equipment: { create: { pumpType: 'Original pump' } }, technicalRoom: { create: { notes: 'Original room' } }, technicalSheet: { create: { volumeM3: 48 } },
    calculationProfile: { create: { lengthM: 8, widthM: 4, averageDepthM: 1.5, volumeM3: 48 } } } });
  const other = await prisma.pool.create({ data: { name: 'No related records', clientId: client.id } });
  const endpoint = id => '/api/core/pools/' + id + '/technical-sheet';
  const row = () => prisma.pool.findUniqueOrThrow({ where: { id: pool.id }, include: { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true } });
  const counts = async () => ({ history: await prisma.technicalHistory.count({ where: { poolId: pool.id } }), receipts: await prisma.technicalSheetEditRequest.count({ where: { poolId: pool.id } }), notices: await prisma.notification.count({ where: { type: 'TECHNICAL_SHEET_PROPAGATION', metadata: { path: ['poolId'], equals: pool.id } } }) });
  async function state(id = pool.id) { const response = await fetch(base + endpoint(id) + '/edit-state', { headers: { Authorization: 'Bearer ' + token } }); assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.scope, 'TECHNICAL_SHEET_EDIT'); assert.equal(result.poolId, id); assert.match(result.version, /^technical-sheet-v1:[0-9a-f]{64}$/); assert(!JSON.stringify(result).includes('Private recovery')); return result; }
  async function send(body, options = {}) { const response = await fetch((options.base || base) + endpoint(options.id || pool.id), { method: 'PUT', headers: { Authorization: 'Bearer ' + (options.token === undefined ? token : options.token), 'Content-Type': 'application/json', ...(options.drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; }
  let second = await start();
  const original = await state(), initial = await counts();
  const request = { requestId: randomUUID(), expectedVersion: original.version, lengthM: 10, pumpType: 'New pump', technicalRoomNotes: 'Room checked', historyNote: 'Add exactly once' };
  const concurrent = await Promise.all(Array.from({ length: 8 }, (_, i) => send(request, i % 2 ? { base: second } : {})));
  assert(concurrent.every(r => r.status === 200), JSON.stringify(concurrent)); assert.equal(concurrent.filter(r => !r.body.replayed).length, 1);
  const saved = concurrent.find(r => !r.body.replayed).body;
  assert.equal(saved.pool.volumeM3, 60); assert.equal(saved.pool.calculatedVolumeM3, 60); assert.equal(saved.pool.treatmentVolumeM3, 60); assert.equal(saved.pool.historyNote, null);
  assert.equal(saved.receipt.actorKey, 'USER:' + admin.id); assert.equal(saved.receipt.requestId, request.requestId); assert.equal(saved.receipt.scope, 'TECHNICAL_SHEET_EDIT'); assert(saved.noteHistoryId > 0);
  assert.deepEqual(await counts(), { history: initial.history + 3, receipts: initial.receipts + 1, notices: initial.notices + 1 });
  for (const result of concurrent) assert.deepEqual(result.body, { ...saved, replayed: result.body.replayed });
  assert.equal((await send({ ...request, historyNote: 'Different note' })).body.code, 'TECHNICAL_SHEET_REQUEST_REUSED');
  assert.equal((await send(request, { id: other.id })).body.code, 'TECHNICAL_SHEET_REQUEST_REUSED');
  await prisma.pool.update({ where: { id: pool.id }, data: { name: 'Later edit', archiveStatus: 'ARQUIVADO' } });
  await prisma.technicalHistory.deleteMany({ where: { id: { in: [saved.historyId, saved.noteHistoryId, saved.propagation.historyId] } } });
  assert.deepEqual((await send({ ...request, requestId: request.requestId.toUpperCase() })).body, { ...saved, replayed: true }); assert.equal((await row()).name, 'Later edit');
  console.log('PASS two processes and eight identical requests create one history, note, notification and durable receipt; immutable replay survives later edits, archive and history deletion');

  const competitionBase = await state();
  const competition = await Promise.all([send({ requestId: randomUUID(), expectedVersion: competitionBase.version, name: 'Window A' }), send({ requestId: randomUUID(), expectedVersion: competitionBase.version, notes: 'Window B' }, { base: second })]);
  assert.deepEqual(competition.map(r => r.status).sort(), [200, 409]);
  for (const model of ['technicalSheet', 'poolEquipment', 'technicalRoom', 'poolCalculationProfile']) {
    const before = await state(), relation = await prisma[model].findUniqueOrThrow({ where: { poolId: pool.id } });
    await prisma[model].update({ where: { poolId: pool.id }, data: { ...(model === 'technicalSheet' ? { specialObservations: randomUUID() } : { notes: randomUUID() }), updatedAt: relation.updatedAt } });
    const unchanged = await row(), count = await counts(); const rejected = await send({ requestId: randomUUID(), expectedVersion: before.version, historyNote: 'Stale' });
    assert.equal(rejected.status, 409); assert.equal(rejected.body.code, 'TECHNICAL_SHEET_VERSION_CONFLICT'); assert.deepEqual(await row(), unchanged); assert.deepEqual(await counts(), count);
  }
  let before = await state(), count = await counts();
  const note = await send({ requestId: randomUUID(), expectedVersion: before.version, historyNote: 'A deliberate note' }); assert.equal(note.status, 200); assert.notEqual(note.body.version, before.version);
  const repeatedNote = await send({ requestId: randomUUID(), expectedVersion: note.body.version, historyNote: 'A deliberate note' }); assert.equal(repeatedNote.status, 200); assert.notEqual(repeatedNote.body.noteHistoryId, note.body.noteHistoryId);
  console.log('PASS competing versions, all four technical components including unchanged timestamps, and distinct deliberate notes');

  before = await state(); const unchanged = await row(); count = await counts();
  await prisma.$executeRawUnsafe("CREATE FUNCTION qa_sheet_receipt_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA receipt unavailable'; END $$"); injected = true;
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_sheet_receipt_fail BEFORE INSERT ON "TechnicalSheetEditRequest" FOR EACH ROW EXECUTE FUNCTION qa_sheet_receipt_fail()');
  const retryRequest = { requestId: randomUUID(), expectedVersion: before.version, lengthM: 11, equipmentNotes: 'Must roll back', technicalRoomNotes: 'Also roll back', historyNote: 'Rollback note' };
  try { const failed = await send(retryRequest); assert.equal(failed.status, 500); assert(!JSON.stringify(failed).includes('QA receipt unavailable')); assert.deepEqual(await row(), unchanged); assert.deepEqual(await counts(), count); } finally { await cleanup(); }
  await assert.rejects(send(retryRequest, { base: second, drop: true }));
  assert.deepEqual(await counts(), { history: count.history + 3, receipts: count.receipts + 1, notices: count.notices + 1 });
  await stop(children.at(-1)); second = await start(); const restarted = await send(retryRequest, { base: second }); assert.equal(restarted.status, 200); assert.equal(restarted.body.replayed, true);
  assert.equal(restarted.body.pool.volumeM3, 66);
  console.log('PASS mandatory receipt failure rolls everything back; dropped response and process restart confirm the original request without repeated effects');

  before = await state(); count = await counts();
  for (const extra of [{ requestId: 'bad' }, { expectedVersion: 'bad' }, { actor: 'FORGED' }, { clientId: client.id }, { volumeM3: 7 }, { monthlyAmount: -1 }, { saltSystem: 'not boolean' }]) assert.equal((await send({ requestId: randomUUID(), expectedVersion: before.version, name: 'Invalid', ...extra })).status, 400);
  assert.equal((await send({ requestId: randomUUID(), expectedVersion: before.version, name: 'No session' }, { token: '' })).status, 401); assert.deepEqual(await counts(), count);
  const bare = await state(other.id), created = await send({ requestId: randomUUID(), expectedVersion: bare.version, lengthM: 8, widthM: 4, depthMinM: 1, depthMaxM: 2, pumpType: 'First equipment' }, { id: other.id });
  assert.equal(created.status, 200); assert.equal(created.body.pool.volumeM3, 48); assert.equal(created.body.pool.averageDepthM, 1.5); assert.equal(created.body.pool.targetSalinityPpm, bare.pool.targetSalinityPpm); assert.equal(created.body.pool.saltSystem, bare.pool.saltSystem);
  await prisma.poolCalculationProfile.update({ where: { poolId: other.id }, data: { shape: 'CIRCULAR', diameterM: 4, shapeFactor: 0.8 } });
  const circular = await state(other.id), circle = await send({ requestId: randomUUID(), expectedVersion: circular.version, averageDepthM: 2 }, { id: other.id }); assert.equal(circle.body.pool.volumeM3, 20.1);
  const read = await (await fetch(base + endpoint(pool.id), { headers: { Authorization: 'Bearer ' + token } })).json(); assert(!JSON.stringify(read).includes('Private recovery'));
  console.log('PASS strict guarded fields, authorization, credential-free reads, absent-component defaults, derived average depth and circular volume');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanup(); for (const child of children) await stop(child); await prisma.$disconnect(); });
