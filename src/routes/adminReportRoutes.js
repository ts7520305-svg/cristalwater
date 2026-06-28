const express = require("express");
const router = express.Router();
const { sendReportsNow } = require("../controllers/adminReportController");

// POST /api/admin/reports/send-now
router.post("/reports/send-now", sendReportsNow);

module.exports = router;