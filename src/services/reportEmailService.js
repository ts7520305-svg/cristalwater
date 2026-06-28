// ==========================================
// CRISTAL WATER - REPORT EMAIL SERVICE
// ==========================================

const { prisma } = require("../prismaClient");
const { sendAlertEmail } = require("./emailService");

/**
 * Envia relatório mensal por email (se permitido)
 */
async function sendMonthlyReportEmails() {
  const rule = await prisma.notificationRule.findFirst({
    where: {
      eventType: "MONTHLY_REPORT",
      active: true,
      channels: { contains: "EMAIL" },
    },
  });

  if (!rule) {
    console.log("[EMAIL] Envio de relatórios DESATIVADO");
    return;
  }

  const month = new Date().toISOString().slice(0, 7);

  // ADMIN
  if (rule.roles.includes("ADMIN")) {
    const adminReport = await prisma.monthlyReport.findFirst({
      where: { month, type: "ADMIN" },
    });

    if (adminReport) {
      await sendAlertEmail({
        subject: `Relatório Mensal ADMIN - ${month}`,
        client: "Cristal Water",
        pool: "—",
        technician: "Sistema",
        date: new Date(),
        reason: "Relatório mensal",
        notes: JSON.stringify(adminReport.data, null, 2),
      });
    }
  }

  // CLIENTES
  if (rule.roles.includes("CLIENT")) {
    const clientReports = await prisma.monthlyReport.findMany({
      where: { month, type: "CLIENT" },
      include: { client: true },
    });

    for (const report of clientReports) {
      if (!report.client?.email) continue;

      await sendAlertEmail({
        to: report.client.email,
        subject: `Relatório Mensal - ${month}`,
        client: report.client.name,
        pool: "—",
        technician: "Cristal Water",
        date: new Date(),
        reason: "Relatório mensal",
        notes: JSON.stringify(report.data, null, 2),
      });
    }
  }

  console.log("[EMAIL] Relatórios mensais enviados");
}

module.exports = {
  sendMonthlyReportEmails,
};