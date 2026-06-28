// ==========================================
// CRISTAL WATER - EMAIL LOG SERVICE
// ==========================================

const { prisma } = require("../prismaClient");

async function logEmail({
  to,
  subject,
  eventType,
  mode,
  status,
  error = null,
}) {
  try {
    await prisma.emailLog.create({
      data: {
        to,
        subject,
        eventType,
        mode,
        status,
        error,
      },
    });
  } catch (err) {
    console.error("[EMAIL LOG] Erro ao gravar log:", err.message);
  }
}

module.exports = {
  logEmail,
};