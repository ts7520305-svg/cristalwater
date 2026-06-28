const { askMockAI } = require("../../services/ai/providers/mockProvider");

class MockProvider {
  constructor() {
    this.name = "mock";
    this.model = "cristalwater-mock-ai";
  }

  isAvailable() {
    return true;
  }

  async ask(payload = {}) {
    const result = await askMockAI(payload);
    return {
      provider: this.name,
      model: this.model,
      text: result.text || "",
      raw: result.raw || null,
    };
  }
}

module.exports = new MockProvider();
