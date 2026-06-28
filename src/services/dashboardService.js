// ==========================================
// CRISTAL WATER - DASHBOARD SERVICE
// src/services/dashboardService.js
// ==========================================

const { prisma } = require("../prismaClient");

async function getAdminDashboard() {
  const totalClients = await prisma.client.count();
  const totalPools = await prisma.pool.count();
  const totalTechnicians = await prisma.technician.count();

  const totalVisits = await prisma.serviceVisit.count();
  const failedVisits = await prisma.serviceVisit.count({
    where: { status: "NOT_DONE" },
  });

  const recentFailures = await prisma.serviceVisit.findMany({
    where: { status: "NOT_DONE" },
    orderBy: { date: "desc" },
    take: 5,
    include: {
      pool: { include: { client: true } },
      technician: true,
      round: true,
    },
  });

  return {
    totals: {
      clients: totalClients,
      pools: totalPools,
      technicians: totalTechnicians,
      visits: totalVisits,
      failures: failedVisits,
    },
    recentFailures,
  };
}

module.exports = {
  getAdminDashboard,
};