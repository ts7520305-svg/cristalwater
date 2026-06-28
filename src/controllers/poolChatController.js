// src/controllers/poolChatController.js
const { prisma } = require("../db/connection");

// LISTAR CHAT DA PISCINA
async function listPoolMessages(req, res) {
  try {
    const poolId = Number(req.params.poolId);
    if (Number.isNaN(poolId)) {
      return res.status(400).json({ error: "poolId inválido." });
    }

    // Carregar piscina + cliente
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { client: true },
    });

    if (!pool) {
      return res.status(404).json({ error: "Piscina não encontrada." });
    }

    // Mensagens
    const messages = await prisma.poolMessage.findMany({
      where: { poolId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ pool, messages });
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

    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) {
      return res.status(404).json({
        error: "Piscina não encontrada.",
      });
    }

    const created = await prisma.poolMessage.create({
      data: {
        poolId,
        senderType,
        text: text.trim(),
      },
    });

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