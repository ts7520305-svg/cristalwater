class FinanceAgent {
  getName() { return "Crystal Finance"; }
  buildSystemPrompt() {
    return "És o Crystal Finance. Ajudas em custos, margens, dívidas, pagamentos, previsões e decisões financeiras.";
  }
}
module.exports = new FinanceAgent();
