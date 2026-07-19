const express = require("express");
const auth = require("../middlewares/authMiddleware");
const c = require("../controllers/equipmentStockOsController");

const router = express.Router();

router.use(auth("TECHNICIAN"));

router.get("/equipment", c.listEquipment);
router.get("/equipment/:id/lifecycle", c.getEquipmentLifecycle);
router.post("/equipment/:id/maintenance", c.scheduleEquipmentMaintenance);
router.post("/equipment/:id/warranty", c.registerEquipmentWarranty);
router.post("/equipment/:id/status", c.updateEquipmentStatus);

router.get("/stock/products", c.listProducts);
router.get("/stock/warehouse", c.listWarehouseStock);
router.get("/stock/vehicles/:vehicleId", c.listVehicleStock);
router.post("/stock/transfers", c.transferStock);
router.get("/stock/alerts", c.listStockAlerts);
router.get("/stock/purchase-suggestions", c.listPurchaseSuggestions);

router.get("/visits/:visitId/suggestions", c.suggestProducts);
router.post("/visits/:visitId/consume", c.consumeProducts);

router.get("/dashboard", c.operationalDashboard);
router.get("/customer-report/:clientId", c.customerReport);

module.exports = router;
