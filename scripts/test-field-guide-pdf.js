'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
const pdfText = require('./lib/reportPdfText');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));

(async () => {
  const stamp = Date.now();
  const vehicle = await prisma.vehicle.create({ data: { plate: 'PDF-' + stamp, name: 'Viatura Łukasz · Γιάννης · Иван', active: true } });
  const otherVehicle = await prisma.vehicle.create({ data: { plate: 'PDF-OTHER-' + stamp, active: true } });
  const tech = await prisma.technician.create({ data: { name: 'José Łukasz', vehicleId: vehicle.id, active: true, pin: 'PDF_PRIVATE_PIN' } });
  const foreign = await prisma.technician.create({ data: { name: 'Outro técnico PDF', vehicleId: otherVehicle.id, active: true } });
  const client = await prisma.client.create({ data: { name: 'Cliente PDF', active: true } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const sign = data => jwt.sign(data, getJwtSecret(), { expiresIn: '1h' });
  const adminToken = sign({ id: admin.id, role: 'ADMIN', principalType: 'USER' });
  const techToken = sign({ id: tech.id, technicianId: tech.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
  const foreignToken = sign({ id: foreign.id, technicianId: foreign.id, role: 'TECHNICIAN', principalType: 'TECHNICIAN' });
  const clientToken = sign({ id: client.id, clientId: client.id, role: 'CLIENT', principalType: 'CLIENT' });
  const items = Array.from({ length: 12 }, (_, index) => ({ name: `Material ${index + 1} · Łukasz · Γιάννης`, type: 'CHEMICAL', unit: 'kg', quantity: 10 }));
  const guide = await prisma.transportGuide.create({ data: { vehicleId: vehicle.id, codeAT: 'PDF-AT-' + stamp, status: 'ACTIVE', isDraft: false, validUntil: new Date(Date.now() + 86400000), origin: 'Armazém · Иван', destination: 'Rota José', items: { create: items } } });
  const work = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, guideId: guide.id, status: 'OPEN', isDraft: false, items: { create: items.map(item => ({ ...item, initialQty: 12, usedQty: 2 })) } } });
  const provisional = await prisma.workGuide.create({ data: { vehicleId: vehicle.id, technicianId: tech.id, status: 'OPEN' } });
  await prisma.vehicleStockMovement.create({ data: { vehicleId: vehicle.id, workGuideId: work.id, technicianId: tech.id, itemName: 'Material consumido Łukasz', quantity: 2, unit: 'kg', notes: 'Nota original · Γιάννης · Иван' } });
  const insurance = await prisma.vehicleMaintenanceRecord.create({ data: { vehicleId: vehicle.id, type: 'INSURANCE', title: 'Apólice Łukasz · Γιάννης · Иван', status: 'ACTIVE', notes: 'Detalhe da apólice José. '.repeat(240) + ' FIM_APOLICE 漢', dueDate: new Date(Date.now() + 86400000 * 30) } });
  const snapshot = async () => JSON.stringify(await Promise.all([
    prisma.vehicle.findUnique({ where: { id: vehicle.id } }),
    prisma.transportGuide.findUnique({ where: { id: guide.id }, include: { items: { orderBy: { id: 'asc' } } } }),
    prisma.workGuide.findUnique({ where: { id: work.id }, include: { items: { orderBy: { id: 'asc' } } } }),
    prisma.workGuide.findUnique({ where: { id: provisional.id } }),
    prisma.vehicleStockMovement.findMany({ where: { workGuideId: work.id }, orderBy: { id: 'asc' } }),
    prisma.vehicleMaintenanceRecord.findUnique({ where: { id: insurance.id } }),
    ...['invoice', 'payment', 'fieldWriteRequest', 'userAuditLog', 'systemSetting'].map(model => prisma[model].count())
  ]));
  const before = await snapshot();
  const request = async (route, token = adminToken) => {
    const res = await fetch(base + '/api/guides' + route, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
    const bytes = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, bytes };
  };
  const endpoints = [
    [`/transport/${guide.id}/pdf`, 'transport', ['Armazém · Иван', 'Material 12', 'Łukasz · Γιάννης']],
    [`/transport/latest/${vehicle.id}/pdf`, 'latest', ['Material 12', guide.codeAT]],
    [`/work/${work.id}/pdf`, 'work', ['José Łukasz', 'Material consumido Łukasz', 'Nota original · Γιάννης · Иван', 'Leitura final do stock']],
    [`/vehicles/${vehicle.id}/insurance/pdf`, 'insurance', ['Apólice Łukasz · Γιάννης · Иван', 'FIM_APOLICE [U+6F22]']]
  ];
  const output = path.join(process.cwd(), 'reports/field-visual/guide-pdf');
  await fs.mkdir(output, { recursive: true });
  for (const [route, filename, expected] of endpoints) {
    for (const token of [adminToken, techToken]) {
      const res = await request(route, token);
      assert.equal(res.status, 200, route + ': ' + res.bytes.subarray(0, 200));
      assert.equal(res.headers.get('content-type'), 'application/pdf');
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.bytes.subarray(-6).toString(), '%%EOF\n');
      const text = pdfText(res.bytes), pages = (res.bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
      for (const item of expected) assert(text.includes(item), item);
      assert(!text.includes('PDF_PRIVATE_PIN'));
      for (let page = 1; page <= pages; page++) assert(text.includes(`Página ${page} de ${pages}`));
      if (token === adminToken) await fs.writeFile(path.join(output, filename + '.pdf'), res.bytes);
    }
    for (const [token, status] of [[null, 401], [clientToken, 403], [foreignToken, 403]]) {
      const res = await request(route, token);
      assert.equal(res.status, status, route);
      assert(!res.bytes.includes(Buffer.from('%PDF-')));
    }
    const id = route.match(/\d+/)[0];
    for (const invalid of ['+' + id, '0' + id, id + '.0', id + 'e0', [...id].map(c => '%' + c.charCodeAt(0).toString(16)).join(''), '2147483648']) {
      assert.equal((await request(route.replace(id, invalid), foreignToken)).status, 400, invalid);
    }
    assert.equal((await request(route.toUpperCase(), foreignToken)).status, 400);
  }
  const provisionalResult = await request(`/work/${provisional.id}/pdf`, techToken);
  assert.equal(provisionalResult.status, 200);
  assert(pdfText(provisionalResult.bytes).includes('GUIA PROVISORIA'));
  const empty = await request(`/vehicles/${otherVehicle.id}/insurance/pdf`);
  assert.equal(empty.status, 200);
  assert(pdfText(empty.bytes).includes('Seguro não registado'));
  assert.equal((await request('/work/2147483647/pdf')).status, 404);
  // The same raw-path scope also protects the document metadata endpoints.
  for (const route of [`/vehicles/${vehicle.id}/insurance`, `/vehicles/${vehicle.id}/stock-preset`, `/transport/latest/${vehicle.id}`, `/transport/${guide.id}/document`]) {
    assert.equal((await request(route, foreignToken)).status, 403);
    assert.equal((await request(route.replace(/\d+/, id => '+' + id), foreignToken)).status, 400);
    assert.equal((await request(route.toUpperCase(), foreignToken)).status, 400);
  }
  assert.equal(await snapshot(), before, 'PDF reads must preserve source records, stock, invoices, payments and receipts');
  console.log('PASS guide PDFs: four endpoints, Unicode, long content, page counts, private cache, role/vehicle isolation, alternate ID rejection, missing/provisional records and unchanged sources');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
