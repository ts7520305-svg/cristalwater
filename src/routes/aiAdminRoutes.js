const express = require("express");
const router = express.Router();
const { requireAiAdmin } = require("../middlewares/aiAdminAuth");
const controller = require("../controllers/aiAdminController");

router.use(requireAiAdmin);

router.get("/status", controller.status);
router.post("/chat", controller.chat);
router.get("/threads", controller.threads);
router.get("/threads/:id", controller.threadDetail);
router.get("/actions", controller.actions);
router.post("/actions/:id/approve", controller.approve);
router.post("/actions/:id/reject", controller.reject);

module.exports = router;
