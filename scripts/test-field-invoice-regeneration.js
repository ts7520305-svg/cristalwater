'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const paths = ['/api/core/invoices/generate', '/api/core/invoices/generate-legacy', '/api/operational-flow/generate-monthly-invoice'];
function gate() { let release; return { promise: new Promise(resolve => { release = resolve; }), release: () => release() }; }
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function post(path, body) { const r = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; }
  async function fixture(creditBalance = 10) {
    const client = await prisma.client.create({ data: { name: 'Fatura preservada QA', active: true, status: 'ACTIVE', billingActive: true, monthlyFee: 80, monthlyAmount: 90, creditBalance } });
    const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina faturação QA', monthlyAmount: 20 } });
    const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'DONE', date: new Date('2052-01-15T12:00:00Z'), revenue: 15 } });
    const outside = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'DONE', date: new Date('2051-12-15T12:00:00Z'), revenue: 11 } });
    const extra = await prisma.extraVisit.create({ data: { clientId: client.id, poolId: pool.id, status: 'DONE', isBillable: true, billingStatus: 'PENDING', scheduledAt: new Date('2052-01-16T12:00:00Z'), totalPrice: 7 } });
    const repair = await prisma.repair.create({ data: { poolId: pool.id, problem: 'Reparação QA', status: 'DONE', totalPrice: 9 } });
    return { client, pool, visit, outside, extra, repair };
  }
  async function snapshot(f) {
    return {
      client: await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } }),
      invoices: await prisma.invoice.findMany({ where: { clientId: f.client.id }, include: { lines: { orderBy: { id: 'asc' } }, payments: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } }),
      visits: await prisma.serviceVisit.findMany({ where: { clientId: f.client.id }, orderBy: { id: 'asc' } }),
      extra: await prisma.extraVisit.findUniqueOrThrow({ where: { id: f.extra.id } }),
      repair: await prisma.repair.findUniqueOrThrow({ where: { id: f.repair.id } }),
      logs: await prisma.communicationLog.findMany({ where: { clientId: f.client.id }, orderBy: { id: 'asc' } }),
    };
  }
  for (const path of paths) for (const state of ['PAID', 'PARTIAL', 'PENDING', 'ISSUED', 'DRAFT', 'CANCELLED', 'VOID']) {
    const f = await fixture();
    const paid = state === 'PAID' ? 120 : state === 'PARTIAL' ? 40 : 0;
    const invoice = await prisma.invoice.create({ data: { clientId: f.client.id, monthRef: '2052-01', status: state, amount: 120, total: 120, totalAmount: 120,
      amountPaid: paid, amountOpen: 120 - paid, paidAt: paid === 120 ? new Date('2052-01-20T12:00:00Z') : null,
      notes: 'Histórico a preservar', externalInvoiceNo: state === 'ISSUED' ? `QA-${randomUUID()}` : null,
      lines: { create: [{ type: 'MONTHLY', description: 'Preço original', quantity: 1, unitPrice: 120, total: 120, lineTotal: 120 }] },
      ...(paid ? { payments: { create: [{ amount: paid, amountCents: paid * 100, method: 'CASH', notes: 'Pagamento original' }] } } : {}) } });
    const before = await snapshot(f), r = await post(path, { clientId: f.client.id, monthRef: '2052-01' });
    if (r.status !== 409) console.log(JSON.stringify({ path, originalStatus: state, response: r.status, originalTotal: 120, returnedTotal: r.body.invoice?.total, originalCredit: 10, remainingCredit: (await snapshot(f)).client.creditBalance }));
    assert.equal(r.status, 409, 'Generation must refuse to replace an existing invoice'); assert.equal(r.body.code, 'INVOICE_ALREADY_EXISTS'); assert.equal(r.body.invoice.id, invoice.id);
    assert.deepEqual(await snapshot(f), before, `${path} changed financial history or source billing flags`);
  }
  console.log('PASS all three generators preserve paid, partial, pending, issued, draft and withdrawn invoices, original line/payment identities, credit and unbilled sources');

  for (const [index, path] of paths.entries()) {
    const f = await fixture(), r = await post(path, { clientId: f.client.id, monthRef: '2052-01' });
    assert.equal(r.status, 200, JSON.stringify(r)); const after = await snapshot(f), invoice = after.invoices[0];
    const expected = index === 0 ? 131 : index === 1 ? 109 : 99;
    assert.equal(invoice.total, expected); assert.equal(invoice.amountPaid, 10); assert.equal(invoice.amountOpen, expected - 10);
    assert.equal(invoice.payments.length, 1); assert.equal(after.client.creditBalance, 0);
    assert.equal(after.visits.find(v => v.id === f.outside.id).billed, false);
    assert.equal(after.visits.find(v => v.id === f.visit.id).billed, index !== 1); assert.equal(after.extra.billed, index === 0);
    assert.equal(invoice.lines.reduce((sum, l) => sum + Math.round(l.total * 100), 0), expected * 100);
    assert.equal((await post(path, { clientId: f.client.id, monthRef: '2052-01' })).status, 409); assert.deepEqual(await snapshot(f), after);
  }
  console.log('PASS fresh invoices preserve each generator’s pricing/sources, return final credit balances and only mark visits in the requested month');
  for (const path of paths) {
    const f = await fixture(); await prisma.repair.update({ where: { id: f.repair.id }, data: { totalPrice: -3 } });
    const before = await snapshot(f); assert.equal((await post(path, { clientId: f.client.id, monthRef: '2052-01' })).status, 400);
    assert.deepEqual(await snapshot(f), before, 'A negative source must not create a total that disagrees with its positive invoice lines');
  }

  const race = await fixture(50);
  const responses = await Promise.all(Array.from({ length: 9 }, (_, i) => post(paths[i % paths.length], { clientId: race.client.id, monthRef: '2052-01' })));
  assert.equal(responses.filter(r => r.status === 200).length, 1); assert.equal(responses.filter(r => r.status === 409).length, 8);
  const raced = await snapshot(race); assert.equal(raced.invoices.length, 1); assert.equal(raced.invoices[0].payments.length, 1);
  assert.equal(raced.invoices[0].amountPaid, 50); assert.equal(raced.client.creditBalance, 0);
  console.log('PASS nine concurrent requests across the three APIs produce one complete invoice and one credit payment');

  const receiptRace = await fixture();
  const mixed = await Promise.all([
    post(paths[0], { clientId: receiptRace.client.id, monthRef: '2052-01' }),
    post(`/api/admin/payments/${receiptRace.client.id}/manual-received?month=2052-01`, { requestId: randomUUID(), amount: 5, method: 'CASH' }),
  ]);
  assert(mixed.every(r => r.status === 200), JSON.stringify(mixed));
  const mixedState = await snapshot(receiptRace), monthlyInvoice = mixedState.invoices.find(i => i.monthRef === '2052-01');
  assert.equal(monthlyInvoice.total, 131); assert.equal(monthlyInvoice.amountPaid, 15); assert.equal(monthlyInvoice.amountOpen, 116); assert.equal(mixedState.client.creditBalance, 0);
  assert.equal(mixedState.invoices.flatMap(i => i.payments).filter(p => p.method === 'CASH').reduce((sum, p) => sum + p.amountCents, 0), 500);
  console.log('PASS a receipt during generation preserves cash plus previous credit regardless of commit order');

  for (const [table, timing] of [['InvoiceLine', 'INSERT'], ['CommunicationLog', 'INSERT'], ['ServiceVisit', 'UPDATE'], ['ExtraVisit', 'UPDATE']]) {
    const f = await fixture(), before = await snapshot(f);
    const condition = table === 'InvoiceLine' ? `NEW.description = 'Mensalidade 2052-01'` : `NEW."clientId" = ${f.client.id}`;
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION qa_generation_failure() RETURNS trigger AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'QA generation failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER qa_generation_failure BEFORE ${timing} ON "${table}" FOR EACH ROW EXECUTE FUNCTION qa_generation_failure()`);
    try {
      const r = await post(paths[0], { clientId: f.client.id, monthRef: '2052-01' }); assert.equal(r.status, 500);
      assert.deepEqual(await snapshot(f), before, `Failure on ${table} must roll back the complete generation`);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS qa_generation_failure ON "${table}"`);
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS qa_generation_failure()');
    }
    assert.equal((await post(paths[0], { clientId: f.client.id, monthRef: '2052-01' })).status, 200);
    assert.equal((await post(paths[0], { clientId: f.client.id, monthRef: '2052-01' })).status, 409);
  }
  console.log('PASS failures writing invoice lines, credit communication and source billing flags roll back invoice, payments and credit; retry creates once');

  for (const table of ['serviceVisit', 'extraVisit']) {
    const f = await fixture(), locked = gate(), releaseSource = gate();
    const id = table === 'serviceVisit' ? f.visit.id : f.extra.id;
    const claim = prisma.$transaction(async tx => {
      await tx[table].update({ where: { id }, data: { billed: true } }); locked.release(); await releaseSource.promise;
    }, { timeout: 15000 });
    await locked.promise; const generation = post(paths[0], { clientId: f.client.id, monthRef: '2052-01' });
    try { await new Promise(resolve => setTimeout(resolve, 100)); } finally { releaseSource.release(); }
    await claim; const result = await generation, after = await snapshot(f);
    assert([200, 409].includes(result.status), JSON.stringify(result));
    if (result.status === 409) { assert.equal(after.invoices.length, 0); assert.equal(after.client.creditBalance, 10); }
    else {
      // If the claim committed before source selection, safely omit that source.
      assert.equal(after.invoices.length, 1); assert.equal(after.invoices[0].total, table === 'serviceVisit' ? 116 : 124);
      assert.equal(after.invoices[0].lines.some(l => l.type === (table === 'serviceVisit' ? 'SERVICE' : 'EXTRA_VISIT') && l.referenceId === id), false);
    }
    assert.equal((await prisma[table].findUniqueOrThrow({ where: { id } })).billed, true);
  }
  console.log('PASS a visit claimed concurrently cannot be charged again; the losing generation rolls back its invoice and credit');

  const during = await fixture(), held = gate(), release = gate(); let saved;
  const writer = prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${during.client.id} FOR UPDATE`;
    saved = await tx.invoice.create({ data: { clientId: during.client.id, monthRef: '2052-01', status: 'DRAFT', total: 160 } });
    held.release(); await release.promise;
  }, { timeout: 15000 });
  await held.promise; const generation = post(paths[0], { clientId: during.client.id, monthRef: '2052-01' });
  try { await new Promise(resolve => setTimeout(resolve, 100)); } finally { release.release(); }
  await writer; const refused = await generation; assert.equal(refused.status, 409); assert.equal(refused.body.invoice.id, saved.id);
  assert.deepEqual(await prisma.invoice.findUniqueOrThrow({ where: { id: saved.id } }), saved);
  assert.equal((await snapshot(during)).client.creditBalance, 10);
  for (const path of paths) {
    for (const body of [{ clientId: during.client.id, monthRef: '2052-13' }, { clientId: during.client.id, monthRef: {} }, { clientId: 1.5, monthRef: '2052-02' }, { clientId: true, monthRef: '2052-02' }]) assert.equal((await post(path, body)).status, 400);
    assert.equal((await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: during.client.id, monthRef: '2052-02' }) })).status, 401);
  }
  console.log('PASS a competing generator’s committed document is preserved; invalid identities/months and unauthenticated generation are rejected');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
