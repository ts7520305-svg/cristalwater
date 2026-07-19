const { prisma } = require("../../prismaClient");

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeVisit(v) {
  return {
    ...v,

    client: {
      ...v.client,
      accesses: (v.client?.accesses || []).sort((a, b) => {
        if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        }
        return a.id - b.id;
      }),
    },

    pool: {
      ...v.pool,
      notes: v.pool?.notes || null,
      temporaryNotes: v.pool?.temporaryNotes || null,
      temporaryNotesActive: v.pool?.temporaryNotesActive ?? false,
    },
  };
}

async function getTodayRoute({ technicianId, req } = {}) {
  const today = startOfToday();
  const tomorrow = startOfTomorrow();

  let visits = await prisma.serviceVisit.findMany({
    where: {
      plannedDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      client: {
        include: {
          accesses: {
            where: {
              active: true,
              visibleToTechnician: true,
            },
          },
        },
      },
      pool: true,
    },
    orderBy: [
      { plannedDate: "asc" },
      { id: "asc" },
    ],
  });

  let mode = "TODAY";

  if (!visits || visits.length === 0) {
    visits = await prisma.serviceVisit.findMany({
      where: {
        status: "PLANNED",
      },
      include: {
        client: {
          include: {
            accesses: {
              where: {
                active: true,
                visibleToTechnician: true,
              },
            },
          },
        },
        pool: true,
      },
      orderBy: [
        { plannedDate: "asc" },
        { id: "asc" },
      ],
      take: 50,
    });

    mode = "FALLBACK";
  }

  const normalized = (visits || []).map(normalizeVisit);

  return {
    ok: true,
    mode,
    total: normalized.length,
    visits: normalized,
  };
}

module.exports = {
  getTodayRoute,
};
