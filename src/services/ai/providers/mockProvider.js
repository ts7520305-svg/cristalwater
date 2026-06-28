async function askMockAI({ systemPrompt = "", userPrompt = "" }) {
  return {
    provider: "mock",
    model: "cristalwater-mock-ai",
    text: `IA Cristal Water operacional em modo gratuito/mock.

Recebi a tua pergunta:
${userPrompt}

Este modo serve para testar o sistema sem gastar quota OpenAI.
Próximo passo: ligar Ollama/Gemini/OpenRouter.`,
    raw: null,
  };
}

module.exports = { askMockAI };
