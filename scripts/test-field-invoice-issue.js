'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  const client = await prisma.client.create({ data: { name: 'Emissão interna QA', status: 'ACTIVE' } });
  const fixture = (extra = {}) => prisma.invoice.create({ data: { clientId: client.id, status: 'DRAFT', total: 10, totalAmount: 10, amount: 10, amountOpen: 10,
    lines: { create: { type: 'SERVICE', description: 'QA', quantity: 1, unitPrice: 10, total: 10, lineTotal: 10 } }, ...extra } });
  async function post(id, action, body = {}) { const r = await fetch(`${base}/api/finance-os/invoices/${id}/${action}`, { method: 'POST', headers, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  const state = id => prisma.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true, lines: true } });
  for (const status of ['CANCELLED', 'CANCELED', 'VOID', 'ARCHIVED', 'SUPERSEDED']) {
    const invoice = await fixture({ status }), before = await state(invoice.id), result = await post(invoice.id, 'issue');
    console.log(JSON.stringify({ status, expected: 409, actual: result.status })); assert.equal(result.status, 409); assert.deepEqual(await state(invoice.id), before);
  }
  const invoice = await fixture(), number = `QA-${randomUUID()}`;
  const results = await Promise.all(Array.from({ length: 8 }, () => post(invoice.id, 'issue', { invoiceNumber: number, notes: 'Apenas uma vez' })));
  assert(results.every(r => r.status === 200), JSON.stringify(results));
  const after = await state(invoice.id); assert.equal(after.status, 'ISSUED'); assert.equal(after.notes, 'Apenas uma vez');
  assert.equal(await prisma.auditTrail.count({ where: { entity: 'Invoice', entityId: invoice.id, action: 'FINANCE_INVOICE_ISSUED' } }), 1);
  assert.equal((await post(invoice.id, 'issue', { invoiceNumber: number })).status, 200); assert.deepEqual(await state(invoice.id), after);
  assert.equal((await post(invoice.id, 'issue', { invoiceNumber: number + '-changed' })).status, 409);
  assert.equal((await post(invoice.id, 'payments', { requestId: randomUUID(), amount: 10, method: 'CASH' })).status, 201);
  const paid = await state(invoice.id); assert.equal((await post(invoice.id, 'issue', { invoiceNumber: number })).status, 200); assert.deepEqual(await state(invoice.id), paid);
  const legacyPaid = await fixture({ status: 'PAID', amountPaid: 10, amountOpen: 0 }); assert.equal((await post(legacyPaid.id, 'issue')).status, 409);
  const duplicate = await fixture(); assert.equal((await post(duplicate.id, 'issue', { invoiceNumber: number })).status, 409); assert.equal((await state(duplicate.id)).status, 'DRAFT');
  for (let i = 0; i < 6; i++) {
    const f = await fixture(); const replies = await Promise.all([post(f.id, 'issue'), post(f.id, 'cancel')]);
    assert(replies.every(r => [200, 409].includes(r.status)), JSON.stringify(replies)); assert.equal((await state(f.id)).status, 'CANCELLED');
  }
  console.log('PASS withdrawn documents stay withdrawn; issue is one transition, numbers remain immutable and paid invoices retain their state');
  const failed = await fixture(), before = await state(failed.id);
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_issue_failure() RETURNS trigger AS $$ BEGIN IF NEW.action = 'FINANCE_INVOICE_ISSUED' AND NEW."entityId" = ${failed.id} THEN RAISE EXCEPTION 'QA issue failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_issue_failure BEFORE INSERT ON "AuditTrail" FOR EACH ROW EXECUTE FUNCTION qa_issue_failure()');
  try { assert.equal((await post(failed.id, 'issue')).status, 500); assert.deepEqual(await state(failed.id), before); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_issue_failure ON "AuditTrail"'); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_issue_failure()'); }
  assert.equal((await post(failed.id, 'issue')).status, 200);
  console.log('PASS audit failure rolls back internal issue and retry succeeds');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
