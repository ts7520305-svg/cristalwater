// Dates span two calendar years; this is accelerated API simulation, not elapsed uptime.
require('../src/loadEnv')();
const assert = require('node:assert/strict');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { prisma } = require('../src/prismaClient');
const schedule = require('../src/services/roundScheduleService');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local QA backend required');
const stamp = Date.now(), report = { status: 'RUNNING', start: '2027-01-01', end: '2028-12-31', days: 0, visits: 0, invoices: 0, replays: 0, checks: [] };
let auth;
async function call(method, url, body, expected = [200, 201]) {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  assert(expected.includes(response.status) && (response.status >= 400 || data.ok !== false), `${method} ${url}: ${response.status} ${data.error || data.message || ''}`);
  return data;
}
function check(name) { report.checks.push(name); console.log('PASS ' + name); }
(async () => {
  auth = (await call('POST', '/api/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).token;
  assert(auth);
  const teams = [], customers = [], visitIds = [];
  for (let i = 0; i < 2; i++) {
    const technician = await require('./helpers/create-reviewed-technician')(call, { name: `Long QA ${i} ${stamp}`, email: `long-${stamp}-${i}@qa.test`, pin: `91230${i}` });
    const vehicle = await require('./helpers/create-reviewed-vehicle')(call, { plate: `LY-${i}-${String(stamp).slice(-8)}`, name: `Long QA ${i}` });
    await call('POST', '/api/guides/vehicles/assign', { technicianId: technician.id, vehicleId: vehicle.id, startKm: 100 });
    const guides = await call('POST', '/api/guides/transport', { codeAT: `QA-LONG-${stamp}-${i}`, vehicleId: vehicle.id, technicianId: technician.id, validFrom: '2027-01-01T00:00:00Z', validUntil: '2029-01-01T00:00:00Z', origin: 'QA warehouse', destination: 'QA route', isDraft: false, items: [{ name: 'Cloro pastilhas', type: 'CHEMICAL', unit: 'KG', quantity: 1000 }] });
    assert(guides.workGuide);
    teams.push({ technician, vehicle, guide: guides.workGuide });
  }
  for (let i = 0; i < 3; i++) {
    const client = (await call('POST', '/api/core/clients', { name: `Long client ${stamp}-${i}`, email: `long-client-${stamp}-${i}@qa.test`, monthlyFee: 0, requiresInvoice: false })).client;
    await call('POST', `/api/core/clients/${client.id}/activate`, { amount: 0 });
    const pool = (await call('POST', `/api/core/clients/${client.id}/pools`, { name: `Long pool ${stamp}-${i}`, type: 'POOL', volumeM3: 50, monthlyAmount: 80, disinfectionType: 'CLORO', address: `QA ${stamp}-${i}` })).pool;
    customers.push({ client, pool });
  }
  // Iterate every day, including leap day; exercise actual visit APIs every Tuesday.
  let weekly = 0, monthly = 0;
  for (let date = new Date(2027, 0, 1, 9); date < new Date(2029, 0, 1, 9); date.setDate(date.getDate() + 1)) {
    report.days++;
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    assert.equal(schedule.matches({ recurrence: 'MONTHLY', dayOfMonth: 31 }, date), date.getDate() === monthEnd);
    if (date.getDate() === monthEnd) monthly++;
    assert.equal(schedule.matches({ recurrence: 'WEEKLY', dayOfWeek: 2 }, date), date.getDay() === 2);
    if (date.getDay() !== 2) continue;
    weekly++;
    for (const [i, { pool }] of customers.entries()) {
      const team = teams[(weekly + i) % teams.length];
      const visit = (await call('POST', '/api/core/visits', { poolId: pool.id, technicianId: team.technician.id, plannedDate: date.toISOString(), notes: `Long API ${stamp}` })).visit;
      const body = { clientRequestId: randomUUID(), ph: 7.4, chlorine: 1.5, workGuideId: team.guide.id, vehicleId: team.vehicle.id, products: [{ name: 'Cloro pastilhas', quantity: 0.5, unit: 'KG' }], cleaned: true, notes: 'QA accelerated history' };
      await call('POST', `/api/core/visits/${visit.id}/complete`, body);
      if (weekly % 13 === 0) {
        await Promise.all([call('POST', `/api/core/visits/${visit.id}/complete`, body), call('POST', `/api/core/visits/${visit.id}/complete`, body)]);
        report.replays += 2;
      }
      visitIds.push(visit.id); report.visits++;
    }
  }
  assert.equal(report.days, 731); assert.equal(monthly, 24); assert.equal(weekly, 104);
  assert.equal(await prisma.serviceVisit.count({ where: { id: { in: visitIds }, status: 'DONE' } }), report.visits);
  assert.equal(await prisma.chemicalUsage.count({ where: { visitId: { in: visitIds } } }), report.visits);
  assert.equal(await prisma.vehicleStockMovement.count({ where: { visitId: { in: visitIds }, movementType: 'CONSUMPTION' } }), report.visits);
  const used = await prisma.workGuideItem.aggregate({ where: { workGuideId: { in: teams.map(t => t.guide.id) } }, _sum: { usedQty: true } });
  assert.equal(Number(used._sum.usedQty), report.visits * 0.5);
  check('731 calendar days, leap year, 312 completed visits, 48 replay requests and exact chemical consumption');
  for (let m = 0; m < 24; m++) {
    const monthRef = `${2027 + Math.floor(m / 12)}-${String(m % 12 + 1).padStart(2, '0')}`;
    for (const { client } of customers) {
      const invoice = (await call('POST', '/api/core/invoices/generate', { clientId: client.id, monthRef })).invoice;
      await call('POST', '/api/core/invoices/generate', { clientId: client.id, monthRef }, [409]);
      assert.equal(await prisma.invoice.count({ where: { clientId: client.id, monthRef } }), 1);
      assert.equal(Number(invoice.total), 80);
      // Two different genuine payments arriving concurrently must both be accounted for.
      await Promise.all([call('POST', `/api/core/invoices/${invoice.id}/pay`, { amount: 20, method: 'TRANSFER', notes: 'QA first payment' }), call('POST', `/api/core/invoices/${invoice.id}/pay`, { amount: 20, method: 'TRANSFER', notes: 'QA second payment' })]);
      const saved = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true } });
      assert.equal(saved.payments.reduce((sum, payment) => sum + Number(payment.amount), 0), 40);
      assert.equal(Number(saved.amountPaid), 40, 'Concurrent payments lost from invoice balance');
      assert.equal(Number(saved.amountOpen), 40); assert.equal(saved.status, 'PARTIAL');
      report.invoices++;
    }
    console.log('MONTH ' + monthRef);
  }
  assert.equal(report.invoices, 72);
  check('24 billing months, 72 unique invoices, 144 concurrent partial payments reconciled');
  // Historical GPS fixture tests retrieval after the history exceeds one page.
  const points = Array.from({ length: 1100 }, (_, i) => ({ technicianId: teams[0].technician.id, latitude: 37 + i / 100000, longitude: -8, createdAt: new Date(Date.UTC(2027, 0, 1, 0, i)) }));
  await prisma.technicianTrack.createMany({ data: points });
  const history = await call('GET', `/api/gps/history/${teams[0].technician.id}?scope=TECHNICIAN&limit=1000`);
  assert.equal(history.length, 1000);
  assert.equal(history[history.length - 1].createdAt, points[1099].createdAt.toISOString(), 'GPS history drops the most recent positions after the first page');
  assert.equal(history[0].createdAt, points[100].createdAt.toISOString());
  check('GPS history keeps the latest 1000 positions in chronological order');
  report.status = 'PASS';
})().catch(error => { report.status = 'FAIL'; report.error = error.message; console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.mkdirSync('reports/field-suite', { recursive: true });
  fs.writeFileSync(`reports/field-suite/two-year-api-${stamp}.json`, JSON.stringify(report, null, 2));
  await prisma.$disconnect();
});
