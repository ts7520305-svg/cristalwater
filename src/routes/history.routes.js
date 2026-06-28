// ==========================================
// CRISTAL WATER - HISTORY ROUTES
// src/routes/history.routes.js
// ==========================================

const express = require("express");
const router = express.Router();

const {
  getHistoryByPool,
  getHistoryByClient,
  getHistoryByTechnician,
  getFailures,
} = require("../controllers/historyController");

router.get("/pool/:poolId", getHistoryByPool);
router.get("/client/:clientId", getHistoryByClient);
router.get("/technician/:technicianId", getHistoryByTechnician);
router.get("/failures", getFailures);

module.exports = router;