'use strict';
const { prisma } = require('../../prismaClient');
const { listDashboardSources } = require('./AlertListBusiness');
const { listExternalInvoices } = require('../finance/FinanceOsBusiness');

// Every source, including alert previews and external-reference history, must
// observe the same committed state. A failed source rejects the whole summary.
async function readDashboardSources({ start, end }) {
  return prisma.$transaction(async tx => {
    const [clients, pools, technicians, invoices, payments, dashboardAlerts, visits, externalBilling] = await Promise.all([
      // These records feed counters and calculated rows, never raw JSON. Avoid
      // materializing every client's documents and full related client copies.
      tx.client.findMany({ select: { id: true }, orderBy: { name: 'asc' } }),
      tx.pool.findMany({ select: { zone: true, location: true }, orderBy: { id: 'asc' } }),
      tx.technician.findMany({ orderBy: { name: 'asc' } }),
      tx.invoice.findMany({ select: {
        id: true, clientId: true, status: true, monthRef: true, month: true, year: true, issueDate: true, createdAt: true,
        total: true, totalAmount: true, amount: true, totalCents: true, amountCents: true, amountPaid: true, amountOpen: true,
        client: { select: { name: true } }, payments: { select: { amount: true, amountCents: true } },
      }, orderBy: { createdAt: 'desc' } }),
      tx.payment.findMany({ select: {
        id: true, invoiceId: true, amount: true, amountCents: true, method: true, notes: true, paidAt: true, createdAt: true,
        invoice: { select: { clientId: true, client: { select: { name: true } } } },
      }, orderBy: { paidAt: 'desc' } }),
      listDashboardSources(tx),
      tx.serviceVisit.findMany({
        where: { OR: [{ plannedDate: { gte: start, lte: end } }, { date: { gte: start, lte: end } }] },
        include: { client: true, pool: { include: { client: true } }, technician: true },
        orderBy: [{ plannedDate: 'asc' }, { date: 'asc' }],
      }),
      listExternalInvoices({ status: 'all' }, false, tx),
    ]);
    return { clients, pools, technicians, invoices, payments, dashboardAlerts, visits, externalBilling };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
}

module.exports = { readDashboardSources };
