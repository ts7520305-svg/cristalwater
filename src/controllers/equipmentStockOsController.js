const EquipmentStockOsBusiness = require("../business/operations/EquipmentStockOsBusiness");

function actor(req) {
  return req.user?.name || req.user?.email || req.user?.role || "system";
}

function send(res, result, successStatus = 200) {
  if (!result?.ok) {
    return res.status(result?.status || 400).json({ ok: false, error: result?.error || "Operação inválida" });
  }
  return res.status(successStatus).json(result);
}

async function listEquipment(req, res) {
  const inventory = await EquipmentStockOsBusiness.listEquipmentInventory(req.query || {});
  return res.json({ ok: true, equipment: inventory });
}

async function getEquipmentLifecycle(req, res) {
  return send(res, await EquipmentStockOsBusiness.getEquipmentLifecycle(req.params.id));
}

async function scheduleEquipmentMaintenance(req, res) {
  return send(res, await EquipmentStockOsBusiness.createEquipmentMaintenance(req.params.id, req.body || {}, actor(req)), 201);
}

async function registerEquipmentWarranty(req, res) {
  return send(res, await EquipmentStockOsBusiness.registerEquipmentWarranty(req.params.id, req.body || {}, actor(req)), 201);
}

async function updateEquipmentStatus(req, res) {
  return send(res, await EquipmentStockOsBusiness.updateEquipmentStatus(req.params.id, req.body || {}, actor(req)));
}

async function listProducts(req, res) {
  const products = await EquipmentStockOsBusiness.listStockProducts(req.query || {});
  return res.json({ ok: true, products });
}

async function listWarehouseStock(req, res) {
  return send(res, await EquipmentStockOsBusiness.listWarehouseStock());
}

async function listVehicleStock(req, res) {
  return send(res, await EquipmentStockOsBusiness.listVehicleStock(req.params.vehicleId));
}

async function transferStock(req, res) {
  return send(res, await EquipmentStockOsBusiness.transferStock(req.body || {}, actor(req)));
}

async function listStockAlerts(req, res) {
  return send(res, await EquipmentStockOsBusiness.listStockAlerts());
}

async function listPurchaseSuggestions(req, res) {
  return send(res, await EquipmentStockOsBusiness.listPurchaseSuggestions());
}

async function suggestProducts(req, res) {
  return send(res, await EquipmentStockOsBusiness.suggestProductsForVisit(req.params.visitId));
}

async function consumeProducts(req, res) {
  return send(res, await EquipmentStockOsBusiness.consumeProductsForVisit(req.params.visitId, req.body || {}, actor(req)));
}

async function operationalDashboard(req, res) {
  return send(res, await EquipmentStockOsBusiness.buildOperationalDashboard());
}

async function customerReport(req, res) {
  return send(res, await EquipmentStockOsBusiness.buildCustomerStockReport(req.params.clientId));
}

module.exports = {
  listEquipment,
  getEquipmentLifecycle,
  scheduleEquipmentMaintenance,
  registerEquipmentWarranty,
  updateEquipmentStatus,
  listProducts,
  listWarehouseStock,
  listVehicleStock,
  transferStock,
  listStockAlerts,
  listPurchaseSuggestions,
  suggestProducts,
  consumeProducts,
  operationalDashboard,
  customerReport,
};
