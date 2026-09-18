"use strict";
const reportService = require("../services/visitReportService");

async function generateVisitReport(req, res) {
  res.set("Cache-Control", "private, no-store");
  try {
    const report = await reportService.read(req.user, req.params.id, req.query);
    const bytes = await reportService.renderPdf(report);
    reportService.headers(res, report, "visit-pdf");
    res.type("application/pdf").set("Content-Disposition", `inline; filename="relatorio-visita-${report.visit.id}-${report.view}.pdf"`).send(bytes);
  } catch (error) {
    if (!error.statusCode) console.error("generateVisitReport error:", error);
    res.status(error.statusCode || 503).json({ ok: false, error: error.statusCode ? error.message : "Não foi possível gerar o relatório. Tente novamente." });
  }
}
module.exports = { generateVisitReport };
