const PoolEquipmentBusiness = require("../business/pool/PoolEquipmentBusiness");

/**
 * LISTAR TODOS OS EQUIPAMENTOS
 * GET /api/pool-equipment
 */
exports.getAllPoolEquipments = async (req, res) => {
  try {
    const equipments = await PoolEquipmentBusiness.listEquipment();

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

    const equipment = await PoolEquipmentBusiness.getEquipmentById(id);

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

    const equipment = await PoolEquipmentBusiness.createEquipment({ type, brand, modelName, model, notes, poolId });

    res.status(201).json(equipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar equipamento." });
  }
};

/**
 * INSTALAR EQUIPAMENTO
 * POST /api/pool-equipment/:poolId/install
 */
exports.installPoolEquipment = async (req, res) => {
  try {
    const result = await PoolEquipmentBusiness.installEquipment({ ...req.body, poolId: req.params.poolId }, req.user?.email || req.user?.name || req.user?.role || "system");

    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error || "Erro ao instalar equipamento." });
    }

    res.status(201).json({ ok: true, equipment: result.equipment, installationHistory: result.installationHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao instalar equipamento." });
  }
};

/**
 * REGISTO DE ASSETS DE EQUIPAMENTO
 * GET /api/pool-equipment/:poolId/registry
 */
exports.getPoolEquipmentRegistry = async (req, res) => {
  try {
    const result = await PoolEquipmentBusiness.getEquipmentRegistry(req.params.poolId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error || "Erro ao obter registo." });
    }
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao obter registo." });
  }
};

/**
 * ADICIONAR ASSET AO REGISTO
 * POST /api/pool-equipment/:poolId/assets/install
 */
exports.installRegistryAsset = async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || req.user?.role || "system";
    const result = await PoolEquipmentBusiness.addRegistryAsset(req.params.poolId, req.body || {}, actor);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error || "Erro ao adicionar asset." });
    }
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao adicionar asset." });
  }
};

/**
 * SUBSTITUIR ASSET
 * POST /api/pool-equipment/:poolId/assets/:assetId/replace
 */
exports.replaceRegistryAsset = async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || req.user?.role || "system";
    const result = await PoolEquipmentBusiness.replaceRegistryAsset(req.params.poolId, req.params.assetId, req.body || {}, actor);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error || "Erro ao substituir asset." });
    }
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao substituir asset." });
  }
};

/**
 * ATUALIZAR GARANTIA DE ASSET
 * POST /api/pool-equipment/:poolId/assets/:assetId/warranty
 */
exports.updateRegistryAssetWarranty = async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || req.user?.role || "system";
    const result = await PoolEquipmentBusiness.updateRegistryAssetWarranty(req.params.poolId, req.params.assetId, req.body || {}, actor);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error || "Erro ao atualizar garantia." });
    }
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar garantia." });
  }
};

/**
 * REMOVER ASSET
 * POST /api/pool-equipment/:poolId/assets/:assetId/remove
 */
exports.removeRegistryAsset = async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.name || req.user?.role || "system";
    const result = await PoolEquipmentBusiness.removeRegistryAsset(req.params.poolId, req.params.assetId, req.body || {}, actor);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error || "Erro ao remover asset." });
    }
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao remover asset." });
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

    const equipment = await PoolEquipmentBusiness.updateEquipment(id, req.body || {});

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

    await PoolEquipmentBusiness.deleteEquipment(id);

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao apagar equipamento." });
  }
};