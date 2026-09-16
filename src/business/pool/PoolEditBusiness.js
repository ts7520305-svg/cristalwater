'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { createHash, createHmac } = require('node:crypto');
const { getJwtSecret } = require('../../utils/jwtSecret');

function fail(message, statusCode = 400, publicCode = 'INVALID_POOL_EDIT') { throw Object.assign(new Error(message), { statusCode, publicCode }); }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const versionPattern = /^pool-v1:[0-9a-f]{64}$/;
const clientVersionPattern = /^pool-client-v1:[0-9a-f]{64}$/;
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
const serialized = value => JSON.stringify(canonical(value));
const signature = value => createHash('sha256').update(serialized(value)).digest('hex');
const version = pool => 'pool-v1:' + createHmac('sha256', getJwtSecret()).update('POOL_EDIT_STATE_V1\0' + serialized(pool)).digest('hex');
const clientVersion = client => 'pool-client-v1:' + createHmac('sha256', getJwtSecret()).update('POOL_EDIT_RECIPIENT_V1\0' + serialized(Object.fromEntries(['id', 'name', 'active', 'archiveStatus', 'deletedAt', 'status', 'updatedAt'].map(key => [key, client[key]])))).digest('hex');
function identity(user) {
  const role = normalizeRole(user?.role), actorId = Number(user?.userId || user?.id);
  if (role !== 'ADMIN' || !Number.isSafeInteger(actorId) || actorId <= 0) fail('Só a administração pode editar piscinas.', 403, 'POOL_EDIT_FORBIDDEN');
  return user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN:' + createHash('sha256').update(String(user.email || '').trim().toLowerCase()).digest('hex') : 'USER:' + actorId;
}
function id(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0 || result > 2147483647) fail('Identificador inválido.');
  return result;
}
function text(value, required = false) {
  if (value === undefined) return undefined;
  if (value === null && !required) return null;
  if (typeof value !== 'string' || value.length > 10000 || (required && !value.trim())) fail('Campo de texto inválido.');
  return value.trim() || null;
}
function number(value, { nullable = false, min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === '') { if (nullable) return null; fail('Valor numérico obrigatório.'); }
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) fail('Valor numérico inválido.');
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) fail('Valor numérico inválido.');
  return result;
}
function bool(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (['true', '1', 'yes', 'sim', 'on'].includes(String(value).toLowerCase())) return true;
  if (['false', '0', 'no', 'nao', 'não', 'off'].includes(String(value).toLowerCase())) return false;
  fail('Valor lógico inválido.');
}
const defined = data => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
function payload(body) {
  const data = defined({
    name: text(body.name, true), location: text(body.location), address: text(body.address), zone: text(body.zone),
    type: text(body.type), notes: text(body.notes), preferredDays: text(body.preferredDays),
    scheduleMode: text(body.scheduleMode, true), active: bool(body.active), hasLights: bool(body.hasLights),
    zoneId: body.zoneId === undefined ? undefined : body.zoneId === null || body.zoneId === '' ? null : id(body.zoneId),
    volumeM3: number(body.volumeM3, { nullable: true }), latitude: number(body.latitude, { nullable: true, min: -90, max: 90 }),
    longitude: number(body.longitude, { nullable: true, min: -180, max: 180 }), monthlyAmount: number(body.monthlyAmount),
    priority: number(body.priority, { integer: true, max: 2147483647 }),
    serviceFrequency: number(body.serviceFrequency, { integer: true, min: 1, max: 2147483647 }),
    estimatedMinutes: number(body.estimatedMinutes, { integer: true, min: 1, max: 2147483647 }),
  });
  if (body.archiveStatus !== undefined) {
    if (!['ATIVO', 'PAUSA', 'ARQUIVADO'].includes(body.archiveStatus)) fail('Estado de arquivo inválido.');
    data.archiveStatus = body.archiveStatus;
  }
  if (body.deletedAt !== undefined) {
    if (body.deletedAt !== null && (typeof body.deletedAt !== 'string' || !Number.isFinite(Date.parse(body.deletedAt)))) fail('Data de arquivo inválida.');
    data.deletedAt = body.deletedAt === null ? null : new Date(body.deletedAt);
  }
  return data;
}
function sheetPayload(body) {
  if (body.technicalSheet !== undefined && (!body.technicalSheet || typeof body.technicalSheet !== 'object' || Array.isArray(body.technicalSheet))) fail('Ficha técnica inválida.');
  const source = body.technicalSheet || body;
  // A pool/jacuzzi type and general notes are not treatment settings.
  const data = defined({
    volumeM3: number(!body.technicalSheet && (source.volumeM3 === null || source.volumeM3 === '') ? undefined : source.volumeM3),
    disinfectionType: text(source.disinfectionType, true),
    targetPhMin: number(source.targetPhMin, { max: 14 }), targetPhMax: number(source.targetPhMax, { max: 14 }),
    targetChlorineMin: number(source.targetChlorineMin), targetChlorineMax: number(source.targetChlorineMax),
    targetAlkalinityMin: number(source.targetAlkalinityMin), targetAlkalinityMax: number(source.targetAlkalinityMax),
    targetOrpMinMv: number(source.targetOrpMinMv, { nullable: true }),
    filterBrandModel: text(source.filterBrandModel), pumpHorsePower: number(source.pumpHorsePower, { nullable: true }),
    chlorinatorModel: text(source.chlorinatorModel), technicalRoomLocation: text(source.technicalRoomLocation),
    specialObservations: text(source.specialObservations),
  });
  return data;
}
const snapshotInclude = { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true };
const poolFields = ['name', 'location', 'address', 'zone', 'type', 'notes', 'preferredDays', 'scheduleMode', 'active', 'hasLights', 'zoneId', 'volumeM3', 'latitude', 'longitude', 'monthlyAmount', 'priority', 'serviceFrequency', 'estimatedMinutes', 'archiveStatus', 'deletedAt'];
const sheetFields = ['volumeM3', 'disinfectionType', 'targetPhMin', 'targetPhMax', 'targetChlorineMin', 'targetChlorineMax', 'targetAlkalinityMin', 'targetAlkalinityMax', 'targetOrpMinMv', 'filterBrandModel', 'pumpHorsePower', 'chlorinatorModel', 'technicalRoomLocation', 'specialObservations'];

async function getState(rawId, user) {
  identity(user); const poolId = id(rawId);
  const pool = await prisma.pool.findUnique({ where: { id: poolId }, include: snapshotInclude });
  if (!pool) fail('Piscina não encontrada.', 404, 'POOL_NOT_FOUND');
  const clients = await prisma.client.findMany({ where: { OR: [{ id: pool.clientId }, { active: true, archiveStatus: { not: 'ARQUIVADO' }, deletedAt: null, status: { not: 'ARCHIVED' } }] },
    select: { id: true, name: true, active: true, archiveStatus: true, deletedAt: true, status: true, updatedAt: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  return { ok: true, scope: 'POOL_EDIT', poolId, version: version(pool), pool, clients: clients.map(client => ({ id: client.id, name: client.name, version: clientVersion(client),
    selectable: client.active && client.archiveStatus !== 'ARQUIVADO' && !client.deletedAt && client.status !== 'ARCHIVED' })) };
}

async function update(rawId, body, user) {
  const actor = identity(user);
  const poolId = id(rawId);
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Dados de edição inválidos.');
  const guarded = body.requestId !== undefined || body.expectedVersion !== undefined || body.expectedClientVersion !== undefined;
  if (guarded) {
    if (typeof body.requestId !== 'string' || !uuid.test(body.requestId) || typeof body.expectedVersion !== 'string' || !versionPattern.test(body.expectedVersion)) fail('Conserve o identificador e a versão da edição.');
    const allowed = new Set([...poolFields, ...sheetFields, 'clientId', 'technicalSheet', 'requestId', 'expectedVersion', 'expectedClientVersion']);
    if (Object.keys(body).some(key => !allowed.has(key))) fail('Campo de edição desconhecido.');
    if (body.technicalSheet && Object.keys(body.technicalSheet).some(key => !sheetFields.includes(key))) fail('Campo técnico desconhecido.');
    for (const key of ['active', 'hasLights']) if (body[key] !== undefined && typeof body[key] !== 'boolean') fail('Campo lógico inválido.');
  }
  const data = payload(body), sheetData = sheetPayload(body);
  const nextClientId = body.clientId === undefined ? undefined : id(body.clientId);
  if (guarded && (nextClientId !== undefined ? typeof body.expectedClientVersion !== 'string' || !clientVersionPattern.test(body.expectedClientVersion) : body.expectedClientVersion != null)) fail('Conserve a versão do cliente selecionado.');
  const changes = { ...data, ...(nextClientId !== undefined ? { clientId: nextClientId } : {}), ...(Object.keys(sheetData).length ? { technicalSheet: sheetData } : {}) };
  const requestId = guarded ? body.requestId.toLowerCase() : null;
  if (guarded && !Object.keys(changes).length) fail('Não há alterações para guardar.');
  const payloadHash = guarded ? signature({ v: 1, poolId, expectedVersion: body.expectedVersion, expectedClientVersion: body.expectedClientVersion || null, changes }) : null;
  return prisma.$transaction(async tx => {
    if (requestId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`pool-edit:${actor}:${requestId}`}))::text`;
      const saved = await tx.poolEditRequest.findUnique({ where: { actorKey_requestId: { actorKey: actor, requestId } } });
      if (saved) {
        if (saved.poolId !== poolId || saved.payloadHash !== payloadHash) fail('Este pedido já identifica outra alteração. Conserve o pedido original.', 409, 'POOL_EDIT_REQUEST_REUSED');
        return { ...saved.response, replayed: true };
      }
    }
    if (nextClientId !== undefined) {
      // Keep the recipient's active state stable through reassignment.
      await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${nextClientId} FOR NO KEY UPDATE`;
      const client = await tx.client.findUnique({ where: { id: nextClientId } });
      if (guarded && (!client || clientVersion(client) !== body.expectedClientVersion)) fail('O cliente selecionado mudou. Reveja a associação antes de guardar.', 409, 'POOL_EDIT_RECIPIENT_CHANGED');
      if (!client || !client.active || client.archiveStatus === 'ARQUIVADO' || client.deletedAt || client.status === 'ARCHIVED') fail('Cliente inexistente, inativo ou arquivado.', guarded ? 409 : 400, 'POOL_EDIT_RECIPIENT_CHANGED');
    }
    // Also exclude new related records until the versioned edit commits.
    await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${poolId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "TechnicalSheet" WHERE "poolId" = ${poolId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "PoolEquipment" WHERE "poolId" = ${poolId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "TechnicalRoom" WHERE "poolId" = ${poolId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "PoolCalculationProfile" WHERE "poolId" = ${poolId} FOR UPDATE`;
    const before = await tx.pool.findUnique({ where: { id: poolId }, include: snapshotInclude });
    if (!before) fail('Piscina não encontrada.', 404, 'POOL_NOT_FOUND');
    if (guarded && version(before) !== body.expectedVersion) fail('Os dados da piscina mudaram. Reveja as alterações antes de guardar.', 409, 'POOL_VERSION_CONFLICT');
    const mergedSheet = { ...(before.technicalSheet || { targetPhMin: 7.2, targetPhMax: 7.6, targetChlorineMin: 1, targetChlorineMax: 3, targetAlkalinityMin: 80, targetAlkalinityMax: 120 }), ...sheetData };
    for (const [low, high] of [['targetPhMin', 'targetPhMax'], ['targetChlorineMin', 'targetChlorineMax'], ['targetAlkalinityMin', 'targetAlkalinityMax']]) {
      if ((sheetData[low] !== undefined || sheetData[high] !== undefined) && mergedSheet[low] > mergedSheet[high]) fail('O limite mínimo não pode exceder o máximo.');
    }
    const reassigned = nextClientId !== undefined && nextClientId !== before.clientId;
    const pool = await tx.pool.update({ where: { id: poolId }, data: { ...data, ...(reassigned ? { clientId: nextClientId } : {}) } });
    let technicalSheet = before.technicalSheet;
    if (!technicalSheet || Object.keys(sheetData).length) {
      technicalSheet = await tx.technicalSheet.upsert({ where: { poolId }, update: sheetData,
        create: { poolId, volumeM3: pool.volumeM3 || 0, disinfectionType: 'CLORO', ...sheetData } });
    }
    let reassignedVisits = 0;
    if (reassigned) {
      // Started, completed, cancelled and billed work retains its original client.
      const changed = await tx.serviceVisit.updateMany({ where: { poolId, startAt: null, endAt: null, completionRequestId: null, billed: false, billedAt: null,
        status: { in: ['PLANNED', 'PENDING', 'SCHEDULED'] } }, data: { clientId: nextClientId } });
      reassignedVisits = changed.count;
    }
    const after = await tx.pool.findUnique({ where: { id: poolId }, include: snapshotInclude });
    const history = await tx.technicalHistory.create({ data: { poolId, type: 'TECHNICAL_SHEET_CHANGE', component: 'Ficha Técnica',
      message: 'Alteração imutável da ficha técnica', status: 'DONE', performedAt: new Date(),
      description: JSON.stringify({ actor, before, after, reassignedVisits, changedAt: new Date().toISOString(), ...(requestId ? { requestId } : {}) }),
    } });
    // Keep the core alias's relation fields without returning client credentials.
    const result = await tx.pool.findUnique({ where: { id: poolId }, include: { client: true, roundPools: { include: { round: true } }, technicalSheet: true } });
    if (result.client) { delete result.client.password; delete result.client.pin; }
    const currentVersion = version(after);
    const response = JSON.parse(JSON.stringify({ pool: result, technicalSheet, reassignedVisits, version: currentVersion, replayed: false,
      receipt: requestId ? { scope: 'POOL_EDIT', actorKey: actor, requestId, poolId, expectedVersion: body.expectedVersion, expectedClientVersion: body.expectedClientVersion || null, version: currentVersion, payloadHash,
        historyId: history.id, previousClientId: before.clientId, clientId: after.clientId, reassignedVisits } : null }));
    if (requestId) await tx.poolEditRequest.create({ data: { actorKey: actor, requestId, poolId, payloadHash, response } });
    return response;
  }, { maxWait: 15000, timeout: 15000 });
}
module.exports = { getState, update };
