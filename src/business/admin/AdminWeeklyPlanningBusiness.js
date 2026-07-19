const prismaClient = require("../../prismaClient");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function startOfWeek(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function endOfWeek(referenceDate = new Date()) {
  const date = startOfWeek(referenceDate);
  date.setDate(date.getDate() + 7);
  return date;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  const first = new Date(a);
  const second = new Date(b);
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function dayKey(date) {
  return new Date(date).getDay();
}

function normalizeRound(round) {
  return {
    id: round.id,
    name: round.name,
    dayOfWeek: round.dayOfWeek,
    active: round.active,
    technicians: (round.technicians || []).map((item) => ({
      id: item.technician?.id || item.technicianId,
      name: item.technician?.name || null,
      vehicleId: item.technician?.vehicleId || null,
    })),
    pools: (round.pools || []).map((item) => ({
      id: item.pool?.id || item.poolId,
      name: item.pool?.name || null,
      clientName: item.pool?.client?.name || null,
      order: item.order ?? 0,
    })),
  };
}

function normalizeVisit(visit) {
  return {
    id: visit.id,
    poolId: visit.poolId,
    roundId: visit.roundId,
    technicianId: visit.technicianId,
    technicianName: visit.technician?.name || visit.technicianName || null,
    status: visit.status,
    plannedDate: visit.plannedDate || visit.date || null,
    poolName: visit.pool?.name || null,
    clientName: visit.pool?.client?.name || visit.client?.name || null,
  };
}

async function getWeeklyPlan(query = {}) {
  const referenceDate = query.date ? new Date(query.date) : new Date();
  const includeInactive = ["true", "1", "yes", "sim"].includes(String(query.includeInactive || "").toLowerCase());
  const weekStart = startOfWeek(referenceDate);
  const weekEnd = endOfWeek(referenceDate);

  const [rounds, visits] = await Promise.all([
    prisma.round.findMany({
      where: includeInactive ? {} : { active: true },
      include: {
        technicians: { include: { technician: true } },
        pools: {
          orderBy: { order: "asc" },
          include: { pool: { include: { client: true } } },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { name: "asc" }],
    }),
    prisma.serviceVisit.findMany({
      where: {
        plannedDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      include: {
        client: true,
        pool: { include: { client: true } },
        round: true,
        technician: true,
      },
      orderBy: [{ plannedDate: "asc" }, { id: "asc" }],
    }),
  ]);

  const days = Array.from({ length: 7 }, (_, index) => {
    const currentDate = new Date(weekStart);
    currentDate.setDate(weekStart.getDate() + index);

    const dayRounds = rounds
      .filter((round) => Number(round.dayOfWeek) === index)
      .map(normalizeRound);

    const dayVisits = visits
      .filter((visit) => sameDay(visit.plannedDate || visit.date, currentDate))
      .map(normalizeVisit);

    return {
      dayOfWeek: index,
      label: DAY_LABELS[index],
      date: currentDate.toISOString(),
      rounds: dayRounds,
      visits: dayVisits,
      summary: {
        rounds: dayRounds.length,
        visits: dayVisits.length,
        pools: dayRounds.reduce((total, round) => total + round.pools.length, 0),
        technicians: dayRounds.reduce((total, round) => total + round.technicians.length, 0),
      },
    };
  });

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    totalRounds: rounds.length,
    totalVisits: visits.length,
    days,
  };
}

module.exports = {
  getWeeklyPlan,
};