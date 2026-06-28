const { prisma } = require("../prismaClient");

async function generateDebtAlerts() {
  try {
    console.log("[CRON] A gerar alertas de dívida...");

    if (!prisma || !prisma.client) {
      console.log("[CRON] prisma não inicializado corretamente — ignorado");
      return;
    }

    const clients = await prisma.client.findMany();

    console.log(`[CRON] Clientes encontrados: ${clients.length}`);

  } catch (err) {
    console.error("[CRON] ERRO controlado:", err.message);
  }
}

module.exports = {
  generateDebtAlerts
};