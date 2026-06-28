const fetch = require("node-fetch");
const { getActionDefinitions } = require("./aiAdminActionService");

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    mode: { type: "string" },
    recommendations: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          risk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          payload: { type: "object", additionalProperties: true }
        },
        required: ["type", "title", "description", "risk", "payload"]
      }
    }
  },
  required: ["answer", "mode", "recommendations", "actions"]
};

async function generateAiAdminResponse({ message, context, history = [] }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const openAiEnabled = isOpenAiEnabled();
  if (!apiKey) return localOperationalResponse(message, context, "local_no_api_key");
  if (!openAiEnabled) return localOperationalResponse(message, context, "local_openai_disabled");

  try {
    const result = await callOpenAI({ apiKey, message, context, history });
    if (result && result.answer) return sanitizeResponse(result, "openai");
    return localOperationalResponse(message, context, "fallback_empty_model_response");
  } catch (err) {
    const fallback = localOperationalResponse(message, context, "fallback_openai_error");
    fallback.answer += `\n\nNota técnica: a resposta foi gerada em modo local porque a ligação à IA externa falhou (${err.message}).`;
    return fallback;
  }
}

function isOpenAiEnabled() {
  return ["true", "1", "yes"].includes(String(process.env.ENABLE_ADMIN_AI_OPENAI || "false").toLowerCase());
}

async function callOpenAI({ apiKey, message, context, history }) {
  const model = process.env.OPENAI_MODEL || "gpt-5.4";
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const system = buildSystemPrompt();
  const webEnabled = ["true", "1", "yes"].includes(String(process.env.ENABLE_ADMIN_AI_WEB || process.env.AI_ADMIN_WEB_ACCESS || "false").toLowerCase());
  const userPayload = {
    message,
    platformContext: context,
    recentHistory: history.slice(-8).map((m) => ({ role: m.role, content: m.content }))
  };

  const body = {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(userPayload) }] }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "cristal_ai_admin_response",
        strict: true,
        schema: RESPONSE_SCHEMA
      }
    }
  };

  if (webEnabled) {
    body.tools = [{ type: "web_search_preview" }];
  }

  const res = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    timeout: 45000
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message || data?.message || `HTTP ${res.status}`;
    throw new Error(detail);
  }

  const text = extractOutputText(data);
  if (!text) return null;
  return JSON.parse(text);
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  if (Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c.text === "string") parts.push(c.text);
          if (typeof c.output_text === "string") parts.push(c.output_text);
        }
      }
    }
    if (parts.length) return parts.join("\n");
  }
  const legacy = data.choices?.[0]?.message?.content;
  if (typeof legacy === "string") return legacy;
  return "";
}

function buildSystemPrompt() {
  return `És a IA operacional interna da Cristal Water. Só respondes a administradores.

Objetivo: ajudar a gerir uma empresa de manutenção de piscinas: rondas, técnicos, visitas, clientes, piscinas, alertas, reparações, cobranças, faturas internas, orçamentos, stock e comunicações.

Regras obrigatórias:
1. Nunca digas que executaste uma ação se apenas a propuseste.
2. Ações que alteram dados devem ser devolvidas em "actions" e ficam pendentes para aprovação do administrador.
3. Faturação fiscal portuguesa deve passar por software/integração certificada. Podes criar rascunhos internos, mas não deves declarar emissão fiscal certificada.
4. Sê prático: dá prioridades, riscos, recomendações e próximos passos.
5. Usa apenas tipos de ação permitidos.
6. Responde em português europeu.
7. Se a pergunta exigir informação externa atual, usa a web apenas quando a ferramenta estiver disponível. Quando usares web, separa claramente o que vem da plataforma e o que vem de fontes externas.
8. Nunca reveles passwords guardadas. Para fornecedores, orienta o administrador a usar o Supplier Hub para abrir portais e copiar credenciais.

Tipos de ação permitidos:
${JSON.stringify(getActionDefinitions(), null, 2)}

Devolve SEMPRE JSON válido no schema pedido.`;
}

function sanitizeResponse(result, mode) {
  const allowed = new Set(getActionDefinitions().map((a) => a.type));
  return {
    answer: String(result.answer || ""),
    mode: result.mode || mode,
    recommendations: Array.isArray(result.recommendations) ? result.recommendations.map(String).slice(0, 12) : [],
    actions: Array.isArray(result.actions)
      ? result.actions.filter((a) => allowed.has(String(a.type || "").toLowerCase())).slice(0, 8)
      : []
  };
}

function localOperationalResponse(message, context, mode = "local") {
  const text = String(message || "").toLowerCase();
  const counters = context?.counters || {};
  const recommendations = [];
  const actions = [];

  if (counters.overdueVisits > 0) {
    recommendations.push(`Existem ${counters.overdueVisits} visitas atrasadas. Prioridade: redistribuir ou reagendar antes de criar novas rondas.`);
  }
  if (counters.openAlerts > 0) {
    recommendations.push(`Existem ${counters.openAlerts} alertas técnicos abertos. Recomendo transformar os críticos em tarefas com responsável.`);
  }
  if (counters.pendingInvoices > 0) {
    recommendations.push(`Existem ${counters.pendingInvoices} documentos/cobranças pendentes. Recomendo rever clientes com maior valor em aberto.`);
  }
  if (counters.pendingAiActions > 0) {
    recommendations.push(`Existem ${counters.pendingAiActions} ações IA pendentes de aprovação.`);
  }
  if (!recommendations.length) {
    recommendations.push("Operação sem bloqueios críticos visíveis no resumo atual. O próximo ganho está na automação de rondas e lembretes preventivos.");
  }

  if (text.includes("ronda") || text.includes("rota")) {
    recommendations.push("Para evoluir rondas: adicionar peso por zona, tempo estimado, prioridade da piscina, histórico de atrasos e disponibilidade do técnico.");
    actions.push({
      type: "create_task",
      title: "Rever plano de rondas da semana",
      description: "Tarefa administrativa criada para validar equilíbrio das rondas, piscinas sem técnico e atrasos.",
      risk: "LOW",
      payload: { title: "Rever plano de rondas da semana", priority: "HIGH", description: "Validar visitas atrasadas, carga por técnico, piscinas sem ronda e otimização por zona." }
    });
  }

  if (text.includes("fatura") || text.includes("conta") || text.includes("cobran")) {
    recommendations.push("Para contas/faturas: a IA deve preparar rascunhos e mensagens; envio/validação final deve ficar com aprovação humana e integração fiscal certificada quando aplicável.");
  }

  if (text.includes("web") || text.includes("internet") || text.includes("pesquisa") || text.includes("fornecedor")) {
    recommendations.push("Para dados externos ou fornecedores: usa o modo web quando estiver configurado e guarda acessos no Supplier Hub com password cifrada, abertura direta do portal e cópia controlada pelo administrador.");
  }

  if (text.includes("técnico") || text.includes("tecnico") || text.includes("lembrete")) {
    actions.push({
      type: "create_notification",
      title: "Lembrete operacional para equipa técnica",
      description: "Notificação interna para reforçar prioridade definida pela administração.",
      risk: "LOW",
      payload: { role: "TECH", type: "AI_REMINDER", title: "Lembrete Cristal Water", message: "Verificar prioridades do dia, fotos before/after e alertas técnicos antes de concluir visitas." }
    });
  }

  return sanitizeResponse({
    answer: `Análise operacional em modo ${mode}: consigo ler o estado resumido da plataforma, identificar riscos e preparar ações para aprovação. Neste momento vejo ${counters.visitsToday || 0} visitas previstas hoje, ${counters.techniciansActive || 0} técnicos ativos, ${counters.openAlerts || 0} alertas abertos e ${counters.pendingInvoices || 0} cobranças/documentos pendentes.`,
    mode,
    recommendations,
    actions
  }, mode);
}

module.exports = { generateAiAdminResponse, RESPONSE_SCHEMA };
