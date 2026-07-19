const ConstructionBusiness = require("../business/construction/ConstructionBusiness");

function actorContext(req) {
  return {
    actor: req.user?.email || req.user?.name || req.headers["x-actor"] || "construction-os",
    role: req.user?.role || req.headers["x-role"] || "TECHNICIAN",
  };
}

function send(res, result, successStatus = 200) {
  if (!result?.ok) {
    return res.status(result?.status || 400).json({ ok: false, error: result?.error || "Operação inválida" });
  }
  return res.status(successStatus).json(result);
}

async function createProject(req, res) {
  return send(res, await ConstructionBusiness.createProject(req.body || {}, actorContext(req)), 201);
}

async function getProject(req, res) {
  return send(res, await ConstructionBusiness.getProject(req.params.id));
}

async function approveCustomer(req, res) {
  return send(res, await ConstructionBusiness.approveCustomer(req.params.id, req.body || {}, actorContext(req)));
}

async function defineBudget(req, res) {
  return send(res, await ConstructionBusiness.defineBudget(req.params.id, req.body || {}, actorContext(req)));
}

async function definePlanning(req, res) {
  return send(res, await ConstructionBusiness.definePlanning(req.params.id, req.body || {}, actorContext(req)));
}

async function updatePhase(req, res) {
  return send(res, await ConstructionBusiness.updatePhase(req.params.id, req.body || {}, actorContext(req)));
}

async function planMaterials(req, res) {
  return send(res, await ConstructionBusiness.planMaterials(req.params.id, req.body || {}, actorContext(req)));
}

async function reserveStock(req, res) {
  return send(res, await ConstructionBusiness.reserveStock(req.params.id, req.body || {}, actorContext(req)));
}

async function assignTeam(req, res) {
  return send(res, await ConstructionBusiness.assignTeam(req.params.id, req.body || {}, actorContext(req)));
}

async function addDailyLog(req, res) {
  return send(res, await ConstructionBusiness.addDailyLog(req.params.id, req.body || {}, actorContext(req)));
}

async function addPhoto(req, res) {
  return send(res, await ConstructionBusiness.addPhoto(req.params.id, req.body || {}, actorContext(req)));
}

async function trackProgress(req, res) {
  return send(res, await ConstructionBusiness.trackProgress(req.params.id, req.body || {}, actorContext(req)));
}

async function createVariationOrder(req, res) {
  return send(res, await ConstructionBusiness.createVariationOrder(req.params.id, req.body || {}, actorContext(req)));
}

async function approveVariationOrder(req, res) {
  return send(res, await ConstructionBusiness.approveVariationOrder(req.params.id, req.body || {}, actorContext(req)));
}

async function createBillingMilestone(req, res) {
  return send(res, await ConstructionBusiness.createBillingMilestone(req.params.id, req.body || {}, actorContext(req)));
}

async function finalInspection(req, res) {
  return send(res, await ConstructionBusiness.finalInspection(req.params.id, req.body || {}, actorContext(req)));
}

async function finalHandover(req, res) {
  return send(res, await ConstructionBusiness.finalHandover(req.params.id, req.body || {}, actorContext(req)));
}

async function registerWarranty(req, res) {
  return send(res, await ConstructionBusiness.registerWarranty(req.params.id, req.body || {}, actorContext(req)));
}

async function notifyCustomer(req, res) {
  return send(res, await ConstructionBusiness.notifyCustomer(req.params.id, req.body || {}, actorContext(req)));
}

async function syncDashboard(req, res) {
  return send(res, await ConstructionBusiness.syncDashboard(req.params.id, req.body || {}, actorContext(req)));
}

async function completeProject(req, res) {
  return send(res, await ConstructionBusiness.completeProject(req.params.id, req.body || {}, actorContext(req)));
}

module.exports = {
  createProject,
  getProject,
  approveCustomer,
  defineBudget,
  definePlanning,
  updatePhase,
  planMaterials,
  reserveStock,
  assignTeam,
  addDailyLog,
  addPhoto,
  trackProgress,
  createVariationOrder,
  approveVariationOrder,
  createBillingMilestone,
  finalInspection,
  finalHandover,
  registerWarranty,
  notifyCustomer,
  syncDashboard,
  completeProject,
};
