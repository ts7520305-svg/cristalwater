const { prisma } = require("../prismaClient");

/**
 * LISTAR TODOS OS EQUIPAMENTOS
 * GET /api/pool-equipment
 */
exports.getAllPoolEquipments = async (req, res) => {
  try {
    const equipments = await prisma.poolEquipment.findMany({
      include: {
        pool: true,
      },
      orderBy: { id: "asc" },
    });

    res.json(equipments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar equipamentos." });
  }
};

/**
 * OBTER EQUIPAMENTO POR ID
 * GET /api/pool-equipment/:id
 */
exports.getPoolEquipmentById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const equipment = await prisma.poolEquipment.findUnique({
      where: { id },
      include: {
        pool: true,
      },
    });

    if (!equipment) {
      return res.status(404).json({ error: "Equipamento não encontrado." });
    }

    res.json(equipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao obter equipamento." });
  }
};

/**
 * CRIAR EQUIPAMENTO
 * POST /api/pool-equipment
 */
exports.createPoolEquipment = async (req, res) => {
  try {
    const { type, brand, model, modelName, notes, poolId } = req.body;

    const equipment = await prisma.poolEquipment.create({
      data: {
        type,
        brand,
        modelName: modelName ?? model ?? null,
        notes,
        poolId: Number(poolId),
      },
    });

    res.status(201).json(equipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar equipamento." });
  }
};

/**
 * ATUALIZAR EQUIPAMENTO
 * PUT /api/pool-equipment/:id
 */
exports.updatePoolEquipment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const equipment = await prisma.poolEquipment.update({
      where: { id },
      data: { ...req.body, modelName: req.body.modelName ?? req.body.model ?? undefined, model: undefined },
    });

    res.json(equipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar equipamento." });
  }
};

/**
 * APAGAR EQUIPAMENTO
 * DELETE /api/pool-equipment/:id
 */
exports.deletePoolEquipment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    await prisma.poolEquipment.delete({
      where: { id },
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao apagar equipamento." });
  }
};