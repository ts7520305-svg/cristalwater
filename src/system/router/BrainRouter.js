class BrainRouter {
  detectIntent(question = "") {
    const q = String(question).toLowerCase();

    if (q.includes("erro") || q.includes("bug") || q.includes("falha")) return "qa";
    if (q.includes("segurança") || q.includes("permiss")) return "security";
    if (q.includes("arquitetura") || q.includes("kernel")) return "architect";
    if (q.includes("cliente")) return "customer";
    if (q.includes("obra") || q.includes("constru")) return "construction";
    if (q.includes("ph") || q.includes("cloro") || q.includes("água")) return "chemistry";

    return "general";
  }

  route(question = {}) {
    return {
      intent: this.detectIntent(question),
      routedAt: new Date().toISOString(),
    };
  }
}

module.exports = new BrainRouter();
