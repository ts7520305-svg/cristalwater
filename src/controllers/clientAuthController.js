// ==========================================
// CRISTAL WATER - LOGIN (ADMIN + CLIENTE)
// ==========================================

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prismaModule = require("../prismaClient");
const prisma = prismaModule.prisma;
const { canonicalAdminEmail, isConfiguredAdminEmail } = require("../utils/adminIdentity");
const { getJwtSecret } = require("../utils/jwtSecret");

const JWT_SECRET = getJwtSecret();
const ACCESS_EXPIRES = "15m";
const REFRESH_DAYS = 7;

const ADMIN_PIN = process.env.ADMIN_PIN || "";

async function unifiedLogin(req, res) {
  const { email, pin } = req.body;

  if (!email || !pin) {
    return res.status(400).json({
      ok: false,
      message: "Email e PIN são obrigatórios",
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // ============================
    // LOGIN ADMIN FALLBACK POR ENV
    // ============================
    if (isConfiguredAdminEmail(cleanEmail)) {
      if (!ADMIN_PIN || pin !== ADMIN_PIN) {
        return res.status(401).json({
          ok: false,
          message: "PIN de administrador inválido",
        });
      }

      const accessToken = jwt.sign(
        { role: "ADMIN", email: canonicalAdminEmail() || cleanEmail },
        JWT_SECRET,
        { expiresIn: ACCESS_EXPIRES }
      );

      const refreshToken = crypto.randomBytes(40).toString("hex");

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          role: "ADMIN",
          expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
        },
      });

      return res.json({
        ok: true,
        role: "ADMIN",
        accessToken,
        refreshToken,
      });
    }

    // ============================
    // LOGIN CLIENTE
    // ============================
    const client = await prisma.client.findFirst({
      where: { email: cleanEmail },
    });

    if (!client || !client.pin) {
      return res.status(401).json({
        ok: false,
        message: "Email ou PIN inválidos",
      });
    }

    const pinOk = await bcrypt.compare(pin, client.pin);

    if (!pinOk) {
      return res.status(401).json({
        ok: false,
        message: "Email ou PIN inválidos",
      });
    }

    const accessToken = jwt.sign(
      { role: "CLIENT", clientId: client.id },
      JWT_SECRET,
      { expiresIn: ACCESS_EXPIRES }
    );

    const refreshToken = crypto.randomBytes(40).toString("hex");

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        role: "CLIENT",
        clientId: client.id,
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
      },
    });

    return res.json({
      ok: true,
      role: "CLIENT",
      client: {
        id: client.id,
        name: client.name,
      },
      accessToken,
      refreshToken,
    });

  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro interno no servidor",
    });
  }
}

module.exports = {
  unifiedLogin,
};
