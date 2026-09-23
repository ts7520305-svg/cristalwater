'use strict';
const { randomUUID } = require('node:crypto'), { prisma } = require('../../src/prismaClient');
module.exports = async function create({ admin }) {
  const f = await require('./repair-cost-data')({ admin }), purchases = [];
  const context = await require('../../src/services/repairExecutionService').load(prisma, [f.reserved.id]);
  const proof = context.proofs.get(f.reserved.id)[0], movement = context.movements.get(proof.metadata.movements[0].id);
  async function purchase({ quantity = 10, unitCost = 10, total = quantity * unitCost, date = f.documentMonth + '-01', productName = movement.productName, unit = movement.unit, productId = null } = {}) {
    const row = await prisma.stockPurchase.create({ data: { supplierName: 'Repair materials ' + randomUUID(), invoiceDate: new Date(date + 'T00:00:00Z'), totalAmount: total, items: { create: { productName, productId, unit, quantity, unitCost, totalCost: total, lot: 'Historical confirmed lot <img src=x>' } } }, include: { items: true } }); purchases.push(row.id);
    const source = await require('../../src/services/expenseSourceService').source(prisma, 'STOCK_PURCHASE', row.id);
    const saved = await f.expense({ ...source.suggested, title: 'Repair materials ' + f.tag, sourceType: source.type, sourceId: source.id, sourceHash: source.hash });
    return { row, item: row.items[0], expenseId: saved.expenseId };
  }
  return { ...f, proof, movement, purchase, cleanup: async () => { await f.cleanup(); await prisma.stockPurchase.deleteMany({ where: { id: { in: purchases } } }); } };
};
