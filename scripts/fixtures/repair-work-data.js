'use strict';
const { randomUUID, randomInt } = require('node:crypto'), { prisma } = require('../../src/prismaClient');
module.exports = async function create({ admin }) {
  if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
  const tag = 'REPAIR_WORK_' + randomUUID(), client = await prisma.client.create({ data: { name: 'PRIVATE_CLIENT ' + tag, phone: 'PRIVATE_PHONE' } });
  const other = await prisma.client.create({ data: { name: 'PRIVATE_OTHER ' + tag } }), pool = await prisma.pool.create({ data: { clientId: client.id, name: 'Piscina <img src=x> ' + tag } });
  const tech = await prisma.technician.create({ data: { name: 'Técnico <img src=x> ' + tag, active: true } }), second = await prisma.technician.create({ data: { name: 'Segundo técnico ' + tag, active: true } });
  const repairs = [];
  async function make(mode = 'NONE') {
    const row = await prisma.repair.create({ data: { ...(mode === 'RESERVED' ? { id: randomInt(1000000000,1900000000) } : {}), poolId: pool.id, problem: tag + ' ' + mode, quantity: 1, status: mode === 'LEGACY' ? 'CLOSED' : 'APPROVED', createdAt: new Date('2000-01-01Z'), ...(mode === 'LEGACY' ? { doneAt: new Date() } : {}), unitPrice: 900, totalPrice: 900, notes: 'PRIVATE_PRICE_NOTES' } });
    repairs.push(row);
    if (mode === 'RESERVED') await require('./repair-execution-data')({ repair: row, clientId: client.id, admin, complete: true });
    if (mode === 'NONE') {
      const { detail } = await require('../../src/services/repairExecutionCommandService').detail(row.id);
      const result = await require('../../src/business/repair/RepairBusiness').completeRepair(row.id, prisma, 'Work interval QA', { id: admin.id, role: 'ADMIN' }, { requestId: randomUUID(), poolId: pool.id, expectedVersion: detail.version, confirmed: true, noMaterials: { reason: 'Ajuste concluído sem materiais.' } });
      if (!result.ok) throw Error(JSON.stringify(result));
    }
    return prisma.repair.findUniqueOrThrow({ where: { id: row.id } });
  }
  const reserved = await make('RESERVED'), none = await make(), legacy = await make('LEGACY'), pending = await make('PENDING');
  const regular = await prisma.serviceVisit.create({ data: { id: reserved.id, clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'DONE' } });
  const extra = await prisma.extraVisit.create({ data: { id: reserved.id, clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'DONE' } });
  async function cleanup() {
    const ids = repairs.map(r => r.id), rows = await prisma.repairWorkInterval.findMany({ where: { repairId: { in: ids } }, select: { id: true } });
    await prisma.auditTrail.deleteMany({ where: { entity: 'RepairWorkInterval', entityId: { in: rows.map(r => r.id) } } });
    await prisma.repairWorkInterval.deleteMany({ where: { repairId: { in: ids } } });
    await prisma.fieldWriteRequest.deleteMany({ where: { scope: { in: ['REPAIR_EXECUTION','REPAIR_WORK_INTERVAL'] }, resourceId: { in: ids } } });
    await prisma.stockMovement.deleteMany({ where: { poolId: pool.id } }); await prisma.operationalLock.deleteMany({ where: { entity: 'Repair', entityId: { in: ids } } });
    await prisma.auditTrail.deleteMany({ where: { entity: 'Repair', entityId: { in: ids } } }); await prisma.repair.deleteMany({ where: { id: { in: ids } } });
    await prisma.serviceVisit.deleteMany({ where: { id: regular.id } }); await prisma.extraVisit.deleteMany({ where: { id: extra.id } });
  }
  return { tag, client, other, pool, tech, second, reserved, none, legacy, pending, regular, extra, repairs, make, cleanup };
};
