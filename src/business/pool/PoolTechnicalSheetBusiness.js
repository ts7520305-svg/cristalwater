'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { createHash, createHmac } = require('node:crypto');
const { getJwtSecret } = require('../../utils/jwtSecret');
const EventBus = require('../../core/event/EventBus');
const BrainKnowledge = require('../../system/knowledge/BrainKnowledge');

const include = { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true };
function fail(message, statusCode = 400, publicCode = 'INVALID_TECHNICAL_SHEET_EDIT') { throw Object.assign(new Error(message), { statusCode, publicCode }); }
function identity(user) {
  const id = Number(user?.userId || user?.id);
  if (normalizeRole(user?.role) !== 'ADMIN' || !Number.isSafeInteger(id) || id <= 0) fail('Só a administração pode alterar a ficha técnica.', 403);
  return user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN:' + createHash('sha256').update(String(user.email || '').trim().toLowerCase()).digest('hex') : 'USER:' + id;
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
  const n = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isSafeInteger(n))) fail('Valor numérico inválido.');
  return n;
}
function boolean(value) {
  if (value === undefined) return undefined;
  if ([true, 'true', 1, '1'].includes(value)) return true;
  if ([false, 'false', 0, '0'].includes(value)) return false;
  fail('Valor lógico inválido.');
}
const defined = data => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
function patches(body) {
  const pool = {};
  for (const key of ['name', 'type', 'zone', 'location', 'address', 'notes', 'scheduleMode']) pool[key] = text(body[key], ['name', 'type', 'scheduleMode'].includes(key));
  pool.monthlyAmount = number(body.monthlyAmount);
  for (const key of ['serviceFrequency', 'estimatedMinutes']) pool[key] = number(body[key], { min: 1, max: 2147483647, integer: true });
  pool.active = boolean(body.active);
  if (body.archiveStatus !== undefined) { if (!['ATIVO', 'PAUSA', 'ARQUIVADO'].includes(body.archiveStatus)) fail('Estado de arquivo inválido.'); pool.archiveStatus = body.archiveStatus; }
  if (body.deletedAt !== undefined) { if (body.deletedAt !== null && (typeof body.deletedAt !== 'string' || !Number.isFinite(Date.parse(body.deletedAt)))) fail('Data de arquivo inválida.'); pool.deletedAt = body.deletedAt === null ? null : new Date(body.deletedAt); }
  const equipment = {};
  for (const key of ['pumpType', 'pumpPower', 'filterType', 'filterMedia', 'lightsType']) equipment[key] = text(body[key]);
  Object.assign(equipment, { saltSystem: boolean(body.saltSystem), hasLights: boolean(body.hasLights), lightsCount: number(body.lightsCount, { nullable: true, max: 2147483647, integer: true }), notes: text(body.equipmentNotes) });
  const room = {};
  for (const [key, field] of Object.entries({ condition: 'technicalRoomCondition', locationNote: 'technicalRoomLocation', ventilation: 'technicalRoomVentilation', electrical: 'technicalRoomElectrical', notes: 'technicalRoomNotes' })) room[key] = text(body[field]);
  const calculation = { shape: text(body.shape, true), notes: text(body.calculationNotes) };
  for (const key of ['lengthM', 'widthM', 'diameterM', 'depthMinM', 'depthMaxM', 'averageDepthM', 'shapeFactor', 'pumpFlowM3h', 'targetSalinityPpm', 'targetChlorinePpm', 'currentWaterTempC']) calculation[key] = number(body[key], { nullable: true, min: key === 'currentWaterTempC' ? -Number.MAX_SAFE_INTEGER : 0 });
  const sheet = { disinfectionType: text(body.disinfectionType, true) };
  if (body.volumeM3 !== undefined) { const volume = number(body.volumeM3, { nullable: true }); pool.volumeM3 = volume; calculation.volumeM3 = volume; sheet.volumeM3 = volume ?? 0; }
  return { pool: defined(pool), equipment: defined(equipment), room: defined(room), calculation: defined(calculation), sheet: defined(sheet), note: text(body.historyNote) };
}
function deriveVolume(before, data, body) {
  const dimensions = ['lengthM', 'widthM', 'diameterM', 'depthMinM', 'depthMaxM', 'averageDepthM', 'shapeFactor', 'shape'];
  if (!dimensions.some(key => Object.hasOwn(body, key))) return;
  const calculation = { ...(before.calculationProfile || {}), ...data.calculation };
  if (calculation.depthMinM != null && calculation.depthMaxM != null && calculation.depthMinM > calculation.depthMaxM) fail('A profundidade mínima não pode exceder a máxima.');
  let depth = calculation.averageDepthM;
  if ((!depth || (!Object.hasOwn(body, 'averageDepthM') && ['depthMinM', 'depthMaxM'].some(key => Object.hasOwn(body, key)))) && calculation.depthMinM > 0 && calculation.depthMaxM > 0) {
    depth = (calculation.depthMinM + calculation.depthMaxM) / 2; data.calculation.averageDepthM = depth;
  }
  const factor = calculation.shapeFactor ?? 1, circle = /^(CIRCULAR|CIRCLE|ROUND)$/i.test(calculation.shape || '');
  let volume;
  if (depth > 0 && factor > 0) {
    if (circle && calculation.diameterM > 0) volume = Math.PI * (calculation.diameterM / 2) ** 2 * depth * factor;
    else if (calculation.lengthM > 0 && calculation.widthM > 0) volume = calculation.lengthM * calculation.widthM * depth * factor;
    else if (calculation.diameterM > 0) volume = Math.PI * (calculation.diameterM / 2) ** 2 * depth * factor;
  }
  if (volume !== undefined) {
    if (!Number.isFinite(volume) || volume > Number.MAX_SAFE_INTEGER) fail('Volume calculado inválido.');
    volume = Math.round(volume * 10) / 10;
    data.pool.volumeM3 = data.sheet.volumeM3 = data.calculation.volumeM3 = volume;
  }
}
const changedFields = (before, after) => Object.keys(after).filter(key => !['createdAt', 'updatedAt'].includes(key) && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));


const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const versionPattern = /^technical-sheet-v1:[0-9a-f]{64}$/;
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
}
const serialized = value => JSON.stringify(canonical(value));
const version = pool => 'technical-sheet-v1:' + createHmac('sha256', getJwtSecret()).update('TECHNICAL_SHEET_EDIT_V1\0' + serialized(pool)).digest('hex');
const groups = {
  pool: { name: 'name', type: 'type', zone: 'zone', address: 'address', monthlyAmount: 'monthlyAmount', notes: 'notes' },
  calculation: Object.fromEntries(['lengthM', 'widthM', 'depthMinM', 'depthMaxM', 'averageDepthM', 'pumpFlowM3h', 'targetSalinityPpm', 'targetChlorinePpm', 'currentWaterTempC'].map(key => [key, key])),
  equipment: { pumpType: 'pumpType', pumpPower: 'pumpPower', filterType: 'filterType', filterMedia: 'filterMedia', saltSystem: 'saltSystem', lightsCount: 'lightsCount', lightsType: 'lightsType', equipmentNotes: 'notes' },
  room: { technicalRoomLocation: 'locationNote', technicalRoomCondition: 'condition', technicalRoomVentilation: 'ventilation', technicalRoomElectrical: 'electrical', technicalRoomNotes: 'notes' },
};
const editable = [...Object.values(groups).flatMap(group => Object.keys(group)), 'historyNote'];
function publicPool(pool) {
  // Missing components use their creation defaults; no credentials, keys or historical entries enter browser recovery storage.
  const calculation = pool.calculationProfile || { shape: 'RECTANGULAR', shapeFactor: 1, targetSalinityPpm: 3500, targetChlorinePpm: 2 };
  const components = { pool, calculation, equipment: pool.equipment || { saltSystem: false }, room: pool.technicalRoom || {} };
  const result = { id: pool.id, clientId: pool.clientId, historyNote: null, volumeM3: pool.volumeM3,
    calculatedVolumeM3: calculation.volumeM3 ?? null, treatmentVolumeM3: pool.technicalSheet?.volumeM3 ?? 0,
    shape: calculation.shape, diameterM: calculation.diameterM ?? null, shapeFactor: calculation.shapeFactor };
  for (const [group, fields] of Object.entries(groups)) for (const [field, column] of Object.entries(fields)) result[field] = components[group][column] ?? null;
  return result;
}
function poolIdentifier(raw) { const id = Number(raw); if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail('Identificador de piscina inválido.'); return id; }
async function getState(rawId, user) {
  identity(user); const poolId = poolIdentifier(rawId);
  return prisma.$transaction(async tx => {
    const pool = await tx.pool.findUnique({ where: { id: poolId }, include });
    if (!pool) fail('Piscina não encontrada.', 404);
    return { ok: true, scope: 'TECHNICAL_SHEET_EDIT', poolId, version: version(pool), pool: publicPool(pool) };
  }, { isolationLevel: 'RepeatableRead' });
}

async function update(rawId, body, user) {
  const actor = identity(user), poolId = poolIdentifier(rawId);
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Dados da ficha técnica inválidos.');
  const guarded = body.requestId !== undefined || body.expectedVersion !== undefined;
  if (guarded && (typeof body.requestId !== 'string' || typeof body.expectedVersion !== 'string' || !uuid.test(body.requestId) || !versionPattern.test(body.expectedVersion) || Object.keys(body).some(key => ![...editable, 'requestId', 'expectedVersion'].includes(key)))) fail('Conserve o pedido original e a versão da ficha técnica.');
  const data = patches(body), intent = {};
  for (const [group, fields] of Object.entries(groups)) for (const [field, column] of Object.entries(fields)) if (Object.hasOwn(body, field)) intent[field] = data[group][column];
  if (Object.hasOwn(body, 'historyNote')) intent.historyNote = data.note;
  const requestId = guarded ? body.requestId.toLowerCase() : null;
  const payloadHash = guarded ? createHash('sha256').update(serialized({ v: 1, poolId, expectedVersion: body.expectedVersion, changes: intent })).digest('hex') : null;
  if (!data.note && !['pool', 'equipment', 'room', 'calculation', 'sheet'].some(key => Object.keys(data[key]).length)) fail('Não há alterações para guardar.');
  const committed = await prisma.$transaction(async tx => {
    if (requestId) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`technical-sheet-edit:${actor}:${requestId}`}))::text`;
      const saved = await tx.technicalSheetEditRequest.findUnique({ where: { actorKey_requestId: { actorKey: actor, requestId } } });
      if (saved) {
        if (saved.poolId !== poolId || saved.payloadHash !== payloadHash) fail('Este pedido já identifica outra alteração. Conserve o pedido original.', 409, 'TECHNICAL_SHEET_REQUEST_REUSED');
        return { response: { ...saved.response, replayed: true } };
      }
    }
    // Use the same lock order as the general pool editor; read only after locking.
    await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${poolId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "TechnicalSheet" WHERE "poolId" = ${poolId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "PoolEquipment" WHERE "poolId" = ${poolId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "TechnicalRoom" WHERE "poolId" = ${poolId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "PoolCalculationProfile" WHERE "poolId" = ${poolId} FOR UPDATE`;
    const before = await tx.pool.findUnique({ where: { id: poolId }, include });
    if (!before) fail('Piscina não encontrada.', 404);
    if (guarded && version(before) !== body.expectedVersion) fail('Os dados mudaram. Reveja as alterações antes de guardar.', 409, 'TECHNICAL_SHEET_VERSION_CONFLICT');
    deriveVolume(before, data, body);
    if (guarded || data.note || Object.keys(data.pool).length) await tx.pool.update({ where: { id: poolId }, data: { ...data.pool, updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) } });
    for (const [model, fields] of [['technicalSheet', data.sheet], ['poolEquipment', data.equipment], ['technicalRoom', data.room], ['poolCalculationProfile', data.calculation]]) {
      if (Object.keys(fields).length) await tx[model].upsert({ where: { poolId }, update: fields, create: { poolId, ...fields } });
    }
    const pool = await tx.pool.findUnique({ where: { id: poolId }, include }), changes = changedFields(before, pool), changedAt = new Date();
    const history = await tx.technicalHistory.create({ data: { poolId, type: 'TECHNICAL_SHEET_CHANGE', component: 'Ficha Técnica', message: 'Alteração imutável da ficha técnica',
      description: JSON.stringify({ actor, changedAt: changedAt.toISOString(), before, after: pool, ...(requestId ? { requestId } : {}) }), performedAt: changedAt, status: 'DONE' } });
    const note = data.note ? await tx.technicalHistory.create({ data: { poolId, type: 'TECHNICAL_SHEET_NOTE', component: 'Ficha Técnica', message: 'Nota da ficha técnica', description: data.note, performedAt: changedAt, status: 'DONE' } }) : null;
    const source = 'TECHNICAL_SHEET_DIRECT_UPDATE', summary = `Ficha técnica atualizada com ${changes.length} alteração(ões).`;
    const event = { poolId, actor, source, proposalId: null, summary, metadata: { changes, changesCount: changes.length, historyId: history.id }, propagatedAt: changedAt.toISOString() };
    const propagation = await tx.technicalHistory.create({ data: { poolId, type: 'TECHNICAL_SHEET_PROPAGATION_EVENT', component: 'Ficha Técnica Propagação', message: `Propagação técnica: ${source}`, description: JSON.stringify(event), performedAt: changedAt, status: 'DONE' } });
    const notification = await tx.notification.create({ data: { type: 'TECHNICAL_SHEET_PROPAGATION', eventType: 'TECHNICAL_SHEET_UPDATED', title: 'Ficha técnica atualizada', message: summary,
      role: 'ADMIN', status: 'PENDING', severity: 'MEDIUM', metadata: { poolId, source, proposalId: null, actor, ...event.metadata } } });
    const currentVersion = version(pool);
    const response = JSON.parse(JSON.stringify({ ok: true, pool: guarded ? publicPool(pool) : pool, historyId: history.id, noteHistoryId: note?.id || null,
      propagation: { persisted: true, historyId: propagation.id, notificationId: notification.id },
      ...(guarded ? { version: currentVersion, replayed: false, receipt: { scope: 'TECHNICAL_SHEET_EDIT', actorKey: actor, requestId, poolId, expectedVersion: body.expectedVersion,
        version: currentVersion, payloadHash, historyId: history.id, noteHistoryId: note?.id || null, propagationHistoryId: propagation.id, notificationId: notification.id } } : {}) }));
    if (requestId) await tx.technicalSheetEditRequest.create({ data: { actorKey: actor, requestId, poolId, payloadHash, response } });
    return { response, event };
  }, { maxWait: 15000, timeout: 15000 });
  if (!committed.event) return committed.response;
  // Optional process-local projections run only after the durable transaction commits.
  let livePublished = false;
  try {
    BrainKnowledge.addNote(`Ficha técnica atualizada #${poolId}`, `${committed.event.summary} | origem=${committed.event.source}`, ['technical-sheet', 'propagation', 'technical_sheet_direct_update']);
    const result = await EventBus.emit('TECHNICAL_SHEET_UPDATED', committed.event, { actor, source: committed.event.source }); livePublished = result?.ok === true;
  } catch { /* Durable history/notification remain available even if a live projection fails. */ }
  if (!guarded) committed.response.propagation.livePublished = livePublished;
  return committed.response;
}
module.exports = { update, getState };
