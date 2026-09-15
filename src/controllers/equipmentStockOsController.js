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

function stockFailure(res,error){const stockError=/^STOCK_(NEGATIVE_GUARD|NOT_FOUND|BALANCE_AMBIGUOUS):/.test(error.message||'');return res.status(stockError?409:500).json({ok:false,error:error.message?.startsWith('STOCK_BALANCE_AMBIGUOUS:')?'Existem saldos duplicados. Peça à gestão para reconciliar o stock antes de movimentar.':stockError?'Stock insuficiente. Atualize os saldos antes de repetir.':'Não foi possível confirmar o movimento de stock'});}

async function transferStock(req, res) {
  try{return send(res, await EquipmentStockOsBusiness.transferStock({...req.body,userId:req.user?.id},`${req.user?.role}:${req.user?.id}`,req.user));}
  catch(error){return stockFailure(res,error);}
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
  try{return send(res, await EquipmentStockOsBusiness.consumeProductsForVisit(req.params.visitId, {...req.body,userId:req.user?.id}, `${req.user?.role}:${req.user?.id}`, req.user));}
  catch(error){return stockFailure(res,error);}
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
