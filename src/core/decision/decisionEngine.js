function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(normalizeText(word)));
}

function classifyQuestion(question = "") {
  const text = normalizeText(question);

  if (includesAny(text, [
    "piscina",
    "agua verde",
    "agua turva",
    "alga",
    "cloro",
    "ph",
    "orp",
    "sal"
  ])) {
    return "POOL";
  }

  if (includesAny(text, [
    "cliente",
    "morada",
    "telefone",
    "email",
    "contacto"
  ])) {
    return "CLIENT";
  }

  if (includesAny(text, [
    "tecnico",
    "funcionario",
    "ferias",
    "baixa",
    "doenca",
    "doente",
    "ausente",
    "livro de ponto",
    "entrada",
    "saida",
    "horario"
  ])) {
    return "HR";
  }

  if (includesAny(text, [
    "stock",
    "produto",
    "produtos",
    "quimico",
    "quimicos",
    "hipoclorito",
    "floculante",
    "sal",
    "ph menos",
    "ph mais"
  ])) {
    return "STOCK";
  }

  if (includesAny(text, [
    "fatura",
    "faturas",
    "pagamento",
    "pagamentos",
    "receber",
    "divida",
    "dividas",
    "atraso",
    "atrasado",
    "dinheiro",
    "cobranca",
    "cobrar"
  ])) {
    return "FINANCE";
  }

  if (includesAny(text, [
    "rota",
    "rotas",
    "distancia",
    "km",
    "perto",
    "longe"
  ])) {
    return "ROUTE";
  }

  return "GENERAL";
}

function getIntentFromCategory(category, question = "") {
  const text = normalizeText(question);

  if (category === "POOL") {
    if (includesAny(text, ["verde", "turva", "alga"])) return "POOL_PROBLEM";
    return "POOL_STATUS";
  }

  if (category === "HR") {
    if (includesAny(text, ["ferias", "baixa", "doente", "doenca", "ausente"])) return "EMPLOYEE_AVAILABILITY";
    if (includesAny(text, ["livro de ponto", "entrada", "saida", "horario"])) return "TIME_CLOCK";
    return "HR_STATUS";
  }

  if (category === "FINANCE") {
    if (includesAny(text, ["receber", "divida", "atraso", "atrasado", "cobranca", "cobrar"])) return "ACCOUNTS_RECEIVABLE";
    return "FINANCE_STATUS";
  }

  if (category === "STOCK") {
    return "STOCK_STATUS";
  }

  if (category === "CLIENT") {
    return "CLIENT_PROFILE";
  }

  if (category === "ROUTE") {
    return "ROUTE_OPTIMIZATION";
  }

  return "GENERAL_HELP";
}

function getRequiredContexts(category, intent) {
  if (category === "POOL") {
    return ["client", "pool", "visits", "technicalHistory", "followup"];
  }

  if (category === "HR") {
    return ["employee", "timeClock", "availability", "routes"];
  }

  if (category === "FINANCE") {
    return ["clients", "invoices", "payments"];
  }

  if (category === "STOCK") {
    return ["products", "stock", "vehicles"];
  }

  if (category === "CLIENT") {
    return ["client", "pools", "invoices", "visits"];
  }

  if (category === "ROUTE") {
    return ["routes", "technicians", "pools", "availability"];
  }

  return ["business"];
}

function getRecommendedAgents(category) {
  const agents = {
    POOL: ["PoolAI", "ChemistryAI", "FollowupAI"],
    HR: ["WorkforceAI", "RouteAI"],
    FINANCE: ["FinanceAI"],
    STOCK: ["StockAI", "OperationsAI"],
    CLIENT: ["CustomerAI"],
    ROUTE: ["RouteAI", "WorkforceAI"],
    GENERAL: ["AdminAI"]
  };

  return agents[category] || agents.GENERAL;
}

function buildDecision(question) {
  const category = classifyQuestion(question);
  const intent = getIntentFromCategory(category, question);

  return {
    question,
    category,
    intent,
    requiredContexts: getRequiredContexts(category, intent),
    recommendedAgents: getRecommendedAgents(category),
    confidence: category === "GENERAL" ? 0.4 : 0.85,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  classifyQuestion,
  buildDecision
};
