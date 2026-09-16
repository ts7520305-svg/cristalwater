const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const { Prisma } = require("@prisma/client");
const {canSeeFinancialNotification,recipientUserId}=require('../services/notificationScopeService');
const {currentNotificationScope}=require('../services/currentNotificationScope');
const auth = require("../middlewares/authMiddleware");
const { roleMatches, normalizeRole } = require("../utils/roles");

router.use(auth());
router.use((req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });

function roleOf(req) {
  return String(req.user?.role || "").trim().toUpperCase();
}

function userCanSeeNotification(req, notification = {}) {
  const role = roleOf(req);
  if (roleMatches(role, "ADMIN")) return true;

  if (roleMatches(role, "CLIENT")) {
    const authClientId = Number(req.user?.clientId || req.user?.id || 0);
    if (!authClientId) return false;
    if (Number(notification.clientId || 0) !== authClientId) return false;
    return normalizeRole(notification.role) === "CLIENT";
  }

  if (roleMatches(role, "TECHNICIAN") || roleMatches(role, "TECH") || roleMatches(role, "TEAM_LEADER")) {
    if (!canSeeFinancialNotification(notification)) return false;
    if (!['TECHNICIAN','TEAM_LEADER'].includes(normalizeRole(notification.role))) return false;
    if (notification.metadata?.technicianId && Number(notification.metadata.technicianId) !== Number(req.user?.technicianId || req.user?.id)) return false;
    if (notification.userId && Number(notification.userId) !== recipientUserId(req.user)) return false;
    return true;
  }

  return false;
}

function adminUnreadMessageWhere() {
  return {
    isReadByAdmin: false,
    OR: [
      { senderType: "CLIENT" },
      { sender: "Cliente" },
    ],
  };
}

// ==========================================================
// LISTAR NOTIFICAÇÕES
// ==========================================================

router.get("/", async (req, res) => {
  try {

    const role = roleOf(req);
    const isAdmin = roleMatches(role, "ADMIN");

    const [data, unreadGroups, latestMessages] = await Promise.all([
      prisma.notification.findMany({
        where: await currentNotificationScope(req.user),
        include: {
          client: { select: { name: true } },
          user: { select: { name: true } }
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      isAdmin ? prisma.clientMessage.groupBy({
        by: ["clientId"],
        where: adminUnreadMessageWhere(),
        _count: { _all: true },
        _max: { createdAt: true },
      }) : Promise.resolve([]),
      isAdmin ? prisma.clientMessage.findMany({
        where: adminUnreadMessageWhere(),
        include: { client: { select: { name: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        distinct: ["clientId"],
      }) : Promise.resolve([]),
    ]);

    const latestByClient = new Map();
    for (const message of latestMessages) {
      if (!latestByClient.has(message.clientId)) latestByClient.set(message.clientId, message);
    }

    const chatNotifications = unreadGroups.map((group) => {
      const latest = latestByClient.get(group.clientId);
      const count = group._count?._all || 0;
      const clientName = latest?.client?.name || `Cliente ${group.clientId}`;
      return {
        id: `chat-${group.clientId}`,
        title: "Mensagem de cliente por responder",
        message: `${clientName}: ${latest?.message || latest?.text || `${count} mensagem(ns) por ler`}`,
        type: "CHAT_MESSAGE",
        eventType: "CLIENT_MESSAGE_UNREAD",
        role: "ADMIN",
        severity: "WARN",
        metadata: { href: `/chat?clientId=${group.clientId}&filter=unread`, unreadCount: count },
        createdAt: latest?.createdAt || group._max?.createdAt || new Date(),
        isRead: false,
        client: clientName,
        clientId: group.clientId,
        technician: "",
      };
    });

    const mapped = data.map(n => ({
      id: n.id,
      userId: n.userId || null,
      title: n.title,
      message: n.message,
      type: n.type,
      eventType: n.eventType,
      role: n.role,
      severity: n.severity,
      metadata: n.metadata,
      createdAt: n.createdAt,
      isRead: n.isRead ?? false,
      client: n.client?.name || "",
      clientId: n.clientId || null,
      technician: n.user?.name || ""
    }));

    const scopedNotifications = mapped.filter((item) => userCanSeeNotification(req, item));

    return res.json({
      ok: true,
      notifications: [
        ...(isAdmin ? chatNotifications : []),
        ...scopedNotifications
      ].sort((a, b) => notificationPriority(a) - notificationPriority(b) || Number(a.isRead) - Number(b.isRead) || new Date(b.createdAt) - new Date(a.createdAt))
    });

  } catch (err) {
    console.error("Erro listar notificações:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao listar notificações"
    });
  }
});

// ==========================================================
// CONTAR NÃO LIDAS
// ==========================================================

router.get("/unread-count", async (req, res) => {
  try {

    const role = roleOf(req);
    const isAdmin = roleMatches(role, "ADMIN");

    const scopedUnread=await prisma.notification.count({where:{...(await currentNotificationScope(req.user)),isRead:false}});

    const messageCount = isAdmin
      ? await prisma.clientMessage.count({
        where: adminUnreadMessageWhere()
      })
      : 0;

    return res.json({
      ok: true,
      count: scopedUnread + messageCount
    });

  } catch (err) {
    console.error("Erro contar notificações:", err);
    return res.status(500).json({
      ok: false,
      count: 0
    });
  }
});

// ==========================================================
// MARCAR UMA COMO LIDA
// ==========================================================

function notificationPriority(row) {
  if (['WATER_OPEN_CREATED', 'WATER_OPEN_OVERDUE', 'PUMP_MANUAL_CREATED', 'PUMP_MANUAL_OVERDUE'].includes(row.eventType)) return 0;
  return ['CRITICAL', 'ERROR'].includes(String(row.severity).toUpperCase()) ? 0 : 1;
}
function readError(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function validId(id) { return Number.isSafeInteger(id) && id > 0 && id <= 2147483647; }
async function markRead(req, res) {
  try {
    const single = req.params.id !== undefined;
    let ids;
    if (single) {
      if (!/^[1-9]\d*$/.test(req.params.id) || !validId(Number(req.params.id))) readError(400, 'ID inválido');
      ids = [Number(req.params.id)];
    } else if (req.body?.ids !== undefined) {
      ids = req.body.ids;
      if (!Array.isArray(ids) || ids.length > 20000 || ids.some(id => !validId(id)) || new Set(ids).size !== ids.length) readError(400, 'Lista de notificações inválida');
    }
    const scope = await currentNotificationScope(req.user);
    const receipt = await prisma.$transaction(async tx => {
      if (single) {
        const row = await tx.notification.findUnique({ where: { id: ids[0] } });
        if (!row) readError(404, 'Notificação não encontrada');
        if (!userCanSeeNotification(req, row)) readError(403, 'Sem permissão');
      }
      const selected = (await tx.notification.findMany({ where: { AND: [scope, ...(ids === undefined ? [] : [{ id: { in: ids } }])] }, orderBy: { id: 'asc' } })).filter(row => userCanSeeNotification(req, row));
      if (ids !== undefined && selected.length !== ids.length) readError(403, 'Notificação indisponível nesta sessão');
      const selectedIds = selected.map(row => row.id);
      if (selectedIds.length) {
        await tx.$queryRaw`SELECT id FROM "Notification" WHERE id IN (${Prisma.join(selectedIds)}) ORDER BY id FOR UPDATE`;
        const current = await tx.notification.count({ where: { AND: [scope, { id: { in: selectedIds } }] } });
        if (current !== selectedIds.length) readError(409, 'As notificações mudaram. Atualize a lista.');
        // A retry never replaces the first read time. Reading does not resolve
        // water, pump or other operational state. New arrivals are not in this set.
        await tx.notification.updateMany({ where: { id: { in: selectedIds }, isRead: false }, data: { isRead: true, readAt: new Date() } });
      }
      return { scope: 'NOTIFICATION_READ', ids: selectedIds, isRead: true };
    }, { maxWait: 10000, timeout: 15000 });
    return res.json({ ok: true, receipt });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : 'A leitura não foi confirmada. Tente novamente.' });
  }
}
router.post('/read/:id', markRead);
router.post('/:id/read', markRead);
router.post('/read-all', markRead);

module.exports = router;
