'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function post(id, action, body) { const r = await fetch(`${base}/api/finance-os/invoices/${id}/${action}`, { method: 'POST', headers, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  async function fixture(paid = 100, extra = {}) {
    const client = await prisma.client.create({ data: { name: 'Nota de crédito QA', status: 'ACTIVE', creditBalance: 5 } });
    return prisma.invoice.create({ data: { clientId: client.id, status: paid === 100 ? 'PAID' : 'ISSUED', total: 100, totalAmount: 100, amount: 100, amountPaid: paid, amountOpen: 100 - paid,
      lines: { create: [{ type: 'SERVICE', description: 'Nota de crédito QA', quantity: 1, unitPrice: 100, total: 100, lineTotal: 100 }] },
      ...(paid ? { payments: { create: { amount: paid, amountCents: paid * 100, method: 'CASH' } } } : {}), ...extra } });
  }
  const state = id => prisma.invoice.findUniqueOrThrow({ where: { id }, include: { client: true, lines: true, payments: true } });
  const payload = amount => ({ requestId: randomUUID(), amount, reason: 'Serviço corrigido', notes: 'QA' });
  const invoice = await fixture(), body = payload(20), first = await post(invoice.id, 'credit-note', body);
  assert.equal(first.status, 201, JSON.stringify(first));
  const after = await state(invoice.id); console.log(JSON.stringify({ expectedCredit: 25, actualCredit: after.client.creditBalance }));
  assert.equal(after.client.creditBalance, 25); assert.equal(after.total, 80); assert.equal(after.amountPaid, 100); assert.equal(after.payments.length, 1);
  for (let i = 0; i < 3; i++) { const retry = await post(invoice.id, 'credit-note', body); assert.equal(retry.status, 201); assert.equal(retry.body.idempotent, true); }
  assert.deepEqual(await state(invoice.id), after);
  assert.equal((await post(invoice.id, 'credit-note', { ...body, amount: 21 })).status, 409);
  assert.equal((await post(invoice.id, 'payments', { requestId: body.requestId, amount: 20 })).status, 409);
  assert.equal((await post(invoice.id, 'credit-note', payload(81))).status, 409);
  const partial = await fixture(80), partialReply = await post(partial.id, 'credit-note', payload(30));
  assert.equal(partialReply.status, 201); assert.equal(partialReply.body.creditAdded, 10); assert.equal(partialReply.body.appliedAmount, 20); assert.equal((await state(partial.id)).client.creditBalance, 15);
  assert.equal((await post(partial.id, 'credit-note', payload(10))).status, 201); assert.equal((await state(partial.id)).client.creditBalance, 25);
  console.log('PASS paid and partial credit notes preserve cash history, release only incremental credit and replay the original acknowledgement');
  const concurrent = await fixture(), concurrentBody = payload(10);
  const replies = await Promise.all(Array.from({ length: 8 }, () => post(concurrent.id, 'credit-note', concurrentBody)));
  assert(replies.every(r => r.status === 201), JSON.stringify(replies)); assert.equal((await state(concurrent.id)).client.creditBalance, 15);
  const limit = await fixture(0), capped = await Promise.all([post(limit.id, 'credit-note', payload(60)), post(limit.id, 'credit-note', payload(60))]);
  assert.deepEqual(capped.map(r => r.status).sort(), [201, 409]); assert.equal((await state(limit.id)).total, 40);
  const raced = await fixture(0), race = await Promise.all([post(raced.id, 'credit-note', payload(20)), post(raced.id, 'payments', { requestId: randomUUID(), amount: 100, method: 'CASH' })]);
  assert(race.every(r => r.status === 201), JSON.stringify(race)); assert.equal((await state(raced.id)).client.creditBalance, 25);
  const cash = await prisma.payment.aggregate({ where: { invoice: { clientId: raced.clientId } }, _sum: { amount: true } }); assert.equal(cash._sum.amount, 100);
  for (const status of ['DRAFT', 'CANCELLED', 'VOID', 'ARCHIVED']) {
    const invalid = await fixture(0, { status }), before = await state(invalid.id);
    assert.equal((await post(invalid.id, 'credit-note', payload(1))).status, 409); assert.deepEqual(await state(invalid.id), before);
  }
  const invalid = await fixture(0);
  for (const amount of [-1, 0, true, {}, 0.001, 'NaN']) assert.equal((await post(invalid.id, 'credit-note', payload(amount))).status, 400);
  assert.equal((await post(invalid.id, 'credit-note', { amount: 1, reason: 'Sem identificador' })).status, 400);
  console.log('PASS concurrent notes respect the remaining total; racing cash is conserved; removed documents and malformed requests are rejected');
  const failed = await fixture(), before = await state(failed.id), failedBody = payload(10);
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_credit_note_failure() RETURNS trigger AS $$ BEGIN IF NEW.action = 'FINANCE_CREDIT_NOTE_CREATED' AND NEW."entityId" = ${failed.id} THEN RAISE EXCEPTION 'QA credit note failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_credit_note_failure BEFORE INSERT ON "AuditTrail" FOR EACH ROW EXECUTE FUNCTION qa_credit_note_failure()');
  try { assert.equal((await post(failed.id, 'credit-note', failedBody)).status, 500); assert.deepEqual(await state(failed.id), before); assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `invoice-payment:${failedBody.requestId}` } }), 0); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_credit_note_failure ON "AuditTrail"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_credit_note_failure()'); }
  assert.equal((await post(failed.id, 'credit-note', failedBody)).status, 201);
  console.log('PASS a failed audit rolls back the line, invoice, client credit and acknowledgement together');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
