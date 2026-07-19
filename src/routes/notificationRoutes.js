const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const auth = require("../middlewares/authMiddleware");
const { roleMatches } = require("../utils/roles");

router.use(auth());

function roleOf(req) {
  return String(req.user?.role || "").trim().toUpperCase();
}

function canSeeFinancialNotification(notification = {}) {
  const isFinancial = [
    notification.type,
    notification.eventType,
    notification.title,
    notification.message,
  ].some((value) => /(PAYMENT|INVOICE|DEBT|BILL|FINANCE|FATUR|PAGAMENTO|DIVIDA|COBRANCA)/i.test(String(value || "")));
  return !isFinancial;
}

function userCanSeeNotification(req, notification = {}) {
  const role = roleOf(req);
  if (roleMatches(role, "ADMIN")) return true;

  if (roleMatches(role, "CLIENT")) {
    const authClientId = Number(req.user?.clientId || req.user?.id || 0);
    if (!authClientId) return false;
    if (Number(notification.clientId || 0) !== authClientId) return false;
    return roleMatches(notification.role, "CLIENT") || !notification.role;
  }

  if (roleMatches(role, "TECHNICIAN") || roleMatches(role, "TECH") || roleMatches(role, "TEAM_LEADER")) {
    if (!canSeeFinancialNotification(notification)) return false;
    if (roleMatches(notification.role, "ADMIN") || roleMatches(notification.role, "CLIENT")) return false;
    if (notification.userId && Number(notification.userId) !== Number(req.user?.id || 0)) return false;
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
        include: {
          client: true,
          user: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 50
      }),
      isAdmin ? prisma.clientMessage.groupBy({
        by: ["clientId"],
        where: adminUnreadMessageWhere(),
        _count: { _all: true },
        _max: { createdAt: true },
      }).catch(() => []) : Promise.resolve([]),
      isAdmin ? prisma.clientMessage.findMany({
        where: adminUnreadMessageWhere(),
        include: { client: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }).catch(() => []) : Promise.resolve([]),
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
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 80)
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

    const notifications = await prisma.notification.findMany({
      where: { isRead: false },
      include: { client: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 250,
    });

    const scopedUnread = notifications
      .map((n) => ({
        id: n.id,
        userId: n.userId || null,
        role: n.role,
        type: n.type,
        eventType: n.eventType,
        title: n.title,
        message: n.message,
        clientId: n.clientId || null,
        isRead: n.isRead,
      }))
      .filter((item) => userCanSeeNotification(req, item)).length;

    const messageCount = isAdmin
      ? await prisma.clientMessage.count({
        where: adminUnreadMessageWhere()
      }).catch(() => 0)
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

router.post("/read/:id", async (req, res) => {
  try {

    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "ID inválido"
      });
    }

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return res.status(404).json({ ok: false, error: "Notificação não encontrada" });
    }
    if (!userCanSeeNotification(req, notification)) {
      return res.status(403).json({ ok: false, error: "Sem permissão" });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() }
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("Erro marcar notificação:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao marcar como lida"
    });
  }
});

// Alias compatível com frontend: POST /api/notifications/:id/read
router.post("/:id/read", async (req, res) => {
  req.params.id = req.params.id;
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "ID inválido" });
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ ok: false, error: "Notificação não encontrada" });
    if (!userCanSeeNotification(req, notification)) return res.status(403).json({ ok: false, error: "Sem permissão" });
    await prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro marcar notificação:", err);
    return res.status(500).json({ ok: false, error: "Erro ao marcar como lida" });
  }
});

// ==========================================================
// MARCAR TODAS COMO LIDAS
// ==========================================================

router.post("/read-all", async (req, res) => {
  try {

    const role = roleOf(req);

    if (roleMatches(role, "ADMIN")) {
      await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true, readAt: new Date() }
      });

      return res.json({ ok: true });
    }

    const notifications = await prisma.notification.findMany({
      where: { isRead: false },
      select: {
        id: true,
        userId: true,
        clientId: true,
        role: true,
        type: true,
        eventType: true,
        title: true,
        message: true,
      },
      take: 500,
    });

    const ids = notifications.filter((item) => userCanSeeNotification(req, item)).map((item) => item.id);

    if (!ids.length) {
      return res.json({ ok: true });
    }

    await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: { isRead: true, readAt: new Date() }
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("Erro marcar todas:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao marcar todas"
    });
  }
});

module.exports = router;
