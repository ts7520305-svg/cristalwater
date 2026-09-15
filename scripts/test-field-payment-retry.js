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
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const paths = [id => `/api/payments/invoice/${id}`, id => `/api/core/invoices/${id}/pay`, id => `/api/finance-os/invoices/${id}/payments`, () => '/api/operational-flow/pay-invoice'];
  async function create() {
    const client = await prisma.client.create({ data: { name: 'Pagamento repetido QA', status: 'ACTIVE' } });
    return prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', amount: 20, total: 20, totalAmount: 20, amountOpen: 20,
      lines: { create: [{ type: 'SERVICE', description: 'Pagamento QA', quantity: 1, unitPrice: 20, total: 20, lineTotal: 20 }] } } });
  }
  async function pay(route, invoiceId, payload, auth = headers) {
    const response = await fetch(base + paths[route](invoiceId), { method: 'POST', headers: auth, body: JSON.stringify({ invoiceId, ...payload }) });
    return { status: response.status, body: await response.json() };
  }
  const results = [];
  for (let route = 0; route < paths.length; route++) {
    const invoice = await create(), payload = { requestId: randomUUID(), amount: 10, method: 'TRANSFER', notes: 'Mesmo pagamento QA' };
    const first = await pay(route, invoice.id, payload), second = await pay(route, invoice.id, payload);
    results.push({ route, first: first.status, second: second.status, payments: await prisma.payment.count({ where: { invoiceId: invoice.id } }), paid: (await prisma.invoice.findUnique({ where: { id: invoice.id } })).amountPaid });
    assert([200, 201].includes(first.status), JSON.stringify(first));
    assert.equal(first.body.requestReceipt?.requestId, payload.requestId);
    assert.equal(first.body.requestReceipt?.amountCents, 1000);
    assert.equal(first.body.requestReceipt?.appliedCents, 1000);
    assert.equal(second.body.idempotent, true);
    assert.deepEqual(second.body.requestReceipt, first.body.requestReceipt);
    for (let other = 0; other < paths.length; other++) {
      const replay = await pay(other, invoice.id, { ...payload, requestId: payload.requestId.toUpperCase(), amount: '10.00' });
      assert([200, 201].includes(replay.status), JSON.stringify(replay));
      assert.deepEqual(replay.body.requestReceipt, first.body.requestReceipt);
      assert.equal(replay.body.appliedAmount, first.body.appliedAmount);
    }
    for (const changed of [{ amount: 10.01 }, { method: 'CASH' }, { notes: 'Outro recebimento' }]) {
      assert.equal((await pay(route, invoice.id, { ...payload, ...changed })).status, 409);
    }
    const another = await create();
    assert.equal((await pay(route, another.id, payload)).status, 409);
    const different = await pay(route, invoice.id, { ...payload, requestId: randomUUID(), amount: 5 });
    assert([200, 201].includes(different.status), JSON.stringify(different));
    const original = await pay(route, invoice.id, payload);
    assert.equal(original.body.invoice.amountPaid, 10, 'A replay returns the original acknowledgement, not a new balance snapshot');
    assert.equal((await prisma.invoice.findUnique({ where: { id: invoice.id } })).amountPaid, 15);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'CANCELLED' } });
    assert.equal((await pay(route, invoice.id, payload)).body.idempotent, true);
    assert.equal((await pay(route, invoice.id, { ...payload, requestId: randomUUID() })).status, 409);
  }
  console.log(JSON.stringify(results));
  assert(results.every(row => row.payments === 1 && row.paid === 10), 'The same request must create exactly one payment on all four APIs');
  console.log('PASS four APIs share the original payment acknowledgement; altered amount, notes, method or invoice conflict; later payments and cancellation do not rewrite the receipt');

  for (let route = 0; route < paths.length; route++) {
    const invoice = await create(), payload = { requestId: randomUUID(), amount: 25, method: 'CASH', notes: 'Excedente repetido QA' };
    const responses = await Promise.all(Array.from({ length: 8 }, () => pay(route, invoice.id, payload)));
    for (const response of responses) assert([200, 201].includes(response.status), JSON.stringify(response));
    assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 1);
    assert.equal((await prisma.client.findUnique({ where: { id: invoice.clientId } })).creditBalance, 5);
    assert.equal(responses.filter(row => row.body.idempotent !== true).length, 1);
    assert.equal(responses[0].body.requestReceipt.creditCents, 500);
    assert.equal(await prisma.notification.count({ where: { clientId: invoice.clientId, type: 'PAYMENT_CONFIRMED' } }), route === 2 ? 1 : 0);
    assert.equal(await prisma.auditTrail.count({ where: { entity: 'Invoice', entityId: invoice.id, action: 'FINANCE_PAYMENT_CONFIRMED' } }), route === 2 ? 1 : 0);
  }
  const mixed = await create(), mixedPayload = { requestId: randomUUID(), amount: 25, method: 'TRANSFER', notes: 'Várias APIs QA' };
  const mixedResults = await Promise.all(Array.from({ length: 12 }, (_, index) => pay(index % 4, mixed.id, mixedPayload)));
  for (const result of mixedResults) assert([200, 201].includes(result.status), JSON.stringify(result));
  assert.equal(await prisma.payment.count({ where: { invoiceId: mixed.id } }), 1);
  assert.equal((await prisma.client.findUnique({ where: { id: mixed.clientId } })).creditBalance, 5);
  console.log('PASS concurrent retries within and across all APIs add one payment and one surplus, without duplicate Finance OS notification/audit');

  const target = await create();
  for (let route = 0; route < paths.length; route++) {
    for (const requestId of [null, '', 'bad', 123, [], {}]) assert.equal((await pay(route, target.id, { requestId, amount: 5 })).status, 400);
    for (const amount of [null, '', true, [], {}, -1, 0, 0.001, 1.234, 'NaN', '1e2', '12abc']) assert.equal((await pay(route, target.id, { requestId: randomUUID(), amount })).status, 400);
    for (const values of [{ method: {} }, { notes: [] }, { notes: 'x'.repeat(2001) }]) assert.equal((await pay(route, target.id, { requestId: randomUUID(), amount: 5, ...values })).status, 400);
  }
  assert.equal(await prisma.payment.count({ where: { invoiceId: target.id } }), 0);
  const otherAdmin = await prisma.user.create({ data: { email: `payment-admin-${randomUUID()}@qa.test`, password: 'qa-not-a-login-password', name: 'Outro admin QA', role: 'ADMIN', active: true } });
  const otherToken = jwt.sign({ id: otherAdmin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  for (let route = 0; route < paths.length; route++) {
    const conflict = await pay(route, mixed.id, mixedPayload, { ...headers, Authorization: `Bearer ${otherToken}` });
    assert.equal(conflict.status, 409); assert.equal(conflict.body.requestReceipt, undefined);
    assert.equal((await pay(route, mixed.id, mixedPayload, { 'Content-Type': 'application/json' })).status, 401);
  }
  console.log('PASS malformed requests write nothing; a different administrator cannot reuse or obtain another actor\'s acknowledgement');

  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_payment_receipt_failure() RETURNS trigger AS $$ BEGIN IF NEW."sourceKey" LIKE 'invoice-payment:%' THEN RAISE EXCEPTION 'QA payment receipt failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_payment_receipt_failure BEFORE INSERT ON "OperationalReminder" FOR EACH ROW EXECUTE FUNCTION qa_payment_receipt_failure()`);
  const retries = [];
  try {
    for (let route = 0; route < paths.length; route++) {
      const invoice = await create(), payload = { requestId: randomUUID(), amount: 25, method: 'CASH' }; retries.push({ route, invoice, payload });
      assert.equal((await pay(route, invoice.id, payload)).status, 500);
      assert.deepEqual(await prisma.invoice.findUnique({ where: { id: invoice.id } }), invoice);
      assert.equal(await prisma.payment.count({ where: { invoice: { clientId: invoice.clientId } } }), 0);
      assert.equal((await prisma.client.findUnique({ where: { id: invoice.clientId } })).creditBalance, 0);
      assert.equal(await prisma.notification.count({ where: { clientId: invoice.clientId } }), 0);
      assert.equal(await prisma.communicationLog.count({ where: { clientId: invoice.clientId } }), 0);
      assert.equal(await prisma.auditTrail.count({ where: { entity: 'Invoice', entityId: invoice.id } }), 0);
    }
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_payment_receipt_failure ON "OperationalReminder"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_payment_receipt_failure()');
  }
  for (const { route, invoice, payload } of retries) {
    assert([200, 201].includes((await pay(route, invoice.id, payload)).status));
    assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 1);
    assert.equal((await prisma.client.findUnique({ where: { id: invoice.clientId } })).creditBalance, 5);
  }
  console.log('PASS failure to save the receipt rolls back payment, credit, invoice, notification and audit; the original request can then succeed once');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
