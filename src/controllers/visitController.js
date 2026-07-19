const TechnicianVisitBusiness = require("../business/technician/TechnicianVisitBusiness");

// ==========================================================
// GET VISITAS DO DIA
// ==========================================================

async function getTodayVisits(req, res) {
  try {
    const result = await TechnicianVisitBusiness.getTodayVisits();
    return res.json(result);
  } catch (err) {
    console.error("getTodayVisits error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao obter visitas do dia",
    });
  }
}

// ==========================================================
// LISTAR TODAS AS VISITAS
// ==========================================================

async function listVisits(req, res) {
  try {
    const result = await TechnicianVisitBusiness.listVisits();
    return res.json(result);
  } catch (err) {
    console.error("listVisits error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao listar visitas",
    });
  }
}

// ==========================================================
// OBTER VISITA POR ID
// ==========================================================

async function getVisitById(req, res) {
  try {
    const result = await TechnicianVisitBusiness.getVisitById(req.params.id);

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      ok: true,
      visit: result.visit,
      context: result.context,
    });
  } catch (err) {
    console.error("getVisitById error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao obter visita",
    });
  }
}

// ==========================================================
// CRIAR VISITA
// ==========================================================

async function createVisit(req, res) {
  try {
    const result = await TechnicianVisitBusiness.createVisit(req.body || {});

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      ok: true,
      visit: result.visit,
    });
  } catch (err) {
    console.error("createVisit error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao criar visita",
    });
  }
}

// ==========================================================
// INICIAR VISITA
// ==========================================================

async function startVisit(req, res) {
  try {
    const result = await TechnicianVisitBusiness.startVisit(req.params.id);

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      ok: true,
      visit: result.visit,
    });
  } catch (err) {
    console.error("startVisit error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao iniciar visita",
    });
  }
}

// ==========================================================
// CONCLUIR VISITA COMPLETA
// ==========================================================

async function completeVisit(req, res) {
  try {
    const result = await TechnicianVisitBusiness.completeVisit(req.params.id, req.body || {});

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      ok: true,
      visit: result.visit,
      repair: result.repair || null,
    });
  } catch (err) {
    console.error("completeVisit error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao concluir visita",
    });
  }
}

// ==========================================================
// MARCAR COMO NÃO FEITA
// ==========================================================

async function markVisitNotDone(req, res) {
  try {
    const result = await TechnicianVisitBusiness.markVisitNotDone({
      visitId: req.params.id,
      notes: req.body.notes,
      internalNotes: req.body.internalNotes,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({
      ok: true,
      visit: result.visit,
    });
  } catch (err) {
    console.error("markVisitNotDone error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao marcar visita como não feita",
    });
  }
}

// ==========================================================
// ALERTA TÉCNICO
// ==========================================================

async function createAlert(req, res) {
  try {
    const result = await TechnicianVisitBusiness.createAlert({
      visitId: req.body.visitId,
      message: req.body.message,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json(result);
  } catch (err) {
    console.error("createAlert error:", err);
    return res.status(500).json({
      error: err.message || "Erro ao criar alerta",
    });
  }
}

// ==========================================================
// EXPORTS
// ==========================================================

module.exports = {
  getTodayVisits,
  listVisits,
  getVisitById,
  createVisit,
  startVisit,
  completeVisit,
  markVisitNotDone,
  createAlert,
};