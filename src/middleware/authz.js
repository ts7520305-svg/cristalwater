// src/middleware/authz.js
const { roleIn, roleMatches } = require("../utils/roles");

// ⚠ Estes middlewares AGORA vão ser usados em algumas rotas.
// - requireAdmin: só ADMIN
// - requireTechOrAdmin: ADMIN ou TECH
// - requireTech: só TECH (por agora ainda não usado)

function requireAdmin(req, res, next) {
  if (!req.user || !roleMatches(req.user.role, "ADMIN")) {
    return res.status(403).json({ error: "Acesso apenas para ADMIN." });
  }
  next();
}

function requireTech(req, res, next) {
  if (!req.user || !roleMatches(req.user.role, "TECHNICIAN")) {
    return res.status(403).json({ error: "Acesso apenas para TÉCNICO." });
  }
  next();
}

function requireTechOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Utilizador não autenticado." });
  }
  if (roleIn(req.user.role, ["ADMIN", "TECHNICIAN"])) return next();
  return res.status(403).json({ error: "Acesso negado." });
}

module.exports = {
  requireAdmin,
  requireTech,
  requireTechOrAdmin,
};
