// src/routes/poolChatRoutes.js
const express = require("express");
const router = express.Router();

const {
  listPoolMessages,
  sendPoolMessage,
} = require("../controllers/poolChatController");

// LISTAR CHAT DA PISCINA
router.get("/:poolId", listPoolMessages);

// ENVIAR MENSAGEM PARA A PISCINA
router.post("/:poolId", sendPoolMessage);

module.exports = router;