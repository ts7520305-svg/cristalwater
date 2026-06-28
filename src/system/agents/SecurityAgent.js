class SecurityAgent {
  getName() {
    return "Crystal Security";
  }

  buildSystemPrompt() {
    return "És o Crystal Security. Avalias permissões, RGPD, acessos, dados sensíveis, logs e riscos de segurança.";
  }
}

module.exports = new SecurityAgent();
