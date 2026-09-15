'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const { createCreditLedgerPayment } = require('../src/services/clientCreditService');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  const client = await prisma.client.create({ data: { name: 'Excedente no historico QA', status: 'ACTIVE', creditBalance: 15 } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', amount: 20, total: 20, totalAmount: 20, amountOpen: 20,
    lines: { create: [{ type: 'SERVICE', description: 'Excedente QA', quantity: 1, unitPrice: 20, total: 20, lineTotal: 20 }] } } });
  const payload = { requestId: randomUUID(), amount: 25, method: 'CASH' };
  const pay = () => fetch(base + `/api/finance-os/invoices/${invoice.id}/payments`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const response = await pay();
  assert.equal(response.status, 201);
  const receipt = await response.json();
  const payments = await prisma.payment.findMany({ where: { invoice: { clientId: client.id } } });
  console.log(JSON.stringify({ received: 25, recordedCents: payments.reduce((sum, row) => sum + row.amountCents, 0), rows: payments.length }));
  assert.equal(payments.reduce((sum, row) => sum + row.amountCents, 0), 2500, 'All cash received must appear in payment history, including surplus');
  assert.equal(payments.length, 2); assert.equal(receipt.creditPaymentId, payments.find(row => row.invoiceId !== invoice.id).id);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).creditBalance, 20);
  const ledger = await prisma.invoice.findUniqueOrThrow({ where: { id: payments.find(row => row.invoiceId !== invoice.id).invoiceId }, include: { lines: true } });
  assert.equal(ledger.total, 0); assert.equal(ledger.amountPaid, 5); assert.equal(ledger.lines[0].type, 'CREDIT_DEPOSIT');
  const retries = await Promise.all(Array.from({ length: 8 }, async () => { const r = await pay(); assert.equal(r.status, 201); return r.json(); }));
  retries.forEach(row => { assert.equal(row.idempotent, true); assert.equal(row.creditPaymentId, receipt.creditPaymentId); });
  assert.equal(await prisma.payment.count({ where: { invoice: { clientId: client.id } } }), 2);
  for (const path of ['/api/admin/payments/ledger/all', `/api/admin/payments/client/${client.id}`]) {
    const r = await fetch(base + path, { headers }); assert.equal(r.status, 200);
    const rows = (await r.json()).payments.filter(row => payments.some(payment => payment.id === row.id));
    assert.equal(rows.reduce((sum, row) => sum + row.amountCents, 0), 2500);
  }
  console.log('PASS the whole receipt appears in both ledgers; the surplus is a zero-value deposit document with one payment and one replayable acknowledgement');

  const other = await prisma.invoice.create({ data: { clientId: client.id, status: 'PENDING', amount: 10, total: 10, totalAmount: 10, amountOpen: 10 } });
  const oldNow = Date.now;
  let deposits;
  try { Date.now = () => 1789492000000; deposits = await Promise.all([createCreditLedgerPayment(prisma, client.id, 1), createCreditLedgerPayment(prisma, client.id, 2)]); }
  finally { Date.now = oldNow; }
  assert.notEqual(deposits[0].invoice.monthRef, deposits[1].invoice.monthRef);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).creditBalance, 23);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).paymentStatus, 'PARTIAL');
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: other.id } })).amountOpen, 10);
  console.log('PASS deposits made at the same clock instant have unique identities; receiving credit does not mark other debt as paid');

  const failed = await prisma.client.create({ data: { name: 'Excedente revertido QA', status: 'ACTIVE', creditBalance: 7 } });
  const target = await prisma.invoice.create({ data: { clientId: failed.id, status: 'ISSUED', amount: 20, total: 20, totalAmount: 20, amountOpen: 20,
    lines: { create: [{ type: 'SERVICE', description: 'Rollback QA', quantity: 1, unitPrice: 20, total: 20, lineTotal: 20 }] } } });
  const before = await prisma.client.findUniqueOrThrow({ where: { id: failed.id } });
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_surplus_failure() RETURNS trigger AS $$ BEGIN IF NEW.type = 'CREDIT_DEPOSIT' THEN RAISE EXCEPTION 'QA surplus failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_surplus_failure BEFORE INSERT ON "InvoiceLine" FOR EACH ROW EXECUTE FUNCTION qa_surplus_failure()');
  const request = { requestId: randomUUID(), amount: 25, method: 'CASH' };
  try {
    const r = await fetch(base + `/api/finance-os/invoices/${target.id}/payments`, { method: 'POST', headers, body: JSON.stringify(request) }); assert.equal(r.status, 500);
    assert.deepEqual(await prisma.invoice.findUniqueOrThrow({ where: { id: target.id } }), target);
    assert.deepEqual(await prisma.client.findUniqueOrThrow({ where: { id: failed.id } }), before);
    assert.equal(await prisma.invoice.count({ where: { clientId: failed.id } }), 1);
    assert.equal(await prisma.payment.count({ where: { invoice: { clientId: failed.id } } }), 0);
    assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `invoice-payment:${request.requestId}` } }), 0);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_surplus_failure ON "InvoiceLine"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_surplus_failure()');
  }
  const r = await fetch(base + `/api/finance-os/invoices/${target.id}/payments`, { method: 'POST', headers, body: JSON.stringify(request) }); assert.equal(r.status, 201);
  assert.equal((await prisma.payment.aggregate({ where: { invoice: { clientId: failed.id } }, _sum: { amountCents: true } }))._sum.amountCents, 2500);
  console.log('PASS a failed surplus record rolls back the invoice payment, credit, deposit and receipt; retry records the entire amount once');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
