const FLOW_STEPS = [
  "CLIENT",
  "POOL",
  "SCHEDULE",
  "ROUTE",
  "VISIT",
  "PRODUCTS",
  "EXTRAS",
  "BILLING",
  "HISTORY",
];

function getNextActions(context = {}) {
  const actions = [];

  if (!context.clientId) {
    actions.push("CREATE_CLIENT");
    return actions;
  }

  if (!context.poolId) {
    actions.push("CREATE_POOL");
    return actions;
  }

  if (!context.visitId) {
    actions.push("SCHEDULE_VISIT");
    actions.push("CREATE_GUEST_CHANGEOVER");
    return actions;
  }

  if (context.visitId && !context.technicianId) {
    actions.push("ASSIGN_TECHNICIAN");
    return actions;
  }

  if (context.visitId && context.technicianId) {
    actions.push("START_OR_CONTINUE_VISIT");
  }

  return actions;
}

module.exports = {
  FLOW_STEPS,
  getNextActions,
};
