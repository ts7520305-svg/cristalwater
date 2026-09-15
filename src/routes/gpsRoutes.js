const express = require("express");
const router = express.Router();
const TechnicianGpsBusiness = require("../business/technician/TechnicianGpsBusiness");
const auth = require("../middlewares/authMiddleware");
const { roleMatches } = require("../utils/roles");

router.use(auth());

const logger = {
  info: (msg, ctx = null) => console.log(`[${new Date().toISOString()}] [INFO] [GPS] ${msg}`, ctx || ""),
  warn: (msg, ctx = null) => console.warn(`[${new Date().toISOString()}] [WARN] [GPS] ${msg}`, ctx || ""),
  error: (msg, err = null) => console.error(`[${new Date().toISOString()}] [ERROR] [GPS] ${msg}`, err?.stack || err || ""),
};

function toNumber(value) {
  if(value==null||typeof value==='boolean'||String(value).trim()==='')return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roleOf(req) {
  return String(req.user?.role || "").trim().toUpperCase();
}

function ownUserId(req) {
  return toNumber(req.user?.technicianId ?? req.user?.id);
}

function isAdmin(req) {
  return roleMatches(roleOf(req), "ADMIN");
}

function isTechnician(req) {
  return roleMatches(roleOf(req), "TECHNICIAN") && !isAdmin(req);
}

router.post(["/update", "/ping"], async (req, res) => {
  try {
    const payload = { ...(req.body || {}) };

    if (!isTechnician(req) && !isAdmin(req)) {
      return res.status(403).json({ ok: false, success: false, message: "Sem permissão" });
    }

    const result = await TechnicianGpsBusiness.processGpsUpdate(payload, req.user);
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    logger.error("Erro GPS update/ping", err);
    return res.status(503).json({
      ok: false,
      success: false,
      degradedMode: true,
      message: "Não foi possível confirmar o registo GPS. Tente novamente.",
    });
  }
});

router.post("/validate-geofence", async (req, res) => {
  try {
    if (!isTechnician(req) && !isAdmin(req)) {
      return res.status(403).json({ ok: false, success: false, message: "Sem permissão" });
    }
    const result = await TechnicianGpsBusiness.validateGeofence({
      actor: req.user,
      visitId: toNumber(req.body.visitId),
      currentLatitude: toNumber(req.body.currentLatitude ?? req.body.latitude),
      currentLongitude: toNumber(req.body.currentLongitude ?? req.body.longitude),
    });
    return res.status(result.statusCode).json(result.body);
  } catch (err) {
    logger.error("Falha no motor de Geofencing", err);
    return res.status(503).json({
      success: false,
      inside: null,
      degradedMode: true,
      requiresManualConfirmation: true,
      message: "Validação GPS indisponível. Confirme o local no modo de campo e tente novamente.",
    });
  }
});

router.get("/live", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ ok: false, error: "Sem permissão" });
    }
    const rows = await TechnicianGpsBusiness.getLiveLocations();
    return res.json(rows);
  } catch (err) {
    logger.warn("Falha ao carregar posicoes live enriquecidas", err.message);
    return res.json([]);
  }
});

router.get("/live-legacy", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ ok: false, error: "Sem permissão" });
    }
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

    if (isTechnician(req) && id !== ownUserId(req)) {
      return res.status(403).json({ ok: false, error: "Acesso apenas ao próprio histórico GPS" });
    }

    if (!isTechnician(req) && !isAdmin(req)) {
      return res.status(403).json({ ok: false, error: "Sem permissão" });
    }

    const requestedLimit = toNumber(req.query?.limit);
    const data = await TechnicianGpsBusiness.getHistoryById(id, {
      limit: requestedLimit,
      actor:req.user,
      scope:req.query?.scope,
    });
    return res.json(data);
  } catch (err) {
    logger.warn("Falha ao carregar histórico GPS", err.message);
    return res.json([]);
  }
});

module.exports = router;
