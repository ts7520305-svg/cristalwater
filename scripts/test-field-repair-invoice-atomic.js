'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function request(path, body, method = 'POST') { const r = await fetch(base + path, { method, headers, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  async function fixture() {
    const client = await prisma.client.create({ data: { name: 'Fatura reparação atómica QA', active: true, billingActive: true, status: 'ACTIVE', monthlyFee: 20 } });
    const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina reparação QA' } });
    const repair = await prisma.repair.create({ data: { poolId: pool.id, problem: 'Bomba', status: 'DONE', totalPrice: 9 } });
    return { client, pool, repair };
  }
  const invoiceRepair = (f, monthRef = '2056-01') => request(`/api/repairs/${f.repair.id}/invoice`, { monthRef }, 'PUT');
  const snapshot = async f => ({
    repair: await prisma.repair.findUniqueOrThrow({ where: { id: f.repair.id } }),
    invoices: await prisma.invoice.findMany({ where: { clientId: f.client.id }, include: { lines: true, payments: true } }),
    history: await prisma.technicalHistory.findMany({ where: { poolId: f.pool.id }, orderBy: { id: 'asc' } }),
    notifications: await prisma.notification.findMany({ where: { clientId: f.client.id }, orderBy: { id: 'asc' } }),
    audits: await prisma.auditTrail.findMany({ where: { entity: 'Repair', entityId: f.repair.id }, orderBy: { id: 'asc' } }),
  });
  const first = await fixture(), generated = await invoiceRepair(first);
  assert.equal(generated.status, 200, JSON.stringify(generated));
  console.log(JSON.stringify({ expectedRepairId: first.repair.id, actualReference: generated.body.invoice.lines[0].referenceId }));
  assert.equal(generated.body.invoice.lines[0].referenceId, first.repair.id);
  assert.equal(generated.body.invoice.lines[0].type, 'REPAIR'); assert.equal(generated.body.invoice.lines[0].lineType, 'REPAIR');
  const saved = await snapshot(first); assert.equal(saved.repair.status, 'INVOICED'); assert.equal(saved.invoices[0].status, 'ISSUED');
  assert.equal((await invoiceRepair(first, '2056-02')).status, 409); assert.deepEqual(await snapshot(first), saved);
  const next = await request('/api/core/invoices/generate', { clientId: first.client.id, monthRef: '2056-02' });
  assert.equal(next.status, 200); assert.equal(next.body.invoice.total, 20);
  const draftBody = { clientId: first.client.id, standalone: true, lines: [{ type: 'REPAIR', referenceId: first.repair.id, description: 'Duplicada', quantity: 1, unitPrice: 9, total: 9 }] };
  assert.equal((await request('/api/finance-os/invoices/draft', draftBody)).status, 409);

  const other = await fixture();
  for (const referenceId of [-1, true, {}, '2x', 1.5, 2147483648]) assert.equal((await request('/api/finance-os/invoices/draft', { ...draftBody, clientId: other.client.id, lines: [{ ...draftBody.lines[0], referenceId }] })).status, 400);
  assert.equal((await request('/api/finance-os/invoices/draft', { ...draftBody, clientId: other.client.id })).status, 409);
  assert.equal(await prisma.invoice.count({ where: { clientId: other.client.id } }), 0);
  for (const amount of [-1, true, {}, '', 0.001, 'NaN']) assert.equal((await request(`/api/repairs/${other.repair.id}/invoice`, { monthRef: '2056-01', amount }, 'PUT')).status, 400);
  for (const monthRef of ['2056-13', '', null, {}]) assert.equal((await request(`/api/repairs/${other.repair.id}/invoice`, { monthRef }, 'PUT')).status, 400);
  const legacy = await fixture();
  await prisma.repair.update({ where: { id: legacy.repair.id }, data: { status: 'INVOICED' } });
  assert.equal((await invoiceRepair(legacy)).status, 409); assert.equal(await prisma.invoice.count({ where: { clientId: legacy.client.id } }), 0);
  const duplicate = { type: 'REPAIR', referenceId: other.repair.id, description: 'Repetida no documento', total: 9 };
  assert.equal((await request('/api/finance-os/invoices/draft', { clientId: other.client.id, standalone: true, lines: [duplicate, duplicate] })).status, 409);
  console.log('PASS source identity survives dedicated invoicing; future months, generic drafts, wrong clients and duplicate/malformed references cannot charge it again');

  const race = await fixture();
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => invoiceRepair(race, `2057-${String(i + 1).padStart(2, '0')}`)));
  assert.equal(results.filter(r => r.status === 200).length, 1, JSON.stringify(results)); assert.equal(results.filter(r => r.status === 409).length, 5);
  assert.equal(await prisma.invoiceLine.count({ where: { type: 'REPAIR', referenceId: race.repair.id } }), 1);
  const mixed = await fixture();
  const competing = await Promise.all([invoiceRepair(mixed), request('/api/core/invoices/generate', { clientId: mixed.client.id, monthRef: '2056-03' })]);
  assert.equal(competing[1].status, 200, JSON.stringify(competing)); assert([200, 409].includes(competing[0].status));
  assert.equal(await prisma.invoiceLine.count({ where: { type: 'REPAIR', referenceId: mixed.repair.id } }), 1);
  console.log('PASS repeated dedicated requests and competition with monthly generation reserve a repair once');

  for (const table of ['Repair', 'TechnicalHistory', 'AuditTrail', 'Notification']) {
    const f = await fixture(), before = await snapshot(f);
    const condition = table === 'Repair' ? `NEW.id = ${f.repair.id}` : table === 'TechnicalHistory' ? `NEW."poolId" = ${f.pool.id}` : `NEW."clientId" = ${f.client.id}`;
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_repair_invoice_failure() RETURNS trigger AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA repair invoice failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_repair_invoice_failure BEFORE ${table === 'Repair' ? 'UPDATE' : 'INSERT'} ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_repair_invoice_failure()`);
    try {
      const r = await invoiceRepair(f); assert.equal(r.status, 500, JSON.stringify(r));
      assert.deepEqual(await snapshot(f), before, `Failure writing ${table} must roll back invoice, repair and records`);
      console.log(`PASS rollback after forced ${table} failure`);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_repair_invoice_failure ON "${table}"`);
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_repair_invoice_failure()');
    }
    assert.equal((await invoiceRepair(f)).status, 200); assert.equal(await prisma.invoice.count({ where: { clientId: f.client.id } }), 1);
  }
  console.log('PASS failed repair status, technical history, audit or notification writes roll back the complete invoice; retry creates once');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
