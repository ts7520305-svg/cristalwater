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
  try {
    const raw = fs.readFileSync(DOCUMENT_MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    text: message.text || message.message || "",
    message: message.message || message.text || "",
    messageType: message.messageType || "TEXT",
    fileUrl: message.fileUrl || null,
    fileName: message.fileName || null,
    isReadByAdmin: Boolean(message.isReadByAdmin),
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

async function listCustomerNotifications(clientId) {
  const notifications = await prisma.notification.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return notifications.map(normalizeNotification);
}

async function listCustomerMessages(clientId) {
  const messages = await prisma.clientMessage.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 100,
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

async function listCustomerDocuments(clientId) {
  const [clientPools, visits] = await Promise.all([
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

  const poolIds = new Set((clientPools || []).map((pool) => String(pool.id)));
  const visitIds = new Set((visits || []).map((visit) => String(visit.id)));
  const docs = readDocumentManifest();

  return docs
    .filter((doc) => {
      const ownerClientId = doc.clientId != null ? String(doc.clientId) : null;
      const ownerPoolId = doc.poolId != null ? String(doc.poolId) : null;
      const ownerVisitId = doc.visitId != null ? String(doc.visitId) : null;
      if (ownerClientId && ownerClientId === String(clientId)) return true;
      if (ownerPoolId && poolIds.has(ownerPoolId)) return true;
      if (ownerVisitId && visitIds.has(ownerVisitId)) return true;
      if (String(doc.entity || "").toUpperCase() === "CLIENT" && String(doc.entityId || "") === String(clientId)) return true;
      return false;
    })
    .map((doc) => ({
      ...normalizeDocument(doc),
      downloadUrl: `/api/client-portal/${clientId}/documents/${doc.id}/download`,
    }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function resolveDocumentAccess(clientId, document, scope = {}) {
  if (!document) return false;
  const poolIds = new Set((scope.poolIds || []).map(String));
  const visitIds = new Set((scope.visitIds || []).map(String));
  if (String(document.clientId || "") === String(clientId)) return true;
  if (String(document.entity || "").toUpperCase() === "CLIENT" && String(document.entityId || "") === String(clientId)) return true;
  if (document.poolId != null && poolIds.has(String(document.poolId))) return true;
  if (document.visitId != null && visitIds.has(String(document.visitId))) return true;
  return false;
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

async function createVisitRequest(clientId, body = {}) {
  const message = String(body.message || body.text || "").trim();
  if (!message) {
    return { ok: false, status: 400, error: "Mensagem obrigatória" };
  }

  const scope = await getClientOwnershipScope(clientId);
  if (!scope.client) {
    return { ok: false, status: 404, error: "Cliente não encontrado" };
  }

  const payload = {
    clientId,
    sender: scope.client.name || "Cliente",
    senderType: "CLIENT",
    message: `Pedido de visita: ${message}`,
    text: `Pedido de visita: ${message}`,
    messageType: "VISIT_REQUEST",
    isReadByAdmin: false,
    seen: false,
  };

  const { clientMessage, notification } = await prisma.$transaction(async (tx) => {
    const createdMessage = await tx.clientMessage.create({ data: payload });
    const createdNotification = await tx.notification.create({
      data: {
        clientId,
        type: "VISIT_REQUEST",
        eventType: "CLIENT_VISIT_REQUEST",
        title: `Pedido de visita - ${scope.client.name}`,
        message: message,
        role: "ADMIN",
        severity: "INFO",
        metadata: {
          clientId,
          source: "customer-os",
          workflow: "visit-request",
        },
        isRead: false,
      },
    });

    await tx.communicationLog.create({
      data: {
        clientId,
        channel: "PORTAL_CLIENTE",
        message: message,
        referenceId: clientId,
      },
    }).catch(() => null);

    return {
      clientMessage: createdMessage,
      notification: createdNotification,
    };
  });

  return {
    ok: true,
    message: clientMessage,
    notification,
  };
}

module.exports = {
  customerPermissions,
  createVisitRequest,
  getClientOwnershipScope,
  listCustomerDocuments,
  listCustomerHistory,
  listCustomerMessages,
  listCustomerNotifications,
  readDocumentManifest,
  resolveDocumentAccess,
  normalizeDocument,
  normalizeMessage,
  normalizeNotification,
  safeNumber,
};
