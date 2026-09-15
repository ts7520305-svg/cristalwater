'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient'), business = require('../src/business/repair/RepairBusiness');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const user = { id: admin.id, role: 'ADMIN' };
  const headers = { Authorization: `Bearer ${jwt.sign(user, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function fixture() {
    const client = await prisma.client.create({ data: { name: 'Pagamento reparação QA', status: 'ACTIVE', creditBalance: 5 } });
    const pool = await prisma.pool.create({ data: { name: 'Piscina QA', clientId: client.id } });
    const repair = await prisma.repair.create({ data: { poolId: pool.id, problem: 'Bomba', status: 'INVOICED', totalPrice: 10 } });
    const invoice = await prisma.invoice.create({ data: { clientId: client.id, status: 'ISSUED', total: 10, totalAmount: 10, amount: 10, amountOpen: 10,
      lines: { create: { type: 'REPAIR', lineType: 'REPAIR', referenceId: repair.id, description: 'Bomba', quantity: 1, unitPrice: 10, total: 10, lineTotal: 10 } } } });
    return { client, pool, repair, invoice };
  }
  const body = (f, amount = 10) => ({ requestId: randomUUID(), invoiceId: f.invoice.id, amount, method: 'CASH', notes: 'QA' });
  async function pay(f, data) { const response = await fetch(`${base}/api/repairs/${f.repair.id}/payment`, { method: 'PUT', headers, body: JSON.stringify(data) }); return { status: response.status, body: await response.json() }; }
  const snapshot = async f => ({ client: await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } }), repair: await prisma.repair.findUniqueOrThrow({ where: { id: f.repair.id } }),
    invoices: await prisma.invoice.findMany({ where: { clientId: f.client.id }, include: { payments: true, lines: true }, orderBy: { id: 'asc' } }),
    history: await prisma.technicalHistory.findMany({ where: { poolId: f.pool.id }, orderBy: { id: 'asc' } }),
    audit: await prisma.auditTrail.findMany({ where: { clientId: f.client.id }, orderBy: { id: 'asc' } }),
    notifications: await prisma.notification.findMany({ where: { clientId: f.client.id }, orderBy: { id: 'asc' } }) });
  const own = await fixture(), foreign = await fixture(), foreignBefore = await snapshot(foreign);
  const wrong = await business.registerRepairPayment(own.repair.id, body(foreign), prisma, 'QA', user);
  console.log(JSON.stringify({ expectedStatus: 409, actual: wrong.status, ok: wrong.ok }));
  assert.equal(wrong.status, 409); assert.deepEqual(await snapshot(foreign), foreignBefore);
  const another = await prisma.repair.create({ data: { poolId: own.pool.id, problem: 'Outra', status: 'INVOICED' } });
  assert.equal((await pay({ ...own, repair: another }, body(own))).status, 409);
  const partial = body(own, 4), first = await pay(own, partial); assert.equal(first.status, 200, JSON.stringify(first));
  const after = await snapshot(own); assert.equal(after.repair.paid, false); assert.equal(after.invoices[0].amountPaid, 4);
  const retries = await Promise.all(Array.from({ length: 8 }, () => pay(own, partial)));
  assert(retries.every(r => r.status === 200 && r.body.idempotent === true), JSON.stringify(retries)); assert.deepEqual(await snapshot(own), after);
  assert.equal((await pay(own, { ...partial, amount: 5 })).status, 409);
  const remaining = body(own, 8), last = await pay(own, remaining); assert.equal(last.status, 200, JSON.stringify(last));
  const completed = await snapshot(own); assert.equal(completed.repair.paid, true); assert.equal(completed.client.creditBalance, 7);
  assert.equal(completed.invoices.flatMap(i => i.payments).reduce((sum, p) => sum + p.amountCents, 0), 1200);
  assert.equal((await pay(own, remaining)).body.idempotent, true); assert.deepEqual(await snapshot(own), completed);
  console.log('PASS wrong client/source is rejected; partial and surplus receipts update repair and invoice once with immutable retry');
  for (const table of ['Repair', 'TechnicalHistory', 'AuditTrail', 'Notification']) {
    const f = await fixture(), before = await snapshot(f), payload = body(f);
    const condition = table === 'Repair' ? `NEW.id = ${f.repair.id}` : table === 'TechnicalHistory' ? `NEW."poolId" = ${f.pool.id}` : `NEW."clientId" = ${f.client.id} AND NEW."eventType" = 'REPAIR_PAYMENT_RECORDED'`;
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_repair_payment_failure() RETURNS trigger AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA repair payment failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_repair_payment_failure BEFORE ${table === 'Repair' ? 'UPDATE' : 'INSERT'} ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_repair_payment_failure()`);
    try { assert.equal((await pay(f, payload)).status, 500); assert.deepEqual(await snapshot(f), before); assert.equal(await prisma.operationalReminder.count({ where: { sourceKey: `invoice-payment:${payload.requestId}` } }), 0); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_repair_payment_failure ON "${table}"`); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_repair_payment_failure()'); }
    assert.equal((await pay(f, payload)).status, 200);
  }
  console.log('PASS state, history, audit and notification failures roll back cash, credit, repair and acknowledgement together');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
