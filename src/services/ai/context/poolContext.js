function buildPoolContext(pool = {}) {
  return {
    type: "pool_context",
    poolId: pool.id || null,
    poolName: pool.name || pool.internalName || null,
    customer: pool.customer || null,
    location: pool.location || null,
    volumeM3: pool.volumeM3 || null,
    poolType: pool.poolType || null,
    treatmentType: pool.treatmentType || null,
    equipment: pool.equipment || {},
    lastVisit: pool.lastVisit || null,
    lastTechnician: pool.lastTechnician || null,
    activeAlerts: pool.activeAlerts || [],
    notes: pool.notes || "",
  };
}

module.exports = {
  buildPoolContext,
};
