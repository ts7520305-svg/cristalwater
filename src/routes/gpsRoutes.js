const express = require("express");
const router = express.Router();
const TechnicianGpsBusiness = require("../business/technician/TechnicianGpsBusiness");

const logger = {
  info: (msg, ctx = null) => console.log(`[${new Date().toISOString()}] [INFO] [GPS] ${msg}`, ctx || ""),
  warn: (msg, ctx = null) => console.warn(`[${new Date().toISOString()}] [WARN] [GPS] ${msg}`, ctx || ""),
  error: (msg, err = null) => console.error(`[${new Date().toISOString()}] [ERROR] [GPS] ${msg}`, err?.stack || err || ""),
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.post(["/update", "/ping"], async (req, res) => {
  try {
    const result = await TechnicianGpsBusiness.processGpsUpdate(req.body || {});
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    logger.error("Erro GPS update/ping", err);
    return res.status(200).json({
      ok: false,
      success: false,
      degradedMode: true,
      message: "Modo degradado ativo. Telemetria retida no dispositivo para retry.",
    });
  }
});

router.post("/validate-geofence", async (req, res) => {
  try {
    const result = await TechnicianGpsBusiness.validateGeofence({
      visitId: toNumber(req.body.visitId),
      currentLatitude: toNumber(req.body.currentLatitude ?? req.body.latitude),
      currentLongitude: toNumber(req.body.currentLongitude ?? req.body.longitude),
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    logger.error("Falha no motor de Geofencing", err);
    return res.status(200).json({
      success: true,
      inside: true,
      degradedMode: true,
      message: "Serviço de validação espacial indisponível. Operação autorizada em modo degradado de emergência.",
    });
  }
});

router.get("/live", async (req, res) => {
  try {
    const rows = await TechnicianGpsBusiness.getLiveLocations();
    return res.json(rows);
  } catch (err) {
    logger.warn("Falha ao carregar posicoes live enriquecidas", err.message);
    return res.json([]);
  }
});

router.get("/live-legacy", async (req, res) => {
  try {
    const data = await TechnicianGpsBusiness.getLiveLegacyLocations();
    return res.json(data);
  } catch (err) {
    logger.warn("Falha ao carregar posições live", err.message);
    return res.json([]);
  }
});

router.get("/history/:id", async (req, res) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) return res.json([]);
    const requestedLimit = toNumber(req.query?.limit);
    const data = await TechnicianGpsBusiness.getHistoryById(id, {
      limit: requestedLimit,
    });
    return res.json(data);
  } catch (err) {
    logger.warn("Falha ao carregar histórico GPS", err.message);
    return res.json([]);
  }
});

module.exports = router;
