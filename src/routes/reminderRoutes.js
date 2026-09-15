const express = require("express");
const router = express.Router();

const controller = require("../controllers/reminderController");
router.use(require('../middlewares/authMiddleware')('ADMIN'));

router.post("/:id", controller.sendReminder);

module.exports = router;
