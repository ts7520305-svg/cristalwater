// ==========================================
// CRISTAL WATER - ADMIN REPORT CONTROLLER
// src/controllers/adminReportController.js
// ==========================================

const { prisma } = require("../prismaClient");
const {
  generateAdminMonthlyReport,
  generateClientMonthlyReport,
} = require("../services/reportService");
const { sendMonthlyReportEmails } = require("../services/reportEmailService");

/**
 * POST /api/admin/reports/send-now
 * Gera relatórios e envia emails (se permitido)
 */
async function sendReportsNow(req, res, next) {
  try {
    // 1️⃣ Gera relatório ADMIN
    await generateAdminMonthlyReport();

    // 2️⃣ Gera relatórios CLIENTE
    const clients = await prisma.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    for (const c of clients) {
      await generateClientMonthlyReport(c.id);
    }

    // 3️⃣ Envio opcional por email (controlado por NotificationRule)
    await sendMonthlyReportEmails();

    res.json({
      message: "Relatórios gerados e envio de email processado",
      clients: clients.length,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sendReportsNow,
};