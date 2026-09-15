const express = require("express");

const router = express.Router();
const auth = require('../middlewares/authMiddleware');
router.use(auth('ADMIN'));

const { prisma } = require("../prismaClient");

const { SERVICE_VISIT_INCLUDE, parseReference, mapTechnicalAlert, mapVisitAlert, mapGenericAlert, mapNotification } = require('../services/alertPresentationService');
const AlertListBusiness = require('../business/admin/AlertListBusiness');

async function resolveAlertContext(reference) {
  const ref = parseReference(reference);
  if (!Number.isInteger(ref.id) || ref.id <= 0) return null;

  if (ref.source === "technical") {
    const alert = await prisma.technicalAlert.findUnique({
      where: { id: ref.id },
      include: { pool: { include: { client: true } } },
    });
    return alert ? { ref, alert: mapTechnicalAlert(alert), raw: alert } : null;
  }

  if (ref.source === "visit") {
    const visit = await prisma.serviceVisit.findUnique({
      where: { id: ref.id },
      include: SERVICE_VISIT_INCLUDE,
    });
    return visit ? { ref, alert: mapVisitAlert(visit), raw: visit } : null;
  }

  if (ref.source === "generic") {
    const alert = await prisma.alert.findUnique({ where: { id: ref.id } });
    return alert ? { ref, alert: mapGenericAlert(alert), raw: alert } : null;
  }

  const notification = await prisma.notification.findUnique({
    where: { id: ref.id },
    include: { client: true, user: true },
  });
  return notification ? { ref, alert: mapNotification(notification), raw: notification } : null;
}

// Criar alerta manual associado a uma piscina.
router.post("/", async (req, res) => {
  try {
    const { poolId, type, message, priority } = req.body;

    const pool = await prisma.pool.findUnique({
      where: { id: Number(poolId) },
      include: { client: true },
    });

    if (!pool) {
      return res.status(404).json({
        ok: false,
        error: "Piscina nao encontrada",
      });
    }

    const [technicalAlert, notification] = await Promise.all([
      prisma.technicalAlert.create({
        data: {
          poolId: pool.id,
          type: type || "MANUAL_ALERT",
          message: message || type || "Alerta manual",
          priority: priority || "NORMAL",
          status: "OPEN",
        },
      }),
      prisma.notification.create({
        data: {
          clientId: pool.clientId,
          message: `${pool.name || "Piscina"} - ${message || type || "Alerta manual"}`,
          title: "Alerta manual",
          type: priority === "CRITICAL" || priority === "HIGH" ? "CRITICAL" : "ALERT",
          eventType: "MANUAL_POOL_ALERT",
          role: "ADMIN",
          severity: priority || "NORMAL",
          metadata: { poolId: pool.id, poolName: pool.name },
        },
      }),
    ]);

    return res.json({
      ok: true,
      alert: {
        technicalAlert,
        notification,
      },
    });
  } catch (err) {
    console.error("Erro criar alerta:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao criar alerta",
    });
  }
});

// Listar todos os alertas acionaveis do sistema.
router.get("/", async (req, res) => {
  try {
    return res.json(await AlertListBusiness.list());
  } catch (err) {
    console.error("Erro listar alertas:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao listar alertas",
      alerts: [],
    });
  }
});

// Resolver alerta mantendo historico.
router.put("/:id/resolve", async (req, res) => {
  try {
    const context = await resolveAlertContext(req.params.id);
    if (!context) {
      return res.status(404).json({ ok: false, error: "Alerta nao encontrado" });
    }

    const resolvedAt = new Date();

    if (context.ref.source === "technical") {
      await prisma.technicalAlert.update({
        where: { id: context.ref.id },
        data: { status: "RESOLVED", resolvedAt },
      });
    } else if (context.ref.source === "visit") {
      const note = `Alerta resolvido pelo administrador em ${resolvedAt.toLocaleString("pt-PT")}.`;
      await prisma.serviceVisit.update({
        where: { id: context.ref.id },
        data: {
          alerts: null,
          internalNotes: [context.raw.internalNotes, note].filter(Boolean).join("\n"),
        },
      });
    } else if (context.ref.source === "generic") {
      await prisma.alert.update({
        where: { id: context.ref.id },
        data: { status: "RESOLVED", active: false, resolvedAt },
      });
    } else {
      await prisma.notification.update({
        where: { id: context.ref.id },
        data: { status: "RESOLVED", isRead: true, readAt: resolvedAt },
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro resolver alerta:", err);
    return res.status(500).json({ ok: false, error: "Erro ao resolver alerta" });
  }
});

// Converter alerta em linha de faturacao.
router.post("/:id/convert", async (req, res) => {
  try {
    const context = await resolveAlertContext(req.params.id);
    if (!context) {
      return res.status(404).json({ ok: false, error: "Alerta nao encontrado" });
    }

    const price = Number(req.body.price || req.body.amount || 0);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ ok: false, error: "Valor invalido" });
    }

    const clientId = context.alert.clientId;
    if (!clientId) {
      return res.status(400).json({ ok: false, error: "Alerta sem cliente associado" });
    }

    const monthRef = new Date().toISOString().slice(0, 7);

    let invoice = await prisma.invoice.findFirst({
      where: { clientId, monthRef },
    });

    if (!invoice) {
      invoice = await prisma.invoice.create({
        data: {
          clientId,
          monthRef,
          total: 0,
          amount: 0,
          totalAmount: 0,
          amountPaid: 0,
          amountOpen: 0,
          status: "PENDING",
        },
      });
    }

    await prisma.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        type: "REPAIR",
        lineType: "ALERT",
        referenceId: context.alert.numericId,
        description: context.alert.message,
        quantity: 1,
        unitPrice: price,
        total: price,
        lineTotal: price,
      },
    });

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        total: { increment: price },
        amount: { increment: price },
        totalAmount: { increment: price },
        amountOpen: { increment: price },
        status: "PENDING",
      },
    });

    return res.json({
      ok: true,
      invoiceId: updatedInvoice.id,
      amount: price,
    });
  } catch (err) {
    console.error("Erro converter alerta em faturacao:", err);
    return res.status(500).json({ ok: false, error: "Erro ao faturar alerta" });
  }
});

module.exports = router;
