const prismaClient = require("../../prismaClient");
const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

const CLOSED_ALERT_STATUSES = new Set(["DONE", "RESOLVED", "CLOSED", "CANCELLED", "CANCELED", "ARCHIVED", "FECHADO"]);
const COMPLETED_VISIT_STATUSES = new Set(["DONE", "COMPLETED", "CONCLUIDA", "CONCLUÍDA"]);

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function isOpenAlert(alert) {
  return !CLOSED_ALERT_STATUSES.has(normalizeStatus(alert?.status || "OPEN"));
}

function isCompletedVisit(visit) {
  return COMPLETED_VISIT_STATUSES.has(normalizeStatus(visit?.status));
}

function healthBand(score) {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 50) return "ATTENTION";
  return "CRITICAL";
}

function calculatePoolHealthScore(pool) {
  const factors = [];
  let score = 100;

  const technicalSheet = pool?.technicalSheet || null;
  const openAlerts = Array.isArray(pool?.technicalAlerts) ? pool.technicalAlerts.filter(isOpenAlert) : [];
  const serviceVisits = Array.isArray(pool?.serviceVisits) ? pool.serviceVisits : [];
  const technicalHistory = Array.isArray(pool?.technicalHistory) ? pool.technicalHistory : [];

  if (!technicalSheet) {
    score -= 20;
    factors.push("Sem ficha técnica.");
  } else {
    if (!Number(technicalSheet.volumeM3 || 0)) {
      score -= 5;
      factors.push("Ficha técnica sem volume.");
    }
    if (!Number(technicalSheet.targetPhMin) || !Number(technicalSheet.targetPhMax)) {
      score -= 5;
      factors.push("Metas químicas incompletas.");
    }
  }

  if (!technicalHistory.length) {
    score -= 10;
    factors.push("Sem histórico técnico.");
  }

  if (openAlerts.length) {
    const alertPenalty = Math.min(40, openAlerts.length * 10);
    score -= alertPenalty;
    factors.push(`${openAlerts.length} alerta(s) aberto(s).`);
  }

  if (!serviceVisits.length) {
    score -= 10;
    factors.push("Sem visitas recentes.");
  } else if (!isCompletedVisit(serviceVisits[0])) {
    score -= 10;
    factors.push("Última visita não concluída.");
  }

  const normalizedScore = Math.max(0, Math.min(100, score));

  return {
    score: normalizedScore,
    status: healthBand(normalizedScore),
    factors,
  };
}

async function listPools(query = {}) {
  const includeInactive = ["true", "1", "yes", "sim"].includes(String(query.includeInactive || "").toLowerCase());

  const where = includeInactive
    ? {}
    : {
        active: true,
        deletedAt: null,
        archiveStatus: "ATIVO",
      };

  return prisma.pool.findMany({
    where,
    include: {
      client: true,
      equipment: true,
      technicalRoom: true,
      calculationProfile: true,
      technicalSheet: true,
      roundPools: {
        include: {
          round: {
            select: { id: true, name: true, dayOfWeek: true, active: true },
          },
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: [{ active: "desc" }, { zone: "asc" }, { id: "asc" }],
  });
}

async function getPoolById(poolId) {
  const id = toInt(poolId);
  if (!id) {
    throw new Error("ID inválido");
  }

  const pool = await prisma.pool.findUnique({
    where: { id },
    include: {
      client: true,
      equipment: true,
      technicalRoom: true,
      calculationProfile: true,
      technicalSheet: true,
      technicalHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      technicalAlerts: {
        where: { status: { notIn: Array.from(CLOSED_ALERT_STATUSES) } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      serviceVisits: {
        orderBy: { plannedDate: "desc" },
        take: 10,
      },
    },
  });

  if (!pool) {
    return null;
  }

  const health = calculatePoolHealthScore(pool);

  return {
    ...pool,
    healthScore: health.score,
    healthStatus: health.status,
    healthFactors: health.factors,
  };
}

module.exports = {
  listPools,
  getPoolById,
  calculatePoolHealthScore,
};
