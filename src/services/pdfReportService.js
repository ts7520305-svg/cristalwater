// ==========================================
// CRISTAL WATER - PDF REPORT SERVICE
// ==========================================

const PDFDocument = require("pdfkit");

/**
 * Gera PDF do relatório mensal do cliente
 */
function generateMonthlyReportPDF(res, report) {
  const doc = new PDFDocument({ margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=relatorio-${report.month}.pdf`
  );

  doc.pipe(res);

  // CABEÇALHO
  doc
    .fontSize(22)
    .fillColor("#007bff")
    .text("Cristal Water", { align: "center" })
    .moveDown(0.5);

  doc
    .fontSize(16)
    .fillColor("#000")
    .text("Relatório Mensal", { align: "center" })
    .moveDown(1);

  // INFO CLIENTE
  doc
    .fontSize(12)
    .text(`Cliente: ${report.data.client}`)
    .text(`Mês: ${report.month}`)
    .text(`Estado de pagamento: ${report.data.paymentStatus}`)
    .moveDown(1);

  // PISCINAS
  report.data.pools.forEach((pool) => {
    doc
      .fontSize(13)
      .fillColor("#000")
      .text(`Piscina: ${pool.name}`, { underline: true })
      .moveDown(0.3);

    doc
      .fontSize(11)
      .text(`Visitas realizadas: ${pool.totalVisits}`)
      .text(`Não realizadas: ${pool.notDone}`)
      .moveDown(0.8);
  });

  // RODAPÉ
  doc
    .moveDown(2)
    .fontSize(10)
    .fillColor("#666")
    .text("Cristal Water • Manutenção de Piscinas", { align: "center" });

  doc.end();
}

module.exports = {
  generateMonthlyReportPDF,
};