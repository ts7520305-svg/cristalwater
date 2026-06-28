const { prisma } = require("../prismaClient");

// ==========================================
// LISTAR NOTIFICAÇÕES
// ==========================================

async function listNotifications(req, res) {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      ok: true,
      notifications,
    });
  } catch (err) {
    console.error("ERRO NOTIFICATIONS listNotifications:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}

// ==========================================
// MARCAR UMA COMO LIDA
// ==========================================

async function markAsRead(req, res) {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        ok: false,
        error: "id inválido",
      });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json({
      ok: true,
      notification,
    });
  } catch (err) {
    console.error("ERRO NOTIFICATIONS markAsRead:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}

// ==========================================
// MARCAR TODAS COMO LIDAS
// ==========================================

async function markAllAsRead(req, res) {
  try {
    const result = await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    return res.json({
      ok: true,
      updated: result.count,
    });
  } catch (err) {
    console.error("ERRO NOTIFICATIONS markAllAsRead:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}

// ==========================================
// CONTAR NÃO LIDAS
// ==========================================

async function countUnreadNotifications(req, res) {
  try {
    const count = await prisma.notification.count({
      where: { isRead: false },
    });

    return res.json({
      ok: true,
      count,
    });
  } catch (err) {
    console.error("ERRO NOTIFICATIONS countUnreadNotifications:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}

module.exports = {
  listNotifications,
  markAsRead,
  markAllAsRead,
  countUnreadNotifications,
};