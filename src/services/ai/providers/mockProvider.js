async function askMockAI({ systemPrompt = "", userPrompt = "" }) {
  return {
    provider: "mock",
    model: "cristalwater-mock-ai",
    text: `Modo de demonstração — não foi gerada uma análise técnica por IA.

Recebi a tua pergunta:
${userPrompt}

Este modo serve para testar o sistema sem gastar quota OpenAI.
Próximo passo: ligar Ollama/Gemini/OpenRouter.`,
    raw: null,
  };
}

module.exports = { askMockAI };
