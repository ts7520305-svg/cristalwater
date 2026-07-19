const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../utils/jwtSecret");

const JWT_SECRET = getJwtSecret();

function isDevTokenAllowed(req) {
  const allow = String(process.env.AI_ADMIN_ALLOW_DEV_TOKEN || "false").toLowerCase() === "true";
  const expected = process.env.AI_ADMIN_DEV_TOKEN;
  const received = req.headers["x-admin-token"];
  return allow && expected && received && received === expected;
}

function requireAiAdmin(req, res, next) {
  const enabled = String(process.env.AI_ADMIN_ENABLED || "true").toLowerCase() !== "false";
  if (!enabled) {
    return res.status(503).json({ ok: false, error: "IA operacional desativada por configuração." });
  }

  if (isDevTokenAllowed(req)) {
    req.aiAdmin = { id: null, role: "ADMIN", email: "dev-token", mode: "dev-token" };
    return next();
  }

  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Token admin obrigatório." });
  }

  try {
    const token = header.replace("Bearer ", "").trim();
    const payload = jwt.verify(token, JWT_SECRET);
    const role = String(payload.role || "").toUpperCase();
    if (role !== "ADMIN") {
      return res.status(403).json({ ok: false, error: "Acesso reservado a administradores." });
    }
    req.aiAdmin = {
      id: payload.id || null,
      role,
      email: payload.email || null,
      name: payload.name || null,
      mode: "jwt"
    };
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Token admin inválido ou expirado." });
  }
}

module.exports = { requireAiAdmin };
