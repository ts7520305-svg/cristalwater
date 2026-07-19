const prismaClient = require("../prismaClient");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function createWorkflow(db, data) {
  return db.operationalLock.create({ data });
}

async function getWorkflow(moduleId, db = prisma) {
  return db.operationalLock.findUnique({ where: { id: asNumber(moduleId, 0) } });
}

async function updateWorkflow(db, moduleId, data) {
  return db.operationalLock.update({ where: { id: asNumber(moduleId, 0) }, data });
}

async function createAudit(db, data) {
  if (!db.auditTrail?.create) return null;
  return db.auditTrail.create({ data: { eventType: data?.eventType || data?.action || "ADMINISTRATION_EVENT", ...data } });
}

async function createNotification(db, data) {
  if (!db.notification?.create) return null;
  return db.notification.create({ data });
}

async function createTask(db, data) {
  if (!db.task?.create) return null;
  return db.task.create({ data });
}

async function createChatMessage(db, data) {
  if (!db.chatMessage?.create) return null;
  return db.chatMessage.create({ data });
}

async function createSupplierAccount(db, data) {
  if (!db.supplierAccount?.create) return null;
  return db.supplierAccount.create({ data });
}

async function updateSupplierAccount(db, id, data) {
  if (!db.supplierAccount?.update) return null;
  return db.supplierAccount.update({ where: { id: asNumber(id, 0) }, data });
}

async function listSuppliers(db = prisma) {
  if (!db.supplierAccount?.findMany) return [];
  return db.supplierAccount.findMany({ orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }] });
}

async function createPurchase(db, data) {
  if (!db.stockPurchase?.create) return null;
  return db.stockPurchase.create({ data, include: { items: true } });
}

async function listPurchases(db = prisma, take = 50) {
  if (!db.stockPurchase?.findMany) return [];
  return db.stockPurchase.findMany({ orderBy: { createdAt: "desc" }, take, include: { items: true } });
}

async function listVehicles(db = prisma) {
  if (!db.vehicle?.findMany) return [];
  return db.vehicle.findMany({ orderBy: [{ active: "desc" }, { updatedAt: "desc" }] });
}

async function upsertVehicle(db, data = {}) {
  if (!db.vehicle?.findUnique || !db.vehicle?.create || !db.vehicle?.update) return null;
  const plate = String(data.plate || "").trim();
  if (!plate) return null;

  const existing = await db.vehicle.findUnique({ where: { plate } });
  if (existing) {
    return db.vehicle.update({ where: { id: existing.id }, data });
  }

  return db.vehicle.create({ data });
}

async function listVehicleMaintenance(db = prisma, take = 100) {
  if (!db.vehicleMaintenanceRecord?.findMany) return [];
  return db.vehicleMaintenanceRecord.findMany({ orderBy: { createdAt: "desc" }, take });
}

async function createVehicleMaintenance(db, data) {
  if (!db.vehicleMaintenanceRecord?.create) return null;
  return db.vehicleMaintenanceRecord.create({ data });
}

async function listTasks(db = prisma, take = 200) {
  if (!db.task?.findMany) return [];
  return db.task.findMany({ orderBy: { updatedAt: "desc" }, take });
}

async function listNotifications(db = prisma, take = 200) {
  if (!db.notification?.findMany) return [];
  return db.notification.findMany({ orderBy: { createdAt: "desc" }, take });
}

async function listAudit(db = prisma, take = 200) {
  if (!db.auditTrail?.findMany) return [];
  return db.auditTrail.findMany({ orderBy: { createdAt: "desc" }, take });
}

async function listTechnicians(db = prisma) {
  if (!db.technician?.findMany) return [];
  return db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

async function listVisitsByMonth(monthRef, db = prisma) {
  if (!db.visit?.findMany) return [];
  const start = new Date(`${monthRef}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return db.visit.findMany({ where: { plannedDate: { gte: start, lt: end } } });
}

async function listWorkDaysByMonth(monthRef, db = prisma) {
  if (!db.technicianWorkDay?.findMany) return [];
  const start = new Date(`${monthRef}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return db.technicianWorkDay.findMany({ where: { date: { gte: start, lt: end } } });
}

async function transaction(callback) {
  return prisma.$transaction(callback);
}

module.exports = {
  prisma,
  asNumber,
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  createAudit,
  createNotification,
  createTask,
  createChatMessage,
  createSupplierAccount,
  updateSupplierAccount,
  listSuppliers,
  createPurchase,
  listPurchases,
  listVehicles,
  upsertVehicle,
  listVehicleMaintenance,
  createVehicleMaintenance,
  listTasks,
  listNotifications,
  listAudit,
  listTechnicians,
  listVisitsByMonth,
  listWorkDaysByMonth,
  transaction,
};
