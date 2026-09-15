'use strict';
const { randomUUID } = require('crypto');
const { prisma } = require('../../prismaClient');
const { roleMatches } = require('../../utils/roles');
const { parseReference, resolutionVersion, expectedVersion, requirement, fail } = require('../../services/alertResolutionStateService');
const CLOSED = new Set(['RESOLVED', 'DONE', 'CLOSED', 'CANCELLED', 'CANCELED', 'ARCHIVED', 'SUPERSEDED']);
const model = { notification: 'notification', technical: 'technicalAlert', visit: 'serviceVisit', generic: 'alert' };
async function lock(tx, source, id) {
  if (source === 'technical') return tx.$queryRaw`SELECT id FROM "TechnicalAlert" WHERE id = ${id} FOR UPDATE`;
  if (source === 'visit') return tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${id} FOR UPDATE`;
  if (source === 'generic') return tx.$queryRaw`SELECT id FROM "Alert" WHERE id = ${id} FOR UPDATE`;
  return tx.$queryRaw`SELECT id FROM "Notification" WHERE id = ${id} FOR UPDATE`;
}
async function managedRequirement(tx, source, row) {
  const direct = requirement(source, row);
  if (direct && direct.code !== 'PHYSICAL_CONFIRMATION_REQUIRED') return direct;
  // Retain the physical workflow even if an old linked notice has a generic type.
  const reminderId = row.metadata?.reminderId;
  const match = source === 'technical' ? { metadata: { path: ['alertId'], equals: row.id } } :
    source === 'notification' && Number.isInteger(reminderId) && reminderId > 0 ? { id: reminderId } : null;
  if (!match) return direct;
  const linked = await tx.operationalReminder.findFirst({ where: { AND: [match, { OR: [
    { sourceKey: { startsWith: 'water:' } }, { sourceKey: { startsWith: 'pump:' } }, { title: { startsWith: 'Agua aberta - ' } },
  ] }] } });
  return linked ? (linked.isCompleted ? null : requirement(source, { type: 'WATER_OPEN' })) : direct;
}
async function resolve(user, reference, body = {}) {
  if (!roleMatches(user?.role, 'ADMIN') || !Number.isInteger(user?.id) || user.id <= 0) fail(403, 'Apenas a gestao pode resolver alertas');
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Pedido de resolucao invalido');
  const { source, id } = parseReference(reference), expected = expectedVersion(body.expectedVersion);
  const canonicalReference = `${source}-${id}`, prefix = `alert-resolution:${canonicalReference}:`;
  return prisma.$transaction(async tx => {
    await lock(tx, source, id);
    const existing = await tx[model[source]].findUnique({ where: { id } });
    if (!existing) fail(404, 'Alerta nao encontrado');
    const blocked = await managedRequirement(tx, source, existing);
    if (blocked) fail(409, blocked.message, blocked.code);
    const current = resolutionVersion(source, existing);
    const receipt = await tx.operationalReminder.findFirst({ where: { sourceKey: { startsWith: prefix }, isCompleted: true,
      metadata: { path: ['result', 'resolvedVersion'], equals: current } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if (receipt) {
      const result = receipt.metadata.result;
      if (expected && ![result.sourceVersion, current].includes(expected)) fail(409, 'O alerta foi alterado. Atualize a lista e confirme novamente.');
      return { ...result, idempotent: true };
    }
    if (expected && expected !== current) fail(409, 'O alerta foi alterado. Atualize a lista e confirme novamente.');
    const closed = source === 'visit' ? !String(existing.alerts || '').trim() : CLOSED.has(String(existing.status).toUpperCase()) || (source === 'generic' && !existing.active);
    if (closed) {
      if (source === 'visit') fail(404, 'Esta visita nao tem um alerta por resolver');
      return { ok: true, resolved: true, reference: canonicalReference, source, numericId: id, sourceVersion: current,
        resolvedVersion: current, resolvedAt: existing.resolvedAt?.toISOString() || existing.readAt?.toISOString() || null, idempotent: true };
    }
    const now = new Date();
    const data = source === 'technical' ? { status: 'RESOLVED', resolvedAt: now } :
      source === 'generic' ? { status: 'RESOLVED', active: false, resolvedAt: now } :
        source === 'visit' ? { alerts: null } : { status: 'RESOLVED', isRead: true, readAt: now };
    const updated = await tx[model[source]].update({ where: { id }, data });
    const result = { ok: true, resolved: true, reference: canonicalReference, source, numericId: id,
      sourceVersion: current, resolvedVersion: resolutionVersion(source, updated), resolvedAt: now.toISOString() };
    // The original text, actor and acknowledgement commit with the change. Visits keep their notes and operational status.
    await tx.operationalReminder.create({ data: { sourceKey: prefix + randomUUID(), title: 'Resolucao de alerta confirmada', dueDate: now, isCompleted: true,
      metadata: { actor: `ADMIN:${user.id}`, original: JSON.parse(JSON.stringify(existing)), result } } });
    return result;
  }, { timeout: 30000 });
}
module.exports = { resolve };
