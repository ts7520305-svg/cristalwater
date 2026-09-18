"use strict";
const PDFDocument = require("pdfkit");
const reportService = require("../services/visitReportService");

function renderPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 98, bottom: 58, left: 48, right: 48 }, bufferPages: true,
      info: { Title: "Cristal Water - Visita " + report.visit.id, Author: "Cristal Water" } });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    try {
      const width = doc.page.width - 96;
      function header() {
        const font = doc._font?.name || "Helvetica", size = doc._fontSize || 10;
        doc.fillColor("#145f86").font("Helvetica-Bold").fontSize(20).text("Cristal Water", 48, 34, { width, lineBreak: false });
        doc.fillColor("#334155").font("Helvetica").fontSize(10).text(
          (report.view === "admin" ? "Relatório técnico completo" : "Relatório de manutenção") + " | Visita #" + report.visit.id,
          48, 62, { width, lineBreak: false });
        doc.strokeColor("#d3e2eb").moveTo(48, 83).lineTo(doc.page.width - 48, 83).stroke();
        doc.font(font).fontSize(size).fillColor("#1f2937"); doc.x = 48; doc.y = 98;
      }
      doc.on("pageAdded", header); header();
      function space(height) { if (doc.y + height > doc.page.height - 58) doc.addPage(); }
      function paragraph(value) { doc.font("Helvetica").fontSize(10).text(reportService.text(value), 48, doc.y, { width, lineGap: 3 }); doc.y += 12; }
      for (const section of reportService.sections(report)) {
        space(70);
        const top = doc.y;
        doc.fillColor("#145f86").font("Helvetica-Bold").fontSize(13).text(section.title, 48, top, { width });
        doc.y = Math.max(doc.y + 9, top + 27); doc.fillColor("#1f2937");
        if (section.body) paragraph(section.body);
        else if (!section.rows.length) paragraph(section.empty);
        else {
          // Measure every row; long values flow across pages without fixed-height clipping.
          const cellWidth = (width - 20) / 2;
          for (let index = 0; index < section.rows.length;) {
            const cells = section.rows.slice(index, index + 2);
            const heights = cells.map(([label, value]) => {
              doc.font("Helvetica-Bold").fontSize(9); const labelHeight = doc.heightOfString(label, { width: cellWidth });
              doc.font("Helvetica").fontSize(10); return labelHeight + 5 + doc.heightOfString(reportService.text(value), { width: cellWidth, lineGap: 2 });
            });
            if (Math.max(...heights) > 180) {
              const [label, value] = section.rows[index++]; space(55);
              doc.font("Helvetica-Bold").fontSize(10).text(label, 48, doc.y, { width }); doc.y += 4; paragraph(value);
              continue;
            }
            const height = Math.max(...heights) + 14; space(height);
            const y = doc.y;
            cells.forEach(([label, value], column) => {
              const x = 48 + column * (cellWidth + 20);
              doc.font("Helvetica-Bold").fontSize(9).text(label, x, y, { width: cellWidth });
              const valueY = doc.y + 5;
              doc.font("Helvetica").fontSize(10).text(reportService.text(value), x, valueY, { width: cellWidth, lineGap: 2 });
            });
            doc.x = 48; doc.y = y + height; index += cells.length;
          }
        }
        doc.y += 7;
      }
      const range = doc.bufferedPageRange();
      for (let page = range.start; page < range.start + range.count; page++) {
        doc.switchToPage(page);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font("Helvetica").fontSize(8).fillColor("#526476").text(
          "Cristal Water | Dados da instalação: registo atual | " + (page + 1) + "/" + range.count,
          48, doc.page.height - 35, { width, align: "center", lineBreak: false });
        doc.page.margins.bottom = bottom;
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
async function generateVisitReport(req, res) {
  res.set("Cache-Control", "private, no-store");
  try {
    const report = await reportService.read(req.user, req.params.id, req.query);
    const bytes = await renderPdf(report);
    reportService.headers(res, report, "visit-pdf");
    res.type("application/pdf").set("Content-Disposition", `inline; filename="relatorio-visita-${report.visit.id}-${report.view}.pdf"`).send(bytes);
  } catch (error) {
    if (!error.statusCode) console.error("generateVisitReport error:", error);
    res.status(error.statusCode || 503).json({ ok: false, error: error.statusCode ? error.message : "Não foi possível gerar o relatório. Tente novamente." });
  }
}
module.exports = { generateVisitReport };
