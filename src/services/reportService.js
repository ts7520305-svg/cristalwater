// ==========================================
// CRISTAL WATER - REPORT SERVICE
// src/services/reportService.js
// ==========================================

const { prisma } = require("../prismaClient");
const { reportMonth } = require('./monthlyReportMonth');

/**
 * Gera relatório mensal ADMIN
 */
async function generateAdminMonthlyReport(monthRef) {
  const month = reportMonth(monthRef);

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
