'use strict';
const { prisma } = require('../prismaClient');
const requests = require('./fieldWriteRequestService');
async function create(actor, body = {}) {
  const technicianId = Number(actor?.technicianId || actor?.id);
  const owner = requests.owner(actor);
  if (owner.startsWith('ADMIN:')) requests.fail('Este envio requer uma sessão de técnico.', 403);
  const { requestId, message, visitId, priority } = body;
  if (Object.keys(body).some(key => !['requestId','message','visitId','priority'].includes(key)) || typeof message !== 'string' || !message.trim() || message.length > 5000 || !['NORMAL','HIGH'].includes(priority) || (visitId !== null && (!Number.isSafeInteger(visitId) || visitId <= 0))) requests.fail('Indique a mensagem, a prioridade e a visita correta, ou sem visita associada.');
  const request = requests.context(actor, 'TECHNICIAN_ALERT', technicianId, requestId, { message, visitId, priority });
  return prisma.$transaction(async tx => {
    const saved = await requests.recover(tx, request); if (saved) return saved;
    const technician = await tx.technician.findUnique({ where: { id: technicianId }, select: { id: true, name: true, active: true } });
    if (!technician?.active) requests.fail('Técnico indisponível. Preserve o pedido.', 403);
    let visit = null;
    if (visitId !== null) {
      await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${visitId} FOR UPDATE`;
      visit = await tx.serviceVisit.findUnique({ where: { id: visitId }, select: { id: true, technicianId: true, poolId: true, clientId: true, pool: { select: { name: true } } } });
      requests.authorize(actor, visit);
    }
    const metadata = { owner, requestId: request.requestId, technicianId, technicianName: technician.name, visitId, poolId: visit?.poolId || null, poolName: visit?.pool?.name || null, recipientRole: 'ADMIN' };
    // No CLIENT/user recipient and no broadcast: this record is for the office only.
    const notification = await tx.notification.create({ data: { role: 'ADMIN', type: 'ALERT', eventType: 'TECHNICIAN_INTERNAL_ALERT', title: 'Alerta do técnico', message, severity: priority, status: 'PENDING', metadata } });
    await tx.auditTrail.create({ data: { eventType: 'TECHNICIAN_INTERNAL_ALERT', entity: 'Notification', entityId: notification.id, technicianId, visitId, poolId: visit?.poolId || null, clientId: visit?.clientId || null, action: 'FIELD_INTERNAL_ALERT_CREATE', message: 'Alerta interno registado para a administração.', metadata } });
    return requests.confirm(tx, request, { ok: true, alert: { id: notification.id, technicianId, visitId, message, priority, recipientRole: 'ADMIN', createdAt: notification.createdAt } });
  }, { maxWait: 15000, timeout: 20000 });
}
module.exports = { create };
