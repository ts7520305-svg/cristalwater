'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const pdfText = require('./lib/reportPdfText');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const client = await prisma.client.create({ data: { name: 'Cliente Łukasz · Γιάννης · Иван', active: true, phone: 'CUSTOMER_PHONE', address: 'Morada José' } });
  const other = await prisma.client.create({ data: { name: 'FOREIGN_PRIVATE_CLIENT', active: true } });
  const pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina Łukasz · Γιάννης' } });
  const tech = await prisma.technician.create({ data: { name: 'Técnico PDF', active: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = data => jwt.sign(data, getJwtSecret(), { expiresIn: '1h' });
  const adminToken = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const own = sign({ id: client.id, clientId: client.id, role: 'CLIENT', principalType: 'CLIENT' });
  const foreign = sign({ id: other.id, clientId: other.id, role: 'CLIENT', principalType: 'CLIENT' });
  const technician = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
  const invoice = await prisma.invoice.create({ data: { clientId: client.id, monthRef: '2093-01', status: 'PARTIAL', total: 123.45, totalAmount: 123.45, amount: 123.45, amountPaid: 23.45, amountOpen: 100, notes: 'INVOICE_PRIVATE_NOTES', lines: { create: Array.from({ length: 18 }, (_, index) => ({ description: `Serviço ${index + 1} · Łukasz · Γιάννης · Иван`, total: index === 0 ? -4.55 : 8, unitPrice: 8, quantity: 1 })) } } });
  await prisma.extraVisit.createMany({ data: Array.from({ length: 12 }, (_, index) => ({ clientId: client.id, poolId: pool.id, price: index === 0 ? 0.1 : 0.2, billed: false, billingMode: 'EXTRA', status: 'DONE', notes: 'EXTRA_PRIVATE_NOTES', scheduledAt: new Date('2093-01-12T12:00:00Z') })) });
  await prisma.extraVisit.createMany({ data: ['PLANNED', 'CANCELLED'].map(status => ({ clientId: client.id, poolId: pool.id, price: 999, billed: false, billingMode: 'EXTRA', status })) });
  const repair = await prisma.repair.create({ data: { poolId: pool.id, problem: 'Reparação José · Łukasz', quantity: 1, unitPrice: 999, totalPrice: 999, notes: 'REPAIR_PRIVATE_NOTES' } });
  const snapshot = require('../src/business/repair/CommercialQuoteBusiness').calculate({ lines: Array.from({ length: 10 }, (_, index) => ({ type: 'MATERIAL', description: `Bomba ${index + 1} · Łukasz · Γιάννης · Иван`, quantity: 1, unitCost: 71.13, marginPercent: 20 })), taxPercent: 23, terms: 'Condições comerciais José. '.repeat(100) + ' FIM_CONDICOES 漢' });
  snapshot.validUntil = '2093-02-01T12:00:00Z';
  const quote = await prisma.repairQuote.create({ data: { repairId: repair.id, version: 1, snapshot, createdBy: 'QA' } });
  const saved = await prisma.monthlyReport.create({ data: { type: 'CLIENT', clientId: client.id, month: '2093-01', data: { reportVersion: 2, client: 'NOME_GUARDADO Łukasz · Γιάννης · Иван', paymentStatus: 'PENDING', pools: Array.from({ length: 16 }, (_, index) => ({ name: `Piscina guardada ${index + 1} · Łukasz · Γιάννης`, totalVisits: index + 1, notDone: 1, unconfirmed: index === 15 ? 3 : 0 })) } } });
  const bad = await prisma.monthlyReport.create({ data: { type: 'CLIENT', clientId: client.id, month: '2093-02', data: { client: 'BROKEN_SNAPSHOT', pools: [{ name: 'Piscina', totalVisits: null, notDone: 0 }] } } });
  const source = async () => JSON.stringify(await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoice.id }, include: { lines: { orderBy: { id: 'asc' } } } }),
    prisma.extraVisit.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),
    prisma.repair.findUnique({ where: { id: repair.id } }), prisma.repairQuote.findUnique({ where: { id: quote.id } }),
    prisma.monthlyReport.findMany({ where: { clientId: client.id }, orderBy: { id: 'asc' } }),
    ...['invoice', 'payment', 'fieldWriteRequest', 'userAuditLog', 'stockMovement'].map(model => prisma[model].count())
  ]));
  const before = await source();
  const get = async (url, token = adminToken) => {
    const res = await fetch(base + url, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) };
  };
  const monthly = `/api/client-reports/${client.id}/reports/${saved.id}/pdf`;
  const entries = [
    [`/api/invoice-pdf/${invoice.id}`, 'invoice', ['Serviço 18', '€ 123.45', '€ 23.45', '€ 100.00', '€ -4.55', 'não fiscal'], [own, adminToken], 404],
    [`/api/invoice-pdf/extras/${client.id}`, 'extras', ['€ 2.30', 'não fiscal', 'Visita #'], [own, adminToken], 404],
    [`/api/repairs/${repair.id}/pdf`, 'quote', ['Bomba 10', 'FIM_CONDICOES [U+6F22]', `€ ${snapshot.total.toFixed(2)}`, 'não fiscal'], [adminToken], 403],
    [monthly, 'monthly', ['NOME_GUARDADO', 'Piscina guardada 16', 'Por confirmar: 3', 'UTC'], [own, adminToken], 403]
  ];
  const output = path.join(process.cwd(), 'reports/field-visual/financial-document-pdf'); await fs.mkdir(output, { recursive: true });
  for (const [url, file, expected, tokens, foreignStatus] of entries) {
    for (const token of tokens) {
      const response = await get(url, token); assert.equal(response.status, 200, response.bytes.toString());
      assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.bytes.subarray(0, 5).toString(), '%PDF-'); assert.equal(response.bytes.subarray(-6).toString(), '%%EOF\n');
      const text = pdfText(response.bytes), pages = (response.bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
      for (const value of expected) assert(text.includes(value), file + ': ' + value);
      assert(text.includes('Łukasz')); assert(text.includes('Γιάννης'));
      assert.doesNotMatch(text, /PRIVATE_NOTES|FOREIGN_PRIVATE_CLIENT|71\.13|unitCost|marginPercent/);
      if (file === 'invoice') assert.match(response.headers.get('content-disposition'), /documento-interno-/);
      if (file === 'monthly') { assert(!text.includes(client.name)); assert.match(response.headers.get('content-disposition'), /^attachment/); }
      for (let page = 1; page <= pages; page++) assert(text.includes(`Página ${page} de ${pages}`));
      if (token === adminToken) await fs.writeFile(path.join(output, file + '.pdf'), response.bytes);
    }
    for (const [token, status] of [[null, 401], [technician, 403], [foreign, foreignStatus]]) {
      const response = await get(url, token); assert.equal(response.status, status, url); assert(!response.bytes.includes(Buffer.from('%PDF-')));
    }
  }
  assert.equal((await get(`/api/repairs/${repair.id}/pdf`, own)).status, 403);
  const broken = await get(`/api/client-reports/${client.id}/reports/${bad.id}/pdf`, own);
  assert.equal(broken.status, 409); assert.match(broken.bytes.toString(), /revisão/); assert(!broken.bytes.includes(Buffer.from('%PDF-')));
  const legacy = await get('/api/client/client/reports/' + saved.id + '/pdf', own);
  assert.equal(legacy.status, 200, legacy.bytes.toString()); assert(pdfText(legacy.bytes).includes('NOME_GUARDADO'));
  assert.equal(await source(), before, 'PDF rendering must preserve all source records, versions, stock and financial receipts');
  console.log('PASS financial PDFs: Unicode, page counts, references, non-fiscal labels, exact source amounts, quote privacy, stored monthly history, complete failures, ownership and read-only sources');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
