const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const { sendReportsNow } = require("../controllers/adminReportEmailController");

router.use(auth("ADMIN"));

router.post("/reports/send-now", sendReportsNow);

module.exports = router;