'use strict';
const { prisma } = require('../../prismaClient');
const { listDashboardSources } = require('./AlertListBusiness');
const { listExternalInvoices } = require('../finance/FinanceOsBusiness');

// Every source, including alert previews and external-reference history, must
// observe the same committed state. A failed source rejects the whole summary.
async function readDashboardSources({ start, end }) {
  return prisma.$transaction(async tx => {
    const [clients, pools, technicians, invoices, payments, dashboardAlerts, visits, externalBilling] = await Promise.all([
      tx.client.findMany({ include: { pools: true, invoices: true }, orderBy: { name: 'asc' } }),
      tx.pool.findMany({ include: { client: true }, orderBy: { id: 'asc' } }),
      tx.technician.findMany({ orderBy: { name: 'asc' } }),
      tx.invoice.findMany({ include: { client: true, payments: true }, orderBy: { createdAt: 'desc' } }),
      tx.payment.findMany({ include: { invoice: { include: { client: true } } }, orderBy: { paidAt: 'desc' } }),
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
