const { askAI } = require("./aiProvider");
const { buildPrompt } = require("./agentRouter");
const { detectAgent } = require("./orchestratorRules");

async function askAdminAI({ question, context = {} }) {
  if (!question || !question.trim()) {
    throw new Error("Pergunta vazia.");
  }

  const agent = detectAgent(question);
  const userPrompt = buildPrompt(question, context);

  const result = await askAI({
    systemPrompt: "És o AI Orchestrator da Cristal Water.",
    userPrompt,
    temperature: 0.2,
  });

  return {
    ...result,
    agent,
  };
}

module.exports = {
  askAdminAI,
};
