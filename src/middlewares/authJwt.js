// ==========================================
// JWT AUTH MIDDLEWARE
// ==========================================

const jwt = require("jsonwebtoken");
const { roleMatches } = require("../utils/roles");
const { getJwtSecret } = require("../utils/jwtSecret");
const { validateJwtPrincipal } = require("../utils/jwtPrincipalGuard");

const JWT_SECRET = getJwtSecret();

function authJwt(requiredRole = null) {
  return async (req, res, next) => {
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

      const principalState = await validateJwtPrincipal(decoded);
      if (!principalState.ok) {
        return res.status(401).json({
          ok: false,
          message: "Sessão inválida",
        });
      }

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
