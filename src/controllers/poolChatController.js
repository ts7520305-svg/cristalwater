// src/controllers/poolChatController.js
const PoolChatBusiness = require("../business/pool/PoolChatBusiness");

// LISTAR CHAT DA PISCINA
async function listPoolMessages(req, res) {
  try {
    const poolId = Number(req.params.poolId);
    if (Number.isNaN(poolId)) {
      return res.status(400).json({ error: "poolId inválido." });
    }

    const payload = await PoolChatBusiness.listPoolMessages(poolId);
    if (!payload) {
      return res.status(404).json({ error: "Piscina não encontrada." });
    }

    res.json(payload);
  } catch (err) {
    console.error("Erro ao listar mensagens da piscina:", err);
    res.status(500).json({
      error: "Erro ao listar mensagens da piscina.",
    });
  }
}

// ENVIAR MENSAGEM PARA A PISCINA
// senderType: "ADMIN" | "TECH"
async function sendPoolMessage(req, res) {
  try {
    const poolId = Number(req.params.poolId);
    const { senderType, text } = req.body;

    if (Number.isNaN(poolId)) {
      return res.status(400).json({ error: "poolId inválido." });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: 'Campo "text" é obrigatório.',
      });
    }

    if (!["ADMIN", "TECH"].includes(senderType)) {
      return res.status(400).json({
        error: 'senderType deve ser "ADMIN" ou "TECH".',
      });
    }

    const created = await PoolChatBusiness.sendPoolMessage(poolId, senderType, text);
    if (!created) {
      return res.status(404).json({
        error: "Piscina não encontrada.",
      });
    }

    res.json(created);
  } catch (err) {
    console.error("Erro ao enviar mensagem da piscina:", err);
    res.status(500).json({
      error: "Erro ao enviar mensagem da piscina.",
    });
  }
}

module.exports = {
  listPoolMessages,
  sendPoolMessage,
};