const AIManager = require("../manager/AIManager");
const brainConfig = require("../config/brainConfig");
const BrainRouter = require("../router/BrainRouter");
const BrainMemory = require("../memory/BrainMemory");
const BrainLogger = require("../logs/BrainLogger");
const { getAgent, listAgents } = require("../agents/AgentRegistry");

class CrystalBrain {
  constructor() {
    this.name = brainConfig.system.name;
    this.version = brainConfig.system.version;
    this.startedAt = new Date().toISOString();
  }

  async ask(question, context = {}) {
    if (!question || !String(question).trim()) {
      throw new Error("CrystalBrain: pergunta vazia.");
    }

    const route = BrainRouter.route(question);
    const agent = getAgent(route.intent);

    BrainLogger.info("CrystalBrain question received", {
      intent: route.intent,
      agent: agent.getName(),
    });

    const result = await AIManager.ask({
      systemPrompt: agent.buildSystemPrompt(),
      userPrompt: question,
      temperature: 0.2,
      context: {
        ...context,
        route,
        agent: agent.getName(),
      },
    });

    BrainMemory.add({
      type: "brain_question",
      question,
      intent: route.intent,
      agent: agent.getName(),
      provider: result.provider,
      ok: result.ok,
    });

    return {
      ...result,
      brain: {
        name: this.name,
        version: this.version,
      },
      route,
      agent: {
        name: agent.getName(),
      },
    };
  }

  status() {
    return {
      name: this.name,
      version: this.version,
      startedAt: this.startedAt,
      aiManager: AIManager.getStatus(),
      agents: listAgents(),
      memoryItems: BrainMemory.list(10).length,
    };
  }

  memory(limit = 20) {
    return BrainMemory.list(limit);
  }
}

module.exports = new CrystalBrain();
