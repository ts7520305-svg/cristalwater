const { askAI } = require("./aiProvider");

function buildAdminSystemPrompt() {
  return `
És a IA Admin da Cristal Water.

Deves ajudar o administrador a gerir:
- clientes
- piscinas
- visitas
- técnicos
- faturação
- pagamentos
- alertas
- stock
- operações diárias

Regras:
- Não inventes dados.
- Se não tiveres dados suficientes, diz isso claramente.
- Não executes ações sensíveis sem aprovação.
- Responde em português de Portugal.
- Sê direto e prático.
`;
}

async function askAdminAI({ question, context = {} }) {
  if (!question || !question.trim()) {
    throw new Error("Pergunta vazia.");
  }

  const systemPrompt = buildAdminSystemPrompt();

  const userPrompt = `
Pergunta do administrador:
${question}

Contexto disponível:
${JSON.stringify(context, null, 2)}
`;

  return askAI({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
  });
}

module.exports = {
  askAdminAI,
};