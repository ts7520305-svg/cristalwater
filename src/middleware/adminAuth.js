// ==========================================
// ADMIN AUTH MIDDLEWARE
// ==========================================

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token) {
    return res.status(401).json({
      error: "Admin token em falta",
    });
  }

  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({
      error: "Admin token inválido",
    });
  }

  next();
}

module.exports = {
  adminAuth,
};