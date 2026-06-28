const express = require("express");
const router = express.Router();

const {
  getTodayRound,
  registerVisit,
  updateExtraVisitStatus,
} = require("../controllers/technicianPortalController");

// ==========================================
// RONDA DO DIA
// ==========================================
router.get("/:id/today", getTodayRound);

// ==========================================
// REGISTAR VISITA NORMAL
// ==========================================
router.post("/visit", registerVisit);

// ==========================================
// VISITA EXTRA
// ==========================================
router.put("/extra-visits/:id/status", updateExtraVisitStatus);
router.put("/extra-visit/:id/status", updateExtraVisitStatus);

// 🔥 MUITO IMPORTANTE
module.exports = router;