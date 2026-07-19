const { prisma } = require("../prismaClient");

// ==========================================
// HELPERS
// ==========================================

function getMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function shouldSkipClient(client, monthKey) {
  if (!client) return true;
  if (client.status === "PAUSED") return true;
  if (client.lastReminderMonth === monthKey) return true;
  return false;
}

function buildReminderMessage(clientName, totalOpen) {
  return `💧 Cristal Water

Olá${clientName ? ` ${clientName}` : ""},

Verificámos que existe um valor em aberto no seu serviço de manutenção.

Valor em dívida: ${formatMoney(totalOpen)} €

Pedimos, por favor, que regularize o pagamento assim que possível.

Se já efetuou o pagamento, por favor ignore esta mensagem.

Obrigado.`;
}

// ==========================================
// PROCESSAR LEMBRETES
// ==========================================

async function processPaymentReminders() {
  const monthKey = getMonthKey();

  console.log("[CRON] Verificação de pagamentos iniciada...");
  console.log("[CRON] Política global de lembrete: OVERDUE_ONLY");

  const clients = await prisma.client.findMany({
    include: {
      invoices: true,
    },
  });

  console.log(`[CRON] Clientes carregados para análise: ${clients.length}`);
  console.log(
    `[CRON] Clientes com telefone: ${clients.filter(c => !!c.phone).length}`
  );
  console.log(
    `[CRON] Clientes com email: ${clients.filter(c => !!c.email).length}`
  );
  console.log(
    `[CRON] Clientes com fatura obrigatória: ${clients.filter(c => c.requiresInvoice).length}`
  );

  for (const client of clients) {
    if (shouldSkipClient(client, monthKey)) {
      continue;
    }

    const overdueInvoices = client.invoices.filter((inv) => {
      const open = Number(inv.amountOpen || 0);
      return open > 0 && ["PENDING", "PARTIAL", "OVERDUE"].includes(String(inv.status || ""));
    });

    if (!overdueInvoices.length) {
      continue;
    }

    const totalOpen = overdueInvoices.reduce(
      (sum, inv) => sum + Number(inv.amountOpen || 0),
      0
    );

    const text = buildReminderMessage(client.name, totalOpen);

    // Mensagem automática no chat do cliente
    await prisma.chatMessage.create({
      data: {
        senderId: 1,          // admin/sistema
        receiverId: null,     // canal cliente/admin sem utilizador destino fixo
        chatType: "CLIENT",
        clientId: client.id,
        text,
        messageType: "TEXT",
        isRead: false,
      },
    });

    // Notificação interna
    await prisma.notification.create({
      data: {
        clientId: client.id,
        type: "PAYMENT_REMINDER",
        title: "Lembrete de pagamento enviado",
        message: `Foi enviado um lembrete automático ao cliente ${client.name} no valor de ${formatMoney(totalOpen)} €.`,
        isRead: false,
      },
    });

    // Atualizar controlo do cliente
    await prisma.client.update({
      where: { id: client.id },
      data: {
        lastReminderAt: new Date(),
        lastReminderMonth: monthKey,
      },
    });

    console.log(
      `[CRON] Lembrete enviado ao cliente #${client.id} (${client.name}) - ${formatMoney(totalOpen)} €`
    );
  }
}

module.exports = {
  processPaymentReminders,
};