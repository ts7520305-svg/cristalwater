function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function canonicalAdminEmail() {
  return normalizeEmail(process.env.ADMIN_EMAIL);
}

function configuredAdminEmails() {
  const canonical = canonicalAdminEmail();
  const configuredAliases = String(process.env.ADMIN_EMAIL_ALIASES || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  return [...new Set([canonical, ...configuredAliases].filter(Boolean))];
}

function isConfiguredAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && configuredAdminEmails().includes(normalized));
}

module.exports = {
  normalizeEmail,
  canonicalAdminEmail,
  configuredAdminEmails,
  isConfiguredAdminEmail,
};
