const fs = require("fs");
const path = require("path");
const { prisma } = require("../prismaClient");
const PDFDocument = require("pdfkit");
const { roleMatches } = require("../utils/roles");

// ==========================================================
// HELPERS
// ==========================================================

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-PT");
}

function yesNo(value) {
  return value ? "Sim" : "Não";
}

function safeValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function drawBox(doc, x, y, w, h) {
  doc.roundedRect(x, y, w, h, 6).stroke();
}

function drawLabelValue(doc, label, value, x, y, width) {
  doc.font("Helvetica-Bold").fontSize(10).text(`${label}:`, x, y, {
    width,
  });
  doc.font("Helvetica").fontSize(10).text(safeValue(value), x, y + 12, {
    width,
  });
}

function drawSectionTitle(doc, title, x, y, width) {
  doc.font("Helvetica-Bold").fontSize(13).text(title, x, y, { width });
  doc.moveTo(x, y + 16).lineTo(x + width, y + 16).stroke();
}

function ensureSpace(doc, needed = 80) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
  }
}

function getClientSetting(client) {
  return (
    client?.reportSetting || {
      showClientName: true,
      showPoolName: true,
      showZone: true,
      showAddress: false,
      showTechnicianName: false,
      showStatus: true,
      showPlannedDate: true,
      showStartEnd: false,
      showWaterParameters: true,
      showChecklist: true,
      showChemicals: false,
      showEquipment: false,
      showTechnicalRoom: false,
      showNotes: true,
      showPhotos: false,
    }
  );
}

function canShow(isAdmin, settingValue) {
  return isAdmin || !!settingValue;
}

function addPageFooter(doc) {
  const bottomY = doc.page.height - 35;
  doc.font("Helvetica").fontSize(8).fillColor("gray");
  doc.text(
    "Documento gerado automaticamente pelo sistema Cristal Water.",
    40,
    bottomY,
    { align: "center", width: doc.page.width - 80 }
  );
  doc.fillColor("black");
}

// ==========================================================
// PDF
// ==========================================================

async function generateVisitReport(req, res) {
  try {
    const visitId = Number(req.params.id);
    const tokenRole = String(req.user?.role || "").trim().toUpperCase();
    const role = tokenRole || "CLIENT";
    const isAdmin = roleMatches(role, "ADMIN");

    if (!Number.isInteger(visitId)) {
      return res.status(400).send("ID da visita inválido");
    }

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        client: {
          include: {
            reportSetting: true,
          },
        },
        pool: {
          include: {
            equipment: true,
            technicalRoom: true,
          },
        },
        chemicals: true,
        photos: true,
      },
    });

    if (!visit) {
      return res.status(404).send("Visita não encontrada");
    }

    if (roleMatches(role, "TECHNICIAN") && !isAdmin) {
      const authTechId = Number(req.user?.technicianId || req.user?.id || 0);
      if (!authTechId || authTechId !== Number(visit.technicianId || 0)) {
        return res.status(403).send("Acesso negado");
      }
    }

    if (roleMatches(role, "CLIENT")) {
      const authClientId = Number(req.user?.clientId || req.user?.id || 0);
      const visitClientId = Number(visit.clientId || visit.pool?.clientId || 0);
      if (!authClientId || authClientId !== visitClientId) {
        return res.status(403).send("Acesso negado");
      }
    }

    const setting = getClientSetting(visit.client);

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="relatorio-visita-${visit.id}-${role.toLowerCase()}.pdf"`
    );

    doc.pipe(res);

    // ======================================================
    // HEADER PREMIUM
    // ======================================================

    const logoPath = path.join(process.cwd(), "frontend", "logo.png");
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 80;

    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 40, 35, { fit: [90, 60] });
      } catch (e) {
        // ignora falha do logo
      }
    }

    doc.font("Helvetica-Bold").fontSize(24).text("Cristal Water", 0, 40, {
      align: "center",
      width: pageWidth,
    });

    doc.font("Helvetica").fontSize(14).text(
      isAdmin ? "Relatório Técnico Completo" : "Relatório de Manutenção",
      0,
      70,
      { align: "center", width: pageWidth }
    );

    doc.y = 115;

    // Barra de resumo
    drawBox(doc, 40, doc.y, contentWidth, 36);
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text(`Visita #${visit.id}`, 52, doc.y + 12);
    doc.text(`Perfil: ${isAdmin ? "ADMIN" : "CLIENTE"}`, 220, doc.y + 12);
    doc.text(`Estado: ${visit.status || "-"}`, 410, doc.y + 12);

    doc.moveDown(3);

    // ======================================================
    // RESUMO RÁPIDO
    // ======================================================

    ensureSpace(doc, 120);

    const summaryTop = doc.y;
    const cardGap = 10;
    const cardWidth = (contentWidth - cardGap * 3) / 4;
    const cardHeight = 58;

    const summaryCards = [
      {
        label: "Cliente",
        value: canShow(isAdmin, setting.showClientName)
          ? visit.client?.name || "-"
          : "Oculto",
      },
      {
        label: "Instalação",
        value: canShow(isAdmin, setting.showPoolName)
          ? visit.pool?.name || "-"
          : "Oculto",
      },
      {
        label: "Data",
        value: canShow(isAdmin, setting.showPlannedDate)
          ? formatDate(visit.plannedDate)
          : "Oculta",
      },
      {
        label: "Técnico",
        value: canShow(isAdmin, setting.showTechnicianName)
          ? visit.technicianName || "-"
          : "Oculto",
      },
    ];

    summaryCards.forEach((item, index) => {
      const x = 40 + index * (cardWidth + cardGap);
      drawBox(doc, x, summaryTop, cardWidth, cardHeight);
      doc.font("Helvetica-Bold").fontSize(9).text(item.label, x + 10, summaryTop + 10, {
        width: cardWidth - 20,
      });
      doc.font("Helvetica").fontSize(10).text(item.value, x + 10, summaryTop + 25, {
        width: cardWidth - 20,
      });
    });

    doc.y = summaryTop + cardHeight + 18;

    // ======================================================
    // DADOS GERAIS
    // ======================================================

    ensureSpace(doc, 170);
    drawSectionTitle(doc, "Dados gerais", 40, doc.y, contentWidth);
    doc.y += 26;

    const generalStartY = doc.y;
    const leftX = 40;
    const rightX = 300;
    const colWidth = 240;

    let leftY = generalStartY;
    let rightY = generalStartY;

    if (canShow(isAdmin, setting.showClientName)) {
      drawLabelValue(doc, "Cliente", visit.client?.name, leftX, leftY, colWidth);
      leftY += 32;
    }

    if (canShow(isAdmin, setting.showPoolName)) {
      drawLabelValue(doc, "Instalação", visit.pool?.name, leftX, leftY, colWidth);
      leftY += 32;
    }

    drawLabelValue(doc, "Tipo", visit.pool?.installationType || "-", leftX, leftY, colWidth);
    leftY += 32;

    if (canShow(isAdmin, setting.showZone)) {
      drawLabelValue(
        doc,
        "Zona",
        visit.pool?.zone || visit.client?.zone || "-",
        leftX,
        leftY,
        colWidth
      );
      leftY += 32;
    }

    if (canShow(isAdmin, setting.showAddress)) {
      drawLabelValue(
        doc,
        "Morada",
        visit.pool?.address || visit.client?.address || "-",
        leftX,
        leftY,
        colWidth
      );
      leftY += 40;
    }

    if (canShow(isAdmin, setting.showTechnicianName)) {
      drawLabelValue(doc, "Técnico", visit.technicianName, rightX, rightY, colWidth);
      rightY += 32;
    }

    if (canShow(isAdmin, setting.showStatus)) {
      drawLabelValue(doc, "Estado", visit.status, rightX, rightY, colWidth);
      rightY += 32;
    }

    if (canShow(isAdmin, setting.showPlannedDate)) {
      drawLabelValue(doc, "Planeada", formatDate(visit.plannedDate), rightX, rightY, colWidth);
      rightY += 40;
    }

    if (canShow(isAdmin, setting.showStartEnd)) {
      drawLabelValue(doc, "Início", formatDate(visit.startAt), rightX, rightY, colWidth);
      rightY += 32;
      drawLabelValue(doc, "Fim", formatDate(visit.endAt), rightX, rightY, colWidth);
      rightY += 32;
    }

    doc.y = Math.max(leftY, rightY) + 10;

    // ======================================================
    // PARÂMETROS DA ÁGUA
    // ======================================================

    if (canShow(isAdmin, setting.showWaterParameters)) {
      ensureSpace(doc, 120);
      drawSectionTitle(doc, "Parâmetros da água", 40, doc.y, contentWidth);
      doc.y += 26;

      const paramsY = doc.y;
      const paramWidth = 160;

      drawBox(doc, 40, paramsY, paramWidth, 55);
      drawBox(doc, 220, paramsY, paramWidth, 55);
      drawBox(doc, 400, paramsY, 155, 55);

      doc.font("Helvetica-Bold").fontSize(10).text("pH", 52, paramsY + 10);
      doc.font("Helvetica").text(safeValue(visit.ph), 52, paramsY + 27);

      doc.font("Helvetica-Bold").fontSize(10).text("Cloro", 232, paramsY + 10);
      doc.font("Helvetica").text(safeValue(visit.chlorine), 232, paramsY + 27);

      doc.font("Helvetica-Bold").fontSize(10).text("Alcalinidade", 412, paramsY + 10);
      doc.font("Helvetica").text(safeValue(visit.alkalinity), 412, paramsY + 27);

      doc.y = paramsY + 70;
    }

    // ======================================================
    // CHECKLIST
    // ======================================================

    if (canShow(isAdmin, setting.showChecklist)) {
      ensureSpace(doc, 180);
      drawSectionTitle(doc, "Checklist de trabalhos", 40, doc.y, contentWidth);
      doc.y += 26;

      const checklistItems = [
        ["Limpeza geral", yesNo(visit.cleaned)],
        ["Escovagem", yesNo(visit.brushed)],
        ["Aspiração", yesNo(visit.vacuumed)],
        ["Cestos limpos", yesNo(visit.basketCleaned)],
        ["Linha de água limpa", yesNo(visit.waterlineClean)],
        ["Retrolavagem", yesNo(visit.backwashDone)],
      ];

      checklistItems.forEach((item, index) => {
        const y = doc.y + index * 24;
        drawBox(doc, 40, y, 250, 18);
        drawBox(doc, 305, y, 250, 18);

        doc.font("Helvetica-Bold").fontSize(10).text(item[0], 48, y + 4, { width: 220 });
        doc.font("Helvetica").fontSize(10).text(item[1], 313, y + 4, { width: 220 });
      });

      doc.y += checklistItems.length * 24 + 6;
    }

    // ======================================================
    // QUÍMICOS
    // ======================================================

    if (canShow(isAdmin, setting.showChemicals)) {
      ensureSpace(doc, 100);
      drawSectionTitle(doc, "Químicos aplicados", 40, doc.y, contentWidth);
      doc.y += 26;

      if (!visit.chemicals || visit.chemicals.length === 0) {
        doc.font("Helvetica").fontSize(10).text("Nenhum químico registado.");
        doc.moveDown(0.5);
      } else {
        visit.chemicals.forEach((chem, index) => {
          drawBox(doc, 40, doc.y, 515, 22);
          doc.font("Helvetica").fontSize(10).text(
            `${index + 1}. ${chem.name} - ${chem.quantity}`,
            50,
            doc.y + 6
          );
          doc.y += 28;
        });
      }
    }

    // ======================================================
    // EQUIPAMENTO
    // ======================================================

    if (canShow(isAdmin, setting.showEquipment)) {
      ensureSpace(doc, 180);
      drawSectionTitle(doc, "Equipamento", 40, doc.y, contentWidth);
      doc.y += 26;

      const equipmentFields = [
        ["Bomba", visit.pool?.equipment?.pumpType || "-"],
        ["Potência bomba", visit.pool?.equipment?.pumpPower || "-"],
        ["Filtro", visit.pool?.equipment?.filterType || "-"],
        ["Média filtrante", visit.pool?.equipment?.filterMedia || "-"],
        [
          "Sistema de sal",
          visit.pool?.equipment?.saltSystem === null ||
          visit.pool?.equipment?.saltSystem === undefined
            ? "-"
            : yesNo(visit.pool.equipment.saltSystem),
        ],
        ["Qtd. sal", visit.pool?.equipment?.saltQuantity ?? "-"],
        ["Nº luzes", visit.pool?.equipment?.lightsCount ?? "-"],
        ["Luzes avariadas", visit.pool?.equipment?.lightsBroken ?? "-"],
        ["Tipo de luz", visit.pool?.equipment?.lightsType || "-"],
      ];

      equipmentFields.forEach((item) => {
        drawLabelValue(doc, item[0], item[1], 40, doc.y, 515);
        doc.y += 30;
      });
    }

    // ======================================================
    // CASA TÉCNICA
    // ======================================================

    if (canShow(isAdmin, setting.showTechnicalRoom)) {
      ensureSpace(doc, 160);
      drawSectionTitle(doc, "Casa técnica", 40, doc.y, contentWidth);
      doc.y += 26;

      const techFields = [
        ["Estado", visit.pool?.technicalRoom?.condition || "-"],
        ["Localização", visit.pool?.technicalRoom?.locationNote || "-"],
        ["Ventilação", visit.pool?.technicalRoom?.ventilation || "-"],
        ["Elétrica", visit.pool?.technicalRoom?.electrical || "-"],
        ["Notas", visit.pool?.technicalRoom?.notes || "-"],
      ];

      techFields.forEach((item) => {
        drawLabelValue(doc, item[0], item[1], 40, doc.y, 515);
        doc.y += item[0] === "Notas" ? 40 : 30;
      });
    }

    // ======================================================
    // OBSERVAÇÕES
    // ======================================================

    if (canShow(isAdmin, setting.showNotes)) {
      ensureSpace(doc, 120);
      drawSectionTitle(doc, "Observações", 40, doc.y, contentWidth);
      doc.y += 26;

      drawBox(doc, 40, doc.y, 515, 70);
      doc.font("Helvetica").fontSize(10).text(
        visit.notes || "Sem observações.",
        50,
        doc.y + 10,
        {
          width: 495,
        }
      );
      doc.y += 82;
    }

    // ======================================================
    // NOTAS INTERNAS
    // ======================================================

    if (isAdmin) {
      ensureSpace(doc, 120);
      drawSectionTitle(doc, "Notas internas", 40, doc.y, contentWidth);
      doc.y += 26;

      drawBox(doc, 40, doc.y, 515, 70);
      doc.font("Helvetica").fontSize(10).text(
        visit.internalNotes || "Sem notas internas.",
        50,
        doc.y + 10,
        {
          width: 495,
        }
      );
      doc.y += 82;
    }

    // ======================================================
    // FOTOS
    // ======================================================

    if (canShow(isAdmin, setting.showPhotos)) {
      ensureSpace(doc, 100);
      drawSectionTitle(doc, "Fotos registadas", 40, doc.y, contentWidth);
      doc.y += 26;

      if (!visit.photos || visit.photos.length === 0) {
        doc.font("Helvetica").fontSize(10).text("Nenhuma foto registada.");
      } else {
        visit.photos.forEach((photo, index) => {
          drawBox(doc, 40, doc.y, 515, 22);
          doc.font("Helvetica").fontSize(10).text(
            `${index + 1}. ${photo.url}`,
            50,
            doc.y + 6,
            { width: 495 }
          );
          doc.y += 28;
        });
      }
    }

    // ======================================================
    // FOOTER EM TODAS AS PÁGINAS
    // ======================================================

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      addPageFooter(doc);
    }

    doc.end();
  } catch (err) {
    console.error("generateVisitReport error:", err);
    return res.status(500).send("Erro ao gerar relatório");
  }
}

module.exports = {
  generateVisitReport,
};