'use strict';
require('../src/loadEnv')();
const assert = require('node:assert/strict');
if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true') throw Error('Isolated QA required');
const { prisma } = require('../src/prismaClient');
const jwt = require('jsonwebtoken'), { getJwtSecret } = require('../src/utils/jwtSecret');
const base = process.env.CW_BASE_URL || 'http://127.0.0.1:3002';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
(async () => {
  const client = await prisma.client.create({ data: { name: 'Briefing QA', active: true, email: 'private-briefing@qa.test', phone: 'PRIVATE-PHONE' } });
  const a = await prisma.technician.create({ data: { name: 'Briefing A', active: true } });
  const b = await prisma.technician.create({ data: { name: 'Briefing B', active: true } });
  const p = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina A', notes: 'Fechar o portão.\nNão mexer na válvula marcada.', monthlyAmount: 987 } });
  const p2 = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina B', notes: 'Entrada pelo jardim.' } });
  const now = new Date();
  const visit = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: p.id, technicianId: a.id, status: 'PLANNED', plannedDate: now, date: now } });
  const visit2 = await prisma.serviceVisit.create({ data: { clientId: client.id, poolId: p2.id, technicianId: a.id, status: 'PLANNED', plannedDate: now, date: now } });
  const extra = await prisma.extraVisit.create({ data: { clientId: client.id, poolId: p.id, technicianId: a.id, scheduledAt: now, status: 'PLANNED', notes: 'Briefing QA' } });
  const general = values => prisma.generalReminder.create({ data: { title: 'Lembrete QA', dueAt: now, clientId: client.id, ...values } });
  const operation = values => prisma.operationalReminder.create({ data: { title: 'Operação QA', dueDate: now, clientId: client.id, ...values } });
  const shared = await general({ title: 'Cliente inteiro' });
  const own = await general({ poolId: p.id, technicianId: a.id, title: 'Só técnico A' });
  const foreign = await general({ poolId: p.id, technicianId: b.id, title: 'Só técnico B' });
  const otherPool = await operation({ poolId: p2.id, title: 'Só piscina B' });
  const foreignOperation = await operation({ poolId: p.id, assignedToTechnicianId: b.id, title: 'Operação do técnico B' });
  const closed = await general({ poolId: p.id, status: 'DONE', completedAt: now });
  const completedWithOldStatus = await general({ poolId: p.id, completedAt: now });
  await prisma.generalReminder.createMany({ data: Array.from({ length: 505 }, (_, i) => ({ title: `Briefing lote ${i}`, poolId: p.id, clientId: client.id, dueAt: now, status: 'PENDING' })) });
  await prisma.operationalReminder.createMany({ data: Array.from({ length: 23 }, (_, i) => ({ title: `Operação lote ${i}`, poolId: p.id, clientId: client.id, dueDate: now })) });
  const sign = (tech, role = 'TECHNICIAN') => jwt.sign({ id: tech.id, technicianId: tech.id, role }, getJwtSecret(), { expiresIn: '1h' });
  async function read(tech, role) {
    const r = await fetch(base + '/api/technician/today', { headers: { Authorization: `Bearer ${sign(tech, role)}` } });
    const body = await r.json(); assert.equal(r.status, 200, JSON.stringify(body)); return body.visits;
  }
  for (const role of ['TECHNICIAN', 'TEAM_LEADER']) {
    await prisma.technician.update({ where: { id: a.id }, data: { role } });
    const rows = await read(a, role);
    for (const [id, type] of [[visit.id, 'REGULAR'], [extra.id, 'EXTRA']]) {
      const row = rows.find(v => v.id === id && v.visitType === type); assert(row, `${type} visible`);
      assert.equal(row.pool.notes, p.notes, 'Pool instructions must reach the field briefing');
      assert(row.pool.generalReminders.some(r => r.id === own.id));
      assert(!row.pool.generalReminders.some(r => [foreign.id, closed.id, completedWithOldStatus.id].includes(r.id)));
      assert.equal(row.pool.generalReminders.filter(r => r.title.startsWith('Briefing lote ')).length, 505);
      assert.equal(row.pool.operationalReminders.filter(r => r.title.startsWith('Operação lote ')).length, 23);
      assert(!row.pool.operationalReminders.some(r => r.id === foreignOperation.id));
      assert.deepEqual(row.client.generalReminders.map(r => r.id), [shared.id]);
      assert(!row.client.operationalReminders.some(r => r.id === otherPool.id));
      assert(!JSON.stringify(row).includes('private-briefing@qa.test')); assert(!JSON.stringify(row).includes('PRIVATE-PHONE'));
      assert(!Object.hasOwn(row.pool, 'monthlyAmount'));
    }
    const second = rows.find(v => v.id === visit2.id && v.visitType === 'REGULAR');
    assert.equal(second.pool.notes, p2.notes); assert(second.pool.operationalReminders.some(r => r.id === otherPool.id));
    assert.equal(second.pool.generalReminders.length, 0);
  }
  await prisma.technician.update({ where: { id: a.id }, data: { role: 'TECHNICIAN' } });
  await prisma.serviceVisit.update({ where: { id: visit.id }, data: { technicianId: b.id } });
  assert(!(await read(a)).some(v => v.visitType === 'REGULAR' && v.id === visit.id));
  const reassigned = (await read(b)).find(v => v.visitType === 'REGULAR' && v.id === visit.id);
  assert(reassigned.pool.generalReminders.some(r => r.id === foreign.id)); assert(!reassigned.pool.generalReminders.some(r => r.id === own.id));
  assert(reassigned.pool.operationalReminders.some(r => r.id === foreignOperation.id));
  assert.equal(await prisma.generalReminder.count({ where: { poolId: p.id } }), 509, 'Reading must not complete or delete instructions');
  console.log('PASS regular/extra briefing, pool notes, exact pool/client and technician scope, 505 general + 23 operational notices, closed exclusion, team leader, reassignment and read-only history');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
