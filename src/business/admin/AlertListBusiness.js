'use strict';
const { prisma } = require('../../prismaClient');
const { CLOSED_STATUSES, ALERT_NOTIFICATION_TYPES, ALERT_EVENT_TYPES, SERVICE_VISIT_INCLUDE,
  metadataOf, numberOrNull, uniqueNumbers, reportReference, legacyVisitMetadata, extractVisitIdFromText, enrichAlert,
  mapNotification, mapTechnicalAlert, mapVisitAlert, mapGenericAlert, isOpenStatus,
} = require('../../services/alertPresentationService');
const priority = { CRITICAL: 0, WARNING: 1, NORMAL: 2, LOW: 3 };

// Keyset reads bound each query without silently bounding the returned list.
async function readAll(model, { where, ...options }) {
  const rows = [];
  let after = 0;
  for (;;) {
    const batch = await model.findMany({ ...options,
      where: { AND: [where, { id: { gt: after } }] }, orderBy: { id: 'asc' }, take: 500,
    });
    rows.push(...batch);
    if (batch.length < 500) return rows;
    after = batch.at(-1).id;
  }
}

async function readLinked(model, ids, include) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    rows.push(...await model.findMany({ where: { id: { in: ids.slice(offset, offset + 500) } }, include }));
  }
  return rows;
}

async function list() {
  return prisma.$transaction(async tx => {
    const [notifications, technicalAlerts, visitAlerts, genericAlerts] = await Promise.all([
      readAll(tx.notification, { where: {
        OR: [{ type: { in: ALERT_NOTIFICATION_TYPES } }, { eventType: { in: ALERT_EVENT_TYPES } },
          { severity: { in: ['HIGH', 'CRITICAL', 'WARNING', 'WARN'] } }],
        NOT: { status: { in: CLOSED_STATUSES } },
      }, include: { client: true, user: true } }),
      readAll(tx.technicalAlert, { where: { status: { notIn: CLOSED_STATUSES } },
        include: { pool: { include: { client: true } }, attachments: true } }),
      readAll(tx.serviceVisit, { where: { OR: [{ alerts: { not: null } },
        { status: { in: ['NOT_DONE', 'BLOCKED', 'RETAINED', 'IMPEDIDO'] } }] }, include: SERVICE_VISIT_INCLUDE }),
      readAll(tx.alert, { where: { active: true, status: { notIn: CLOSED_STATUSES } } }),
    ]);
    // Preserve the existing context selection when several notifications refer to an alert.
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);
    const notificationContexts = notifications.map((notification) => ({
      notification,
      metadata: metadataOf(notification),
    }));
    const technicalVisitIds = technicalAlerts.map((alert) => extractVisitIdFromText(alert.message, alert.type));
    const knownVisitIds = new Set(visitAlerts.map(visit => visit.id));
    const linkedVisitIds = uniqueNumbers([
      ...notificationContexts.filter(({ metadata }) => reportReference(metadata)?.type === 'REGULAR' || legacyVisitMetadata(metadata)).map(({ metadata }) => metadata.visitId),
      ...technicalVisitIds,
    ]).filter(id => !knownVisitIds.has(id));
    const linkedRepairIds = uniqueNumbers(notificationContexts.map((row) => row.metadata.repairId));

    const extraVisitIds = uniqueNumbers(notificationContexts.map(({ metadata }) => { const ref = reportReference(metadata); return ref?.type === 'EXTRA' ? ref.visitId : null; }));
    const [linkedVisits, linkedRepairs, extraVisits] = await Promise.all([
      readLinked(tx.serviceVisit, linkedVisitIds, SERVICE_VISIT_INCLUDE),
      readLinked(tx.repair, linkedRepairIds, { pool: { include: { client: true } } }),
      readLinked(tx.extraVisit, extraVisitIds, { client: true, pool: { include: { client: true } }, technician: true, photos: true }),
    ]);

    const visitMap = new Map([...visitAlerts, ...linkedVisits].map((visit) => [Number(visit.id), visit]));
    const extraVisitMap = new Map(extraVisits.map(visit => [visit.id, visit]));
    const repairMap = new Map(linkedRepairs.map((repair) => [Number(repair.id), repair]));
    const notificationByTechnicalAlertId = new Map();
    notificationContexts.forEach(context => {
      const technicalAlertId = numberOrNull(context.metadata.alertId);
      if (technicalAlertId) {
        const contexts = notificationByTechnicalAlertId.get(technicalAlertId) || [];
        contexts.push(context); notificationByTechnicalAlertId.set(technicalAlertId, contexts);
      }
    });
    const linkedVisit = (ref, fallbackId) => ref ? (ref.type === 'EXTRA' ? extraVisitMap : visitMap).get(ref.visitId) : visitMap.get(numberOrNull(fallbackId));

    const alerts = [
      ...notifications.map(notification => {
        const metadata = metadataOf(notification), ref = reportReference(metadata), legacy = legacyVisitMetadata(metadata);
        const alert = mapNotification(notification);
        const visit = ref || legacy ? linkedVisit(ref, alert.visitId) : null;
        const consistent = !ref || visit && (!alert.clientId || alert.clientId === visit.clientId) && (!alert.poolId || alert.poolId === visit.poolId) && (!metadata.clientId || metadata.clientId === visit.clientId);
        return enrichAlert({ ...alert, visitId: ref?.visitId || alert.visitId }, {
          visit: consistent ? visit : null,
          visitType: ref?.type || (legacy ? 'REGULAR' : null), reportVisit: Boolean(ref),
          repair: repairMap.get(numberOrNull(alert.repairId)),
        });
      }),
      ...technicalAlerts.map(technicalAlert => {
        const alert = mapTechnicalAlert(technicalAlert);
        const contexts = notificationByTechnicalAlertId.get(Number(technicalAlert.id)) || [];
        const linked = contexts.at(-1)?.metadata || {}, refs = contexts.map(context => reportReference(context.metadata));
        const ref = refs[0] && refs.every(item => item?.type === refs[0].type && item?.visitId === refs[0].visitId) ? refs[0] : null;
        const legacy = contexts.every(context => legacyVisitMetadata(context.metadata));
        const parsedVisitId = extractVisitIdFromText(technicalAlert.message, technicalAlert.type);
        const visitId = ref?.visitId || numberOrNull(linked.visitId) || parsedVisitId || null;
        const visit = ref || legacy ? linkedVisit(ref, visitId) : null;
        const consistent = !ref || visit && (!alert.poolId || alert.poolId === visit.poolId) && (!alert.clientId || alert.clientId === visit.clientId) && (!parsedVisitId || parsedVisitId === ref.visitId) &&
          contexts.every(({ notification, metadata }) => (!notification.clientId || notification.clientId === visit.clientId) && (!metadata.clientId || metadata.clientId === visit.clientId) && (!metadata.poolId || metadata.poolId === visit.poolId));
        return enrichAlert({ ...alert, visitId, repairId: linked.repairId || null }, {
          visit: consistent ? visit : null,
          visitType: ref?.type || (legacy ? 'REGULAR' : null), reportVisit: Boolean(ref) && consistent,
          repair: repairMap.get(numberOrNull(linked.repairId)),
          attachments: technicalAlert.attachments || [],
        });
      }),
      ...visitAlerts
        .filter((visit) => String(visit.alerts || visit.reason || visit.status || "").trim())
        .map((visit) => enrichAlert(mapVisitAlert(visit), { visit, reportVisit: true })),
      ...genericAlerts.filter((alert) => isOpenStatus(alert.status)).map(mapGenericAlert),
    ].sort((a, b) => priority[a.priority] - priority[b.priority] || new Date(b.createdAt) - new Date(a.createdAt) || a.id.localeCompare(b.id));

    return {
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
    };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
}
// Compatibility listing for the former client-auth alias, now restricted to ADMIN.
async function listLegacyTechnical() {
  return prisma.technicalAlert.findMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    include: { pool: { include: { client: true } } }, orderBy: { createdAt: 'desc' } });
}
module.exports = { list, listLegacyTechnical };
