const { prisma } = require("../prismaClient");

// ==========================================
// REGISTAR COMUNICAÇÃO
// ==========================================

async function logCommunication({
  clientId,
  channel,
  message,
  referenceId = null
}) {
  try {
    await prisma.communicationLog.create({
      data: {
        clientId,
        channel,
        message,
        referenceId
      }
    });
  } catch (err) {
    console.error("Erro a guardar comunicação:", err);
  }
}

module.exports = {
  logCommunication
};