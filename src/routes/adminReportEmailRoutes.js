const express = require("express");
const router = express.Router();
const { sendReportsNow } = require("../controllers/adminReportEmailController");

router.post("/reports/send-now", sendReportsNow);

module.exports = router;