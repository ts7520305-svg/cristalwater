// src/controllers/clientChatController.js
const { prisma } = require("../db/connection");

// LISTAR MENSAGENS DO CLIENTE + MARCAR COMO LIDAS
async function listClientMessages(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: "clientId inválido." });
    }

    const clientExists = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!clientExists) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    const messages = await prisma.clientMessage.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    // Marcar mensagens do CLIENTE como lidas pelo ADMIN
    await prisma.clientMessage.updateMany({
      where: {
        clientId,
        senderType: "CLIENT",
        isReadByAdmin: false,
      },
      data: { isReadByAdmin: true },
    });

    res.json(messages);
  } catch (err) {
    console.error("Erro ao listar mensagens do cliente:", err);
    res.status(500).json({ error: "Erro ao listar mensagens do cliente." });
  }
}

// ENVIAR MENSAGEM (ADMIN OU CLIENTE)
async function sendClientMessage(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    const { senderType, text } = req.body;

    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: "clientId inválido." });
    }

    if (!senderType || !text || !text.trim()) {
      return res.status(400).json({
        error: 'Campos "senderType" e "text" são obrigatórios.',
      });
    }

    if (!["ADMIN", "CLIENT"].includes(senderType)) {
      return res
        .status(400)
        .json({ error: 'senderType deve ser "ADMIN" ou "CLIENT".' });
    }

    const clientExists = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!clientExists) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    const created = await prisma.clientMessage.create({
      data: {
        clientId,
        senderType,
        text: text.trim(),
        isReadByAdmin: senderType === "CLIENT" ? false : true,
      },
    });

    res.json(created);
  } catch (err) {
    console.error("Erro ao enviar mensagem do cliente:", err);
    res.status(500).json({ error: "Erro ao enviar mensagem do cliente." });
  }
}

// CONTAR MENSAGENS NÃO LIDAS (para a notificação do admin)
async function countUnreadClientMessages(req, res) {
  try {
    const unreadCount = await prisma.clientMessage.count({
      where: {
        senderType: "CLIENT",
        isReadByAdmin: false,
      },
    });

    res.json({ unread: unreadCount });
  } catch (err) {
    console.error("Erro ao contar mensagens não lidas:", err);
    res.status(500).json({ error: "Erro ao contar mensagens não lidas." });
  }
}

// LISTAR TODAS AS MENSAGENS NÃO LIDAS (para Notificações)
async function listUnreadClientMessages(req, res) {
  try {
    const unread = await prisma.clientMessage.findMany({
      where: {
        senderType: "CLIENT",
        isReadByAdmin: false,
      },
      include: {
        client: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(unread);
  } catch (err) {
    console.error("Erro ao listar mensagens não lidas:", err);
    res.status(500).json({
      error: "Erro ao listar mensagens não lidas dos clientes.",
    });
  }
}

module.exports = {
  listClientMessages,
  sendClientMessage,
  countUnreadClientMessages,
  listUnreadClientMessages,
};