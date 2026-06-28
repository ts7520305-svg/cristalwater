// ====================================================================
// CRISTAL WATER ENTERPRISE — DASHBOARD RAM CACHE SERVICE V22 ORE
// Cache curta com invalidação orientada a eventos.
// ====================================================================

let dashboardCache = null;
let cacheTimestamp = 0;

const CACHE_TTL_MS = Number(process.env.DASHBOARD_CACHE_TTL_MS || 30000);

function getDashboardCache() {
  if (!dashboardCache) return null;
  const ageMs = Date.now() - cacheTimestamp;
  if (ageMs > CACHE_TTL_MS) {
    dashboardCache = null;
    cacheTimestamp = 0;
    return null;
  }
  return {
    ...dashboardCache,
    cache: {
      ...(dashboardCache.cache || {}),
      source: 'RAM_CACHE_HIT',
      ttlMs: CACHE_TTL_MS,
      ageMs,
    },
  };
}

function setDashboardCache(payload) {
  dashboardCache = payload || null;
  cacheTimestamp = dashboardCache ? Date.now() : 0;
  return dashboardCache;
}

function invalidateDashboardCache(reason = 'MUTATION_EVENT') {
  dashboardCache = null;
  cacheTimestamp = 0;
  if (global.metricCounters) {
    global.metricCounters.dashboard_cache_invalidations_total =
      (global.metricCounters.dashboard_cache_invalidations_total || 0) + 1;
  }
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] [INFO] [CACHE] Dashboard cache invalidated: ${reason}`);
  }
}

module.exports = {
  CACHE_TTL_MS,
  getDashboardCache,
  setDashboardCache,
  invalidateDashboardCache,
};
