function normalizeRole(role) {
  const value = String(role || "").trim().toUpperCase();
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z_]/g, "");

  if (["OWNER", "ADMINISTRATOR", "ADMINISTRADOR"].includes(ascii)) return "ADMIN";
  if (["TEAM_LEADER", "TEAMLEADER", "CHEFE_EQUIPA", "CHEFEDEQUIPA", "SUPERVISOR", "MANAGER"].includes(ascii)) {
    return "TEAM_LEADER";
  }
  if (["TECH", "TECHNICIAN", "TECNICO"].includes(ascii)) return "TECHNICIAN";
  if (ascii.startsWith("T") && ascii.endsWith("CNICO")) return "TECHNICIAN";
  if (value === "CUSTOMER") return "CLIENT";
  if (ascii === "CUSTOMER") return "CLIENT";
  return ascii || value;
}

const ROLE_IMPLICATIONS = {
  ADMIN: ["ADMIN", "TEAM_LEADER", "TECHNICIAN", "CLIENT"],
  TEAM_LEADER: ["TEAM_LEADER", "TECHNICIAN"],
  TECHNICIAN: ["TECHNICIAN"],
  CLIENT: ["CLIENT"],
};

function roleMatches(actual, expected) {
  const current = normalizeRole(actual);
  const target = normalizeRole(expected);
  return current === target || (ROLE_IMPLICATIONS[current] || []).includes(target);
}

function roleIn(actual, expectedRoles = []) {
  const current = normalizeRole(actual);
  const roles = Array.isArray(expectedRoles) ? expectedRoles : [expectedRoles];
  return roles.map(normalizeRole).some((role) => roleMatches(current, role));
}

module.exports = {
  normalizeRole,
  roleMatches,
  roleIn,
};
