const { askMockAI } = require("./providers/mockProvider");

function clean(value) {
  return String(value || "").replace(/"/g, "").trim();
}

function getProvider() {
  return clean(process.env.AI_PROVIDER || process.env.AI_DEFAULT || "mock").toLowerCase();
}

function getModel() {
  return clean(process.env.OPENAI_MODEL || process.env.DEFAULT_AI_MODEL || "gpt-4o-mini");
}

async function askOpenAI({ systemPrompt = "", userPrompt = "", temperature = 0.2 } = {}) {
  const apiKey = clean(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      input: [
        { role: "system", content: systemPrompt || "És a IA da Cristal Water." },
        { role: "user", content: userPrompt || "" },
      ],
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if(data.status && data.status !== 'completed')throw new Error('A resposta da IA não foi concluída. Tente novamente.');
  const parts=Array.isArray(data.output)?data.output.flatMap(item=>item.type==='message'&&Array.isArray(item.content)?item.content:[]):[];
  const refusal=parts.find(part=>part.type==='refusal');
  const text=(typeof data.output_text==='string'?data.output_text:parts.filter(part=>part.type==='output_text'&&typeof part.text==='string').map(part=>part.text).join('\n')).trim();
  if(refusal)throw new Error('A IA não pode responder a este pedido. Peça revisão humana.');
  if(!text)throw new Error('A IA não devolveu uma resposta de texto. Peça revisão humana.');
  return {
    provider: "openai",
    model: getModel(),
    text,
    raw: data,
  };
}

async function askAI(payload = {}) {
  const provider = getProvider();

  if (provider === "openai") {
    try {
      return await askOpenAI(payload);
    } catch (error) {
      return {
        provider: "mock",
        model: "cristalwater-mock-ai",
        text:
          "IA OpenAI indisponível. Sistema em fallback/mock.\n\n" +
          "Motivo: " +
          error.message,
        raw: {
          fallback: true,
          failedProvider: "openai",
          error: error.message,
        },
      };
    }
  }

  return askMockAI(payload);
}

module.exports = {
  askAI,
  askOpenAI,
};
