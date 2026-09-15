'use strict';
const { prisma } = require('../../prismaClient');
const { roleMatches } = require('../../utils/roles');
const { id, SERVICE_CATEGORIES } = require('../../services/reminderScopeService');
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function version(value) {
  if (value === undefined) return null; // Compatibility for existing API clients.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(400, 'Versao do lembrete invalida');
  return value;
}
async function remove(user, { poolId, reminderId, expectedUpdatedAt }) {
  if (!roleMatches(user?.role, 'ADMIN') || !user?.id) fail(403, 'Apenas a gestao pode eliminar lembretes');
  const poolKey = id(poolId), reminderKey = id(reminderId), expected = version(expectedUpdatedAt);
  if (!prisma.generalReminder) fail(501, 'Lembretes indisponiveis');
  const sourceKey = `reminder-delete:${reminderKey}`;
  return prisma.$transaction(async tx => {
    // Also serializes retries after the original row has gone. Completion uses the same row lock.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
    await tx.$queryRaw`SELECT id FROM "GeneralReminder" WHERE id = ${reminderKey} FOR UPDATE`;
    const existing = await tx.generalReminder.findUnique({ where: { id: reminderKey } });
    const receipt = await tx.operationalReminder.findUnique({ where: { sourceKey } });
    if (receipt) {
      const result = receipt.metadata?.result;
      if (result?.poolId !== poolKey) fail(404, 'Lembrete nao encontrado nesta piscina');
      if (existing || (expected && result.deletedVersion !== expected)) fail(409, 'O lembrete foi alterado. Atualiza a lista e confirma novamente.');
      return { ...result, idempotent: true };
    }
    if (!existing || existing.poolId !== poolKey || !SERVICE_CATEGORIES.includes(existing.category)) fail(404, 'Lembrete nao encontrado nesta piscina');
    const deletedVersion = existing.updatedAt.toISOString();
    if (expected && expected !== deletedVersion) fail(409, 'O lembrete foi alterado. Atualiza a lista e confirma novamente.');
    const now = new Date();
    const result = { ok: true, deleted: true, reminderId: reminderKey, poolId: poolKey, deletedVersion, deletedAt: now.toISOString() };
    await tx.generalReminder.delete({ where: { id: reminderKey } });
    await tx.operationalReminder.create({ data: {
      sourceKey, title: 'Eliminacao de lembrete confirmada', dueDate: now, isCompleted: true,
      metadata: { actor: `ADMIN:${user.id}`, reminder: JSON.parse(JSON.stringify(existing)), result },
    } });
    return result;
  });
}
module.exports = { remove, version };
