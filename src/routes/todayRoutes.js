const express = require("express");
const router = express.Router();

const controller = require("../controllers/todayController");

router.get("/", controller.getTodayDashboard);

module.exports = router;