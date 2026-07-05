const { prisma } = require("../prismaClient");
const TechnicianDashboardBusiness = require("../business/technician/TechnicianDashboardBusiness");
const TechnicianRouteBusiness = require("../business/technician/TechnicianRouteBusiness");
// ==========================================================
// HELPERS
// ==========================================================

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

// ==========================================================
// NORMALIZAR DADOS (IMPORTANTE)
// ==========================================================

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

      // 🔥 já preparado para notas temporárias
      temporaryNotes: v.pool?.temporaryNotes || null,
      temporaryNotesActive: v.pool?.temporaryNotesActive ?? false,
    },
  };
}

// ==========================================================
// RONDA TÉCNICO (INTELIGENTE)
// ==========================================================

async function getTodayRoute(req, res) {
  try {
    const today = startOfToday();
    const tomorrow = startOfTomorrow();

    // ======================================================
    // 1️⃣ VISITAS DE HOJE
    // ======================================================

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

    // ======================================================
    // 2️⃣ FALLBACK (SEM VISITAS HOJE)
    // ======================================================

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

    // ======================================================
    // 3️⃣ NORMALIZAR
    // ======================================================

    const normalized = (visits || []).map(normalizeVisit);

    // ======================================================
    // 4️⃣ RESPONSE FINAL
    // ======================================================

    return res.json({
      ok: true,
      mode,
      total: normalized.length,
      visits: normalized,
    });

  } catch (err) {
    console.error("getTodayRoute error:", err);
    res.status(500).json({
      ok: false,
      error: "Erro técnico rota",
    });
  }
}

module.exports = {
  getTodayRoute,
};
