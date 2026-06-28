const CrystalBrain = require("../brain/CrystalBrain");

class BrainQuality {
  async runSmokeTest() {
    const tests = [];

    const prompts = [
      "Responde apenas: QA OK",
      "Tenho um erro no sistema",
      "Avalia segurança de permissões",
      "Ajuda com pH e cloro",
      "Planeia uma rota de técnicos",
    ];

    for (const prompt of prompts) {
      const result = await CrystalBrain.ask(prompt);
      tests.push({
        prompt,
        ok: result.ok === true,
        provider: result.provider,
        intent: result.route.intent,
        agent: result.agent.name,
      });
    }

    return {
      ok: tests.every((t) => t.ok),
      service: "BrainQuality",
      tests,
      checkedAt: new Date().toISOString(),
    };
  }
}

module.exports = new BrainQuality();
