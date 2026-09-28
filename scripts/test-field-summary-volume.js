'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { randomUUID, createHash } = require('node:crypto'), { spawn } = require('node:child_process');
const { prisma } = require('../src/prismaClient'), R = require('../frontend/cw-operational-risk-rules');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const address = new URL(process.env.DATABASE_URL);
assert(['127.0.0.1', 'localhost'].includes(address.hostname) && /qa/i.test(address.pathname));
const prefix = 'QA404 ' + randomUUID(), folder = path.join(__dirname, '../reports/field-suite/summary-volume');
fs.mkdirSync(folder, { recursive: true });
const resultPath = path.join(folder, 'results.json'), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-volume-'));
fs.rmSync(path.join(folder, 'failed-probe.json'), { force: true });
const models = ['client', 'pool', 'technician', 'serviceVisit', 'invoice', 'payment', 'technicalAlert', 'notification', 'alert', 'operationalLock'];
const scenarios = [25, 100, 400], modes = ['dashboard', 'metrics', 'alerts', 'risk'], results = [], faultResults = [], projectionComparisons = [], profileRows = [];
const hashIds = values => createHash('sha256').update(values.map(String).sort().join('\n')).digest('hex');
const emptyHash = hashIds([]), at = new Date('2018-01-01T12:00:00Z');
let originalRules, rulesRead = false, clients = [], technicians = [], baseline, beforeCounts, complete = false;
fs.writeFileSync(resultPath, JSON.stringify({ ok: false, phase: 'started', scenarios }));
const tableCounts = async () => Object.fromEntries(await Promise.all(models.map(async model => [model, await prisma[model].count()])));
async function createMany(model, rows) { for (let i = 0; i < rows.length; i += 250) await prisma[model].createMany({ data: rows.slice(i, i + 250) }); }
async function addClients(target) {
  const previous = clients.length;
  await createMany('client', Array.from({ length: target - previous }, (_, i) => ({ name: prefix + ' client ' + String(previous + i).padStart(4, '0'), requiresInvoice: true, notes: 'Synthetic context '.repeat(32), fiscalName: prefix, fiscalNif: '999999990', fiscalAddress: 'QA only', fiscalEmail: 'qa@example.test' })));
  clients = await prisma.client.findMany({ where: { name: { startsWith: prefix } }, select: { id: true }, orderBy: { id: 'asc' } });
  const added = clients.slice(previous), clientIds = added.map(row => row.id);
  await createMany('pool', added.map((client, i) => ({ clientId: client.id, name: prefix, zone: prefix + ' zone ' + i % 5 })));
  const pools = await prisma.pool.findMany({ where: { clientId: { in: clientIds } }, select: { id: true, clientId: true } }), byClient = new Map(pools.map(pool => [pool.clientId, pool.id]));
  const visits = [], invoices = [], technical = [], notifications = [], generic = [], locks = [];
  for (const [index, client] of added.entries()) {
    const poolId = byClient.get(client.id);
    for (let i = 0; i < 104; i++) {
      const date = new Date(at.getTime() + i * 7 * 86400000), blocked = i % 13 === 0;
      visits.push({ clientId: client.id, poolId, technicianId: technicians[(previous + index) % technicians.length].id, status: blocked ? 'NOT_DONE' : i % 5 === 0 ? 'PLANNED' : 'DONE', plannedDate: date, date, reason: blocked ? prefix + ' blocked' : null, notes: 'Synthetic visit '.repeat(16), createdAt: date, updatedAt: date });
    }
    for (let i = 0; i < 24; i++) {
      const date = new Date(Date.UTC(2018 + Math.floor(i / 12), i % 12, 15, 12)), kind = i % 6;
      invoices.push({ clientId: client.id, month: date.toISOString().slice(0, 7), status: ['DRAFT', 'CANCELLED', 'PAID', 'PENDING', 'PENDING', 'PENDING'][kind], amount: 10, total: 10, totalAmount: 10, amountPaid: kind === 2 ? 10 : kind === 3 ? 2 : 0, amountOpen: kind === 2 || kind === 5 ? 0 : kind === 3 ? 8 : 10, requiresInvoice: true, createdAt: date, dueDate: date });
    }
    for (let i = 0; i < 10; i++) {
      technical.push({ poolId, type: 'QA', message: prefix + ' technical ' + i, status: i < 8 ? 'OPEN' : 'RESOLVED', createdAt: at });
      notifications.push({ clientId: client.id, type: 'ALERT', role: 'ADMIN', message: prefix + ' notification ' + i, status: i < 8 ? 'PENDING' : 'RESOLVED', createdAt: at });
    }
    for (const open of [true, false]) {
      generic.push({ title: prefix, message: prefix, type: 'QA', status: open ? 'OPEN' : 'RESOLVED', active: open, createdAt: at });
      locks.push({ clientId: client.id, lockType: prefix, title: prefix, status: open ? 'PENDING' : 'RESOLVED', severity: 'WARNING', createdAt: at });
    }
  }
  for (const [model, rows] of [['serviceVisit', visits], ['invoice', invoices], ['technicalAlert', technical], ['notification', notifications], ['alert', generic], ['operationalLock', locks]]) await createMany(model, rows);
  const paid = await prisma.invoice.findMany({ where: { clientId: { in: clientIds }, amountPaid: { gt: 0 } }, select: { id: true, amountPaid: true, createdAt: true } });
  await createMany('payment', paid.map(row => ({ invoiceId: row.id, amount: row.amountPaid, paidAt: row.createdAt, method: 'CASH' })));
}
async function manifest() {
  const clientIds = clients.map(row => row.id);
  if (!clientIds.length) return { clientIds, allAlertIds: [], allRiskIds: [], expectedMonthlyVisitHash: emptyHash, expectedAlertHash: emptyHash, expectedRiskHash: emptyHash };
  const [visits, technical, notifications, generic, invoices, locks] = await Promise.all([
    prisma.serviceVisit.findMany({ where: { clientId: { in: clientIds } }, select: { id: true, status: true, date: true } }),
    prisma.technicalAlert.findMany({ where: { pool: { clientId: { in: clientIds } } }, select: { id: true, status: true } }),
    prisma.notification.findMany({ where: { clientId: { in: clientIds } }, select: { id: true, status: true } }),
    prisma.alert.findMany({ where: { title: prefix }, select: { id: true, status: true } }),
    prisma.invoice.findMany({ where: { clientId: { in: clientIds } }, select: { id: true, status: true } }),
    prisma.operationalLock.findMany({ where: { clientId: { in: clientIds }, lockType: prefix }, select: { id: true, status: true } }),
  ]);
  const sources = [[visits, 'visit', 'NOT_DONE'], [technical, 'technical', 'OPEN'], [notifications, 'notification', 'PENDING'], [generic, 'generic', 'OPEN']];
  const eligibleAlerts = sources.flatMap(([rows, source, status]) => rows.filter(row => row.status === status).map(row => source + '-' + row.id));
  const riskSources = [[invoices, 'OVERDUE_PAYMENT:', 'PENDING'], [locks, 'LOCK:', 'PENDING']];
  const eligibleRisks = riskSources.flatMap(([rows, source, status]) => rows.filter(row => row.status === status).map(row => source + row.id));
  const monthly = visits.filter(row => row.date.toISOString().startsWith('2019-12'));
  assert.equal(visits.length, clientIds.length * 104); assert.equal(invoices.length, clientIds.length * 24);
  assert.equal(eligibleAlerts.length, clientIds.length * 25); assert.equal(eligibleRisks.length, clientIds.length * 13); assert.equal(monthly.length, clientIds.length * 4);
  return { clientIds, allAlertIds: sources.flatMap(([rows, source]) => rows.map(row => source + '-' + row.id)), allRiskIds: riskSources.flatMap(([rows, source]) => rows.map(row => source + row.id)), expectedMonthlyVisitIds: monthly.map(row => row.id), expectedMonthlyVisitHash: hashIds(monthly.map(row => row.id)), expectedAlertHash: hashIds(eligibleAlerts), expectedRiskHash: hashIds(eligibleRisks) };
}
async function probe(mode, file, fault) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--expose-gc', path.join(__dirname, 'summary-volume-probe.js'), mode, file, ...(fault ? [fault] : [])], { cwd: path.join(__dirname, '..'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 45000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => { clearTimeout(timer); if (code !== 0 || signal) {
      const line = output.split('\n').find(line => line.startsWith('{"summaryVolumeMeasurement"'));
      if (line) fs.writeFileSync(path.join(folder, 'failed-probe.json'), JSON.stringify({ ok: false, code, signal, ...JSON.parse(line).summaryVolumeMeasurement }, null, 2) + '\n');
      return reject(Error(mode + ' probe failed: ' + code + '/' + signal + '\n' + output.slice(-2000) + errors.slice(-4000)));
    } const line = output.split('\n').find(line => line.startsWith('{"summaryVolumeProbe"')); if (!line) return reject(Error('Probe missing completion evidence')); resolve(JSON.parse(line).summaryVolumeProbe); });
  });
  assert(result.ok && result.phase === 'assertions-completed');
  console.log(JSON.stringify({ volume: mode, clients: result.clients, fault: fault || null, durationMs: result.measurements.durationMs, bytes: result.measurements.jsonBytes, rssMiB: result.measurements.sampledRssPeakMiB }));
  return result;
}
function verifyDelta(result) {
  const n = clients.length, initial = baseline.find(row => row.mode === result.mode).verified, value = result.verified;
  if (result.mode === 'dashboard') {
    const expected = { totalClients: n, totalPools: n, totalBilledAll: n * 160, totalPaidAll: n * 48, totalOpenAll: n * 112, totalInvoicesAll: n * 16, openInvoicesAll: n * 12, officialInvoiceClients: n, officialInvoiceTotal: n * 16, officialInvoicePending: n * 16, officialInvoicePendingAmount: n * 160, monthBilled: n * 10, monthPaid: 0, monthOpen: n * 10, totalInvoices: n, pendingInvoices: n, visitsThisMonth: n * 4, visitsDoneThisMonth: n * 3, visitsPlannedThisMonth: n, visitsNotDoneThisMonth: 0 };
    for (const [key, delta] of Object.entries(expected)) assert.equal(Math.round((value.summary[key] - initial.summary[key]) * 100) / 100, delta, key);
    assert.equal(value.technicians - initial.technicians, 16);
    for (const key of ['technical', 'notification', 'visit']) assert.equal(value.coverage.sources[key].total - initial.coverage.sources[key].total, n * 8);
    assert.equal(value.fixtureVisits, n * 4);
  } else if (result.mode === 'metrics') {
    assert.equal(value.activeAlerts - initial.activeAlerts, n * 8);
    for (const key of ['serviceVisitsByStatus', 'financialAggregates', 'dayWindow']) assert.deepEqual(value[key], initial[key], 'Historical volume must not change today: ' + key);
  } else if (result.mode === 'alerts') { assert.equal(value.count - initial.count, n * 25); assert.equal(value.fixtureCount, n * 25); }
  else { assert.equal(value.counts.total - initial.counts.total, n * 13); assert.equal(value.fixtureCount, n * 13); }
}
process.on('exit', () => { if (!complete && !process.exitCode) { fs.writeSync(2, 'Volume suite exited before completion\n'); process.exitCode = 1; } });
(async () => {
  beforeCounts = await tableCounts(); originalRules = await prisma.systemSetting.findUnique({ where: { key: R.key } }); rulesRead = true;
  const rules = { ...R.defaults, overduePayments: true, pendingOperationalLocks: true };
  await prisma.systemSetting.upsert({ where: { key: R.key }, create: { key: R.key, value: JSON.stringify(rules) }, update: { value: JSON.stringify(rules) } });
  const engine = (await prisma.$queryRawUnsafe('SELECT version() AS version'))[0].version;
  const file = path.join(temporary, 'manifest.json'); fs.writeFileSync(file, JSON.stringify(await manifest()));
  baseline = []; for (const mode of modes) baseline.push(await probe(mode, file));
  const legacyBaseline = await probe('dashboard', file, 'legacy-projections');
  assert.equal(legacyBaseline.responseSha256, baseline[0].responseSha256, 'Complete dashboard JSON must match the old query projections');
  projectionComparisons.push({ clients: 0, responseSha256: legacyBaseline.responseSha256, identical: true });
  await createMany('technician', Array.from({ length: 16 }, () => ({ name: prefix, active: true })));
  technicians = await prisma.technician.findMany({ where: { name: prefix }, select: { id: true }, orderBy: { id: 'asc' } });
  for (const n of scenarios) {
    await addClients(n); fs.writeFileSync(file, JSON.stringify(await manifest()));
    const totalRows = await tableCounts(), fixtureRows = Object.fromEntries(models.map(model => [model, totalRows[model] - beforeCounts[model]]));
    assert.deepEqual(fixtureRows, { client: n, pool: n, technician: 16, serviceVisit: n * 104, invoice: n * 24, payment: n * 8, technicalAlert: n * 10, notification: n * 10, alert: n * 2, operationalLock: n * 2 });
    profileRows.push({ clients: n, fixtureRows, totalRows });
    for (const mode of modes) { const result = await probe(mode, file); verifyDelta(result); results.push(result); }
    if (n === 25) {
      const legacy = await probe('dashboard', file, 'legacy-projections');
      assert.equal(legacy.responseSha256, results.find(row => row.mode === 'dashboard' && row.clients === n).responseSha256, 'Complete fixture JSON must match the old query projections');
      projectionComparisons.push({ clients: n, responseSha256: legacy.responseSha256, identical: true });
    }
    fs.writeFileSync(resultPath, JSON.stringify({ ok: false, phase: 'profiles-in-progress', engine, scenarios, baseline, results }, null, 2) + '\n');
  }
  for (const mode of ['dashboard', 'alerts', 'risk']) faultResults.push(await probe(mode, file, 'late-page'));
  fs.writeFileSync(resultPath, JSON.stringify({ ok: false, phase: 'cleanup-pending', engine, scenarios, baselineRows: beforeCounts, profileRows, baseline, results, faultResults, projectionComparisons,
    guards: { requestMs: 30000, responseMiB: 64, sampledRssMiB: 768 },
    measurementScope: 'Fresh Node process for each authenticated API GET. Request timing ends after response.text; memory is sampled every 5 ms and after body parsing. Module initialization precedes the baseline; the separate process lifetime RSS peak also includes startup. Excludes fixture setup, database server memory, browser rendering and production certification.' }, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    const owned = await prisma.client.findMany({ where: { name: { startsWith: prefix } }, select: { id: true } }), ids = owned.map(row => row.id);
    if (ids.length) {
      await prisma.payment.deleteMany({ where: { invoice: { clientId: { in: ids } } } });
      await prisma.invoice.deleteMany({ where: { clientId: { in: ids } } });
      await prisma.technicalAlert.deleteMany({ where: { pool: { clientId: { in: ids } } } });
      await prisma.notification.deleteMany({ where: { clientId: { in: ids } } });
      await prisma.serviceVisit.deleteMany({ where: { clientId: { in: ids } } });
      await prisma.operationalLock.deleteMany({ where: { clientId: { in: ids }, lockType: prefix } });
      await prisma.pool.deleteMany({ where: { clientId: { in: ids } } }); await prisma.client.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.alert.deleteMany({ where: { title: prefix } }); await prisma.technician.deleteMany({ where: { name: prefix } });
    if (rulesRead) {
      if (originalRules) await prisma.systemSetting.update({ where: { key: R.key }, data: { value: originalRules.value, notes: originalRules.notes, updatedAt: originalRules.updatedAt } });
      else await prisma.systemSetting.deleteMany({ where: { key: R.key } });
      assert.deepEqual(await prisma.systemSetting.findUnique({ where: { key: R.key } }), originalRules);
    }
    if (beforeCounts) assert.deepEqual(await tableCounts(), beforeCounts, 'Only synthetic fixture rows may be removed');
    if (!process.exitCode) {
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8')); assert.equal(result.phase, 'cleanup-pending');
      result.ok = true; result.phase = 'assertions-completed'; result.cleanupVerified = true; fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n');
      complete = true; console.log('PASS summary volume: four APIs, 25/100/400 clients, two years of visits/documents, exact totals and IDs, identical dashboard JSON, bounded previews, three later-page failures, no GET writes and fixture cleanup verified');
    }
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { fs.rmSync(temporary, { recursive: true, force: true }); await prisma.$disconnect(); }
});
