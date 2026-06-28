// ==========================================
// CRISTAL WATER - MONTHLY REPORT EMAIL SERVICE
// ==========================================

const { prisma } = require("../prismaClient");
const { sendAlertEmail } = require("./emailService");
const { logEmail } = require("./emailLogService");

/**
 * Envia relatórios mensais por email
 * Pode ser AUTOMATIC ou MANUAL
 */
async function sendMonthlyReports({ manual = false } = {}) {
  const rule = await prisma.notificationRule.findFirst({
    where: {
      eventType: "MONTHLY_REPORT",
      active: true,
      channels: { contains: "EMAIL" },
    },
  });

  if (!rule) {
    console.log("[EMAIL] MONTHLY_REPORT desativado");
    return { sent: 0 };
  }

  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, "0");
  const monthKey = `${year}-${month}`;

  const reports = await prisma.monthlyReport.findMany({
    where: {
      month: monthKey,
      type: "CLIENT",
    },
    include: { client: true },
  });

  let sent = 0;

  for (const report of reports) {
    if (!report.client?.email) continue;

    try {
      await sendAlertEmail({
        to: report.client.email,
        subject: `Relatório Mensal - ${monthKey}`,
        client: report.client.name,
        pool: "—",
        technician: "Cristal Water",
        date: new Date(),
        reason: manual ? "Envio manual" : "Envio automático",
        notes: JSON.stringify(report.data, null, 2),
      });

      await logEmail({
        to: report.client.email,
        subject: `Relatório Mensal - ${monthKey}`,
        eventType: "MONTHLY_REPORT",
        mode: manual ? "MANUAL" : "AUTOMATIC",
        status: "SENT",
      });

      sent++;
    } catch (err) {
      await logEmail({
        to: report.client.email,
        subject: `Relatório Mensal - ${monthKey}`,
        eventType: "MONTHLY_REPORT",
        mode: manual ? "MANUAL" : "AUTOMATIC",
        status: "FAILED",
        error: err.message,
      });
    }
  }

  return { sent };
}

module.exports = {
  sendMonthlyReports,
};