const jwt =
  require("jsonwebtoken");
const { roleMatches } = require("../utils/roles");

// ======================================================
// SECRET
// ======================================================

const SECRET =
  process.env.JWT_SECRET ||
  "cristalwater_secret";

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

function auth(requiredRole = null) {

  return (req, res, next) => {

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
