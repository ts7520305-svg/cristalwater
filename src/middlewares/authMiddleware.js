const jwt =
  require("jsonwebtoken");
const { roleMatches } = require("../utils/roles");
const { getJwtSecret } = require("../utils/jwtSecret");
const { validateJwtPrincipal } = require("../utils/jwtPrincipalGuard");

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

      req.user =
        decoded;

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
