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
router.get("/", async (req, res) => {
  try {
    const alerts = await prisma.technicalAlert.findMany({
      where: {
        status: {
          in: ["OPEN", "IN_PROGRESS"],
        },
      },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

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
    const id = Number(req.params.id);

    const alert = await prisma.technicalAlert.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    res.json(alert);
  } catch (error) {
    console.error("Erro ao resolver alerta:", error);
    res.status(500).json({ error: "Erro ao resolver alerta" });
  }
});

module.exports = router;
