'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const billing = require('../src/business/finance/MonthlyBillingBusiness'), rates = require('../src/business/finance/ClientRateBusiness');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
function gate() { let release; return { promise: new Promise(resolve => { release = resolve; }), release: () => release() }; }
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function create(name, prices = [12.3, 7.7], creditBalance = 0) {
    const client = await prisma.client.create({ data: { name, active: true, billingActive: true, status: 'ACTIVE', monthlyFee: 80, monthlyAmount: 80, creditBalance } });
    for (const monthlyAmount of prices) await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina preços QA', monthlyAmount } });
    return client;
  }
  const plan = (id, baseMonthlyAmount, periods = [], expectedVersion = 0) => rates.save(id, { baseMonthlyAmount, periods, expectedVersion }, 'monthly-rates-qa');
  const read = (clientId, monthRef) => prisma.invoice.findUniqueOrThrow({ where: { clientId_monthRef: { clientId, monthRef } }, include: { lines: true, payments: true } });
  const balance = async id => (await prisma.client.findUniqueOrThrow({ where: { id } })).creditBalance;
  const target = await create('Plano substitui piscinas QA', [12.3, 7.7], 15);
  await plan(target.id, 120);
  const response = await fetch(base + '/api/billing/generate-monthly', { method: 'POST', headers, body: JSON.stringify({ monthRef: '2050-01' }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  const first = await read(target.id, '2050-01');
  console.log(JSON.stringify({ expectedMonthly: 120, actualMonthly: first.total, poolPrices: 20, legacyClientPrice: 80 }));
  assert.equal(first.total, 120, 'An explicit plan replaces, rather than adds to or ignores, the pool and legacy client prices');
  assert.equal(first.totalAmount, 120); assert.equal(first.amount, 120); assert.equal(first.amountPaid, 15); assert.equal(first.amountOpen, 105);
  assert.equal(first.lines.length, 1); assert.equal(first.lines[0].type, 'MONTHLY'); assert.equal(first.lines[0].sourceMonth, '2050-01');
  assert.equal(first.payments.length, 1); assert.equal(first.payments[0].amountCents, 1500); assert.equal(await balance(target.id), 0);
  const audit = await prisma.userAuditLog.findFirstOrThrow({ where: { action: 'MONTHLY_RATE_APPLIED', entityId: String(first.id) } });
  assert.equal(audit.metadata.planVersion, 1); assert.equal(audit.metadata.pricing.amount, 120);
  await plan(target.id, 200, [], 1);
  assert.equal((await billing.generateForClient(target.id, '2050-01')).changed, false); assert.deepEqual(await read(target.id, '2050-01'), first);
  await billing.generateForClient(target.id, '2050-02'); assert.equal((await read(target.id, '2050-02')).total, 200);
  assert.equal(await prisma.userAuditLog.count({ where: { action: 'MONTHLY_RATE_APPLIED', entityId: String(first.id) } }), 1);
  console.log('PASS the actual legacy monthly API uses the client plan once, records its version and keeps old invoices unchanged after repricing');

  const free = await create('Plano gratuito QA', [120], 17);
  await plan(free.id, 90, [{ startsOn: '2050-01-01', endsOn: '2050-01-31', monthlyAmount: 0 }]);
  assert.equal((await billing.generateForClient(free.id, '2050-01')).changed, false);
  assert.equal(await prisma.invoice.count({ where: { clientId: free.id } }), 0); assert.equal(await balance(free.id), 17);
  const noPools = await create('Plano sem preço antigo QA', []);
  await prisma.client.update({ where: { id: noPools.id }, data: { monthlyFee: 0, monthlyAmount: 0 } });
  await plan(noPools.id, 0, [{ startsOn: '2050-01-01', endsOn: null, monthlyAmount: 90 }]);
  await billing.generateForClient(noPools.id, '2050-01'); assert.equal((await read(noPools.id, '2050-01')).total, 90);
  const leap = await create('Plano proporcional QA');
  await plan(leap.id, 80, [{ startsOn: '2028-02-15', endsOn: '2028-02-29', monthlyAmount: 120 }]);
  const calculations = ['2028-01', '2028-02', '2028-03'];
  for (const month of calculations) {
    const expected = rates.calculate((await rates.latest(leap.id)).snapshot, month).amount;
    await billing.generateForClient(leap.id, month); assert.equal((await read(leap.id, month)).total, expected);
  }
  assert.equal((await read(leap.id, '2028-02')).total, 100.69);
  const legacy = await create('Sem plano mantém piscinas QA'); await billing.generateForClient(legacy.id, '2050-01');
  assert.equal((await read(legacy.id, '2050-01')).total, 20); assert.equal((await read(legacy.id, '2050-01')).lines.length, 2);
  console.log('PASS free periods, a plan without legacy prices, leap-year prorating, inclusive period boundaries and unchanged no-plan fallback');

  for (const status of ['PENDING', 'DRAFT', 'ISSUED', 'PAID', 'PARTIAL', 'CANCELLED']) {
    const client = await create('Plano com documento existente QA', [20], 5); await plan(client.id, 120);
    await prisma.invoice.create({ data: { clientId: client.id, monthRef: '2051-01', status, total: 7, amount: 7, amountOpen: 7,
      lines: { create: [{ type: 'SERVICE', description: 'Documento anterior sem mensalidade', quantity: 1, unitPrice: 7, total: 7 }] } } });
    const before = await read(client.id, '2051-01'); assert.equal((await billing.generateForClient(client.id, '2051-01')).changed, false);
    assert.deepEqual(await read(client.id, '2051-01'), before); assert.equal(await balance(client.id), 5);
  }
  const concurrent = await create('Plano concorrente QA', [20], 130); await plan(concurrent.id, 120);
  const generated = await Promise.all(Array.from({ length: 8 }, () => billing.generateForClient(concurrent.id, '2051-02')));
  assert.equal(generated.filter(r => r.changed).length, 1); assert.equal((await read(concurrent.id, '2051-02')).total, 120); assert.equal(await balance(concurrent.id), 10);
  assert.equal(await prisma.userAuditLog.count({ where: { action: 'MONTHLY_RATE_APPLIED', entityId: String((await read(concurrent.id, '2051-02')).id) } }), 1);

  const changing = await create('Plano gravado durante geração QA'); await plan(changing.id, 20);
  const locked = gate(), release = gate();
  const change = prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${changing.id} FOR UPDATE`;
    await tx.clientRatePlan.create({ data: { clientId: changing.id, version: 2, snapshot: rates.validate({ baseMonthlyAmount: 140, periods: [] }), createdBy: 'monthly-rates-qa' } });
    locked.release(); await release.promise;
  }, { timeout: 15000 });
  await locked.promise; let settled = false;
  const generation = billing.generateForClient(changing.id, '2051-03').finally(() => { settled = true; });
  try { await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(settled, false, 'Generation must wait for the in-flight client plan'); }
  finally { release.release(); }
  await change; await generation; assert.equal((await read(changing.id, '2051-03')).total, 140);
  console.log('PASS existing documents are immutable, eight requests create one monthly line/audit, and in-flight plan changes are re-read under the client lock');

  const competing = await create('Outro gerador prepara documento QA', [20], 12); await plan(competing.id, 120);
  const creating = gate(), releaseDraft = gate(); let createdDraft;
  const draftWrite = prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${competing.id} FOR UPDATE`;
    createdDraft = await tx.invoice.create({ data: { clientId: competing.id, monthRef: '2051-05', status: 'DRAFT', total: 120, amount: 120, amountOpen: 0 } });
    creating.release(); await releaseDraft.promise;
  }, { timeout: 15000 });
  await creating.promise; let monthlySettled = false;
  const monthlyWrite = billing.generateForClient(competing.id, '2051-05').finally(() => { monthlySettled = true; });
  try { await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(monthlySettled, false); }
  finally { releaseDraft.release(); }
  await draftWrite; assert.equal((await monthlyWrite).changed, false);
  assert.deepEqual(await prisma.invoice.findUniqueOrThrow({ where: { id: createdDraft.id } }), createdDraft);
  assert.equal(await balance(competing.id), 12); assert.equal(await prisma.invoice.count({ where: { clientId: competing.id } }), 1);
  console.log('PASS an invoice committed by another client-locked generator is re-read and preserved instead of colliding or consuming credit');

  const failed = await create('Plano com auditoria revertida QA', [20], 15), beforeClient = await prisma.client.findUniqueOrThrow({ where: { id: failed.id } });
  await plan(failed.id, 120);
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_monthly_rate_failure() RETURNS trigger AS $$ BEGIN IF NEW.action = 'MONTHLY_RATE_APPLIED' AND (NEW.metadata->>'clientId')::int = ${failed.id} THEN RAISE EXCEPTION 'QA monthly rate failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe('CREATE TRIGGER qa_monthly_rate_failure BEFORE INSERT ON "UserAuditLog" FOR EACH ROW EXECUTE FUNCTION qa_monthly_rate_failure()');
  try {
    await assert.rejects(billing.generateForClient(failed.id, '2051-04'));
    assert.equal(await prisma.invoice.count({ where: { clientId: failed.id } }), 0);
    assert.deepEqual(await prisma.client.findUniqueOrThrow({ where: { id: failed.id } }), beforeClient);
    assert.equal(await prisma.communicationLog.count({ where: { clientId: failed.id } }), 0);
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS qa_monthly_rate_failure ON "UserAuditLog"');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_monthly_rate_failure()');
  }
  await billing.generateForClient(failed.id, '2051-04'); assert.equal((await read(failed.id, '2051-04')).amountPaid, 15);
  console.log('PASS a failed price audit rolls back invoice, lines, credit and payment; retry applies the saved plan once');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
