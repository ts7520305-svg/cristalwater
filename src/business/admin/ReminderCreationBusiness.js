'use strict';
const { prisma } = require('../../prismaClient');
const { createHash } = require('node:crypto');
const { roleMatches } = require('../../utils/roles');
const { normalizeRepeatRuleInput } = require('../../services/reminderRepeatService');
const PERIODIC = ['TECHNICAL_PERIODIC_SERVICE', 'POOL_SERVICE_REMINDER'];
function fail(statusCode, message) { throw Object.assign(new Error(message), { statusCode }); }
function text(value, name, max, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || value.length > max) fail(400, `${name} invalido`);
  return value.trim() || fallback;
}
function id(value, optional = true) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || Number(value) > 2147483647) fail(400, 'Identificador invalido');
  return Number(value);
}
function normalize(body, poolId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Lembrete invalido');
  const service = poolId !== undefined;
  const title = text(body.title, 'Titulo', 300);
  const date = typeof body.dueAt === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(body.dueAt) ? new Date(body.dueAt) : null;
  if (!title || !date || !Number.isFinite(date.getTime())) fail(400, 'Titulo e data do lembrete sao obrigatorios');
  const category = service ? 'TECHNICAL_PERIODIC_SERVICE' : text(body.category, 'Categoria', 80, 'GENERAL');
  const priority = text(body.priority, 'Prioridade', 30, 'NORMAL');
  if (!['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'].includes(priority)) fail(400, 'Prioridade invalida');
  const status = service ? 'PENDING' : text(body.status, 'Estado', 30, 'PENDING');
  if (!['PENDING', 'OPEN', 'ACTIVE', 'DONE', 'COMPLETED', 'CLOSED', 'RESOLVED', 'CANCELLED', 'CANCELED'].includes(status)) fail(400, 'Estado invalido');
  const repeatRule = PERIODIC.includes(category) ? normalizeRepeatRuleInput(body) : text(body.repeatRule, 'Repeticao', 80);
  const requestId = body.requestId;
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))) fail(400, 'Identificador do pedido invalido');
  return { requestId, source: service ? 'pool' : 'crm', data: {
    title, dueAt: date.toISOString(), description: text(body.description, 'Descricao', 20000), category, priority, status, repeatRule,
    poolId: id(service ? poolId : body.poolId, !service), clientId: service ? null : id(body.clientId),
    technicianId: id(body.technicianId), leadId: service ? null : id(body.leadId), appointmentId: service ? null : id(body.appointmentId),
  } };
}
async function create(user, body, poolId) {
  if (!roleMatches(user?.role, 'ADMIN') || !user?.id) fail(403, 'Apenas a gestao pode criar lembretes');
  const input = normalize(body, poolId), actor = `ADMIN:${user.id}`;
  const fingerprint = createHash('sha256').update(JSON.stringify({ actor, source: input.source, data: input.data })).digest('hex');
  return prisma.$transaction(async tx => {
    const sourceKey = input.requestId ? `reminder-create:${input.requestId.toLowerCase()}` : null;
    if (sourceKey) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
      const previous = await tx.operationalReminder.findUnique({ where: { sourceKey } });
      if (previous) {
        if (previous.metadata?.fingerprint !== fingerprint) fail(409, 'Pedido ja utilizado com outros dados. Confirma primeiro o pedido original.');
        return { ...previous.metadata.result, idempotent: true };
      }
    }
    const data = { ...input.data, dueAt: new Date(input.data.dueAt), createdBy: user.email || actor };
    if (data.poolId) {
      const pool = await tx.pool.findUnique({ where: { id: data.poolId }, select: { clientId: true } });
      if (!pool) fail(404, 'Piscina nao encontrada');
      if (data.clientId && data.clientId !== pool.clientId) fail(400, 'Cliente nao corresponde a piscina');
      data.clientId = pool.clientId;
    }
    for (const [field, model] of [['clientId', 'client'], ['technicianId', 'technician'], ['leadId', 'lead'], ['appointmentId', 'appointment']]) {
      if (data[field] && !await tx[model].findUnique({ where: { id: data[field] }, select: { id: true } })) fail(404, 'Destino do lembrete nao encontrado');
    }
    const reminder = await tx.generalReminder.create({ data });
    const result = { ok: true, reminder, ...(input.requestId ? { requestId: input.requestId } : {}) };
    if (sourceKey) await tx.operationalReminder.create({ data: {
      sourceKey, title: 'Criacao de lembrete confirmada', dueDate: new Date(), isCompleted: true,
      metadata: { fingerprint, result: JSON.parse(JSON.stringify(result)) },
    } });
    return result;
  });
}
module.exports = { create, normalize };
