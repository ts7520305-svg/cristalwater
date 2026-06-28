// ==========================================
// CRISTAL WATER - ADMIN EMAIL LOG ROUTES
// ==========================================

const express = require("express");
const router = express.Router();

const {
  listEmailLogs,
} = require("../controllers/adminEmailLogController");

// 🔹 /api/admin/email-logs
router.get("/email-logs", listEmailLogs);

module.exports = router;