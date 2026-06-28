const express = require("express");
const controller = require("../controllers/aiOpsController");

const router = express.Router();

router.use(controller.requireAdmin);

router.get("/context", controller.getContext);
router.post("/chat", controller.postChat);
router.get("/conversations", controller.getConversations);
router.get("/actions", controller.getActions);
router.post("/actions/:id/approve", controller.approveAction);
router.post("/actions/:id/reject", controller.rejectAction);

module.exports = router;
