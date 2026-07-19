const prismaModule = require("../prismaClient");

const prisma = prismaModule.prisma || prismaModule;

function toEpochSeconds(dateValue) {
  if (!dateValue) return null;
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.floor(ts / 1000);
}

async function validateJwtPrincipal(decoded = {}) {
  const role = String(decoded.role || "").toUpperCase().trim();

  if (role === "ADMIN") {
    const userId = Number(decoded.id || 0);
    const email = String(decoded.email || "").trim().toLowerCase();

    if (!userId && !email) {
      return { ok: false, reason: "admin-subject-missing" };
    }

    let user = null;
    if (userId > 0) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, active: true, passwordChangedAt: true },
      });
    } else if (email) {
      user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, active: true, passwordChangedAt: true },
      });
    }

    // If this is an ENV fallback admin (no DB row), keep backward compatibility.
    if (!user) return { ok: true, reason: "admin-env-fallback" };
    if (user.active === false) return { ok: false, reason: "admin-inactive" };

    const iat = Number(decoded.iat || 0);
    const passwordChangedAt = toEpochSeconds(user.passwordChangedAt);
    if (iat > 0 && passwordChangedAt && passwordChangedAt > iat) {
      return { ok: false, reason: "admin-password-changed" };
    }

    return { ok: true };
  }

  if (role === "TECHNICIAN" || role === "TECH") {
    const technicianId = Number(decoded.technicianId || decoded.id || 0);
    if (!technicianId) return { ok: false, reason: "technician-subject-missing" };

    const tech = await prisma.technician.findUnique({
      where: { id: technicianId },
      select: { id: true, active: true },
    });

    if (!tech) return { ok: false, reason: "technician-missing" };
    if (tech.active === false) return { ok: false, reason: "technician-inactive" };
    return { ok: true };
  }

  if (role === "CLIENT") {
    const clientId = Number(decoded.clientId || decoded.id || 0);
    if (!clientId) return { ok: false, reason: "client-subject-missing" };

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, active: true },
    });

    if (!client) return { ok: false, reason: "client-missing" };
    if (client.active === false) return { ok: false, reason: "client-inactive" };
    return { ok: true };
  }

  return { ok: true, reason: "role-not-managed" };
}

module.exports = {
  validateJwtPrincipal,
};