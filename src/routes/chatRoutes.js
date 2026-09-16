const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const { roleIn } = require("../utils/roles");

const {
  createMessage,
  listOverview,
  listClientConversation,
  listInternalConversation,
  listMessages,
  markAsRead,
  getUnreadCount,
} = require("../controllers/chatController");

function allowRoles(...roles) {
  return (req, res, next) => {
    if (roleIn(req.user?.role, roles)) return next();
    return res.status(403).json({ ok: false, message: "Sem permissão" });
  };
}

router.use(auth());

// Caixa de entrada admin: conversas, nao lidas e ultimas mensagens
router.get("/overview", allowRoles("ADMIN"), listOverview);

// Debug / admin
router.get("/", allowRoles("ADMIN"), listMessages);

// Conversa interna
router.get("/internal", allowRoles("TECHNICIAN"), listInternalConversation);
router.post("/internal", allowRoles("TECHNICIAN"), require("../controllers/internalChatController").create(true));

// Conversa cliente
router.get("/client/:clientId", allowRoles("ADMIN", "CLIENT"), listClientConversation);

// Enviar mensagem
router.post("/", allowRoles("ADMIN", "CLIENT"), createMessage);

// Marcar como lidas
router.post("/read", allowRoles("ADMIN"), markAsRead);

// Contador de não lidas
router.get("/unread", allowRoles("ADMIN"), getUnreadCount);

module.exports = router;
