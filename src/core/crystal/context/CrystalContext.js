function buildContext(input = {}) {
  return {
    userId: input.userId || null,
    role: input.role || "UNKNOWN",
    screen: input.screen || "UNKNOWN",
    clientId: input.clientId || null,
    poolId: input.poolId || null,
    visitId: input.visitId || null,
    technicianId: input.technicianId || null,
    source: input.source || "SYSTEM",
    createdAt: new Date().toISOString(),
  };
}

function describeContext(context = {}) {
  return {
    hasUser: Boolean(context.userId),
    role: context.role || "UNKNOWN",
    screen: context.screen || "UNKNOWN",
    scope: {
      clientId: context.clientId || null,
      poolId: context.poolId || null,
      visitId: context.visitId || null,
      technicianId: context.technicianId || null,
    },
  };
}

module.exports = {
  buildContext,
  describeContext,
};
