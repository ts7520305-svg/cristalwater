const prismaClient = require("../prismaClient");
const BaseRepository = require("./BaseRepository");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

const equipmentRepo = new BaseRepository(prisma.poolEquipment);
const productRepo = new BaseRepository(prisma.inventoryProduct);
const movementRepo = new BaseRepository(prisma.stockMovement);
const balanceRepo = new BaseRepository(prisma.stockBalance);
const historyRepo = new BaseRepository(prisma.technicalHistory);
const attachmentRepo = new BaseRepository(prisma.attachment);
const repairRepo = new BaseRepository(prisma.repair);
const notificationRepo = new BaseRepository(prisma.notification);

function cleanString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeName(value) {
  return cleanString(value).replace(/\s+/g, " ").toUpperCase();
}

function normalizeUnit(value) {
  const unit = normalizeName(value || "KG");
  return unit || "KG";
}

function stockKey({ scope, vehicleId, productName, unit }) {
  return {
    scope: cleanString(scope || "CENTRAL") || "CENTRAL",
    vehicleId: vehicleId == null ? null : asNumber(vehicleId, 0) || null,
    productName: normalizeName(productName),
    unit: normalizeUnit(unit),
  };
}

async function listEquipmentInventory(where = {}) {
  return equipmentRepo.findAll({
    where,
    include: {
      pool: { include: { client: true, technicalAlerts: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function getEquipmentById(id) {
  return equipmentRepo.findById(id);
}

async function listEquipmentHistory(poolId) {
  return historyRepo.findAll({
    where: {
      poolId: asNumber(poolId, 0),
      OR: [
        { type: { startsWith: "EQUIPMENT_" } },
        { component: { contains: "equip", mode: "insensitive" } },
      ],
    },
    orderBy: { performedAt: "desc" },
    take: 200,
  });
}

async function listEquipmentRepairs(poolId) {
  return repairRepo.findAll({
    where: { poolId: asNumber(poolId, 0) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

async function listEquipmentAttachments(poolId) {
  return attachmentRepo.findAll({
    where: { poolId: asNumber(poolId, 0) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

async function createEquipmentHistory(data = {}) {
  return historyRepo.create(data);
}

async function updateEquipment(equipmentId, data = {}) {
  return equipmentRepo.update(equipmentId, data);
}

async function listProducts(where = {}) {
  return productRepo.findAll({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: 500,
  });
}

async function listBalances(where = {}) {
  return balanceRepo.findAll({
    where,
    orderBy: [{ scope: "asc" }, { productName: "asc" }],
    take: 2000,
  });
}

async function listMovements(where = {}, take = 500) {
  return movementRepo.findAll({
    where,
    orderBy: { createdAt: "desc" },
    take,
  });
}

async function findBalance(tx, key) {
  const normalized = stockKey(key || {});
  return tx.stockBalance.findFirst({
    where: {
      scope: normalized.scope,
      vehicleId: normalized.vehicleId,
      productName: normalized.productName,
      unit: normalized.unit,
    },
  });
}

async function adjustBalance(tx, payload = {}) {
  const key = stockKey(payload);
  const delta = asNumber(payload.delta, 0);
  const category = cleanString(payload.category || "CHEMICAL") || "CHEMICAL";
  const productId = payload.productId ? asNumber(payload.productId, 0) : null;

  const existing = await findBalance(tx, key);
  const current = asNumber(existing?.quantity, 0);
  const nextQuantity = current + delta;

  if (delta < 0 && nextQuantity < 0) {
    throw new Error(`STOCK_NEGATIVE_GUARD: ${key.productName} indisponivel em ${key.scope}. Disponivel ${current} ${key.unit}.`);
  }

  if (existing) {
    return tx.stockBalance.update({
      where: { id: existing.id },
      data: {
        quantity: nextQuantity,
        productId: productId || existing.productId,
        category: category || existing.category,
      },
    });
  }

  if (delta < 0) {
    throw new Error(`STOCK_NOT_FOUND: ${key.productName} nao encontrado em ${key.scope}.`);
  }

  return tx.stockBalance.create({
    data: {
      scope: key.scope,
      vehicleId: key.vehicleId,
      productName: key.productName,
      productId,
      category,
      unit: key.unit,
      quantity: delta,
    },
  });
}

async function createMovement(tx, data = {}) {
  return tx.stockMovement.create({ data });
}

async function createAuditTrail(tx, data = {}) {
  if (!tx.auditTrail?.create) return null;
  const payload = {
    eventType: data?.eventType || data?.action || "EQUIPMENT_STOCK_EVENT",
    ...data,
  };
  return tx.auditTrail.create({ data: payload }).catch(() => null);
}

async function createNotification(tx, data = {}) {
  return tx.notification.create({ data });
}

module.exports = {
  prisma,
  listEquipmentInventory,
  getEquipmentById,
  listEquipmentHistory,
  listEquipmentRepairs,
  listEquipmentAttachments,
  createEquipmentHistory,
  updateEquipment,
  listProducts,
  listBalances,
  listMovements,
  adjustBalance,
  createMovement,
  createAuditTrail,
  createNotification,
};
