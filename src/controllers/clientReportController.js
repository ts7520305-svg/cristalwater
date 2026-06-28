// ==========================================
// CRISTAL WATER - CLIENT REPORT CONTROLLER
// ==========================================

const { prisma } = require("../prismaClient");
const { generateClientReportPDF } = require("../services/pdfReportService");

/**
 * LISTAR RELATÓRIOS DO CLIENTE
 */
async function listClientReports(req, res, next) {
  try {
    const clientId = Number(req.params.clientId);

    const reports = await prisma.monthlyReport.findMany({
      where: {
        type: "CLIENT",
        clientId,
      },
      orderBy: { month: "desc" },
    });

    res.json({
      count: reports.length,
      reports,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GERAR PDF DO RELATÓRIO
 */
async function downloadClientReportPDF(req, res, next) {
  try {
    const clientId = Number(req.params.clientId);
    const reportId = Number(req.params.reportId);

    const report = await prisma.monthlyReport.findFirst({
      where: {
        id: reportId,
        clientId,
        type: "CLIENT",
      },
    });

    if (!report) {
      return res.status(404).json({ error: "Relatório não encontrado" });
    }

    generateClientReportPDF(res, report);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listClientReports,
  downloadClientReportPDF,
};