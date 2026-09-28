const express = require("express");
const prisma = require("../prismaClient");
const router = express.Router();

const controller = require("../controllers/dashboardController");
const auth = require("../middlewares/authMiddleware");
const { analyzeOperationalData } = require("../services/aiOperationalService");
const { buildPredictiveAnalysis } = require("../services/aiPredictiveService");
const { buildRedistributionPlan } = require("../services/dispatchEngineService");
const { getDashboardCache, setDashboardCache, getDashboardCacheGeneration, CACHE_TTL_MS } = require("../services/dashboardCacheService");
let pendingMetrics = null;

const BREAKER = {
  state: "CLOSED", // CLOSED, OPEN, HALF_OPEN
  failureCount: 0,
  threshold: Number(process.env.DASHBOARD_BREAKER_THRESHOLD || 5),
  cooldownMs: Number(process.env.DASHBOARD_BREAKER_COOLDOWN_MS || 30000),
  nextAttemptAt: 0,
};

function markBreakerSuccess() {
  BREAKER.state = "CLOSED";
  BREAKER.failureCount = 0;
  BREAKER.nextAttemptAt = 0;
}

function markBreakerFailure() {
  BREAKER.failureCount += 1;
  if (BREAKER.failureCount >= BREAKER.threshold) {
    BREAKER.state = "OPEN";
    BREAKER.nextAttemptAt = Date.now() + BREAKER.cooldownMs;
  }
}

function getUtcDayWindow(reference = new Date()) {
  const base = reference instanceof Date && Number.isFinite(reference.getTime()) ? reference.getTime() : Date.now();
  const start = new Date(base);
  const end = new Date(base);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

async function buildLiveMetricsPayload() {
  const { start, end } = getUtcDayWindow();
  const [serviceVisitsByStatus, activeAlerts, financialAggregates] = await Promise.all([
    prisma.serviceVisit.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { OR: [{ plannedDate: { gte: start, lte: end } }, { date: { gte: start, lte: end } }] },
    }),
    prisma.technicalAlert.count({
      where: { status: { not: "RESOLVED" } },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { createdAt: { gte: start, lte: end } },
    }),
  ]);

  return {
    timezoneMode: "UTC_SAFE_WINDOW",
    cache: { source: "DATABASE_HIT", ttlMs: CACHE_TTL_MS, ageMs: 0 },
    dayWindow: { gte: start.toISOString(), lte: end.toISOString() },
    serviceVisitsByStatus,
    visitsByStatus: [],
    activeAlerts,
    financialAggregates,
    breaker: { state: BREAKER.state, failureCount: BREAKER.failureCount },
  };
}

async function executeLiveMetricsWithBreaker() {
  // Concurrent callers share one read and one breaker outcome. A failed source
  // must never publish a partial snapshot or increment failures per caller.
  if (pendingMetrics) return pendingMetrics;
  const attempt = refreshLiveMetrics();
  pendingMetrics = attempt;
  try {
    return await attempt;
  } finally {
    if (pendingMetrics === attempt) pendingMetrics = null;
  }
}

function cachedMetrics(source) {
  const cached = getDashboardCache();
  if (!cached) return null;
  return {
    ...cached,
    source,
    cache: { ...cached.cache, source },
    ...(source !== "RAM_CACHE_HIT" ? { breakerDegraded: true } : {}),
    breaker: { ...BREAKER },
  };
}

async function refreshLiveMetrics() {
  global.metricCounters = global.metricCounters || {};

  if (BREAKER.state === "OPEN") {
    if (Date.now() >= BREAKER.nextAttemptAt) {
      BREAKER.state = "HALF_OPEN";
    } else {
      const cached = cachedMetrics("RAM_CIRCUIT_BREAKER");
      if (cached) {
        global.metricCounters.dashboard_circuit_cache_total = (global.metricCounters.dashboard_circuit_cache_total || 0) + 1;
        return cached;
      }
      throw new Error("CIRCUIT_BREAKER_OPEN_WITHOUT_CACHE");
    }
  }

  try {
    const generation = getDashboardCacheGeneration();
    const payload = await buildLiveMetricsPayload();
    // A mutation or a UTC day change during the read invalidates this result.
    // In particular, a late read cannot undo event-driven cache invalidation.
    if (Date.now() < Date.parse(payload.dayWindow.gte) || Date.now() > Date.parse(payload.dayWindow.lte) || !setDashboardCache(payload, generation)) {
      const expired = new Error("DASHBOARD_SNAPSHOT_EXPIRED");
      expired.code = "DASHBOARD_SNAPSHOT_EXPIRED";
      throw expired;
    }
    markBreakerSuccess();
    return { ...payload, source: "DATABASE_HIT", breaker: { ...BREAKER } };
  } catch (err) {
    // A changed snapshot requires a retry, but is not a database outage.
    if (err.code !== "DASHBOARD_SNAPSHOT_EXPIRED") markBreakerFailure();
    const cached = cachedMetrics("RAM_CACHE_FALLBACK");
    if (cached) {
      global.metricCounters.dashboard_degraded_cache_total = (global.metricCounters.dashboard_degraded_cache_total || 0) + 1;
      return cached;
    }
    throw err;
  }
}

router.get("/admin", (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
}, auth("ADMIN"), async (req, res) => {
  try {
    if (typeof controller.getAdminDashboardData === "function") {
      const result = await controller.getAdminDashboardData(req);
      const technicians = result.technicians || [];
      const alerts = result.alerts || [];
      const visits = result.visits || [];
      return res.json({
        ok: true,
        ...result,
        aiAnalysis: analyzeOperationalData(technicians, alerts, visits),
        predictiveAnalysis: buildPredictiveAnalysis({ technicians, visits, alerts }),
        redistributionPlan: buildRedistributionPlan({ technicians, visits }),
      });
    }

    if (typeof controller.getAdminDashboard === "function") {
      return controller.getAdminDashboard(req, res);
    }

    return res.status(500).json({ ok: false, error: "Dashboard controller sem função compatível" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Erro dashboard" });
  }
});

async function liveMetricsHandler(req, res) {
  try {
    const cached = cachedMetrics(BREAKER.state === "OPEN" ? "RAM_CIRCUIT_BREAKER" : BREAKER.failureCount ? "RAM_CACHE_FALLBACK" : "RAM_CACHE_HIT");
    if (cached && req.query.force !== "1") {
      global.metricCounters = global.metricCounters || {};
      global.metricCounters.dashboard_cache_hit_total = (global.metricCounters.dashboard_cache_hit_total || 0) + 1;
      return res.json({ ok: true, ...cached });
    }

    global.metricCounters = global.metricCounters || {};
    global.metricCounters.dashboard_cache_miss_total = (global.metricCounters.dashboard_cache_miss_total || 0) + 1;
    const data = await executeLiveMetricsWithBreaker();
    return res.json({ ok: true, ...data });
  } catch (err) {
    return res.status(503).json({ ok: false, error: "Dashboard temporariamente degradado", message: "Não foi possível obter métricas atuais. Tente novamente.", breaker: { ...BREAKER } });
  }
}

function privateMetrics(_req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  return next();
}

router.get("/metrics", privateMetrics, auth("TEAM_LEADER"), liveMetricsHandler);
router.post("/metrics", privateMetrics, auth("TEAM_LEADER"), liveMetricsHandler);

module.exports = router;
