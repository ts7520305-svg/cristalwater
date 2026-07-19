const prismaClient = require("../../prismaClient");
const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;
const { EVENT_TYPES, emitEquipmentStockEvent } = require("../../services/equipmentStockEventService");

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function normalizeInstallationNotes(notes, payloadNotes) {
  return [String(notes || "").trim(), String(payloadNotes || "").trim()].filter(Boolean).join(" | ") || null;
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeAssetKind(value) {
  const kind = String(value || "").trim().toUpperCase();
  if (["PUMP", "FILTER", "CHLORINATOR"].includes(kind)) return kind;
  return "GENERIC";
}

function buildAsset(payload = {}, overrides = {}) {
  const installedAt = payload.installedAt ? new Date(payload.installedAt).toISOString() : nowIso();
  return {
    assetId: overrides.assetId || payload.assetId || `AST-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    kind: normalizeAssetKind(payload.kind || payload.type),
    type: payload.type || payload.kind || "GENERIC",
    brand: payload.brand || null,
    model: payload.modelName || payload.model || null,
    serialNumber: payload.serialNumber || null,
    installedAt,
    installedBy: overrides.actor || payload.installedBy || "system",
    status: overrides.status || "ACTIVE",
    removedAt: null,
    removalReason: null,
    warranty: payload.warranty || null,
    notes: payload.notes || null,
  };
}

function mapAssetLifecycle(historyRows = []) {
  const sorted = [...historyRows].sort((a, b) => {
    const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (byTime !== 0) return byTime;
    return Number(a.id || 0) - Number(b.id || 0);
  });
  const assets = new Map();
  const replacementHistory = [];
  const warrantyHistory = [];

  for (const row of sorted) {
    const payload = parseJson(row.description, {}) || {};
    if (row.type === "EQUIPMENT_ASSET_INSTALLED" && payload.asset?.assetId) {
      assets.set(payload.asset.assetId, { ...payload.asset });
    }

    if (row.type === "EQUIPMENT_ASSET_REPLACED" && payload.oldAssetId && payload.newAsset?.assetId) {
      const previous = assets.get(payload.oldAssetId);
      if (previous) {
        assets.set(payload.oldAssetId, {
          ...previous,
          status: "REMOVED",
          removedAt: payload.replacedAt || nowIso(),
          removalReason: payload.reason || "REPLACED",
          replacedByAssetId: payload.newAsset.assetId,
        });
      }
      assets.set(payload.newAsset.assetId, { ...payload.newAsset, status: "ACTIVE" });
      replacementHistory.push({
        oldAssetId: payload.oldAssetId,
        newAssetId: payload.newAsset.assetId,
        reason: payload.reason || "REPLACED",
        replacedAt: payload.replacedAt || row.createdAt,
      });
    }

    if (row.type === "EQUIPMENT_ASSET_WARRANTY_UPDATED" && payload.assetId) {
      const existing = assets.get(payload.assetId);
      if (existing) {
        assets.set(payload.assetId, { ...existing, warranty: payload.warranty || existing.warranty || null });
      }
      warrantyHistory.push({
        assetId: payload.assetId,
        warranty: payload.warranty || null,
        at: payload.updatedAt || row.createdAt,
      });
    }

    if (row.type === "EQUIPMENT_ASSET_REMOVED" && payload.assetId) {
      const existing = assets.get(payload.assetId);
      if (existing) {
        assets.set(payload.assetId, {
          ...existing,
          status: "REMOVED",
          removedAt: payload.removedAt || row.createdAt,
          removalReason: payload.reason || "REMOVED",
        });
      }
    }
  }

  const allAssets = [...assets.values()];
  return {
    assets: allAssets,
    activeAssets: allAssets.filter((item) => item.status !== "REMOVED"),
    removedAssets: allAssets.filter((item) => item.status === "REMOVED"),
    replacementHistory,
    warrantyHistory,
    lifecycleHistory: sorted,
  };
}

async function listEquipment() {
  return prisma.poolEquipment.findMany({
    include: { pool: true },
    orderBy: { id: "asc" },
  });
}

async function getEquipmentById(equipmentId) {
  const id = toInt(equipmentId);
  if (!id) {
    throw new Error("ID inválido");
  }

  return prisma.poolEquipment.findUnique({
    where: { id },
    include: { pool: true },
  });
}

async function createEquipment(payload = {}) {
  const poolId = toInt(payload.poolId);
  return prisma.poolEquipment.create({
    data: {
      type: payload.type,
      brand: payload.brand,
      model: payload.modelName ?? payload.model ?? null,
      notes: payload.notes,
      poolId,
    },
  });
}

async function installEquipment(payload = {}, actor = "system") {
  const poolId = toInt(payload.poolId);
  if (!poolId) {
    return { ok: false, status: 400, error: "poolId obrigatório" };
  }

  const pool = await prisma.pool.findUnique({ where: { id: poolId }, include: { client: true } });
  if (!pool) {
    return { ok: false, status: 404, error: "Piscina não encontrada" };
  }

  const existing = await prisma.poolEquipment.findUnique({ where: { poolId } }).catch(() => null);
  const data = {
    type: payload.type ?? existing?.type ?? null,
    brand: payload.brand ?? existing?.brand ?? null,
    model: payload.modelName ?? payload.model ?? existing?.model ?? null,
    pumpType: payload.pumpType ?? existing?.pumpType ?? null,
    pumpPower: payload.pumpPower ?? existing?.pumpPower ?? null,
    filterType: payload.filterType ?? existing?.filterType ?? null,
    filterMedia: payload.filterMedia ?? existing?.filterMedia ?? null,
    saltSystem: payload.saltSystem === undefined ? (existing?.saltSystem ?? false) : Boolean(payload.saltSystem),
    saltLastAdded: payload.saltLastAdded ? new Date(payload.saltLastAdded) : existing?.saltLastAdded ?? null,
    saltQuantity: payload.saltQuantity === undefined ? existing?.saltQuantity ?? null : Number(payload.saltQuantity),
    lightsCount: payload.lightsCount === undefined ? existing?.lightsCount ?? null : Number(payload.lightsCount),
    lightsType: payload.lightsType ?? existing?.lightsType ?? null,
    hasLights: payload.hasLights === undefined ? (existing?.hasLights ?? true) : Boolean(payload.hasLights),
    brokenLightsCount: payload.brokenLightsCount === undefined ? existing?.brokenLightsCount ?? 0 : Number(payload.brokenLightsCount),
    lightsNotes: payload.lightsNotes ?? existing?.lightsNotes ?? null,
    notes: normalizeInstallationNotes(existing?.notes, payload.notes),
  };

  const equipment = existing
    ? await prisma.poolEquipment.update({ where: { poolId }, data })
    : await prisma.poolEquipment.create({ data: { poolId, ...data } });

  const installationHistory = await prisma.technicalHistory.create({
    data: {
      poolId,
      type: "EQUIPMENT_INSTALLATION",
      component: payload.component || equipment.type || "EQUIPMENT",
      message: payload.message || "Equipamento instalado",
      description: JSON.stringify({
        poolId,
        equipmentId: equipment.id,
        actor,
        installedAt: new Date().toISOString(),
      }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    },
  });

  if (prisma.userAuditLog?.create) {
    await prisma.userAuditLog.create({
      data: {
        actor,
        action: "EQUIPMENT_INSTALLATION",
        entity: "PoolEquipment",
        entityId: String(equipment.id),
        metadata: { poolId, equipmentId: equipment.id },
      },
    }).catch(() => null);
  }

  await emitEquipmentStockEvent(EVENT_TYPES.EQUIPMENT_INSTALLATION, {
    poolId,
    equipmentId: equipment.id,
    actor,
    source: "pool-equipment-installation",
  });

  const asset = buildAsset(payload, { actor });
  await prisma.technicalHistory.create({
    data: {
      poolId,
      type: "EQUIPMENT_ASSET_INSTALLED",
      component: asset.kind,
      message: `Asset instalado: ${asset.kind}`,
      description: JSON.stringify({ poolId, equipmentId: equipment.id, asset, actor, installedAt: asset.installedAt }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    },
  });

  return { ok: true, equipment, installationHistory };
}

async function getEquipmentRegistry(poolId) {
  const id = toInt(poolId);
  if (!id) return { ok: false, status: 400, error: "poolId inválido" };

  const pool = await prisma.pool.findUnique({ where: { id } });
  if (!pool) return { ok: false, status: 404, error: "Piscina não encontrada" };

  const history = await prisma.technicalHistory.findMany({
    where: {
      poolId: id,
      type: { in: ["EQUIPMENT_ASSET_INSTALLED", "EQUIPMENT_ASSET_REPLACED", "EQUIPMENT_ASSET_WARRANTY_UPDATED", "EQUIPMENT_ASSET_REMOVED"] },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const lifecycle = mapAssetLifecycle(history);
  return {
    ok: true,
    poolId: id,
    registry: {
      pumps: lifecycle.activeAssets.filter((item) => item.kind === "PUMP"),
      filters: lifecycle.activeAssets.filter((item) => item.kind === "FILTER"),
      chlorinators: lifecycle.activeAssets.filter((item) => item.kind === "CHLORINATOR"),
      activeAssets: lifecycle.activeAssets,
      removedAssets: lifecycle.removedAssets,
      replacementHistory: lifecycle.replacementHistory,
      warrantyHistory: lifecycle.warrantyHistory,
      assetLifecycle: lifecycle.lifecycleHistory,
    },
  };
}

async function addRegistryAsset(poolId, payload = {}, actor = "system") {
  const id = toInt(poolId);
  if (!id) return { ok: false, status: 400, error: "poolId inválido" };
  const pool = await prisma.pool.findUnique({ where: { id } });
  if (!pool) return { ok: false, status: 404, error: "Piscina não encontrada" };

  const asset = buildAsset(payload, { actor });
  const history = await prisma.technicalHistory.create({
    data: {
      poolId: id,
      type: "EQUIPMENT_ASSET_INSTALLED",
      component: asset.kind,
      message: `Asset instalado: ${asset.kind}`,
      description: JSON.stringify({ poolId: id, asset, actor, installedAt: asset.installedAt }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    },
  });

  await emitEquipmentStockEvent(EVENT_TYPES.EQUIPMENT_INSTALLATION, {
    poolId: id,
    assetId: asset.assetId,
    kind: asset.kind,
    actor,
    source: "pool-equipment-registry",
  });

  return { ok: true, asset, history };
}

async function replaceRegistryAsset(poolId, assetId, payload = {}, actor = "system") {
  const id = toInt(poolId);
  if (!id) return { ok: false, status: 400, error: "poolId inválido" };

  const registry = await getEquipmentRegistry(id);
  if (!registry.ok) return registry;

  const current = registry.registry.activeAssets.find((item) => item.assetId === String(assetId));
  if (!current) return { ok: false, status: 404, error: "Asset ativo não encontrado" };

  const replacementAsset = buildAsset({ ...payload, kind: payload.kind || current.kind }, { actor });
  const replacedAt = nowIso();
  const history = await prisma.technicalHistory.create({
    data: {
      poolId: id,
      type: "EQUIPMENT_ASSET_REPLACED",
      component: current.kind,
      message: `Asset substituído: ${current.assetId}`,
      description: JSON.stringify({
        poolId: id,
        oldAssetId: current.assetId,
        newAsset: replacementAsset,
        reason: payload.reason || "REPLACEMENT",
        replacedAt,
        actor,
      }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    },
  });

  await emitEquipmentStockEvent(EVENT_TYPES.EQUIPMENT_STATUS_CHANGED, {
    poolId: id,
    oldAssetId: current.assetId,
    newAssetId: replacementAsset.assetId,
    status: "REPLACED",
    actor,
    source: "pool-equipment-registry",
  });

  return { ok: true, replaced: current, replacement: replacementAsset, history };
}

async function updateRegistryAssetWarranty(poolId, assetId, payload = {}, actor = "system") {
  const id = toInt(poolId);
  if (!id) return { ok: false, status: 400, error: "poolId inválido" };

  const registry = await getEquipmentRegistry(id);
  if (!registry.ok) return registry;
  const asset = registry.registry.activeAssets.find((item) => item.assetId === String(assetId));
  if (!asset) return { ok: false, status: 404, error: "Asset ativo não encontrado" };

  const warranty = {
    provider: payload.provider || null,
    startAt: payload.startAt || null,
    validUntil: payload.validUntil || null,
    policyNumber: payload.policyNumber || null,
    notes: payload.notes || null,
  };

  const history = await prisma.technicalHistory.create({
    data: {
      poolId: id,
      type: "EQUIPMENT_ASSET_WARRANTY_UPDATED",
      component: asset.kind,
      message: `Garantia atualizada para asset ${asset.assetId}`,
      description: JSON.stringify({ poolId: id, assetId: asset.assetId, warranty, updatedAt: nowIso(), actor }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    },
  });

  await emitEquipmentStockEvent(EVENT_TYPES.EQUIPMENT_WARRANTY_UPDATED, {
    poolId: id,
    assetId: asset.assetId,
    actor,
    source: "pool-equipment-registry",
  });

  return { ok: true, assetId: asset.assetId, warranty, history };
}

async function removeRegistryAsset(poolId, assetId, payload = {}, actor = "system") {
  const id = toInt(poolId);
  if (!id) return { ok: false, status: 400, error: "poolId inválido" };

  const registry = await getEquipmentRegistry(id);
  if (!registry.ok) return registry;
  const asset = registry.registry.activeAssets.find((item) => item.assetId === String(assetId));
  if (!asset) return { ok: false, status: 404, error: "Asset ativo não encontrado" };

  const history = await prisma.technicalHistory.create({
    data: {
      poolId: id,
      type: "EQUIPMENT_ASSET_REMOVED",
      component: asset.kind,
      message: `Asset removido: ${asset.assetId}`,
      description: JSON.stringify({
        poolId: id,
        assetId: asset.assetId,
        removedAt: nowIso(),
        reason: payload.reason || "REMOVED",
        actor,
      }),
      status: "DONE",
      performedAt: new Date(),
      doneAt: new Date(),
    },
  });

  await emitEquipmentStockEvent(EVENT_TYPES.EQUIPMENT_STATUS_CHANGED, {
    poolId: id,
    assetId: asset.assetId,
    status: "REMOVED",
    actor,
    source: "pool-equipment-registry",
  });

  return { ok: true, assetId: asset.assetId, history };
}

async function updateEquipment(equipmentId, payload = {}) {
  const id = toInt(equipmentId);
  if (!id) {
    throw new Error("ID inválido");
  }

  return prisma.poolEquipment.update({
    where: { id },
    data: { ...payload, model: payload.modelName ?? payload.model ?? undefined, modelName: undefined },
  });
}

async function deleteEquipment(equipmentId) {
  const id = toInt(equipmentId);
  if (!id) {
    throw new Error("ID inválido");
  }

  return prisma.poolEquipment.delete({ where: { id } });
}

module.exports = {
  listEquipment,
  getEquipmentById,
  createEquipment,
  installEquipment,
  getEquipmentRegistry,
  addRegistryAsset,
  replaceRegistryAsset,
  updateRegistryAssetWarranty,
  removeRegistryAsset,
  updateEquipment,
  deleteEquipment,
};
