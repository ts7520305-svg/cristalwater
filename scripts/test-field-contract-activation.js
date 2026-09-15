'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const paths = [id => `/api/core/clients/${id}/activate`, id => `/api/core/clients/${id}/activate-contract`, id => `/api/clients/${id}/activate`, id => `/api/clients/${id}/activate-contract`];
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function post(path, body, h = headers) { const r = await fetch(base + path, { method: 'POST', headers: h, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  const fixture = () => prisma.client.create({ data: { name: 'Contrato e saldo QA', status: 'SETUP', active: true, contractActive: false, billingActive: false, creditBalance: 5, paymentStatus: 'PARTIAL', lastPaymentAt: new Date('2050-01-01T12:00:00Z') } });
  const snapshot = async id => ({
    client: await prisma.client.findUniqueOrThrow({ where: { id } }),
    invoices: await prisma.invoice.findMany({ where: { clientId: id }, include: { lines: true, payments: true }, orderBy: { id: 'asc' } }),
    logs: await prisma.communicationLog.findMany({ where: { clientId: id }, orderBy: { id: 'asc' } }),
    audits: await prisma.userAuditLog.findMany({ where: { entity: 'Client', entityId: String(id), action: 'CONTRACT_ACTIVATED' }, orderBy: { id: 'asc' } }),
  });
  for (const path of paths) {
    const client = await fixture(), payload = { requestId: randomUUID(), monthRef: '2058-01', amount: 10, method: 'CASH' };
    const first = await post(path(client.id), payload); assert.equal(first.status, 200, JSON.stringify(first));
    const after = await snapshot(client.id); console.log(JSON.stringify({ path: path(client.id), expectedCredit: 15, actualCredit: after.client.creditBalance }));
    assert.equal(after.client.creditBalance, 15, 'Initial receipt must preserve earlier credit');
    assert.equal(after.invoices.flatMap(i => i.payments).reduce((sum, p) => sum + p.amountCents, 0), 1000); assert.equal(after.client.contractActive, true);
    assert.equal(after.audits.length, 1);
    for (const retryPath of paths) { const retry = await post(retryPath(client.id), payload); assert.equal(retry.status, 200); assert.equal(retry.body.idempotent, true); assert.equal(retry.body.requestReceipt.requestId, payload.requestId); }
    assert.deepEqual(await snapshot(client.id), after);
    assert.equal((await post(path(client.id), { ...payload, amount: 11 })).status, 409);
    assert.equal((await post(path(client.id), { ...payload, requestId: randomUUID() })).status, 409);
    assert.equal((await post(`/api/admin/payments/${client.id}/manual-received?month=2058-01`, { requestId: payload.requestId, amount: 10, method: 'CASH' })).status, 409);
  }
  console.log('PASS four activation APIs preserve prior credit, record real payments once and share an immutable acknowledgement');
  const zero = await fixture(), empty = await post(paths[0](zero.id), { amount: '' }); assert.equal(empty.status, 200);
  const noPayment = await snapshot(zero.id); assert.equal(noPayment.client.creditBalance, 5); assert.equal(noPayment.client.paymentStatus, zero.paymentStatus); assert.deepEqual(noPayment.client.lastPaymentAt, zero.lastPaymentAt); assert.equal(noPayment.invoices.length, 0);
  assert.equal((await post(paths[1](zero.id), { amount: 0 })).status, 200); assert.deepEqual(await snapshot(zero.id), noPayment);
  const legacy = await fixture(); assert.equal((await post(paths[2](legacy.id), { amount: 10 })).status, 200); assert.equal((await post(paths[3](legacy.id), { amount: 10 })).status, 409); assert.equal((await snapshot(legacy.id)).client.creditBalance, 15);
  const debt = await fixture(); await prisma.invoice.create({ data: { clientId: debt.id, status: 'ISSUED', total: 9, totalAmount: 9, amount: 9, amountOpen: 9 } });
  assert.equal((await post(paths[0](debt.id), { requestId: randomUUID(), amount: 10, monthRef: '2058-01' })).status, 200);
  const paid = await snapshot(debt.id); assert.equal(paid.client.creditBalance, 6); assert.equal(paid.invoices[0].amountPaid, 9); assert.equal(paid.invoices[0].amountOpen, 0);
  console.log('PASS activation without a receipt preserves payment history; initial cash pays older debt and only its excess increases credit');
  const race = await fixture(), payload = { requestId: randomUUID(), amount: 10, monthRef: '2058-02' };
  const concurrent = await Promise.all(Array.from({ length: 8 }, (_, i) => post(paths[i % 4](race.id), payload)));
  assert(concurrent.every(r => r.status === 200), JSON.stringify(concurrent)); assert.equal((await snapshot(race.id)).client.creditBalance, 15);
  const mixed = await fixture();
  const results = await Promise.all([post(paths[0](mixed.id), { ...payload, requestId: randomUUID() }), post(`/api/admin/payments/${mixed.id}/manual-received?month=2058-02`, { requestId: randomUUID(), amount: 7, method: 'CASH' })]);
  assert(results.every(r => r.status === 200), JSON.stringify(results)); assert.equal((await snapshot(mixed.id)).client.creditBalance, 22);
  const invalid = await fixture();
  for (const path of paths) {
    for (const amount of [-1, true, {}, 0.001, 'NaN']) assert.equal((await post(path(invalid.id), { amount })).status, 400);
    assert.equal((await post(path(invalid.id), { amount: 10, requestId: 'invalid' })).status, 400);
    assert.equal((await post(path(invalid.id), { amount: 10 }, { 'Content-Type': 'application/json' })).status, 401);
  }
  const failed = await fixture(), before = await snapshot(failed.id), failedBody = { ...payload, requestId: randomUUID() };
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_activation_failure() RETURNS trigger AS $$ BEGIN IF NEW.action = 'CONTRACT_ACTIVATED' AND NEW."entityId" = '${failed.id}' THEN RAISE EXCEPTION 'QA activation failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_activation_failure BEFORE INSERT ON "UserAuditLog" FOR EACH ROW EXECUTE FUNCTION qa_activation_failure()');
  try { assert.equal((await post(paths[0](failed.id), failedBody)).status, 500); assert.deepEqual(await snapshot(failed.id), before); assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `invoice-payment:${failedBody.requestId}` } }), 0); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_activation_failure ON "UserAuditLog"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_activation_failure()'); }
  assert.equal((await post(paths[0](failed.id), failedBody)).status, 200);
  console.log('PASS concurrent activation/receipts, rejected inputs and failed audit preserve balances and roll back activation, cash and acknowledgement together');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
