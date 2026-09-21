const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const clientPortalController = require("../controllers/clientPortalController");
const auth = require("../middlewares/authMiddleware");
const {
  customerPermissions,
  createVisitRequest,
  listCustomerHistory,
  listCustomerMessages,
  listCustomerNotifications,
  markCustomerNotificationRead,
  safeNumber,
} = require("../services/customerPortalService");

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
  if (req.user?.role === "ADMIN" && req.method === "GET") return true;
  const authClientId = ["CLIENT", "CUSTOMER"].includes(req.user?.role) ? clientAuthClientId(req) : 0;
  if (!authClientId || authClientId !== Number(clientId)) {
    res.status(403).json({ ok: false, error: "Acesso reservado ao cliente autenticado." });
    return false;
  }
  return true;
}

const quotePortal = require('../controllers/quotePortalController');
router.get('/:clientId(\\d+)/quotes', auth('CLIENT'), (req, res, next) => {
  if (ensureClientOwnership(req, res, req.params.clientId)) return quotePortal.list(req, res, next);
});
router.post('/:clientId(\\d+)/quotes/:quoteId/decision', auth('CLIENT'), (req, res, next) => {
  if (ensureClientOwnership(req, res, req.params.clientId)) return quotePortal.decide(req, res, next);
});

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
router.get("/:clientId(\\d+)/history", auth("CLIENT"), (req, res) => {
  if (ensureClientOwnership(req, res, req.params.clientId)) return getClientHistory(req, res);
});
router.get("/:clientId(\\d+)/latest", auth("CLIENT"), (req, res) => {
  if (ensureClientOwnership(req, res, req.params.clientId)) return getLatestVisit(req, res);
});

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
  if (!Number.isSafeInteger(notificationId)||notificationId<=0) return res.status(400).json({ ok: false, error: "Notificação inválida" });
  try {
    if(!await markCustomerNotificationRead(clientId,notificationId))return res.status(404).json({ok:false,error:'Notificação não encontrada'});
  } catch (_) {
    return res.status(500).json({ok:false,error:'Não foi possível confirmar a leitura'});
  }

  return res.json({ ok: true });
});

router.get("/:clientId(\\d+)/messages", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  try {
    const messages = await listCustomerMessages(clientId);
    return res.json({ ok: true, messages });
  } catch (_) {
    return res.status(500).json({ ok: false, error: 'Não foi possível aceder à conversa. O histórico foi preservado.' });
  }
});

router.post("/:clientId(\\d+)/messages", auth("CLIENT"), (req, res) => {
  if (!ensureClientOwnership(req, res, req.params.clientId)) return;
  return require('../controllers/clientMessageWriteController').write(true, 201)(req, res);
});

router.post("/:clientId(\\d+)/visit-requests", auth("CLIENT"), async (req, res) => {
  const clientId = Number(req.params.clientId);
  if (!ensureClientOwnership(req, res, clientId)) return;
  const business = require('../business/portal/ClientPortalRequestBusiness');
  try {
    const result = await createVisitRequest(clientId, req.body, req.user);
    business.emit(result);
    return res.status(201).json(result);
  } catch (error) { return business.sendError(res, error); }
});

router.get("/:clientId(\\d+)/documents", clientPortalController.privateDocuments, auth("CLIENT"), clientPortalController.listDocuments);
router.get("/:clientId(\\d+)/documents/:documentId/download", clientPortalController.privateDocuments, auth("CLIENT"), clientPortalController.downloadDocument);

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
