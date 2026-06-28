// ==========================================
// CRISTAL WATER - REPORT SERVICE
// src/services/reportService.js
// ==========================================

const { prisma } = require("../prismaClient");

/**
 * Retorna o mês anterior no formato YYYY-MM
 */
function getLastMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth()).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Gera relatório mensal ADMIN
 */
async function generateAdminMonthlyReport() {
  const month = getLastMonthKey();

  const exists = await prisma.monthlyReport.findFirst({
    where: { month, type: "ADMIN" },
  });

  if (exists) return exists;

  const totalClients = await prisma.client.count({
    where: { status: "ACTIVE" },
  });

  const totalPools = await prisma.pool.count({
    where: { active: true },
  });

  const visitsDone = await prisma.serviceVisit.count({
    where: { status: "DONE" },
  });

  const visitsNotDone = await prisma.serviceVisit.count({
    where: { status: "NOT_DONE" },
  });

  const overdueClients = await prisma.client.count({
    where: { paymentStatus: "OVERDUE" },
  });

  return prisma.monthlyReport.create({
    data: {
      month,
      type: "ADMIN",
      data: {
        totalClients,
        totalPools,
        visitsDone,
        visitsNotDone,
        overdueClients,
      },
    },
  });
}

/**
 * Gera relatório mensal por CLIENTE
 */
async function generateClientMonthlyReport(clientId) {
  const month = getLastMonthKey();

  const exists = await prisma.monthlyReport.findFirst({
    where: { month, type: "CLIENT", clientId },
  });

  if (exists) return exists;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      pools: {
        include: { serviceVisits: true },
      },
    },
  });

  if (!client) return null;

  const pools = client.pools.map((p) => ({
    name: p.name,
    totalVisits: p.serviceVisits.length,
    notDone: p.serviceVisits.filter(v => v.status === "NOT_DONE").length,
  }));

  return prisma.monthlyReport.create({
    data: {
      month,
      type: "CLIENT",
      clientId,
      data: {
        client: client.name,
        paymentStatus: client.paymentStatus,
        pools,
      },
    },
  });
}

module.exports = {
  generateAdminMonthlyReport,
  generateClientMonthlyReport,
};