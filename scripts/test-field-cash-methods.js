'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const client = await prisma.client.create({ data: { name: 'Métodos de caixa QA', active: true, creditBalance: 5 } });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', total: 20, totalAmount: 20, amount: 20, amountOpen: 20,
    lines: { create: { description: 'Serviço QA', type: 'SERVICE', quantity: 1, unitPrice: 20, total: 20, lineTotal: 20 } } } });
  const paths = [`/api/payments/invoice/${invoice.id}`, `/api/core/invoices/${invoice.id}/pay`, `/api/finance-os/invoices/${invoice.id}/payments`, '/api/operational-flow/pay-invoice', `/api/admin/payments/${client.id}/manual-received`];
  const pay = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: invoice.id, month: '2026-09', amount: 1, ...body }) }); return { status: r.status, body: await r.json() }; };
  const first = await pay(paths[0], { method: 'CREDIT' }); console.log(JSON.stringify({ internalMethodStatus: first.status, expected: 400 })); assert.equal(first.status, 400);
  for (const path of paths) for (const method of ['CREDIT', ' credit_note ', 'ADJUSTMENT', ' credit_adjustment ']) for (const keyed of [false, true]) {
    const reply = await pay(path, { method, ...(keyed ? { requestId: randomUUID() } : {}) }); assert.equal(reply.status, 400, path + JSON.stringify(reply));
  }
  assert.equal(await prisma.payment.count({ where: { invoice: { clientId: client.id } } }), 0);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).amountOpen, 20);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).creditBalance, 5);
  const started = Date.now();
  for (const path of paths) { const r = await pay(path, { method: ' cash ', requestId: randomUUID() }); assert([200, 201].includes(r.status), path + JSON.stringify(r)); }
  const payments = await prisma.payment.findMany({ where: { invoice: { clientId: client.id } } }); assert.equal(payments.length, 5); assert(payments.every(p => p.method === 'CASH'));
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).amountOpen, 15);
  assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).creditBalance, 5);
  assert.equal(await prisma.operationalReminder.count({ where: { title: 'Pagamento registado', createdAt: { gte: new Date(started) }, metadata: { path: ['result', 'method'], equals: 'CASH' } } }), 5);
  console.log('PASS cash APIs reject reserved internal methods with and without request IDs, leave no financial changes and accept real cash methods consistently');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
