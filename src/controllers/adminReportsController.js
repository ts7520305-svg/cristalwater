// ==========================================
// CRISTAL WATER - ADMIN REPORTS CONTROLLER
// ==========================================

const { prisma } = require("../prismaClient");

/**
 * GET /api/admin/reports
 * Lista relatórios mensais
 * Query params opcionais:
 * - month=YYYY-MM
 * - type=ADMIN|CLIENT
 */
async function listMonthlyReports(req, res, next) {
  try {
    const { month, type } = req.query;

    const where = {};
    if (month) where.month = month;
    if (type) where.type = type;

    const reports = await prisma.monthlyReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
      },
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
 * GET /api/admin/reports/:id
 * Detalhe de um relatório
 */
async function getMonthlyReport(req, res, next) {
  try {
    const id = Number(req.params.id);

    const report = await prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
      },
    });

    if (!report) {
      return res.status(404).json({ error: "Relatório não encontrado" });
    }

    res.json(report);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMonthlyReports,
  getMonthlyReport,
};