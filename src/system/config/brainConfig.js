/**
 * ============================================================
 * CRYSTAL BRAIN CONFIGURATION
 * Cristal OS V23.0
 * ============================================================
 */

module.exports = {
  system: {
    name: "Crystal Brain",
    version: "23.0.0",
    environment: process.env.NODE_ENV || "development",
    debug: false,
  },

  ai: {
    mode: process.env.AI_MODE || "automatic",
    defaultProvider: process.env.AI_DEFAULT || process.env.AI_PROVIDER || "mock",
    fallback: true,
    timeout: 30000,
    retry: 2,
    providers: ["openrouter", "gemini", "openai", "ollama", "mock"],
  },

  agents: {
    architect: true,
    qa: true,
    security: true,
    documentation: true,
    planning: true,
    chemistry: true,
    construction: true,
    vision: true,
    finance: true,
    customer: true,
  },

  health: {
    heartbeat: 60,
    autoRecovery: true,
    monitorProviders: true,
  },
};
