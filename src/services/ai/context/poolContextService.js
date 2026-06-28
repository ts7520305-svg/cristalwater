const { getPoolById } = require("../data/poolData");

function sanitizePoolProfile(pool) {
  if (!pool) return null;

  return {
    id: pool.id,
    name: pool.name,
    internalName: pool.internalName,
    clientId: pool.clientId,
    client: pool.client || null,

    type: pool.type || null,
    volume: pool.volume || null,
    location: pool.location || null,
    active: pool.active,

    equipment: pool.equipment || [],
    repairs: pool.repairs || [],
    serviceVisits: pool.serviceVisits || [],
    technicalHistory: pool.technicalHistory || [],
    technicalRoom: pool.technicalRoom || null,
    technicalSheet: pool.technicalSheet || null,
    visits: pool.visits || [],
  };
}

async function buildPoolContextFromId(poolId) {
  const pool = await getPoolById(poolId);

  if (!pool) {
    return {
      type: "pool_context",
      found: false,
      poolId,
      message: "Piscina não encontrada.",
    };
  }

  return {
    type: "pool_context",
    found: true,
    pool: sanitizePoolProfile(pool),
  };
}

module.exports = {
  buildPoolContextFromId,
};
