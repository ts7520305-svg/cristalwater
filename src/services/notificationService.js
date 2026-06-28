// ==========================================
// CRISTAL WATER - NOTIFICATION SERVICE
// src/services/notificationService.js
// ==========================================

const { prisma } = require("../prismaClient");
const { sendPush } = require("./pushService");

/**
 * Cria notificações internas e envia PUSH conforme regras
 */
async function createNotifications(eventType, title, message) {
  const rule = await prisma.notificationRule.findFirst({
    where: { eventType, active: true },
  });

  if (!rule) return;

  const roles = rule.roles.split(",");
  const channels = rule.channels.split(",");

  for (const role of roles) {
    // 1️⃣ Criar notificação interna (PENDING)
    const notification = await prisma.notification.create({
      data: {
        eventType,
        title,
        message,
        role,
        status: "PENDING",
      },
    });

    // 2️⃣ Enviar PUSH se configurado
    if (channels.includes("PUSH")) {
      const tokens = await prisma.deviceToken.findMany({
        where: { role, active: true },
      });

      for (const t of tokens) {
        try {
          await sendPush(
            t.token,
            title,
            message,
            { notificationId: String(notification.id) }
          );
        } catch (err) {
          console.error("Erro ao enviar push:", err.message);
        }
      }
    }
  }
}

module.exports = {
  createNotifications,
};