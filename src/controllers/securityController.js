const bcrypt = require("bcrypt");
const { prisma } = require("../prismaClient");

function safeUser(user){ if(!user) return user; const { password, ...safe } = user; return safe; }

async function changePassword(req, res) {
  const userId = Number(req.params.id || req.body.userId);
  const { currentPassword, newPassword, force } = req.body || {};
  if (!userId || !newPassword || String(newPassword).length < 6) return res.status(400).json({ ok: false, error: "Utilizador e nova password (mín. 6) obrigatórios" });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ ok: false, error: "Utilizador não encontrado" });
  if (!force && currentPassword) {
    const ok = user.password?.startsWith("$2") ? await bcrypt.compare(currentPassword, user.password) : currentPassword === user.password;
    if (!ok) return res.status(403).json({ ok: false, error: "Password atual incorreta" });
  }
  const hashed = await bcrypt.hash(String(newPassword), 12);
  const updated = await prisma.user.update({ where: { id: userId }, data: { password: hashed, mustChangePassword: false, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null }});
  await prisma.userAuditLog.create({ data: { userId, actor: req.body?.actor || "admin", action: "PASSWORD_CHANGED", entity: "User", entityId: String(userId), ip: req.ip, userAgent: req.headers["user-agent"] || null }}).catch(()=>{});
  res.json({ ok: true, user: safeUser(updated) });
}

async function resetPassword(req, res) {
  req.body.force = true;
  return changePassword(req, res);
}

async function updateIdentity(req, res) {
  const id = Number(req.params.id);
  const data = req.body || {};
  const allowed = ["name","email","username","phone","role","pin","active","avatarUrl","mustChangePassword"];
  const update = {};
  for (const k of allowed) if (data[k] !== undefined) update[k] = data[k];
  const user = await prisma.user.update({ where: { id }, data: update });
  await prisma.userAuditLog.create({ data: { userId: id, actor: data.actor || "admin", action: "IDENTITY_UPDATED", entity: "User", entityId: String(id), metadata: update }}).catch(()=>{});
  res.json({ ok: true, user: safeUser(user) });
}

async function auditLogs(req, res) {
  const logs = await prisma.userAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: Number(req.query.take || 200) });
  res.json({ ok: true, logs });
}

async function securityStatus(req, res) {
  const [allUsers, locked, forced, logs] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
        lockedUntil: true,
        updatedAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }).catch(()=>0),
    prisma.user.count({ where: { mustChangePassword: true } }).catch(()=>0),
    prisma.userAuditLog.count().catch(()=>0)
  ]);

  const onlineUsers = global.__CRISTAL_WATER_ONLINE_USERS__ || new Map();
  const now = new Date();
  const users = allUsers.map((user) => {
    const presence = onlineUsers.get(user.id) || null;
    const online = Boolean(presence);
    return {
      ...user,
      online,
      lastSeen: presence?.lastSeen || null,
      onlineMinutes: presence?.lastSeen ? Math.max(0, Math.round((now.getTime() - new Date(presence.lastSeen).getTime()) / 60000)) : null,
      accompanimentState: user.active === false ? "INACTIVE" : presence ? "LIVE" : user.mustChangePassword || (user.lockedUntil && user.lockedUntil > now) ? "ATTENTION" : "IDLE",
    };
  });

  const onlineCount = users.filter((user) => user.online).length;
  const attentionCount = users.filter((user) => user.accompanimentState === "ATTENTION").length;
  res.json({
    ok: true,
    users: users.length,
    locked,
    mustChangePassword: forced,
    auditLogs: logs,
    onlineUsers: onlineCount,
    attentionUsers: attentionCount,
    usersDetail: users,
    bcrypt: true,
    approvalMode: process.env.AI_ADMIN_REQUIRE_APPROVAL !== "false"
  });
}

module.exports = { changePassword, resetPassword, updateIdentity, auditLogs, securityStatus };
