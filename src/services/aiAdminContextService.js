const { prisma } = require("../prismaClient");
const financial = require("./aiFinancialContextService");

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function readers(unavailableSources) {
  async function safeCount(model, where) {
    try {
      if (!prisma[model]) throw Error("Source missing");
      return await prisma[model].count({ where });
    } catch (_) {
      unavailableSources.add(model); return null;
    }
  }

  async function safeFindMany(model, args) {
    try {
      if (!prisma[model]) throw Error("Source missing");
      return await prisma[model].findMany(args);
    } catch (_) {
      unavailableSources.add(model); return [];
    }
  }
  return { safeCount, safeFindMany };
}

async function getOperationalContext({ monthRef } = {}) {
  const unavailableSources = new Set(), { safeCount, safeFindMany } = readers(unavailableSources);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    finance,
    clientsActive,
    poolsActive,
    techniciansActive,
    visitsToday,
    visitsInProgress,
    visitsDoneToday,
    openAlerts,
    pendingRepairs,
    pendingTasks,
    pendingAiActions
  ] = await Promise.all([
    financial.snapshot(monthRef),
    safeCount("client", { active: true }),
    safeCount("pool", { active: true }),
    safeCount("technician", { active: true }),
    safeCount("serviceVisit", { OR: [{ plannedDate: { gte: todayStart, lte: todayEnd } }, { date: { gte: todayStart, lte: todayEnd } }] }),
    safeCount("serviceVisit", { status: "IN_PROGRESS" }),
    safeCount("serviceVisit", { status: "DONE", OR: [{ plannedDate: { gte: todayStart, lte: todayEnd } }, { date: { gte: todayStart, lte: todayEnd } }] }),
    safeCount("technicalAlert", { status: "OPEN" }),
    safeCount("repair", { status: { in: ["PENDING", "QUOTED", "APPROVED"] } }),
    safeCount("task", { status: { in: ["PENDENTE", "OPEN", "TODO"] } }),
    safeCount("aiAssistantAction", { status: "PENDING" })
  ]);

  const overdueVisits = await safeFindMany("serviceVisit", {
    where: {
      status: { notIn: ["DONE", "CANCELLED", "SKIPPED"] },
      OR: [{ plannedDate: { lt: todayStart } }, { date: { lt: todayStart } }]
    },
    include: { client: true, pool: true, technician: true },
    orderBy: [{ plannedDate: "asc" }, { date: "asc" }],
    take: 10
  });

  const todayVisits = await safeFindMany("serviceVisit", {
    where: { OR: [{ plannedDate: { gte: todayStart, lte: todayEnd } }, { date: { gte: todayStart, lte: todayEnd } }] },
    include: { client: true, pool: true, technician: true },
    orderBy: [{ plannedDate: "asc" }, { date: "asc" }],
    take: 20
  });

  const criticalAlerts = await safeFindMany("technicalAlert", {
    where: { status: "OPEN" },
    include: { pool: { include: { client: true } } },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const technicians = await safeFindMany("technician", {
    where: { active: true },
    select: { id: true, name: true, zone: true, vehicleId: true, active: true },
    orderBy: { name: "asc" },
    take: 40
  });

  const rounds = await safeFindMany("round", {
    where: { active: true },
    include: { technicians: { include: { technician: true } }, pools: { include: { pool: { include: { client: true } } }, orderBy: { order: "asc" } } },
    orderBy: [{ dayOfWeek: "asc" }, { name: "asc" }],
    take: 20
  });

  const pendingActions = await safeFindMany("aiAssistantAction", {
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const overdueCount = await safeCount("serviceVisit", { status: { notIn: ["DONE", "CANCELLED", "SKIPPED"] }, OR: [{ plannedDate: { lt: todayStart } }, { date: { lt: todayStart } }] });
  return {
    finance,
    unavailableSources: [...unavailableSources],
    sampleLimits: { todayVisits:20, overdueVisits:10, criticalAlerts:10, technicians:40, rounds:20 },
    generatedAt: now.toISOString(),
    today: todayStart.toISOString().slice(0, 10),
    counters: {
      clientsActive,
      poolsActive,
      techniciansActive,
      visitsToday,
      visitsInProgress,
      visitsDoneToday,
      overdueVisits: overdueCount,
      openAlerts,
      pendingRepairs,
      pendingInvoices: finance.receivables?.invoiceCount ?? null,
      pendingTasks,
      pendingAiActions
    },
    todayVisits: todayVisits.map(summarizeVisit),
    overdueVisits: overdueVisits.map(summarizeVisit),
    criticalAlerts: criticalAlerts.map((a) => ({
      id: a.id,
      poolId: a.poolId,
      pool: a.pool?.name || a.pool?.address || null,
      client: a.pool?.client?.name || null,
      type: a.type,
      priority: a.priority,
      message: a.message,
      createdAt: a.createdAt
    })),
    debtors: (finance.receivables?.topClients || []).map(row => ({ clientId:row.clientId, client:row.name, open:row.amountCents === null ? null : row.amountCents / 100, basis:'CURRENT_CLIENT_BALANCE', sampleOnly:finance.receivables.sampleOnly })),
    technicians,
    rounds: rounds.map((r) => ({
      id: r.id,
      name: r.name,
      dayOfWeek: r.dayOfWeek,
      technicianNames: (r.technicians || []).map((x) => x.technician?.name).filter(Boolean),
      poolCount: (r.pools || []).length,
      pools: (r.pools || []).slice(0, 12).map((rp) => ({
        order: rp.order,
        poolId: rp.poolId,
        pool: rp.pool?.name || rp.pool?.address || null,
        client: rp.pool?.client?.name || null
      }))
    })),
    pendingActions: pendingActions.map((a) => ({ id: a.id, type: a.type, title: a.title, risk: a.risk, status: a.status, createdAt: a.createdAt }))
  };
}

function summarizeVisit(v) {
  return {
    id: v.id,
    status: v.status,
    plannedDate: v.plannedDate || v.date,
    clientId: v.clientId,
    client: v.client?.name || null,
    poolId: v.poolId,
    pool: v.pool?.name || v.pool?.address || null,
    technicianId: v.technicianId,
    technician: v.technician?.name || v.technicianName || null,
    notes: v.notes || v.internalNotes || null
  };
}

module.exports = { getOperationalContext };
