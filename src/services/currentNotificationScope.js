const { prisma } = require('../prismaClient');
const { activeFor } = require('./notificationScopeService');
const reminders = require('../business/equipment/EquipmentMaintenanceReminderBusiness');

// Preserve the existing role scope; validate preventive notices against current visits.
// Reads never create notices or change delivery/read history.
async function currentNotificationScope(user) {
  const scope = activeFor(user);
  const validIds = [];
  const now = new Date();
  let cursor = 0;
  while (true) {
    const rows = await prisma.notification.findMany({
      where: { AND: [scope, { eventType: reminders.TYPE, id: { gt: cursor } }] },
      orderBy: { id: 'asc' }, take: 500,
    });
    if (!rows.length) break;
    for (const row of rows) {
      if (await reminders.isCurrentNotification(row, { now })) validIds.push(row.id);
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < 500) break;
  }
  return { AND: [scope, { OR: [
    { eventType: null },
    { eventType: { not: reminders.TYPE } },
    { id: { in: validIds } },
  ] }] };
}
module.exports = { currentNotificationScope };
