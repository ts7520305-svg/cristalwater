const ROLES = {
  ADMIN: "ADMIN",
  TEAM_LEADER: "TEAM_LEADER",
  SUPERVISOR: "SUPERVISOR",
  TECHNICIAN: "TECHNICIAN",
  CLIENT: "CLIENT",
  AI: "AI",
};

const PERMISSIONS = {
  ADMIN: ["*"],
  TEAM_LEADER: [
    "clients.read",
    "pools.read",
    "technicians.read",
    "visits.read",
    "routes.manage",
    "reports.read",
  ],
  SUPERVISOR: [
    "clients.read",
    "pools.read",
    "technicians.read",
    "visits.read",
    "routes.manage",
    "reports.read",
  ],
  TECHNICIAN: [
    "assigned_routes.read",
    "assigned_visits.read",
    "visit.start",
    "visit.complete",
    "visit.photos",
    "visit.products",
    "pool.operational_read",
  ],
  CLIENT: [
    "own_pool.read",
    "own_visits.read",
    "own_reports.read",
    "own_requests.create",
  ],
  AI: [
    "context.read",
    "suggest",
    "prepare_action",
  ],
};

function hasPermission(role, permission) {
  const normalizedRole = String(role || "").toUpperCase();
  const allowed = PERMISSIONS[normalizedRole] || [];
  return allowed.includes("*") || allowed.includes(permission);
}

function assertPermission(role, permission) {
  if (!hasPermission(role, permission)) {
    const error = new Error("Sem permissão para executar esta ação.");
    error.statusCode = 403;
    throw error;
  }
  return true;
}

module.exports = {
  ROLES,
  PERMISSIONS,
  hasPermission,
  assertPermission,
};
