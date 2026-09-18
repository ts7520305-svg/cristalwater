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
  const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = ref.getFullYear();
  const month = String(ref.getMonth() + 1).padStart(2, "0");
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
const generateClientMonthlyReport = require('../business/client/ClientMonthlyReportBusiness').generate;

module.exports = {
  generateAdminMonthlyReport,
  generateClientMonthlyReport,
};