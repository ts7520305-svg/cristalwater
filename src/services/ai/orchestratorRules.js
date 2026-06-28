function detectAgent(question = "") {
  const q = question.toLowerCase();

  if (
    q.includes("ph") ||
    q.includes("cloro") ||
    q.includes("sal") ||
    q.includes("orp") ||
    q.includes("alga") ||
    q.includes("verde") ||
    q.includes("química")
  ) {
    return "chemistry";
  }

  if (
    q.includes("stock") ||
    q.includes("produto") ||
    q.includes("peça") ||
    q.includes("material") ||
    q.includes("hipoclorito")
  ) {
    return "stock";
  }

  if (
    q.includes("pagamento") ||
    q.includes("fatura") ||
    q.includes("dívida") ||
    q.includes("financeiro")
  ) {
    return "finance";
  }

  if (
    q.includes("rota") ||
    q.includes("ronda") ||
    q.includes("gps") ||
    q.includes("visita")
  ) {
    return "route";
  }

  if (
    q.includes("bomba") ||
    q.includes("filtro") ||
    q.includes("técnico") ||
    q.includes("piscina")
  ) {
    return "technician";
  }

  return "admin";
}

module.exports = {
  detectAgent,
};
