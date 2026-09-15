'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const business = require('../src/business/finance/FinanceOsBusiness'), repository = require('../src/dal/FinanceOsRepository');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  const client = await prisma.client.create({ data: { name: 'Cancelamento QA', status: 'ACTIVE', creditBalance: 5 } });
  const fixture = (extra = {}) => prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', total: 10, totalAmount: 10, amount: 10, amountOpen: 10,
    lines: { create: [{ type: 'SERVICE', description: 'Cancelamento QA', quantity: 1, unitPrice: 10, total: 10, lineTotal: 10 }] }, ...extra } });
  async function post(id, action, body) { const r = await fetch(`${base}/api/finance-os/invoices/${id}/${action}`, { method: 'POST', headers, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  const snapshot = async id => ({ invoice: await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true, lines: true } }),
    audit: await prisma.auditTrail.findMany({ where: { entity: 'Invoice', entityId: id } }),
    notifications: await prisma.notification.findMany({ where: { clientId: client.id, eventType: 'FINANCE_INVOICE_CANCELLED', metadata: { path: ['invoiceId'], equals: id } } }),
    logs: await prisma.communicationLog.findMany({ where: { clientId: client.id, channel: 'INVOICE_CANCELLATION', referenceId: id } }) });
  // A real payment commits immediately before the cancellation transaction
  // starts. A pre-transaction invoice snapshot must never authorize cancellation.
  const raced = await fixture(), transaction = repository.transaction;
  repository.transaction = async callback => {
    repository.transaction = transaction;
    const payment = await post(raced.id, 'payments', { requestId: randomUUID(), amount: 10, method: 'CASH' });
    assert.equal(payment.status, 201, JSON.stringify(payment));
    return transaction(callback);
  };
  let result;
  try { result = await business.cancelInvoice(raced.id, { reason: 'Corrida QA' }); } finally { repository.transaction = transaction; }
  console.log(JSON.stringify({ expectedStatus: 409, actual: result.status, invoiceStatus: (await snapshot(raced.id)).invoice.status }));
  assert.equal(result.status, 409); assert.equal((await snapshot(raced.id)).invoice.status, 'PAID');
  console.log('PASS payment committed before cancellation transaction cannot be hidden by an older invoice read');
  const single = await fixture();
  const cancelled = await Promise.all(Array.from({ length: 8 }, () => post(single.id, 'cancel', { reason: 'Serviço retirado' })));
  assert(cancelled.every(r => r.status === 200), JSON.stringify(cancelled));
  const after = await snapshot(single.id); assert.equal(after.invoice.status, 'CANCELLED'); assert.equal(after.audit.length, 1); assert.equal(after.notifications.length, 1); assert.equal(after.logs.length, 1);
  assert.equal((await post(single.id, 'payments', { amount: 1 })).status, 409);
  assert.equal((await post(single.id, 'cancel', { reason: 'Outra repetição' })).status, 200); assert.deepEqual(await snapshot(single.id), after);
  const legacy = await fixture({ amountPaid: 0, payments: { create: { amount: 1, amountCents: 100, method: 'CASH' } } });
  assert.equal((await post(legacy.id, 'cancel', {})).status, 409, 'Payment ledger must block cancellation even with stale amountPaid');
  for (let i = 0; i < 8; i++) {
    const invoice = await fixture();
    const responses = await Promise.all([post(invoice.id, 'cancel', {}), post(invoice.id, 'payments', { requestId: randomUUID(), amount: 5, method: 'CASH' })]);
    assert(responses.every(r => [200, 201, 409].includes(r.status)), JSON.stringify(responses));
    const state = await snapshot(invoice.id);
    assert(!(state.invoice.status === 'CANCELLED' && state.invoice.payments.length), 'Cancelled invoice cannot contain a concurrent payment');
  }
  for (const id of ['0', '-1', '1x', '2147483648']) assert.equal((await post(id, 'cancel', {})).status, 400);
  console.log('PASS repeated and simultaneous cancellation is a single audited transition; ledger and concurrent payments are protected');
  for (const table of ['AuditTrail', 'Notification', 'CommunicationLog']) {
    const invoice = await fixture(), before = await snapshot(invoice.id);
    const condition = table === 'AuditTrail' ? `NEW.action = 'FINANCE_INVOICE_CANCELLED' AND NEW."entityId" = ${invoice.id}` : table === 'Notification' ? `NEW."eventType" = 'FINANCE_INVOICE_CANCELLED' AND NEW.metadata->>'invoiceId' = '${invoice.id}'` : `NEW.channel = 'INVOICE_CANCELLATION' AND NEW."referenceId" = ${invoice.id}`;
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_cancel_failure() RETURNS trigger AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA cancellation failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_cancel_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_cancel_failure()`);
    try { assert.equal((await post(invoice.id, 'cancel', {})).status, 500); assert.deepEqual(await snapshot(invoice.id), before); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_cancel_failure ON "${table}"`); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_cancel_failure()'); }
    assert.equal((await post(invoice.id, 'cancel', {})).status, 200);
  }
  console.log('PASS audit, notification and communication failure rolls back cancellation; retries then succeed');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
