'use strict';
const { prisma } = require('../../prismaClient');
const bcrypt = require('bcryptjs');
const { createHash, createHmac } = require('node:crypto');
const { normalizeRole } = require('../../utils/roles');
const { getJwtSecret } = require('../../utils/jwtSecret');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const versionPattern = /^client-v1:[0-9a-f]{64}$/;
const stringFields = ['name', 'internalName', 'email', 'phone', 'address', 'zone', 'notes', 'fiscalName', 'fiscalNif', 'nif', 'fiscalAddress', 'fiscalEmail', 'externalBillingNotes'];
const boolFields = ['requiresInvoice', 'contractActive', 'billingActive'];
const numberFields = ['monthlyFee', 'monthlyAmount'];
function fail(statusCode, publicCode, message, fields) { throw Object.assign(new Error(message), { statusCode, publicCode, fields }); }
function identity(user) {
  const role = normalizeRole(user?.role), type = user?.principalType || (role === 'ADMIN' ? 'USER' : 'TECHNICIAN');
  const id = Number(type === 'USER' ? (user?.userId || user?.id) : (user?.technicianId || user?.id));
  if (!['ADMIN', 'TEAM_LEADER'].includes(role) || !Number.isSafeInteger(id) || id <= 0) fail(403, 'CLIENT_EDIT_FORBIDDEN', 'Sem permissão para editar clientes.');
  return type === 'ENV_ADMIN' ? 'ENV_ADMIN:' + createHash('sha256').update(String(user.email || '').trim().toLowerCase()).digest('hex') : type + ':' + id;
}
function clientId(raw) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail(400, 'INVALID_CLIENT_EDIT', 'Cliente inválido.');
  return id;
}
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
const serialize = value => JSON.stringify(canonical(value));
const digest = value => createHash('sha256').update(serialize(value)).digest('hex');
const version = client => 'client-v1:' + createHmac('sha256', getJwtSecret()).update('CLIENT_EDIT_STATE_V1\0' + serialize(client)).digest('hex');
function publicClient(client) { const { password, pin, ...safe } = client; return JSON.parse(JSON.stringify(safe)); }
const clean = value => value === undefined ? undefined : value === null ? null : value.trim() || null;
const bool = value => typeof value === 'boolean' ? value : ['true', '1', 'yes', 'sim', 'on'].includes(String(value || '').toLowerCase());
const number = value => value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);
function prepare(id, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_CLIENT_EDIT', 'Dados de edição inválidos.');
  const guarded = body.requestId !== undefined || body.expectedVersion !== undefined || body.credentialIntent !== undefined;
  if (guarded) {
    if (typeof body.requestId !== 'string' || !uuid.test(body.requestId) || typeof body.expectedVersion !== 'string' || !versionPattern.test(body.expectedVersion)) fail(400, 'INVALID_CLIENT_EDIT', 'Conserve o identificador e a versão da edição.');
    const allowed = new Set([...stringFields, ...boolFields, ...numberFields, 'password', 'pin', 'requestId', 'expectedVersion', 'credentialIntent']);
    if (Object.keys(body).some(key => !allowed.has(key))) fail(400, 'INVALID_CLIENT_EDIT', 'Campo de edição desconhecido.');
    for (const key of boolFields) if (body[key] !== undefined && typeof body[key] !== 'boolean') fail(400, 'INVALID_CLIENT_EDIT', 'Campo lógico inválido.');
    for (const key of numberFields) if (body[key] !== undefined && (!['number', 'string'].includes(typeof body[key]) || String(body[key]).trim() === '' || !Number.isFinite(Number(body[key])) || Number(body[key]) < 0)) fail(400, 'INVALID_CLIENT_EDIT', 'Valor mensal inválido.');
  }
  for (const key of stringFields) if (body[key] !== undefined && body[key] !== null && (typeof body[key] !== 'string' || body[key].length > 10000)) fail(400, 'INVALID_CLIENT_EDIT', 'Campo de texto inválido: ' + key);
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) fail(400, 'INVALID_CLIENT_EDIT', 'Nome obrigatório.');
  const data = Object.fromEntries(stringFields.filter(key => key !== 'nif').map(key => [key, clean(body[key])]));
  data.fiscalNif = clean(body.fiscalNif !== undefined ? body.fiscalNif : body.nif);
  for (const key of boolFields) data[key] = body[key] === undefined ? undefined : bool(body[key]);
  data.monthlyFee = number(body.monthlyFee); data.monthlyAmount = number(body.monthlyFee ?? body.monthlyAmount);
  const changes = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  const secrets = {}, intent = {};
  if (body.credentialIntent !== undefined && (!body.credentialIntent || typeof body.credentialIntent !== 'object' || Array.isArray(body.credentialIntent) || Object.keys(body.credentialIntent).some(key => !['password', 'pin'].includes(key)))) fail(400, 'INVALID_CLIENT_EDIT', 'Intenção de credenciais inválida.');
  for (const field of ['password', 'pin']) {
    const value = body[field];
    if (value !== undefined && value !== null && value !== '' && (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 72)) fail(400, 'INVALID_CLIENT_EDIT', 'Credencial inválida.');
    secrets[field] = typeof value === 'string' ? value.trim() : '';
    const explicit = body.credentialIntent?.[field];
    if (explicit !== undefined && typeof explicit !== 'boolean') fail(400, 'INVALID_CLIENT_EDIT', 'Intenção de credenciais inválida.');
    intent[field] = explicit === undefined ? !!secrets[field] : explicit;
    if (!intent[field] && secrets[field]) fail(400, 'INVALID_CLIENT_EDIT', 'A credencial não corresponde à intenção indicada.');
  }
  const requestId = guarded ? body.requestId.toLowerCase() : null;
  const submission = guarded ? { v: 1, clientId: id, expectedVersion: body.expectedVersion, changes, credentialIntent: intent } : null;
  if (guarded && !Object.keys(changes).length && !intent.password && !intent.pin) fail(400, 'INVALID_CLIENT_EDIT', 'Não há alterações para guardar.');
  return { changes, intent, secrets, requestId, expectedVersion: body.expectedVersion, submission, payloadHash: submission ? digest(submission) : null };
}
const proof = (actorKey, requestId, field, value) => value ? createHmac('sha256', getJwtSecret()).update(serialize({ scope: 'CLIENT_EDIT_CREDENTIAL', actorKey, requestId, field, value })).digest('hex') : null;
async function getState(rawId, user) {
  identity(user); const id = clientId(rawId);
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) fail(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.');
  return { ok: true, scope: 'CLIENT_EDIT', clientId: id, client: publicClient(client), version: version(client) };
}
async function update(rawId, body, user) {
  const actorKey = identity(user), id = clientId(rawId), request = prepare(id, body);
  return prisma.$transaction(async tx => {
    if (request.requestId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`client-edit:${actorKey}:${request.requestId}`}))::text`;
      const saved = await tx.clientEditRequest.findUnique({ where: { actorKey_requestId: { actorKey, requestId: request.requestId } } });
      if (saved) {
        if (saved.clientId !== id || saved.payloadHash !== request.payloadHash) fail(409, 'CLIENT_EDIT_REQUEST_REUSED', 'Este pedido já identifica outra alteração. Conserve o pedido original.');
        for (const field of ['password', 'pin']) if (request.secrets[field] && saved[field + 'Proof'] !== proof(actorKey, request.requestId, field, request.secrets[field])) fail(409, 'CLIENT_EDIT_REQUEST_REUSED', 'A credencial não corresponde ao pedido original.');
        return { ...saved.response, replayed: true };
      }
    }
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${id} FOR NO KEY UPDATE`;
    const current = await tx.client.findUnique({ where: { id } });
    if (!current) fail(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.');
    if (request.requestId && version(current) !== request.expectedVersion) fail(409, 'CLIENT_VERSION_CONFLICT', 'Os dados do cliente mudaram. Reveja as alterações antes de guardar.');
    const missing = ['password', 'pin'].filter(field => request.intent[field] && !request.secrets[field]);
    if (missing.length) fail(428, 'CLIENT_EDIT_CREDENTIAL_REQUIRED', 'Volte a introduzir a nova credencial para confirmar esta alteração.', missing);
    if (request.changes.billingActive === true && !(request.changes.contractActive ?? current.contractActive)) fail(400, 'INVALID_CLIENT_EDIT', 'Não é possível ativar faturação sem ativar primeiro o contrato.');
    const credentials = {};
    for (const field of ['password', 'pin']) if (request.intent[field]) credentials[field] = await bcrypt.hash(request.secrets[field], 12);
    const updated = await tx.client.update({ where: { id }, data: { ...request.changes, ...credentials } });
    const client = publicClient(updated), currentVersion = version(updated);
    const audit = await tx.userAuditLog.create({ data: { action: 'CLIENT_UPDATED', actor: actorKey, entity: 'Client', entityId: String(id),
      metadata: { before: publicClient(current), after: client, credentialsChanged: request.intent, ...(request.requestId ? { requestId: request.requestId } : {}) },
    } });
    const result = { ok: true, client, version: currentVersion, replayed: false,
      receipt: request.requestId ? { scope: 'CLIENT_EDIT', actorKey, requestId: request.requestId, clientId: id,
        expectedVersion: request.expectedVersion, version: currentVersion, payloadHash: request.payloadHash,
        auditId: audit.id, credentialsChanged: request.intent } : null };
    if (request.requestId) await tx.clientEditRequest.create({ data: { actorKey, requestId: request.requestId, clientId: id, payloadHash: request.payloadHash,
      passwordProof: proof(actorKey, request.requestId, 'password', request.secrets.password), pinProof: proof(actorKey, request.requestId, 'pin', request.secrets.pin), response: result,
    } });
    return result;
  }, { maxWait: 15000, timeout: 20000 });
}
module.exports = { getState, update };
