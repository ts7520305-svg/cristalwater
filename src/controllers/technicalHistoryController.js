// src/controllers/technicalHistoryController.js
const PoolHistoryBusiness = require("../business/pool/PoolHistoryBusiness");

// LISTAR TODO O HISTÓRICO (todas as piscinas)
async function listAll(req, res) {
  try {
    const events = await PoolHistoryBusiness.listAllTechnicalHistory();

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

    const events = await PoolHistoryBusiness.listTechnicalHistoryByPool(poolId);

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

    const event = await PoolHistoryBusiness.getTechnicalHistoryById(id);

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

    const created = await PoolHistoryBusiness.createTechnicalHistory({
      poolId,
      component,
      description,
      performedAt,
      nextSuggested,
    });
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

    const updated = await PoolHistoryBusiness.updateTechnicalHistory(id, req.body || {});

    if (!updated) {
      return res.status(404).json({ error: "Registo técnico não encontrado." });
    }

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

    const removed = await PoolHistoryBusiness.removeTechnicalHistory(id);

    if (!removed) {
      return res.status(404).json({ error: "Registo técnico não encontrado." });
    }

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