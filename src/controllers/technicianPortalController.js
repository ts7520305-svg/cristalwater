// ==========================================
// TECHNICIAN PORTAL CONTROLLER
// ==========================================

const TechnicianPortalBusiness = require("../business/technician/TechnicianPortalBusiness");

// ==========================================
// OBTER PLANO DO DIA + VISITAS EXTRA
// ==========================================

async function getTodayRound(req, res) {
  try {
    const result = await TechnicianPortalBusiness.getTodayRound({
      technicianId: req.params.technicianId ?? req.params.id,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        message: result.message,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("getTodayRound error:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro ao obter ronda do dia",
    });
  }
}

// ==========================================
// REGISTAR VISITA NORMAL
// ==========================================

async function registerVisit(req, res) {
  try {
    const result = await TechnicianPortalBusiness.registerVisit(req.body || {});

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        message: result.message,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("registerVisit error:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro ao registar visita",
    });
  }
}

// ==========================================
// CONCLUIR / ATUALIZAR VISITA EXTRA
// ==========================================

async function updateExtraVisitStatus(req, res) {
  try {
    const result = await TechnicianPortalBusiness.updateExtraVisitStatus({
      extraVisitId: req.params.id,
      technicianId: req.body.technicianId,
      status: req.body.status,
      notes: req.body.notes,
      internalNote: req.body.internalNote,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        message: result.message,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("updateExtraVisitStatus error:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro ao atualizar visita extra",
    });
  }
}

module.exports = {
  getTodayRound,
  registerVisit,
  updateExtraVisitStatus,
};
