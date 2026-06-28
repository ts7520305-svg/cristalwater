const express = require("express");
const { prisma } = require("../prismaClient");

const router = express.Router();

function toDate(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    const err = new Error(`${field} inválido`);
    err.statusCode = 400;
    throw err;
  }
  return date;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "sim", "on"].includes(String(value).toLowerCase());
}

function closurePayload(body = {}) {
  const startDate = toDate(body.startDate, "startDate");
  const endDate = toDate(body.endDate, "endDate");
  if (endDate < startDate) {
    const err = new Error("endDate não pode ser anterior a startDate");
    err.statusCode = 400;
    throw err;
  }

  return {
    title: String(body.title || "Encerramento Cristal Water").trim(),
    closureType: String(body.closureType || "HOLIDAY").trim().toUpperCase(),
    status: String(body.status || "PLANNED").trim().toUpperCase(),
    startDate,
    endDate,
    messageTitle: body.messageTitle || null,
    messageBody: body.messageBody || null,
    emergencyPhone: body.emergencyPhone || null,
    emergencyEmail: body.emergencyEmail || null,
    notifyClients: normalizeBoolean(body.notifyClients, true),
    notifyTechnicians: normalizeBoolean(body.notifyTechnicians, true),
    showOnClientPortal: normalizeBoolean(body.showOnClientPortal, true),
    pauseNormalVisits: normalizeBoolean(body.pauseNormalVisits, true),
    allowCriticalServices: normalizeBoolean(body.allowCriticalServices, true),
    affectedServiceTypes: body.affectedServiceTypes || null,
    exceptionRules: body.exceptionRules || null,
    routeAction: String(body.routeAction || "PREVIEW_ONLY").trim().toUpperCase(),
    createdByUserId: body.createdByUserId ? Number(body.createdByUserId) : null,
    approvedByUserId: body.approvedByUserId ? Number(body.approvedByUserId) : null,
    approvedAt: body.status === "ACTIVE" || body.approvedByUserId ? new Date() : null,
    metadata: body.metadata || null,
  };
}

function buildPublicMessage(closure) {
  const start = closure.startDate.toISOString().slice(0, 10);
  const end = closure.endDate.toISOString().slice(0, 10);
  return {
    title: closure.messageTitle || closure.title || "Cristal Water - aviso de encerramento",
    message:
      closure.messageBody ||
      `Informamos que a Cristal Water estará encerrada entre ${start} e ${end}. Em caso urgente, contacte ${closure.emergencyPhone || "o contacto habitual da empresa"}.`,
  };
}

router.get("/templates", (req, res) => {
  res.json({
    ok: true,
    templates: [
      {
        id: "NATAL",
        title: "Encerramento de Natal",
        messageTitle: "🎄 Aviso de encerramento de Natal",
        messageBody:
          "Informamos que a Cristal Water estará encerrada para férias de Natal entre {startDate} e {endDate}. Em caso urgente, contacte o número habitual. A equipa Cristal Water deseja-lhe um Feliz Natal e um excelente Ano Novo.",
      },
      {
        id: "FERIAS_VERAO",
        title: "Férias de verão",
        messageTitle: "☀️ Aviso de férias da equipa Cristal Water",
        messageBody:
          "Informamos que estaremos encerrados para férias entre {startDate} e {endDate}. Serviços críticos previamente acordados serão mantidos.",
      },
      {
        id: "FERIADO",
        title: "Feriado / encerramento pontual",
        messageTitle: "Aviso de encerramento temporário",
        messageBody:
          "A Cristal Water estará encerrada em {startDate}. Em caso urgente, contacte o número habitual.",
      },
    ],
  });
});

router.get("/", async (req, res, next) => {
  try {
    const { status, from, to } = req.query;
    const where = {};
    if (status) where.status = String(status).toUpperCase();
    if (from || to) {
      where.endDate = {};
      if (from) where.endDate.gte = toDate(from, "from");
      if (to) where.startDate = { lte: toDate(to, "to") };
    }

    const closures = await prisma.companyClosure.findMany({
      where,
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
      take: 100,
    });
    res.json({ ok: true, closures });
  } catch (err) {
    next(err);
  }
});

router.get("/active", async (req, res, next) => {
  try {
    const now = new Date();
    const closure = await prisma.companyClosure.findFirst({
      where: {
        status: { in: ["ACTIVE", "PLANNED"] },
        startDate: { lte: now },
        endDate: { gte: now },
        showOnClientPortal: true,
      },
      orderBy: { startDate: "asc" },
    });
    res.json({ ok: true, active: Boolean(closure), closure, publicMessage: closure ? buildPublicMessage(closure) : null });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = closurePayload(req.body);
    const closure = await prisma.companyClosure.create({ data });
    res.status(201).json({ ok: true, closure });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = closurePayload(req.body);
    const closure = await prisma.companyClosure.update({ where: { id }, data });
    res.json({ ok: true, closure });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/activate", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const closure = await prisma.companyClosure.update({
      where: { id },
      data: { status: "ACTIVE", activatedAt: new Date(), approvedAt: new Date(), approvedByUserId: req.body?.approvedByUserId ? Number(req.body.approvedByUserId) : null },
    });
    res.json({ ok: true, closure });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const closure = await prisma.companyClosure.update({
      where: { id },
      data: { status: "CANCELLED", deactivatedAt: new Date(), metadata: { cancelReason: req.body?.reason || null } },
    });
    res.json({ ok: true, closure });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/route-impact", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const closure = await prisma.companyClosure.findUnique({ where: { id } });
    if (!closure) return res.status(404).json({ ok: false, error: "Encerramento não encontrado" });

    const visits = await prisma.serviceVisit.findMany({
      where: {
        plannedDate: { gte: closure.startDate, lte: closure.endDate },
        status: { in: ["PLANNED", "SCHEDULED", "PENDING"] },
      },
      select: { id: true, plannedDate: true, status: true, clientId: true, poolId: true, technicianId: true, priority: true, visitType: true },
      orderBy: { plannedDate: "asc" },
      take: 500,
    });

    const critical = visits.filter((v) => ["CRITICAL", "URGENT", "VIP", "HOTEL"].includes(String(v.priority || v.visitType || "").toUpperCase()));
    const normal = visits.filter((v) => !critical.includes(v));

    res.json({
      ok: true,
      closure,
      impact: {
        totalVisits: visits.length,
        normalVisits: normal.length,
        criticalVisits: critical.length,
        recommendation: closure.pauseNormalVisits ? "Reagendar visitas normais e manter apenas serviços críticos/contratados." : "Manter rondas com aviso operacional.",
        visits,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/generate-notifications", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const closure = await prisma.companyClosure.findUnique({ where: { id } });
    if (!closure) return res.status(404).json({ ok: false, error: "Encerramento não encontrado" });

    const publicMessage = buildPublicMessage(closure);
    const notifications = [];

    if (closure.notifyClients) {
      const clients = await prisma.client.findMany({ where: { active: true }, select: { id: true } });
      for (const client of clients) {
        notifications.push({
          clientId: client.id,
          type: "COMPANY_CLOSURE",
          eventType: "COMPANY_CLOSURE_CLIENT_NOTICE",
          title: publicMessage.title,
          message: publicMessage.message,
          role: "CLIENT",
          status: "PENDING",
          severity: "INFO",
          metadata: { closureId: closure.id },
        });
      }
    }

    if (closure.notifyTechnicians) {
      notifications.push({
        type: "COMPANY_CLOSURE",
        eventType: "COMPANY_CLOSURE_TECH_NOTICE",
        title: closure.title,
        message: `Encerramento da empresa de ${closure.startDate.toISOString().slice(0, 10)} a ${closure.endDate.toISOString().slice(0, 10)}. Verificar exceções e serviços críticos.`,
        role: "TECHNICIAN",
        status: "PENDING",
        severity: "INFO",
        metadata: { closureId: closure.id },
      });
    }

    if (notifications.length) await prisma.notification.createMany({ data: notifications });
    res.json({ ok: true, created: notifications.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
