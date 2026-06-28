const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");

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
      prisma.clientMessage.groupBy({
        by: ["clientId"],
        where: adminUnreadMessageWhere(),
        _count: { _all: true },
        _max: { createdAt: true },
      }).catch(() => []),
      prisma.clientMessage.findMany({
        where: adminUnreadMessageWhere(),
        include: { client: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }).catch(() => []),
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

    return res.json({
      ok: true,
      notifications: [
        ...chatNotifications,
        ...data.map(n => ({
        id: n.id,
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
      }))
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

    const [notificationCount, messageCount] = await Promise.all([
      prisma.notification.count({
        where: { isRead: false }
      }),
      prisma.clientMessage.count({
        where: adminUnreadMessageWhere()
      }).catch(() => 0)
    ]);

    return res.json({
      ok: true,
      count: notificationCount + messageCount
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

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
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
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
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

    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true }
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
