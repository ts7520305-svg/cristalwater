'use strict';
const { prisma } = require('../../prismaClient');
const CLOSED = new Set(['DONE', 'COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED', 'CANCELED']);
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function filter(value) {
  if (value === undefined || value === '' || value === 'ALL') return undefined;
  if (typeof value !== 'string' || value.length > 80) fail(400, 'Filtro de lembretes invalido');
  return value;
}
async function list({ poolId, status, category } = {}) {
  if (!prisma.generalReminder) fail(501, 'Lembretes indisponiveis');
  const where = { status: filter(status), category: filter(category) };
  if (poolId !== undefined) {
    if (!/^[1-9]\d*$/.test(String(poolId)) || Number(poolId) > 2147483647) fail(400, 'ID da piscina invalido');
    where.poolId = Number(poolId);
    where.category = { in: ['TECHNICAL_PERIODIC_SERVICE', 'POOL_SERVICE_REMINDER'] };
  }
  // Read one consistent snapshot in bounded queries, without silently dropping rows.
  const reminders = await prisma.$transaction(async tx => {
    const rows = []; let after = 0;
    for (;;) {
      const batch = await tx.generalReminder.findMany({ where: { ...where, id: { gt: after } }, orderBy: { id: 'asc' }, take: 500 });
      rows.push(...batch);
      if (batch.length < 500) return rows;
      after = batch.at(-1).id;
    }
  }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
  const closed = row => Boolean(row.completedAt) || CLOSED.has(String(row.status).trim().toUpperCase());
  reminders.sort((a, b) => Number(closed(a)) - Number(closed(b)) ||
    (closed(a) ? new Date(b.completedAt || b.dueAt) - new Date(a.completedAt || a.dueAt) : new Date(a.dueAt) - new Date(b.dueAt)) || a.id - b.id);
  return { ok: true, reminders };
}
module.exports = { list };
