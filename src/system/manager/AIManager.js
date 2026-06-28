const brainConfig = require("../config/brainConfig");
const { getProvider, listProviders } = require("../providers/ProviderRegistry");

class AIManager {
  constructor() {
    this.config = brainConfig.ai;
    this.status = {
      initialized: true,
      fallbackEnabled: true,
      lastProvider: null,
      lastError: null,
      lastResponseAt: null,
      failures: [],
    };
  }

  getPriority() {
    const envPriority = process.env.AI_PROVIDER_PRIORITY;

    if (envPriority) {
      return envPriority.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
    }

    return this.config.providers || ["openrouter", "gemini", "openai", "ollama", "mock"];
  }

  async ask(payload = {}) {
    if (!payload.userPrompt || !String(payload.userPrompt).trim()) {
      throw new Error("AIManager: userPrompt vazio.");
    }

    const priority = this.getPriority();
    const failures = [];

    for (const providerName of priority) {
      const provider = getProvider(providerName);

      if (!provider.isAvailable()) {
        failures.push({ provider: providerName, reason: "not_available" });
        continue;
      }

      try {
        const result = await provider.ask(payload);

        this.status.lastProvider = result.provider;
        this.status.lastError = null;
        this.status.lastResponseAt = new Date().toISOString();
        this.status.failures = failures;

        return {
          ok: true,
          source: "AIManager",
          provider: result.provider,
          model: result.model,
          text: result.text,
          raw: result.raw,
          fallbackTrail: failures,
        };
      } catch (error) {
        failures.push({ provider: providerName, reason: error.message });
        this.status.lastError = error.message;
      }
    }

    return {
      ok: false,
      source: "AIManager",
      provider: "none",
      model: null,
      text: "Nenhum provider de IA disponível.",
      error: "all_providers_failed",
      fallbackTrail: failures,
    };
  }

  getStatus() {
    return {
      ...this.status,
      config: {
        mode: this.config.mode,
        priority: this.getPriority(),
      },
      providers: listProviders(),
    };
  }
}

module.exports = new AIManager();
