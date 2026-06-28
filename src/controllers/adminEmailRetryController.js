// ==========================================
// CRISTAL WATER - ADMIN EMAIL RETRY CONTROLLER
// ==========================================

const prismaModule = require("../prismaClient");
const prisma = prismaModule.prisma;
const emailService = require("../services/emailService");

async function retryFailed(req, res) {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        ok: false,
        message: "ID inválido.",
      });
    }

    const emailLog = await prisma.emailLog.findUnique({
      where: { id },
    });

    if (!emailLog) {
      return res.status(404).json({
        ok: false,
        message: "EmailLog não encontrado.",
      });
    }

    if (emailLog.status !== "FAILED") {
      return res.status(400).json({
        ok: false,
        message: "Apenas emails com status FAILED podem ser reenviados.",
      });
    }

    try {
      // ENVIO REAL DO EMAIL
      await emailService.sendEmail({
        to: emailLog.to,
        subject: emailLog.subject,
        html: `<p>Reenvio automático do email.</p>`,
        text: `Reenvio automático do email.`,
      });

      const updated = await prisma.emailLog.update({
        where: { id },
        data: {
          status: "SENT",
          error: null,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
        },
      });

      return res.json({
        ok: true,
        message: "Email reenviado com sucesso.",
        emailLog: updated,
      });
    } catch (sendErr) {
      const updated = await prisma.emailLog.update({
        where: { id },
        data: {
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
          error: String(sendErr.message || sendErr),
        },
      });

      return res.status(500).json({
        ok: false,
        message: "Falha ao reenviar email.",
        error: updated.error,
      });
    }
  } catch (err) {
    console.error("Retry email error:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro interno no retry.",
    });
  }
}

module.exports = {
  retryFailed,
};