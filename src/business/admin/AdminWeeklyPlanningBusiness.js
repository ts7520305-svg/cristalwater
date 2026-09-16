const prismaClient = require("../../prismaClient");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function calendarDate(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function referenceDate(value) {
  if (value === undefined) return new Date();
  const invalid = () => { throw Object.assign(new Error('Data de referência inválida. Indique AAAA-MM-DD ou um instante ISO com fuso.'), { status: 400, code: 'INVALID_WEEK_DATE' }); };
  if (typeof value !== 'string') return invalid();
  const civil = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!civil && !instant) return invalid();
  const day = value.slice(0, 10), dayCheck = new Date(day + 'T00:00:00Z');
  if (!Number.isFinite(dayCheck.getTime()) || dayCheck.toISOString().slice(0, 10) !== day) return invalid();
  const date = new Date(civil ? value + 'T00:00:00' : value);
  if (!Number.isFinite(date.getTime()) || (civil && calendarDate(date) !== value)) return invalid();
  return date;
}

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
    dayOfWeek: round.dayOfWeek,recurrence:round.recurrence||'WEEKLY',dayOfMonth:round.dayOfMonth,startsOn:round.startsOn,endsOn:round.endsOn,
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
  const reference = referenceDate(query.date);
  const includeInactive = ["true", "1", "yes", "sim"].includes(String(query.includeInactive || "").toLowerCase());
  const weekStart = startOfWeek(reference);
  const weekEnd = endOfWeek(reference);

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
      .filter((round) => require('../../services/roundScheduleService').matches(round,currentDate))
      .map(normalizeRound);

    const dayVisits = visits
      .filter((visit) => sameDay(visit.plannedDate || visit.date, currentDate))
      .map(normalizeVisit);

    return {
      dayOfWeek: index,
      label: DAY_LABELS[index],
      date: currentDate.toISOString(),
      calendarDate: calendarDate(currentDate),
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
    referenceDate: calendarDate(reference),
    weekStartDate: calendarDate(weekStart),
    weekEndDate: calendarDate(weekEnd),
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
