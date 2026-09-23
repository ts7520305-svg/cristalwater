'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict'), { randomUUID } = require('node:crypto'), { fork } = require('node:child_process'), jwt = require('jsonwebtoken');
const { prisma } = require('../src/prismaClient'), { getJwtSecret } = require('../src/utils/jwtSecret');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EMAIL_ENABLED !== 'false' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
const children = [], visits = [], bases = []; let f;
async function server() {
  const child = fork(require.resolve('./fixtures/expense-server'), [], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }); children.push(child);
  return new Promise((resolve, reject) => { child.once('message', m => resolve('http://127.0.0.1:' + m.port)); child.once('error', reject); });
}
(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: process.env.ADMIN_EMAIL } });
  const token = jwt.sign({ id: admin.id, userId: admin.id, principalType: 'USER', role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  f = await require('./fixtures/repair-labor-data')({ admin }); const one = await server(), two = await server();
  async function api(path, body, status = 200, base = one, credential = token) {
    const response = await fetch(base + '/api/' + path, { method: body ? 'POST' : 'GET', headers: { ...(credential ? { Authorization: 'Bearer ' + credential } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); assert.match(response.headers.get('cache-control'), /no-store/); return result;
  }
  const expense = async e => (await api('expenses/' + e.expenseId)).expense;
  const send = (body, base = one) => api('expenses/commands', body, 200, base);
  const times = (day, from = '08:00:00', to = '08:10:00') => ({ startAt: new Date('2004-01-' + day + 'T' + from + 'Z'), endAt: new Date('2004-01-' + day + 'T' + to + 'Z') });
  const original = times('08'), adjacent = times('08', '08:10:00', '08:20:00');
  const setRegular = data => prisma.serviceVisit.update({ where: { id: f.regular.id }, data });
  const setExtra = data => prisma.extraVisit.update({ where: { id: f.extra.id }, data });
  const choice = (type = 'REGULAR', id = f.regular.id) => ({ kind: 'LABOR', targetType: type, targetId: id, purchaseItemId: null, quantity: null });
  const query = value => new URLSearchParams(Object.entries(value).filter(([, v]) => v !== null)).toString();
  async function preview(e, selected = choice(), status = 200) { return api('expenses/' + e.expenseId + '/valuation-preview?' + query(selected), null, status); }
  const valueRequest = p => ({ requestId: randomUUID(), command: 'VALUE_LABOR', expenseId: p.expenseId, expectedVersion: p.expenseVersion, data: {
    ...Object.fromEntries(['kind','targetType','targetId','targetHash','monthRef','purchaseItemId','quantity','amountCents','valuationHash','laborPart'].filter(k => k in p).map(k => [k, p[k]])), previewHash: p.hash, reason: 'Horários e custo efetivo conferidos', confirmed: true
  } });
  const rejected = async (e, selected = choice()) => { const r = await preview(e, selected, 409); assert.match(r.error, /tempo registado em simultâneo/); assert(!JSON.stringify(r).includes('PRIVATE_')); return r; };
  async function makeVisit(data) { const row = await prisma.serviceVisit.create({ data: { clientId: f.client.id, poolId: f.pool.id, technicianId: f.tech.id, status: 'DONE', ...data } }); visits.push(row.id); return row; }
  async function expenseCommand(e, command, data) { const current = await expense(e); return send({ requestId: randomUUID(), command, expenseId: e.expenseId, expectedVersion: current.version, data }); }
  const e = await f.salary({ amountCents: 6000, paidMinutes: 60 }), other = await f.salary({ amountCents: 3000, paidMinutes: 60 });
  await setRegular(original); await setExtra(original);
  const databaseBefore = async () => JSON.stringify(await Promise.all([
    prisma.companyExpense.findMany({ where: { id: { in: f.expenses } }, orderBy: { id: 'asc' } }),
    prisma.expenseAllocation.findMany({ where: { expenseId: { in: f.expenses } }, orderBy: { id: 'asc' } }),
    prisma.expensePayment.findMany({ where: { expenseId: { in: f.expenses } }, orderBy: { id: 'asc' } })
  ]));
  // Equal numeric IDs in REGULAR and EXTRA still represent two different services.
  const before = await databaseBefore(); await rejected(e); await rejected(e, choice('EXTRA', f.extra.id)); assert.equal(await databaseBefore(), before);
  await api('expenses/' + e.expenseId + '/valuation-preview?' + query(choice()), null, 401, one, null);
  await setExtra({ clientId: f.other.id }); await rejected(e);
  await setExtra({ technicianId: f.second.id }); assert.equal((await preview(e)).preview.amountCents, 1000);
  await setExtra({ ...adjacent, technicianId: f.tech.id, clientId: f.client.id }); assert.equal((await preview(e)).preview.quantity, '600');
  assert.equal((await preview(e, choice('EXTRA', f.extra.id))).preview.quantity, '600');
  await setExtra({ startAt: new Date('2004-01-08T08:09:59Z') }); await rejected(e); await setExtra(adjacent);

  // Closed recorded time is relevant regardless of the display status; open
  // planned work and missing starts do not create invented working time.
  const blocking = await makeVisit({ ...original, clientId: f.other.id }); await rejected(e);
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: { status: 'CANCELLED' } }); await rejected(e);
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: { endAt: null, status: 'PLANNED' } }); await preview(e);
  for (const status of [' in_progress ', 'STARTED', 'IN_EXECUTION']) { await prisma.serviceVisit.update({ where: { id: blocking.id }, data: { status } }); await rejected(e); }
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: { startAt: null } }); await preview(e);

  // Cross-day and cross-month comparisons are based on UTC instants, not the
  // selected document month or client. A repair interval has its own identity.
  await setRegular({ startAt: new Date('2004-01-31T23:59:00Z'), endAt: new Date('2004-02-01T00:01:00Z') });
  await setExtra({ startAt: new Date('2004-02-01T00:00:00Z'), endAt: new Date('2004-02-01T00:02:00Z') }); await rejected(e);
  await setRegular({ startAt: new Date(f.first.startedAt), endAt: new Date(f.first.endedAt) }); await setExtra(adjacent); await rejected(e);
  const repairView = await require('../src/services/repairWorkService').detail({ id: admin.id, role: 'ADMIN' }, f.reserved.id);
  assert(repairView.detail.rows.find(row => row.id === f.first.id).reviewReasons.includes('RECORDED_TIME_OVERLAP'));
  await setRegular(original);
  const oldWork = await f.record(f.none.id, f.tech.id, '2004-01-06T08:00:00.000Z', '2004-01-06T08:10:00.000Z'); await f.voidWork(oldWork);
  await setRegular(times('06')); assert.equal((await preview(e)).preview.amountCents, 1000); await setRegular(original);
  await prisma.technician.update({ where: { id: f.tech.id }, data: { active: false } }); await preview(e);

  // A late conflict invalidates every current financial read without editing
  // the original cost, payment, receipt, or source snapshots.
  assert((await expenseCommand(e, 'RECORD_PAYMENT', { amountCents: 6000, paidOn: '2004-01-16', method: 'TRANSFER', reference: 'Documento original pago' })).applied);
  const request = valueRequest((await preview(e)).preview), saved = await send(request); assert(saved.applied); assert.equal(saved.allocation.amountCents, 1000);
  const stored = await databaseBefore(), receipt = await api('expenses/requests/' + request.requestId);
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: { ...original, status: 'DONE' } });
  const reviewed = await expense(e), row = reviewed.allocations.find(a => a.id === saved.allocation.id);
  assert(row.needsReview); assert(row.reviewReasons.includes('RECORDED_TIME_OVERLAP')); assert.equal(reviewed.allocatedCents, 1000);
  assert.equal((await api('expenses/costs?monthRef=2004-01')).summary.valuations.laborAmountCents, null);
  assert.equal(await databaseBefore(), stored); assert.deepEqual(await api('expenses/requests/' + request.requestId), receipt);
  assert.equal((await send(request, two)).allocation.id, saved.allocation.id);
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: { startAt: null, endAt: null } }); assert.equal((await expense(e)).allocationReviewCount, 0);

  // Requests must recheck the current timeline at confirmation. A rejected UUID
  // remains rejected after the conflict is removed; a new reviewed request works.
  const next = await makeVisit(times('09')), pending = valueRequest((await preview(other, choice('REGULAR', next.id))).preview);
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: times('09') });
  const beforeRefusal = await databaseBefore(), failed = await send(pending, two); assert.equal(failed.code, 'VALUATION_REVIEW'); assert.match(failed.message, /em simultâneo/); assert.equal(await databaseBefore(), beforeRefusal);
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: { startAt: null, endAt: null } }); assert.equal((await send(pending)).code, 'VALUATION_REVIEW');
  assert((await send(valueRequest((await preview(other, choice('REGULAR', next.id))).preview))).applied);

  // Distributed salary parts and whole-document compositions use the same guard.
  const distributed = await f.salary({ amountCents: 6000, paidMinutes: 60 });
  const parts = [f.tech, f.second].map(t => ({ technicianId: t.id, periodStart: '2004-01-01', periodEnd: '2004-01-31', paidMinutes: 60, amountCents: 3000 }));
  const distribution = (await api('expenses/' + distributed.expenseId + '/labor-distribution-preview', { parts })).preview;
  assert((await expenseCommand(distributed, 'SET_LABOR_DISTRIBUTION', { parts, previewHash: distribution.hash, reason: 'Técnicos e parcelas confirmados', confirmed: true })).applied);
  const composed = [await f.salary({ amountCents: 6000, paidMinutes: 60 }), await f.salary({ amountCents: 3000, paidMinutes: 60 })];
  const expenseIds = composed.map(e => e.expenseId), basisPreview = (await api('labor-cost-bases/basis-preview', { expenseIds })).preview;
  const made = await api('labor-cost-bases/commands', { requestId: randomUUID(), command: 'CREATE', resourceId: expenseIds[0], data: { expenseIds, previewHash: basisPreview.hash, reason: 'Salário e encargo do mesmo período', confirmed: true } });
  assert(made.applied); bases.push(made.basis.id);
  const last = await makeVisit(times('10')), lastChoice = choice('REGULAR', last.id);
  const componentPreview = (await api('labor-cost-bases/' + made.basis.id + '/valuation-preview?' + query(lastChoice))).preview;
  const distributedPreview = (await preview(distributed, { ...lastChoice, laborPart: 1 })).preview;
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: times('10') });
  await rejected(distributed, { ...lastChoice, laborPart: 1 });
  const groupedRequest = { requestId: randomUUID(), command: 'VALUE', resourceId: made.basis.id, data: { choice: componentPreview.choice, previewHash: componentPreview.hash, reason: 'Intervalo revisto para todos os encargos', confirmed: true } };
  const groupCount = await prisma.laborCostValuation.count(), partCount = await prisma.laborCostValuationPart.count(), beforeBoth = await databaseBefore();
  const refused = await Promise.all([send(valueRequest(distributedPreview)), api('labor-cost-bases/commands', groupedRequest, 200, two)]);
  assert.equal(refused[0].code, 'VALUATION_REVIEW'); assert.equal(refused[1].code, 'COMPOSITION_REVIEW'); assert.equal(await databaseBefore(), beforeBoth);
  assert.equal(await prisma.laborCostValuation.count(), groupCount); assert.equal(await prisma.laborCostValuationPart.count(), partCount);
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: { startAt: null, endAt: null } });
  const fresh = (await api('labor-cost-bases/' + made.basis.id + '/valuation-preview?' + query(lastChoice))).preview;
  const group = await api('labor-cost-bases/commands', { ...groupedRequest, requestId: randomUUID(), data: { ...groupedRequest.data, previewHash: fresh.hash } }); assert(group.applied);
  await prisma.serviceVisit.update({ where: { id: blocking.id }, data: times('10') });
  assert.equal((await api('labor-cost-bases/' + made.basis.id)).groups.find(g => g.id === group.group.id).state, 'REVIEW');
  for (const e of composed) assert((await expense(e)).allocations.every(a => a.needsReview && a.reviewReasons.includes('RECORDED_TIME_OVERLAP')));
  const view = await api('labor-cost-bases/' + made.basis.id), current = view.groups.find(g => g.id === group.group.id);
  assert((await api('labor-cost-bases/commands', { requestId: randomUUID(), command: 'VOID_VALUE', resourceId: made.basis.id, data: { groupId: current.id, recordHash: current.recordHash, reason: 'Corrigir a sobreposição preservando o histórico', confirmed: true } })).applied);
  assert.equal((await api('labor-cost-bases/' + made.basis.id)).groups.find(g => g.id === group.group.id).state, 'VOIDED');
  assert((await expenseCommand(e, 'VOID_COST', { allocationId: saved.allocation.id, reason: 'Corrigir mantendo o comprovativo original' })).applied);
  assert.equal((await api('expenses/requests/' + request.requestId)).allocation.id, saved.allocation.id);
  console.log('PASS work time cost integrity: typed regular/extra/repair overlaps, other clients and technicians, half-open UTC boundaries, open/closed/planned time, historical and voided intervals, immutable receipts/payments, late-source review, stale request/replay refusal, distributed and composed salaries, atomic concurrent refusals and historical void');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const child of children) child.kill('SIGTERM');
  if (f) {
    await prisma.laborCostValuationPart.deleteMany({ where: { expenseId: { in: f.expenses } } });
    await prisma.laborCostValuation.deleteMany({ where: { basisId: { in: bases } } });
    await prisma.laborCostBasis.deleteMany({ where: { id: { in: bases } } });
    await prisma.expenseLaborDistribution.deleteMany({ where: { expenseId: { in: f.expenses } } });
    await prisma.expensePayment.deleteMany({ where: { expenseId: { in: f.expenses } } });
    await f.cleanup();
    await prisma.serviceVisit.deleteMany({ where: { id: { in: visits } } });
  }
  await prisma.$disconnect();
});
