// ==========================================
// JWT AUTH MIDDLEWARE
// ==========================================

const jwt = require("jsonwebtoken");
const { roleMatches } = require("../utils/roles");

const JWT_SECRET = process.env.JWT_SECRET || "cristalwater_secret";

function authJwt(requiredRole = null) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        message: "Token não fornecido",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      // Guardar info do token na request
      req.auth = decoded;

      // Verificar role, se necessário
      if (requiredRole && !roleMatches(decoded.role, requiredRole)) {
        return res.status(403).json({
          ok: false,
          message: "Acesso não autorizado",
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        ok: false,
        message: "Token inválido ou expirado",
      });
    }
  };
}

module.exports = authJwt;
