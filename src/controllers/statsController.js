// src/controllers/statsController.js
const { prisma } = require("../db/connection");

async function summary(req, res) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalClients,
      totalPools,
      totalServices,
      servicesLast7,
      totalAlerts,
      internalAlerts,
      openAlerts,
      totalInvoices,
      pendingInvoices,
      paidInvoices,
      revenueAgg,
      totalTechnicians,
      activeTechnicians,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.pool.count(),
      prisma.service.count(),
      prisma.service.count({
        where: { date: { gte: sevenDaysAgo } },
      }),
      prisma.alert.count(),
      prisma.alert.count({
        where: { status: "INTERNAL_ONLY" },
      }),
      prisma.alert.count({
        where: { status: "OPEN" },
      }),
      prisma.invoice.count(),
      prisma.invoice.count({
        where: { status: "PENDING" },
      }),
      prisma.invoice.count({
        where: { status: "PAID" },
      }),
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: "PAID" },
      }),
      prisma.technician.count(),
      prisma.technician.count({
        where: { active: true },
      }),
    ]);

    res.json({
      clients: totalClients,
      pools: totalPools,
      services: {
        total: totalServices,
        last7Days: servicesLast7,
      },
      alerts: {
        total: totalAlerts,
        internal: internalAlerts,
        open: openAlerts,
      },
      invoices: {
        total: totalInvoices,
        pending: pendingInvoices,
        paid: paidInvoices,
        revenue: revenueAgg._sum.amount || 0,
      },
      technicians: {
        total: totalTechnicians,
        active: activeTechnicians,
      },
    });
  } catch (err) {
    console.error("Erro ao calcular estatísticas:", err);
    res.status(500).json({ error: "Erro ao calcular estatísticas." });
  }
}

module.exports = { summary };