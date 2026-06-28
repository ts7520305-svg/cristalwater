const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { prisma } = require("../prismaClient");

const SECRET = process.env.JWT_SECRET || "cristalwater_secret";

async function passwordMatches(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
    return bcrypt.compare(inputPassword, storedPassword);
  }
  const allowPlain = String(process.env.ALLOW_LEGACY_PLAIN_PASSWORDS || "true").toLowerCase() === "true";
  return allowPlain && storedPassword === inputPassword;
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await passwordMatches(password, user.password) : false;

  if (!user || !valid) {
    return res.status(401).json({ ok: false, message: "Credenciais inválidas" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    SECRET,
    { expiresIn: "7d" }
  );

  res.json({ ok: true, token, user });
});

module.exports = router;
