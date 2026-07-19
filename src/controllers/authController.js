const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { prisma } = require("../prismaClient");
const { normalizeRole } = require("../utils/roles");
const { getLanguageForIdentity } = require("../services/languagePreferenceService");
const { getJwtSecret } = require("../utils/jwtSecret");
const {
  normalizeEmail,
  canonicalAdminEmail,
  isConfiguredAdminEmail,
} = require("../utils/adminIdentity");

const JWT_SECRET = getJwtSecret();

async function passwordMatches(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
    return bcrypt.compare(inputPassword, storedPassword);
  }
  const allowPlain = String(process.env.ALLOW_LEGACY_PLAIN_PASSWORDS || "false").toLowerCase() === "true";
  return allowPlain && storedPassword === inputPassword;
}

async function buildTokenUser(user) {
  const role = normalizeRole(user.role || "ADMIN");
  const language = await getLanguageForIdentity({ id: user.id, email: user.email, role }, "pt");
  const safeUser = {
    id: user.id,
    name: user.name || user.email || "Cristal Water Admin",
    email: user.email,
    role,
    language,
  };
  const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: "7d" });
  return { token, user: safeUser };
}

function getFallbackAdmin(email, password) {
  const configuredEmail = canonicalAdminEmail();
  const configuredPassword = String(process.env.ADMIN_PASSWORD || "");

  if (!configuredEmail || !configuredPassword) return null;
  if (!isConfiguredAdminEmail(email) || String(password) !== configuredPassword) return null;

  return {
    id: 1,
    email: configuredEmail,
    name: "Cristal Water Admin",
    role: "ADMIN",
    active: true,
  };
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email e password são obrigatórios" });
  }

  try {
    const normalizedEmail = normalizeEmail(email);
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const canonicalEmail = canonicalAdminEmail();
    if (!user && canonicalEmail && canonicalEmail !== normalizedEmail && isConfiguredAdminEmail(normalizedEmail)) {
      user = await prisma.user.findUnique({ where: { email: canonicalEmail } });
    }
    const valid = user ? await passwordMatches(String(password), user.password) : false;

    if (user && valid && user.active !== false) {
      const session = await buildTokenUser(user);
      return res.json({ ok: true, ...session });
    }

    const fallbackAdmin = getFallbackAdmin(email, password);
    if (fallbackAdmin) {
      const session = await buildTokenUser(fallbackAdmin);
      return res.json({ ok: true, fallback: true, ...session });
    }

    return res.status(401).json({ ok: false, error: "Credenciais inválidas" });
  } catch (err) {
    console.error("Erro no login, tentando fallback controlado:", err.message);

    const fallbackAdmin = getFallbackAdmin(email, password);
    if (fallbackAdmin) {
      const session = await buildTokenUser(fallbackAdmin);
      return res.json({ ok: true, fallback: true, warning: "DB_LOGIN_FALLBACK_ACTIVE", ...session });
    }

    return res.status(500).json({ ok: false, error: "Erro interno no login" });
  }
}

module.exports = { login };
