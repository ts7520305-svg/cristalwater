'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID, createHash } = require('node:crypto'), { fork } = require('node:child_process');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const children = []; let triggerTable;
async function start() {
  const child = fork(require.resolve('./fixtures/internal-chat-server'), [], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }); children.push(child);
  return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('QA HTTP startup timed out')), 15000); child.once('error', reject); child.once('message', ({ port }) => { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }); });
}
async function stop(child) { if (child.exitCode !== null) return; await new Promise(resolve => { child.once('exit', resolve); child.kill(); }); }
async function dropTrigger() { if (!triggerTable) return; await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_portal_fail ON "${triggerTable}"`); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_portal_fail()'); triggerTable = null; }
(async () => {
  const client = await prisma.client.create({ data: { name: 'Portal requests QA', active: true, creditBalance: 17.35 } }), other = await prisma.client.create({ data: { name: 'Other portal requests QA', active: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = user => jwt.sign(user, getJwtSecret(), { expiresIn: '1h' });
  const token = sign({ id: client.id, clientId: client.id, role: 'CLIENT' }), otherToken = sign({ id: other.id, role: 'CLIENT' }), adminToken = sign({ id: admin.id, role: 'ADMIN' });
  const second = await start();
  async function call(kind, body, options = {}) {
    const path = `/api/client-portal/${options.clientId || client.id}/${kind === 'VISIT_REQUEST' ? 'visit-requests' : 'payment-notice'}`;
    const response = await fetch((options.base || base) + path, { method: 'POST', headers: { Authorization: `Bearer ${options.token === undefined ? token : options.token}`, 'Content-Type': 'application/json', ...(options.drop ? { 'x-cw-qa-drop-response': 'true' } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  await prisma.invoice.create({ data: { clientId: client.id, status: 'PARTIAL', total: 150.5, totalCents: 15050, amountOpen: 125.25, amountPaid: 25.25, payments: { create: { amount: 25.25, amountCents: 2525, method: 'MANUAL' } } } });
  const financialBefore = { payments: await prisma.payment.findMany({ orderBy: { id: 'asc' } }), invoices: await prisma.invoice.findMany({ orderBy: { id: 'asc' } }), visits: await prisma.serviceVisit.findMany({ orderBy: { id: 'asc' } }), credit: (await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).creditBalance };
  const count = async () => ({ messages: await prisma.clientMessage.count({ where: { clientId: client.id } }), notifications: await prisma.notification.count({ where: { clientId: client.id } }), logs: await prisma.communicationLog.count({ where: { clientId: client.id } }), receipts: await prisma.clientPortalRequest.count({ where: { clientId: client.id } }) });
  for (const kind of ['VISIT_REQUEST', 'PAYMENT_NOTICE']) {
    const data = kind === 'VISIT_REQUEST' ? { message: 'Preciso de visita <b>literal</b>' } : { amount: '123.45', method: 'MBWay', note: 'Comprovativo <b>literal</b>', channel: 'FORGED_CHANNEL', sender: 'ADMIN', clientId: other.id };
    const request = { ...data, requestId: randomUUID() }, before = await count();
    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) => call(kind, request, { base: index % 2 ? second : base })));
    assert(concurrent.every(result => [200, 201].includes(result.status)), JSON.stringify(concurrent));
    const original = concurrent.find(result => !result.body.replayed).body;
    assert.equal(concurrent.filter(result => !result.body.replayed).length, 1); assert.equal(new Set(concurrent.map(result => result.body.message.id)).size, 1);
    for (const [key, value] of Object.entries(await count())) assert.equal(value, before[key] + 1, key);
    assert.equal(original.receipt.actorKey, `CLIENT:${client.id}`); assert.equal(original.receipt.kind, kind); assert.equal(original.message.isReadByClient, true);
    assert.equal(original.receipt.payloadHash, createHash('sha256').update(JSON.stringify(original.submission)).digest('hex'));
    if (kind === 'PAYMENT_NOTICE') { assert.equal(original.submission.amountCents, 12345); assert.equal(original.submission.channel, 'PORTAL_CLIENTE'); assert.match(original.message.text, /Confirmar no financeiro antes de marcar como pago/); }
    await prisma.clientMessage.update({ where: { id: original.message.id }, data: { seen: true, isReadByAdmin: true } });
    await prisma.notification.delete({ where: { id: original.notification.id } });
    await prisma.client.update({ where: { id: client.id }, data: { name: `Renamed after ${kind}` } });
    const replay = await call(kind, { ...request, requestId: request.requestId.toUpperCase() }); assert.deepEqual(replay.body, { ...original, replayed: true });
    assert.equal((await call(kind, { ...request, ...(kind === 'VISIT_REQUEST' ? { message: 'Alterado' } : { amount: '123.46' }) })).status, 409);
    const opposite = kind === 'VISIT_REQUEST' ? 'PAYMENT_NOTICE' : 'VISIT_REQUEST';
    assert.equal((await call(opposite, { requestId: request.requestId, message: 'Outra operação' })).status, 409);
    assert.equal((await call(kind, request, { clientId: other.id })).status, 403);
    assert.equal((await call(kind, request, { token: adminToken })).status, 403);
    assert.equal((await call(kind, request, { token: '' })).status, 401);
    assert([200, 201].includes((await call(kind, request, { clientId: other.id, token: otherToken })).status));
    for (const id of ['', null, 123, 'bad']) assert.equal((await call(kind, { ...data, requestId: id })).status, 400);
    const lost = { ...data, requestId: randomUUID() };
    await assert.rejects(call(kind, lost, { base: second, drop: true }));
    const lostRow = await prisma.clientPortalRequest.findUniqueOrThrow({ where: { actorKey_requestId: { actorKey: `CLIENT:${client.id}`, requestId: lost.requestId } } });
    const recovered = await call(kind, lost); assert.equal(recovered.body.replayed, true); assert.equal(recovered.body.message.id, lostRow.response.message.id);
    console.log(`PASS ${kind}: two HTTP processes, concurrent requests, immutable receipt after notification deletion/read/name changes, conflicts, identity and lost response recovery`);
    for (const table of ['CommunicationLog', 'Notification', 'ClientPortalRequest']) {
      const initial = await count(), rollback = { ...data, requestId: randomUUID() };
      await prisma.$executeRawUnsafe(`CREATE FUNCTION qa_portal_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."clientId" = ${client.id} THEN RAISE EXCEPTION 'QA mandatory portal failure'; END IF; RETURN NEW; END $$`);
      await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_portal_fail BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_portal_fail()`); triggerTable = table;
      const failed = await call(kind, rollback); assert.equal(failed.status, 500); assert(!JSON.stringify(failed.body).includes('QA mandatory')); assert.deepEqual(await count(), initial);
      await dropTrigger();
      assert([200, 201].includes((await call(kind, rollback)).status));
    }
    assert([200, 201].includes((await call(kind, data)).status), 'Older callers remain compatible without replay guarantees');
  }
  for (const message of ['', ' ', null, {}, 3, 'x'.repeat(4001)]) assert.equal((await call('VISIT_REQUEST', { message, requestId: randomUUID() })).status, 400);
  for (const amount of [-1, '1.001', '1e2', {}, [], true, '100000000', 'NaN']) assert.equal((await call('PAYMENT_NOTICE', { amount, requestId: randomUUID() })).status, 400);
  for (const extra of [{ method: 'CREDIT' }, { method: {} }, { note: [] }, { note: 'x'.repeat(4001) }]) assert.equal((await call('PAYMENT_NOTICE', { ...extra, requestId: randomUUID() })).status, 400);
  const absent = await call('PAYMENT_NOTICE', { amount: 0, requestId: randomUUID() }); assert.equal(absent.body.submission.amountCents, null);
  const financialAfter = { payments: await prisma.payment.findMany({ orderBy: { id: 'asc' } }), invoices: await prisma.invoice.findMany({ orderBy: { id: 'asc' } }), visits: await prisma.serviceVisit.findMany({ orderBy: { id: 'asc' } }), credit: (await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).creditBalance };
  assert.deepEqual(financialAfter, financialBefore, 'Requests must not book visits, receive money or change invoice/credit balances');
  await prisma.client.update({ where: { id: client.id }, data: { active: false } });
  assert([401, 403].includes((await call('PAYMENT_NOTICE', { amount: 0, requestId: absent.body.receipt.requestId })).status));
  await prisma.client.update({ where: { id: client.id }, data: { active: true } });
  const reactivated = await call('PAYMENT_NOTICE', { amount: 0, requestId: absent.body.receipt.requestId }); assert.equal(reactivated.body.replayed, true);
  await stop(children[0]); const restarted = await start();
  const prior = await prisma.clientPortalRequest.findFirstOrThrow({ where: { clientId: client.id, kind: 'VISIT_REQUEST' } });
  const replay = await call('VISIT_REQUEST', { requestId: prior.requestId, message: prior.response.submission.message }, { base: restarted }); assert.deepEqual(replay.body, { ...prior.response, replayed: true });
  // A best-effort socket failure after commit cannot change the acknowledgement.
  const business = require('../src/business/portal/ClientPortalRequestBusiness'); let emissions = 0;
  global.io = { to() { return { emit() { emissions++; throw Error('QA socket unavailable'); } }; }, emit() { emissions++; } };
  business.emit(absent.body); business.emit({ ...absent.body, replayed: true }); assert.equal(emissions, 1); delete global.io;
  console.log('PASS mandatory audit/notification/receipt rollback, strict inputs, restart replay, post-commit events and unchanged money/scheduling');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await dropTrigger(); for (const child of children) await stop(child); await prisma.$disconnect(); });
