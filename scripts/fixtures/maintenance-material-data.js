'use strict';
const { randomUUID, randomInt } = require('node:crypto'), { prisma } = require('../../src/prismaClient');
const equipment = require('../../src/business/equipment/EquipmentMaintenanceBusiness'), billing = require('../../src/business/equipment/MaintenanceBillingBusiness'), ledger = require('../../src/services/expenseLedgerService');
module.exports = async function (admin) {
  if (process.env.NODE_ENV !== 'test' || process.env.QA_MODE !== 'true' || process.env.QA_ENVIRONMENT_SAFE !== 'true' || process.env.EXTERNAL_NOTIFICATIONS_ENABLED !== 'false') throw Error('Isolated QA required');
  const tag = 'Maintenance materials ' + randomUUID(), month = new Date().toISOString().slice(0, 7), startAt = new Date(Date.now() - 120000);
  const client = await prisma.client.create({ data: { name: tag + ' <img src=x>' } }), other = await prisma.client.create({ data: { name: tag + ' other' } });
  const pool = await prisma.pool.create({ data: { name: tag, clientId: client.id } }), tech = await prisma.technician.create({ data: { name: tag, active: true } });
  const product = await prisma.inventoryProduct.create({ data: { name: 'CLORO ' + randomUUID(), unit: 'KG', defaultCost: 9999 } });
  const sameId = randomInt(510000000, 590000000), visitIds = [], extraIds = [], plans = [], completions = [], expenseIds = [], purchases = [], requests = [];
  async function visit(type = 'REGULAR', id) { const row = await prisma[type === 'REGULAR' ? 'serviceVisit' : 'extraVisit'].create({ data: { ...(id ? { id } : {}), clientId: client.id, poolId: pool.id, technicianId: tech.id, status: 'IN_PROGRESS', startAt } }); (type === 'REGULAR' ? visitIds : extraIds).push(row.id); return row; }
  const regular = await visit('REGULAR', sameId), extra = await visit('EXTRA', sameId), race = await visit();
  async function complete(type, visitId, q = '0.1') {
    const plan = (await equipment.create(admin, pool.id, { component: 'FILTER', title: tag + ' ' + completions.length, instructions: 'Conferir materiais da revisão', intervalUnit: 'MONTHS', intervalCount: 1, nextDue: month + '-01' })).plan; plans.push(plan.id);
    const requestId = randomUUID(); requests.push(requestId);
    const result = await equipment.complete(admin, plan.id, { requestId, visitType: type, visitId, poolId: pool.id, expectedVersion: plan.version, notes: 'Materiais declarados no terreno', confirmed: true, ...(q === null ? {} : { materials: q === 'NONE' ? { mode: 'NONE', items: [] } : { mode: 'DECLARED', items: [{ productName: product.name, unit: 'kg', quantity: q }] } }) });
    if (!result.applied) throw Error(JSON.stringify(result)); const id = result.completion.id; completions.push(id);
    const source = (await billing.list(admin, pool.id, { kind: 'EQUIPMENT' })).rows.find(s => s.sourceId === id);
    await billing.review(admin, 'EQUIPMENT', id, { expectedVersion: source.expectedVersion, expectedClientId: client.id, expectedPoolId: pool.id, mode: 'INCLUDED', amount: '0.00', note: 'Revisão e cliente histórico conferidos', confirmed: true });
    return { id, result, planId: plan.id };
  }
  const reviews = []; for (let i = 0; i < 3; i++) reviews.push(await complete('REGULAR', sameId));
  const none = await complete('REGULAR', sameId, 'NONE'), missing = []; for (let i = 0; i < 11; i++) missing.push(await complete('REGULAR', sameId, null));
  const extraReview = await complete('EXTRA', sameId, '0.3'), raceReview = await complete('REGULAR', race.id, '0.3');
  const endAt = new Date(Date.now() + 1000);
  await prisma.serviceVisit.updateMany({ where: { id: { in: visitIds } }, data: { status: 'DONE', endAt } }); await prisma.extraVisit.updateMany({ where: { id: { in: extraIds } }, data: { status: 'DONE', endAt } });
  async function movement(type = 'REGULAR', id = sameId, quantity = 0.6, movementType = 'CONSUMPTION', more = {}) { return prisma.stockMovement.create({ data: { visitId: type === 'REGULAR' ? id : null, extraVisitId: type === 'EXTRA' ? id : null, productId: product.id, productName: product.name, unit: 'KG', quantity, movementType, clientId: client.id, poolId: pool.id, technicianId: tech.id, createdAt: new Date(+endAt - 1), ...more } }); }
  await movement('REGULAR', sameId, 0.7); await movement('REGULAR', sameId, 0.1, 'RETURN'); await movement('EXTRA', sameId, 0.3); await movement('REGULAR', race.id, 0.6);
  async function send(command, expenseId, data) { const e = await prisma.companyExpense.findUniqueOrThrow({ where: { id: expenseId } }); return ledger.command(admin, { requestId: randomUUID(), command, expenseId, expectedVersion: e.version, data }); }
  async function purchase(total = 1, more = {}) {
    const p = await prisma.stockPurchase.create({ data: { supplierName: tag + ' ' + purchases.length, invoiceDate: new Date(month + '-01T00:00:00Z'), totalAmount: total, items: { create: { productName: product.name, productId: product.id, unit: 'KG', quantity: 0.3, unitCost: total / 0.3, totalCost: total, lot: 'Histórico <img src=x>', ...more } } }, include: { items: true } }); purchases.push(p.id);
    const source = await require('../../src/services/expenseSourceService').source(prisma, 'STOCK_PURCHASE', p.id);
    const result = await ledger.command(admin, { requestId: randomUUID(), command: 'CREATE', expenseId: null, expectedVersion: null, data: { ...source.suggested, title: tag, dueDate: null, notes: '', sourceType: source.type, sourceId: source.id, sourceHash: source.hash, reason: 'Compra e documento confirmados', confirmed: true } });
    if (!result.applied) throw Error(JSON.stringify(result)); expenseIds.push(result.expenseId); return { p, item: p.items[0], expenseId: result.expenseId };
  }
  async function value(bought, type = 'REGULAR', id = sameId, quantity = '0.3') {
    const p = (await ledger.valuationPreview(bought.expenseId, { kind: 'MATERIAL', targetType: type, targetId: String(id), purchaseItemId: String(bought.item.id), quantity })).preview;
    const result = await send('VALUE_MATERIAL', bought.expenseId, { ...Object.fromEntries(['kind','targetType','targetId','targetHash','monthRef','purchaseItemId','quantity','amountCents','valuationHash'].map(k => [k, p[k]])), previewHash: p.hash, reason: 'Consumo líquido e linha da compra confirmados', confirmed: true });
    if (!result.applied) throw Error(JSON.stringify(result)); return result.allocation;
  }
  const stock = () => prisma.stockMovement.findMany({ where: { OR: [{ visitId: { in: visitIds } }, { extraVisitId: { in: extraIds } }] }, orderBy: { id: 'asc' } });
  async function cleanup() {
    for (const model of ['expenseEvent','expensePayment','expenseAllocation']) await prisma[model].deleteMany({ where: { expenseId: { in: expenseIds } } }); await prisma.companyExpense.deleteMany({ where: { id: { in: expenseIds } } }); await prisma.stockPurchase.deleteMany({ where: { id: { in: purchases } } });
    await prisma.fieldWriteRequest.deleteMany({ where: { owner: 'ADMIN:' + admin.id, requestId: { in: requests } } });
    await prisma.operationalReminder.deleteMany({ where: { sourceKey: { in: completions.map(id => 'maintenance-billing:EQUIPMENT:' + id) } } });
    await prisma.technicalHistory.deleteMany({ where: { poolId: pool.id, type: 'EQUIPMENT_MAINTENANCE' } }); await prisma.equipmentMaintenanceCompletion.deleteMany({ where: { id: { in: completions } } }); await prisma.equipmentMaintenancePlan.deleteMany({ where: { id: { in: plans } } });
    await prisma.stockMovement.deleteMany({ where: { OR: [{ visitId: { in: visitIds } }, { extraVisitId: { in: extraIds } }] } }); await prisma.serviceVisit.deleteMany({ where: { id: { in: visitIds } } }); await prisma.extraVisit.deleteMany({ where: { id: { in: extraIds } } });
  }
  return { tag, month, startAt, endAt, sameId, client, other, pool, tech, product, regular, extra, race, reviews, none, missing, extraReview, raceReview, expenseIds, purchase, value, movement, send, stock, cleanup };
};
