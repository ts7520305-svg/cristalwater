'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const finance = require('../src/business/finance/FinanceOsBusiness');
const credit = require('../src/services/clientCreditService');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
let browser;
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const client = await prisma.client.create({ data: { name: 'Rascunhos por rever QA', status: 'ACTIVE', creditBalance: 40 } });
  const create = (status = 'DRAFT', values = {}) => prisma.invoice.create({ data: { clientId: client.id, status, amount: 20, total: 20, totalAmount: 20,
    amountOpen: 20, lines: { create: [{ type: 'SERVICE', description: 'Extra ainda por rever QA', quantity: 1, unitPrice: 20, total: 20, lineTotal: 20 }] }, ...values } });
  const paths = [id => `/api/payments/invoice/${id}`, id => `/api/core/invoices/${id}/pay`, id => `/api/finance-os/invoices/${id}/payments`, () => '/api/operational-flow/pay-invoice'];
  async function pay(path, id, amount = 10, authHeaders = headers) {
    const response = await fetch(base + path(id), { method: 'POST', headers: authHeaders, body: JSON.stringify({ amount, invoiceId: id }) });
    return { status: response.status, body: await response.json() };
  }
  const outcomes = [];
  for (const path of paths) {
    const draft = await create();
    const response = await pay(path, draft.id);
    outcomes.push({ path: path(draft.id), response: response.status, payments: await prisma.payment.count({ where: { invoiceId: draft.id } }), status: (await prisma.invoice.findUnique({ where: { id: draft.id } })).status });
  }
  console.log(JSON.stringify(outcomes));
  assert(outcomes.every(row => row.response === 409 && row.payments === 0 && row.status === 'DRAFT'), 'Drafts must reject payments without changing financial records');
  const protectedRows = [];
  for (const status of [...credit.NON_RECEIVABLE_STATUSES, ' draft ']) {
    const invoice = await create(status, { dueDate: new Date('2020-01-01T00:00:00Z') }); protectedRows.push(invoice);
    for (const path of paths) {
      const result = await pay(path, invoice.id, 25);
      assert.equal(result.status, 409, JSON.stringify({ path: path(invoice.id), status, result }));
      assert.equal(result.body.ok, false);
    }
    assert.equal((await credit.applyClientCreditToInvoice(prisma, invoice.id)).creditUsed, 0);
    assert.deepEqual(await prisma.invoice.findUnique({ where: { id: invoice.id } }), invoice);
  }
  assert.equal(await prisma.payment.count({ where: { invoice: { clientId: client.id } } }), 0);
  assert.equal(await prisma.notification.count({ where: { clientId: client.id } }), 0);
  assert.equal((await prisma.client.findUnique({ where: { id: client.id } })).creditBalance, 40);
  const before = (await finance.getCustomerBalance(client.id)).balance;
  assert.equal(before.totalInvoiced, 0); assert.equal(before.totalOpen, 0); assert.equal(before.totalPaid, 0);
  const account = (await finance.getCustomerAccount(client.id)).account;
  assert.equal(account.debtBalance, 0); assert.equal(account.runningBalanceHistory.length, 0);
  assert(account.invoiceHistory.every(row => row.openAmount === 0 && row.issuedAt === null));
  assert(!(await finance.getOutstandingDebtReport()).invoices.some(row => row.clientId === client.id));
  console.log('PASS four payment APIs reject draft/cancelled/withdrawn documents without payment, credit, notification or source changes; automatic credit and Finance OS debt exclude them');

  const payable = await create('ISSUED');
  const paid = await Promise.all(Array.from({ length: 8 }, (_, i) => pay(paths[i % paths.length], payable.id, 1)));
  for (const result of paid) assert([200, 201].includes(result.status), JSON.stringify(result));
  const after = await prisma.invoice.findUniqueOrThrow({ where: { id: payable.id } });
  assert.equal(after.amountPaid, 8); assert.equal(after.amountOpen, 12); assert.equal(after.status, 'PARTIAL');
  assert.equal(await prisma.payment.count({ where: { invoiceId: payable.id } }), 8);
  assert.equal((await finance.getCustomerBalance(client.id)).balance.totalOpen, 12);
  const originalDraft = protectedRows[0];
  assert.equal((await finance.issueInvoice(originalDraft.id, {}, 'QA')).ok, true);
  assert.equal((await pay(paths[0], originalDraft.id, 5)).status, 200);
  assert.equal((await prisma.invoice.findUnique({ where: { id: originalDraft.id } })).amountPaid, 5);
  const credited = await create('PENDING');
  const appliedCredit = await credit.applyClientCreditToInvoice(prisma, credited.id);
  assert.equal(appliedCredit.creditUsed, 20); assert.equal(appliedCredit.invoice.status, 'PAID');
  assert.equal((await credit.applyClientCreditToInvoice(prisma, credited.id)).creditUsed, 0);
  assert.equal((await prisma.client.findUnique({ where: { id: client.id } })).creditBalance, 20);
  console.log('PASS eight concurrent payments across all APIs retain every applied amount; explicit issue enables payment; legacy pending documents still accept credit once');

  const onlyDraftClient = await prisma.client.create({ data: { name: 'Adiantamento com rascunho QA', status: 'ACTIVE' } });
  const onlyDraft = await create('DRAFT', { clientId: onlyDraftClient.id });
  const advance = await fetch(base + `/api/admin/payments/${onlyDraftClient.id}/manual-received`, { method: 'POST', headers, body: '{"amount":10}' });
  assert.equal(advance.status, 200);
  const advanceBody = await advance.json(); assert.equal(advanceBody.appliedAmount, 0); assert.equal(advanceBody.creditAdded, 10);
  assert.equal(await prisma.payment.count({ where: { invoiceId: onlyDraft.id } }), 0);
  assert.deepEqual(await prisma.invoice.findUnique({ where: { id: onlyDraft.id } }), onlyDraft);
  console.log('PASS an explicitly received client advance becomes credit, never a payment on an unreviewed draft');

  const tech = await prisma.technician.create({ data: { name: 'Draft payment permissions QA' } });
  for (const actor of [{ id: client.id, clientId: client.id, role: 'CLIENT' }, { id: tech.id, technicianId: tech.id, role: 'TECHNICIAN' }]) {
    const forbidden = jwt.sign(actor, getJwtSecret(), { expiresIn: '1h' });
    for (const path of paths) assert.equal((await pay(path, onlyDraft.id, 10, { ...headers, Authorization: `Bearer ${forbidden}` })).status, 403);
  }
  for (const path of paths) assert.equal((await pay(path, onlyDraft.id, 10, { 'Content-Type': 'application/json' })).status, 401);
  console.log('PASS all payment entry points retain administrative authorization');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); await prisma.$disconnect(); });
