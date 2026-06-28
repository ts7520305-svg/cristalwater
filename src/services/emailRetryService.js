// ==========================================
// CRISTAL WATER - EMAIL RETRY SERVICE
// Reenvio manual de emails falhados
// ==========================================

const { prisma } = require("../prismaClient");
const { sendEmail } = require("./emailService");

/**
 * Reenvia TODOS os emails com status FAILED
 * Não cria novos registos, apenas atualiza os existentes
 */
async function retryFailedEmails() {
  const failedEmails = await prisma.emailLog.findMany({
    where: {
      status: "FAILED",
    },
  });

  let success = 0;
  let failed = 0;

  for (const log of failedEmails) {
    try {
      await sendEmail({
        to: log.to,
        subject: log.subject,
        html: log.html || null,
        text: log.text || null,
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: "SENT",
          error: null,
        },
      });

      success++;
    } catch (err) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          error: err.message,
        },
      });

      failed++;
    }
  }

  return {
    total: failedEmails.length,
    success,
    failed,
  };
}

module.exports = {
  retryFailedEmails,
};