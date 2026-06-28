const { prisma } = require("../prismaClient");

function nowMonthRef() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function asNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} inválido.`);
  return n;
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

const ACTION_DEFINITIONS = {
  create_task: {
    label: "Criar tarefa interna",
    risk: "LOW",
    description: "Cria uma tarefa para técnico, cliente ou piscina.",
    required: ["title"],
    handler: createTask
  },
  create_notification: {
    label: "Criar notificação",
    risk: "LOW",
    description: "Cria uma notificação interna ou para cliente.",
    required: ["message"],
    handler: createNotification
  },
  create_technical_alert: {
    label: "Criar alerta técnico",
    risk: "MEDIUM",
    description: "Regista um alerta numa piscina.",
    required: ["poolId", "message"],
    handler: createTechnicalAlert
  },
  create_repair_quote: {
    label: "Criar orçamento/reparação",
    risk: "MEDIUM",
    description: "Cria uma reparação em estado QUOTED para aprovação posterior.",
    required: ["poolId", "problem"],
    handler: createRepairQuote
  },
  create_invoice_draft: {
    label: "Criar rascunho de conta/fatura interna",
    risk: "HIGH",
    description: "Cria documento interno. A emissão fiscal deve passar por software certificado/integração oficial.",
    required: ["clientId", "lines"],
    handler: createInvoiceDraft
  },
  send_invoice_chat: {
    label: "Enviar conta/fatura interna por chat",
    risk: "HIGH",
    description: "Envia ao portal/chat do cliente um documento interno já existente.",
    required: ["invoiceId"],
    handler: sendInvoiceChat
  },
  assign_visit_technician: {
    label: "Atribuir visita a técnico",
    risk: "HIGH",
    description: "Atualiza o técnico responsável por uma visita.",
    required: ["visitId", "technicianId"],
    handler: assignVisitTechnician
  },
  create_visit: {
    label: "Criar visita",
    risk: "MEDIUM",
    description: "Cria uma visita planeada.",
    required: ["clientId", "poolId"],
    handler: createVisit
  },
  create_round: {
    label: "Criar ronda",
    risk: "MEDIUM",
    description: "Cria uma ronda semanal ativa.",
    required: ["name", "dayOfWeek"],
    handler: createRound
  },
  assign_pool_to_round: {
    label: "Adicionar piscina à ronda",
    risk: "MEDIUM",
    description: "Liga uma piscina a uma ronda e define a ordem.",
    required: ["roundId", "poolId"],
    handler: assignPoolToRound
  }
};

function getActionDefinitions() {
  return Object.entries(ACTION_DEFINITIONS).map(([type, item]) => ({
    type,
    label: item.label,
    risk: item.risk,
    description: item.description,
    required: item.required
  }));
}

function normalizeAiAction(input = {}) {
  const type = cleanText(input.type).toLowerCase();
  const def = ACTION_DEFINITIONS[type];
  if (!def) return null;
  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  return {
    type,
    title: cleanText(input.title, def.label) || def.label,
    description: cleanText(input.description, def.description),
    risk: cleanText(input.risk, def.risk).toUpperCase(),
    payload
  };
}

async function storeAction({ threadId, action, admin }) {
  const normalized = normalizeAiAction(action);
  if (!normalized) return null;
  return prisma.aiAssistantAction.create({
    data: {
      threadId: threadId || null,
      type: normalized.type,
      title: normalized.title,
      description: normalized.description,
      risk: normalized.risk,
      status: "PENDING",
      payload: normalized.payload,
      createdByUserId: admin?.id || null
    }
  });
}

async function listActions({ status = "PENDING", take = 30 } = {}) {
  const where = status && status !== "ALL" ? { status } : {};
  return prisma.aiAssistantAction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(take) || 30, 100),
    include: { thread: true }
  });
}

async function rejectAction(id, admin, reason = "Rejeitado pelo administrador") {
  const actionId = asNumber(id, "actionId");
  return prisma.aiAssistantAction.update({
    where: { id: actionId },
    data: {
      status: "REJECTED",
      error: cleanText(reason, "Rejeitado"),
      approvedByUserId: admin?.id || null,
      approvedAt: new Date()
    }
  });
}

async function approveAndExecuteAction(id, admin) {
  const actionId = asNumber(id, "actionId");
  const action = await prisma.aiAssistantAction.findUnique({ where: { id: actionId } });
  if (!action) throw new Error("Ação IA não encontrada.");
  if (action.status !== "PENDING") throw new Error(`Ação já está em estado ${action.status}.`);

  const def = ACTION_DEFINITIONS[action.type];
  if (!def) throw new Error(`Tipo de ação não permitido: ${action.type}`);
  validatePayload(action.payload || {}, def.required || []);

  await prisma.aiAssistantAction.update({
    where: { id: actionId },
    data: {
      status: "APPROVED",
      approvedByUserId: admin?.id || null,
      approvedAt: new Date()
    }
  });

  try {
    const result = await def.handler(action.payload || {}, { admin, action });
    return await prisma.aiAssistantAction.update({
      where: { id: actionId },
      data: {
        status: "EXECUTED",
        result,
        executedAt: new Date(),
        error: null
      }
    });
  } catch (err) {
    await prisma.aiAssistantAction.update({
      where: { id: actionId },
      data: {
        status: "FAILED",
        error: err.message,
        executedAt: new Date()
      }
    });
    throw err;
  }
}

function validatePayload(payload, required) {
  for (const field of required) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      throw new Error(`Campo obrigatório em falta: ${field}`);
    }
  }
}

async function createTask(payload) {
  const task = await prisma.task.create({
    data: {
      title: cleanText(payload.title, "Tarefa criada por IA"),
      description: cleanText(payload.description || payload.notes),
      priority: cleanText(payload.priority, "NORMAL").toUpperCase(),
      status: cleanText(payload.status, "PENDENTE"),
      technicianId: payload.technicianId ? asNumber(payload.technicianId, "technicianId") : null,
      clientId: payload.clientId ? asNumber(payload.clientId, "clientId") : null,
      poolId: payload.poolId ? asNumber(payload.poolId, "poolId") : null
    }
  });
  return { taskId: task.id, status: task.status };
}

async function createNotification(payload) {
  const notification = await prisma.notification.create({
    data: {
      userId: payload.userId ? asNumber(payload.userId, "userId") : null,
      clientId: payload.clientId ? asNumber(payload.clientId, "clientId") : null,
      type: cleanText(payload.type, "AI"),
      eventType: cleanText(payload.eventType, "AI_ADMIN"),
      title: cleanText(payload.title, "Cristal AI"),
      message: cleanText(payload.message),
      role: payload.role ? cleanText(payload.role).toUpperCase() : null,
      severity: payload.severity ? cleanText(payload.severity).toUpperCase() : null,
      metadata: { source: "AI_ADMIN", payload }
    }
  });
  return { notificationId: notification.id };
}

async function createTechnicalAlert(payload) {
  const alert = await prisma.technicalAlert.create({
    data: {
      poolId: asNumber(payload.poolId, "poolId"),
      type: cleanText(payload.type, "AI_ALERT"),
      message: cleanText(payload.message),
      priority: cleanText(payload.priority, "NORMAL").toUpperCase(),
      status: "OPEN"
    }
  });
  return { alertId: alert.id };
}

async function createRepairQuote(payload) {
  const quantity = payload.quantity ? asNumber(payload.quantity, "quantity") : 1;
  const unitPrice = payload.unitPrice !== undefined ? Number(payload.unitPrice) : null;
  const totalPrice = unitPrice !== null && Number.isFinite(unitPrice) ? unitPrice * quantity : (payload.totalPrice ? Number(payload.totalPrice) : null);
  const repair = await prisma.repair.create({
    data: {
      poolId: asNumber(payload.poolId, "poolId"),
      problem: cleanText(payload.problem),
      quantity,
      unitPrice: unitPrice !== null && Number.isFinite(unitPrice) ? unitPrice : null,
      totalPrice: totalPrice !== null && Number.isFinite(totalPrice) ? totalPrice : null,
      priority: cleanText(payload.priority, "NORMAL").toUpperCase(),
      notes: cleanText(payload.notes || "Rascunho/orçamento criado por IA para validação administrativa."),
      status: cleanText(payload.status, "QUOTED").toUpperCase()
    }
  });
  return { repairId: repair.id, status: repair.status, totalPrice: repair.totalPrice };
}

async function createInvoiceDraft(payload) {
  const clientId = asNumber(payload.clientId, "clientId");
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!lines.length) throw new Error("A fatura/conta precisa de pelo menos uma linha.");

  const normalizedLines = lines.map((line) => {
    const quantity = Number(line.quantity || 1);
    const unitPrice = Number(line.unitPrice ?? line.price ?? 0);
    const total = Number(line.total ?? quantity * unitPrice);
    return {
      type: cleanText(line.type, "AI_DRAFT"),
      lineType: cleanText(line.lineType, "AI_DRAFT"),
      description: cleanText(line.description, "Linha criada por IA"),
      quantity,
      unitPrice,
      total,
      lineTotal: total,
      notes: cleanText(line.notes)
    };
  });

  const total = normalizedLines.reduce((sum, line) => sum + Number(line.total || 0), 0);
  const monthRef = cleanText(payload.monthRef, `AI-${nowMonthRef()}-${Date.now()}`);

  const invoice = await prisma.invoice.create({
    data: {
      clientId,
      monthRef,
      month: cleanText(payload.month, monthRef),
      year: payload.year ? Number(payload.year) : new Date().getFullYear(),
      amount: total,
      total,
      totalAmount: total,
      amountOpen: total,
      amountPaid: 0,
      status: "DRAFT",
      notes: cleanText(payload.notes || "Rascunho interno criado por IA. Validar antes de emissão fiscal ou envio."),
      requiresInvoice: Boolean(payload.requiresInvoice),
      lines: { create: normalizedLines }
    },
    include: { lines: true, client: true }
  });
  return { invoiceId: invoice.id, status: invoice.status, total: invoice.totalAmount || invoice.total };
}

async function sendInvoiceChat(payload) {
  const invoiceId = asNumber(payload.invoiceId, "invoiceId");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } });
  if (!invoice) throw new Error("Documento não encontrado.");

  const amount = Number(invoice.totalAmount || invoice.total || invoice.amount || 0).toFixed(2);
  const text = cleanText(payload.message, `💧 Cristal Water\n\nConta/documento interno ${invoice.monthRef || invoice.month || ""}\nValor: ${amount} €\n\nDocumento sujeito a validação administrativa.`);

  const chat = await prisma.chatMessage.create({
    data: {
      senderId: payload.senderId ? asNumber(payload.senderId, "senderId") : null,
      clientId: invoice.clientId,
      chatType: "CLIENT",
      text,
      message: text,
      messageType: "TEXT",
      isRead: false
    }
  });

  await prisma.notification.create({
    data: {
      clientId: invoice.clientId,
      type: "INVOICE",
      eventType: "AI_INVOICE_CHAT",
      title: "Conta enviada no portal",
      message: `Conta/documento ${invoice.monthRef || invoice.month || invoice.id} enviado pelo chat.`,
      metadata: { source: "AI_ADMIN", invoiceId }
    }
  });

  await prisma.communicationLog.create({
    data: {
      clientId: invoice.clientId,
      channel: "CLIENT_CHAT",
      message: text,
      referenceId: invoice.id
    }
  });

  return { chatMessageId: chat.id, clientId: invoice.clientId };
}

async function assignVisitTechnician(payload) {
  const visit = await prisma.serviceVisit.update({
    where: { id: asNumber(payload.visitId, "visitId") },
    data: {
      technicianId: asNumber(payload.technicianId, "technicianId"),
      status: payload.status ? cleanText(payload.status).toUpperCase() : undefined,
      internalNotes: payload.notes ? cleanText(payload.notes) : undefined
    }
  });
  return { visitId: visit.id, technicianId: visit.technicianId, status: visit.status };
}

async function createVisit(payload) {
  const plannedDate = payload.plannedDate ? new Date(payload.plannedDate) : new Date();
  const visit = await prisma.serviceVisit.create({
    data: {
      clientId: asNumber(payload.clientId, "clientId"),
      poolId: asNumber(payload.poolId, "poolId"),
      technicianId: payload.technicianId ? asNumber(payload.technicianId, "technicianId") : null,
      plannedDate,
      date: plannedDate,
      status: cleanText(payload.status, "PLANNED").toUpperCase(),
      notes: cleanText(payload.notes || "Visita criada por IA para validação operacional."),
      internalNotes: "Criada através da IA operacional Cristal Water."
    }
  });
  return { visitId: visit.id, status: visit.status, plannedDate: visit.plannedDate };
}

async function createRound(payload) {
  const round = await prisma.round.create({
    data: {
      name: cleanText(payload.name),
      dayOfWeek: asNumber(payload.dayOfWeek, "dayOfWeek"),
      active: payload.active === undefined ? true : Boolean(payload.active)
    }
  });
  return { roundId: round.id, name: round.name, dayOfWeek: round.dayOfWeek };
}

async function assignPoolToRound(payload) {
  const roundId = asNumber(payload.roundId, "roundId");
  const poolId = asNumber(payload.poolId, "poolId");
  const order = payload.order !== undefined ? asNumber(payload.order, "order") : 0;
  const existing = await prisma.roundPool.findFirst({ where: { roundId, poolId } });
  const record = existing
    ? await prisma.roundPool.update({ where: { id: existing.id }, data: { order } })
    : await prisma.roundPool.create({ data: { roundId, poolId, order } });
  return { roundPoolId: record.id, roundId: record.roundId, poolId: record.poolId, order: record.order };
}

module.exports = {
  ACTION_DEFINITIONS,
  getActionDefinitions,
  normalizeAiAction,
  storeAction,
  listActions,
  rejectAction,
  approveAndExecuteAction
};
