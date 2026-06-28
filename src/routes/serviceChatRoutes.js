// src/routes/serviceChatRoutes.js
const express = require("express");
const router = express.Router();

const {
  getServiceChat,
  sendServiceMessage,
} = require("../controllers/serviceChatController");

// Obter chat completo do serviço
router.get("/:serviceId", getServiceChat);

// Enviar mensagem (ADMIN ou TECH)
router.post("/:serviceId", sendServiceMessage);

module.exports = router;