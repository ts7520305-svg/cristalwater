// ==========================================
// ADMIN AUTH - SIMPLES (MODO LOCAL)
// ==========================================

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (token !== "admin") {
    return res.status(401).json({
      ok: false,
      message: "Acesso admin negado",
    });
  }

  next();
}

module.exports = { adminAuth };