'use strict';
const { prisma } = require('../../prismaClient');
const repeat = require('../../services/reminderRepeatService');
const { id, SERVICE_CATEGORIES } = require('../../services/reminderScopeService');
const CLOSED = ['DONE', 'COMPLETED', 'CLOSED', 'RESOLVED'];
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }

async function complete({ reminderId, poolId, createdBy = 'ADMIN' }) {
  const reminderKey = id(reminderId), poolKey = poolId === undefined ? null : id(poolId);
  if (!prisma.generalReminder) fail(501, 'Lembretes indisponiveis');
  return prisma.$transaction(async tx => {
    // The row lock also serializes updates/deletes from other entry points.
    await tx.$queryRaw`SELECT id FROM "GeneralReminder" WHERE id = ${reminderKey} FOR UPDATE`;
    const existing = await tx.generalReminder.findUnique({ where: { id: reminderKey } });
    const periodic = existing && SERVICE_CATEGORIES.includes(existing.category);
    if (!existing || (poolKey !== null && (existing.poolId !== poolKey || !periodic))) fail(404, 'Lembrete nao encontrado nesta piscina');
    const status = String(existing.status || '').trim().toUpperCase();
    if (['CANCELLED', 'CANCELED'].includes(status)) fail(409, 'Este lembrete foi cancelado. Atualiza a lista.');
    if (existing.completedAt || CLOSED.includes(status)) {
      // No new occurrence is produced by a replay; the caller refreshes the list.
      return { ok: true, reminder: existing, nextReminder: null, idempotent: true };
    }
    let interval = null;
    const rule = String(existing.repeatRule || '').trim().toUpperCase();
    if (periodic && rule && rule !== 'NONE') {
      interval = repeat.parseRepeatRuleInterval(rule);
      if (!repeat.validateRepeatInterval(interval)) fail(409, 'Repeticao do lembrete invalida. Corrige a regra antes de concluir.');
    }
    const completed = await tx.generalReminder.update({ where: { id: reminderKey }, data: { status: 'DONE', completedAt: new Date() } });
    const nextReminder = interval ? await tx.generalReminder.create({ data: {
      title: existing.title, description: existing.description, category: existing.category,
      priority: existing.priority, status: 'PENDING', dueAt: repeat.addRepeatInterval(existing.dueAt, interval),
      clientId: existing.clientId, poolId: existing.poolId, technicianId: existing.technicianId,
      leadId: existing.leadId, appointmentId: existing.appointmentId,
      repeatRule: existing.repeatRule, createdBy,
    } }) : null;
    return { ok: true, reminder: completed, nextReminder };
  });
}

module.exports = { complete };
