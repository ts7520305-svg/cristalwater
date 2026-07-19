const { prisma } = require("../prismaClient");

// ==========================================
// HELPERS
// ==========================================

function getMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function normalizePaymentStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function buildReminderText(clientName) {
  return `💧 Cristal Water

Olá${clientName ? ` ${clientName}` : ""},

Verificámos que o seu pagamento se encontra pendente.

Pedimos, por favor, que regularize a situação assim que possível.

Se já efetuou o pagamento, ignore esta mensagem.

Obrigado.`;
}

function shouldRemindClient(client) {
  const status = normalizePaymentStatus(client.paymentStatus);

  if (normalizePaymentStatus(client.status) === "PAUSED") return false;
  if (status === "PAID") return false;

  return ["PENDING", "PARTIAL", "OVERDUE", "UNPAID", ""].includes(status);
}

// ==========================================
// ENVIAR LEMBRETE MANUAL
// ==========================================

async function sendManualReminderForClient(clientId) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error("Cliente não encontrado");
  }

  if (!shouldRemindClient(client)) {
    return {
      ok: true,
      skipped: true,
      message: "Cliente sem pagamento pendente",
    };
  }

  const text = buildReminderText(client.name);
  const monthKey = getMonthKey();

  await prisma.chatMessage.create({
    data: {
      senderId: 1,
      receiverId: null,
      chatType: "CLIENT",
      clientId: client.id,
      text,
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      clientId: client.id,
      type: "PAYMENT_REMINDER",
      title: "Lembrete de pagamento enviado",
      message: `Cliente ${client.name} avisado manualmente sobre pagamento pendente.`,
      isRead: false,
    },
  });

  await prisma.client.update({
    where: { id: client.id },
    data: {
      lastReminderAt: new Date(),
      lastReminderMonth: monthKey,
    },
  });

  return {
    ok: true,
    skipped: false,
    message: "Lembrete enviado com sucesso",
  };
}

// ==========================================
// PROCESSAR LEMBRETES AUTOMÁTICOS
// ==========================================

async function processPaymentReminders() {
  const monthKey = getMonthKey();

  console.log("[CRON] Verificação de pagamentos iniciada...");
  console.log("[CRON] Política global de lembrete: PAYMENT_STATUS_PENDING");

  const clients = await prisma.client.findMany({
    include: {
      pools: true,
      chatMessages: true,
      visits: true,
    },
  });

  console.log(`[CRON] Clientes carregados para análise: ${clients.length}`);
  console.log(`[CRON] Clientes com telefone: ${clients.filter((c) => !!c.phone).length}`);
  console.log(`[CRON] Clientes com email: ${clients.filter((c) => !!c.email).length}`);
  console.log(
    `[CRON] Clientes com fatura obrigatória: ${clients.filter((c) => c.requiresInvoice).length}`
  );

  for (const client of clients) {
    if (client.lastReminderMonth === monthKey) continue;
    if (!shouldRemindClient(client)) continue;

    const text = buildReminderText(client.name);

    await prisma.chatMessage.create({
      data: {
        senderId: 1,
        receiverId: null,
        chatType: "CLIENT",
        clientId: client.id,
        text,
        isRead: false,
      },
    });

    await prisma.notification.create({
      data: {
        clientId: client.id,
        type: "REMINDER",
        title: "Lembrete de pagamento",
        message: text,
        isRead: false,
      },
    });

    await prisma.client.update({
      where: { id: client.id },
      data: {
        lastReminderAt: new Date(),
        lastReminderMonth: monthKey,
      },
    });

    console.log(`[CRON] Lembrete enviado a ${client.name}`);
  }
}

module.exports = {
  processPaymentReminders,
  sendManualReminderForClient,
};