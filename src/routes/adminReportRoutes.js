const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const { sendReportsNow } = require("../controllers/adminReportController");

router.use(auth("ADMIN"));

// POST /api/admin/reports/send-now
router.post("/reports/send-now", sendReportsNow);

module.exports = router;