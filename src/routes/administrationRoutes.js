const express = require("express");
const auth = require("../middlewares/authMiddleware");
const c = require("../controllers/administrationController");

const router = express.Router();

router.use(auth("TECHNICIAN"));

router.post("/", c.createModule);
router.get("/:id", c.getModule);

router.put("/:id/hr", c.updateHr);
router.put("/:id/vehicles", c.updateVehicles);
router.put("/:id/fleet", c.updateFleet);
router.post("/:id/purchases", c.registerPurchase);
router.put("/:id/suppliers", c.updateSuppliers);
router.put("/:id/internal-tasks", c.updateInternalTasks);
router.put("/:id/kpis", c.updateKpis);
router.put("/:id/company-dashboard", c.updateCompanyDashboard);
router.put("/:id/productivity", c.updateProductivity);
router.post("/:id/vacations", c.registerVacation);
router.post("/:id/absences", c.registerAbsence);
router.post("/:id/internal-messaging", c.sendInternalMessage);
router.post("/:id/approvals", c.registerApproval);
router.put("/:id/company-reports", c.updateCompanyReports);
router.post("/:id/audit", c.registerAudit);
router.post("/:id/notifications", c.sendNotification);
router.put("/:id/complete", c.completeModule);

module.exports = router;
