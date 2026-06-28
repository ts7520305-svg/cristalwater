const fetch = require("node-fetch");
const { prisma } = require("../prismaClient");
const logger = require("./loggerService");

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

function monthRef(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function getActor(reqUser = {}) {
  return {
    id: reqUser.id || reqUser.userId || null,
    email: reqUser.email || reqUser.username || null,
    role: reqUser.role || "ADMIN",
  };
}

async function safeCount(model, args = {}) {
  try {
    if (!prisma[model]) return 0;
    return await prisma[model].count(args);
  } catch (err) {
    logger.warn("ADMIN_AI_SAFE_COUNT_ERROR", { model, message: err.message });
    return 0;
  }
}

async function safeFindMany(model, args = {}) {
  try {
    if (!prisma[model]) return [];
    return await prisma[model].findMany(args);
  } catch (err) {
    logger.warn("ADMIN_AI_SAFE_FIND_ERROR", { model, message: err.message });
    return [];
  }
}

async function collectOperationalContext() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const currentMonth = monthRef();

  const [
    clientsTotal,
    clientsActive,
    poolsTotal,
    poolsActive,
    techniciansActive,
    roundsActive,
    visitsToday,
    legacyVisitsToday,
    openInvoices,
    openInvoiceRows,
    openNotifications,
    openTechnicalAlerts,
    openIncidents,
    pendingTasks,
    recentMessages,
  ] = await Promise.all([
    safeCount("client"),
    safeCount("client", { where: { active: true } }),
    safeCount("pool"),
    safeCount("pool", { where: { active: true } }),
    safeCount("technician", { where: { active: true } }),
    safeCount("round", { where: { active: true } }),
    safeFindMany("serviceVisit", {
      where: { OR: [{ date: { gte: todayStart, lte: todayEnd } }, { plannedDate: { gte: todayStart, lte: todayEnd } }] },
      include: { client: true, pool: true, technician: true },
      orderBy: { date: "asc" },
      take: 250,
    }),
    safeFindMany("visit", {
      where: { plannedDate: { gte: todayStart, lte: todayEnd } },
      include: { client: true, pool: true, technician: true },
      orderBy: { plannedDate: "asc" },
      take: 250,
    }),
    safeCount("invoice", { where: { OR: [{ status: { notIn: ["PAID", "PAGA", "PAGO"] } }, { amountOpen: { gt: 0 } }] } }),
    safeFindMany("invoice", {
      where: { OR: [{ status: { notIn: ["PAID", "PAGA", "PAGO"] } }, { amountOpen: { gt: 0 } }] },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    safeCount("notification", { where: { isRead: false } }),
    safeCount("technicalAlert", { where: { status: { notIn: ["DONE", "RESOLVED", "FECHADO"] } } }),
    safeCount("incident", { where: { status: { notIn: ["RESOLVED", "CLOSED", "FECHADO"] } } }),
    safeCount("task", { where: { status: { notIn: ["DONE", "CONCLUIDA", "CONCLUÍDA", "CLOSED"] } } }),
    safeFindMany("chatMessage", { orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const allVisitsToday = [...visitsToday, ...legacyVisitsToday];
  const visitsByStatus = allVisitsToday.reduce((acc, visit) => {
    const status = safeText(visit.status, "UNKNOWN").toUpperCase();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const visitsWithoutTechnician = allVisitsToday.filter((v) => !v.technicianId).length;
  const doneToday = Object.entries(visitsByStatus).reduce((sum, [status, count]) => {
    return status.includes("DONE") || status.includes("CONCLU") ? sum + count : sum;
  }, 0);
  const plannedToday = Object.entries(visitsByStatus).reduce((sum, [status, count]) => {
    return status.includes("PLANNED") || status.includes("PENDING") || status.includes("AGEND") ? sum + count : sum;
  }, 0);

  const zoneLoad = {};
  for (const visit of allVisitsToday) {
    const zone = visit.pool?.zone || visit.client?.zone || "Sem zona";
    zoneLoad[zone] = (zoneLoad[zone] || 0) + 1;
  }

  const techLoad = {};
  for (const visit of allVisitsToday) {
    const name = visit.technician?.name || visit.technicianName || (visit.technicianId ? `Técnico #${visit.technicianId}` : "Sem técnico");
    techLoad[name] = (techLoad[name] || 0) + 1;
  }

  const debtors = openInvoiceRows.map((invoice) => ({
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    clientName: invoice.client?.name || "Cliente",
    monthRef: invoice.monthRef || invoice.month || currentMonth,
    status: invoice.status,
    amountOpen: Number(invoice.amountOpen || invoice.totalAmount || invoice.total || invoice.amount || 0),
  }));

  const totalDebt = debtors.reduce((sum, item) => sum + Number(item.amountOpen || 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    currentMonth,
    company: {
      clientsTotal,
      clientsActive,
      poolsTotal,
      poolsActive,
      techniciansActive,
      roundsActive,
    },
    visitsToday: {
      total: allVisitsToday.length,
      done: doneToday,
      planned: plannedToday,
      withoutTechnician: visitsWithoutTechnician,
      byStatus: visitsByStatus,
      zoneLoad,
      techLoad,
    },
    risk: {
      openInvoices,
      totalDebt,
      openNotifications,
      openTechnicalAlerts,
      openIncidents,
      pendingTasks,
    },
    debtors,
    recentMessages: recentMessages.map((m) => ({
      id: m.id,
      clientId: m.clientId,
      chatType: m.chatType,
      text: safeText(m.text || m.message).slice(0, 240),
      createdAt: m.createdAt,
    })),
  };
}

function priorityScore(recommendation) {
  const p = safeText(recommendation.priority).toUpperCase();
  if (p === "CRITICAL") return 100;
  if (p === "HIGH") return 80;
  if (p === "MEDIUM") return 50;
  return 20;
}

function buildLocalRecommendations(context) {
  const recommendations = [];
  const visits = context.visitsToday || {};
  const risk = context.risk || {};

  if (visits.withoutTechnician > 0) {
    recommendations.push({
      category: "RONDAS",
      priority: "HIGH",
      title: "Visitas sem técnico atribuído",
      summary: `${visits.withoutTechnician} visita(s) de hoje não têm técnico definido.`,
      rationale: "Visitas sem dono aumentam risco de atraso, falhas e chamadas de clientes.",
      proposedAction: {
        type: "GENERATE_ROUND_PLAN",
        title: "Preparar redistribuição de visitas",
        payload: { scope: "TODAY", visitsWithoutTechnician: visits.withoutTechnician },
        riskLevel: "MEDIUM",
      },
    });
  }

  const overloadedTech = Object.entries(visits.techLoad || {})
    .filter(([name, total]) => name !== "Sem técnico" && total >= 10)
    .sort((a, b) => b[1] - a[1])[0];
  if (overloadedTech) {
    recommendations.push({
      category: "EQUIPA",
      priority: "HIGH",
      title: "Possível sobrecarga de técnico",
      summary: `${overloadedTech[0]} tem ${overloadedTech[1]} visitas hoje.`,
      rationale: "Sobrecarga aumenta atrasos, tempo de viagem e risco de serviço incompleto.",
      proposedAction: {
        type: "CREATE_NOTIFICATION",
        title: "Alertar administração sobre sobrecarga",
        payload: {
          role: "ADMIN",
          type: "AI_OVERLOAD",
          title: "Técnico possivelmente sobrecarregado",
          message: `${overloadedTech[0]} tem ${overloadedTech[1]} visitas hoje. Rever redistribuição.`,
          severity: "HIGH",
        },
        riskLevel: "LOW",
      },
    });
  }

  const criticalZone = Object.entries(visits.zoneLoad || {}).sort((a, b) => b[1] - a[1])[0];
  if (criticalZone && criticalZone[1] >= 8) {
    recommendations.push({
      category: "MAPA",
      priority: "MEDIUM",
      title: "Zona com muita carga operacional",
      summary: `${criticalZone[0]} concentra ${criticalZone[1]} visita(s) hoje.`,
      rationale: "Uma zona concentrada permite otimizar deslocações, mas também pode criar gargalo se houver avarias ou atrasos.",
      proposedAction: {
        type: "GENERATE_ROUND_PLAN",
        title: "Analisar zona crítica",
        payload: { zone: criticalZone[0], visits: criticalZone[1] },
        riskLevel: "LOW",
      },
    });
  }

  if (risk.openInvoices > 0) {
    recommendations.push({
      category: "FINANCEIRO",
      priority: risk.totalDebt >= 1000 ? "HIGH" : "MEDIUM",
      title: "Dívida e faturas pendentes",
      summary: `${risk.openInvoices} fatura(s) em aberto. Valor estimado: ${Number(risk.totalDebt || 0).toFixed(2)} €.`,
      rationale: "Cobrança atrasada reduz tesouraria e deve aparecer no centro operacional.",
      proposedAction: {
        type: "CREATE_NOTIFICATION",
        title: "Criar alerta interno de cobranças",
        payload: {
          role: "ADMIN",
          type: "AI_COLLECTION",
          title: "Cobranças pendentes",
          message: `${risk.openInvoices} fatura(s) em aberto. Rever cobrança no módulo financeiro.`,
          severity: risk.totalDebt >= 1000 ? "HIGH" : "MEDIUM",
        },
        riskLevel: "LOW",
      },
    });
  }

  if (risk.openTechnicalAlerts > 0) {
    recommendations.push({
      category: "TÉCNICO",
      priority: "HIGH",
      title: "Alertas técnicos abertos",
      summary: `${risk.openTechnicalAlerts} alerta(s) técnicos continuam por resolver.`,
      rationale: "Alertas técnicos repetidos podem virar reparações, reclamações ou custos ocultos.",
      proposedAction: {
        type: "CREATE_TASK",
        title: "Criar tarefa de revisão técnica",
        payload: {
          title: "Rever alertas técnicos abertos",
          description: `${risk.openTechnicalAlerts} alerta(s) técnicos por resolver. Priorizar avarias críticas e piscinas recorrentes.`,
          priority: "HIGH",
          status: "PENDENTE",
        },
        riskLevel: "LOW",
      },
    });
  }

  if (risk.openIncidents > 0) {
    recommendations.push({
      category: "INCIDENTES",
      priority: "CRITICAL",
      title: "Incidentes abertos exigem atenção",
      summary: `${risk.openIncidents} incidente(s) ainda estão abertos.`,
      rationale: "Incidentes devem ter dono, SLA e resolução documentada.",
      proposedAction: {
        type: "CREATE_NOTIFICATION",
        title: "Escalar incidentes abertos",
        payload: {
          role: "ADMIN",
          type: "AI_INCIDENT_ESCALATION",
          title: "Incidentes abertos",
          message: `${risk.openIncidents} incidente(s) aguardam resolução. Ver Incident Center.`,
          severity: "CRITICAL",
        },
        riskLevel: "MEDIUM",
      },
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      category: "OPERAÇÃO",
      priority: "LOW",
      title: "Operação aparentemente estável",
      summary: "Não foram detetados bloqueios críticos nos dados principais.",
      rationale: "Continuar a acompanhar rondas, cobranças, alertas e mensagens durante o dia.",
      proposedAction: null,
    });
  }

  return recommendations.sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 10);
}

function buildSystemPrompt(context) {
  return [
    "És a IA operacional interna da Cristal Water.",
    "Falas em português europeu, direto, prático e focado em operação real de manutenção de piscinas.",
    "Tens acesso apenas ao resumo operacional fornecido pela aplicação; não inventes dados.",
    "Podes recomendar ações, preparar rascunhos, explicar módulos, priorizar visitas, sugerir rondas, sugerir mensagens e alertas.",
    "Nunca digas que uma ação sensível foi executada se apenas foi proposta.",
    "Ações sensíveis como enviar faturas/orçamentos, apagar dados, alterar preços, mudar rondas ou contactar clientes devem exigir aprovação humana.",
    "Quando sugerires uma ação, indica risco, impacto e próximo passo.",
    "Resumo operacional atual em JSON:",
    JSON.stringify(context, null, 2).slice(0, 12000),
  ].join("\n");
}

function extractOpenAiText(json) {
  if (!json) return "";
  if (typeof json.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const chunks = [];
  for (const item of json.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

async function callOpenAi({ message, context, history = [] }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const enabled = String(process.env.ENABLE_ADMIN_AI_OPENAI || "false").toLowerCase() === "true";
  if (!enabled || !apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const body = {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: buildSystemPrompt(context) }] },
      ...history.slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: [{ type: "input_text", text: safeText(m.content).slice(0, 2000) }] })),
      { role: "user", content: [{ type: "input_text", text: message }] },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    timeout: Number(process.env.ADMIN_AI_TIMEOUT_MS || 30000),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const msg = json?.error?.message || `OpenAI HTTP ${response.status}`;
    throw new Error(msg);
  }
  return extractOpenAiText(json);
}

function fallbackReply(message, context, recommendations) {
  const lower = safeText(message).toLowerCase();
  const lines = [];
  lines.push("🧠 **Estado operacional Cristal Water**");
  lines.push(`Clientes ativos: ${context.company.clientsActive}/${context.company.clientsTotal}. Piscinas ativas: ${context.company.poolsActive}/${context.company.poolsTotal}. Técnicos ativos: ${context.company.techniciansActive}.`);
  lines.push(`Hoje: ${context.visitsToday.total} visita(s), ${context.visitsToday.done} concluída(s), ${context.visitsToday.withoutTechnician} sem técnico.`);
  lines.push(`Financeiro: ${context.risk.openInvoices} fatura(s) abertas, dívida estimada ${Number(context.risk.totalDebt || 0).toFixed(2)} €.`);

  if (lower.includes("ronda") || lower.includes("rota")) {
    lines.push("\n**Rondas:** recomendo rever visitas sem técnico, técnicos com carga alta e zonas concentradas antes de gerar a semana.");
  }
  if (lower.includes("fatura") || lower.includes("conta") || lower.includes("cobran")) {
    lines.push("\n**Financeiro:** posso preparar ações pendentes para criar alertas de cobrança ou rascunhos de fatura, mas o envio deve exigir aprovação humana.");
  }
  if (lower.includes("técnico") || lower.includes("tecnico")) {
    lines.push("\n**Técnicos:** posso criar recomendações internas, tarefas e lembretes para técnicos com base na carga e alertas.");
  }

  lines.push("\n**Prioridades sugeridas:**");
  for (const rec of recommendations.slice(0, 5)) {
    lines.push(`- ${rec.priority}: ${rec.title} — ${rec.summary}`);
  }
  lines.push("\nPosso também preparar uma ação pendente para aprovação, por exemplo: criar tarefa, criar alerta interno, preparar plano de ronda ou preparar lembrete para técnico.");
  return lines.join("\n");
}

function detectActionIntents(message, context) {
  const text = safeText(message).toLowerCase();
  const actions = [];

  if (text.includes("cria") && (text.includes("tarefa") || text.includes("lembrete"))) {
    actions.push({
      type: "CREATE_TASK",
      title: "Criar tarefa/lembrete operacional",
      description: "Ação proposta pela IA a partir do pedido do administrador.",
      riskLevel: "LOW",
      payload: {
        title: "Tarefa criada pela IA operacional",
        description: safeText(message).slice(0, 500),
        priority: text.includes("urgente") || text.includes("crítico") || text.includes("critico") ? "HIGH" : "NORMAL",
        status: "PENDENTE",
      },
    });
  }

  if (text.includes("alerta") || text.includes("notifica")) {
    actions.push({
      type: "CREATE_NOTIFICATION",
      title: "Criar alerta interno",
      description: "Notificação interna para administração, criada após aprovação.",
      riskLevel: "LOW",
      payload: {
        role: "ADMIN",
        type: "AI_MANUAL_ALERT",
        title: "Alerta sugerido pela IA",
        message: safeText(message).slice(0, 700),
        severity: text.includes("crítico") || text.includes("critico") ? "CRITICAL" : "MEDIUM",
      },
    });
  }

  if (text.includes("fatura") || text.includes("conta") || text.includes("orçamento") || text.includes("orcamento")) {
    actions.push({
      type: "PREPARE_FINANCIAL_DRAFT",
      title: "Preparar rascunho financeiro",
      description: "A IA pode preparar dados e checklist; emissão/envio final fica dependente de aprovação no módulo financeiro.",
      riskLevel: "HIGH",
      payload: {
        request: safeText(message).slice(0, 1000),
        openInvoices: context.risk.openInvoices,
        totalDebt: context.risk.totalDebt,
        note: "Não enviar automaticamente sem aprovação humana.",
      },
    });
  }

  if (text.includes("ronda") || text.includes("rota") || text.includes("redistrib")) {
    actions.push({
      type: "GENERATE_ROUND_PLAN",
      title: "Preparar plano de ronda/redistribuição",
      description: "Plano operacional proposto pela IA para posterior validação do administrador.",
      riskLevel: "MEDIUM",
      payload: {
        request: safeText(message).slice(0, 1000),
        visitsToday: context.visitsToday,
        note: "Aplicar alterações reais nas rondas só após validação.",
      },
    });
  }

  return actions.slice(0, 5);
}

async function createConversation({ title, actor }) {
  return prisma.aiConversation.create({
    data: {
      title: safeText(title, "Conversa IA").slice(0, 120) || "Conversa IA",
      scope: "ADMIN",
      status: "OPEN",
      createdById: actor.id,
      createdByEmail: actor.email,
    },
  });
}

async function getConversationHistory(conversationId) {
  if (!conversationId) return [];
  return safeFindMany("aiMessage", {
    where: { conversationId: Number(conversationId) },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
}

async function saveMessage({ conversationId, role, content, metadata }) {
  return prisma.aiMessage.create({
    data: {
      conversationId: conversationId ? Number(conversationId) : null,
      role,
      content: safeText(content),
      metadata: metadata || undefined,
    },
  });
}

async function savePendingActions({ conversationId, actions, actor }) {
  const created = [];
  for (const action of actions || []) {
    const row = await prisma.aiAction.create({
      data: {
        conversationId: conversationId ? Number(conversationId) : null,
        type: action.type,
        title: action.title || action.type,
        description: action.description || null,
        payload: action.payload || {},
        riskLevel: action.riskLevel || "MEDIUM",
        status: "PENDING_APPROVAL",
        requiresApproval: true,
        requestedBy: actor.email || actor.id ? String(actor.email || actor.id) : "admin",
      },
    });
    created.push(row);
  }
  return created;
}

async function getStatus() {
  const context = await collectOperationalContext();
  const recommendations = buildLocalRecommendations(context);
  const openActions = await safeCount("aiAction", { where: { status: "PENDING_APPROVAL" } });
  const openAiEnabled = String(process.env.ENABLE_ADMIN_AI_OPENAI || "false").toLowerCase() === "true" && Boolean(process.env.OPENAI_API_KEY);
  return {
    ok: true,
    mode: openAiEnabled ? "OPENAI" : "LOCAL_RULES",
    openAiEnabled,
    generatedAt: context.generatedAt,
    context,
    recommendations,
    openActions,
    safety: {
      adminOnly: true,
      approvalsRequired: true,
      destructiveActionsDisabled: true,
      autoSendInvoices: false,
      autoDeleteData: false,
    },
  };
}

async function chat({ message, conversationId, reqUser }) {
  const actor = getActor(reqUser);
  const content = safeText(message);
  if (!content) throw new Error("Mensagem vazia");

  let conversation = conversationId
    ? await prisma.aiConversation.findUnique({ where: { id: Number(conversationId) } })
    : null;

  if (!conversation) {
    conversation = await createConversation({ title: content.slice(0, 80), actor });
  }

  const context = await collectOperationalContext();
  const recommendations = buildLocalRecommendations(context);
  const history = await getConversationHistory(conversation.id);
  await saveMessage({ conversationId: conversation.id, role: "user", content, metadata: { actor } });

  let reply = null;
  let provider = "LOCAL_RULES";
  let aiError = null;

  try {
    const openAiReply = await callOpenAi({ message: content, context, history });
    if (openAiReply) {
      reply = openAiReply;
      provider = "OPENAI";
    }
  } catch (err) {
    aiError = err.message;
    logger.warn("ADMIN_AI_OPENAI_ERROR", { message: err.message });
  }

  if (!reply) {
    reply = fallbackReply(content, context, recommendations);
  }

  const assistantMessage = await saveMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: reply,
    metadata: { provider, aiError, recommendationsCount: recommendations.length },
  });

  const intentActions = detectActionIntents(content, context);
  const recommendationActions = recommendations
    .filter((rec) => rec.proposedAction && ["CRITICAL", "HIGH"].includes(String(rec.priority).toUpperCase()))
    .slice(0, 2)
    .map((rec) => ({
      ...rec.proposedAction,
      description: `${rec.title}: ${rec.rationale}`,
    }));

  const pendingActions = await savePendingActions({
    conversationId: conversation.id,
    actions: [...intentActions, ...recommendationActions].slice(0, 5),
    actor,
  });

  return {
    ok: true,
    provider,
    conversation,
    message: assistantMessage,
    reply,
    context,
    recommendations,
    pendingActions,
    aiError,
  };
}

async function listConversations() {
  return prisma.aiConversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      actions: { where: { status: "PENDING_APPROVAL" }, take: 5 },
    },
  });
}

async function getConversation(id) {
  return prisma.aiConversation.findUnique({
    where: { id: Number(id) },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      actions: { orderBy: { createdAt: "desc" } },
      recommendations: { orderBy: { createdAt: "desc" } },
    },
  });
}

async function listActions(status) {
  const where = status ? { status: String(status).toUpperCase() } : {};
  return prisma.aiAction.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
}

async function createManualAction({ body, reqUser }) {
  const actor = getActor(reqUser);
  const action = await prisma.aiAction.create({
    data: {
      conversationId: body.conversationId ? Number(body.conversationId) : null,
      type: safeText(body.type, "CREATE_TASK").toUpperCase(),
      title: safeText(body.title, "Ação IA"),
      description: body.description || null,
      payload: body.payload || {},
      riskLevel: safeText(body.riskLevel, "MEDIUM").toUpperCase(),
      status: "PENDING_APPROVAL",
      requiresApproval: body.requiresApproval !== false,
      requestedBy: actor.email || actor.id ? String(actor.email || actor.id) : "admin",
    },
  });
  return action;
}

async function approveAction({ id, reqUser }) {
  const actor = getActor(reqUser);
  return prisma.aiAction.update({
    where: { id: Number(id) },
    data: {
      status: "APPROVED",
      approvedBy: actor.email || actor.id ? String(actor.email || actor.id) : "admin",
      approvedAt: new Date(),
    },
  });
}

async function rejectAction({ id, reqUser, reason }) {
  const actor = getActor(reqUser);
  return prisma.aiAction.update({
    where: { id: Number(id) },
    data: {
      status: "REJECTED",
      approvedBy: actor.email || actor.id ? String(actor.email || actor.id) : "admin",
      approvedAt: new Date(),
      result: { rejected: true, reason: reason || "Rejeitado pelo administrador" },
    },
  });
}

async function executeApprovedAction({ id, reqUser }) {
  const action = await prisma.aiAction.findUnique({ where: { id: Number(id) } });
  if (!action) throw new Error("Ação não encontrada");
  if (action.status !== "APPROVED") throw new Error("Ação precisa de aprovação antes de executar");

  const payload = action.payload || {};
  let result = null;

  if (action.type === "CREATE_TASK") {
    result = await prisma.task.create({
      data: {
        title: safeText(payload.title, action.title).slice(0, 200),
        description: payload.description || action.description || null,
        priority: safeText(payload.priority, "NORMAL").toUpperCase(),
        status: payload.status || "PENDENTE",
        technicianId: payload.technicianId ? Number(payload.technicianId) : null,
        clientId: payload.clientId ? Number(payload.clientId) : null,
        poolId: payload.poolId ? Number(payload.poolId) : null,
      },
    });
  } else if (action.type === "CREATE_NOTIFICATION") {
    result = await prisma.notification.create({
      data: {
        userId: payload.userId ? Number(payload.userId) : null,
        clientId: payload.clientId ? Number(payload.clientId) : null,
        role: payload.role || "ADMIN",
        type: payload.type || "AI",
        eventType: payload.eventType || "AI_ACTION",
        title: payload.title || action.title,
        message: payload.message || action.description || action.title,
        severity: payload.severity || action.riskLevel || "MEDIUM",
        metadata: { aiActionId: action.id, payload },
        isRead: false,
      },
    });
  } else if (action.type === "PREPARE_FINANCIAL_DRAFT") {
    result = {
      prepared: true,
      message: "Rascunho financeiro preparado. Emissão/envio real deve ser feito no módulo de faturas após validação humana.",
      payload,
    };
  } else if (action.type === "GENERATE_ROUND_PLAN") {
    result = {
      prepared: true,
      message: "Plano de ronda preparado. Aplicação real deve ser feita no Gestor de Rondas após validação.",
      payload,
    };
  } else {
    result = {
      prepared: true,
      message: "Tipo de ação ainda não tem executor automático. Ficou registada como aprovada/preparada.",
      payload,
    };
  }

  const actor = getActor(reqUser);
  const updated = await prisma.aiAction.update({
    where: { id: action.id },
    data: {
      status: "EXECUTED",
      executedAt: new Date(),
      executedBy: actor.email || actor.id ? String(actor.email || actor.id) : "admin",
      result,
    },
  });

  if (global.io) global.io.emit("admin-ai-action-executed", { action: updated, result });
  return { action: updated, result };
}

module.exports = {
  collectOperationalContext,
  buildLocalRecommendations,
  getStatus,
  chat,
  listConversations,
  getConversation,
  listActions,
  createManualAction,
  approveAction,
  rejectAction,
  executeApprovedAction,
};
