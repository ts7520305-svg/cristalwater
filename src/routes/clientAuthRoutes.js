// ==========================================
// CLIENT AUTH + ALERTS (UNIFICADO)
// ==========================================

const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const { getLanguageForIdentity } = require("../services/languagePreferenceService");
const { getJwtSecret } = require("../utils/jwtSecret");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = getJwtSecret();
const auth = require('../middlewares/authMiddleware');
const AlertListBusiness = require('../business/admin/AlertListBusiness');
const AlertResolutionBusiness = require('../business/admin/AlertResolutionBusiness');

// ==========================================
// 🔐 LOGIN CLIENTE (REAL)
// ==========================================
router.post("/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({
        ok: false,
        message: "Email e password obrigatórios"
      });
    }

    const client = await prisma.client.findFirst({
      where: { email }
    });

    if (!client || !client.password) {
      return res.json({
        ok: false,
        message: "Credenciais inválidas"
      });
    }

    const valid = await bcrypt.compare(password, client.password);

    if (!valid) {
      return res.json({
        ok: false,
        message: "Credenciais inválidas"
      });
    }

    const language = await getLanguageForIdentity(
      { id: client.id, email: client.email, role: "CLIENT" },
      "pt"
    );

    const token = jwt.sign(
      { id: client.id, type: "client", role: "CLIENT", email: client.email, language },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      ok: true,
      token,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        role: "CLIENT",
        language
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      message: "Erro no login do cliente"
    });
  }
});

// ==========================================
// LISTAR ALERTAS
// ==========================================
router.use(auth('ADMIN'));
router.get("/", async (req, res) => {
  try {
    const alerts = await AlertListBusiness.listLegacyTechnical();

    res.json(alerts);
  } catch (error) {
    console.error("Erro ao listar alertas:", error);
    res.status(500).json({ error: "Erro ao listar alertas" });
  }
});

// ==========================================
// RESOLVER ALERTA
// ==========================================
router.put("/:id/resolve", async (req, res) => {
  try {
    return res.json(await AlertResolutionBusiness.resolve(req.user, `technical-${req.params.id}`, req.body));
  } catch (error) {
    console.error("Erro ao resolver alerta:", error);
    return res.status(error.statusCode || 500).json({ ok: false, error: error.statusCode ? error.message : "Erro ao resolver alerta", ...(error.code ? { code: error.code } : {}) });
  }
});

module.exports = router;
