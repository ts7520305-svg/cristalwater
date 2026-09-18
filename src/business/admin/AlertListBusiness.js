'use strict';
const { prisma } = require('../../prismaClient');
const { CLOSED_STATUSES, ALERT_NOTIFICATION_TYPES, ALERT_EVENT_TYPES, SERVICE_VISIT_INCLUDE,
  metadataOf, numberOrNull, uniqueNumbers, extractVisitIdFromText, enrichAlert,
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
      ...notificationContexts.map((row) => row.metadata.visitId),
      ...technicalVisitIds,
    ]).filter(id => !knownVisitIds.has(id));
    const linkedRepairIds = uniqueNumbers(notificationContexts.map((row) => row.metadata.repairId));

    const [linkedVisits, linkedRepairs] = await Promise.all([
      readLinked(tx.serviceVisit, linkedVisitIds, SERVICE_VISIT_INCLUDE),
      readLinked(tx.repair, linkedRepairIds, { pool: { include: { client: true } } }),
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
          reportVisit: metadataOf(notification).visitType === 'REGULAR',
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
          reportVisit: linked.visitType === 'REGULAR' && Number(linked.visitId) === visitId,
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
