const express = require("express");
const router = express.Router();
const TechnicianWorkdayBusiness = require("../business/technician/TechnicianWorkdayBusiness");
const auth = require("../middlewares/authMiddleware");
const { roleMatches } = require("../utils/roles");

router.use(auth());

function roleOf(req) {
  return String(req.user?.role || "").trim().toUpperCase();
}

function scopedUserId(req) {
  return Number(req.user?.id || req.user?.technicianId || 0);
}

function ensureTechOrAdmin(req, res) {
  const role = roleOf(req);
  if (roleMatches(role, "TECHNICIAN") || roleMatches(role, "ADMIN")) return true;
  res.status(403).json({ ok: false, error: "Sem permissão" });
  return false;
}

function resolveWorkdayUserId(req, targetUserId) {
  const role = roleOf(req);
  const requested = Number(targetUserId || 0);

  if (roleMatches(role, "ADMIN")) {
    return { ok: requested > 0, userId: requested, status: 422, error: "userId obrigatório" };
  }

  if (roleMatches(role, "TECHNICIAN")) {
    const ownId = scopedUserId(req);
    if (!ownId) return { ok: false, status: 403, error: "Sessão técnica sem identificador" };
    if (requested > 0 && requested !== ownId) {
      return { ok: false, status: 403, error: "Acesso apenas à própria jornada" };
    }
    return { ok: true, userId: ownId };
  }

  return { ok: false, status: 403, error: "Sem permissão" };
}

function sendBusinessResult(res, result, successStatus = 200) {
  if (!result || typeof result !== "object") {
    return res.status(500).json({ ok: false, code: "INVALID_BUSINESS_RESULT", error: "Resposta inválida da camada de negócio" });
  }

  if (result.ok === false) {
    const status = Number(result.status || 422);
    return res.status(status).json(result);
  }

  const status = Number(result.status || successStatus);
  return res.status(status).json(result);
}

function toHttpError(err) {
  if (err?.statusCode || err?.status) {
    return {
      status: Number(err.statusCode || err.status),
      code: err.code || "BUSINESS_ERROR",
      error: err.message || "Erro de negócio",
      details: err.details,
    };
  }

  if (err?.code === "P2003") {
    return {
      status: 422,
      code: "INVALID_REFERENCE",
      error: "Referência inválida para operação de jornada",
      details: err?.meta || null,
    };
  }

  if (err?.code === "P2002") {
    return {
      status: 409,
      code: "CONFLICT",
      error: "Conflito de integridade na operação de jornada",
      details: err?.meta || null,
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    error: "Erro interno inesperado na operação de jornada",
  };
}

router.post("/start", async (req, res) => {
  try {
    if (!ensureTechOrAdmin(req, res)) return;
    const resolved = resolveWorkdayUserId(req, req.body?.userId);
    if (!resolved.ok) return res.status(resolved.status).json({ ok: false, error: resolved.error });
    const result = await TechnicianWorkdayBusiness.startWorkday({ userId: resolved.userId });
    return sendBusinessResult(res, result, 201);
  } catch (err) {
    console.error("WORKDAY_START_ERROR", err);
    const mapped = toHttpError(err);
    return res.status(mapped.status).json({ ok: false, code: mapped.code, error: mapped.error, details: mapped.details || undefined });
  }
});

router.post("/end", async (req, res) => {
  try {
    if (!ensureTechOrAdmin(req, res)) return;
    const resolved = resolveWorkdayUserId(req, req.body?.userId);
    if (!resolved.ok) return res.status(resolved.status).json({ ok: false, error: resolved.error });
    const result = await TechnicianWorkdayBusiness.endWorkday({ userId: resolved.userId });
    return sendBusinessResult(res, result, 200);
  } catch (err) {
    console.error("WORKDAY_END_ERROR", err);
    const mapped = toHttpError(err);
    return res.status(mapped.status).json({ ok: false, code: mapped.code, error: mapped.error, details: mapped.details || undefined });
  }
});

router.get("/status/:userId", async (req, res) => {
  try {
    if (!ensureTechOrAdmin(req, res)) return;
    const resolved = resolveWorkdayUserId(req, req.params?.userId);
    if (!resolved.ok) return res.status(resolved.status).json({ ok: false, error: resolved.error });
    const result = await TechnicianWorkdayBusiness.getWorkdayStatus({ userId: resolved.userId });
    return sendBusinessResult(res, result, 200);
  } catch (err) {
    console.error("WORKDAY_STATUS_ERROR", err);
    const mapped = toHttpError(err);
    return res.status(mapped.status).json({ ok: false, code: mapped.code, error: mapped.error, details: mapped.details || undefined });
  }
});

module.exports = router;