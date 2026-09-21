const { activeFor } = require('./notificationScopeService');
const fs = require("fs");
const path = require("path");
const { prisma } = require("../prismaClient");
const { buildClientPaymentReference } = require("../utils/clientPaymentReference");
const { resolveUploadSubdir } = require("../config/uploadPath");

const DOCUMENT_BASE_DIR = resolveUploadSubdir("documents");
const DOCUMENT_MANIFEST_PATH = path.join(DOCUMENT_BASE_DIR, "manifest.json");

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readDocumentManifest() {
  let file;
  try {
    if (!fs.lstatSync(DOCUMENT_BASE_DIR).isDirectory()) throw Error('Invalid document directory');
    try { file = fs.openSync(DOCUMENT_MANIFEST_PATH, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0)); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const stat = fs.fstatSync(file);
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw Error('Invalid document manifest');
    const buffer = Buffer.alloc(stat.size + 1); let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(file, buffer, length, buffer.length - length, length);
      if (!count) break;
      length += count;
    }
    if (length !== stat.size) throw Error('Document manifest changed');
    const raw = buffer.subarray(0, length).toString('utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw Error('Invalid document manifest');
    return parsed;
  } catch {
    throw Object.assign(Error('Não foi possível confirmar os documentos. Tente novamente.'), { statusCode: 503 });
  } finally {
    if (file !== undefined) fs.closeSync(file);
  }
}

function validDocumentFilename(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 && !value.startsWith('.') &&
    !/[\\/\x00-\x1f\x7f]/.test(value) && value !== 'manifest.json' && path.basename(value) === value;
}

async function openDocumentFile(filename) {
  let file;
  try {
    if (!validDocumentFilename(filename) || !(await fs.promises.lstat(DOCUMENT_BASE_DIR)).isDirectory()) throw Object.assign(Error(), { code: 'ENOENT' });
    file = await fs.promises.open(path.join(DOCUMENT_BASE_DIR, filename), fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const stat = await file.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 50 * 1024 * 1024) throw Object.assign(Error(), { code: 'ENOENT' });
    return { file, size: stat.size };
  } catch (error) {
    if (file) await file.close().catch(() => {});
    const missing = ['ENOENT', 'ENOTDIR', 'ELOOP', 'EISDIR', 'ENXIO'].includes(error.code);
    throw Object.assign(Error(missing ? 'Documento não encontrado.' : 'Não foi possível abrir o documento. Tente novamente.'), { statusCode: missing ? 404 : 503 });
  }
}

async function documentOwnershipSources(clientId, visitIds) {
  return prisma.$transaction(async db => {
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    const visits = [];
    for (let offset = 0; offset < visitIds.length; offset += 1000) visits.push(...await db.serviceVisit.findMany({
      where: { id: { in: visitIds.slice(offset, offset + 1000) } }, select: { id: true, clientId: true, poolId: true },
    }));
    return { client, visits };
  }, { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 20000 });
}

function normalizeDocument(document) {
  return {
    id: document.id,
    entity: document.entity || null,
    entityId: document.entityId || null,
    clientId: document.clientId || null,
    poolId: document.poolId || null,
    visitId: document.visitId || null,
    alertId: document.alertId || null,
    repairId: document.repairId || null,
    title: document.title || document.originalName || "Documento",
    type: document.type || null,
    originalName: document.originalName || null,
    notes: document.notes || null,
    url: document.url || null,
    createdAt: document.createdAt || null,
  };
}

function normalizeNotification(notification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    eventType: notification.eventType,
    severity: notification.severity,
    status: notification.isRead ? "READ" : "PENDING",
    isRead: Boolean(notification.isRead),
    createdAt: notification.createdAt,
    metadata: notification.metadata || {},
    clientId: notification.clientId || null,
  };
}

function normalizeMessage(message) {
  return {
    id: message.id,
    clientId: message.clientId,
    sender: message.sender || (message.senderType === "CLIENT" ? "Cliente" : "Cristal Water"),
    senderType: message.senderType || "ADMIN",
    identityVerified: message.senderType !== 'LEGACY' && !!message.actorKey,
    text: message.text || message.message || "",
    message: message.message || message.text || "",
    messageType: message.messageType || "TEXT",
    fileUrl: message.fileUrl || null,
    fileName: message.fileName || null,
    isReadByAdmin: Boolean(message.isReadByAdmin),
    isReadByClient: Boolean(message.isReadByClient),
    seen: Boolean(message.seen),
    seenAt: message.seenAt || null,
    createdAt: message.createdAt || null,
  };
}

function customerPermissions(client) {
  const status = String(client?.status || "").toUpperCase();
  return {
    readOnly: true,
    canRequestVisit: Boolean(client && client.active !== false && status === "ACTIVE"),
    canSendMessages: Boolean(client && client.active !== false),
    canViewInvoices: true,
    canViewDocuments: true,
    canViewHistory: true,
    canViewNotifications: true,
    canDownloadSecureDocuments: true,
    contractActive: Boolean(client?.contractActive),
    billingActive: Boolean(client?.billingActive),
    paymentReference: client ? buildClientPaymentReference(client.id) : null,
    isolation: {
      clientId: client?.id || null,
      scope: "client-owned-data-only",
    },
  };
}

async function markCustomerNotificationRead(clientId, notificationId) {
  const result=await prisma.notification.updateMany({
    where:{...activeFor({role:'CLIENT',clientId}),id:notificationId},
    data:{isRead:true,readAt:new Date()},
  });
  return result.count>0;
}

async function listCustomerNotifications(clientId) {
  const notifications = await prisma.notification.findMany({
    where: activeFor({role:'CLIENT',clientId}),
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return notifications.map(normalizeNotification);
}

async function listCustomerMessages(clientId) {
  await require('./clientChatHistoryService').ensure();
  const messages = await prisma.clientMessage.findMany({
    where: { clientId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return messages.map(normalizeMessage);
}

async function listCustomerHistory(clientId) {
  const visits = await prisma.serviceVisit.findMany({
    where: {
      OR: [
        { clientId },
        { pool: { is: { clientId } } },
      ],
    },
    include: {
      pool: {
        include: {
          client: true,
          equipment: true,
          technicalSheet: true,
          technicalAlerts: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
        },
      },
      technician: true,
      photos: true,
      chemicals: true,
    },
    orderBy: [
      { plannedDate: "desc" },
      { date: "desc" },
      { createdAt: "desc" },
    ],
    take: 300,
  });

  const grouped = new Map();

  for (const visit of visits) {
    const poolId = visit.poolId || visit.pool?.id || null;
    if (!poolId) continue;

    if (!grouped.has(poolId)) {
      grouped.set(poolId, {
        poolId,
        poolName: visit.pool?.name || visit.pool?.location || "Piscina",
        zone: visit.pool?.zone || null,
        serviceVisits: [],
      });
    }

    grouped.get(poolId).serviceVisits.push({
      id: visit.id,
      date: visit.date || visit.plannedDate || visit.createdAt,
      plannedDate: visit.plannedDate || null,
      startAt: visit.startAt || null,
      endAt: visit.endAt || null,
      status: visit.status || "PLANNED",
      technicianName: visit.technicianName || visit.technician?.name || "Cristal Water",
      notes: visit.notes || null,
      internalNotes: visit.internalNotes || null,
      alerts: visit.alerts || null,
      products: visit.products || null,
      ph: visit.ph ?? null,
      chlorine: visit.chlorine ?? null,
      alkalinity: visit.alkalinity ?? null,
      salt: visit.salt ?? null,
      temperature: visit.temperature ?? null,
      orpMv: visit.orpMv ?? null,
      photos: (visit.photos || []).map((photo) => ({
        id: photo.id,
        url: photo.url,
        type: photo.type,
        createdAt: photo.createdAt,
      })),
      chemicals: (visit.chemicals || []).map((chemical) => ({
        id: chemical.id,
        name: chemical.name,
        quantity: chemical.quantity,
        unit: chemical.unit,
      })),
      pool: {
        id: visit.pool?.id || null,
        name: visit.pool?.name || null,
        type: visit.pool?.type || null,
      },
    });
  }

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    serviceVisits: group.serviceVisits.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
  }));
}

async function getClientOwnershipScope(clientId) {
  const [client, pools, visits] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        status: true,
        active: true,
        billingActive: true,
        contractActive: true,
        creditBalance: true,
      },
    }),
    prisma.pool.findMany({
      where: { clientId },
      select: { id: true },
    }),
    prisma.serviceVisit.findMany({
      where: {
        OR: [
          { clientId },
          { pool: { is: { clientId } } },
        ],
      },
      select: { id: true, poolId: true },
    }),
  ]);

  return {
    client,
    poolIds: (pools || []).map((pool) => pool.id),
    visitIds: (visits || []).map((visit) => visit.id),
  };
}

async function createVisitRequest(clientId, body, user) {
  return require('../business/portal/ClientPortalRequestBusiness').create(user, clientId, 'VISIT_REQUEST', body);
}

module.exports = {
  customerPermissions,
  createVisitRequest,
  getClientOwnershipScope,
  listCustomerHistory,
  listCustomerMessages,
  listCustomerNotifications,
  markCustomerNotificationRead,
  readDocumentManifest,
  validDocumentFilename,
  openDocumentFile,
  documentOwnershipSources,
  normalizeDocument,
  normalizeMessage,
  normalizeNotification,
  safeNumber,
};
