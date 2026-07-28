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
router.get("/overview", allowRoles("ADMIN", "TEAM_LEADER"), listOverview);

// Debug / admin
router.get("/", allowRoles("ADMIN", "TEAM_LEADER"), listMessages);

// Conversa interna
router.get("/internal", allowRoles("ADMIN", "TEAM_LEADER"), listInternalConversation);

// Conversa cliente
router.get("/client/:clientId", allowRoles("ADMIN", "TEAM_LEADER", "CLIENT"), listClientConversation);

// Enviar mensagem
router.post("/", allowRoles("ADMIN", "TEAM_LEADER", "CLIENT"), createMessage);

// Marcar como lidas
router.post("/read", allowRoles("ADMIN", "TEAM_LEADER"), markAsRead);

// Contador de não lidas
router.get("/unread", allowRoles("ADMIN", "TEAM_LEADER"), getUnreadCount);

module.exports = router;
