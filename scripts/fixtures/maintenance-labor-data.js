'use strict';
const { randomUUID, randomInt } = require('node:crypto'), { prisma } = require('../../src/prismaClient');
const equipment = require('../../src/business/equipment/EquipmentMaintenanceBusiness'), billing = require('../../src/business/equipment/MaintenanceBillingBusiness'), ledger = require('../../src/services/expenseLedgerService');
module.exports = async function (admin) {
  if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
  const month = new Date().toISOString().slice(0, 7), tag = 'Maintenance labor ' + randomUUID(), startAt = new Date(month + '-01T00:00:00.000Z'), endAt = new Date(+startAt + 3000);
  const client = await prisma.client.create({ data: { name: tag + ' <img src=x>' } }), other = await prisma.client.create({ data: { name: tag + ' other' } }), pool = await prisma.pool.create({ data: { clientId: client.id, name: tag } });
  const tech = await prisma.technician.create({ data: { name: tag, active: true } }), extraTech = await prisma.technician.create({ data: { name: tag + ' extra', active: true } });
  const sameId = randomInt(710000000, 790000000), plans = [], completions = [], expenseIds = [], basisIds = [], requests = [], visitIds = [sameId];
  const regular = await prisma.serviceVisit.create({ data: { id: sameId, poolId: pool.id, clientId: client.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt } });
  const extra = await prisma.extraVisit.create({ data: { id: sameId, poolId: pool.id, clientId: client.id, technicianId: extraTech.id, status: 'IN_PROGRESS', startAt } });
  async function complete(visitType, index, own = true, visitId = sameId, visitStart = startAt) {
    const p = (await equipment.create(admin, pool.id, { component: 'FILTER', title: tag + ' ' + visitType + ' ' + visitId + ' ' + index + (own ? ' recorded' : ' missing'), instructions: 'Revisão com tempo próprio confirmado', intervalUnit: 'MONTHS', intervalCount: 1, nextDue: month + '-01' })).plan;
    plans.push(p.id);
    const requestId = randomUUID(); requests.push(requestId);
    const result = await equipment.complete(admin, p.id, { requestId, visitType, visitId, poolId: pool.id, expectedVersion: p.version, notes: 'Tempo da revisão registado no terreno', confirmed: true, ...(own ? { workTime: { startAt: new Date(+visitStart + index * 1000).toISOString(), endAt: new Date(+visitStart + (index + 1) * 1000).toISOString() } } : {}) });
    if (!result.applied) throw Error(JSON.stringify(result));
    const id = result.completion.id; completions.push(id);
    const source = (await billing.list(admin, pool.id, { kind: 'EQUIPMENT' })).rows.find(s => s.sourceId === id);
    await billing.review(admin, 'EQUIPMENT', id, { expectedVersion: source.expectedVersion, expectedClientId: client.id, expectedPoolId: pool.id, mode: 'INCLUDED', amount: '0.00', note: 'Revisão incluída, com origem histórica confirmada', confirmed: true });
    return { id, result, planId: p.id };
  }
  const reviews = []; for (let i = 0; i < 3; i++) reviews.push(await complete('REGULAR', i));
  const extraReviews = []; for (let i = 0; i < 3; i++) extraReviews.push(await complete('EXTRA', i));
  const missing = []; for (let i = 0; i < 11; i++) missing.push(await complete('REGULAR', i, false));
  await prisma.serviceVisit.update({ where: { id: sameId }, data: { status: 'DONE', endAt } }); await prisma.extraVisit.update({ where: { id: sameId }, data: { status: 'DONE', endAt } });
  async function send(command, expenseId, data) { const expense = await prisma.companyExpense.findUniqueOrThrow({ where: { id: expenseId } }); return ledger.command(admin, { requestId: randomUUID(), expenseId, expectedVersion: expense.version, command, data }); }
  async function salary(technicianId = tech.id, amountCents = 2000, periodMonth = month) {
    const row = await ledger.command(admin, { requestId: randomUUID(), command: 'CREATE', expenseId: null, expectedVersion: null, data: { title: tag, supplierId: null, supplierName: 'QA salary', documentNumber: '', expenseDate: month + '-01', dueDate: null, amountCents, category: 'LABOR', notes: '', sourceType: 'MANUAL', sourceId: null, sourceHash: null, reason: '', confirmed: true } });
    if (!row.applied) throw Error(JSON.stringify(row)); expenseIds.push(row.expenseId);
    const result = await send('SET_LABOR_BASIS', row.expenseId, { technicianId, periodStart: periodMonth + '-01', periodEnd: periodMonth + '-01', paidMinutes: 1, reason: 'Tempo e documento de trabalho conferidos', confirmed: true }); if (!result.applied) throw Error(JSON.stringify(result));
    return row.expenseId;
  }
  async function value(expenseId, type = 'REGULAR', targetId = sameId) {
    const p = (await ledger.valuationPreview(expenseId, { kind: 'LABOR', targetType: type, targetId: String(targetId) })).preview;
    const result = await send('VALUE_LABOR', expenseId, { ...Object.fromEntries(['kind','targetType','targetId','targetHash','monthRef','purchaseItemId','quantity','amountCents','valuationHash'].map(k => [k, p[k]])), previewHash: p.hash, reason: 'Custo completo da visita confirmado', confirmed: true });
    if (!result.applied) throw Error(JSON.stringify(result)); return result.allocation;
  }
  async function late() {
    const start = new Date(Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth() - 1, 1)), visit = await prisma.serviceVisit.create({data:{poolId:pool.id,clientId:client.id,technicianId:tech.id,status:'IN_PROGRESS',startAt:start}}); visitIds.push(visit.id);
    const review = await complete('REGULAR', 0, true, visit.id, start); await prisma.serviceVisit.update({where:{id:visit.id},data:{status:'DONE',endAt:new Date(+start+3000)}});
    const id = await salary(tech.id, 2000, start.toISOString().slice(0,7)); return {review,allocation:await value(id,'REGULAR',visit.id)};
  }
  async function cleanup() {
    await prisma.fieldWriteRequest.deleteMany({ where: { owner: 'ADMIN:' + admin.id, requestId: { in: requests } } });
    await prisma.laborCostValuationPart.deleteMany({ where: { group: { basisId: { in: basisIds } } } }); await prisma.laborCostValuation.deleteMany({ where: { basisId: { in: basisIds } } }); await prisma.laborCostBasis.deleteMany({ where: { id: { in: basisIds } } });
    for (const model of ['expenseEvent','expensePayment','expenseAllocation','expenseLaborBasis']) await prisma[model].deleteMany({ where: { expenseId: { in: expenseIds } } }); await prisma.companyExpense.deleteMany({ where: { id: { in: expenseIds } } });
    await prisma.operationalReminder.deleteMany({ where: { sourceKey: { in: completions.map(id => 'maintenance-billing:EQUIPMENT:' + id) } } });
    await prisma.technicalHistory.deleteMany({ where: { poolId: pool.id, type: 'EQUIPMENT_MAINTENANCE' } }); await prisma.equipmentMaintenanceCompletion.deleteMany({ where: { id: { in: completions } } }); await prisma.equipmentMaintenancePlan.deleteMany({ where: { id: { in: plans } } });
    await prisma.serviceVisit.deleteMany({ where: { id: {in:visitIds} } }); await prisma.extraVisit.delete({ where: { id: sameId } });
  }
  return { month, tag, startAt, endAt, sameId, client, other, pool, tech, extraTech, regular, extra, reviews, extraReviews, missing, expenseIds, basisIds, requests, salary, value, send, late, cleanup };
};
