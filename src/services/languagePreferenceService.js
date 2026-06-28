const { prisma } = require("../prismaClient");
const { normalizeRole } = require("../utils/roles");

const SUPPORTED_LANGUAGES = new Set(["pt", "en", "fr", "de"]);

function normalizeLanguage(value) {
  const raw = String(value || "pt").trim().toLowerCase();
  if (["pt", "pt-pt", "portugues", "portuguese"].includes(raw)) return "pt";
  if (["en", "en-gb", "en-us", "ing", "ingles", "english"].includes(raw)) return "en";
  if (["fr", "fr-fr", "frances", "french"].includes(raw)) return "fr";
  if (["de", "de-de", "alemao", "alemão", "german", "deutsch"].includes(raw)) return "de";
  const short = raw.slice(0, 2);
  return SUPPORTED_LANGUAGES.has(short) ? short : "pt";
}

function identityFromPayload(payload = {}) {
  const type = String(payload.type || "").toUpperCase();
  const role = normalizeRole(payload.role || (type === "CLIENT" ? "CLIENT" : ""));
  const id = payload.id || payload.userId || payload.clientId || payload.technicianId || null;

  return {
    id: id ? Number(id) : null,
    email: payload.email || payload.username || null,
    role: role || (type === "CLIENT" ? "CLIENT" : "USER"),
  };
}

function keyForIdentity(identity = {}) {
  const role = normalizeRole(identity.role || "USER");
  if (identity.id) return `LANGUAGE:${role}:${identity.id}`;
  if (identity.email) return `LANGUAGE:${role}:${String(identity.email).toLowerCase()}`;
  return null;
}

async function getLanguageForIdentity(identity, fallback = "pt") {
  const key = keyForIdentity(identity);
  if (!key) return normalizeLanguage(fallback);

  const setting = await prisma.systemSetting.findUnique({ where: { key } }).catch(() => null);
  return normalizeLanguage(setting?.value || fallback);
}

async function setLanguageForIdentity(identity, language) {
  const key = keyForIdentity(identity);
  if (!key) throw new Error("Utilizador não identificado.");

  const normalized = normalizeLanguage(language);
  const setting = await prisma.systemSetting.upsert({
    where: { key },
    update: { value: normalized, notes: "Preferência de idioma do utilizador" },
    create: { key, value: normalized, notes: "Preferência de idioma do utilizador" },
  });

  return { language: normalized, key, setting };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  identityFromPayload,
  keyForIdentity,
  getLanguageForIdentity,
  setLanguageForIdentity,
};
