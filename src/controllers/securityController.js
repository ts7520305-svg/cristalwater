const { FIXED_SETTINGS } = require('../services/systemSettingService');
const { prisma } = require("../prismaClient");

function safeUser(user){ if(!user) return user; const { password, ...safe } = user; return safe; }

async function updateIdentity(req, res) {
  const id = Number(req.params.id);
  const data = req.body || {};
  const allowed = ["name","email","username","phone","role","pin","active","avatarUrl","mustChangePassword"];
  const update = {};
  for (const k of allowed) if (data[k] !== undefined) update[k] = data[k];
  const user = await prisma.user.update({ where: { id }, data: update });
  await prisma.userAuditLog.create({ data: { userId: id, actor: `ADMIN:${req.user.id}`, action: "IDENTITY_UPDATED", entity: "User", entityId: String(id), metadata: update }}).catch(()=>{});
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
    approvalMode: FIXED_SETTINGS.AI_ADMIN_REQUIRE_APPROVAL === "true"
  });
}

module.exports = { updateIdentity, auditLogs, securityStatus };
