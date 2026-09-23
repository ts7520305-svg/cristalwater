'use strict';
const { randomUUID, randomInt } = require('node:crypto'), { prisma } = require('../../src/prismaClient');
module.exports = async function create({ admin, extra = 0 }) {
  if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
  const tag = 'Repair cost ' + randomUUID(), client = await prisma.client.create({ data: { name: tag + ' <img src=x>' } }), other = await prisma.client.create({ data: { name: tag + ' new owner' } });
  const pool = await prisma.pool.create({ data: { name: tag + ' <img src=x>', clientId: client.id } }), repairs = [], expenseIds = [];
  async function repair(mode = 'NONE') {
    const row = await prisma.repair.create({ data: { ...(mode === 'RESERVED' ? { id: randomInt(1000000000, 1900000000) } : {}), poolId: pool.id, problem: tag + ' ' + mode, status: mode === 'LEGACY' ? 'CLOSED' : 'APPROVED', quantity: 1, totalPrice: 900, unitPrice: 900, ...(mode === 'LEGACY' ? { doneAt: new Date() } : {}) } }); repairs.push(row);
    if (mode === 'RESERVED') await require('./repair-execution-data')({ repair: row, clientId: client.id, admin, complete: true });
    else if (mode === 'NONE') { const { detail } = await require('../../src/services/repairExecutionCommandService').detail(row.id); const result = await require('../../src/business/repair/RepairBusiness').completeRepair(row.id, prisma, 'Repair cost QA', { id: admin.id, role: 'ADMIN' }, { requestId: randomUUID(), poolId: pool.id, expectedVersion: detail.version, confirmed: true, noMaterials: { reason: 'Ajuste concluído sem utilização de materiais.' } }); if (!result.ok) throw Error(JSON.stringify(result)); }
    return prisma.repair.findUniqueOrThrow({ where: { id: row.id } });
  }
  const reserved = await repair('RESERVED'), none = await repair(), legacy = await repair('LEGACY'), pending = await repair('PENDING');
  for (let i = 0; i < extra; i++) await repair();
  const month = reserved.doneAt.toISOString().slice(0, 7), documentMonth = '2002-12', mismatchMonth = '2002-11';
  const regular = await prisma.serviceVisit.create({ data: { id: reserved.id, clientId: client.id, poolId: pool.id, status: 'DONE', endAt: reserved.doneAt } });
  const extraVisit = await prisma.extraVisit.create({ data: { id: reserved.id, clientId: client.id, poolId: pool.id, status: 'DONE', endAt: reserved.doneAt } });
  const manual = more => ({ title: tag, supplierId: null, supplierName: 'QA supplier', documentNumber: '', expenseDate: documentMonth + '-01', dueDate: null, amountCents: 10000, category: 'GENERAL', notes: '', sourceType: 'MANUAL', sourceId: null, sourceHash: null, reason: '', confirmed: true, ...more });
  async function expense(more = {}) { const result = await require('../../src/services/expenseLedgerService').command(admin, { requestId: randomUUID(), command: 'CREATE', expenseId: null, expectedVersion: null, data: manual(more) }); if (!result.applied) throw Error(JSON.stringify(result)); expenseIds.push(result.expenseId); return result; }
  async function cleanup() {
    await prisma.expenseEvent.deleteMany({ where: { expenseId: { in: expenseIds } } }); await prisma.expenseAllocation.deleteMany({ where: { expenseId: { in: expenseIds } } }); await prisma.companyExpense.deleteMany({ where: { id: { in: expenseIds } } });
    await prisma.stockMovement.deleteMany({ where: { poolId: pool.id } }); await prisma.operationalLock.deleteMany({ where: { entity: 'Repair', entityId: { in: repairs.map(r => r.id) } } });
    await prisma.auditTrail.deleteMany({ where: { entity: 'Repair', entityId: { in: repairs.map(r => r.id) } } }); await prisma.repair.deleteMany({ where: { id: { in: repairs.map(r => r.id) } } });
    await prisma.serviceVisit.delete({ where: { id: regular.id } }); await prisma.extraVisit.delete({ where: { id: extraVisit.id } });
  }
  return { tag, client, other, pool, reserved, none, legacy, pending, repairs, regular, extraVisit, month, documentMonth, mismatchMonth, manual, expense, expenseIds, cleanup };
};
