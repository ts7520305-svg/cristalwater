// src/controllers/serviceChatController.js
const { prisma } = require("../db/connection");

// OBTER O CHAT DO SERVIÇO
async function getServiceChat(req, res) {
  try {
    const serviceId = Number(req.params.serviceId);
    if (Number.isNaN(serviceId)) {
      return res.status(400).json({ error: "serviceId inválido." });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
        technician: true,
      },
    });

    if (!service) {
      return res.status(404).json({ error: "Serviço não encontrado." });
    }

    const messages = await prisma.serviceMessage.findMany({
      where: { serviceId },
      orderBy: { createdAt: "desc" },
    });

    res.json({ service, messages });
  } catch (err) {
    console.error("Erro ao obter chat do serviço:", err);
    res.status(500).json({ error: "Erro ao obter chat do serviço." });
  }
}

// ENVIAR MENSAGEM PARA O SERVIÇO
async function sendServiceMessage(req, res) {
  try {
    const serviceId = Number(req.params.serviceId);
    const { senderType, text } = req.body;

    if (Number.isNaN(serviceId)) {
      return res.status(400).json({ error: "serviceId inválido." });
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

    const serviceExists = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!serviceExists) {
      return res.status(404).json({ error: "Serviço não encontrado." });
    }

    const created = await prisma.serviceMessage.create({
      data: {
        serviceId,
        senderType,
        text: text.trim(),
      },
    });

    res.json(created);
  } catch (err) {
    console.error("Erro ao enviar mensagem do serviço:", err);
    res.status(500).json({ error: "Erro ao enviar mensagem do serviço." });
  }
}

module.exports = {
  getServiceChat,
  sendServiceMessage,
};