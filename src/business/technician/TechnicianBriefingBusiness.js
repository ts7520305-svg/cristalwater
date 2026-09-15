'use strict';
const { prisma } = require('../../prismaClient');
const CLOSED = ['DONE', 'CLOSED', 'COMPLETED', 'RESOLVED', 'CANCELLED', 'CANCELED'];
const ids = values => [...new Set(values.filter(value => Number.isSafeInteger(value) && value > 0))];

async function readAll(model, where) {
  const rows = [];
  let after = 0;
  for (;;) {
    const batch = await model.findMany({ where: { ...where, id: { gt: after } }, orderBy: { id: 'asc' }, take: 500 });
    rows.push(...batch);
    if (batch.length < 500) return rows;
    after = batch[batch.length - 1].id;
  }
}

// The caller supplies visits already restricted to the authenticated route.
// A pool reminder belongs only to that pool; a client reminder has no poolId.
async function loadVisitBriefings(visits) {
  const targets = visits.map(visit => ({
    visit, poolId: visit.poolId || visit.pool?.id || null,
    clientId: visit.clientId || visit.client?.id || visit.pool?.clientId || visit.pool?.client?.id || null,
    technicianId: visit.technicianId || visit.technician?.id || null,
  }));
  const poolIds = ids(targets.map(v => v.poolId)), clientIds = ids(targets.map(v => v.clientId));
  const technicianIds = ids(targets.map(v => v.technicianId));
  const targetScope = { OR: [
    ...(poolIds.length ? [{ poolId: { in: poolIds } }] : []),
    ...(clientIds.length ? [{ poolId: null, clientId: { in: clientIds } }] : []),
  ] };
  const ownerScope = field => ({ OR: [{ [field]: null }, ...(technicianIds.length ? [{ [field]: { in: technicianIds } }] : [])] });
  const [general, operational] = targetScope.OR.length ? await Promise.all([
    readAll(prisma.generalReminder, { status: { notIn: CLOSED }, completedAt: null, AND: [targetScope, ownerScope('technicianId')] }),
    readAll(prisma.operationalReminder, { isCompleted: false, AND: [targetScope, ownerScope('assignedToTechnicianId')] }),
  ]) : [[], []];
  const relevant = (rows, target, scope, ownerField, dateField) => rows.filter(row => {
    if (row[ownerField] != null && row[ownerField] !== target.technicianId) return false;
    return scope === 'pool'
      ? row.poolId != null && row.poolId === target.poolId
      : row.poolId == null && row.clientId != null && row.clientId === target.clientId;
  }).sort((a, b) => new Date(a[dateField]) - new Date(b[dateField]) || a.id - b.id);
  return new Map(targets.map(target => [target.visit, {
    notes: typeof target.visit.pool?.notes === 'string' ? target.visit.pool.notes : null,
    poolGeneral: relevant(general, target, 'pool', 'technicianId', 'dueAt'),
    clientGeneral: relevant(general, target, 'client', 'technicianId', 'dueAt'),
    poolOperational: relevant(operational, target, 'pool', 'assignedToTechnicianId', 'dueDate'),
    clientOperational: relevant(operational, target, 'client', 'assignedToTechnicianId', 'dueDate'),
  }]));
}

module.exports = { loadVisitBriefings };
