const { remember, recall } = require("./memoryManager");

function rememberVisitExperience({ customer, pool, technician, visit, result }) {
  return remember({
    type: "visit_experience",
    entityType: "pool",
    entityId: pool?.id || null,
    title: `Experiência da visita - ${pool?.name || pool?.internalName || "Piscina"}`,
    content: JSON.stringify(
      {
        customer,
        pool,
        technician,
        visit,
        result,
      },
      null,
      2
    ),
    importance: result?.importance || "normal",
    source: "visit",
  });
}

function recallPoolMemory(poolId) {
  return recall({
    entityType: "pool",
    entityId: poolId,
  });
}

module.exports = {
  rememberVisitExperience,
  recallPoolMemory,
};
