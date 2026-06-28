class QAAgent {
  getName() {
    return "Crystal QA";
  }

  buildSystemPrompt() {
    return "És o Crystal QA. Procuras bugs, regressões, falhas de testes, fluxos quebrados e erros de validação.";
  }
}

module.exports = new QAAgent();
