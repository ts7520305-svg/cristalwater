const prismaClient = require("../../prismaClient");
const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getTodayRound({ technicianId }) {
  const techId = toNumber(technicianId);

  if (!techId) {
    return {
      ok: false,
      status: 400,
      message: "ID do técnico inválido",
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const technician = await prisma.technician.findUnique({ where: { id: techId } });

  if (!technician) {
    return {
      ok: false,
      status: 404,
      message: "Técnico não encontrado",
    };
  }

  const [rounds, extraVisits] = await Promise.all([
    prisma.serviceVisit.findMany({
      where: {
        technicianId: techId,
        OR: [
          { plannedDate: { gte: todayStart, lte: todayEnd } },
          { date: { gte: todayStart, lte: todayEnd } },
          { startAt: { gte: todayStart, lte: todayEnd } },
          { endAt: { gte: todayStart, lte: todayEnd } },
        ],
        status: { notIn: ["CANCELLED", "CANCELED", "CANCELADO", "CANCELADA"] },
      },
      include: {
        pool: { include: { client: true } },
        technician: true,
        round: true,
      },
      orderBy: [{ plannedDate: "asc" }, { date: "asc" }, { id: "asc" }],
    }),
    prisma.extraVisit.findMany({
      where: {
        scheduledAt: { gte: todayStart, lte: todayEnd },
        OR: [{ technicianId: techId }, { technicianId: null }],
        status: { in: ["PLANNED", "IN_PROGRESS"] },
      },
      include: {
        pool: { include: { client: true } },
        technician: true,
        rule: true,
      },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  return {
    ok: true,
    date: todayStart,
    technicianFound: true,
    rounds,
    extraVisits,
  };
}

async function registerVisit(payload = {}) {
  const technicianId = toNumber(payload.technicianId);
  const poolId = toNumber(payload.poolId);
  const roundId = payload.roundId !== undefined && payload.roundId !== null && payload.roundId !== ""
    ? toNumber(payload.roundId)
    : null;

  const status = payload.status ? String(payload.status).toUpperCase() : null;
  const reason = payload.reason || null;
  const notes = payload.notes || null;

  if (!technicianId || !poolId || !status) {
    return { ok: false, status: 400, message: "Dados obrigatórios em falta" };
  }

  if (!["DONE", "NOT_DONE"].includes(status)) {
    return { ok: false, status: 400, message: "Status inválido" };
  }

  const technician = await prisma.technician.findUnique({ where: { id: technicianId } });
  if (!technician) {
    return { ok: false, status: 404, message: "Técnico não encontrado" };
  }

  const pool = await prisma.pool.findUnique({ where: { id: poolId }, include: { client: true } });
  if (!pool) {
    return { ok: false, status: 404, message: "Piscina não encontrada" };
  }

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

  return {
    ok: true,
    message: status === "DONE" ? "Visita registada como concluída" : "Visita registada como não feita",
    visit: visitRecord,
    pool: {
      id: pool.id,
      name: pool.name,
      clientName: pool.client?.name || null,
    },
    roundId,
  };
}

async function updateExtraVisitStatus({ extraVisitId, technicianId, status, notes, internalNote }) {
  const id = toNumber(extraVisitId);
  const techId = technicianId !== undefined ? toNumber(technicianId) : null;
  const normalizedStatus = status ? String(status).toUpperCase() : null;

  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "ID da visita extra inválido" };
  }

  if (!normalizedStatus) {
    return { ok: false, status: 400, message: "Status é obrigatório" };
  }

  if (!["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED", "SKIPPED"].includes(normalizedStatus)) {
    return { ok: false, status: 400, message: "Status inválido" };
  }

  const existing = await prisma.extraVisit.findUnique({
    where: { id },
    include: {
      pool: { include: { client: true } },
      technician: true,
      rule: true,
    },
  });

  if (!existing) {
    return { ok: false, status: 404, message: "Visita extra não encontrada" };
  }

  if (techId !== null) {
    const technician = await prisma.technician.findUnique({ where: { id: techId } });
    if (!technician) {
      return { ok: false, status: 404, message: "Técnico não encontrado" };
    }
  }

  const updated = await prisma.extraVisit.update({
    where: { id },
    data: {
      technicianId: techId !== null ? techId : existing.technicianId,
      status: normalizedStatus,
      notes: notes !== undefined ? notes : existing.notes,
      internalNote: internalNote !== undefined ? internalNote : existing.internalNote,
    },
    include: {
      pool: { include: { client: true } },
      technician: true,
      rule: true,
    },
  });

  return {
    ok: true,
    message: "Visita extra atualizada com sucesso",
    extraVisit: updated,
  };
}

module.exports = {
  getTodayRound,
  registerVisit,
  updateExtraVisitStatus,
};
