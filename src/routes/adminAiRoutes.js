const express = require("express");
const auth = require("../middlewares/authMiddleware");
const controller = require("../controllers/adminAiController");

const router = express.Router();

router.use(auth("ADMIN"));

router.get("/status", controller.status);
router.get("/context", controller.context);
router.get("/recommendations", controller.recommendations);
router.post("/chat", controller.chat);
router.get("/conversations", controller.listConversations);
router.get("/conversations/:id", controller.getConversation);
router.get("/actions", controller.listActions);
router.post("/actions", controller.createAction);
router.post("/actions/:id/approve", controller.approveAction);
router.post("/actions/:id/reject", controller.rejectAction);
router.post("/actions/:id/execute", controller.executeAction);

module.exports = router;
