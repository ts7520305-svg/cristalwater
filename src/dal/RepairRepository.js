const prismaClient = require("../prismaClient");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

async function getRepair(repairId, db = prisma) {
  return db.repair.findUnique({
    where: { id: Number(repairId) },
    include: {
      attachments: { orderBy: { createdAt: "desc" } },
      pool: {
        include: {
          client: true,
          equipment: true,
          technicalHistory: { orderBy: { createdAt: "desc" }, take: 10 },
          technicalSheet: true,
        },
      },
    },
  });
}

async function getPoolRepairContext(poolId, db = prisma) {
  return db.pool.findUnique({
    where: { id: Number(poolId) },
    include: {
      client: true,
      equipment: true,
      technicalHistory: { orderBy: { createdAt: "desc" }, take: 10 },
      technicalSheet: true,
    },
  });
}

async function listRepairsByPool(poolId, db = prisma) {
  return db.repair.findMany({
    where: { poolId: Number(poolId) },
    orderBy: { createdAt: "desc" },
  });
}

async function createRepair(db, data) {
  return db.repair.create({ data });
}

async function updateRepair(db, repairId, data) {
  return db.repair.update({
    where: { id: Number(repairId) },
    data,
  });
}

async function deleteRepair(db, repairId) {
  return db.repair.delete({ where: { id: Number(repairId) } });
}

async function createTechnicalHistory(db, data) {
  if (!db.technicalHistory?.create) return null;
  return db.technicalHistory.create({ data }).catch(() => null);
}

async function createNotification(db, data) {
  if (!db.notification?.create) return null;
  return db.notification.create({ data }).catch(() => null);
}

async function createAudit(db, data) {
  if (!db.auditTrail?.create) return null;
  const payload = {
    eventType: data?.eventType || data?.action || "REPAIR_EVENT",
    ...data,
  };
  return db.auditTrail.create({ data: payload }).catch(() => null);
}

async function createAttachment(db, data) {
  if (!db.attachment?.create) return null;
  return db.attachment.create({ data }).catch(() => null);
}

async function listRepairAttachments(repairId, db = prisma) {
  if (!db.attachment?.findMany) return [];
  return db.attachment.findMany({
    where: { repairId: Number(repairId) },
    orderBy: { createdAt: "desc" },
  });
}

async function transaction(callback) {
  return prisma.$transaction(callback);
}

module.exports = {
  prisma,
  transaction,
  getRepair,
  getPoolRepairContext,
  listRepairsByPool,
  createRepair,
  updateRepair,
  deleteRepair,
  createTechnicalHistory,
  createNotification,
  createAudit,
  createAttachment,
  listRepairAttachments,
};