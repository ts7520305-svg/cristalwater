// ==========================================
// TECHNICIAN PORTAL CONTROLLER
// ==========================================

const { prisma } = require("../prismaClient");

// ==========================================
// HELPERS
// ==========================================

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ==========================================
// OBTER PLANO DO DIA + VISITAS EXTRA
// ==========================================

async function getTodayRound(req, res) {
  try {
    const technicianId = toNumber(req.params.technicianId ?? req.params.id);

    if (!technicianId) {
      return res.status(400).json({
        ok: false,
        message: "ID do técnico inválido",
      });
    }

    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      return res.status(404).json({
        ok: false,
        message: "Técnico não encontrado",
      });
    }

    // ======================================================
    // RONDAS NORMAIS
    // ======================================================
    // Neste momento mantemos uma resposta segura e compatível.
    // Se mais tarde tiveres o módulo completo de rondas ligado
    // à tabela Visit ou a outro modelo, substituímos aqui.
    const rounds = await prisma.serviceVisit.findMany({
      where: {
        technicianId,
        OR: [
          { plannedDate: { gte: todayStart, lte: todayEnd } },
          { date: { gte: todayStart, lte: todayEnd } },
          { startAt: { gte: todayStart, lte: todayEnd } },
          { endAt: { gte: todayStart, lte: todayEnd } },
        ],
        status: {
          notIn: ["CANCELLED", "CANCELED", "CANCELADO", "CANCELADA"],
        },
      },
      include: {
        pool: { include: { client: true } },
        technician: true,
        round: true,
      },
      orderBy: [{ plannedDate: "asc" }, { date: "asc" }, { id: "asc" }],
    });

    // ======================================================
    // VISITAS EXTRA DO DIA
    // ======================================================
    const extraVisits = await prisma.extraVisit.findMany({
      where: {
        scheduledAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        OR: [
          { technicianId },
          { technicianId: null },
        ],
        status: {
          in: ["PLANNED", "IN_PROGRESS"],
        },
      },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
        technician: true,
        rule: true,
      },
      orderBy: { scheduledAt: "asc" },
    });

    return res.json({
      ok: true,
      date: todayStart,
      technicianFound: true,
      rounds,
      extraVisits,
    });
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
    const technicianId = toNumber(req.body.technicianId);
    const poolId = toNumber(req.body.poolId);
    const roundId =
      req.body.roundId !== undefined &&
      req.body.roundId !== null &&
      req.body.roundId !== ""
        ? toNumber(req.body.roundId)
        : null;

    const status = req.body.status ? String(req.body.status).toUpperCase() : null;
    const reason = req.body.reason || null;
    const notes = req.body.notes || null;

    if (!technicianId || !poolId || !status) {
      return res.status(400).json({
        ok: false,
        message: "Dados obrigatórios em falta",
      });
    }

    if (!["DONE", "NOT_DONE"].includes(status)) {
      return res.status(400).json({
        ok: false,
        message: "Status inválido",
      });
    }

    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
    });

    if (!technician) {
      return res.status(404).json({
        ok: false,
        message: "Técnico não encontrado",
      });
    }

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        client: true,
      },
    });

    if (!pool) {
      return res.status(404).json({
        ok: false,
        message: "Piscina não encontrada",
      });
    }

    // ======================================================
    // COMO O SCHEMA ATUAL NÃO TEM AINDA O MÓDULO COMPLETO
    // DE SERVICE VISIT LIGADO ÀS RONDAS NORMAIS,
    // FAZEMOS UM REGISTO INTERNO NA TABELA Visit.
    // ======================================================

    const visitRecord = await prisma.serviceVisit.create({
      data: {
        clientId: pool.clientId,
        poolId: pool.id,
        technicianId,
        technicianName: technician.name,
        plannedDate: new Date(),
        date: new Date(),
        startAt: new Date(),
        endAt: status === "DONE" ? new Date() : null,
        status,
        reason,
        notes,
      },
    });

    return res.json({
      ok: true,
      message: status === "DONE"
        ? "Visita registada como concluída"
        : "Visita registada como não feita",
      visit: visitRecord,
      pool: {
        id: pool.id,
        name: pool.name,
        clientName: pool.client?.name || null,
      },
      roundId,
    });
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
    const extraVisitId = Number(req.params.id);
    const technicianId =
      req.body.technicianId !== undefined ? toNumber(req.body.technicianId) : null;
    const status = req.body.status ? String(req.body.status).toUpperCase() : null;
    const notes = req.body.notes;
    const internalNote = req.body.internalNote;

    if (!extraVisitId || Number.isNaN(extraVisitId)) {
      return res.status(400).json({
        ok: false,
        message: "ID da visita extra inválido",
      });
    }

    if (!status) {
      return res.status(400).json({
        ok: false,
        message: "Status é obrigatório",
      });
    }

    if (!["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED", "SKIPPED"].includes(status)) {
      return res.status(400).json({
        ok: false,
        message: "Status inválido",
      });
    }

    const existing = await prisma.extraVisit.findUnique({
      where: { id: extraVisitId },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
        technician: true,
        rule: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        ok: false,
        message: "Visita extra não encontrada",
      });
    }

    if (technicianId !== null) {
      const technician = await prisma.technician.findUnique({
        where: { id: technicianId },
      });

      if (!technician) {
        return res.status(404).json({
          ok: false,
          message: "Técnico não encontrado",
        });
      }
    }

    const updated = await prisma.extraVisit.update({
      where: { id: extraVisitId },
      data: {
        technicianId: technicianId !== null ? technicianId : existing.technicianId,
        status,
        notes: notes !== undefined ? notes : existing.notes,
        internalNote: internalNote !== undefined ? internalNote : existing.internalNote,
      },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
        technician: true,
        rule: true,
      },
    });

    return res.json({
      ok: true,
      message: "Visita extra atualizada com sucesso",
      extraVisit: updated,
    });
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
