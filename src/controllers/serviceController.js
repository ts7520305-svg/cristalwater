// src/controllers/serviceController.js
const { prisma } = require("../db/connection");

// LISTAR TODOS OS SERVIÇOS
async function listServices(req, res) {
  try {
    const services = await prisma.service.findMany({
      orderBy: { date: "desc" },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
        technician: true,
      },
    });

    res.json(services);
  } catch (err) {
    console.error("Erro ao listar serviços:", err);
    res.status(500).json({ error: "Erro ao listar serviços." });
  }
}

// OBTER UM SERVIÇO POR ID (com piscina + cliente + técnico)
async function getServiceById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const service = await prisma.service.findUnique({
      where: { id },
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

    res.json(service);
  } catch (err) {
    console.error("Erro ao obter serviço:", err);
    res.status(500).json({ error: "Erro ao obter serviço." });
  }
}

// LISTAR SERVIÇOS POR CLIENTE
async function listServicesByClient(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    if (Number.isNaN(clientId)) {
      return res.status(400).json({ error: "clientId inválido." });
    }

    const services = await prisma.service.findMany({
      where: {
        pool: {
          is: { clientId },
        },
      },
      orderBy: { date: "desc" },
      include: {
        pool: true,
        technician: true,
      },
    });

    res.json(services);
  } catch (err) {
    console.error("Erro ao listar serviços do cliente:", err);
    res.status(500).json({ error: "Erro ao listar serviços do cliente." });
  }
}

// LISTAR SERVIÇOS POR PISCINA
async function listServicesByPool(req, res) {
  try {
    const poolId = Number(req.params.poolId);
    if (Number.isNaN(poolId)) {
      return res.status(400).json({ error: "poolId inválido." });
    }

    const services = await prisma.service.findMany({
      where: { poolId },
      orderBy: { date: "desc" },
      include: {
        pool: true,
        technician: true,
      },
    });

    res.json(services);
  } catch (err) {
    console.error("Erro ao listar serviços da piscina:", err);
    res.status(500).json({ error: "Erro ao listar serviços da piscina." });
  }
}

// ATUALIZAR SERVIÇO (usado na ficha do serviço)
async function updateService(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const {
      kind,
      status,
      notes,
      ph,
      chlorine,
      alkalinity,
      temperature,
    } = req.body;

    const data = {
      kind: kind !== undefined ? kind?.trim() || null : undefined,
      status: status !== undefined ? status?.trim() || null : undefined,
      notes: notes !== undefined ? notes?.trim() || null : undefined,
      ph: ph !== undefined ? (ph === null ? null : Number(ph)) : undefined,
      chlorine:
        chlorine !== undefined
          ? chlorine === null
            ? null
            : Number(chlorine)
          : undefined,
      alkalinity:
        alkalinity !== undefined
          ? alkalinity === null
            ? null
            : Number(alkalinity)
          : undefined,
      temperature:
        temperature !== undefined
          ? temperature === null
            ? null
            : Number(temperature)
          : undefined,
    };

    const updated = await prisma.service.update({
      where: { id },
      data,
      include: {
        pool: { include: { client: true } },
        technician: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar serviço:", err);
    res.status(500).json({ error: "Erro ao atualizar serviço." });
  }
}

module.exports = {
  listServices,
  getServiceById,
  listServicesByClient,
  listServicesByPool,
  updateService,
};