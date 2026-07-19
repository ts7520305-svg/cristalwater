const fetch = require("node-fetch");
const { prisma } = require("../prismaClient");
const RepairBusiness = require("../business/repair/RepairBusiness");

const DEFAULT_LIMIT = 12;

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function hasModel(modelName) {
  return Boolean(prisma && prisma[modelName]);
}

async function safeCount(modelName, where = {}) {
  try {
    if (!hasModel(modelName)) return 0;
    return await prisma[modelName].count({ where });
  } catch (err) {
    return 0;
  }
}

async function safeFindMany(modelName, args = {}) {
  try {
    if (!hasModel(modelName)) return [];
    return await prisma[modelName].findMany(args);
  } catch (err) {
    return [];
  }
}

async function safeAggregate(modelName, args = {}) {
  try {
    if (!hasModel(modelName)) return null;
    return await prisma[modelName].aggregate(args);
  } catch (err) {
    return null;
  }
}

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function buildOperationalSnapshot() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [
    clientsActive,
    poolsActive,
    techniciansActive,
    serviceVisitsToday,
    visitsToday,
    serviceVisitsPendingToday,
    visitsPendingToday,
    serviceVisitsDoneToday,
    visitsDoneToday,
    openAlerts,
    openTechnicalAlerts,
    openIncidents,
    criticalIncidents,
    pendingRepairs,
    unpaidInvoices,
    pendingActions
  ] = await Promise.all([
    safeCount("client", { active: true }),
    safeCount("pool", { active: true }),
    safeCount("technician", { active: true }),
    safeCount("serviceVisit", { OR: [{ date: { gte: todayStart, lte: todayEnd } }, { plannedDate: { gte: todayStart, lte: todayEnd } }] }),
    safeCount("visit", { plannedDate: { gte: todayStart, lte: todayEnd } }),
    safeCount("serviceVisit", { status: { in: ["PLANNED", "PENDING", "SCHEDULED", "ACEITE", "ACCEPTED"] }, OR: [{ date: { gte: todayStart, lte: todayEnd } }, { plannedDate: { gte: todayStart, lte: todayEnd } }] }),
    safeCount("visit", { status: { in: ["PLANNED", "PENDING", "SCHEDULED", "ACEITE", "ACCEPTED"] }, plannedDate: { gte: todayStart, lte: todayEnd } }),
    safeCount("serviceVisit", { status: { in: ["DONE", "COMPLETED", "CONCLUIDA", "CONCLUÍDA"] }, OR: [{ date: { gte: todayStart, lte: todayEnd } }, { plannedDate: { gte: todayStart, lte: todayEnd } }] }),
    safeCount("visit", { status: { in: ["DONE", "COMPLETED", "CONCLUIDA", "CONCLUÍDA"] }, plannedDate: { gte: todayStart, lte: todayEnd } }),
    safeCount("alert", { OR: [{ status: { in: ["OPEN", "PENDING"] } }, { active: true }] }),
    safeCount("technicalAlert", { status: { in: ["OPEN", "PENDING"] } }),
    safeCount("incident", { status: { in: ["OPEN", "PENDING", "IN_PROGRESS"] } }),
    safeCount("incident", { status: { in: ["OPEN", "PENDING", "IN_PROGRESS"] }, severity: { in: ["CRITICAL", "HIGH"] } }),
    safeCount("repair", { status: { in: ["PENDING", "QUOTED", "APPROVED"] } }),
    safeCount("invoice", { status: { in: ["PENDING", "OVERDUE", "UNPAID", "DRAFT"] } }),
    safeCount("aiOpsAction", { status: "PENDING_APPROVAL" })
  ]);

  const invoicesAgg = await safeAggregate("invoice", {
    where: { status: { in: ["PENDING", "OVERDUE", "UNPAID"] } },
    _sum: { amountOpen: true, totalAmount: true, total: true, amount: true }
  });

  const overdueServiceVisits = await safeFindMany("serviceVisit", {
    where: {
      OR: [{ plannedDate: { lt: now } }, { date: { lt: now } }],
      status: { notIn: ["DONE", "COMPLETED", "CANCELLED", "CANCELED", "CONCLUIDA", "CONCLUÍDA"] }
    },
    select: { id: true, status: true, plannedDate: true, date: true, technicianName: true, pool: { select: { name: true, address: true } }, client: { select: { name: true } } },
    orderBy: [{ plannedDate: "asc" }],
    take: DEFAULT_LIMIT
  });

  const overdueVisits = await safeFindMany("visit", {
    where: {
      plannedDate: { lt: now },
      status: { notIn: ["DONE", "COMPLETED", "CANCELLED", "CANCELED", "CONCLUIDA", "CONCLUÍDA"] }
    },
    select: { id: true, status: true, plannedDate: true, pool: { select: { name: true, address: true } }, client: { select: { name: true } }, technician: { select: { name: true } } },
    orderBy: [{ plannedDate: "asc" }],
    take: DEFAULT_LIMIT
  });

  const activeTechnicians = await safeFindMany("technician", {
    where: { active: true },
    select: { id: true, name: true, zone: true, latitude: true, longitude: true, vehicleId: true },
    orderBy: [{ name: "asc" }],
    take: 25
  });

  const topOpenInvoices = await safeFindMany("invoice", {
    where: { status: { in: ["PENDING", "OVERDUE", "UNPAID"] } },
    select: { id: true, status: true, amountOpen: true, totalAmount: true, total: true, dueDate: true, client: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: [{ dueDate: "asc" }, { id: "desc" }],
    take: DEFAULT_LIMIT
  });

  const totalOpenAmount = parseNumber(invoicesAgg?._sum?.amountOpen) || parseNumber(invoicesAgg?._sum?.totalAmount) || parseNumber(invoicesAgg?._sum?.total) || parseNumber(invoicesAgg?._sum?.amount);

  const snapshot = {
    generatedAt: now.toISOString(),
    counts: {
      clientsActive,
      poolsActive,
      techniciansActive,
      visitsToday: serviceVisitsToday + visitsToday,
      visitsPendingToday: serviceVisitsPendingToday + visitsPendingToday,
      visitsDoneToday: serviceVisitsDoneToday + visitsDoneToday,
      openAlerts: openAlerts + openTechnicalAlerts,
      openIncidents,
      criticalIncidents,
      pendingRepairs,
      unpaidInvoices,
      pendingAiActions: pendingActions
    },
    finance: {
      totalOpenAmount,
      topOpenInvoices
    },
    operations: {
      overdueVisits: [...overdueServiceVisits, ...overdueVisits].slice(0, DEFAULT_LIMIT),
      activeTechnicians
    }
  };

  return {
    snapshot,
    recommendations: buildRecommendations(snapshot),
    quickPrompts: buildQuickPrompts(snapshot)
  };
}

function buildRecommendations(snapshot) {
  const c = snapshot.counts || {};
  const recs = [];

  if (c.criticalIncidents > 0) {
    recs.push({
      priority: "CRITICAL",
      title: "Incidentes críticos abertos",
      text: `Existem ${c.criticalIncidents} incidentes críticos/altos. Rever antes de mexer nas rondas.`,
      action: "Abrir Incident Center",
      href: "/incident-center"
    });
  }

  if ((snapshot.operations?.overdueVisits || []).length > 0) {
    recs.push({
      priority: "HIGH",
      title: "Visitas atrasadas ou em risco",
      text: `${snapshot.operations.overdueVisits.length} visitas aparecem como atrasadas. Replanear ou pedir ajuda a outro técnico.`,
      action: "Abrir Rondas",
      href: "/admin-rounds"
    });
  }

  if (c.visitsPendingToday > 0) {
    recs.push({
      priority: "MEDIUM",
      title: "Ronda de hoje ainda por concluir",
      text: `${c.visitsPendingToday} visitas de hoje continuam pendentes. Acompanhar GPS e ETA.`,
      action: "Ver visitas",
      href: "/admin-visits-dashboard"
    });
  }

  if (c.unpaidInvoices > 0) {
    recs.push({
      priority: "MEDIUM",
      title: "Cobranças pendentes",
      text: `${c.unpaidInvoices} documentos financeiros estão pendentes. Criar lembretes e priorizar clientes recorrentes.`,
      action: "Abrir financeiro",
      href: "/billing"
    });
  }

  if (c.pendingRepairs > 0) {
    recs.push({
      priority: "MEDIUM",
      title: "Reparações/orçamentos por acompanhar",
      text: `${c.pendingRepairs} reparações estão pendentes, orçamentadas ou aprovadas.`,
      action: "Abrir reparações",
      href: "/admin-dashboard"
    });
  }

  if (c.pendingAiActions > 0) {
    recs.push({
      priority: "LOW",
      title: "Ações de IA aguardam aprovação",
      text: `${c.pendingAiActions} ações propostas pela IA aguardam validação humana.`,
      action: "Rever ações",
      href: "/admin-ai"
    });
  }

  if (recs.length === 0) {
    recs.push({
      priority: "LOW",
      title: "Operação sem bloqueios críticos detetados",
      text: "Usa a IA para planear rondas, rever cobranças e preparar tarefas preventivas.",
      action: "Fazer pergunta à IA",
      href: "/admin-ai"
    });
  }

  return recs;
}

function buildQuickPrompts(snapshot) {
  const c = snapshot.counts || {};
  return [
    "Resume o ponto da operação de hoje e diz-me o que devo resolver primeiro.",
    "Analisa as rondas de hoje e sugere onde posso poupar tempo ou combustível.",
    "Cria uma lista de lembretes para clientes com valores pendentes.",
    "Que técnicos parecem sobrecarregados ou com visitas em risco?",
    "Que reparações ou orçamentos devo acompanhar esta semana?",
    c.pendingAiActions > 0 ? "Mostra as ações de IA pendentes e quais são seguras para aprovar." : "Sugere 5 melhorias operacionais para esta semana."
  ];
}

function getUserIdFromReq(req) {
  return req.auth?.id || req.user?.id || req.admin?.id || null;
}

async function createConversation({ title, adminUserId }) {
  if (!hasModel("aiOpsConversation")) return null;
  return prisma.aiOpsConversation.create({
    data: {
      title: title || "Conversa IA Operacional",
      adminUserId: adminUserId || null
    }
  });
}

async function saveMessage({ conversationId, role, content, metadata }) {
  if (!hasModel("aiOpsMessage") || !conversationId) return null;
  return prisma.aiOpsMessage.create({
    data: {
      conversationId,
      role,
      content: String(content || ""),
      metadata: metadata || undefined
    }
  });
}

function buildSystemPrompt(snapshot) {
  return `És a IA Operacional interna da Cristal Water. Só ajudas administradores.\n\nContexto operacional atual em JSON:\n${JSON.stringify(snapshot, null, 2)}\n\nRegras obrigatórias:\n- Não inventes dados. Quando falta informação, pede o ID ou diz o que falta.\n- Ações que alterem dados, enviem mensagens, criem faturas/orçamentos ou alterem rondas têm sempre de ficar como proposta para aprovação humana.\n- Sê prático: prioridades, riscos, próximos passos e impacto operacional.\n- Não envies nada para clientes/técnicos sem aprovação explícita do administrador.\n- Responde em português de Portugal, tom profissional e direto.`;
}

async function callOpenAI({ message, snapshot }) {
  const provider = String(process.env.AI_PROVIDER || "local").toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (provider !== "openai" || !apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: buildSystemPrompt(snapshot) },
          { role: "user", content: String(message || "") }
        ],
        max_output_tokens: 1200
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `OpenAI ${response.status}: ${text.slice(0, 240)}` };
    }

    const data = await response.json();
    return {
      text: data.output_text || extractResponseText(data) || "A IA respondeu, mas não devolveu texto legível.",
      raw: data
    };
  } catch (err) {
    return { error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function extractResponseText(data) {
  try {
    const parts = [];
    for (const output of data.output || []) {
      for (const content of output.content || []) {
        if (content.type === "output_text" && content.text) parts.push(content.text);
        if (content.text && typeof content.text === "string") parts.push(content.text);
      }
    }
    return parts.join("\n").trim();
  } catch (err) {
    return "";
  }
}

function localAnswer(message, snapshot, recommendations) {
  const lower = String(message || "").toLowerCase();
  const c = snapshot.counts || {};
  const lines = [];

  lines.push("Estou ligado ao contexto operacional interno da Cristal Water.");
  lines.push("");
  lines.push(`Hoje: ${c.visitsToday || 0} visitas previstas, ${c.visitsPendingToday || 0} pendentes e ${c.visitsDoneToday || 0} concluídas.`);
  lines.push(`Alertas abertos: ${c.openAlerts || 0}. Incidentes abertos: ${c.openIncidents || 0}. Faturas/cobranças pendentes: ${c.unpaidInvoices || 0}.`);

  if (lower.includes("ronda") || lower.includes("rota")) {
    lines.push("");
    lines.push("Para rondas, eu começaria por: 1) visitas atrasadas, 2) técnicos com carga maior, 3) piscinas com prioridade alta, 4) proximidade geográfica, 5) clientes com restrições de acesso.");
  }

  if (lower.includes("fatura") || lower.includes("conta") || lower.includes("cobran")) {
    lines.push("");
    lines.push("Para financeiro, recomendo separar: valores vencidos, faturas em rascunho, clientes recorrentes em atraso e extras/reparações ainda por faturar.");
  }

  if (lower.includes("técnico") || lower.includes("tecnico")) {
    lines.push("");
    lines.push("Para técnicos, a IA deve dar recomendações curtas e acionáveis: próxima prioridade, material a levar, alerta do cliente, tempo estimado e motivo da alteração.");
  }

  lines.push("");
  lines.push("Prioridades que vejo agora:");
  recommendations.slice(0, 4).forEach((rec, index) => {
    lines.push(`${index + 1}. [${rec.priority}] ${rec.title} — ${rec.text}`);
  });

  lines.push("");
  lines.push("Quando pedires para criar, editar, enviar ou alterar algo, eu crio uma proposta de ação. Um administrador tem de aprovar antes de o sistema executar.");

  return lines.join("\n");
}

function inferActionProposals(message, snapshot) {
  const text = String(message || "").toLowerCase();
  const proposals = [];

  const wantsTask = /cria|criar|abre|abrir|adiciona|adicionar/.test(text) && /tarefa|lembrete|todo|to-do/.test(text);
  const wantsInvoice = /fatura|conta|cobrança|cobranca|mensalidade|pagamento/.test(text) && /cria|criar|gerar|enviar|preparar|faz|fazer/.test(text);
  const wantsQuote = /orçamento|orcamento|reparação|reparacao|quote|proposta/.test(text) && /cria|criar|gerar|enviar|preparar|faz|fazer/.test(text);
  const wantsTechMessage = /técnico|tecnico|equipa/.test(text) && /recomenda|avisa|enviar|manda|lembra/.test(text);
  const wantsRound = /ronda|rota|visita/.test(text) && /alterar|mudar|replanear|otimizar|optimizar|atribuir|adiar|avançar|avancar/.test(text);
  const wantsReminder = /lembrete|avisar|recordar|reminder/.test(text);

  if (wantsTask) {
    proposals.push({
      actionType: "CREATE_TASK",
      title: "Criar tarefa operacional",
      summary: "Cria uma tarefa interna com base no pedido feito no chat.",
      riskLevel: "LOW",
      payload: { title: message.slice(0, 120), description: message, priority: "NORMAL", status: "PENDENTE" }
    });
  }

  if (wantsInvoice) {
    proposals.push({
      actionType: "CREATE_INVOICE_DRAFT",
      title: "Preparar rascunho de fatura/conta",
      summary: "Prepara uma fatura em rascunho. Requer clientId e valor para executar automaticamente.",
      riskLevel: "HIGH",
      payload: { instructions: message, requiredFields: ["clientId", "amount"], allowExternalSend: false }
    });
  }

  if (wantsQuote) {
    proposals.push({
      actionType: "CREATE_REPAIR_QUOTE_DRAFT",
      title: "Preparar rascunho de orçamento/reparação",
      summary: "Cria uma proposta interna de orçamento ou reparação para validação.",
      riskLevel: "HIGH",
      payload: { instructions: message, requiredFields: ["poolId", "problem", "amount"], allowExternalSend: false }
    });
  }

  if (wantsTechMessage) {
    proposals.push({
      actionType: "CREATE_TECHNICIAN_RECOMMENDATION",
      title: "Preparar recomendação para técnico",
      summary: "Cria uma notificação interna com uma recomendação operacional para a equipa técnica.",
      riskLevel: "MEDIUM",
      payload: { message, channel: "INTERNAL", targetRole: "TECHNICIAN" }
    });
  }

  if (wantsRound) {
    proposals.push({
      actionType: "ROUND_REPLAN_SUGGESTION",
      title: "Gerar proposta de replaneamento de ronda",
      summary: "Gera uma proposta de alteração de ronda, mas não altera visitas sem aprovação e dados específicos.",
      riskLevel: "MEDIUM",
      payload: { instructions: message, overdueVisits: snapshot.operations?.overdueVisits?.slice(0, 5) || [] }
    });
  }

  if (wantsReminder && !wantsTask) {
    proposals.push({
      actionType: "CREATE_NOTIFICATION",
      title: "Criar lembrete interno",
      summary: "Cria uma notificação interna para a administração acompanhar o assunto.",
      riskLevel: "LOW",
      payload: { title: "Lembrete criado pela IA", message, role: "ADMIN", type: "AI_REMINDER" }
    });
  }

  return proposals;
}

async function persistActionProposals({ conversationId, messageId, proposals, createdByUserId }) {
  if (!hasModel("aiOpsAction")) return [];
  const created = [];
  for (const proposal of proposals) {
    const action = await prisma.aiOpsAction.create({
      data: {
        conversationId: conversationId || null,
        messageId: messageId || null,
        title: proposal.title,
        actionType: proposal.actionType,
        summary: proposal.summary || "",
        payload: proposal.payload || {},
        riskLevel: proposal.riskLevel || "MEDIUM",
        requiresApproval: true,
        status: "PENDING_APPROVAL",
        createdByUserId: createdByUserId || null
      }
    });
    created.push(action);
  }
  return created;
}

async function handleChat({ req, message, conversationId }) {
  const adminUserId = getUserIdFromReq(req);
  const { snapshot, recommendations, quickPrompts } = await buildOperationalSnapshot();

  let conversation = null;
  if (conversationId && hasModel("aiOpsConversation")) {
    conversation = await prisma.aiOpsConversation.findUnique({ where: { id: Number(conversationId) } });
  }
  if (!conversation) {
    conversation = await createConversation({ title: String(message || "").slice(0, 80) || "Conversa IA Operacional", adminUserId });
  }

  const userMessage = await saveMessage({ conversationId: conversation?.id, role: "USER", content: message, metadata: { source: "admin-ai" } });
  const openai = await callOpenAI({ message, snapshot });
  const answer = openai?.text || localAnswer(message, snapshot, recommendations);
  const finalAnswer = openai?.error ? `${answer}\n\nNota técnica: a ligação OpenAI falhou (${openai.error}). Usei o motor local de apoio operacional.` : answer;
  const assistantMessage = await saveMessage({ conversationId: conversation?.id, role: "ASSISTANT", content: finalAnswer, metadata: { provider: openai?.text ? "openai" : "local", openaiError: openai?.error || null } });

  const proposals = inferActionProposals(message, snapshot);
  const actions = await persistActionProposals({
    conversationId: conversation?.id,
    messageId: assistantMessage?.id || userMessage?.id || null,
    proposals,
    createdByUserId: adminUserId
  });

  return {
    ok: true,
    conversation,
    answer: finalAnswer,
    actions,
    snapshot,
    recommendations,
    quickPrompts
  };
}

async function listConversations() {
  if (!hasModel("aiOpsConversation")) return [];
  return prisma.aiOpsConversation.findMany({ orderBy: { updatedAt: "desc" }, take: 30 });
}

async function listActions({ status } = {}) {
  if (!hasModel("aiOpsAction")) return [];
  const where = status ? { status } : {};
  return prisma.aiOpsAction.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 50 });
}

async function approveAction({ actionId, approvedByUserId }) {
  if (!hasModel("aiOpsAction")) throw new Error("Modelo aiOpsAction indisponível. Corre prisma:push.");
  const action = await prisma.aiOpsAction.findUnique({ where: { id: Number(actionId) } });
  if (!action) throw new Error("Ação não encontrada.");
  if (action.status !== "PENDING_APPROVAL") throw new Error("Ação já não está pendente.");

  const result = await executeApprovedAction(action);

  return prisma.aiOpsAction.update({
    where: { id: action.id },
    data: {
      status: result.executed ? "APPROVED_EXECUTED" : "APPROVED_DRAFT_ONLY",
      approvedByUserId: approvedByUserId || null,
      executedAt: result.executed ? new Date() : null,
      result: result
    }
  });
}

async function rejectAction({ actionId, rejectedByUserId, reason }) {
  if (!hasModel("aiOpsAction")) throw new Error("Modelo aiOpsAction indisponível. Corre prisma:push.");
  return prisma.aiOpsAction.update({
    where: { id: Number(actionId) },
    data: {
      status: "REJECTED",
      rejectedByUserId: rejectedByUserId || null,
      rejectionReason: reason || null
    }
  });
}

async function executeApprovedAction(action) {
  const payload = action.payload || {};
  const type = action.actionType;

  if (type === "CREATE_TASK") {
    const task = await prisma.task.create({
      data: {
        title: String(payload.title || action.title || "Tarefa criada pela IA").slice(0, 180),
        description: payload.description || payload.instructions || action.summary || null,
        priority: payload.priority || "NORMAL",
        status: payload.status || "PENDENTE",
        technicianId: payload.technicianId ? Number(payload.technicianId) : null,
        clientId: payload.clientId ? Number(payload.clientId) : null,
        poolId: payload.poolId ? Number(payload.poolId) : null
      }
    });
    return { executed: true, type, createdTaskId: task.id };
  }

  if (type === "CREATE_NOTIFICATION" || type === "CREATE_TECHNICIAN_RECOMMENDATION") {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId ? Number(payload.userId) : null,
        clientId: payload.clientId ? Number(payload.clientId) : null,
        type: payload.type || "AI_OPS",
        eventType: type,
        title: payload.title || action.title,
        message: payload.message || payload.instructions || action.summary || action.title,
        role: payload.targetRole || payload.role || null,
        status: "PENDING",
        severity: action.riskLevel || "NORMAL",
        metadata: { aiActionId: action.id, payload }
      }
    });
    return { executed: true, type, createdNotificationId: notification.id };
  }

  if (type === "CREATE_INVOICE_DRAFT") {
    const clientId = payload.clientId ? Number(payload.clientId) : null;
    const amount = parseNumber(payload.amount, NaN);
    if (!clientId || !Number.isFinite(amount)) {
      return { executed: false, type, reason: "Faltam clientId e/ou amount. Ficou aprovado como rascunho de instruções." };
    }
    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        amount,
        total: amount,
        totalAmount: amount,
        amountOpen: amount,
        status: "DRAFT",
        notes: payload.instructions || "Rascunho criado pela IA Operacional"
      }
    });
    return { executed: true, type, createdInvoiceId: invoice.id, externalSend: false };
  }

  if (type === "CREATE_REPAIR_QUOTE_DRAFT") {
    const poolId = payload.poolId ? Number(payload.poolId) : null;
    if (!poolId) {
      return { executed: false, type, reason: "Falta poolId. Ficou aprovado como rascunho de orçamento." };
    }
    const result = await RepairBusiness.createRepairTicket(
      {
        poolId,
        problem: payload.problem || payload.instructions || "Orçamento/reparação criada pela IA",
        quantity: payload.quantity ? Number(payload.quantity) : 1,
        unitPrice: payload.amount ? Number(payload.amount) : null,
        totalPrice: payload.amount ? Number(payload.amount) : null,
        priority: payload.priority || "NORMAL",
        notes: payload.instructions || null,
        status: "QUOTED",
      },
      "ai-ops",
      null,
      {
        source: "ai-ops",
        context: { clientId: payload.clientId ? Number(payload.clientId) : null },
        createNotification: false,
      }
    );
    return { executed: true, type, createdRepairId: result.repair.id, externalSend: false };
  }

  if (type === "ROUND_REPLAN_SUGGESTION") {
    const task = await prisma.task.create({
      data: {
        title: "Rever replaneamento de ronda sugerido pela IA",
        description: JSON.stringify(payload, null, 2).slice(0, 4000),
        priority: "HIGH",
        status: "PENDENTE"
      }
    });
    return { executed: true, type, createdTaskId: task.id, note: "Foi criada uma tarefa de revisão. Nenhuma ronda foi alterada automaticamente." };
  }

  return { executed: false, type, reason: "Tipo de ação ainda não tem executor automático. Mantido como rascunho aprovado." };
}

module.exports = {
  buildOperationalSnapshot,
  handleChat,
  listConversations,
  listActions,
  approveAction,
  rejectAction
};
