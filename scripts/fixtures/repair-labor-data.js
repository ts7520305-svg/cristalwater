'use strict';
const { randomUUID } = require('node:crypto'), { prisma } = require('../../src/prismaClient');
module.exports = async function create({ admin }) {
  const f = await require('./repair-work-data')({ admin }), expenses = [], work = require('../../src/services/repairWorkService'), ledger = require('../../src/services/expenseLedgerService');
  const actor = { id: admin.id, role: 'ADMIN' };
  async function record(repairId, technicianId, startedAt, endedAt) {
    const { detail } = await work.detail(actor, repairId);
    const result = await work.command(actor, repairId, { requestId: randomUUID(), command: 'RECORD', expectedVersion: detail.contextVersion, data: { technicianId, startedAt, endedAt, reason: 'Trabalho declarado e horários confirmados para QA', confirmed: true } });
    if (!result.applied) throw Error(JSON.stringify(result)); return result.interval;
  }
  async function voidWork(row) {
    const { detail } = await work.detail(actor, row.repairId), current = detail.rows.find(r => r.id === row.id);
    const result = await work.command(actor, row.repairId, { requestId: randomUUID(), command: 'VOID', expectedVersion: detail.contextVersion, data: { intervalId: row.id, recordHash: current.recordHash, reason: 'Corrigir explicitamente o intervalo declarado', confirmed: true } });
    if (!result.applied) throw Error(JSON.stringify(result)); return result;
  }
  async function salary({ amountCents = 100, paidMinutes = 3, technicianId = f.tech.id, periodStart = '2004-01-01', periodEnd = '2004-01-31' } = {}) {
    const made = await ledger.command(actor, { requestId: randomUUID(), command: 'CREATE', expenseId: null, expectedVersion: null, data: { title: 'Trabalho <img src=x> ' + f.tag + ' ' + expenses.length, supplierId: null, supplierName: 'Equipa QA ' + f.tag, documentNumber: 'WORK-' + randomUUID(), expenseDate: '2004-01-15', dueDate: null, amountCents, category: 'LABOR', notes: 'Documento histórico e tempo pago conferidos', sourceType: 'MANUAL', sourceId: null, sourceHash: null, confirmed: true, reason: 'Despesa de trabalho confirmada' } });
    if (!made.applied) throw Error(JSON.stringify(made)); expenses.push(made.expenseId);
    const result = await ledger.command(actor, { requestId: randomUUID(), command: 'SET_LABOR_BASIS', expenseId: made.expenseId, expectedVersion: made.version, data: { technicianId, periodStart, periodEnd, paidMinutes, reason: 'Técnico, período e minutos pagos confirmados', confirmed: true } });
    if (!result.applied) throw Error(JSON.stringify(result)); return { expenseId: made.expenseId };
  }
  const first = await record(f.reserved.id, f.tech.id, '2004-01-02T09:00:00.000Z', '2004-01-02T09:01:00.000Z');
  const adjacent = await record(f.reserved.id, f.tech.id, '2004-01-02T09:01:00.000Z', '2004-01-02T09:02:00.000Z');
  const none = await record(f.none.id, f.tech.id, '2004-01-02T09:02:00.000Z', '2004-01-02T09:03:00.000Z');
  const otherTech = await record(f.reserved.id, f.second.id, '2004-01-02T09:00:00.000Z', '2004-01-02T09:01:00.000Z');
  const boundary = await record(f.none.id, f.tech.id, '2004-01-31T23:59:30.000Z', '2004-02-01T00:00:30.000Z');
  async function cleanup() {
    await prisma.expenseEvent.deleteMany({ where: { expenseId: { in: expenses } } });
    await prisma.expenseAllocation.deleteMany({ where: { expenseId: { in: expenses } } });
    await prisma.expenseLaborBasis.deleteMany({ where: { expenseId: { in: expenses } } });
    await prisma.companyExpense.deleteMany({ where: { id: { in: expenses } } });
    await f.cleanup();
  }
  return { ...f, first, adjacent, noMaterialWork: none, otherTech, boundary, salary, record, voidWork, expenses, month: f.reserved.doneAt.toISOString().slice(0,7), documentMonth: '2004-01', cleanup };
};
