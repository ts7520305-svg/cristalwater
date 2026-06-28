// ==========================================
// CRISTAL WATER - ADMIN ROUNDS CONTROLLER
// ==========================================

const prismaModule = require("../prismaClient");
const prisma = prismaModule.prisma;
const { assertPoolReadyForRound } = require("../utils/poolReadiness");

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function startOfWeek(date) {
  const d = new Date(date || new Date());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function dateForRoundDay(baseDate, dayOfWeek, order = 1) {
  const d = startOfWeek(baseDate);
  d.setDate(d.getDate() + Math.max(0, Number(dayOfWeek) || 0));
  d.setHours(8, 0, 0, 0);
  d.setMinutes(d.getMinutes() + Math.max(0, Number(order || 1) - 1) * 30);
  return d;
}

async function nextRoundOrder(tx, roundId) {
  const last = await tx.roundPool.findFirst({
    where: { roundId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return Number(last?.order || 0) + 1;
}

// LISTAR RONDAS
async function listRounds(req, res) {
  try {
    const rounds = await prisma.round.findMany({
      include: {
        technicians: { include: { technician: true } },
        pools: {
          orderBy: { order: "asc" },
          include: { pool: { include: { client: true } } },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { name: "asc" }],
    });

    res.json({ ok: true, rounds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Erro ao listar rondas" });
  }
}

// CRIAR RONDA
async function createRound(req, res) {
  const name = String(req.body.name || "").trim();
  const dayOfWeek = toNumber(req.body.dayOfWeek, 1);

  if (!name) {
    return res.status(400).json({ ok: false, message: "Nome da ronda obrigatório" });
  }

  try {
    const round = await prisma.round.create({
      data: { name, dayOfWeek },
    });

    res.json({ ok: true, round });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Erro ao criar ronda" });
  }
}

// EDITAR RONDA
async function updateRound(req, res) {
  const id = Number(req.params.id);
  const data = {};

  if (req.body.name !== undefined) data.name = String(req.body.name || "").trim();
  if (req.body.dayOfWeek !== undefined) data.dayOfWeek = toNumber(req.body.dayOfWeek, 1);
  if (req.body.active !== undefined) data.active = Boolean(req.body.active);

  if (data.name !== undefined && !data.name) {
    return res.status(400).json({ ok: false, message: "Nome da ronda obrigatorio" });
  }

  try {
    const round = await prisma.round.update({ where: { id }, data });
    res.json({ ok: true, round });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Erro ao atualizar ronda" });
  }
}

// APAGAR RONDA
async function deleteRound(req, res) {
  const id = Number(req.params.id);

  try {
    await prisma.round.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Erro ao apagar ronda" });
  }
}

// ATRIBUIR TÉCNICO
async function assignTechnician(req, res) {
  const roundId = Number(req.params.id);
  const technicianId = Number(req.body.technicianId);

  if (!roundId || !technicianId) {
    return res.status(400).json({ ok: false, message: "Ronda e técnico são obrigatórios" });
  }

  try {
    const item = await prisma.roundTechnician.upsert({
      where: { roundId_technicianId: { roundId, technicianId } },
      update: {},
      create: { roundId, technicianId },
    });

    res.json({ ok: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Erro ao atribuir técnico" });
  }
}

// ATRIBUIR PISCINA
async function assignPool(req, res) {
  const roundId = Number(req.params.id);
  const poolId = Number(req.body.poolId);
  const requestedOrder = toNumber(req.body.order, null);

  if (!roundId || !poolId) {
    return res.status(400).json({ ok: false, message: "Ronda e piscina são obrigatórias" });
  }

  try {
    await assertPoolReadyForRound(prisma, poolId);

    const order = requestedOrder || await nextRoundOrder(prisma, roundId);

    const item = await prisma.roundPool.upsert({
      where: { roundId_poolId: { roundId, poolId } },
      update: { order },
      create: { roundId, poolId, order },
    });

    res.json({ ok: true, item });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({
      ok: false,
      message: err.readiness?.message || "Erro ao atribuir piscina",
      missing: err.readiness?.missing || undefined
    });
  }
}

// 🔁 ATUALIZAR ORDEM (drag & drop)
// MOVER PISCINA ENTRE RONDAS
async function movePoolToRound(req, res) {
  const targetRoundId = Number(req.params.id);
  const poolId = Number(req.body.poolId);
  const sourceRoundId = Number(req.body.sourceRoundId || 0) || null;
  const requestedOrder = toNumber(req.body.order, null);
  const movePlannedVisits = req.body.movePlannedVisits !== false;

  if (!targetRoundId || !poolId) {
    return res.status(400).json({ ok: false, message: "Ronda destino e piscina sao obrigatorias" });
  }

  try {
    await assertPoolReadyForRound(prisma, poolId);

    const result = await prisma.$transaction(async (tx) => {
      const targetRound = await tx.round.findUnique({ where: { id: targetRoundId } });
      if (!targetRound) {
        const error = new Error("Ronda destino nao encontrada");
        error.status = 404;
        throw error;
      }

      if (sourceRoundId && sourceRoundId !== targetRoundId) {
        await tx.roundPool.delete({
          where: { roundId_poolId: { roundId: sourceRoundId, poolId } },
        }).catch(() => null);
      }

      const order = requestedOrder || await nextRoundOrder(tx, targetRoundId);
      const item = await tx.roundPool.upsert({
        where: { roundId_poolId: { roundId: targetRoundId, poolId } },
        update: { order },
        create: { roundId: targetRoundId, poolId, order },
      });

      let updatedVisits = 0;
      if (movePlannedVisits) {
        const visits = await tx.serviceVisit.findMany({
          where: {
            poolId,
            ...(sourceRoundId ? { roundId: sourceRoundId } : {}),
            status: { in: ["PLANNED", "PENDING", "PENDING_TECHNICIAN", "ON_ROUTE", "IN_PROGRESS"] },
            endAt: null,
          },
          select: { id: true, plannedDate: true, date: true, internalNotes: true },
        });

        for (const visit of visits) {
          const baseDate = visit.plannedDate || visit.date || new Date();
          const movementNote = [
            visit.internalNotes || "",
            `[Rondas] Piscina movida da ronda ${sourceRoundId || "-"} para ${targetRoundId}.`,
          ].filter(Boolean).join("\n");
          await tx.serviceVisit.update({
            where: { id: visit.id },
            data: {
              roundId: targetRoundId,
              plannedDate: dateForRoundDay(baseDate, targetRound.dayOfWeek, order),
              internalNotes: movementNote,
            },
          });
          updatedVisits += 1;
        }
      }

      return { item, updatedVisits };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({
      ok: false,
      message: err.readiness?.message || err.message || "Erro ao mover piscina para outra ronda",
      missing: err.readiness?.missing || undefined
    });
  }
}

async function updatePoolOrder(req, res) {
  const roundId = Number(req.params.id);
  const orderedPoolIds = Array.isArray(req.body.orderedPoolIds) ? req.body.orderedPoolIds.map(Number) : [];

  try {
    for (let i = 0; i < orderedPoolIds.length; i++) {
      await prisma.roundPool.update({
        where: {
          roundId_poolId: {
            roundId,
            poolId: orderedPoolIds[i],
          },
        },
        data: { order: i + 1 },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Erro ao atualizar ordem" });
  }
}

module.exports = {
  listRounds,
  createRound,
  updateRound,
  deleteRound,
  assignTechnician,
  assignPool,
  movePoolToRound,
  updatePoolOrder,
};
