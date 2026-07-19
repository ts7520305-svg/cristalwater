// ==========================================
// ADMIN AUTH ROUTES (fallback local controlled by ENV)
// ==========================================

const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { getLanguageForIdentity } = require("../services/languagePreferenceService");
const {
  normalizeEmail,
  canonicalAdminEmail,
  isConfiguredAdminEmail,
} = require("../utils/adminIdentity");
const { getJwtSecret } = require("../utils/jwtSecret");

const JWT_SECRET = getJwtSecret();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return res.status(503).json({
      ok: false,
      message: "Login admin fallback não configurado. Usa /api/auth/login ou define ADMIN_EMAIL/ADMIN_PASSWORD no .env."
    });
  }

  if (!isConfiguredAdminEmail(email) || password !== expectedPassword) {
    return res.status(401).json({ ok: false, message: "Credenciais inválidas" });
  }

  const adminEmail = canonicalAdminEmail() || normalizeEmail(email);
  const language = await getLanguageForIdentity({ id: 1, email: adminEmail, role: "ADMIN" }, "pt");
  const admin = { id: 1, name: "Cristal Water Admin", email: adminEmail, role: "ADMIN", language };
  const token = jwt.sign(admin, JWT_SECRET, { expiresIn: "7d" });
  return res.json({ ok: true, token, user: admin, admin });
});

module.exports = router;
