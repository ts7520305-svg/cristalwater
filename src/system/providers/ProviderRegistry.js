const OpenRouterProvider = require("./OpenRouterProvider");
const GeminiProvider = require("./GeminiProvider");
const OpenAIProvider = require("./OpenAIProvider");
const OllamaProvider = require("./OllamaProvider");
const MockProvider = require("./MockProvider");

const providers = {
  openrouter: OpenRouterProvider,
  gemini: GeminiProvider,
  openai: OpenAIProvider,
  ollama: OllamaProvider,
  mock: MockProvider,
};

function getProvider(name = "mock") {
  return providers[name] || MockProvider;
}

function listProviders() {
  return Object.keys(providers).map((key) => ({
    key,
    available: providers[key].isAvailable(),
    model: providers[key].getModel ? providers[key].getModel() : providers[key].model,
  }));
}

module.exports = {
  getProvider,
  listProviders,
};
