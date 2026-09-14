const prismaModule = require("../prismaClient");
const { normalizeRole } = require("./roles");

const prisma = prismaModule.prisma || prismaModule;

function toEpochSeconds(dateValue) {
  if (!dateValue) return null;
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.floor(ts / 1000);
}

async function validateJwtPrincipal(decoded = {}) {
  const role = normalizeRole(decoded.role);
  if (decoded.principalType === 'ENV_ADMIN') {
    const { canonicalAdminEmail } = require('./adminIdentity');
    return {ok: role === 'ADMIN' && process.env.ALLOW_ENV_ADMIN_FALLBACK === 'true' && decoded.email === canonicalAdminEmail()};
  }
  if (decoded.principalType === 'USER') {
    const user = await prisma.user.findUnique({where:{id:Number(decoded.userId || decoded.id)},select:{id:true,email:true,role:true,active:true,passwordChangedAt:true}});
    if (!user || !user.active || normalizeRole(user.role) !== role) return {ok:false,reason:'user-invalid'};
    if (toEpochSeconds(user.passwordChangedAt) > Number(decoded.iat || 0)) return {ok:false,reason:'password-changed'};
    if (['TECHNICIAN','TEAM_LEADER'].includes(role) && decoded.technicianId) {
      const tech = await prisma.technician.findUnique({where:{id:Number(decoded.technicianId)},select:{email:true,active:true}});
      if (!tech || !tech.active || tech.email !== user.email) return {ok:false,reason:'technician-link-invalid'};
    }
    return {ok:true};
  }

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
        select: { id: true, active: true, role: true, passwordChangedAt: true },
      });
    } else if (email) {
      user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, active: true, role: true, passwordChangedAt: true },
      });
    }

    // If this is an ENV fallback admin (no DB row), keep backward compatibility.
    if (!user) return { ok: false, reason: "admin-missing" };
    if (normalizeRole(user.role) !== "ADMIN") return {ok:false,reason:"admin-role-changed"};
    if (user.active === false) return { ok: false, reason: "admin-inactive" };

    const iat = Number(decoded.iat || 0);
    const passwordChangedAt = toEpochSeconds(user.passwordChangedAt);
    if (iat > 0 && passwordChangedAt && passwordChangedAt > iat) {
      return { ok: false, reason: "admin-password-changed" };
    }

    return { ok: true };
  }

  if (role === "TECHNICIAN" || role === "TEAM_LEADER") {
    const technicianId = Number(decoded.technicianId || decoded.id || 0);
    if (!technicianId) return { ok: false, reason: "technician-subject-missing" };

    const tech = await prisma.technician.findUnique({
      where: { id: technicianId },
      select: { id: true, active: true, role: true },
    });

    if (role === "TEAM_LEADER" && normalizeRole(tech?.role) !== "TEAM_LEADER") return {ok:false,reason:"leader-role-changed"};
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

  return { ok: false, reason: "unknown-role" };
}

module.exports = {
  validateJwtPrincipal,
};