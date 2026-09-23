'use strict';
const { randomUUID } = require('node:crypto'), { prisma } = require('../../src/prismaClient'), ledger = require('../../src/services/expenseLedgerService');
module.exports = async function create(admin) {
  const f = await require('./repair-cost-data')({ admin });
  async function send(command, expenseId, data) { const row = await prisma.companyExpense.findUniqueOrThrow({ where: { id: expenseId } }); return ledger.command(admin, { requestId: randomUUID(), command, expenseId, expectedVersion: row.version, data }); }
  async function cost(type = 'REGULAR', more = {}, allocationMonth = f.mismatchMonth, targetId = f.reserved.id) {
    const e = await f.expense({ category: 'FUEL', ...more }), target = await ledger.costs.targets.get(prisma, type, targetId);
    const result = await send('ALLOCATE_COST', e.expenseId, { targetType: type, targetId, targetHash: target.hash, monthRef: allocationMonth, amountCents: 1500, reason: 'Despesa operacional confirmada', confirmed: true });
    if (!result.applied) throw Error(JSON.stringify(result)); return result;
  }
  return { ...f, cost, send };
};
