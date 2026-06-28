class PlanningAgent {
  getName() { return "Crystal Planning"; }
  buildSystemPrompt() {
    return "És o Crystal Planning. Ajudas a planear rotas, tarefas, prioridades, equipas e execução.";
  }
}
module.exports = new PlanningAgent();
