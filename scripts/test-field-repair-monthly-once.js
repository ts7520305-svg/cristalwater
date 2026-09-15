'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002'; assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const paths = ['/api/core/invoices/generate', '/api/core/invoices/generate-legacy', '/api/operational-flow/generate-monthly-invoice'];
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const headers = { Authorization: `Bearer ${jwt.sign({ id: admin.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' })}`, 'Content-Type': 'application/json' };
  async function fixture() {
    const client = await prisma.client.create({ data: { name: 'Reparação cobrada uma vez QA', active: true, billingActive: true, status: 'ACTIVE', monthlyFee: 20, monthlyAmount: 20 } });
    const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina QA' } });
    const repair = await prisma.repair.create({ data: { poolId: pool.id, problem: 'Reparação única', status: 'DONE', totalPrice: 9 } });
    return { client, pool, repair };
  }
  async function generate(path, clientId, monthRef) {
    const r = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify({ clientId, monthRef }) });
    const body = await r.json(); assert.equal(r.status, 200, JSON.stringify(body)); return body.invoice;
  }
  for (const first of paths) for (const next of paths) {
    const f = await fixture(), january = await generate(first, f.client.id, '2054-01');
    assert.equal(january.total, 29);
    const february = await generate(next, f.client.id, '2054-02');
    console.log(JSON.stringify({ first, next, expectedSecondMonth: 20, actualSecondMonth: february.total }));
    assert.equal(february.total, 20, 'An unpaid repair must not be charged again in another month');
    assert.equal(await prisma.invoiceLine.count({ where: { type: 'REPAIR', referenceId: f.repair.id } }), 1);
    const old = await prisma.invoice.findUniqueOrThrow({ where: { id: january.id }, include: { lines: true } });
    assert.equal(old.total, 29); assert.deepEqual(old.lines, january.lines.map(l => ({ ...l, createdAt: new Date(l.createdAt), serviceDate: l.serviceDate ? new Date(l.serviceDate) : null })));
    assert.equal((await prisma.repair.findUniqueOrThrow({ where: { id: f.repair.id } })).paid, false);
  }
  for (const status of ['PENDING', 'PARTIAL', 'PAID', 'ISSUED', 'DRAFT', 'CANCELLED', 'VOID']) for (const kind of ['type', 'lineType']) {
    const f = await fixture(), oldClient = await fixture();
    // A source remains reserved even if its pool has changed client or its document was withdrawn.
    const old = await prisma.invoice.create({ data: { clientId: oldClient.client.id, monthRef: null, status, total: 9,
      lines: { create: [{ [kind]: 'REPAIR', referenceId: f.repair.id, description: 'Reparação anterior', total: 9 }] } }, include: { lines: true } });
    const current = await generate(paths[0], f.client.id, '2054-03'); assert.equal(current.total, 20);
    assert.deepEqual(await prisma.invoice.findUniqueOrThrow({ where: { id: old.id }, include: { lines: true } }), old);
  }
  const separate = await fixture();
  await prisma.invoice.create({ data: { clientId: separate.client.id, monthRef: '2054-04', lines: { create: [{ type: 'SERVICE', referenceId: separate.repair.id, description: 'Outra categoria', total: 5 }] } } });
  assert.equal((await generate(paths[0], separate.client.id, '2054-05')).total, 29, 'A numeric reference from another source category must not hide a repair');
  const race = await fixture();
  const concurrent = await Promise.all(Array.from({ length: 9 }, (_, i) => generate(paths[i % 3], race.client.id, `2055-${String(i + 1).padStart(2, '0')}`)));
  assert.equal(concurrent.reduce((sum, invoice) => sum + invoice.total, 0), 189);
  assert.equal(await prisma.invoiceLine.count({ where: { type: 'REPAIR', referenceId: race.repair.id } }), 1);
  console.log('PASS nine route pairs, historical states and both reference fields, cross-client history, category isolation and nine concurrent months preserve one repair charge');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
