'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let failureTable, browser, child;
async function clearFailure() {
  if (!failureTable) return;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_proposal_write_fail ON "' + failureTable + '"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_proposal_write_fail()'); failureTable = null;
}
async function inject(table, type, proposalId = null) {
  assert(['TechnicalHistory', 'Notification'].includes(table));
  assert(/^[A-Z_]+$/.test(type)); failureTable = table;
  await prisma.$executeRawUnsafe("CREATE FUNCTION qa_proposal_write_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA proposal mandatory failure'; END $$");
  assert(proposalId === null || Number.isSafeInteger(proposalId));
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_proposal_write_fail BEFORE INSERT ON "' + table + '" FOR EACH ROW WHEN (NEW.type = \'' + type + '\'' + (proposalId ? " AND (NEW.description::jsonb->>'proposalId')::int = " + proposalId : '') + ') EXECUTE FUNCTION qa_proposal_write_fail()');
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'Proposal QA owner', active: true } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Proposal QA pool', monthlyAmount: 9876, equipment: { create: { pumpPower: '1 CV', notes: 'Equipment baseline' } } } });
  const technicians = await Promise.all(['Owner', 'Other'].map(name => prisma.technician.create({ data: { name: 'Proposal QA ' + name, active: true } })));
  const techTokens = technicians.map(tech => jwt.sign({ id: tech.id, role: 'TECHNICIAN' }, getJwtSecret(), { expiresIn: '1h' }));
  for (const tech of technicians) await prisma.serviceVisit.create({ data: { poolId: pool.id, clientId: client.id, technicianId: tech.id, plannedDate: new Date(), status: 'PLANNED' } });
  const call = async (path = '', body, credential = token, target = pool.id, host = base) => {
    const response = await fetch(host + '/api/core/pools/' + target + '/technical-change-proposals' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json', 'x-user-email': 'FORGED HEADER' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const records = () => prisma.technicalHistory.findMany({ where: { poolId: pool.id }, orderBy: { id: 'asc' } });
  const notices = () => prisma.notification.findMany({ where: { metadata: { path: ['poolId'], equals: pool.id } }, orderBy: { id: 'asc' } });
  const proposal = { reason: 'Measured pump power', changes: [{ field: 'pumpPower', before: '1 CV', after: '1.5 CV' }], actor: 'FORGED BODY' };
  for (const [table, type] of [['TechnicalHistory', 'TECHNICAL_CHANGE_PROPOSAL'], ['TechnicalHistory', 'TECHNICAL_PROPOSAL_WORKFLOW_EVENT'], ['TechnicalHistory', 'TECHNICAL_SHEET_PROPAGATION_EVENT'], ['Notification', 'TECHNICAL_SHEET_PROPOSAL'], ['Notification', 'TECHNICAL_SHEET_PROPAGATION']]) {
    await inject(table, type);
    try {
      const result = await call('', proposal); assert.equal(result.status, 500, JSON.stringify(result));
      assert(!JSON.stringify(result).includes('QA proposal mandatory failure')); assert.deepEqual(await records(), []); assert.deepEqual(await notices(), []);
    } finally { await clearFailure(); }
  }
  console.log('PASS failed creation rolls back proposal, initial event, propagation and both mandatory notices');
  const create = async (extra = {}, credential = token) => { const result = await call('', { ...proposal, ...extra }, credential); assert.equal(result.status, 201, JSON.stringify(result)); return result.body.proposal; };
  const owned = await create({ asDraft: true }, techTokens[0]);
  assert.equal(owned.creatorKey, 'TECHNICIAN:' + technicians[0].id); assert.equal(owned.creatorTechnicianId, technicians[0].id); assert(!JSON.stringify(owned).includes('FORGED'));
  assert.deepEqual((await call('', undefined, techTokens[1])).body.proposals, []);
  for (const suffix of ['/diff', '/history']) assert.equal((await call('/' + owned.id + suffix, undefined, techTokens[1])).status, 404);
  assert.equal((await call('/' + owned.id + '/workflow', { nextStatus: 'SUBMITTED' }, techTokens[1])).status, 404);
  assert.equal((await call('/' + owned.id + '/workflow', { nextStatus: 'SUBMITTED' }, techTokens[0])).status, 200);
  assert.equal((await call('/' + owned.id + '/workflow', { nextStatus: 'APPROVED' }, techTokens[0])).status, 403);
  const outside = await prisma.pool.create({ data: { clientId: client.id, name: 'Unassigned proposal pool' } });
  for (const body of [undefined, proposal]) assert.equal((await call('', body, techTokens[0], outside.id)).status, 403);
  const finance = await create({ changes: [{ field: 'monthlyAmount', before: '9876', after: '9999' }], riskLevel: 'LOW' }); assert.equal(finance.riskLevel, 'HIGH');
  assert.equal((await call('', { ...proposal, changes: [{ field: 'monthlyAmount', after: '1' }] }, techTokens[0])).status, 400);
  assert(!JSON.stringify((await call('', undefined, techTokens[0])).body).includes('9876'));
  for (const extra of [{ changes: [{ field: 'password', after: 'secret' }] }, { changes: [proposal.changes[0], proposal.changes[0]] }, { photos: ['javascript:alert(1)'] }, { photos: ['//bad.example/x'] }, { reason: '' }, { asDraft: 'maybe' }, { changes: [{ field: 'pumpPower', after: {} }] }]) assert.equal((await call('', { ...proposal, ...extra })).status, 400);
  assert.equal((await call('', proposal, '')).status, 401);
  console.log('PASS authenticated ownership, assigned pools, technician financial privacy, risk floor and invalid input');

  for (const [table, type] of [['TechnicalHistory', 'TECHNICAL_PROPOSAL_WORKFLOW_EVENT'], ['TechnicalHistory', 'TECHNICAL_SHEET_PROPAGATION_EVENT'], ['Notification', 'TECHNICAL_SHEET_PROPOSAL_WORKFLOW'], ['Notification', 'TECHNICAL_SHEET_PROPAGATION']]) {
    const before = await records(), noticesBefore = await notices(); await inject(table, type);
    try { const result = await call('/' + owned.id + '/workflow', { nextStatus: 'APPROVED' }); assert.equal(result.status, 500, JSON.stringify(result)); assert.deepEqual(await records(), before); assert.deepEqual(await notices(), noticesBefore); } finally { await clearFailure(); }
  }
  const current = (await call()).body.proposals.find(p => p.id === owned.id);
  child = require('node:child_process').fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const second = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA process startup timed out')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve('http://127.0.0.1:' + port); }); });
  const concurrent = await Promise.all(['IN_REVIEW', 'NEEDS_INFO'].map((nextStatus, i) => call('/' + owned.id + '/workflow', { nextStatus, note: 'Concurrent reviewer', expectedVersion: current.version }, token, pool.id, i ? second : base)));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]); assert.equal(concurrent.find(r => r.status === 409).body.code, 'TECHNICAL_PROPOSAL_VERSION_CONFLICT');
  const chain = (await call('/' + owned.id + '/history')).body.immutable; assert.equal(chain.chainValid, true); assert.equal(chain.totalEvents, 3); assert.equal(chain.events[0].actorKey, owned.creatorKey);
  const fresh = (await call()).body.proposals.find(p => p.id === owned.id);
  if (fresh.status === 'NEEDS_INFO') assert.equal((await call('/' + owned.id + '/workflow', { nextStatus: 'IN_REVIEW' })).status, 200);
  assert.equal((await call('/' + owned.id + '/workflow', { nextStatus: 'APPROVED' })).status, 200);
  const notice = (await notices()).find(n => n.eventType === 'TECHNICAL_SHEET_PROPOSAL_APPROVED'); assert.equal(notice.role, 'TECHNICIAN'); assert.equal(notice.metadata.technicianId, technicians[0].id);
  const otherNotices = await (await fetch(base + '/api/notifications', { headers: { Authorization: 'Bearer ' + techTokens[1] } })).json(); assert(!JSON.stringify(otherNotices).includes('"id":' + notice.id + ','));
  assert.equal((await prisma.poolEquipment.findUniqueOrThrow({ where: { poolId: pool.id } })).pumpPower, '1 CV', 'Workflow records a decision; it does not silently apply values');
  console.log('PASS workflow rollback, serialized reviews, stale-version conflict, valid chain and private recipient');

  const baseline = await create({ changes: [{ field: 'equipmentNotes', after: 'New equipment note' }, { field: 'technicalRoomNotes', after: 'First room note' }] });
  assert.equal(baseline.changes[0].before, 'Equipment baseline'); assert.equal(baseline.changes[1].before, null);
  await prisma.technicalRoom.create({ data: { poolId: pool.id, notes: 'Another saved room note' } });
  assert.equal((await call('/' + baseline.id + '/diff')).body.diff[1].hasDrift, true);
  await prisma.technicalHistory.createMany({ data: Array.from({ length: 505 }, () => ({ poolId: pool.id, type: 'TECHNICAL_PROPOSAL_WORKFLOW_EVENT', description: '{"proposalId":2147483647}', status: 'SUBMITTED' })) });
  const late = await create(); assert.equal((await call('/' + late.id + '/workflow', { nextStatus: 'IN_REVIEW' })).status, 200);
  const lateHistory = (await call('/' + late.id + '/history')).body.immutable; assert.equal(lateHistory.chainValid, true); assert.equal(lateHistory.totalEvents, 2);
  await prisma.technicalHistory.createMany({ data: Array.from({ length: 105 }, () => ({ poolId: pool.id, type: 'TECHNICAL_CHANGE_PROPOSAL', status: 'REJECTED', description: '{"status":"REJECTED","lifecycle":"REJECTED"}' })) });
  assert((await call('?onlyPending=true')).body.proposals.some(p => p.id === baseline.id), 'Older pending proposals remain visible');
  const corrupt = await create(); const event = (await records()).find(r => r.type === 'TECHNICAL_PROPOSAL_WORKFLOW_EVENT' && JSON.parse(r.description).proposalId === corrupt.id);
  await prisma.technicalHistory.update({ where: { id: event.id }, data: { description: JSON.stringify({ ...JSON.parse(event.description), actor: 'Altered actor' }) } });
  assert.equal((await call('/' + corrupt.id + '/history')).body.immutable.chainValid, false);
  assert.equal((await call('/' + corrupt.id + '/workflow', { nextStatus: 'IN_REVIEW' })).body.code, 'TECHNICAL_PROPOSAL_HISTORY_CONFLICT');
  const legacy = await prisma.technicalHistory.create({ data: { poolId: pool.id, type: 'TECHNICAL_CHANGE_PROPOSAL', status: 'SUBMITTED', description: JSON.stringify({ ...proposal, actor: 'Historical name', actorRole: 'TECHNICIAN', status: 'SUBMITTED' }) } });
  assert.equal((await call('/' + legacy.id + '/history')).body.immutable.chainValid, false);
  assert.equal((await call('/' + legacy.id + '/workflow', { nextStatus: 'IN_REVIEW' })).status, 409);
  assert.equal((await call('/' + legacy.id + '/history', undefined, techTokens[0])).status, 404);
  console.log('PASS captured empty baseline, alias diff, more than 500 events/100 proposals and honest legacy/corrupt history');

  const first = await create(), failing = await create(), last = await create(); await inject('TechnicalHistory', 'TECHNICAL_PROPOSAL_WORKFLOW_EVENT', failing.id);
  let batch;
  try { batch = await call('/workflow/batch', { nextStatus: 'IN_REVIEW', proposalIds: [first.id, failing.id, last.id, 2147483647] }); } finally { await clearFailure(); }
  assert.equal(batch.status, 200); assert.equal(batch.body.ok, false); assert.deepEqual(batch.body.updated.map(p => p.id), [first.id, last.id]); assert.deepEqual(batch.body.failed.map(p => p.proposalId), [failing.id, 2147483647]);
  assert.deepEqual(batch.body.failed.map(p => p.status), [500, 404]); assert.equal((await prisma.technicalHistory.findUnique({ where: { id: failing.id } })).status, 'SUBMITTED');
  assert.equal((await call('/workflow/batch', { nextStatus: 'IN_REVIEW', proposalIds: [failing.id, 'bad'] })).status, 400);
  console.log('PASS each batch item rolls back independently and every committed/failed result is returned');

  await fetch(base + '/api/settings/language/me', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{"language":"pt"}' });
  browser = await require('playwright').chromium.launch({ headless: true, executablePath: process.env.CW_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'ADMIN' })); }, { token, id: admin.id });
  const page = await context.newPage(); page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/admin-pool-technical?poolId=' + pool.id, { waitUntil: 'networkidle' }); await page.waitForSelector('[data-proposal-select="' + failing.id + '"]');
  await page.locator('[data-proposal-select="' + failing.id + '"]').check(); await page.locator('[data-proposal-select="' + owned.id + '"]').check();
  await page.locator('#proposalBatchReviewBtn').click(); await page.waitForFunction(() => document.getElementById('proposalBatchStatus').textContent.includes('1 atualizada(s), 1 falha(s)') && !document.getElementById('proposalBatchReviewBtn').disabled);
  assert.equal(await page.locator('[data-proposal-select="' + owned.id + '"]').isChecked(), true); assert.equal(await page.locator('[data-proposal-select="' + failing.id + '"]').isChecked(), false);
  assert((await page.locator('#proposalBatchStatus').textContent()).includes('#' + owned.id));
  await page.locator('[data-proposal-select="' + owned.id + '"]').uncheck(); await page.locator('[data-proposal-select="' + baseline.id + '"]').check();
  const endpoint = base + '/api/core/pools/' + pool.id + '/technical-change-proposals/workflow/batch'; let release, calls = 0; const held = new Promise(resolve => { release = resolve; });
  await page.route(endpoint, async route => { calls++; const sent = route.request().postDataJSON(); assert(sent.expectedVersions[baseline.id]); await held; await route.continue(); });
  await page.locator('#proposalBatchReviewBtn').click(); await page.waitForFunction(() => document.getElementById('proposalBatchReviewBtn').disabled); await page.evaluate(() => runBatchTransition('IN_REVIEW')); release();
  await page.waitForFunction(() => !document.getElementById('proposalBatchReviewBtn').disabled); assert.equal(calls, 1); await page.unroute(endpoint);
  const malformed = await create(); await page.evaluate(() => loadTechnicalProposals()); await page.locator('[data-proposal-select="' + malformed.id + '"]').check();
  await page.route(endpoint, route => route.fulfill({ status: 200, json: { ok: true } })); await page.locator('#proposalBatchReviewBtn').click(); await page.waitForFunction(() => document.getElementById('proposalBatchStatus').textContent.includes('confirmação'));
  assert.equal(await page.locator('[data-proposal-select="' + malformed.id + '"]').isChecked(), true); await page.unroute(endpoint); assert.deepEqual(errors, []);
  console.log('PASS actual admin screen preserves failed batch items, sends reviewed versions, blocks repeated clicks and rejects malformed confirmations');

  const techContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await techContext.addInitScript(({ token, id }) => { for (const key of ['token', 'cristalwater_jwt']) localStorage.setItem(key, token); for (const key of ['user', 'cristalwater_user']) localStorage.setItem(key, JSON.stringify({ id, role: 'TECHNICIAN' })); localStorage.setItem('cwTechnicianId', String(id)); localStorage.setItem('cw_language', 'pt'); }, { token: techTokens[0], id: technicians[0].id });
  const field = await techContext.newPage(); field.setDefaultTimeout(10000);
  await field.goto(base + '/technician-field-mode?technicianId=' + technicians[0].id + '#docs', { waitUntil: 'networkidle' });
  await field.waitForFunction(() => document.getElementById('nextTitle').textContent.includes('Proposal QA pool'));
  await field.locator('[data-field-tab-button="docs"]').click();
  await field.locator('#proposalFieldName').fill('pumpPower'); await field.locator('#proposalAfterValue').fill('2 CV'); await field.locator('#proposalReason').fill('Real field measurement');
  const proposalEndpoint = base + '/api/core/pools/' + pool.id + '/technical-change-proposals';
  await field.route(proposalEndpoint, route => route.request().method() === 'POST' ? route.fulfill({ status: 201, json: { ok: true } }) : route.continue());
  await field.locator('#submitTechnicalProposalBtn').click(); await field.waitForFunction(() => document.getElementById('technicalProposalStatus').textContent.includes('Sem confirmação'));
  assert.equal(await field.locator('#proposalReason').inputValue(), 'Real field measurement'); await field.unroute(proposalEndpoint);
  let fieldRelease, fieldCalls = 0; const fieldHeld = new Promise(resolve => { fieldRelease = resolve; });
  await field.route(proposalEndpoint, async route => { if (route.request().method() === 'POST') { fieldCalls++; await fieldHeld; } await route.continue(); });
  await field.locator('[data-proposal-retry]').click(); assert.equal(await field.locator('#proposalReason').isDisabled(), true);
  await field.evaluate(() => document.getElementById('submitTechnicalProposalBtn').onclick()); fieldRelease();
  await field.waitForFunction(() => document.getElementById('technicalProposalStatus').textContent.includes('Pedido confirmado'));
  assert.equal(fieldCalls, 1); assert.equal(await field.locator('#proposalReason').inputValue(), '');
  assert.equal((await records()).filter(r => r.type === 'TECHNICAL_CHANGE_PROPOSAL' && JSON.parse(r.description).reason === 'Real field measurement').length, 1);
  console.log('PASS actual technician form keeps unconfirmed text, blocks repeat submission and only clears after an exact saved response');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (child && child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); await clearFailure(); await prisma.$disconnect(); });
