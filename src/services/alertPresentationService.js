'use strict';
const extraProjection = require('./extraVisitReportProjection');
const { parseReference, resolutionVersion, requirement } = require('./alertResolutionStateService');

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

// Metadata must identify the table explicitly; a number alone is never report provenance.
function reportReference(metadata = {}) {
  const validId = value => (typeof value === 'number' || typeof value === 'string' && /^[1-9]\d*$/.test(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647 ? Number(value) : null;
  const hasExtra = metadata.extraVisitId !== undefined && metadata.extraVisitId !== null;
  const type = metadata.visitType ?? (hasExtra ? 'EXTRA' : null);
  const visitId = validId(metadata.visitId ?? (hasExtra ? metadata.extraVisitId : null));
  if (!['REGULAR', 'EXTRA'].includes(type) || !visitId || hasExtra && (type !== 'EXTRA' || validId(metadata.extraVisitId) !== visitId)) return null;
  return { type, visitId };
}
function legacyVisitMetadata(metadata = {}) {
  return metadata.visitType === undefined && metadata.extraVisitId === undefined;
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

function buildServiceNote(visit, visitType) {
  if (!visit?.id) return null;
  const extra = visitType === 'EXTRA';
  if (extra) visit = extraProjection(visit);
  const photos = (visit.photos || []).map(mapPhoto).filter(Boolean);
  const attachments = (visit.attachments || []).map(mapAttachment).filter(Boolean);
  const products = productsSummary(visit.products, visit.chemicals);
  return {
    visitId: visit.id,
    href: `/api/reports/visit/${visit.id}${extra ? '?visitType=EXTRA' : ''}`,
    visitType,
    status: visit.status || null,
    date: visit.endAt || visit.startAt || visit.plannedDate || visit.date || visit.createdAt || visit.updatedAt,
    reason: cleanText(visit.reason),
    alerts: cleanText(extra ? visit.problem : visit.alerts),
    notes: cleanText(visit.notes),
    internalNotes: cleanText(visit.internalNotes),
    ...(extra ? { planningNotes: cleanText(visit.planningNotes) } : {}),
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

function enrichAlert(alert, { visit, repair, attachments = [], reportVisit = false, visitType = 'REGULAR' } = {}) {
  const serviceNote = buildServiceNote(visit, visitType);
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
    visitType,
    href: visitType === 'EXTRA' ? buildHref({ clientId: alert.clientId || visitClientId, poolId: alert.poolId || visitPoolId }) : alert.href,
    visitHref: visitId && visitType === 'REGULAR' ? `/admin-visits?visitId=${visitId}` : null,
    serviceNote,
    report: reportVisit && ['REGULAR', 'EXTRA'].includes(visitType) && visit?.clientId && visitId === visit.id &&
      (!visit.pool?.clientId || visit.pool.clientId === visit.clientId) && (!alert.clientId || alert.clientId === visit.clientId) && (!alert.poolId || alert.poolId === visit.poolId)
      ? { type: visitType, visitId: visit.id, clientId: visit.clientId } : null,
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
    resolutionVersion: resolutionVersion('notification', alert),
    resolutionRequirement: requirement('notification', alert),
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
    resolutionVersion: resolutionVersion('technical', alert),
    resolutionRequirement: requirement('technical', alert),
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
    resolutionVersion: resolutionVersion('visit', visit),
    resolutionRequirement: requirement('visit', visit),
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
    resolutionVersion: resolutionVersion('generic', alert),
    resolutionRequirement: requirement('generic', alert),
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

module.exports = { CLOSED_STATUSES, ALERT_NOTIFICATION_TYPES, ALERT_EVENT_TYPES, SERVICE_VISIT_INCLUDE, parseReference, reportReference, legacyVisitMetadata, isOpenStatus, metadataOf, numberOrNull, uniqueNumbers, extractVisitIdFromText, enrichAlert, mapNotification, mapTechnicalAlert, mapVisitAlert, mapGenericAlert };
