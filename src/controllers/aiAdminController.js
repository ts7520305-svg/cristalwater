const { prisma } = require("../prismaClient");
const { getOperationalContext } = require("../services/aiAdminContextService");
const { generateAiAdminResponse } = require("../services/aiAdminLlmService");
const {
  storeAction,
  listActions,
  rejectAction,
  approveAndExecuteAction,
  getActionDefinitions
} = require("../services/aiAdminActionService");

function adminId(req) {
  return req.aiAdmin?.id || null;
}

async function status(req, res) {
  const context = await getOperationalContext();
  const externalAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const externalAiEnabled =
    externalAiConfigured &&
    ["true", "1", "yes"].includes(String(process.env.ENABLE_ADMIN_AI_OPENAI || "false").toLowerCase());
  const webAccessEnabled =
    externalAiEnabled &&
    ["true", "1", "yes"].includes(String(process.env.ENABLE_ADMIN_AI_WEB || process.env.AI_ADMIN_WEB_ACCESS || "false").toLowerCase());
  return res.json({
    ok: true,
    enabled: String(process.env.AI_ADMIN_ENABLED || "true").toLowerCase() !== "false",
    externalAiConfigured,
    externalAiEnabled,
    model: externalAiEnabled ? (process.env.OPENAI_MODEL || "gpt-5.4") : "local-rules",
    webAccess: {
      configured: externalAiConfigured,
      enabled: webAccessEnabled,
      provider: webAccessEnabled ? "OpenAI web search" : "disabled",
      note: webAccessEnabled
        ? "A IA pode consultar a web quando o administrador pedir."
        : externalAiConfigured && !externalAiEnabled
          ? "Chave OpenAI encontrada, mas o motor externo esta desligado. Ativar ENABLE_ADMIN_AI_OPENAI=true."
          : "Para ativar web: OPENAI_API_KEY + ENABLE_ADMIN_AI_OPENAI=true + ENABLE_ADMIN_AI_WEB=true."
    },
    requireApproval: String(process.env.AI_ADMIN_REQUIRE_APPROVAL || "true").toLowerCase() !== "false",
    allowedActions: getActionDefinitions(),
    context
  });
}

async function chat(req, res) {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ ok: false, error: "Mensagem obrigatória." });

  let threadId = req.body?.threadId ? Number(req.body.threadId) : null;
  if (threadId && !Number.isFinite(threadId)) threadId = null;

  let thread = null;
  if (threadId) {
    thread = await prisma.aiAssistantThread.findUnique({ where: { id: threadId } });
  }
  if (!thread) {
    thread = await prisma.aiAssistantThread.create({
      data: {
        title: message.slice(0, 80),
        createdByUserId: adminId(req)
      }
    });
    threadId = thread.id;
  }

  const history = await prisma.aiAssistantMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: 20
  });

  await prisma.aiAssistantMessage.create({
    data: {
      threadId,
      role: "user",
      content: message,
      createdByUserId: adminId(req)
    }
  });

  const context = await getOperationalContext();
  const ai = await generateAiAdminResponse({ message, context, history });

  await prisma.aiAssistantMessage.create({
    data: {
      threadId,
      role: "assistant",
      content: ai.answer,
      metadata: { recommendations: ai.recommendations, mode: ai.mode },
      createdByUserId: null
    }
  });

  const storedActions = [];
  for (const action of ai.actions || []) {
    const created = await storeAction({ threadId, action, admin: req.aiAdmin });
    if (created) storedActions.push(created);
  }

  return res.json({
    ok: true,
    threadId,
    answer: ai.answer,
    mode: ai.mode,
    recommendations: ai.recommendations || [],
    actions: storedActions
  });
}

async function threads(req, res) {
  const rows = await prisma.aiAssistantThread.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true, actions: true } } }
  });
  res.json({ ok: true, threads: rows });
}

async function threadDetail(req, res) {
  const id = Number(req.params.id);
  const thread = await prisma.aiAssistantThread.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } }, actions: { orderBy: { createdAt: "desc" } } }
  });
  if (!thread) return res.status(404).json({ ok: false, error: "Conversa não encontrada." });
  res.json({ ok: true, thread });
}

async function actions(req, res) {
  const rows = await listActions({ status: req.query.status || "PENDING", take: req.query.take || 50 });
  res.json({ ok: true, actions: rows });
}

async function approve(req, res) {
  const result = await approveAndExecuteAction(req.params.id, req.aiAdmin);
  res.json({ ok: true, action: result });
}

async function reject(req, res) {
  const result = await rejectAction(req.params.id, req.aiAdmin, req.body?.reason);
  res.json({ ok: true, action: result });
}

module.exports = { status, chat, threads, threadDetail, actions, approve, reject };
