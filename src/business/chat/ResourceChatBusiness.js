'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { safePool, safeVisit } = require('../../services/technicianResponseSanitizer');
const OPEN = ['PLANNED', 'SCHEDULED', 'PENDING', 'IN_PROGRESS', 'STARTED', 'ARRIVED'];
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
function subject(user, rawId) {
  const role = normalizeRole(user?.role), id = Number(rawId);
  if (!['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(role)) fail(403, 'Sem permissão para esta conversa.');
  if (!/^[1-9]\d*$/.test(String(rawId)) || !Number.isSafeInteger(id) || id > 2147483647) fail(400, 'Identificador inválido.');
  const technicianId = role === 'ADMIN' ? null : Number(user.technicianId || (user.principalType !== 'USER' && user.id));
  if (role !== 'ADMIN' && (!Number.isSafeInteger(technicianId) || technicianId < 1)) fail(403, 'Perfil de campo por associar.');
  return { id, role, technicianId, actor: `${user.principalType || role}:${user.userId || user.id}` };
}
function noCredentials(resource) {
  const client = resource.client || resource.pool?.client;
  if (client) { delete client.password; delete client.pin; }
  if (resource.technician) { delete resource.technician.pin; delete resource.technician.password; }
  return resource;
}
async function poolAssignment(tx, poolId, technicianId, writing) {
  const where = { poolId, technicianId, status: { in: OPEN }, endAt: null };
  const visit = await tx.serviceVisit.findFirst({ where, select: { id: true }, orderBy: { id: 'asc' } });
  if (visit) {
    if (!writing) return true;
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${visit.id} FOR UPDATE`;
    if (await tx.serviceVisit.findFirst({ where: { ...where, id: visit.id }, select: { id: true } })) return true;
  }
  const serviceWhere = { poolId, technicianId, status: { in: OPEN } };
  const service = await tx.service.findFirst({ where: serviceWhere, select: { id: true }, orderBy: { id: 'asc' } });
  if (!service) return false;
  if (!writing) return true;
  await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${service.id} FOR UPDATE`;
  return Boolean(await tx.service.findFirst({ where: { ...serviceWhere, id: service.id }, select: { id: true } }));
}
async function execute(kind, user, rawId, writing, body) {
  const person = subject(user, rawId), { id, role, technicianId } = person;
  if (!['pool', 'service'].includes(kind)) throw Error('Unknown resource chat');
  if (writing && (typeof body?.text !== 'string' || !body.text.trim() || body.text.length > 4000)) fail(400, 'Indique uma mensagem de 1 a 4000 caracteres.');
  return prisma.$transaction(async tx => {
    if (writing && kind === 'service') await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${id} FOR UPDATE`;
    const resource = kind === 'pool'
      ? await tx.pool.findUnique({ where: { id }, include: { client: true } })
      : await tx.service.findUnique({ where: { id }, include: { pool: { include: { client: true } }, technician: true } });
    if (!resource) fail(404, 'Conversa não encontrada.');
    if (role !== 'ADMIN') {
      const pool = kind === 'pool' ? resource : resource.pool;
      if (!pool?.active || !pool.client?.active) fail(404, 'Conversa não encontrada.');
      const assigned = kind === 'pool' ? await poolAssignment(tx, id, technicianId, writing) : resource.technicianId === technicianId;
      if (!assigned) fail(404, 'Conversa não encontrada.');
      if (writing && kind === 'service' && !OPEN.includes(resource.status)) fail(409, 'O serviço já não está aberto.');
    }
    const model = kind === 'pool' ? tx.poolMessage : tx.serviceMessage, key = kind === 'pool' ? 'poolId' : 'serviceId';
    if (!writing) {
      const messages = await model.findMany({ where: { [key]: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      const clean = noCredentials(resource);
      return { [kind]: role === 'ADMIN' ? clean : kind === 'pool' ? safePool(clean) : safeVisit(clean), messages };
    }
    const message = await model.create({ data: { [key]: id, senderType: role === 'ADMIN' ? 'ADMIN' : 'TECH', text: body.text.trim() } });
    await tx.userAuditLog.create({ data: { actor: person.actor, action: 'RESOURCE_CHAT_SENT', entity: kind === 'pool' ? 'PoolMessage' : 'ServiceMessage', entityId: String(message.id), metadata: { resourceId: id, senderType: message.senderType, technicianId } } });
    return message;
  });
}
module.exports = {
  list: (kind, user, id) => execute(kind, user, id, false),
  send: (kind, user, id, body) => execute(kind, user, id, true, body)
};
