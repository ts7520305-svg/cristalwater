const express = require("express");

const router = express.Router();

const { prisma } = require("../prismaClient");

const CLOSED_STATUSES = ["RESOLVED", "DONE", "CLOSED", "CANCELLED", "CANCELED", "ARCHIVED"];
const ALERT_NOTIFICATION_TYPES = [
  "ALERT",
  "CRITICAL",
  "WARNING",
  "STOCK",
  "STOCK_CRITICAL",
  "WATER_OPEN",
  "OPERATIONAL_PENDING",
  "GPS_OFFLINE",
];
const ALERT_EVENT_TYPES = [
  "FIELD_PROBLEM_REPORTED",
  "TECHNICIAN_STOCK_REQUEST",
  "WATER_OPEN_OVERDUE",
  "OPERATIONAL_FLOW",
  "GPS_OFFLINE",
];

const SERVICE_VISIT_INCLUDE = {
  client: true,
  pool: { include: { client: true } },
  technician: true,
  photos: true,
  attachments: true,
  chemicals: true,
};

function parseReference(raw) {
  const value = String(raw || "").trim();
  const match = /^([a-zA-Z]+)-(\d+)$/.exec(value);
  if (match) {
    return { source: match[1].toLowerCase(), id: Number(match[2]) };
  }
  return { source: "notification", id: Number(value) };
}

function isOpenStatus(status) {
  return !CLOSED_STATUSES.includes(String(status || "OPEN").toUpperCase());
}

function normalisePriority(priority, fallback = "NORMAL") {
  const value = String(priority || fallback || "NORMAL").toUpperCase();
  if (["CRITICAL", "HIGH", "URGENT"].includes(value)) return "CRITICAL";
  if (["WARN", "WARNING", "MEDIUM"].includes(value)) return "WARNING";
  if (["LOW"].includes(value)) return "LOW";
  return "NORMAL";
}

function buildHref({ clientId, poolId, visitId }) {
  if (poolId) return `/admin-pool-technical?poolId=${poolId}`;
  if (clientId) return `/admin-clients?clientId=${clientId}`;
  if (visitId) return `/admin-visits?visitId=${visitId}`;
  return "/admin-alerts";
}

function metadataOf(record) {
  return record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function uniqueNumbers(values) {
  return Array.from(new Set(values.map(numberOrNull).filter(Boolean)));
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function extractVisitIdFromText(...values) {
  const text = values.map((value) => cleanText(value)).filter(Boolean).join(" ");
  if (!text) return null;
  const match = /\bvisita\s*#?\s*(\d+)\b/i.exec(text) || /\bvisit\s*#?\s*(\d+)\b/i.exec(text);
  return match ? numberOrNull(match[1]) : null;
}

function chemicalsSummary(chemicals = []) {
  return (chemicals || [])
    .filter((item) => item?.name)
    .map((item) => {
      const quantity = item.quantity == null ? "" : ` ${item.quantity}`;
      const unit = item.unit ? ` ${item.unit}` : "";
      return `${item.name}${quantity}${unit}`.trim();
    })
    .join(", ");
}

function productsSummary(value, chemicals = []) {
  const raw = cleanText(value);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return chemicalsSummary(parsed) || raw;
      }
    } catch (_) {
      return raw;
    }
  }
  return chemicalsSummary(chemicals);
}

function mapPhoto(photo) {
  if (!photo?.url) return null;
  return {
    id: photo.id,
    url: photo.url,
    name: photo.type || "Foto",
    type: photo.type || "GENERAL",
    mimeType: "image/*",
    isImage: true,
    createdAt: photo.createdAt,
  };
}

function mapAttachment(attachment) {
  if (!attachment?.fileUrl) return null;
  const mimeType = attachment.mimeType || "";
  return {
    id: attachment.id,
    url: attachment.fileUrl,
    name: attachment.fileName || "Anexo",
    type: "ATTACHMENT",
    mimeType,
    isImage: /^image\//i.test(mimeType) || /\.(png|jpe?g|webp|gif)$/i.test(attachment.fileUrl || ""),
    createdAt: attachment.createdAt,
  };
}

function buildReadings(visit) {
  if (!visit) return [];
  return [
    ["pH", visit.ph],
    ["Cloro", visit.chlorine],
    ["Alcalinidade", visit.alkalinity],
    ["ORP", visit.orpMv],
    ["Sal", visit.salt],
    ["Temperatura", visit.temperature],
  ]
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => ({ label, value }));
}

function buildServiceNote(visit) {
  if (!visit?.id) return null;
  const photos = (visit.photos || []).map(mapPhoto).filter(Boolean);
  const attachments = (visit.attachments || []).map(mapAttachment).filter(Boolean);
  const products = productsSummary(visit.products, visit.chemicals);
  return {
    visitId: visit.id,
    href: `/api/reports/visit/${visit.id}`,
    status: visit.status || null,
    date: visit.endAt || visit.startAt || visit.plannedDate || visit.date || visit.createdAt || visit.updatedAt,
    reason: cleanText(visit.reason),
    alerts: cleanText(visit.alerts),
    notes: cleanText(visit.notes),
    internalNotes: cleanText(visit.internalNotes),
    products,
    readings: buildReadings(visit),
    photos,
    attachments,
  };
}

function buildRepairNote(repair) {
  if (!repair?.id) return null;
  return {
    id: repair.id,
    problem: cleanText(repair.problem),
    notes: cleanText(repair.notes),
    status: repair.status || null,
    priority: repair.priority || null,
    totalPrice: repair.totalPrice ?? repair.unitPrice ?? null,
    createdAt: repair.createdAt,
  };
}

function enrichAlert(alert, { visit, repair, attachments = [] } = {}) {
  const serviceNote = buildServiceNote(visit);
  const repairNote = buildRepairNote(repair);
  const directAttachments = attachments.map(mapAttachment).filter(Boolean);
  const media = [
    ...(serviceNote?.photos || []),
    ...(serviceNote?.attachments || []),
    ...directAttachments,
  ];
  const visitId = alert.visitId || serviceNote?.visitId || extractVisitIdFromText(alert.message, alert.detailText) || null;
  const visitTechnicianName = visit?.technician?.name || visit?.technicianName || "";
  const visitClientId = visit?.clientId || visit?.pool?.clientId || visit?.pool?.client?.id || null;
  const visitPoolId = visit?.poolId || visit?.pool?.id || null;
  const problemText = cleanText(serviceNote?.alerts)
    || cleanText(repairNote?.problem)
    || cleanText(alert.message)
    || cleanText(serviceNote?.reason)
    || "";

  return {
    ...alert,
    visitId,
    repairId: alert.repairId || repairNote?.id || null,
    technicianId: alert.technicianId || visit?.technicianId || null,
    technicianName: alert.technicianName || visitTechnicianName || "",
    clientId: alert.clientId || visitClientId,
    clientName: alert.clientName || visit?.client?.name || visit?.pool?.client?.name || "",
    poolId: alert.poolId || visitPoolId,
    poolName: alert.poolName || visit?.pool?.name || "",
    visitHref: visitId ? `/admin-visits?visitId=${visitId}` : null,
    serviceNote,
    repair: repairNote,
    media,
    hasServiceNote: Boolean(serviceNote),
    problemText,
    detailText: [
      alert.message,
      serviceNote?.alerts,
      serviceNote?.reason,
      serviceNote?.notes,
      repairNote?.problem,
      repairNote?.notes,
    ].filter(Boolean).join("\n"),
  };
}

function mapNotification(alert) {
  const metadata = metadataOf(alert);
  const poolId = metadata.poolId || null;
  const visitId = metadata.visitId || null;
  const repairId = metadata.repairId || null;
  const technicalAlertId = metadata.alertId || null;
  const href = metadata.href || buildHref({ clientId: alert.clientId, poolId, visitId });
  return {
    id: `notification-${alert.id}`,
    numericId: alert.id,
    source: "notification",
    title: alert.title || alert.eventType || alert.type || "Alerta",
    message: alert.message || "Alerta operacional",
    type: alert.type || "ALERT",
    eventType: alert.eventType || null,
    priority: normalisePriority(alert.severity, alert.type),
    status: alert.status || (alert.isRead ? "READ" : "PENDING"),
    isRead: Boolean(alert.isRead),
    createdAt: alert.createdAt,
    clientId: alert.clientId || null,
    clientName: alert.client?.name || "",
    poolId,
    poolName: metadata.poolName || "",
    visitId,
    repairId,
    technicalAlertId,
    technicianName: alert.user?.name || metadata.technicianName || "",
    href,
  };
}

function mapTechnicalAlert(alert) {
  return {
    id: `technical-${alert.id}`,
    numericId: alert.id,
    source: "technical",
    title: alert.type || "Alerta tecnico",
    message: alert.message || "Alerta tecnico aberto",
    type: alert.type || "TECHNICAL",
    eventType: "TECHNICAL_ALERT",
    priority: normalisePriority(alert.priority),
    status: alert.status || "OPEN",
    isRead: false,
    createdAt: alert.createdAt,
    clientId: alert.pool?.clientId || null,
    clientName: alert.pool?.client?.name || "",
    poolId: alert.poolId || null,
    poolName: alert.pool?.name || "",
    pool: alert.pool ? {
      id: alert.pool.id,
      name: alert.pool.name,
      zone: alert.pool.zone,
      address: alert.pool.address || alert.pool.location,
      latitude: alert.pool.latitude,
      longitude: alert.pool.longitude,
      client: alert.pool.client ? {
        id: alert.pool.client.id,
        name: alert.pool.client.name,
      } : null,
    } : null,
    technicianName: "",
    attachments: alert.attachments || [],
    href: buildHref({ clientId: alert.pool?.clientId, poolId: alert.poolId }),
  };
}

function mapVisitAlert(visit) {
  const alertMessage = visit.alerts || visit.reason || "Visita com alerta operacional";
  return {
    id: `visit-${visit.id}`,
    numericId: visit.id,
    source: "visit",
    title: visit.status === "NOT_DONE" ? "Visita nao realizada" : "Alerta de visita",
    message: alertMessage,
    type: "VISIT_ALERT",
    eventType: "SERVICE_VISIT_ALERT",
    priority: visit.status === "NOT_DONE" ? "WARNING" : "NORMAL",
    status: visit.status || "OPEN",
    isRead: false,
    createdAt: visit.updatedAt || visit.date || visit.plannedDate,
    clientId: visit.clientId || visit.pool?.clientId || null,
    clientName: visit.client?.name || visit.pool?.client?.name || "",
    poolId: visit.poolId || null,
    poolName: visit.pool?.name || "",
    visitId: visit.id,
    pool: visit.pool ? {
      id: visit.pool.id,
      name: visit.pool.name,
      zone: visit.pool.zone,
      address: visit.pool.address || visit.pool.location,
      latitude: visit.pool.latitude,
      longitude: visit.pool.longitude,
      client: visit.pool.client ? {
        id: visit.pool.client.id,
        name: visit.pool.client.name,
      } : null,
    } : null,
    technicianName: visit.technician?.name || visit.technicianName || "",
    href: buildHref({ clientId: visit.clientId || visit.pool?.clientId, poolId: visit.poolId, visitId: visit.id }),
  };
}

function mapGenericAlert(alert) {
  return {
    id: `generic-${alert.id}`,
    numericId: alert.id,
    source: "generic",
    title: alert.title || alert.type || "Alerta",
    message: alert.message || "Alerta aberto",
    type: alert.type || "ALERT",
    eventType: "GENERIC_ALERT",
    priority: normalisePriority(alert.type),
    status: alert.status || "OPEN",
    isRead: false,
    createdAt: alert.createdAt,
    clientId: null,
    clientName: "",
    poolId: null,
    poolName: "",
    technicianName: "",
    href: "/admin-alerts",
  };
}

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
    const [notifications, technicalAlerts, visitAlerts, genericAlerts] = await Promise.all([
      prisma.notification.findMany({
        where: {
          OR: [
            { type: { in: ALERT_NOTIFICATION_TYPES } },
            { eventType: { in: ALERT_EVENT_TYPES } },
            { severity: { in: ["HIGH", "CRITICAL", "WARNING", "WARN"] } },
          ],
          NOT: { status: { in: CLOSED_STATUSES } },
        },
        include: { client: true, user: true },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.technicalAlert.findMany({
        where: { status: { notIn: CLOSED_STATUSES } },
        include: { pool: { include: { client: true } }, attachments: true },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.serviceVisit.findMany({
        where: {
          OR: [
            { alerts: { not: null } },
            { status: { in: ["NOT_DONE", "BLOCKED", "RETAINED", "IMPEDIDO"] } },
          ],
        },
        include: SERVICE_VISIT_INCLUDE,
        orderBy: [{ updatedAt: "desc" }, { date: "desc" }],
        take: 150,
      }),
      prisma.alert.findMany({
        where: {
          active: true,
          status: { notIn: CLOSED_STATUSES },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }).catch(() => []),
    ]);

    const notificationContexts = notifications.map((notification) => ({
      notification,
      metadata: metadataOf(notification),
    }));
    const technicalVisitIds = technicalAlerts.map((alert) => extractVisitIdFromText(alert.message, alert.type));
    const linkedVisitIds = uniqueNumbers([
      ...notificationContexts.map((row) => row.metadata.visitId),
      ...technicalVisitIds,
      ...visitAlerts.map((visit) => visit.id),
    ]);
    const linkedRepairIds = uniqueNumbers(notificationContexts.map((row) => row.metadata.repairId));

    const [linkedVisits, linkedRepairs] = await Promise.all([
      linkedVisitIds.length
        ? prisma.serviceVisit.findMany({
            where: { id: { in: linkedVisitIds } },
            include: SERVICE_VISIT_INCLUDE,
          }).catch(() => [])
        : [],
      linkedRepairIds.length
        ? prisma.repair.findMany({
            where: { id: { in: linkedRepairIds } },
            include: { pool: { include: { client: true } } },
          }).catch(() => [])
        : [],
    ]);

    const visitMap = new Map([...visitAlerts, ...linkedVisits].map((visit) => [Number(visit.id), visit]));
    const repairMap = new Map(linkedRepairs.map((repair) => [Number(repair.id), repair]));
    const notificationByTechnicalAlertId = new Map();
    notificationContexts.forEach(({ metadata }) => {
      const technicalAlertId = numberOrNull(metadata.alertId);
      if (technicalAlertId) notificationByTechnicalAlertId.set(technicalAlertId, metadata);
    });

    const alerts = [
      ...notifications.map((notification) => {
        const alert = mapNotification(notification);
        return enrichAlert(alert, {
          visit: visitMap.get(numberOrNull(alert.visitId)),
          repair: repairMap.get(numberOrNull(alert.repairId)),
        });
      }),
      ...technicalAlerts.map((technicalAlert) => {
        const alert = mapTechnicalAlert(technicalAlert);
        const linked = notificationByTechnicalAlertId.get(Number(technicalAlert.id)) || {};
        const parsedVisitId = extractVisitIdFromText(technicalAlert.message, technicalAlert.type);
        const visitId = numberOrNull(linked.visitId) || parsedVisitId || null;
        return enrichAlert({
          ...alert,
          visitId,
          repairId: linked.repairId || null,
        }, {
          visit: visitMap.get(numberOrNull(visitId)),
          repair: repairMap.get(numberOrNull(linked.repairId)),
          attachments: technicalAlert.attachments || [],
        });
      }),
      ...visitAlerts
        .filter((visit) => String(visit.alerts || visit.reason || visit.status || "").trim())
        .map((visit) => enrichAlert(mapVisitAlert(visit), { visit })),
      ...genericAlerts.filter((alert) => isOpenStatus(alert.status)).map(mapGenericAlert),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      ok: true,
      count: alerts.length,
      totals: {
        notifications: notifications.length,
        technical: technicalAlerts.length,
        visits: visitAlerts.length,
        generic: genericAlerts.length,
        critical: alerts.filter((alert) => alert.priority === "CRITICAL").length,
      },
      alerts,
    });
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
