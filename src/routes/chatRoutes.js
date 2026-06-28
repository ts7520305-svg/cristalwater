const express = require("express");
const router = express.Router();

const {
  createMessage,
  listOverview,
  listClientConversation,
  listInternalConversation,
  listMessages,
  markAsRead,
  getUnreadCount,
} = require("../controllers/chatController");

// Caixa de entrada admin: conversas, nao lidas e ultimas mensagens
router.get("/overview", listOverview);

// Debug / admin
router.get("/", listMessages);

// Conversa interna
router.get("/internal", listInternalConversation);

// Conversa cliente
router.get("/client/:clientId", listClientConversation);

// Enviar mensagem
router.post("/", createMessage);

// Marcar como lidas
router.post("/read", markAsRead);

// Contador de não lidas
router.get("/unread", getUnreadCount);

module.exports = router;
