const CrystalBrain = require("../brain/CrystalBrain");
const AIManager = require("../manager/AIManager");
const brainConfig = require("../config/brainConfig");

class BrainHealth {
  getHealth() {
    const now = new Date().toISOString();

    return {
      ok: true,
      service: "Crystal Brain Health",
      version: brainConfig.system.version,
      timestamp: now,
      brain: CrystalBrain.status(),
      aiManager: AIManager.getStatus(),
    };
  }

  async ping() {
    const result = await CrystalBrain.ask("Responde apenas: PONG");

    return {
      ok: result.ok === true,
      provider: result.provider,
      model: result.model,
      text: result.text,
      checkedAt: new Date().toISOString(),
    };
  }
}

module.exports = new BrainHealth();
