const jwt =
  require("jsonwebtoken");
const { roleMatches } = require("../utils/roles");
const { getJwtSecret } = require("../utils/jwtSecret");
const { validateJwtPrincipal } = require("../utils/jwtPrincipalGuard");
const {
  sanitizeTechnicianVisitDetailPayload,
  shouldSanitizeTechnicianVisitDetail,
} = require("../services/technicianResponseSanitizer");

// ======================================================
// SECRET
// ======================================================

const SECRET =
  getJwtSecret();

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

function auth(requiredRole = null) {

  return async (req, res, next) => {

    const header =
      req.headers.authorization;

    if (!header) {

      return res.status(401).json({

        ok: false,

        message: "Sem token"
      });
    }

    const token =
      header.split(" ")[1];

    try {

      const decoded =
        jwt.verify(
          token,
          SECRET
        );

      const principalState = await validateJwtPrincipal(decoded);
      if (!principalState.ok) {
        return res.status(401).json({

          ok: false,

          message: "Sessão inválida"
        });
      }

      req.user = decoded;
      if (decoded.principalType === 'USER' && ['TECHNICIAN','TEAM_LEADER'].includes(decoded.role) && !decoded.technicianId && !String(req.originalUrl || '').startsWith('/api/workday/')) {
        return res.status(403).json({ok:false,message:'Perfil de campo por associar. A administração deve associar o mesmo email ao técnico.'});
      }

      // ==================================================
      // ROLE CHECK
      // ==================================================

      if (
        requiredRole &&
        !roleMatches(decoded.role, requiredRole)
      ) {

        return res.status(403).json({

          ok: false,

          message: "Sem permissão"
        });
      }

      // Defense-in-depth for the technician visit-detail endpoint.
      // Ownership is still enforced by visitRoutes; this layer removes
      // contact and financial data before a technician response leaves API.
      if (shouldSanitizeTechnicianVisitDetail(req, decoded.role)) {
        const json = res.json.bind(res);
        res.json = (payload) => json(sanitizeTechnicianVisitDetailPayload(payload));
      }

      next();

    } catch(err) {

      console.error(
        "JWT ERROR:",
        err.message
      );

      return res.status(401).json({

        ok: false,

        message: "Token inválido"
      });
    }
  };
}

module.exports =
  auth;
