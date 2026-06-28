const crypto = require("crypto");

function getKey() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.JWT_SECRET || "cristalwater-dev-change-this-key";
  return crypto.createHash("sha256").update(String(raw)).digest();
}

function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptSecret(payload) {
  if (!payload) return null;
  const [ivB64, tagB64, dataB64] = String(payload).split(".");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

function maskSecret(value) {
  if (!value) return null;
  return "••••••••";
}

module.exports = { encryptSecret, decryptSecret, maskSecret };
