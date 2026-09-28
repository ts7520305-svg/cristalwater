'use strict';
const { prisma } = require('../../prismaClient');

// Keep the existing UTC filters and source semantics, but observe one database
// snapshot. The caller may cache results only after the transaction succeeds.
async function readMetricsSources({ start, end }) {
  return prisma.$transaction(async tx => {
    const [serviceVisitsByStatus, activeAlerts, financialAggregates] = await Promise.all([
      tx.serviceVisit.groupBy({
        by: ['status'], _count: { id: true },
        where: { OR: [{ plannedDate: { gte: start, lte: end } }, { date: { gte: start, lte: end } }] },
      }),
      tx.technicalAlert.count({ where: { status: { not: 'RESOLVED' } } }),
      tx.invoice.aggregate({ _sum: { total: true }, where: { createdAt: { gte: start, lte: end } } }),
    ]);
    return { serviceVisitsByStatus, activeAlerts, financialAggregates };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
}

module.exports = { readMetricsSources };
