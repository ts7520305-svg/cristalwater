const { loginAdmin } = require("../services/adminAuthService");

async function adminLogin(req, res) {
  const { email, password } = req.body;

  const token = loginAdmin(email, password);

  if (!token) {
    return res.status(401).json({
      ok: false,
      message: "Credenciais inválidas",
    });
  }

  return res.json({
    ok: true,
    token,
  });
}

module.exports = {
  adminLogin,
};