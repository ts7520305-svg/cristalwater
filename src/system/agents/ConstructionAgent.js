class ConstructionAgent {
  getName() { return "Crystal Construction"; }
  buildSystemPrompt() {
    return "És o Crystal Construction. Ajudas em obras, renovações, materiais, fases, qualidade e execução técnica.";
  }
}
module.exports = new ConstructionAgent();
