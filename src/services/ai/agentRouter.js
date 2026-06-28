const { detectAgent } = require("./orchestratorRules");

const { buildAdminPrompt } = require("./agents/adminAgent");
const { buildTechnicianPrompt } = require("./agents/technicianAgent");
const { buildFinancePrompt } = require("./agents/financeAgent");
const { buildChemistryPrompt } = require("./agents/chemistryAgent");
const { buildStockPrompt } = require("./agents/stockAgent");
const { buildRoutePrompt } = require("./agents/routeAgent");

function buildPrompt(question, context = {}) {
  const agent = detectAgent(question);

  switch (agent) {
    case "technician":
      return buildTechnicianPrompt(question, context);

    case "finance":
      return buildFinancePrompt(question, context);

    case "chemistry":
      return buildChemistryPrompt(question, context);

    case "stock":
      return buildStockPrompt(question, context);

    case "route":
      return buildRoutePrompt(question, context);

    default:
      return buildAdminPrompt(question, context);
  }
}

module.exports = {
  buildPrompt,
};
