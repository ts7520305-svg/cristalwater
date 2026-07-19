const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const clientPortalController = require("../controllers/clientPortalController");
const auth = require("../middlewares/authMiddleware");
const {
  customerPermissions,
  createVisitRequest,
  listCustomerDocuments,
  listCustomerHistory,
  listCustomerMessages,
  listCustomerNotifications,
  readDocumentManifest,
  resolveDocumentAccess,
  safeNumber,
} = require("../services/customerPortalService");
const { resolveUploadSubdir } = require("../config/uploadPath");

const documentsBaseDir = resolveUploadSubdir("documents");

async function getClientHistory(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    const pools = await listCustomerHistory(clientId);
    const visits = pools.flatMap((pool) => pool.serviceVisits || []);
    res.json({ ok: true, pools, visits });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, pools: [], visits: [] });
  }
}

async function getLatestVisit(req, res) {
  try {
    const clientId = Number(req.params.clientId);
    const visit = await prisma.serviceVisit.findFirst({
      where: { pool: { is: { clientId } } },
      include: { pool: true, photos: true },
      orderBy: { startAt: "desc" },
    });
    res.json({ ok: true, visit });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, visit: null });
  }
}

function clientAuthClientId(req) {
  return Number(req.user?.clientId || req.user?.id || 0);
}

function ensureClientOwnership(req, res, clientId) {
  const authClientId = clientAuthClientId(req);
  if (!authClientId || authClientId !== Number(clientId)) {
    res.status(403).json({ ok: false, error: "Acesso reservado ao cliente autenticado." });
    return false;
  }
  return true;
}

// Aliases usados pelos frontends atuais.
router.get("/history/:clientId", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  return getClientHistory(req, res);
});
router.get("/latest/:clientId", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  return getLatestVisit(req, res);
});
router.get("/:clientId(\\d+)/history", getClientHistory);
router.get("/:clientId(\\d+)/latest", getLatestVisit);

router.get("/:clientId(\\d+)/permissions", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      status: true,
      active: true,
      billingActive: true,
      contractActive: true,
      creditBalance: true,
    },
  });
  if (!client) return res.status(404).json({ ok: false, error: "Cliente não encontrado" });
  return res.json({ ok: true, permissions: customerPermissions(client) });
});

router.get("/:clientId(\\d+)/notifications", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const notifications = await listCustomerNotifications(clientId);
  return res.json({ ok: true, notifications });
});

router.post("/:clientId(\\d+)/notifications/:notificationId/read", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  const notificationId = Number(req.params.notificationId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  if (!notificationId) return res.status(400).json({ ok: false, error: "Notificação inválida" });

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, clientId },
  });

  if (!notification) {
    return res.status(404).json({ ok: false, error: "Notificação não encontrada" });
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return res.json({ ok: true });
});

router.get("/:clientId(\\d+)/messages", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const messages = await listCustomerMessages(clientId);
  return res.json({ ok: true, messages });
});

router.post("/:clientId(\\d+)/messages", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const text = String(req.body?.text || req.body?.message || "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "Mensagem obrigatória" });

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) return res.status(404).json({ ok: false, error: "Cliente não encontrado" });

  const message = await prisma.clientMessage.create({
    data: {
      clientId,
      sender: client.name || "Cliente",
      senderType: "CLIENT",
      message: text,
      text,
      messageType: "TEXT",
      isReadByAdmin: false,
      seen: false,
    },
  });

  await prisma.communicationLog.create({
    data: {
      clientId,
      channel: "PORTAL_CLIENTE",
      message: text,
      referenceId: clientId,
    },
  }).catch(() => null);

  if (global.io) {
    global.io.to(`client_${clientId}`).emit("newMessage", message);
    global.io.emit("new-notification", {
      id: `chat-${clientId}-${message.id}`,
      clientId,
      type: "CHAT_MESSAGE",
      message: text,
      createdAt: message.createdAt,
    });
  }

  return res.status(201).json({ ok: true, message });
});

router.post("/:clientId(\\d+)/visit-requests", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const result = await createVisitRequest(clientId, req.body || {});
  if (!result.ok) {
    return res.status(result.status || 400).json({ ok: false, error: result.error || "Erro ao criar pedido" });
  }
  return res.status(201).json({ ok: true, request: result.message, notification: result.notification });
});

router.get("/:clientId(\\d+)/documents", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const documents = await listCustomerDocuments(clientId);
  return res.json({ ok: true, documents });
});

router.get("/:clientId(\\d+)/documents/:documentId/download", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const documentId = Number(req.params.documentId);
  if (!documentId) return res.status(400).json({ ok: false, error: "Documento inválido" });

  const manifest = readDocumentManifest();
  const document = manifest.find((item) => Number(item.id) === documentId) || null;
  if (!document) return res.status(404).json({ ok: false, error: "Documento não encontrado" });

  const scope = await prisma.$transaction(async () => {
    const [pools, visits] = await Promise.all([
      prisma.pool.findMany({ where: { clientId }, select: { id: true } }),
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
    return { poolIds: pools.map((pool) => pool.id), visitIds: visits.map((visit) => visit.id) };
  });

  if (!resolveDocumentAccess(clientId, document, scope)) {
    return res.status(403).json({ ok: false, error: "Documento indisponível para este cliente" });
  }

  const filePath = require("path").join(documentsBaseDir, document.filename);
  return res.download(filePath, document.originalName || document.title || `document-${documentId}`);
});

router.get("/:clientId(\\d+)/dashboard", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      pools: { include: { technicalAlerts: true, serviceVisits: { orderBy: { startAt: "desc" }, take: 1 } } },
      invoices: { include: { payments: true }, orderBy: { issueDate: "desc" }, take: 12 },
      serviceVisits: { include: { pool: true, technician: true }, orderBy: { plannedDate: "desc" }, take: 50 },
    },
  });
  if (!client) return res.status(404).json({ ok: false, error: "Cliente não encontrado" });
  const lastVisit = client.serviceVisits[0] || null;
  const nextVisit = client.serviceVisits.find((visit) => !visit.endAt && !/CANCEL/i.test(String(visit.status || ""))) || null;
  const healthScore = Math.max(0, Math.min(100, 100 - ((client.pools || []).reduce((sum, pool) => sum + (pool.technicalAlerts?.length || 0), 0) * 12) - (client.paymentStatus === "OVERDUE" ? 15 : 0)));
  return res.json({
    ok: true,
    dashboard: {
      poolStatus: (client.pools || []).map((pool) => ({
        poolId: pool.id,
        poolName: pool.name,
        status: pool.serviceVisits?.[0]?.status || "PLANNED",
      })),
      lastVisit: lastVisit ? {
        id: lastVisit.id,
        plannedDate: lastVisit.plannedDate,
        endAt: lastVisit.endAt,
        poolId: lastVisit.poolId,
        poolName: lastVisit.pool?.name || null,
        technicianName: lastVisit.technicianName || lastVisit.technician?.name || null,
      } : null,
      nextVisit: nextVisit ? {
        id: nextVisit.id,
        plannedDate: nextVisit.plannedDate,
        poolId: nextVisit.poolId,
        poolName: nextVisit.pool?.name || null,
        technicianName: nextVisit.technicianName || nextVisit.technician?.name || null,
      } : null,
      technicianAssigned: (client.serviceVisits || []).find((visit) => visit.technicianName || visit.technician?.name) ? (client.serviceVisits.find((visit) => visit.technicianName || visit.technician?.name).technicianName || client.serviceVisits.find((visit) => visit.technicianName || visit.technician?.name).technician?.name || null) : null,
      healthScore,
      client: {
        id: client.id,
        name: client.name,
      },
    },
  });
});

// Portal cliente base.
router.post("/:clientId(\\d+)/payment-notice", auth("CLIENT"), async (req, res, next) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  return clientPortalController.notifyPayment(req, res, next);
});

router.get("/:clientId(\\d+)", auth("CLIENT"), async (req, res, next) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  return clientPortalController.getClientPortal(req, res, next);
});

module.exports = router;
