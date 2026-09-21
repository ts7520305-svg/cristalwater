// ==========================================
// CRISTAL WATER - ADMIN REPORT CONTROLLER
// src/controllers/adminReportController.js
// ==========================================

const { prisma } = require("../prismaClient");
const {
  generateAdminMonthlyReport,
} = require("../services/reportService");
const { generate: generateClientMonthlyReport } = require('../business/client/ClientMonthlyReportBusiness');
const { sendMonthlyReportEmails } = require("../services/reportEmailService");
const { manualReportMonth } = require('../services/monthlyReportMonth');

/**
 * POST /api/admin/reports/send-now
 * Gera relatórios e envia emails (se permitido)
 */
async function sendReportsNow(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  try {
    const monthRef = manualReportMonth(req.body);
    // 1️⃣ Gera relatório ADMIN
    await generateAdminMonthlyReport(monthRef);

    // 2️⃣ Gera relatórios CLIENTE
    const clients = await prisma.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    for (const c of clients) {
      await generateClientMonthlyReport(c.id, monthRef);
    }

    // 3️⃣ Envio opcional por email (controlado por NotificationRule)
    const result = await sendMonthlyReportEmails({ monthRef, manual: true });

    res.json({
      ok: true,
      message: result.blocked ? 'Relatórios preparados; envio de email desativado.' : 'Processamento terminado. Consulte os resultados do envio.',
      clients: clients.length,
      ...result,
    });
  } catch (err) {
    if (err.status === 400 || err.statusCode === 400) return res.status(400).json({ ok: false, error: err.message });
    next(err);
  }
}

module.exports = {
  sendReportsNow,
};
