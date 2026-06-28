function normalizeText(value = "") {
  return String(value).toLowerCase();
}

function hasCriticalWaterProblem(input = {}) {
  const text = normalizeText([
    input.problem,
    input.notes,
    input.description,
    input.status,
    input.action,
  ].filter(Boolean).join(" "));

  const keywords = [
    "verde",
    "turva",
    "alga",
    "algas",
    "choque",
    "floculante",
    "floculação",
    "cloro baixo",
    "sem cloro",
    "orp baixo",
    "água má",
    "agua ma",
    "água verde",
    "agua verde",
    "água turva",
    "agua turva"
  ];

  return keywords.some((word) => text.includes(word));
}

function getSuggestedFollowupDate(baseDate = new Date()) {
  const date = new Date(baseDate);
  const day = date.getDay();

  if (day === 5) {
    date.setDate(date.getDate() + 3);
  } else if (day === 6) {
    date.setDate(date.getDate() + 2);
  } else {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString();
}

function suggestFollowupVisit(input = {}) {
  const needed = hasCriticalWaterProblem(input);

  if (!needed) {
    return {
      needed: false,
      reason: "Sem sinais de problema crítico de água."
    };
  }

  return {
    needed: true,
    type: "POST_TREATMENT_CONTROL",
    title: "Visita de controlo pós-tratamento",
    suggestedDate: getSuggestedFollowupDate(input.date || new Date()),
    durationMinutes: 15,
    priority: "HIGH",
    reason: "Foi detetado problema de água verde/turva/alga ou tratamento químico forte.",
    instructions: [
      "Verificar se a água melhorou.",
      "Medir pH, cloro e ORP se disponível.",
      "Tirar fotografia antes/depois.",
      "Confirmar se é necessário reforçar tratamento.",
      "Registar técnico responsável pela visita de controlo."
    ]
  };
}

module.exports = {
  hasCriticalWaterProblem,
  suggestFollowupVisit
};
