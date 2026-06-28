const express = require("express");
const router = express.Router();

const controller = require("../controllers/reminderController");

router.post("/:id", controller.sendReminder);

module.exports = router;