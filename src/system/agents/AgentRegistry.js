const ArchitectAgent = require("./ArchitectAgent");
const QAAgent = require("./QAAgent");
const SecurityAgent = require("./SecurityAgent");
const DocumentationAgent = require("./DocumentationAgent");
const PlanningAgent = require("./PlanningAgent");
const ChemistryAgent = require("./ChemistryAgent");
const ConstructionAgent = require("./ConstructionAgent");
const FinanceAgent = require("./FinanceAgent");
const CustomerAgent = require("./CustomerAgent");

const agents = {
  general: {
    getName: () => "Crystal General",
    buildSystemPrompt: () => "És o Crystal Brain da Cristal Water. Responde com clareza, simplicidade e foco operacional.",
  },
  architect: ArchitectAgent,
  qa: QAAgent,
  security: SecurityAgent,
  documentation: DocumentationAgent,
  planning: PlanningAgent,
  chemistry: ChemistryAgent,
  construction: ConstructionAgent,
  finance: FinanceAgent,
  customer: CustomerAgent,
};

function getAgent(intent = "general") {
  return agents[intent] || agents.general;
}

function listAgents() {
  return Object.keys(agents).map((key) => ({
    key,
    name: agents[key].getName(),
  }));
}

module.exports = {
  getAgent,
  listAgents,
};
