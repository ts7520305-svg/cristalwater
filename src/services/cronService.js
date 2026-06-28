const cron = require("node-cron");

// 🔹 Lembretes de pagamento
const { processPaymentReminders } = require("./paymentReminderService");

// 🔹 Alertas inteligentes de dívida
const { generateDebtAlerts } = require("./alertService");

// ==========================================
// START CRONS
// ==========================================

function startCrons() {
  console.log("[CRON] startCrons() iniciado");

  // ==========================================
  // 🔥 EXECUTAR AO ARRANCAR (PARA TESTES)
  // ==========================================

  (async () => {
    try {
      console.log("[CRON] Execução inicial...");

      await processPaymentReminders();
      await generateDebtAlerts();

      console.log("[CRON] Execução inicial concluída");
    } catch (err) {
      console.error("[CRON] Erro na execução inicial:", err);
    }
  })();

  // ==========================================
  // 🔁 CRON DIÁRIO — 09:00
  // ==========================================

  cron.schedule("0 9 * * *", async () => {
    try {
      console.log("[CRON] Execução diária iniciada...");

      await processPaymentReminders();
      await generateDebtAlerts();

      console.log("[CRON] Execução diária concluída");
    } catch (err) {
      console.error("[CRON] Erro no cron diário:", err);
    }
  });

  // ==========================================
  // 🔁 CRON RÁPIDO PARA TESTE (opcional)
  // corre a cada 2 minutos
  // ==========================================

  cron.schedule("*/2 * * * *", async () => {
    try {
      console.log("[CRON] Execução teste (2min)...");

      await generateDebtAlerts();

    } catch (err) {
      console.error("[CRON] Erro no cron de teste:", err);
    }
  });
}

module.exports = {
  startCrons,
};