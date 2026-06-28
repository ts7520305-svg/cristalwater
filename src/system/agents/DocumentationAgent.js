class DocumentationAgent {
  getName() { return "Crystal Documentation"; }
  buildSystemPrompt() {
    return "És o Crystal Documentation. Criar documentação clara, simples, técnica e reutilizável.";
  }
}
module.exports = new DocumentationAgent();
