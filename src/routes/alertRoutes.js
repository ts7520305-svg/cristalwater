const express = require("express");

const router = express.Router();
const auth = require('../middlewares/authMiddleware');
router.use(auth('ADMIN'));

const { prisma } = require("../prismaClient");

const AlertListBusiness = require('../business/admin/AlertListBusiness');
const AlertResolutionBusiness = require('../business/admin/AlertResolutionBusiness');
const AlertBillingBusiness = require('../business/admin/AlertBillingBusiness');

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

    const { technicalAlert, notification } = await prisma.$transaction(async tx => {
      const technicalAlert = await tx.technicalAlert.create({
        data: {
          poolId: pool.id,
          type: type || "MANUAL_ALERT",
          message: message || type || "Alerta manual",
          priority: priority || "NORMAL",
          status: "OPEN",
        },
      });
      const notification = await tx.notification.create({
        data: {
          clientId: pool.clientId,
          message: `${pool.name || "Piscina"} - ${message || type || "Alerta manual"}`,
          title: "Alerta manual",
          type: priority === "CRITICAL" || priority === "HIGH" ? "CRITICAL" : "ALERT",
          eventType: "MANUAL_POOL_ALERT",
          role: "ADMIN",
          severity: priority || "NORMAL",
          metadata: { poolId: pool.id, poolName: pool.name, alertId: technicalAlert.id },
        },
      });
      return { technicalAlert, notification };
    });

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
    return res.json(await AlertResolutionBusiness.resolve(req.user, req.params.id, req.body));
  } catch (err) {
    console.error("Erro resolver alerta:", err);
    return res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : "Erro ao resolver alerta", ...(err.code ? { code: err.code } : {}) });
  }
});

// Converter alerta em linha de faturacao.
router.post("/:id/convert", async (req, res) => {
  try {
    return res.json(await AlertBillingBusiness.convert(req.user, req.params.id, req.body));
  } catch (err) {
    console.error("Erro converter alerta em faturacao:", err);
    return res.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? err.message : "Erro ao faturar alerta" });
  }
});

module.exports = router;
