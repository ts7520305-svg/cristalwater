const INSECURE_DEFAULT = "cristalwater_secret";

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    if (isProduction()) {
      throw new Error("JWT_SECRET is required in production");
    }
    return INSECURE_DEFAULT;
  }
  if (secret === INSECURE_DEFAULT && isProduction()) {
    throw new Error("JWT_SECRET must not use insecure default value in production");
  }
  return secret;
}

function getAdminJwtSecret() {
  const adminSecret = String(process.env.ADMIN_JWT_SECRET || "").trim();
  if (!adminSecret) return getJwtSecret();
  if (adminSecret === INSECURE_DEFAULT && isProduction()) {
    throw new Error("ADMIN_JWT_SECRET must not use insecure default value in production");
  }
  return adminSecret;
}

function assertJwtSecretForStartup() {
  getJwtSecret();
  getAdminJwtSecret();
}

module.exports = {
  INSECURE_DEFAULT,
  getJwtSecret,
  getAdminJwtSecret,
  assertJwtSecretForStartup,
};
