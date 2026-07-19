const express = require("express");
const router = express.Router();
const TechnicianStatsController = require("../controllers/technicianStatsController");

router.get("/", TechnicianStatsController.listTechnicianStats);
router.get("/:id", TechnicianStatsController.getTechnicianStats);

module.exports = router;