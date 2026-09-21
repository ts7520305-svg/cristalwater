const financial = require("../services/aiFinancialContextService");
const { FIXED_SETTINGS } = require('../services/systemSettingService');
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
  if (Object.keys(req.query).some(key => key !== "monthRef")) return res.status(400).json({ok:false,error:"Parâmetro de consulta inválido."});
  const context = await getOperationalContext({monthRef:financial.month(req.query.monthRef)});
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
    requireApproval: FIXED_SETTINGS.AI_ADMIN_REQUIRE_APPROVAL === "true",
    allowedActions: getActionDefinitions(),
    context,
    financialRecommendations: financial.recommendations(context.finance)
  });
}

async function chat(req, res) {
  const body = req.body;
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key=>!['message','threadId','monthRef','scope'].includes(key)) || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000) return res.status(400).json({ok:false,error:'Escreva uma mensagem válida, até 4000 caracteres.'});
  const message = body.message.trim(), monthRef = financial.month(body.monthRef), scope = body.scope === undefined ? 'operations' : body.scope;
  if (!['finance','operations'].includes(scope)) return res.status(400).json({ok:false,error:'Escolha uma área válida.'});
  let threadId = body.threadId ?? null;
  if (threadId !== null && (!Number.isSafeInteger(threadId) || threadId <= 0)) return res.status(400).json({ok:false,error:'Conversa inválida.'});

  let thread = null;
  if (threadId) {
    thread = await prisma.aiAssistantThread.findFirst({ where: { id:threadId, createdByUserId:adminId(req) } });
    if (!thread) return res.status(404).json({ok:false,error:"Conversa não encontrada nesta conta."});
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
    orderBy: { id: "desc" },
    take: 20
  });

  await prisma.aiAssistantMessage.create({
    data: {
      threadId,
      role: "user",
      content: message,
      metadata: { monthRef, scope },
      createdByUserId: adminId(req)
    }
  });

  const context = await getOperationalContext({monthRef});
  const samePeriodHistory = history.filter(row=>row.metadata?.monthRef===monthRef && row.metadata?.scope===scope).reverse();
  const ai = await generateAiAdminResponse({ message, context, history:samePeriodHistory, scope });

  await prisma.aiAssistantMessage.create({
    data: {
      threadId,
      role: "assistant",
      content: ai.answer,
      metadata: { recommendations: ai.recommendations, mode: ai.mode, monthRef, scope, financialGeneratedAt:context.finance.generatedAt },
      createdByUserId: null
    }
  });

  const storedActions = [];
  for (const action of scope === "finance" ? [] : ai.actions || []) {
    const created = await storeAction({ threadId, action, admin: req.aiAdmin });
    if (created) storedActions.push(created);
  }

  return res.json({
    ok: true,
    threadId,
    monthRef, scope, finance:context.finance,
    financialRecommendations:financial.recommendations(context.finance),
    answer: ai.answer,
    mode: ai.mode,
    recommendations: ai.recommendations || [],
    actions: storedActions
  });
}

async function threads(req, res) {
  const rows = await prisma.aiAssistantThread.findMany({
    where: {createdByUserId:adminId(req)},
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true, actions: true } } }
  });
  res.json({ ok: true, threads: rows });
}

async function threadDetail(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ok:false,error:"Conversa inválida."});
  const thread = await prisma.aiAssistantThread.findFirst({
    where: { id, createdByUserId:adminId(req) },
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
