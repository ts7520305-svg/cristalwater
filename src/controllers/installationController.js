const InstallationBusiness = require("../business/installation/InstallationBusiness");

function actorContext(req) {
  return {
    actor: req.user?.email || req.user?.name || req.headers["x-actor"] || "installation-os",
    role: req.user?.role || req.headers["x-role"] || "TECHNICIAN",
  };
}

function send(res, result, successStatus = 200) {
  if (!result?.ok) {
    return res.status(result?.status || 400).json({ ok: false, error: result?.error || "Operação inválida" });
  }
  return res.status(successStatus).json(result);
}

async function requestInstallation(req, res) {
  return send(res, await InstallationBusiness.requestInstallation(req.body || {}, actorContext(req)), 201);
}

async function getInstallation(req, res) {
  return send(res, await InstallationBusiness.getInstallation(req.params.id));
}

async function proposeEquipment(req, res) {
  return send(res, await InstallationBusiness.proposeEquipment(req.params.id, req.body || {}, actorContext(req)));
}

async function createQuote(req, res) {
  return send(res, await InstallationBusiness.createQuote(req.params.id, req.body || {}, actorContext(req)));
}

async function approveCustomer(req, res) {
  return send(res, await InstallationBusiness.approveCustomer(req.params.id, req.body || {}, actorContext(req)));
}

async function scheduleInstallation(req, res) {
  return send(res, await InstallationBusiness.scheduleInstallation(req.params.id, req.body || {}, actorContext(req)));
}

async function assignTechnician(req, res) {
  return send(res, await InstallationBusiness.assignTechnician(req.params.id, req.body || {}, actorContext(req)));
}

async function reserveStock(req, res) {
  return send(res, await InstallationBusiness.reserveStock(req.params.id, req.body || {}, actorContext(req)));
}

async function generateWorkOrder(req, res) {
  return send(res, await InstallationBusiness.generateWorkOrder(req.params.id, req.body || {}, actorContext(req)));
}

async function startInstallation(req, res) {
  return send(res, await InstallationBusiness.startInstallation(req.params.id, req.body || {}, actorContext(req)));
}

async function gpsCheckIn(req, res) {
  return send(res, await InstallationBusiness.gpsCheckIn(req.params.id, req.body || {}, actorContext(req)));
}

async function installEquipment(req, res) {
  return send(res, await InstallationBusiness.installEquipment(req.params.id, req.body || {}, actorContext(req)));
}

async function addPhoto(req, res) {
  return send(res, await InstallationBusiness.addPhoto(req.params.id, req.body || {}, actorContext(req)));
}

async function registerSerialNumbers(req, res) {
  return send(res, await InstallationBusiness.registerSerialNumbers(req.params.id, req.body || {}, actorContext(req)));
}

async function registerWarranty(req, res) {
  return send(res, await InstallationBusiness.registerWarranty(req.params.id, req.body || {}, actorContext(req)));
}

async function submitChecklist(req, res) {
  return send(res, await InstallationBusiness.submitChecklist(req.params.id, req.body || {}, actorContext(req)));
}

async function signTechnician(req, res) {
  return send(res, await InstallationBusiness.signTechnician(req.params.id, req.body || {}, actorContext(req)));
}

async function signCustomer(req, res) {
  return send(res, await InstallationBusiness.signCustomer(req.params.id, req.body || {}, actorContext(req)));
}

async function acceptCustomer(req, res) {
  return send(res, await InstallationBusiness.acceptCustomer(req.params.id, req.body || {}, actorContext(req)));
}

async function consumeStock(req, res) {
  return send(res, await InstallationBusiness.consumeStock(req.params.id, req.body || {}, actorContext(req)));
}

async function generateInvoice(req, res) {
  return send(res, await InstallationBusiness.generateInvoice(req.params.id, req.body || {}, actorContext(req)));
}

async function trackPayment(req, res) {
  return send(res, await InstallationBusiness.trackPayment(req.params.id, req.body || {}, actorContext(req)));
}

async function completeInstallation(req, res) {
  return send(res, await InstallationBusiness.completeInstallation(req.params.id, req.body || {}, actorContext(req)));
}

module.exports = {
  requestInstallation,
  getInstallation,
  proposeEquipment,
  createQuote,
  approveCustomer,
  scheduleInstallation,
  assignTechnician,
  reserveStock,
  generateWorkOrder,
  startInstallation,
  gpsCheckIn,
  installEquipment,
  addPhoto,
  registerSerialNumbers,
  registerWarranty,
  submitChecklist,
  signTechnician,
  signCustomer,
  acceptCustomer,
  consumeStock,
  generateInvoice,
  trackPayment,
  completeInstallation,
};
