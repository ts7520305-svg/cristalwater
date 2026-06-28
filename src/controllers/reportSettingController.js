const { prisma } = require("../prismaClient");

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "sim") return true;
    if (v === "false" || v === "0" || v === "nao" || v === "não") return false;
  }
  return fallback;
}

async function getClientReportSetting(req, res) {
  try {
    const clientId = toInt(req.params.clientId);

    if (!clientId) {
      return res.status(400).json({ error: "clientId inválido" });
    }

    let setting = await prisma.clientReportSetting.findUnique({
      where: { clientId },
    });

    if (!setting) {
      setting = await prisma.clientReportSetting.create({
        data: { clientId },
      });
    }

    return res.json({
      ok: true,
      setting,
    });
  } catch (err) {
    console.error("getClientReportSetting error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao obter configuração do relatório",
    });
  }
}

async function updateClientReportSetting(req, res) {
  try {
    const clientId = toInt(req.params.clientId);

    if (!clientId) {
      return res.status(400).json({ error: "clientId inválido" });
    }

    const data = {
      showClientName: toBool(req.body.showClientName, true),
      showPoolName: toBool(req.body.showPoolName, true),
      showZone: toBool(req.body.showZone, true),
      showAddress: toBool(req.body.showAddress, false),
      showTechnicianName: toBool(req.body.showTechnicianName, false),
      showStatus: toBool(req.body.showStatus, true),
      showPlannedDate: toBool(req.body.showPlannedDate, true),
      showStartEnd: toBool(req.body.showStartEnd, false),
      showWaterParameters: toBool(req.body.showWaterParameters, true),
      showChecklist: toBool(req.body.showChecklist, true),
      showChemicals: toBool(req.body.showChemicals, false),
      showEquipment: toBool(req.body.showEquipment, false),
      showTechnicalRoom: toBool(req.body.showTechnicalRoom, false),
      showNotes: toBool(req.body.showNotes, true),
      showPhotos: toBool(req.body.showPhotos, false),
    };

    const existing = await prisma.clientReportSetting.findUnique({
      where: { clientId },
    });

    let setting;

    if (existing) {
      setting = await prisma.clientReportSetting.update({
        where: { clientId },
        data,
      });
    } else {
      setting = await prisma.clientReportSetting.create({
        data: {
          clientId,
          ...data,
        },
      });
    }

    return res.json({
      ok: true,
      setting,
    });
  } catch (err) {
    console.error("updateClientReportSetting error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao atualizar configuração do relatório",
    });
  }
}

module.exports = {
  getClientReportSetting,
  updateClientReportSetting,
};