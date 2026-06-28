const { prisma } = require("../prismaClient");

// ==========================================================
// HELPERS
// ==========================================================

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function toFloat(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ==========================================================
// GET VISITAS DO DIA
// ==========================================================

async function getTodayVisits(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const visits = await prisma.serviceVisit.findMany({
      where: {
        plannedDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        client: true,
        pool: true,
        chemicals: true,
        photos: true,
      },
      orderBy: [{ plannedDate: "asc" }, { id: "asc" }],
    });

    return res.json({
      ok: true,
      visits,
    });
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
    const visits = await prisma.serviceVisit.findMany({
      include: {
        client: true,
        pool: true,
        chemicals: true,
        photos: true,
      },
      orderBy: [{ plannedDate: "desc" }, { id: "desc" }],
    });

    return res.json({
      ok: true,
      visits,
    });
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
    const visitId = toInt(req.params.id);

    if (!visitId) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        client: true,
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
      return res.status(404).json({ error: "Visita não encontrada" });
    }

    return res.json({
      ok: true,
      visit,
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
    const clientId = toInt(req.body.clientId);
    const poolId = toInt(req.body.poolId);

    if (!clientId || !poolId) {
      return res.status(400).json({
        error: "clientId e poolId são obrigatórios",
      });
    }

    const plannedDate = req.body.plannedDate
      ? new Date(req.body.plannedDate)
      : new Date();

    const created = await prisma.serviceVisit.create({
      data: {
        clientId,
        poolId,
        technicianName: req.body.technicianName || null,
        plannedDate,
        status: "PLANNED",
        notes: req.body.notes || null,
        internalNotes: req.body.internalNotes || null,
      },
      include: {
        client: true,
        pool: true,
      },
    });

    return res.json({
      ok: true,
      visit: created,
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
    const visitId = toInt(req.params.id);

    if (!visitId) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      return res.status(404).json({ error: "Visita não encontrada" });
    }

    const updated = await prisma.serviceVisit.update({
      where: { id: visitId },
      data: {
        startAt: new Date(),
        status: "IN_PROGRESS",
      },
    });

    return res.json({
      ok: true,
      visit: updated,
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
    const visitId = toInt(req.params.id);

    if (!visitId) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      return res.status(404).json({ error: "Visita não encontrada" });
    }

    const updatedVisit = await prisma.serviceVisit.update({
      where: { id: visitId },
      data: {
        endAt: new Date(),
        status: "DONE",

        notes: req.body.notes || visit.notes,
        internalNotes: req.body.internalNotes || visit.internalNotes,

        ph: toFloat(req.body.ph),
        chlorine: toFloat(req.body.chlorine),
        alkalinity: toFloat(req.body.alkalinity),

        cleaned: Boolean(req.body.cleaned),
        brushed: Boolean(req.body.brushed),
        vacuumed: Boolean(req.body.vacuumed),
        basketCleaned: Boolean(req.body.basketCleaned),
        waterlineClean: Boolean(req.body.waterlineClean),
        backwashDone: Boolean(req.body.backwashDone),
      },
    });

    if (Array.isArray(req.body.chemicals)) {
      for (const chem of req.body.chemicals) {
        if (!chem?.name) continue;

        await prisma.chemicalUsage.create({
          data: {
            visitId,
            name: String(chem.name).trim(),
            quantity: toFloat(chem.quantity) || 0,
          },
        });
      }
    }

    if (Array.isArray(req.body.photos)) {
      for (const photo of req.body.photos) {
        if (!photo?.url) continue;

        await prisma.visitPhoto.create({
          data: {
            visitId,
            url: String(photo.url).trim(),
          },
        });
      }
    }

    const finalVisit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        client: true,
        pool: true,
        chemicals: true,
        photos: true,
      },
    });

    return res.json({
      ok: true,
      visit: finalVisit,
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
    const visitId = toInt(req.params.id);

    if (!visitId) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      return res.status(404).json({ error: "Visita não encontrada" });
    }

    const updated = await prisma.serviceVisit.update({
      where: { id: visitId },
      data: {
        status: "NOT_DONE",
        notes: req.body.notes || visit.notes,
        internalNotes: req.body.internalNotes || visit.internalNotes,
        endAt: new Date(),
      },
    });

    return res.json({
      ok: true,
      visit: updated,
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
    const visitId = toInt(req.body.visitId);
    const message = String(req.body.message || "").trim();

    if (!visitId) {
      return res.status(400).json({ error: "visitId inválido" });
    }

    if (!message) {
      return res.status(400).json({ error: "Mensagem obrigatória" });
    }

    const visit = await prisma.serviceVisit.findUnique({
      where: { id: visitId },
      include: {
        client: true,
        pool: true,
      },
    });

    if (!visit) {
      return res.status(404).json({ error: "Visita não encontrada" });
    }

    const title = `Alerta técnico - ${visit.pool?.name || "Instalação"}`;

    return res.json({
      ok: true,
      alert: {
        visitId,
        title,
        message,
        clientName: visit.client?.name || null,
        poolName: visit.pool?.name || null,
        createdAt: new Date(),
      },
    });
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