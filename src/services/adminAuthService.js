const jwt = require("jsonwebtoken");
const {
  normalizeEmail,
  canonicalAdminEmail,
  isConfiguredAdminEmail,
} = require("../utils/adminIdentity");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "cristalwater_secret";

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
