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

  return {
    provider: "openai",
    model: getModel(),
    text: data.output_text || "",
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
