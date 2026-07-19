const express = require("express");
const auth = require("../middlewares/authMiddleware");
const c = require("../controllers/constructionController");

const router = express.Router();

router.use(auth("TECHNICIAN"));

router.post("/", c.createProject);
router.get("/:id", c.getProject);

router.put("/:id/customer-approval", c.approveCustomer);
router.put("/:id/budget", c.defineBudget);
router.put("/:id/planning", c.definePlanning);
router.put("/:id/phases", c.updatePhase);
router.put("/:id/material-planning", c.planMaterials);
router.put("/:id/stock-reservation", c.reserveStock);
router.put("/:id/team-assignment", c.assignTeam);
router.post("/:id/daily-log", c.addDailyLog);
router.post("/:id/photos", c.addPhoto);
router.put("/:id/progress", c.trackProgress);
router.post("/:id/variation-orders", c.createVariationOrder);
router.put("/:id/variation-approval", c.approveVariationOrder);
router.post("/:id/billing-milestones", c.createBillingMilestone);
router.put("/:id/final-inspection", c.finalInspection);
router.put("/:id/final-handover", c.finalHandover);
router.put("/:id/warranty", c.registerWarranty);
router.post("/:id/notify-customer", c.notifyCustomer);
router.post("/:id/dashboard-sync", c.syncDashboard);
router.put("/:id/complete", c.completeProject);

module.exports = router;
