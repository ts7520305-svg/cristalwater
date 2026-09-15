'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const { createCreditLedgerPayment, applyClientCreditToInvoice } = require('../src/services/clientCreditService');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const cents = value => Math.round(value * 100);
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}` };
  async function get(path) { const r = await fetch(base + '/api/finance-os/' + path, { headers }); return { status: r.status, body: await r.json() }; }
  const before = await get('reports/cashflow'), revenueBefore = await get('reports/revenue');
  const client = await prisma.client.create({ data: { name: 'Caixa real QA', status: 'ACTIVE', active: true } });
  await createCreditLedgerPayment(prisma, client.id, 100, { method: 'CASH' });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', total: 50, amount: 50, totalAmount: 50, amountOpen: 50 } });
  await applyClientCreditToInvoice(prisma, invoice);
  const after = await get('reports/cashflow'), revenueAfter = await get('reports/revenue');
  console.log(JSON.stringify({ expectedCashCents: 10000, actualCashCents: cents(after.body.cashflow.inflow) - cents(before.body.cashflow.inflow) }));
  assert.equal(cents(after.body.cashflow.inflow) - cents(before.body.cashflow.inflow), 10000);
  assert.equal(cents(revenueAfter.body.revenue) - cents(revenueBefore.body.revenue), 10000);
  const draft = await prisma.invoice.create({ data: { clientId: client.id, status: 'DRAFT', total: 99, amount: 99, totalAmount: 99, amountOpen: 99 } });
  assert.equal(cents((await get('reports/cashflow')).body.cashflow.billed), cents(after.body.cashflow.billed));
  const archiveCredit = (await get('balances/company')).body.balance.customerCreditLiability;
  await prisma.client.update({ where: { id: client.id }, data: { active: false } });
  assert.equal((await get('balances/company')).body.balance.customerCreditLiability, archiveCredit);
  console.log('PASS using prepaid credit is not new cash; drafts are not billed revenue and archived client credit remains a liability');
  await prisma.payment.createMany({ data: Array.from({ length: 10001 }, () => ({ invoiceId: draft.id, amount: 0.01, amountCents: 1, method: 'CASH', paidAt: new Date('2059-02-28T12:00:00Z') })) });
  await prisma.payment.createMany({ data: [
    { invoiceId: draft.id, amount: 7, amountCents: 700, method: 'CASH', paidAt: new Date('2059-03-01T00:00:00Z') },
    { invoiceId: draft.id, amount: 5, amountCents: 500, method: ' credit ', paidAt: new Date('2059-02-28T12:00:00Z') },
    { invoiceId: draft.id, amount: 6, amountCents: 600, method: 'CREDIT_NOTE', paidAt: new Date('2059-02-28T12:00:00Z') },
  ] });
  const february = await get('reports/revenue?monthRef=2059-02&limit=100');
  assert.equal(february.status, 200); assert.equal(february.body.revenue, 100.01); assert.equal(february.body.paymentsCount, 10001);
  const monthly = (await get('reports/monthly-revenue')).body.monthlyRevenue;
  assert.equal(monthly.find(row => row.monthRef === '2059-02').amount, 100.01);
  assert.equal(monthly.find(row => row.monthRef === '2059-03').amount, 7);
  assert.equal((await get('reports/revenue?monthRef=2059-13')).status, 400);
  console.log('PASS cash totals include more than 10000 movements, exclude internal methods and use exact calendar month boundaries');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
