'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const { applyClientCreditToInvoice } = require('../src/services/clientCreditService');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  const client = creditBalance => prisma.client.create({ data: { name: 'Credito concorrente QA', status: 'ACTIVE', active: true, billingActive: true, creditBalance } });
  const invoice = (clientId, total = 20, extra = {}, db = prisma) => db.invoice.create({ data: { clientId, status: 'ISSUED', total, totalAmount: total, amount: total, amountOpen: total, ...extra,
    lines: { create: [{ type: 'SERVICE', description: 'Credito QA', quantity: 1, unitPrice: total, total, lineTotal: total }] } } });
  const readClient = id => prisma.client.findUniqueOrThrow({ where: { id } });
  const readInvoice = id => prisma.invoice.findUniqueOrThrow({ where: { id } });
  const cent = amount => Math.round(amount * 100);
  async function post(path, payload) {
    const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(payload) });
    const body = await response.json(); assert([200, 201].includes(response.status), JSON.stringify({ path, status: response.status, body })); return body;
  }

  const existing = await client(15), full = await invoice(existing.id), receipt = { requestId: randomUUID(), amount: 25, method: 'CASH' };
  const paid = await post(`/api/finance-os/invoices/${full.id}/payments`, receipt);
  assert.equal((await readClient(existing.id)).creditBalance, 20, 'Cash settlement must preserve earlier credit and add only the surplus');
  assert.equal((await readInvoice(full.id)).amountPaid, 20);
  assert.equal(await prisma.payment.count({ where: { invoiceId: full.id, method: 'CREDIT' } }), 0);
  assert.equal((await post(`/api/finance-os/invoices/${full.id}/payments`, receipt)).idempotent, true);
  assert.equal((await readClient(existing.id)).creditBalance, 20);
  assert.equal(paid.requestReceipt.appliedCents, 2000); assert.equal(paid.requestReceipt.creditCents, 500);
  console.log('PASS Finance OS cash settlement preserves earlier credit; replay cannot consume or add credit again');

  const shared = await client(10.01), targets = [];
  for (let i = 0; i < 12; i++) targets.push(await invoice(shared.id, 3));
  // With native PostgreSQL, hold the interval after the old unprotected balance
  // read, making competing transactions overlap. PGlite runs the same assertions.
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_credit_delay() RETURNS trigger AS $$ BEGIN IF NEW.method = 'CREDIT' AND NEW."invoiceId" IN (${targets.map(row => row.id).join(',')}) THEN PERFORM pg_sleep(0.05); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_credit_delay BEFORE INSERT ON "Payment" FOR EACH ROW EXECUTE FUNCTION qa_credit_delay()');
  let allocations;
  try { allocations = await Promise.all(targets.map(row => applyClientCreditToInvoice(prisma, row.id))); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_credit_delay ON "Payment"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_credit_delay()'); }
  assert.equal(allocations.reduce((sum, row) => sum + cent(row.creditUsed), 0), 1001);
  assert.equal((await readClient(shared.id)).creditBalance, 0);
  const movements = await prisma.payment.findMany({ where: { invoice: { clientId: shared.id } } });
  assert.equal(movements.reduce((sum, row) => sum + row.amountCents, 0), 1001);
  const balances = await prisma.invoice.findMany({ where: { clientId: shared.id } });
  assert.equal(balances.reduce((sum, row) => sum + cent(row.amountOpen), 0), 2599);
  assert.equal(await prisma.communicationLog.count({ where: { clientId: shared.id, channel: 'CLIENT_CREDIT' } }), movements.length);
  console.log('PASS twelve invoices share 10.01 EUR without overdrawing the client, losing money or omitting a credit movement');

  const repeated = await client(30), sameInvoice = await invoice(repeated.id, 20);
  await Promise.all(Array.from({ length: 12 }, () => applyClientCreditToInvoice(prisma, sameInvoice.id)));
  assert.equal((await readClient(repeated.id)).creditBalance, 10); assert.equal((await readInvoice(sameInvoice.id)).amountPaid, 20);
  assert.equal(await prisma.payment.count({ where: { invoiceId: sameInvoice.id } }), 1);
  const decimal = await client(0.3), a = await invoice(decimal.id, 0.1), b = await invoice(decimal.id, 0.2);
  await applyClientCreditToInvoice(prisma, a.id); assert.equal((await readClient(decimal.id)).creditBalance, 0.2);
  await applyClientCreditToInvoice(prisma, b.id); assert.equal((await readClient(decimal.id)).creditBalance, 0);
  assert.equal((await readInvoice(b.id)).amountOpen, 0);
  console.log('PASS repeated allocation on the same invoice applies once; fractional balances finish at exact cents');

  const inserted = await client(10);
  await Promise.all(Array.from({ length: 6 }, () => prisma.$transaction(async tx => {
    const row = await invoice(inserted.id, 3, {}, tx);
    return applyClientCreditToInvoice(tx, row.id);
  }, { maxWait: 15000, timeout: 15000 })));
  assert.equal((await readClient(inserted.id)).creditBalance, 0);
  assert.equal((await prisma.payment.aggregate({ where: { invoice: { clientId: inserted.id } }, _sum: { amountCents: true } }))._sum.amountCents, 1000);
  console.log('PASS credit locking remains compatible with concurrent invoice creation and foreign-key checks inside transactions');

  for (const route of ['core', 'finance', 'client']) {
    const mixed = await client(10), row = await invoice(mixed.id);
    const path = route === 'core' ? `/api/payments/invoice/${row.id}` : route === 'finance' ? `/api/finance-os/invoices/${row.id}/payments` : `/api/admin/payments/${mixed.id}/manual-received?month=2026-09`;
    await Promise.all([applyClientCreditToInvoice(prisma, row.id), post(path, { requestId: randomUUID(), amount: 25, method: 'CASH' })]);
    assert.equal((await readInvoice(row.id)).amountPaid, 20); assert.equal((await readInvoice(row.id)).amountOpen, 0);
    assert.equal((await readClient(mixed.id)).creditBalance, 15, `Cash and credit must conserve the total regardless of order: ${route}`);
  }
  const parallelApi = await client(10), months = ['2044-01', '2044-02', '2044-03', '2044-04'];
  for (const month of months) await invoice(parallelApi.id, 4, { monthRef: month });
  await Promise.all(months.map(monthRef => post(`/api/invoices/generate-for-client/${parallelApi.id}`, { monthRef })));
  assert.equal((await readClient(parallelApi.id)).creditBalance, 0);
  assert.equal((await prisma.payment.aggregate({ where: { invoice: { clientId: parallelApi.id } }, _sum: { amountCents: true } }))._sum.amountCents, 1000);
  console.log('PASS credit application coexists with invoice/Finance OS/client receipts and concurrent monthly API calls');

  for (const table of ['Payment', 'Invoice', 'Client', 'CommunicationLog']) {
    const rollback = await client(12), row = await invoice(rollback.id), before = await readClient(rollback.id);
    const condition = table === 'Invoice' ? `NEW.id = ${row.id}` : table === 'Client' ? `NEW.id = ${rollback.id}` : table === 'Payment' ? `NEW."invoiceId" = ${row.id}` : `NEW."clientId" = ${rollback.id}`;
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_credit_failure() RETURNS trigger AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA credit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_credit_failure BEFORE ${['Invoice', 'Client'].includes(table) ? 'UPDATE' : 'INSERT'} ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_credit_failure()`);
    try {
      await assert.rejects(applyClientCreditToInvoice(prisma, row.id));
      assert.deepEqual(await readInvoice(row.id), row); assert.deepEqual(await readClient(rollback.id), before);
      assert.equal(await prisma.payment.count({ where: { invoiceId: row.id } }), 0);
      assert.equal(await prisma.communicationLog.count({ where: { clientId: rollback.id } }), 0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_credit_failure ON "${table}"`);
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_credit_failure()');
    }
    assert.equal((await applyClientCreditToInvoice(prisma, row.id)).creditUsed, 12);
    assert.equal((await applyClientCreditToInvoice(prisma, row.id)).creditUsed, 0);
  }
  console.log('PASS failed movement, invoice, client or communication rolls back all credit effects; a retry applies the available credit once');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
