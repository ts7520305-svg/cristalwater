'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, month = '2026-09';
  async function invoice(clientId, total = 100, extra = {}) {
    return prisma.invoice.create({ data: { clientId, status: 'ISSUED', amount: total, total, totalAmount: total, amountOpen: total, ...extra,
      lines: { create: [{ type: 'SERVICE', description: 'Recebimento QA', quantity: 1, unitPrice: total, total, lineTotal: total }] } } });
  }
  async function create(total = 100) {
    const client = await prisma.client.create({ data: { name: 'Recebimentos gerais QA', status: 'ACTIVE', monthlyFee: 80 } });
    return { client, invoice: await invoice(client.id, total) };
  }
  async function post(path, payload, auth = headers) {
    const response = await fetch(base + path, { method: 'POST', headers: auth, body: JSON.stringify(payload) });
    return { status: response.status, body: await response.json() };
  }
  const receive = (id, payload, period = month, auth = headers) => post(`/api/admin/payments/${id}/manual-received?month=${encodeURIComponent(period)}`, payload, auth);
  const readInvoice = id => prisma.invoice.findUniqueOrThrow({ where: { id } });
  const readClient = id => prisma.client.findUniqueOrThrow({ where: { id } });
  async function collection(id) {
    const response = await fetch(`${base}/api/admin/payments?month=${month}`, { headers }); assert.equal(response.status, 200);
    return (await response.json()).clients.find(client => client.id === id);
  }
  const duplicate = await create(), payload = { requestId: randomUUID(), amount: 10, method: 'TRANSFER', notes: 'Mesmo recebimento' };
  const first = await receive(duplicate.client.id, payload), repeated = await receive(duplicate.client.id, payload);
  assert.equal(first.status, 200, JSON.stringify(first)); assert.equal(repeated.body.idempotent, true);
  assert.deepEqual(repeated.body, { ...first.body, idempotent: true });
  assert.deepEqual(first.body.requestReceipt, { version: 1, scope: 'CLIENT', requestId: payload.requestId, amountCents: 1000, method: 'TRANSFER', notes: payload.notes, actorId: admin.id, actorRole: 'ADMIN', clientId: duplicate.client.id, month, appliedCents: 1000, creditCents: 0 });
  assert.equal((await readInvoice(duplicate.invoice.id)).amountPaid, 10);
  assert.equal(await prisma.payment.count({ where: { invoiceId: duplicate.invoice.id } }), 1);
  for (const changed of [{ amount: 11 }, { method: 'CASH' }, { notes: 'Outra nota' }]) assert.equal((await receive(duplicate.client.id, { ...payload, ...changed })).status, 409);
  assert.equal((await receive(duplicate.client.id, payload, '2026-08')).status, 409);
  const another = await create(); assert.equal((await receive(another.client.id, payload)).status, 409);
  assert.equal((await post(`/api/payments/invoice/${duplicate.invoice.id}`, payload)).status, 409, 'Request IDs cannot cross between a client and an invoice receipt');
  const otherAdmin = await prisma.user.create({ data: { email: `receipt-admin-${randomUUID()}@qa.test`, password: 'qa-not-a-login-password', name: 'Outro admin QA', role: 'ADMIN', active: true } });
  const otherHeaders = { ...headers, Authorization: `Bearer ${jwt.sign({ id: otherAdmin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}` };
  const conflict = await receive(duplicate.client.id, payload, month, otherHeaders);
  assert.equal(conflict.status, 409); assert.equal(conflict.body.requestReceipt, undefined);
  assert.equal((await receive(duplicate.client.id, payload, month, { 'Content-Type': 'application/json' })).status, 401);
  assert.equal((await receive(duplicate.client.id, { ...payload, requestId: randomUUID(), amount: 5 })).status, 200);
  assert.deepEqual((await receive(duplicate.client.id, { ...payload, amount: '10.00', requestId: payload.requestId.toUpperCase() })).body, { ...first.body, idempotent: true });
  assert.equal((await readInvoice(duplicate.invoice.id)).amountPaid, 15);
  assert.equal((await collection(duplicate.client.id)).totalDue, 85);
  assert.equal((await collection(duplicate.client.id)).paymentStatus, 'PENDING', 'Partial payments must remain visible despite lastPaymentAt this month');
  console.log('PASS original immutable receipt, account/client/month/data conflicts, cross-API key protection, authentication and partial debt visibility');

  const surplus = await create(), surplusPayload = { requestId: randomUUID(), amount: 125, method: 'CASH' };
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => receive(surplus.client.id, surplusPayload)));
  concurrent.forEach(result => assert.equal(result.status, 200, JSON.stringify(result)));
  assert.equal(concurrent.filter(result => !result.body.idempotent).length, 1);
  assert.equal((await readClient(surplus.client.id)).creditBalance, 25);
  assert.equal(await prisma.payment.count({ where: { invoice: { clientId: surplus.client.id } } }), 2);
  assert.equal(await prisma.communicationLog.count({ where: { clientId: surplus.client.id, channel: 'ADMIN_MANUAL_PAYMENT' } }), 1);
  const parallel = await create();
  const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => index % 2 ?
    post(`/api/payments/invoice/${parallel.invoice.id}`, { requestId: randomUUID(), amount: 1, method: 'CASH' }) :
    receive(parallel.client.id, { requestId: randomUUID(), amount: 1, method: 'CASH' })));
  responses.forEach(result => assert([200, 201].includes(result.status), JSON.stringify(result)));
  assert.equal((await readInvoice(parallel.invoice.id)).amountPaid, 12);
  assert.equal(await prisma.payment.count({ where: { invoiceId: parallel.invoice.id } }), 12);
  console.log('PASS concurrent identical receipts create one surplus; distinct client and invoice payments preserve all balances');

  const allocated = await create(10.10);
  await prisma.invoice.update({ where: { id: allocated.invoice.id }, data: { dueDate: new Date('2020-01-01') } });
  const newer = await invoice(allocated.client.id, 20.20, { dueDate: new Date('2021-01-01') });
  const drafts = [];
  for (const status of ['DRAFT', 'CANCELLED', 'ARCHIVED']) drafts.push(await invoice(allocated.client.id, 99, { status, dueDate: new Date('2019-01-01') }));
  await prisma.client.update({ where: { id: allocated.client.id }, data: { creditBalance: 7 } });
  const partial = await receive(allocated.client.id, { requestId: randomUUID(), amount: '25.15' });
  assert.equal(partial.status, 200, JSON.stringify(partial));
  assert.deepEqual(partial.body.allocations.map(row => [row.invoiceId, row.amountCents]), [[allocated.invoice.id, 1010], [newer.id, 1505]]);
  assert.equal(partial.body.remainingOpen, 5.15); assert.equal(partial.body.creditBalance, 7);
  const listed = await collection(allocated.client.id);
  assert.equal(listed.totalDue, 5.15); assert.equal(listed.paymentStatus, 'OVERDUE'); assert.equal(listed.openInvoicesCount, 1);
  const paid = await receive(allocated.client.id, { requestId: randomUUID(), amount: 100 });
  assert.equal(paid.body.appliedAmount, 5.15); assert.equal(paid.body.creditAdded, 94.85); assert.equal(paid.body.creditBalance, 101.85);
  for (const draft of drafts) assert.deepEqual(await readInvoice(draft.id), draft);
  assert.equal((await collection(allocated.client.id)).totalDue, 0);
  const draftOnly = await create(20);
  await prisma.invoice.update({ where: { id: draftOnly.invoice.id }, data: { status: 'DRAFT' } });
  assert.equal((await collection(draftOnly.client.id)).totalDue, 0, 'Monthly fees and drafts do not manufacture an issued debt');
  const advance = await receive(draftOnly.client.id, { amount: 10 });
  assert.equal(advance.status, 200); assert.equal(advance.body.creditAdded, 10, 'Legacy callers remain compatible without retry guarantee');
  assert.equal((await readInvoice(draftOnly.invoice.id)).amountPaid, 0);
  const beforeMark = await readClient(duplicate.client.id);
  assert.equal((await post(`/api/admin/payments/${duplicate.client.id}/mark-paid`, {})).status, 409);
  assert.deepEqual(await readClient(duplicate.client.id), beforeMark, 'Mark-paid cannot bypass actual receipts');
  console.log('PASS oldest issued balances allocated in integer cents; drafts excluded, prior credit retained, advance recorded, unpaid flags cannot bypass receipts');

  const invalid = await create();
  for (const requestId of [null, '', 'bad', 42, {}, []]) assert.equal((await receive(invalid.client.id, { requestId, amount: 5 })).status, 400);
  for (const amount of [null, '', true, {}, [], 0, -1, 0.001, 1.234, '1e2', '2abc']) assert.equal((await receive(invalid.client.id, { requestId: randomUUID(), amount })).status, 400);
  for (const values of [{ method: {} }, { notes: [] }, { notes: 'x'.repeat(2001) }]) assert.equal((await receive(invalid.client.id, { requestId: randomUUID(), amount: 5, ...values })).status, 400);
  for (const period of ['2026-13', '2026-00', '0000-01', '2026-9', 'null']) assert.equal((await receive(invalid.client.id, { requestId: randomUUID(), amount: 5 }, period)).status, 400);
  assert.equal(await prisma.payment.count({ where: { invoiceId: invalid.invoice.id } }), 0);
  console.log('PASS invalid request data writes nothing');

  for (const failure of ['Client', 'CommunicationLog', 'OperationalReminder']) {
    const rollback = await create(), retry = { requestId: randomUUID(), amount: 125, method: 'CASH' }, before = await readClient(rollback.client.id);
    const when = failure === 'Client' ? `NEW.id = ${rollback.client.id}` : failure === 'CommunicationLog' ? `NEW."clientId" = ${rollback.client.id}` : `NEW."sourceKey" = 'invoice-payment:${retry.requestId}'`;
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_client_receipt_failure() RETURNS trigger AS $$ BEGIN IF ${when} THEN RAISE EXCEPTION 'QA receipt rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_client_receipt_failure BEFORE ${failure === 'Client' ? 'UPDATE' : 'INSERT'} ON "${failure}" FOR EACH ROW EXECUTE FUNCTION qa_client_receipt_failure()`);
    try {
      assert.equal((await receive(rollback.client.id, retry)).status, 500);
      assert.deepEqual(await readInvoice(rollback.invoice.id), rollback.invoice);
      assert.deepEqual(await readClient(rollback.client.id), before);
      assert.equal(await prisma.invoice.count({ where: { clientId: rollback.client.id } }), 1);
      assert.equal(await prisma.payment.count({ where: { invoice: { clientId: rollback.client.id } } }), 0);
      assert.equal(await prisma.communicationLog.count({ where: { clientId: rollback.client.id } }), 0);
      assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `invoice-payment:${retry.requestId}` } }), 0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_client_receipt_failure ON "${failure}"`);
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_client_receipt_failure()');
    }
    assert.equal((await receive(rollback.client.id, retry)).status, 200);
    assert.equal((await receive(rollback.client.id, retry)).body.idempotent, true);
    assert.equal((await readClient(rollback.client.id)).creditBalance, 25);
  }
  console.log('PASS failures saving client state, communication or receipt roll back all financial writes; retry then succeeds exactly once');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
