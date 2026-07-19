const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const prismaModule = require("../prismaClient");
const prisma = prismaModule.prisma;
const { getJwtSecret } = require("../utils/jwtSecret");

const JWT_SECRET = getJwtSecret();

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ ok: false, message: "Refresh token ausente" });
  }

  const record = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!record || record.expiresAt < new Date()) {
    return res.status(401).json({ ok: false, message: "Refresh token inválido" });
  }

  const payload =
    record.role === "ADMIN"
      ? { role: "ADMIN" }
      : { role: "CLIENT", clientId: record.clientId };

  const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });

  res.json({
    ok: true,
    accessToken: newAccessToken,
  });
});

module.exports = router;