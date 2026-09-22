'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID, randomInt } = require('node:crypto'), { fork } = require('node:child_process'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
let child;
(async () => {
  const month = '2005-08', stamp = randomUUID(), admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, userId: admin.id, principalType: 'USER', role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  child = fork(require.resolve('./fixtures/financial-ai-server'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const base = await new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); });
  const configure = m => new Promise(resolve => { child.once('message', resolve); child.send(m); });
  async function api(path, body) { const r = await fetch(base + '/api/ai-admin/' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /no-store/); return r.json(); }
  async function read() { const f = (await api('status?monthRef=' + month)).context.finance; assert.notEqual(f.state, 'UNAVAILABLE'); return f.revenueCoverage; }
  const before = await read();
  const client = await prisma.client.create({ data: { name: 'Revenue <img src=x onerror=alert(1)> ' + stamp, active: false } }), other = await prisma.client.create({ data: { name: 'Other revenue owner ' + stamp } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Revenue historical pool' } });
  const sameId = randomInt(700000000, 800000000), visitData = { clientId: client.id, poolId: pool.id, status: 'DONE', endAt: new Date('2005-07-31T23:59:59Z') };
  const regular = await prisma.serviceVisit.create({ data: { ...visitData, id: sameId, revenue: 9999 } });
  await prisma.extraVisit.create({ data: { ...visitData, id: sameId, endAt: new Date('2005-08-01T00:00:00Z'), price: 8888 } });
  const line = (type, amount, extra = {}) => ({ type, description: 'Revenue QA ' + stamp, quantity: 1, unitPrice: amount, total: amount, lineTotal: amount, ...extra });
  const make = (lines, extra = {}) => { const amount = lines.reduce((n, l) => n + Math.round(l.total * 100), 0) / 100; return prisma.invoice.create({ data: { clientId: client.id, month, year: 2005, status: 'PENDING', amount, total: amount, totalAmount: amount, amountOpen: amount, lines: { create: lines }, ...extra } }); };
  const document = await make([line('MONTHLY', 80), line(' service ', 30, { referenceId: sameId }), line(null, 45, { lineType: 'EXTRA_VISIT', referenceId: sameId }), line('REPAIR', 12, { referenceId: sameId }), line('MAINTENANCE', 8, { lineType: 'MAINTENANCE_EQUIPMENT', referenceId: sameId })]);
  // Internal credit is a payment allocation, not another service or a reduction of the documented price.
  await prisma.payment.create({ data: { invoiceId: document.id, amount: 10, method: 'CREDIT', paidAt: new Date('2005-08-10Z') } });
  let r = await read();
  assert.equal(r.linkedServiceAmountCents - before.linkedServiceAmountCents, 7500); assert.equal(r.monthlyUnallocatedAmountCents - before.monthlyUnallocatedAmountCents, 8000); assert.equal(r.otherUnallocatedAmountCents - before.otherUnallocatedAmountCents, 2000); assert.equal(r.reconciledDocumentAmountCents - before.reconciledDocumentAmountCents, 17500);
  assert(r.linkedServices.rows.some(v => v.type === 'REGULAR' && v.id === sameId && v.serviceMonth === '2005-07')); assert(r.linkedServices.rows.some(v => v.type === 'EXTRA' && v.id === sameId && v.serviceMonth === month)); assert.equal(r.completeRevenueAllocation, false); assert.equal(r.revenue, null); assert.equal(r.profit, null);
  const mainTotal = r.documents.total;
  await make([line('MONTHLY', 99)], { monthRef: '2005-09' }); assert.equal((await read()).documents.total, mainTotal);
  await make([line('MONTHLY', 1)], { month: '8' }); assert.equal((await read()).monthlyUnallocatedAmountCents - before.monthlyUnallocatedAmountCents, 8100);
  // A current pool owner cannot rewrite the client recorded directly on historical services.
  await prisma.pool.update({ where: { id: pool.id }, data: { clientId: other.id } }); assert.equal((await read()).linkedServiceAmountCents, r.linkedServiceAmountCents);
  const duplicate = await make([line('EXTRA_VISIT', 45, { referenceId: sameId })], { month: '2005-09', status: 'ISSUED' });
  r = await read(); assert.equal(r.linkedServiceAmountCents - before.linkedServiceAmountCents, 3000); assert.equal(r.serviceReviewAmountCents - before.serviceReviewAmountCents, 4500); assert(r.issues.rows.some(i => i.reason === 'DUPLICATE_REFERENCE'));
  await prisma.invoice.update({ where: { id: duplicate.id }, data: { status: 'DRAFT' } }); assert.equal((await read()).linkedServiceAmountCents - before.linkedServiceAmountCents, 7500);
  await prisma.invoice.update({ where: { id: duplicate.id }, data: { status: 'UNKNOWN' } }); assert.equal((await read()).serviceReviewAmountCents - before.serviceReviewAmountCents, 4500);
  await prisma.invoice.update({ where: { id: duplicate.id }, data: { status: 'CANCELLED' } });
  for (const [patch, reason] of [[{ clientId: other.id }, 'CLIENT_MISMATCH'], [{ clientId: null }, 'CLIENT_MISMATCH'], [{ status: 'PENDING' }, 'SERVICE_NOT_COMPLETED'], [{ endAt: null }, 'MISSING_COMPLETION_DATE'], [{ contractService: { billing: 'INCLUDED_MONTHLY' } }, 'SERVICE_INCLUDED_OR_UNCONFIRMED']]) {
    await prisma.serviceVisit.update({ where: { id: sameId }, data: patch }); r = await read(); assert.equal(r.serviceReviewAmountCents - before.serviceReviewAmountCents, 3000); assert(r.issues.rows.some(i => i.reason === reason), reason);
    await prisma.serviceVisit.update({ where: { id: sameId }, data: { clientId: regular.clientId, status: regular.status, endAt: regular.endAt, contractService: require('@prisma/client').Prisma.DbNull } });
  }
  await prisma.extraVisit.update({ where: { id: sameId }, data: { includedInPackage: true } }); assert.equal((await read()).serviceReviewAmountCents - before.serviceReviewAmountCents, 4500); await prisma.extraVisit.update({ where: { id: sameId }, data: { includedInPackage: false } });
  const referenceCases = [[line('SERVICE', 2), 'MISSING_REFERENCE'], [line('EXTRA_VISIT', 3, { referenceId: 2147483000 }), 'MISSING_SERVICE']];
  for (const [row, reason] of referenceCases) { const created = await make([row]); r = await read(); assert(r.issues.rows.some(i => i.invoiceId === created.id && i.reason === reason)); await prisma.invoice.delete({ where: { id: created.id } }); }
  const cases = [
    [[], { amount: 5, total: 5, totalAmount: 5 }, 'NO_LINES'],
    [[line('MONTHLY', 5)], { status: 'UNKNOWN' }, 'DOCUMENT_VALUES'],
    [[line('MONTHLY', 5)], { amountCents: 1 }, 'DOCUMENT_VALUES'],
    [[line('MONTHLY', 5)], { taxAmount: 1.15 }, 'TAX_UNALLOCATED'],
    [[line('MONTHLY', 10), line('CREDIT_NOTE', -5)], {}, 'ADJUSTED_DOCUMENT'],
    [[line('MONTHLY', 5), line('ARREARS', 3)], {}, 'ADJUSTED_DOCUMENT'],
    [[line('UNRECOGNIZED', 5)], {}, 'UNSUPPORTED_LINE_TYPE'],
    [[line('MONTHLY', 5, { lineType: 'SERVICE' })], {}, 'CONFLICTING_LINE_TYPES'],
    [[line('MONTHLY', 5, { lineTotal: 4 })], {}, 'LINE_VALUES'],
    [[line('MONTHLY', 0.001)], {}, 'LINE_VALUES'],
    [[line('MONTHLY', 5)], { amount: 6, total: 6, totalAmount: 6 }, 'LINE_TOTAL_MISMATCH']
  ];
  const baseReview = await read();
  for (const [rows, patch, reason] of cases) { const created = await make(rows, patch); r = await read(); assert.equal(r.documents.review, baseReview.documents.review + 1, reason); assert.equal(r.reconciledDocumentAmountCents, baseReview.reconciledDocumentAmountCents, reason); assert(r.issues.rows.some(i => i.invoiceId === created.id && i.lineId === null && i.reason === reason), reason); await prisma.invoice.delete({ where: { id: created.id } }); }
  for (const [rows, patch] of [[[line('MONTHLY', 999)], { status: 'CANCELLED' }], [[line('MONTHLY', 999)], { status: 'DRAFT' }], [[line('CREDIT_DEPOSIT', 999)], {}]]) await make(rows, patch);
  r = await read(); assert.equal(r.documents.excluded - baseReview.documents.excluded, 3); assert.equal(r.reconciledDocumentAmountCents, baseReview.reconciledDocumentAmountCents);
  const more = await prisma.serviceVisit.createManyAndReturn({ data: Array.from({ length: 13 }, () => ({ ...visitData })) });
  await make(more.map((v, i) => line('SERVICE', i === 0 ? 0 : 0.1, { referenceId: v.id })));
  r = await read(); assert.equal(r.linkedServices.total - before.linkedServices.total, 15); assert.equal(r.linkedServices.rows.length, 10); assert.equal(r.linkedServices.sampleOnly, true); assert.equal(r.linkedServiceAmountCents - before.linkedServiceAmountCents, 7620); assert.equal(r.limitApplied, null);
  const malformedAlias = await make([line('SERVICE', 30, { lineType: 'EXTRA_VISIT', referenceId: sameId })], { month: '2005-10' }); r = await read(); assert.equal(r.serviceReviewAmountCents - before.serviceReviewAmountCents, 7500); await prisma.invoice.delete({ where: { id: malformedAlias.id } });
  for (let i = 0; i < 12; i++) await make([line('MONTHLY', 1)]); r = await read(); assert.equal(r.issues.rows.length, 10); assert.equal(r.issues.sampleOnly, true); assert.equal(r.monthlyUnallocatedAmountCents - before.monthlyUnallocatedAmountCents, 9300);
  const stored = async () => JSON.stringify(await Promise.all([prisma.invoice.findMany({ orderBy: { id: 'asc' }, include: { lines: true, payments: true } }), prisma.serviceVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }), prisma.extraVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } })]));
  const original = await stored(), actions = await prisma.aiAssistantAction.count();
  const chat = await api('chat', { message: 'Que receitas e mensalidades faltam repartir por serviço para calcular margens?', scope: 'finance', monthRef: month }); assert.match(chat.answer, /mensalidades não são divididas automaticamente/); assert.match(chat.answer, /mês do documento/); assert.match(chat.answer, /Não posso calcular lucro/); assert.deepEqual(chat.actions, []);
  await configure({ provider: 'success', reset: true }); await api('chat', { message: 'Que receitas estão documentadas?', scope: 'finance', monthRef: month }); const call = (await configure({})).calls.at(-1); assert.equal(JSON.parse(call.input[1].content[0].text).platformContext.finance.revenueCoverage.linkedServiceAmountCents, r.linkedServiceAmountCents);
  await configure({ fault: 'revenue', reset: true }); const failed = (await api('status?monthRef=' + month)).context.finance; assert.equal(failed.state, 'UNAVAILABLE'); assert.equal(failed.revenueCoverage, null); assert.equal(failed.cash, null); const fallback = await api('chat', { message: 'Receitas por serviço', scope: 'finance', monthRef: month }); assert.equal(fallback.mode, 'financial_source_unavailable'); assert.equal((await configure({})).calls.length, 0); assert(!JSON.stringify(fallback).includes('QA_PRIVATE'));
  assert.equal(await stored(), original); assert.equal(await prisma.aiAssistantAction.count(), actions);
  console.log('PASS revenue coverage: reconciled stored amounts, typed historical services and clients, document month versus completion/cash, monthly contracts unallocated, credit/debt/tax/legacy review, duplicate references across months and aliases, changed/included services, exact totals and bounded samples, read-only conversation and failed sources');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { child?.kill('SIGTERM'); await prisma.$disconnect(); });
