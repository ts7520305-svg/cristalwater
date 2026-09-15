'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const billing = require('../src/business/finance/MonthlyBillingBusiness');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function create(creditBalance = 10) {
    const client = await prisma.client.create({ data: { name: 'Mensalidade com credito QA', status: 'ACTIVE', billingActive: true, active: true, creditBalance } });
    for (const price of [12.3, 7.7]) await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina mensal QA', monthlyAmount: price } });
    return client;
  }
  const read = (clientId, monthRef) => prisma.invoice.findUniqueOrThrow({ where: { clientId_monthRef: { clientId, monthRef } }, include: { payments: true, lines: true } });
  const balance = async id => (await prisma.client.findUniqueOrThrow({ where: { id } })).creditBalance;
  const target = await create(), monthRef = '2045-01';
  const response = await fetch(base + '/api/billing/generate-monthly', { method: 'POST', headers, body: JSON.stringify({ monthRef }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  const first = await read(target.id, monthRef);
  assert.equal(first.total, 20); assert.equal(first.totalAmount, 20); assert.equal(first.amount, 20);
  assert.equal(first.amountPaid, 10); assert.equal(first.amountOpen, 10); assert.equal(first.status, 'PARTIAL');
  assert.equal(first.payments.length, 1); assert.equal(first.payments[0].method, 'CREDIT'); assert.equal(first.payments[0].amountCents, 1000);
  assert.equal(first.lines.filter(line => line.type === 'MONTHLY').length, 2); assert.equal(first.lines.some(line => line.type === 'CREDIT'), false);
  assert.equal(await balance(target.id), 0);
  await billing.generateForClient(target.id, monthRef); assert.deepEqual(await read(target.id, monthRef), first);
  console.log('PASS monthly API preserves service value and records credit as a payment; repeated generation preserves the complete invoice');

  const same = await create();
  const simultaneous = await Promise.all(Array.from({ length: 8 }, () => billing.generateForClient(same.id, '2045-02')));
  assert.equal(simultaneous.filter(row => row.changed).length, 1);
  const once = await read(same.id, '2045-02'); assert.equal(once.total, 20); assert.equal(once.lines.length, 2); assert.equal(once.payments.length, 1);
  const shared = await create(25), periods = ['2046-01', '2046-02', '2046-03', '2046-04', '2046-05', '2046-06'];
  await Promise.all(periods.map(month => billing.generateForClient(shared.id, month)));
  assert.equal(await balance(shared.id), 0);
  const sharedInvoices = await prisma.invoice.findMany({ where: { clientId: shared.id } });
  assert.equal(sharedInvoices.reduce((sum, row) => sum + Math.round(row.amountPaid * 100), 0), 2500);
  assert.equal(sharedInvoices.reduce((sum, row) => sum + Math.round(row.amountOpen * 100), 0), 9500);
  assert.equal((await prisma.payment.aggregate({ where: { invoice: { clientId: shared.id } }, _sum: { amountCents: true } }))._sum.amountCents, 2500);
  console.log('PASS eight same-month generations create one invoice; six different months share one credit balance without overspending');

  for (const values of [{ status: 'DRAFT' }, { status: 'CANCELLED' }, { status: 'ISSUED' }, { status: 'PAID' }, { status: 'PARTIAL', amountPaid: 2 }, { status: 'PENDING', amountPaid: 2 }, { status: 'PENDING', externalInvoiceNo: 'QA-external-123' }]) {
    const client = await create();
    const invoice = await prisma.invoice.create({ data: { clientId: client.id, monthRef: '2047-01', amount: 5, total: 5, totalAmount: 5, amountOpen: 5, ...values,
      lines: { create: [{ type: 'SERVICE', description: 'Documento existente QA', quantity: 1, unitPrice: 5, total: 5 }] } } });
    const before = await read(client.id, '2047-01');
    assert.equal((await billing.generateForClient(client.id, '2047-01')).changed, false);
    assert.deepEqual(await read(client.id, '2047-01'), before); assert.equal(await balance(client.id), 10);
    assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 0);
  }
  const legacy = await create();
  await prisma.invoice.create({ data: { clientId: legacy.id, monthRef: '2047-02', status: 'PENDING', total: 10, amountOpen: 10,
    lines: { create: [{ type: 'MONTHLY', description: 'Mensalidade antiga', quantity: 1, unitPrice: 20, total: 20 }, { type: 'CREDIT', description: 'Credito historico', quantity: 1, unitPrice: -10, total: -10 }] } } });
  const legacyBefore = await read(legacy.id, '2047-02');
  await billing.generateForClient(legacy.id, '2047-02'); assert.deepEqual(await read(legacy.id, '2047-02'), legacyBefore);
  const paused = await create(); await prisma.client.update({ where: { id: paused.id }, data: { billingActive: false } });
  assert.equal((await billing.generateForClient(paused.id, '2047-03')).changed, false); assert.equal(await balance(paused.id), 10);
  console.log('PASS issued, paid, partial, draft and withdrawn invoices, old credit lines and paused billing are preserved');

  const mixed = await create(), requestId = randomUUID();
  await Promise.all([billing.generateForClient(mixed.id, '2048-01'), (async () => {
    const r = await fetch(base + `/api/admin/payments/${mixed.id}/manual-received?month=2026-09`, { method: 'POST', headers, body: JSON.stringify({ requestId, amount: 5 }) });
    assert.equal(r.status, 200, await r.text());
  })()]);
  const mixedInvoice = await read(mixed.id, '2048-01'); assert.equal(mixedInvoice.amountPaid, 15); assert.equal(mixedInvoice.amountOpen, 5); assert.equal(await balance(mixed.id), 0);
  console.log('PASS receipt during generation conserves cash plus credit regardless of transaction order');

  const rollback = await create(), beforeClient = await prisma.client.findUniqueOrThrow({ where: { id: rollback.id } });
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_monthly_credit_failure() RETURNS trigger AS $$ BEGIN IF NEW."clientId" = ${rollback.id} THEN RAISE EXCEPTION 'QA monthly credit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_monthly_credit_failure BEFORE INSERT ON "CommunicationLog" FOR EACH ROW EXECUTE FUNCTION qa_monthly_credit_failure()');
  try {
    await assert.rejects(billing.generateForClient(rollback.id, '2049-01'));
    assert.equal(await prisma.invoice.count({ where: { clientId: rollback.id } }), 0);
    assert.equal(await prisma.payment.count({ where: { invoice: { clientId: rollback.id } } }), 0);
    assert.deepEqual(await prisma.client.findUniqueOrThrow({ where: { id: rollback.id } }), beforeClient);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_monthly_credit_failure ON "CommunicationLog"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_monthly_credit_failure()');
  }
  assert.equal((await billing.generateForClient(rollback.id, '2049-01')).changed, true);
  assert.equal((await billing.generateForClient(rollback.id, '2049-01')).changed, false);
  assert.equal((await read(rollback.id, '2049-01')).payments.length, 1);
  for (const month of ['2026-13', 'bad', {}, '', null]) {
    const r = await fetch(base + '/api/billing/generate-monthly', { method: 'POST', headers, body: JSON.stringify({ monthRef: month }) }); assert.equal(r.status, 400);
  }
  console.log('PASS a failure rolls back the newly created invoice, lines, payment and client balance; retry creates once; invalid periods are rejected');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
