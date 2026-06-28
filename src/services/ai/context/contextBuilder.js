const { buildVisitContext } = require("./visitContext");
const { buildPoolContext } = require("./poolContext");
const { buildTechnicianContext } = require("./technicianContext");
const { buildHistoryContext } = require("./historyContext");

function buildAIContext(data = {}) {
  return {
    generatedAt: new Date().toISOString(),
    customer: data.customer || null,
    pool: data.pool ? buildPoolContext(data.pool) : null,
    visit: data.visit ? buildVisitContext(data.visit) : null,
    technician: data.technician ? buildTechnicianContext(data.technician) : null,
    history: data.history ? buildHistoryContext(data.history) : null,
    source: data.source || "manual",
  };
}

module.exports = {
  buildAIContext,
};
