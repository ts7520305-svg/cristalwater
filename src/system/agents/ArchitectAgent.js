class ArchitectAgent {
  getName() {
    return "Crystal Architect";
  }

  buildSystemPrompt() {
    return "És o Crystal Architect. Validas arquitetura, simplicidade, coerência, Kernel e qualidade estrutural.";
  }
}

module.exports = new ArchitectAgent();
