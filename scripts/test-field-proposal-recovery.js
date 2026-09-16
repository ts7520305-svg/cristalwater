'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const children = []; let failureTable;
async function start() {
  const child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); children.push(child);
  return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA startup timed out')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve('http://127.0.0.1:' + port); }); });
}
async function stop(child) { if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function clearFailure() {
  if (!failureTable) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_proposal_receipt_fail ON "' + failureTable + '"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_proposal_receipt_fail()'); failureTable = null;
}
async function inject(table, value) {
  assert(['TechnicalProposalRequest', 'TechnicalHistory', 'Notification'].includes(table)); assert(/^[A-Z_]+$/.test(value)); failureTable = table;
  await prisma.$executeRawUnsafe("CREATE FUNCTION qa_proposal_receipt_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA mandatory proposal receipt failure'; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_proposal_receipt_fail BEFORE ' + (value === 'BATCH' ? 'UPDATE' : 'INSERT') + ' ON "' + table + '" FOR EACH ROW WHEN (NEW.' + (table === 'TechnicalProposalRequest' ? 'action' : 'type') + " = '" + value + "') EXECUTE FUNCTION qa_proposal_receipt_fail()");
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const tech = await prisma.technician.create({ data: { name: 'Proposal recovery technician', active: true } });
  const techToken = jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'Proposal recovery owner', creditBalance: 32, contractActive: true } });
  const pool = await prisma.pool.create({ data: { name: 'Proposal recovery pool', clientId: client.id, monthlyAmount: 145, volumeM3: 48,
    technicalSheet: { create: { volumeM3: 48 } }, equipment: { create: { pumpPower: '1 CV', notes: 'Original equipment' } }, technicalRoom: { create: { notes: 'Original room' } },
    calculationProfile: { create: { lengthM: 8, widthM: 4, averageDepthM: 1.5, volumeM3: 48 } } } });
  await prisma.serviceVisit.create({ data: { poolId: pool.id, technicianId: tech.id, plannedDate: new Date(), status: 'PLANNED' } });
  const prefix = '/api/core/pools/' + pool.id + '/technical-change-proposals';
  const call = async (path, body, options = {}) => { const response = await fetch((options.base || base) + prefix + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + (options.token ?? token), 'Content-Type': 'application/json', ...(options.drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, body: await response.json() }; };
  const counts = async () => ({ history: await prisma.technicalHistory.count({ where: { poolId: pool.id } }), notices: await prisma.notification.count({ where: { metadata: { path: ['poolId'], equals: pool.id } } }), receipts: await prisma.technicalProposalRequest.count({ where: { poolId: pool.id } }) });
  const snapshot = async () => ({ pool: await prisma.pool.findUniqueOrThrow({ where: { id: pool.id }, include: { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true } }), history: await prisma.technicalHistory.findMany({ where: { poolId: pool.id }, orderBy: { id: 'asc' } }), counts: await counts() });
  const createBody = () => ({ requestId: randomUUID(), reason: 'Measured proposal', changes: [{ field: 'pumpPower', before: '1 CV', after: '1.5 CV' }], photos: [] });
  let second = await start(); const request = createBody(), before = await counts();
  const creations = await Promise.all(Array.from({ length: 8 }, (_, i) => call('', request, { base: i % 2 ? second : base, token: techToken })));
  assert(creations.every(r => r.status === 201)); assert.equal(creations.filter(r => !r.body.replayed).length, 1); const created = creations[0].body;
  assert.equal(created.receipt.actorKey, 'TECHNICIAN:' + tech.id); assert.equal(created.receipt.action, 'CREATE'); assert.equal(created.receipt.requestId, request.requestId);
  assert.deepEqual(await counts(), { history: before.history + 3, notices: before.notices + 2, receipts: before.receipts + 1 });
  for (const item of creations) assert.deepEqual(item.body, { ...created, replayed: item.body.replayed });
  assert.equal((await call('', { ...request, reason: 'Changed intent' }, { token: techToken })).body.code, 'TECHNICAL_PROPOSAL_REQUEST_REUSED');
  await inject('TechnicalProposalRequest', 'CREATE'); const rollback = await snapshot();
  try { assert.equal((await call('', createBody())).status, 500); assert.deepEqual(await snapshot(), rollback); } finally { await clearFailure(); }
  const dropped = createBody(); await assert.rejects(call('', dropped, { base: second, drop: true })); const committedCounts = await counts(); await stop(children.at(-1)); second = await start();
  const recovered = await call('', dropped, { base: second }); assert.equal(recovered.status, 201); assert.equal(recovered.body.replayed, true); assert.deepEqual(await counts(), committedCounts);
  console.log('PASS creation across two processes, immutable receipts, failed receipt rollback, response loss and restart');

  const id = created.proposal.id, decision = { requestId: randomUUID(), expectedVersion: created.proposal.version, nextStatus: 'IN_REVIEW', note: 'Reviewed once' };
  const decisions = await Promise.all(Array.from({ length: 6 }, (_, i) => call('/' + id + '/workflow', decision, { base: i % 2 ? second : base })));
  assert(decisions.every(r => r.status === 200)); assert.equal(decisions.filter(r => !r.body.replayed).length, 1); assert.equal((await call('/' + id + '/history')).body.immutable.totalEvents, 2);
  assert.equal((await call('/' + id + '/workflow', { ...decision, requestId: randomUUID() })).status, 409);
  assert.equal((await call('/' + id + '/workflow', { ...decision, note: 'Different' })).body.code, 'TECHNICAL_PROPOSAL_REQUEST_REUSED');
  const approve = await call('/' + id + '/workflow', { requestId: randomUUID(), nextStatus: 'APPROVED', expectedVersion: decisions[0].body.proposal.version }); assert.equal(approve.status, 200);
  assert.equal((await call('/' + id + '/workflow', decision)).body.proposal.status, 'IN_REVIEW');
  const pairs = []; for (let i = 0; i < 2; i++) pairs.push((await call('', createBody())).body.proposal);
  const batch = { requestId: randomUUID(), nextStatus: 'IN_REVIEW', proposalIds: pairs.map(p => p.id), expectedVersions: Object.fromEntries(pairs.map(p => [p.id, p.version])) };
  await inject('TechnicalProposalRequest', 'BATCH');
  try { assert.equal((await call('/workflow/batch', batch)).status, 500); } finally { await clearFailure(); }
  const afterItems = await counts();
  const concurrentBatches = await Promise.all(Array.from({ length: 6 }, (_, i) => call('/workflow/batch', batch, { base: i % 2 ? second : base })));
  assert(concurrentBatches.every(item => item.status === 200 && item.body.updatedCount === 2)); assert.equal(concurrentBatches.filter(item => !item.body.replayed).length, 1);
  for (const item of concurrentBatches) assert.deepEqual(item.body, { ...concurrentBatches[0].body, replayed: item.body.replayed });
  assert.deepEqual(await counts(), afterItems); assert.equal((await call('/workflow/batch', batch)).body.replayed, true);
  console.log('PASS decisions replay their original result and interrupted batches recover committed items without repeating them');

  const incompatible = (await call('', { requestId: randomUUID(), reason: 'Conflicting explicit volume', changes: [{ field: 'lengthM', before: 8, after: 10 }, { field: 'volumeM3', before: 48, after: 999 }] })).body.proposal;
  await call('/' + incompatible.id + '/workflow', { requestId: randomUUID(), nextStatus: 'APPROVED', expectedVersion: incompatible.version });
  const incompatiblePreview = await call('/' + incompatible.id + '/application-preview'); assert.equal(incompatiblePreview.body.canApply, false); assert(incompatiblePreview.body.fields.find(field => field.field === 'volumeM3').hasDerivedConflict);
  const keptVolume = await call('/' + incompatible.id + '/application-preview', { resolutions: { lengthM: 'PROPOSED', volumeM3: 'CURRENT' } }); assert.equal(keptVolume.body.canApply, false);
  const keptDimensions = await call('/' + incompatible.id + '/application-preview', { resolutions: { lengthM: 'CURRENT', volumeM3: 'PROPOSED' } }); assert.equal(keptDimensions.body.canApply, true); assert.equal(keptDimensions.body.effects.find(e => e.field === 'volumeM3').after, 999);
  assert.equal((await call('/' + incompatible.id + '/apply', { requestId: randomUUID(), expectedVersion: incompatiblePreview.body.version, expectedSheetVersion: incompatiblePreview.body.sheetVersion, expectedEffectsHash: incompatiblePreview.body.effectsHash, resolutions: incompatiblePreview.body.resolutions })).status, 400);
  console.log('PASS calculated values cannot silently override explicit choices of volume or dimensions');

  const applicationRequest = { requestId: randomUUID(), reason: 'Dimensions and equipment verified', changes: [
    { field: 'lengthM', before: '8', after: '10' }, { field: 'equipmentNotes', before: 'Original equipment', after: 'New equipment' },
    { field: 'technicalRoomNotes', before: 'Original room', after: 'Proposed room' }, { field: 'saltSystem', before: 'false', after: 'true' }, { field: 'historyNote', after: 'One application note' },
  ] };
  const applicationProposal = (await call('', applicationRequest, { token: techToken })).body.proposal;
  const approved = await call('/' + applicationProposal.id + '/workflow', { requestId: randomUUID(), nextStatus: 'APPROVED', expectedVersion: applicationProposal.version }); assert.equal(approved.status, 200);
  await prisma.technicalRoom.update({ where: { poolId: pool.id }, data: { notes: 'Later room observation' } });
  const path = '/' + applicationProposal.id;
  const preview = await call(path + '/application-preview'); assert.equal(preview.status, 200); assert.equal(preview.body.canApply, false); assert(preview.body.fields.find(f => f.field === 'technicalRoomNotes').hasDrift);
  const resolutions = Object.fromEntries(preview.body.fields.map(f => [f.field, f.field === 'technicalRoomNotes' ? 'CURRENT' : 'PROPOSED']));
  const body = { requestId: randomUUID(), expectedVersion: preview.body.version, expectedSheetVersion: preview.body.sheetVersion, resolutions };
  const reviewed = await call(path + '/application-preview', { expectedVersion: body.expectedVersion, expectedSheetVersion: body.expectedSheetVersion, resolutions }); assert.equal(reviewed.status, 200); assert.equal(reviewed.body.canApply, true); body.expectedEffectsHash = reviewed.body.effectsHash; assert.equal(reviewed.body.effects.find(e => e.field === 'volumeM3').after, 60);
  assert.equal((await call(path + '/application-preview', undefined, { token: techToken })).status, 403); assert.equal((await call(path + '/apply', body, { token: techToken })).status, 403);
  assert.equal((await call(path + '/apply', { ...body, requestId: undefined })).status, 400);
  assert.equal((await call(path + '/apply', { ...body, expectedEffectsHash: 'unreviewed' })).status, 409);
  assert.equal((await call(path + '/apply', { ...body, resolutions: { ...resolutions, password: 'PROPOSED' } })).status, 400);
  for (const [table, value] of [['TechnicalHistory', 'TECHNICAL_SHEET_CHANGE'], ['TechnicalHistory', 'TECHNICAL_SHEET_NOTE'], ['TechnicalHistory', 'TECHNICAL_PROPOSAL_WORKFLOW_EVENT'], ['Notification', 'TECHNICAL_SHEET_PROPAGATION'], ['Notification', 'TECHNICAL_SHEET_PROPOSAL_WORKFLOW'], ['TechnicalProposalRequest', 'APPLY']]) {
    const state = await snapshot(); await inject(table, value);
    try { const failed = await call(path + '/apply', body); assert.equal(failed.status, 500, JSON.stringify(failed)); assert(!JSON.stringify(failed).includes('QA mandatory')); assert.deepEqual(await snapshot(), state); } finally { await clearFailure(); }
  }
  const oldSheet = await prisma.poolEquipment.findUniqueOrThrow({ where: { poolId: pool.id } });
  await prisma.poolEquipment.update({ where: { poolId: pool.id }, data: { pumpPower: 'New observation', updatedAt: oldSheet.updatedAt } });
  const unchanged = await snapshot(); assert.equal((await call(path + '/apply', body)).body.code, 'TECHNICAL_PROPOSAL_APPLICATION_CONFLICT'); assert.deepEqual(await snapshot(), unchanged);
  const latest = await call(path + '/application-preview'); body.expectedSheetVersion = latest.body.sheetVersion;
  await assert.rejects(call(path + '/apply', body, { base: second, drop: true })); const once = await snapshot();
  const applies = await Promise.all(Array.from({ length: 6 }, (_, i) => call(path + '/apply', body, { base: i % 2 ? second : base })));
  assert(applies.every(r => r.status === 200 && r.body.replayed)); const applied = applies[0].body; assert.equal(applied.proposal.status, 'APPLIED'); assert.equal(applied.proposal.decisionOnly, false);
  assert.equal(once.pool.volumeM3, 60); assert.equal(once.pool.technicalSheet.volumeM3, 60); assert.equal(once.pool.calculationProfile.volumeM3, 60); assert.equal(once.pool.equipment.saltSystem, true);
  assert.equal(once.pool.equipment.notes, 'New equipment'); assert.equal(once.pool.technicalRoom.notes, 'Later room observation'); assert.equal(once.pool.monthlyAmount, 145);
  assert.equal(once.history.filter(h => h.type === 'TECHNICAL_SHEET_NOTE').length, 1); assert.deepEqual(await snapshot(), once);
  assert.equal((await call(path + '/history')).body.immutable.chainValid, true); assert.equal((await call(path + '/apply', { ...body, requestId: randomUUID() })).status, 409);
  const owner = await prisma.client.findUniqueOrThrow({ where: { id: client.id } }); assert.equal(owner.creditBalance, 32); assert.equal(owner.contractActive, true);
  await prisma.technicalHistory.deleteMany({ where: { id: { in: [applicationProposal.id, applied.application.historyId] } } });
  await prisma.pool.update({ where: { id: pool.id }, data: { name: 'Later pool edit' } });
  assert.deepEqual((await call(path + '/apply', body)).body, applied);
  assert.deepEqual((await call('', applicationRequest, { token: techToken })).body.proposal, applicationProposal);
  console.log('PASS typed preview, explicit drift choices, derived volume, all application writes/receipt rollback, stale component version and immutable application replay');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await clearFailure(); for (const child of children) await stop(child); await prisma.$disconnect(); });
