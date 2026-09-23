'use strict';
const { createHash } = require('node:crypto');
const { roleMatches } = require('../utils/roles');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function fail(message, statusCode = 400, code = 'INVALID_FIELD_REQUEST') { throw Object.assign(new Error(message), { statusCode, code }); }
function owner(actor) {
  const tech = Number(actor?.technicianId || actor?.id), user = Number(actor?.userId || actor?.id);
  if (roleMatches(actor?.role, 'ADMIN') && Number.isSafeInteger(user) && user > 0) return `ADMIN:${user}`;
  if (!roleMatches(actor?.role, 'TECHNICIAN') || !Number.isSafeInteger(tech) || tech <= 0) fail('Sessão de campo inválida.', 403);
  if (actor.principalType === 'USER') { if (!Number.isSafeInteger(user) || user <= 0) fail('Conta de campo inválida.', 403); return `USER:${user}:TECH:${tech}`; }
  return `TECH:${tech}`;
}
function context(actor, scope, resourceId, requestId, payload) {
  if (typeof requestId !== 'string' || !uuid.test(requestId) || !Number.isSafeInteger(resourceId) || resourceId <= 0 || !['VISIT_PHOTO', 'VISIT_COMPLETION', 'TECHNICIAN_ALERT', 'FIELD_STOCK_REQUEST', 'FIELD_PROBLEM_REPORT', 'FIELD_CLIENT_INTAKE', 'FIELD_CLIENT_APPROVAL', 'CLIENT_REPORT_SETTINGS', 'CLIENT_SERVICE_PLAN', 'CLIENT_SERVICE_GENERATION', 'EXTRA_VISIT_START', 'EXTRA_VISIT_PHOTO', 'EXTRA_VISIT_COMPLETION', 'EXTRA_VISIT_CORRECTION', 'EQUIPMENT_MAINTENANCE', 'VISIT_INCOMPLETE', 'VISIT_RETURN', 'REPAIR_EXECUTION', 'REPAIR_WORK_INTERVAL', 'LABOR_COST_COMPOSITION', 'MONTHLY_EMAIL_REVIEW', 'MONTHLY_EMAIL_RETRY'].includes(scope)) fail('Conserve o pedido de campo original.');
  return { owner: owner(actor), requestId: requestId.toLowerCase(), scope, resourceId, payloadHash: hash({ v: 1, scope, resourceId, payload }) };
}
async function recover(tx, request) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`field-request:${request.owner}:${request.requestId}`}))::text`;
  const saved = await tx.fieldWriteRequest.findUnique({ where: { owner_requestId: { owner: request.owner, requestId: request.requestId } } });
  if (!saved) return null;
  if (saved.scope !== request.scope || saved.resourceId !== request.resourceId || saved.payloadHash !== request.payloadHash) fail('Este identificador pertence a outro envio. Conserve o pedido original.', 409, 'FIELD_REQUEST_REUSED');
  return saved.response;
}
async function confirm(tx, request, result) {
  const response = JSON.parse(JSON.stringify({ ...result, receipt: { ...request, confirmedAt: new Date().toISOString() } }));
  await tx.fieldWriteRequest.create({ data: { ...request, response } });
  return response;
}
function authorize(actor, visit) {
  if (!visit) fail('Visita não encontrada.', 404, 'VISIT_NOT_FOUND');
  if (!roleMatches(actor?.role, 'ADMIN') && visit.technicianId !== Number(actor?.technicianId || actor?.id)) fail('Sem permissão para esta visita.', 403, 'FIELD_VISIT_FORBIDDEN');
}
module.exports = { context, recover, confirm, authorize, owner, fail, hash };
