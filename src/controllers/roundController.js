const { prisma } = require("../prismaClient");
const { getPoolRoundReadiness } = require("../utils/poolReadiness");

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function dateForWeekday(weekStart, dayOfWeek, order = 0) {
  const startDay = weekStart.getDay();
  const diff = (Number(dayOfWeek) - startDay + 7) % 7;
  const d = addDays(weekStart, diff);
  d.setHours(8, 0, 0, 0);
  d.setMinutes(d.getMinutes() + Math.max(0, Number(order || 0) - 1) * 30);
  return d;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeAssignmentMode(value) {
  const mode = String(value || "").trim().toUpperCase();
  return [
    "NORMAL",
    "SUPPORT",
    "SUBSTITUTION",
    "OTHER_DAY",
    "RESCHEDULE",
    "UNASSIGNED",
  ].includes(mode) ? mode : "NORMAL";
}

function assignmentModeLabel(mode) {
  return {
    NORMAL: "Operacao normal",
    SUPPORT: "Apoio a outro tecnico",
    SUBSTITUTION: "Substituicao de tecnico",
    OTHER_DAY: "Ronda feita noutro dia",
    RESCHEDULE: "Reagendamento",
    UNASSIGNED: "Visita sem tecnico atribuido",
  }[mode] || "Operacao normal";
}

function appendPlannerNote(currentNotes, note) {
  const clean = String(note || "").trim();
  if (!clean) return currentNotes || null;
  const previous = String(currentNotes || "").trim();
  return [previous, `[Planeador] ${clean}`].filter(Boolean).join("\n");
}

async function visitAlreadyExists(poolId, plannedDate) {
  if (!poolId || !plannedDate) return false;
  const existing = await prisma.serviceVisit.findFirst({
    where: {
      poolId,
      plannedDate: {
        gte: startOfDay(plannedDate),
        lt: endOfDay(plannedDate),
      },
      status: {
        notIn: ["CANCELLED", "SKIPPED"],
      },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function createVisitFromRound(round, roundPool, plannedDate) {
  const pool = roundPool.pool;
  const technician = round.technicians?.[0]?.technician || null;

  return prisma.serviceVisit.create({
    data: {
      clientId: pool?.clientId || null,
      poolId: pool?.id || null,
      roundId: round.id,
      technicianId: technician?.id || null,
      technicianName: technician?.name || null,
      plannedDate,
      status: "PLANNED",
      reason: "AUTO_ROUND",
      notes: `Gerado automaticamente pela ronda ${round.name}`,
    },
  });
}

async function generateFromRoundTemplates({ weekStart, force = false }) {
  const weekEnd = addDays(weekStart, 7);

  if (force) {
    await prisma.serviceVisit.deleteMany({
      where: {
        roundId: { not: null },
        status: "PLANNED",
        plannedDate: { gte: weekStart, lt: weekEnd },
      },
    });
  }

  const rounds = await prisma.round.findMany({
    where: { active: true },
    include: {
      technicians: { include: { technician: true } },
      pools: {
        orderBy: { order: "asc" },
        include: { pool: { include: { client: true } } },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { name: "asc" }],
  });

  let created = 0;
  let skipped = 0;
  let blocked = 0;

  for (const round of rounds) {
    for (const roundPool of round.pools || []) {
      const plannedDate = dateForWeekday(weekStart, round.dayOfWeek, roundPool.order || 1);
      const readiness = await getPoolRoundReadiness(prisma, roundPool.poolId);
      if (!readiness.ok) {
        blocked += 1;
        continue;
      }
      if (await visitAlreadyExists(roundPool.poolId, plannedDate)) {
        skipped += 1;
        continue;
      }
      await createVisitFromRound(round, roundPool, plannedDate);
      created += 1;
    }
  }

  return { total: created, skipped, blocked, mode: "ROUND_TEMPLATES", rounds: rounds.length };
}

async function generateFallbackFromPools({ weekStart }) {
  const pools = await prisma.pool.findMany({
    where: { active: true },
    include: { client: true },
    orderBy: [{ zone: "asc" }, { id: "asc" }],
  });

  let created = 0;
  let skipped = 0;
  let blocked = 0;

  for (const pool of pools) {
    const readiness = await getPoolRoundReadiness(prisma, pool.id);
    if (!readiness.ok) {
      blocked += 1;
      continue;
    }

    const frequency = Math.max(1, Number(pool.serviceFrequency || 1));
    const preferredDays = String(pool.preferredDays || "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

    for (let i = 0; i < frequency; i += 1) {
      const day = pool.scheduleMode === "FIXED" && preferredDays.length
        ? preferredDays[i % preferredDays.length]
        : (weekStart.getDay() + i) % 7;
      const plannedDate = dateForWeekday(weekStart, day, i + 1);

      if (await visitAlreadyExists(pool.id, plannedDate)) {
        skipped += 1;
        continue;
      }

      await prisma.serviceVisit.create({
        data: {
          clientId: pool.clientId,
          poolId: pool.id,
          plannedDate,
          status: "PLANNED",
          reason: "AUTO_POOL_FALLBACK",
          notes: "Gerado automaticamente por fallback de piscinas ativas",
        },
      });
      created += 1;
    }
  }

  return { total: created, skipped, blocked, mode: "POOL_FALLBACK", pools: pools.length };
}

// ==========================================================
// GERAR RONDA SEMANAL
// ==========================================================

async function generateWeek(req, res) {
  try {
    const weekStart = startOfToday();
    const force = Boolean(req.body?.force);

    const roundCount = await prisma.round.count({ where: { active: true } });
    const result = roundCount > 0
      ? await generateFromRoundTemplates({ weekStart, force })
      : await generateFallbackFromPools({ weekStart });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("generateWeek error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao gerar ronda semanal" });
  }
}

// ==========================================================
// LISTAR RONDA DA SEMANA
// ==========================================================

async function getWeek(req, res) {
  try {
    const start = startOfToday();
    const end = addDays(start, 7);

    const visits = await prisma.serviceVisit.findMany({
      where: {
        plannedDate: {
          gte: start,
          lt: end,
        },
      },
      include: {
        client: true,
        pool: true,
        technician: true,
        round: true,
      },
      orderBy: [
        { plannedDate: "asc" },
        { id: "asc" },
      ],
    });

    return res.json(visits);
  } catch (err) {
    console.error("getWeek error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao listar ronda semanal" });
  }
}

async function updateVisit(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Visita invalida" });
    }

    const current = await prisma.serviceVisit.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ ok: false, error: "Visita nao encontrada" });
    }

    const data = {};
    const body = req.body || {};
    const assignmentMode = normalizeAssignmentMode(body.assignmentMode);
    const noteParts = [];
    let nextTechnicianName = current.technicianName || null;
    let technicianChanged = false;
    let dateChanged = false;

    if (assignmentMode !== "NORMAL") {
      noteParts.push(assignmentModeLabel(assignmentMode));
    }

    if (body.plannedDate !== undefined) {
      const plannedDate = parseDate(body.plannedDate);
      if (!plannedDate) return res.status(400).json({ ok: false, error: "Data da visita invalida" });
      data.plannedDate = plannedDate;
      const previousDate = current.plannedDate || current.date || null;
      dateChanged = previousDate && plannedDate.getTime() !== new Date(previousDate).getTime();
      if (dateChanged) {
        noteParts.push(`Data alterada para ${plannedDate.toLocaleString("pt-PT")}`);
      }
    }

    if (body.status !== undefined) {
      const status = String(body.status || "").trim().toUpperCase();
      if (!status) return res.status(400).json({ ok: false, error: "Estado obrigatorio" });
      data.status = status;
    }

    if (body.technicianId !== undefined) {
      const technicianId = toFiniteNumber(body.technicianId);
      if (!technicianId) {
        data.technicianId = null;
        data.technicianName = null;
        nextTechnicianName = null;
        technicianChanged = Boolean(current.technicianId);
      } else {
        const technician = await prisma.technician.findUnique({
          where: { id: technicianId },
          select: { id: true, name: true },
        });
        if (!technician) return res.status(404).json({ ok: false, error: "Tecnico nao encontrado" });
        data.technicianId = technician.id;
        data.technicianName = technician.name;
        nextTechnicianName = technician.name;
        technicianChanged = Number(current.technicianId || 0) !== technician.id;
      }
      if (technicianChanged) {
        noteParts.push(`Tecnico alterado de ${current.technicianName || current.technicianId || "sem tecnico"} para ${nextTechnicianName || "sem tecnico"}`);
      }
    }

    if (body.reason !== undefined) data.reason = String(body.reason || "").trim() || null;
    if (body.notes !== undefined) data.notes = String(body.notes || "").trim() || null;
    if (body.internalNotes !== undefined) data.internalNotes = String(body.internalNotes || "").trim() || null;
    if (body.operationNote !== undefined && String(body.operationNote || "").trim()) {
      noteParts.push(String(body.operationNote || "").trim());
    }

    if ((assignmentMode !== "NORMAL" || technicianChanged || dateChanged || noteParts.length) && body.internalNotes === undefined) {
      const stamp = new Date().toLocaleString("pt-PT");
      data.internalNotes = appendPlannerNote(current.internalNotes, `${stamp} - ${noteParts.join(" | ")}`);
    }

    if (assignmentMode !== "NORMAL" && body.reason === undefined) {
      data.reason = assignmentMode;
    }

    const revenue = toFiniteNumber(body.revenue);
    if (revenue !== null) {
      data.revenue = revenue;
      data.billed = false;
    }

    const visit = await prisma.serviceVisit.update({
      where: { id },
      data,
      include: {
        client: true,
        pool: true,
        technician: true,
        round: true,
      },
    });

    return res.json({ ok: true, visit });
  } catch (err) {
    console.error("updateVisit error:", err);
    return res.status(500).json({ ok: false, error: "Erro ao atualizar visita" });
  }
}

module.exports = {
  generateWeek,
  getWeek,
  updateVisit,
};
