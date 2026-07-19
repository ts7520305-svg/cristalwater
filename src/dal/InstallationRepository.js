const prismaClient = require("../prismaClient");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getPoolContext(poolId, db = prisma) {
  return db.pool.findUnique({
    where: { id: asNumber(poolId, 0) },
    include: { client: true, equipment: true },
  });
}

async function createWorkflow(db, data) {
  return db.operationalLock.create({ data });
}

async function getWorkflow(installationId, db = prisma) {
  return db.operationalLock.findUnique({ where: { id: asNumber(installationId, 0) } });
}

async function updateWorkflow(db, installationId, data) {
  return db.operationalLock.update({ where: { id: asNumber(installationId, 0) }, data });
}

async function getStockReservation(installationId, db = prisma) {
  return db.operationalLock.findFirst({
    where: {
      lockType: "INSTALLATION_STOCK_RESERVATION",
      entity: "Installation",
      entityId: asNumber(installationId, 0),
      status: { in: ["APPROVED", "RESOLVED"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function createStockReservation(db, data) {
  return db.operationalLock.create({ data });
}

async function updateStockReservation(db, id, data) {
  return db.operationalLock.update({ where: { id: asNumber(id, 0) }, data });
}

async function createTask(db, data) {
  if (!db.task?.create) return null;
  return db.task.create({ data });
}

async function createAttachment(db, data) {
  if (!db.attachment?.create) return null;
  return db.attachment.create({ data });
}

async function createTechnicalHistory(db, data) {
  if (!db.technicalHistory?.create) return null;
  return db.technicalHistory.create({ data });
}

async function createNotification(db, data) {
  if (!db.notification?.create) return null;
  return db.notification.create({ data });
}

async function createClientMessage(db, data) {
  if (!db.clientMessage?.create) return null;
  return db.clientMessage.create({ data });
}

async function createAudit(db, data) {
  if (!db.auditTrail?.create) return null;
  return db.auditTrail.create({ data: { eventType: data?.eventType || data?.action || "INSTALLATION_EVENT", ...data } });
}

async function upsertPoolEquipment(db, poolId, data) {
  return db.poolEquipment.upsert({
    where: { poolId: asNumber(poolId, 0) },
    update: data,
    create: { poolId: asNumber(poolId, 0), ...data },
  });
}

async function transaction(callback) {
  return prisma.$transaction(callback);
}

module.exports = {
  prisma,
  asNumber,
  getPoolContext,
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  getStockReservation,
  createStockReservation,
  updateStockReservation,
  createTask,
  createAttachment,
  createTechnicalHistory,
  createNotification,
  createClientMessage,
  createAudit,
  upsertPoolEquipment,
  transaction,
};
