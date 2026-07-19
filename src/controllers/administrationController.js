const AdministrationBusiness = require("../business/admin/AdministrationBusiness");

function actorContext(req) {
  return {
    actor: req.user?.email || req.user?.name || req.headers["x-actor"] || "administration-os",
    role: req.user?.role || req.headers["x-role"] || "TECHNICIAN",
  };
}

function send(res, result, successStatus = 200) {
  if (!result?.ok) {
    return res.status(result?.status || 400).json({ ok: false, error: result?.error || "Operação inválida" });
  }
  return res.status(successStatus).json(result);
}

async function createModule(req, res) {
  return send(res, await AdministrationBusiness.createModule(req.body || {}, actorContext(req)), 201);
}

async function getModule(req, res) {
  return send(res, await AdministrationBusiness.getModule(req.params.id));
}

async function updateHr(req, res) {
  return send(res, await AdministrationBusiness.updateHr(req.params.id, req.body || {}, actorContext(req)));
}

async function updateVehicles(req, res) {
  return send(res, await AdministrationBusiness.updateVehicles(req.params.id, req.body || {}, actorContext(req)));
}

async function updateFleet(req, res) {
  return send(res, await AdministrationBusiness.updateFleet(req.params.id, req.body || {}, actorContext(req)));
}

async function registerPurchase(req, res) {
  return send(res, await AdministrationBusiness.registerPurchase(req.params.id, req.body || {}, actorContext(req)));
}

async function updateSuppliers(req, res) {
  return send(res, await AdministrationBusiness.updateSuppliers(req.params.id, req.body || {}, actorContext(req)));
}

async function updateInternalTasks(req, res) {
  return send(res, await AdministrationBusiness.updateInternalTasks(req.params.id, req.body || {}, actorContext(req)));
}

async function updateKpis(req, res) {
  return send(res, await AdministrationBusiness.updateKpis(req.params.id, req.body || {}, actorContext(req)));
}

async function updateCompanyDashboard(req, res) {
  return send(res, await AdministrationBusiness.updateCompanyDashboard(req.params.id, req.body || {}, actorContext(req)));
}

async function updateProductivity(req, res) {
  return send(res, await AdministrationBusiness.updateProductivity(req.params.id, req.body || {}, actorContext(req)));
}

async function registerVacation(req, res) {
  return send(res, await AdministrationBusiness.registerVacation(req.params.id, req.body || {}, actorContext(req)));
}

async function registerAbsence(req, res) {
  return send(res, await AdministrationBusiness.registerAbsence(req.params.id, req.body || {}, actorContext(req)));
}

async function sendInternalMessage(req, res) {
  return send(res, await AdministrationBusiness.sendInternalMessage(req.params.id, req.body || {}, actorContext(req)));
}

async function registerApproval(req, res) {
  return send(res, await AdministrationBusiness.registerApproval(req.params.id, req.body || {}, actorContext(req)));
}

async function updateCompanyReports(req, res) {
  return send(res, await AdministrationBusiness.updateCompanyReports(req.params.id, req.body || {}, actorContext(req)));
}

async function registerAudit(req, res) {
  return send(res, await AdministrationBusiness.registerAudit(req.params.id, req.body || {}, actorContext(req)));
}

async function sendNotification(req, res) {
  return send(res, await AdministrationBusiness.sendNotification(req.params.id, req.body || {}, actorContext(req)));
}

async function completeModule(req, res) {
  return send(res, await AdministrationBusiness.completeModule(req.params.id, req.body || {}, actorContext(req)));
}

module.exports = {
  createModule,
  getModule,
  updateHr,
  updateVehicles,
  updateFleet,
  registerPurchase,
  updateSuppliers,
  updateInternalTasks,
  updateKpis,
  updateCompanyDashboard,
  updateProductivity,
  registerVacation,
  registerAbsence,
  sendInternalMessage,
  registerApproval,
  updateCompanyReports,
  registerAudit,
  sendNotification,
  completeModule,
};
