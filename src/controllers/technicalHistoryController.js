// src/controllers/technicalHistoryController.js
const { prisma } = require("../db/connection");

// LISTAR TODO O HISTÓRICO (todas as piscinas)
async function listAll(req, res) {
  try {
    const events = await prisma.technicalHistory.findMany({
      orderBy: { performedAt: "desc" },
      include: {
        pool: {
          include: {
            client: true,
          },
        },
      },
    });

    res.json(events);
  } catch (err) {
    console.error("Erro ao listar histórico técnico:", err);
    res.status(500).json({ error: "Erro ao listar histórico técnico." });
  }
}

// LISTAR HISTÓRICO DE UMA PISCINA
async function listByPool(req, res) {
  try {
    const poolId = Number(req.params.poolId);
    if (Number.isNaN(poolId)) {
      return res.status(400).json({ error: "poolId inválido." });
    }

    const events = await prisma.technicalHistory.findMany({
      where: { poolId },
      orderBy: { performedAt: "desc" },
    });

    res.json(events);
  } catch (err) {
    console.error("Erro ao listar histórico técnico da piscina:", err);
    res
      .status(500)
      .json({ error: "Erro ao listar histórico técnico da piscina." });
  }
}

// BUSCAR REGISTO POR ID
async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const event = await prisma.technicalHistory.findUnique({
      where: { id },
      include: {
        pool: {
          include: { client: true },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: "Registo técnico não encontrado." });
    }

    res.json(event);
  } catch (err) {
    console.error("Erro ao obter registo técnico:", err);
    res.status(500).json({ error: "Erro ao obter registo técnico." });
  }
}

// CRIAR REGISTO TÉCNICO
async function create(req, res) {
  try {
    const { poolId, component, description, performedAt, nextSuggested } =
      req.body;

    if (!poolId || !component || !description) {
      return res.status(400).json({
        error:
          'Campos "poolId", "component" e "description" são obrigatórios.',
      });
    }

    const data = {
      poolId: Number(poolId),
      component: String(component).trim(),
      description: String(description).trim(),
      performedAt: performedAt ? new Date(performedAt) : null,
      nextSuggested: nextSuggested ? new Date(nextSuggested) : null,
    };

    const created = await prisma.technicalHistory.create({ data });
    res.json(created);
  } catch (err) {
    console.error("Erro ao criar histórico técnico:", err);
    res.status(500).json({ error: "Erro ao criar registo técnico." });
  }
}

// ATUALIZAR REGISTO TÉCNICO
async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const { component, description, performedAt, nextSuggested } = req.body;

    const existing = await prisma.technicalHistory.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Registo técnico não encontrado." });
    }

    const data = {
      component:
        component !== undefined && component !== null
          ? String(component).trim()
          : existing.component,
      description:
        description !== undefined && description !== null
          ? String(description).trim()
          : existing.description,
      performedAt:
        performedAt !== undefined && performedAt !== null
          ? performedAt
            ? new Date(performedAt)
            : null
          : existing.performedAt,
      nextSuggested:
        nextSuggested !== undefined && nextSuggested !== null
          ? nextSuggested
            ? new Date(nextSuggested)
            : null
          : existing.nextSuggested,
    };

    const updated = await prisma.technicalHistory.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar histórico técnico:", err);
    res.status(500).json({ error: "Erro ao atualizar registo técnico." });
  }
}

// APAGAR REGISTO TÉCNICO
async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const existing = await prisma.technicalHistory.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Registo técnico não encontrado." });
    }

    await prisma.technicalHistory.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao apagar histórico técnico:", err);
    res.status(500).json({ error: "Erro ao apagar registo técnico." });
  }
}

module.exports = {
  listAll,
  listByPool,
  getById,
  create,
  update,
  remove,
};