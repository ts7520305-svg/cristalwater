const prismaClient = require("../prismaClient");

const prisma = global.__CRISTAL_WATER_PRISMA__ || prismaClient?.prisma || prismaClient;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sanitizeTake(value, fallback = undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const take = Math.trunc(parsed);
  if (take <= 0) return fallback;
  return Math.min(take, 20000);
}

async function getInvoice(invoiceId) {
  return prisma.invoice.findUnique({
    where: { id: Number(invoiceId) },
    include: { client: true, lines: true, payments: true },
  });
}

async function getInvoices(where = {}, options = {}) {
  const take = sanitizeTake(options.take);
  return prisma.invoice.findMany({
    where,
    include: { client: true, lines: true, payments: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    ...(take ? { take } : {}),
  });
}

async function createInvoice(data) {
  return prisma.invoice.create({
    data,
    include: { client: true, lines: true, payments: true },
  });
}

async function updateInvoice(invoiceId, data) {
  return prisma.invoice.update({
    where: { id: Number(invoiceId) },
    data,
    include: { client: true, lines: true, payments: true },
  });
}

async function createInvoiceLine(tx, data) {
  return tx.invoiceLine.create({ data });
}

async function createPayment(tx, data) {
  return tx.payment.create({ data });
}

async function getClient(clientId) {
  return prisma.client.findUnique({ where: { id: Number(clientId) } });
}

async function updateClient(tx, clientId, data) {
  return tx.client.update({ where: { id: Number(clientId) }, data });
}

async function createCommunicationLog(tx, data) {
  return tx.communicationLog.create({ data }).catch(() => null);
}

async function createNotification(tx, data) {
  return tx.notification.create({ data }).catch(() => null);
}

async function createAudit(tx, data) {
  if (!tx.auditTrail?.create) return null;
  const payload = {
    eventType: data?.eventType || data?.action || "FINANCE_EVENT",
    ...data,
  };
  return tx.auditTrail.create({ data: payload }).catch(() => null);
}

async function transaction(callback) {
  return prisma.$transaction(callback);
}

async function findOverdueInvoices(now = new Date()) {
  return prisma.invoice.findMany({
    where: {
      dueDate: { lt: now },
      amountOpen: { gt: 0 },
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
    },
    include: { client: true, lines: true, payments: true },
    orderBy: { dueDate: "asc" },
  });
}

async function listPayments(where = {}, options = {}) {
  const take = sanitizeTake(options.take);
  return prisma.payment.findMany({
    where,
    include: { invoice: { include: { client: true } } },
    orderBy: { paidAt: "desc" },
    ...(take ? { take } : {}),
  });
}

async function listAuditTrail(where = {}) {
  if (!prisma.auditTrail?.findMany) return [];
  return prisma.auditTrail.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

async function listTechnicians(options = {}) {
  const take = sanitizeTake(options.take);
  return prisma.technician.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    ...(take ? { take } : {}),
  });
}

async function listClients(where = {}, options = {}) {
  const take = sanitizeTake(options.take);
  return prisma.client.findMany({
    where,
    orderBy: { name: "asc" },
    ...(take ? { take } : {}),
  });
}

async function listServiceVisits(where = {}, options = {}) {
  const take = sanitizeTake(options.take);
  return prisma.serviceVisit.findMany({
    where,
    include: { client: true, technician: true },
    orderBy: { plannedDate: "desc" },
    ...(take ? { take } : {}),
  });
}

async function listStockMovements(where = {}, options = {}) {
  const take = sanitizeTake(options.take);
  return prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
  });
}

async function listInventoryProducts() {
  return prisma.inventoryProduct.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
}

function groupByMonth(rows, dateField, amountField) {
  const map = new Map();
  for (const row of rows || []) {
    const date = row?.[dateField] ? new Date(row[dateField]) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    map.set(key, toNumber(map.get(key), 0) + toNumber(row?.[amountField], 0));
  }
  return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([monthRef, amount]) => ({ monthRef, amount }));
}

module.exports = {
  prisma,
  toNumber,
  toDate,
  getInvoice,
  getInvoices,
  createInvoice,
  updateInvoice,
  createInvoiceLine,
  createPayment,
  getClient,
  updateClient,
  createCommunicationLog,
  createNotification,
  createAudit,
  transaction,
  findOverdueInvoices,
  listPayments,
  listAuditTrail,
  listTechnicians,
  listClients,
  listServiceVisits,
  listStockMovements,
  listInventoryProducts,
  groupByMonth,
};
