const jwt = require("jsonwebtoken");
const {
  normalizeEmail,
  canonicalAdminEmail,
  isConfiguredAdminEmail,
} = require("../utils/adminIdentity");
const { getAdminJwtSecret } = require("../utils/jwtSecret");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = getAdminJwtSecret();

function loginAdmin(email, password) {
  const adminEmail = canonicalAdminEmail() || normalizeEmail(email);
  if (!adminEmail || !ADMIN_PASSWORD) return null;
  if (!isConfiguredAdminEmail(email) || password !== ADMIN_PASSWORD) return null;

  return jwt.sign(
    { role: "ADMIN", email: adminEmail },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function verifyAdminToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { loginAdmin, verifyAdminToken };
