// ==========================================
// CLIENT REPORT PDF CONTROLLER
// ==========================================

const { prisma } = require("../prismaClient");
const { generateMonthlyReportPDF } = require("../services/pdfReportService");
const { roleMatches } = require("../utils/roles");

/**
 * GET /api/client/reports/:id/pdf
 */
async function downloadReportPDF(req, res) {
  try {
    const reportId = Number(req.params.id);

    const report = await prisma.monthlyReport.findUnique({
      where: { id: reportId },
    });

    if (!report || report.type !== "CLIENT") {
      return res.status(404).json({ error: "Relatório não encontrado" });
    }

    const role = String(req.user?.role || "").trim().toUpperCase();
    if (!roleMatches(role, "ADMIN")) {
      const authClientId = Number(req.user?.clientId || req.user?.id || 0);
      if (!authClientId || authClientId !== Number(report.clientId || 0)) {
        return res.status(403).json({ error: "Acesso negado" });
      }
    }

    generateMonthlyReportPDF(res, report);
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).json({ error: "Erro ao gerar PDF" });
  }
}

module.exports = {
  downloadReportPDF,
};