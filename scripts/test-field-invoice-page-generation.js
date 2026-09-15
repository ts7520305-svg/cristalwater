'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const rates = require('../src/business/finance/ClientRateBusiness');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const monthRef = '2053-01', created = [], suspended = [];
function gate() { let release; return { promise: new Promise(resolve => { release = resolve; }), release: () => release() }; }
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function post(path, body = { monthRef }) { const r = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  const paths = [id => `/api/invoices/generate-for-client/${id}`, () => '/api/invoices/generate-monthly'];
  // Isolate batch selection from fixtures left by earlier groups; restore their flags below.
  suspended.push(...(await prisma.client.findMany({ where: { active: true, billingActive: true, status: 'ACTIVE' }, select: { id: true } })).map(c => c.id));
  await prisma.client.updateMany({ where: { id: { in: suspended } }, data: { billingActive: false } });
  async function fixture(data = {}) {
    const client = await prisma.client.create({ data: { name: 'Página de faturas QA', active: true, billingActive: true, status: 'ACTIVE', monthlyFee: 80, monthlyAmount: 90, creditBalance: 10, requiresInvoice: true, ...data } });
    created.push(client.id);
    await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina faturação QA', monthlyAmount: 20 } });
    return client;
  }
  const retire = id => prisma.client.update({ where: { id }, data: { billingActive: false } });
  const snapshot = async id => ({
    client: await prisma.client.findUniqueOrThrow({ where: { id } }),
    invoices: await prisma.invoice.findMany({ where: { clientId: id }, include: { lines: { orderBy: { id: 'asc' } }, payments: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }),
    logs: await prisma.communicationLog.findMany({ where: { clientId: id }, orderBy: { id: 'asc' } }),
  });
  async function failure(table, id, fn) {
    const direct = ['Client', 'Invoice', 'CommunicationLog'].includes(table);
    const condition = table === 'Client' ? `NEW.id = ${id}` : direct ? `NEW."clientId" = ${id}` : `EXISTS (SELECT 1 FROM "Invoice" WHERE id = NEW."invoiceId" AND "clientId" = ${id})`;
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_invoice_page_failure() RETURNS trigger AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA invoice page failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_invoice_page_failure BEFORE ${['Client', 'Invoice'].includes(table) ? 'UPDATE' : 'INSERT'} ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_invoice_page_failure()`);
    try { return await fn(); }
    finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_invoice_page_failure ON "${table}"`);
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_invoice_page_failure()');
    }
  }
  for (const path of paths) for (const table of ['CommunicationLog', 'InvoiceLine', 'Payment', 'Invoice', 'Client']) {
    const client = await fixture(), before = await snapshot(client.id);
    await failure(table, client.id, async () => {
      const r = await post(path(client.id)); assert.equal(r.status, 500, JSON.stringify(r));
      const after = await snapshot(client.id);
      console.log(JSON.stringify({ path: path(client.id), failedTable: table, expectedInvoices: 0, actualInvoices: after.invoices.length }));
      assert.deepEqual(after, before, 'A failed generation must not leave an invoice, payment, credit change or communication behind');
    });
    const retry = await post(path(client.id)); assert.equal(retry.status, 200, JSON.stringify(retry));
    const after = await snapshot(client.id); assert.equal(after.invoices.length, 1); assert.equal(after.invoices[0].total, 80);
    assert.equal(after.invoices[0].amountPaid, 10); assert.equal(after.invoices[0].amountOpen, 70); assert.equal(after.invoices[0].payments.length, 1); assert.equal(after.client.creditBalance, 0);
    if (retry.body.invoice) {
      assert.equal(retry.body.invoice.clientName, client.name); assert.equal(retry.body.invoice.client.creditBalance, 0);
      assert.equal(retry.body.invoice.year, 2053); assert.equal(retry.body.invoice.month, monthRef); assert.equal(retry.body.invoice.payments.length, 1);
      const listed = await fetch(base + `/api/invoices/${retry.body.invoice.id}`, { headers });
      assert.equal(listed.status, 200); assert.deepEqual(await listed.json(), retry.body.invoice);
    } else assert.deepEqual(retry.body.results, [{ clientId: client.id, status: 'CREATED_CREDIT_APPLIED', invoiceId: after.invoices[0].id, amount: 80, creditUsed: 10 }]);
    const again = await post(path(client.id)); assert.equal(again.status, 200); assert.deepEqual(await snapshot(client.id), after);
    if (again.body.results) assert.deepEqual(again.body.results, [{ clientId: client.id, status: 'EXISTS', invoiceId: after.invoices[0].id, creditUsed: 0 }]);
    await retire(client.id);
  }
  console.log('PASS both APIs roll back every invoice/credit write together and return compatible final snapshots; retries create and consume credit once');

  for (const path of paths) for (const status of ['PAID', 'PARTIAL', 'PENDING', 'ISSUED', 'DRAFT', 'CANCELLED', 'VOID']) {
    const client = await fixture(), paid = status === 'PAID' ? 120 : status === 'PARTIAL' ? 40 : 0;
    await rates.save(client.id, { baseMonthlyAmount: 200, periods: [], expectedVersion: 0 }, 'invoice-page-qa');
    const invoice = await prisma.invoice.create({ data: { clientId: client.id, monthRef, total: 120, totalAmount: 120, amount: 120, amountPaid: paid, amountOpen: 120 - paid, status,
      externalInvoiceNo: status === 'ISSUED' ? `QA-${randomUUID()}` : null, notes: 'Preço histórico',
      lines: { create: [{ type: 'MONTHLY', description: 'Preço original', quantity: 1, unitPrice: 120, total: 120 }] },
      ...(paid ? { payments: { create: [{ amount: paid, amountCents: paid * 100, method: 'CASH' }] } } : {}) } });
    const before = await snapshot(client.id), payable = ['PARTIAL', 'PENDING', 'ISSUED'].includes(status);
    if (payable) await failure('CommunicationLog', client.id, async () => {
      assert.equal((await post(path(client.id))).status, 500); assert.deepEqual(await snapshot(client.id), before);
    });
    const r = await post(path(client.id)); assert.equal(r.status, 200, JSON.stringify(r));
    const after = await snapshot(client.id), saved = after.invoices[0];
    if (!payable) assert.deepEqual(after, before);
    else {
      assert.equal(saved.id, invoice.id); assert.equal(saved.total, 120); assert.equal(saved.amountPaid, paid + 10); assert.equal(saved.amountOpen, 110 - paid);
      assert.deepEqual(saved.lines, before.invoices[0].lines); assert.deepEqual(saved.payments.slice(0, before.invoices[0].payments.length), before.invoices[0].payments);
      assert.equal(saved.externalInvoiceNo, invoice.externalInvoiceNo); assert.equal(saved.notes, invoice.notes); assert.equal(after.client.creditBalance, 0);
      if (r.body.results) assert.equal(r.body.results[0].status, 'EXISTS_CREDIT_APPLIED'); else assert.equal(r.body.creditUsed, 10);
    }
    await retire(client.id);
  }
  console.log('PASS existing invoice prices, lines, cash history and fiscal references survive plan changes; available credit applies only to receivable documents');

  for (const path of paths) {
    for (const [data, plan, expected] of [[{ monthlyFee: 0 }, null, 20], [{ monthlyFee: 0 }, 120, 120], [{}, 0, 0]]) {
      const client = await fixture(data);
      if (plan !== null) await rates.save(client.id, { baseMonthlyAmount: plan, periods: [], expectedVersion: 0 }, 'invoice-page-qa');
      assert.equal((await post(path(client.id))).status, 200);
      const after = await snapshot(client.id); assert.equal(after.invoices[0].total, expected); assert.equal(after.invoices[0].lines.length, 1);
      if (!expected) { assert.equal(after.invoices[0].status, 'PAID'); assert.equal(after.invoices[0].payments.length, 0); assert.equal(after.client.creditBalance, 10); }
      await retire(client.id);
    }
  }

  const race = await fixture({ creditBalance: 50 });
  const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => post(paths[i % 2](race.id))));
  assert(responses.every(r => r.status === 200), JSON.stringify(responses));
  const raced = await snapshot(race.id); assert.equal(raced.invoices.length, 1); assert.equal(raced.invoices[0].payments.length, 1); assert.equal(raced.invoices[0].amountPaid, 50); assert.equal(raced.client.creditBalance, 0);
  await retire(race.id);
  const cash = await fixture();
  const concurrent = await Promise.all([post(paths[0](cash.id)), post(`/api/admin/payments/${cash.id}/manual-received?month=${monthRef}`, { requestId: randomUUID(), amount: 5, method: 'CASH' })]);
  assert(concurrent.every(r => r.status === 200), JSON.stringify(concurrent));
  const cashState = await snapshot(cash.id), monthly = cashState.invoices.find(i => i.monthRef === monthRef);
  assert.equal(monthly.amountPaid, 15); assert.equal(monthly.amountOpen, 65); assert.equal(cashState.client.creditBalance, 0);
  assert.equal(cashState.invoices.flatMap(i => i.payments).filter(p => p.method === 'CASH').reduce((sum, p) => sum + p.amountCents, 0), 500);
  await retire(cash.id);
  console.log('PASS unchanged legacy fallback, explicit/free plans, eight mixed batch/single requests, and simultaneous cash plus credit');

  const existingCash = await fixture();
  const receivable = await prisma.invoice.create({ data: { clientId: existingCash.id, monthRef, status: 'PENDING', total: 80, totalAmount: 80, amount: 80, amountOpen: 80,
    lines: { create: [{ type: 'MONTHLY', description: 'Mensalidade original', quantity: 1, unitPrice: 80, total: 80 }] } } });
  const existingResponses = await Promise.all([
    post(paths[0](existingCash.id)),
    post(`/api/finance-os/invoices/${receivable.id}/payments`, { requestId: randomUUID(), amount: 5, method: 'CASH' }),
  ]);
  assert.equal(existingResponses[0].status, 200, JSON.stringify(existingResponses)); assert.equal(existingResponses[1].status, 201, JSON.stringify(existingResponses));
  const existingState = await snapshot(existingCash.id);
  assert.equal(existingState.invoices.length, 1); assert.equal(existingState.invoices[0].amountPaid, 15); assert.equal(existingState.invoices[0].amountOpen, 65);
  assert.equal(existingState.client.creditBalance, 0); assert.equal(existingState.invoices[0].payments.filter(p => p.method === 'CASH').reduce((sum, p) => sum + p.amountCents, 0), 500);
  await retire(existingCash.id);
  console.log('PASS existing invoice generation and Finance OS payment share the invoice-before-client lock order and preserve both credit and cash');

  for (const change of ['plan', 'invoice', 'disabled']) {
    const client = await fixture(), locked = gate(), release = gate(); let saved;
    const write = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${client.id} FOR UPDATE`;
      if (change === 'plan') await tx.clientRatePlan.create({ data: { clientId: client.id, version: 1, snapshot: rates.validate({ baseMonthlyAmount: 140, periods: [] }), createdBy: 'invoice-page-qa' } });
      if (change === 'invoice') saved = await tx.invoice.create({ data: { clientId: client.id, monthRef, status: 'PENDING', total: 160, totalAmount: 160, amount: 160, amountOpen: 160,
        lines: { create: [{ type: 'MONTHLY', description: 'Outro gerador', quantity: 1, unitPrice: 160, total: 160 }] } } });
      if (change === 'disabled') await tx.client.update({ where: { id: client.id }, data: { billingActive: false } });
      locked.release(); await release.promise;
    }, { timeout: 15000 });
    await locked.promise; let settled = false;
    const generation = post(paths[0](client.id)).finally(() => { settled = true; });
    try { await new Promise(resolve => setTimeout(resolve, 150)); assert.equal(settled, false, 'Generation must wait for the client update'); }
    finally { release.release(); }
    await write; const result = await generation, after = await snapshot(client.id);
    assert.equal(result.status, change === 'disabled' ? 409 : 200, JSON.stringify(result));
    if (change === 'disabled') { assert.equal(after.invoices.length, 0); assert.equal(after.client.creditBalance, 10); }
    else { assert.equal(after.invoices.length, 1); assert.equal(after.invoices[0].total, change === 'plan' ? 140 : 160); assert.equal(after.invoices[0].amountPaid, 10); if (saved) assert.equal(after.invoices[0].id, saved.id); }
    await retire(client.id);
  }
  console.log('PASS plan changes, a competing generator and disabled billing are re-read after waiting for the client lock');

  const first = await fixture(), second = await fixture();
  await failure('CommunicationLog', second.id, async () => {
    assert.equal((await post(paths[1]())).status, 500);
    assert.equal((await snapshot(first.id)).invoices.length, 1); assert.equal((await snapshot(second.id)).invoices.length, 0);
  });
  const firstSaved = await snapshot(first.id), resumed = await post(paths[1]()); assert.equal(resumed.status, 200);
  assert.deepEqual(await snapshot(first.id), firstSaved); assert.equal((await snapshot(second.id)).invoices.length, 1);
  assert.deepEqual(resumed.body.results.map(r => r.status), ['EXISTS', 'CREATED_CREDIT_APPLIED']);
  for (const path of paths) {
    for (const invalid of ['2053-13', '1999-01', '', null, {}, 205301]) assert.equal((await post(path(first.id), { monthRef: invalid })).status, 400);
    assert.equal((await fetch(base + path(first.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monthRef }) })).status, 401);
  }
  for (const id of ['1.5', 'true', '-1', '2147483648']) assert.equal((await post(paths[0](id))).status, 400);
  console.log('PASS a failed batch preserves completed clients and resumes the failed client without duplication; invalid input and unauthenticated access are rejected');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await prisma.client.updateMany({ where: { id: { in: suspended } }, data: { billingActive: true } });
  await prisma.client.updateMany({ where: { id: { in: created } }, data: { billingActive: false } });
  await prisma.$disconnect();
});
