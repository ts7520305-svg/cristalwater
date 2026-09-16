'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { createHash, randomUUID } = require('node:crypto');
const EventBus = require('../../core/event/EventBus');
const BrainKnowledge = require('../../system/knowledge/BrainKnowledge');
const C = require('./TechnicalProposalContract');
const include = { technicalSheet: true, equipment: true, technicalRoom: true, calculationProfile: true };
const fields = new Set(['notes', 'historyNote', 'equipmentNotes', 'technicalRoomNotes', 'pumpType', 'pumpPower', 'filterType', 'filterMedia', 'lightsType', 'lightsCount', 'saltSystem', 'hasLights', 'volumeM3', 'lengthM', 'widthM', 'diameterM', 'depthMinM', 'depthMaxM', 'averageDepthM', 'shape', 'shapeFactor', 'targetSalinityPpm', 'targetChlorinePpm', 'pumpFlowM3h', 'currentWaterTempC', 'type', 'disinfectionType', 'technicalRoomCondition', 'technicalRoomLocation', 'technicalRoomVentilation', 'technicalRoomElectrical', 'calculationNotes']);
function fail(message, statusCode = 400, publicCode = 'INVALID_TECHNICAL_PROPOSAL') { throw Object.assign(new Error(message), { statusCode, publicCode }); }
function identifier(value) { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0 || n > 2147483647 || !['number', 'string'].includes(typeof value)) fail('Identificador inválido.'); return n; }
function text(value, required = false, max = 10000) { if (value == null && !required) return ''; if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('Texto obrigatório ou inválido.'); return value.trim(); }
function identity(user) {
  const role = normalizeRole(user?.role), admin = role === 'ADMIN';
  if (!['ADMIN', 'TECHNICIAN', 'TEAM_LEADER'].includes(role)) fail('Sem permissão para propostas técnicas.', 403);
  const id = identifier(user?.userId || user?.id), technicianId = admin ? null : identifier(user?.technicianId || user?.id);
  const key = user.principalType === 'ENV_ADMIN' ? 'ENV_ADMIN:' + createHash('sha256').update(String(user.email || '').trim().toLowerCase()).digest('hex') : (admin || user.principalType === 'USER' ? 'USER:' : 'TECHNICIAN:') + id;
  return { key, role, admin, technicianId, name: user.name || key };
}
async function poolScope(tx, poolId, actor) {
  const pool = await tx.pool.findUnique({ where: { id: poolId }, include });
  if (!pool) fail('Piscina não encontrada.', 404);
  if (!actor.admin && pool.createdByTechnicianId !== actor.technicianId && !await tx.serviceVisit.findFirst({ where: { poolId, technicianId: actor.technicianId, status: { notIn: ['CANCELLED', 'CANCELED'] } }, select: { id: true } })) fail('Sem acesso às propostas desta piscina.', 403);
  return pool;
}
function visible(row, actor) {
  if (actor.admin) return true;
  const payload = C.parseProposalDescription(row.description);
  return payload?.creatorTechnicianId === actor.technicianId && !!payload.creatorKey && payload.changes.every(change => fields.has(change.field));
}
async function proposalRow(tx, poolId, proposalId, actor) {
  const row = await tx.technicalHistory.findFirst({ where: { id: proposalId, poolId, type: C.TECHNICAL_PROPOSAL_TYPE } });
  if (!row || !visible(row, actor)) fail('Proposta técnica não encontrada.', 404);
  return row;
}
async function readAll(tx, where) {
  const rows = []; let after = 0;
  for (;;) {
    const page = await tx.technicalHistory.findMany({ where: { ...where, id: { gt: after } }, orderBy: { id: 'asc' }, take: 500 });
    rows.push(...page); if (page.length < 500) return rows; after = page.at(-1).id;
  }
}
async function events(tx, poolId, proposalId) {
  const rows = await readAll(tx, { poolId, type: C.TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE });
  return rows.filter(row => C.parseWorkflowEventDescription(row.description)?.proposalId === proposalId);
}
async function appendEvent(tx, { poolId, proposalId, fromState, toState, actor, note, batchId = '', previousHash = '' }) {
  const payload = { proposalId, fromState, toState, actor: actor.name, actorRole: actor.role, actorKey: actor.key, eventVersion: 2, note, batchId, transitionedAt: new Date().toISOString(), previousHash };
  await tx.technicalHistory.create({ data: { poolId, type: C.TECHNICAL_PROPOSAL_WORKFLOW_EVENT_TYPE, component: 'Ficha Técnica Workflow', message: `Proposta #${proposalId}: ${fromState || 'INIT'} -> ${toState}`, description: JSON.stringify({ ...payload, eventHash: C.buildWorkflowEventHash(payload, previousHash) }), performedAt: new Date(), status: toState } });
}
async function persistPropagation(tx, payload) {
  await tx.technicalHistory.create({ data: { poolId: payload.poolId, type: C.TECHNICAL_SHEET_PROPAGATION_EVENT_TYPE, component: 'Ficha Técnica Propagação', message: `Propagação técnica: ${payload.source}`, description: JSON.stringify(payload), performedAt: new Date(), status: 'DONE' } });
  await tx.notification.create({ data: { type: 'TECHNICAL_SHEET_PROPAGATION', eventType: 'TECHNICAL_SHEET_UPDATED', title: 'Proposta técnica atualizada', message: payload.summary, role: 'ADMIN', status: 'PENDING', severity: 'MEDIUM', metadata: { poolId: payload.poolId, source: payload.source, proposalId: payload.proposalId, actor: payload.actor, ...payload.metadata } } });
}
async function project(payload) {
  // Optional in-memory projections only run after every durable write commits.
  try { BrainKnowledge.addNote(`Proposta técnica da piscina #${payload.poolId}`, `${payload.summary} | origem=${payload.source} | proposta=${payload.proposalId}`, ['technical-sheet', 'propagation', payload.source.toLowerCase()]); } catch (_) {}
  await EventBus.emit('TECHNICAL_SHEET_UPDATED', payload, { actor: payload.actor, source: payload.source }).catch(() => null);
}
function creationInput(body, actor, pool) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Pedido de proposta inválido.');
  const reason = text(body.reason, true), normalized = C.normalizeProposalChanges(body.changes);
  const raw = Array.isArray(body.changes) ? body.changes : (body.changes && typeof body.changes === 'object' ? Object.entries(body.changes).map(([field, after]) => ({ field, after })) : []);
  if (!raw.length || raw.length > 50 || normalized.length !== raw.length || new Set(normalized.map(c => c.field)).size !== raw.length) fail('Indique de uma a cinquenta alterações distintas.');
  for (const item of raw) {
    if (!item || typeof item.field !== 'string' || (!fields.has(item.field.trim()) && !(actor.admin && item.field.trim() === 'monthlyAmount'))) fail('Campo não permitido nesta proposta.');
    for (const value of [item.before, item.after]) if (value != null && (!['string', 'number', 'boolean'].includes(typeof value) || String(value).length > 10000 || (typeof value === 'number' && !Number.isFinite(value)))) fail('Valor de alteração inválido.');
  }
  const changes = normalized.map(change => ({ ...change, before: change.before == null || change.before === '' ? (C.readPoolFieldValue(pool, change.field) == null ? null : String(C.readPoolFieldValue(pool, change.field))) : change.before }));
  if (changes.some(change => change.before === change.after)) fail('A proposta contém uma alteração sem diferença.');
  const explicit = C.normalizeRiskLevel(body.riskLevel); if (body.riskLevel && !explicit) fail('Nível de risco inválido.');
  const inferred = C.inferProposalRiskLevel(changes), ranks = ['LOW', 'MEDIUM', 'HIGH'];
  const riskLevel = ranks[Math.max(ranks.indexOf(inferred), ranks.indexOf(explicit))];
  const photos = body.photos ?? []; if (!Array.isArray(photos) || photos.length > 12 || photos.some(photo => typeof photo !== 'string' || photo.length > 2048 || !C.safePhoto(photo.trim()))) fail('Indique até doze ligações HTTP(S) ou ficheiros carregados para as fotos.');
  if (body.asDraft !== undefined && ![true, false, 'true', 'false', 0, 1, '0', '1'].includes(body.asDraft)) fail('Estado de rascunho inválido.');
  const state = [true, 'true', 1, '1'].includes(body.asDraft) ? 'DRAFT' : 'SUBMITTED';
  return { reason, changes, photos: photos.map(photo => photo.trim()), riskLevel, state };
}
async function create(rawPoolId, body = {}, user) {
  const actor = identity(user), poolId = identifier(rawPoolId);
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${poolId} FOR UPDATE`;
    const pool = await poolScope(tx, poolId, actor), input = creationInput(body, actor, pool), now = new Date().toISOString();
    const payload = { proposalId: randomUUID(), reason: input.reason, changes: input.changes, photos: input.photos, riskLevel: input.riskLevel, baselineCaptured: true, actor: actor.name, actorRole: actor.role, creatorKey: actor.key, creatorTechnicianId: actor.technicianId, submittedAt: now, status: input.state, lifecycle: input.state, transitions: [{ from: '', to: input.state, at: now, by: actor.name, actorKey: actor.key, note: 'Proposta criada' }] };
    const row = await tx.technicalHistory.create({ data: { poolId, type: C.TECHNICAL_PROPOSAL_TYPE, component: 'Ficha Técnica', message: input.reason, description: JSON.stringify(payload), performedAt: new Date(), status: input.state } });
    await appendEvent(tx, { poolId, proposalId: row.id, fromState: '', toState: input.state, actor, note: 'Proposta criada' });
    if (input.state === 'SUBMITTED') await submissionNotice(tx, poolId, row.id, actor, input.riskLevel);
    const propagation = { poolId, actor: actor.key, source: 'TECHNICAL_PROPOSAL_CREATED', proposalId: row.id, summary: `Proposta #${row.id} criada com estado ${input.state}`, metadata: { riskLevel: input.riskLevel, lifecycle: input.state }, propagatedAt: now };
    await persistPropagation(tx, propagation);
    return { proposal: C.mapTechnicalProposal(row, { pool }), propagation };
  }, { timeout: 20000 });
  await project(result.propagation);
  return { ok: true, proposal: result.proposal, propagation: { persisted: true } };
}
async function submissionNotice(tx, poolId, id, actor, riskLevel) {
  await tx.notification.create({ data: { type: 'TECHNICAL_SHEET_PROPOSAL', eventType: 'TECHNICAL_SHEET_CHANGE_PROPOSED', title: 'Proposta técnica para revisão', message: `${actor.name} submeteu a proposta #${id}.`, role: 'ADMIN', status: 'PENDING', severity: riskLevel, metadata: { poolId, proposalHistoryId: id, riskLevel } } });
}
function transitionInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Pedido de decisão inválido.');
  const targetState = C.normalizeProposalWorkflowState(body.nextStatus || body.status, ''); if (!targetState) fail('Estado de destino inválido.');
  const note = text(body.note ?? body.reason);
  if (['NEEDS_INFO', 'REJECTED'].includes(targetState) && !note) fail('Indique o motivo desta decisão.');
  if (body.expectedVersion !== undefined && !/^technical-proposal-v1:[0-9a-f]{64}$/.test(body.expectedVersion)) fail('Versão da proposta inválida.');
  return { targetState, note };
}
async function transition(rawPoolId, rawProposalId, body = {}, user, batchId = '') {
  const actor = identity(user), poolId = identifier(rawPoolId), proposalId = identifier(rawProposalId), { targetState, note } = transitionInput(body);
  const result = await prisma.$transaction(async tx => {
    // Same pool-first ordering as the existing pool and technical-sheet editors.
    await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${poolId} FOR UPDATE`;
    const pool = await poolScope(tx, poolId, actor);
    await tx.$queryRaw`SELECT id FROM "TechnicalHistory" WHERE id = ${proposalId} AND "poolId" = ${poolId} FOR UPDATE`;
    const row = await proposalRow(tx, poolId, proposalId, actor), payload = JSON.parse(row.description), current = C.mapTechnicalProposal(row);
    if (body.expectedVersion !== undefined && body.expectedVersion !== C.proposalVersion(row)) fail('A proposta mudou. Atualize a lista e reveja a decisão.', 409, 'TECHNICAL_PROPOSAL_VERSION_CONFLICT');
    if (!C.roleCanTransitionProposal(actor.role, current.status, targetState)) fail('Transição não permitida para esta proposta.', actor.admin ? 409 : 403, 'TECHNICAL_PROPOSAL_TRANSITION_DENIED');
    const immutable = C.buildImmutableHistory(await events(tx, poolId, proposalId));
    if (!immutable.chainValid || immutable.events.at(-1).toState !== current.status || row.status !== current.status) fail('O histórico desta proposta precisa de revisão administrativa antes de continuar.', 409, 'TECHNICAL_PROPOSAL_HISTORY_CONFLICT');
    const now = new Date().toISOString();
    Object.assign(payload, { status: targetState, lifecycle: targetState, reviewNote: note, ...(actor.admin ? { reviewedBy: actor.name, reviewedAt: now } : {}), transitions: [...(Array.isArray(payload.transitions) ? payload.transitions : []), { from: current.status, to: targetState, at: now, by: actor.name, actorKey: actor.key, note, batchId }] });
    const updated = await tx.technicalHistory.update({ where: { id: row.id }, data: { status: targetState, description: JSON.stringify(payload), performedAt: new Date() } });
    await appendEvent(tx, { poolId, proposalId, fromState: current.status, toState: targetState, actor, note, batchId, previousHash: immutable.latestHash });
    if (targetState === 'SUBMITTED') await submissionNotice(tx, poolId, proposalId, actor, current.riskLevel);
    if (['NEEDS_INFO', 'APPROVED', 'REJECTED'].includes(targetState)) {
      // Historical display names cannot establish ownership or a private recipient.
      const technicianId = payload.creatorKey && Number.isSafeInteger(payload.creatorTechnicianId) ? payload.creatorTechnicianId : null;
      await tx.notification.create({ data: { type: 'TECHNICAL_SHEET_PROPOSAL_WORKFLOW', eventType: `TECHNICAL_SHEET_PROPOSAL_${targetState}`, title: `Proposta técnica: ${targetState}`, message: `A proposta #${proposalId} passou para ${targetState}.`, role: technicianId ? 'TECHNICIAN' : 'ADMIN', status: 'PENDING', severity: current.riskLevel, metadata: { poolId, proposalHistoryId: proposalId, fromState: current.status, toState: targetState, batchId: batchId || null, ...(technicianId ? { technicianId } : {}) } } });
    }
    const propagation = { poolId, actor: actor.key, source: 'TECHNICAL_PROPOSAL_WORKFLOW', proposalId, summary: `Proposta #${proposalId}: ${current.status} -> ${targetState}. Decisão registada.`, metadata: { fromState: current.status, toState: targetState, batchId: batchId || null, decisionOnly: true }, propagatedAt: now };
    await persistPropagation(tx, propagation);
    return { proposal: C.mapTechnicalProposal(updated, { pool }), currentState: current.status, propagation };
  }, { timeout: 20000 });
  await project(result.propagation);
  return { ok: true, proposal: result.proposal, currentState: result.currentState, propagation: { persisted: true } };
}
async function list(rawPoolId, user, onlyPending = false) {
  const actor = identity(user), poolId = identifier(rawPoolId);
  return prisma.$transaction(async tx => {
    const pool = await poolScope(tx, poolId, actor), rows = await readAll(tx, { poolId, type: C.TECHNICAL_PROPOSAL_TYPE });
    const proposals = rows.filter(row => visible(row, actor)).map(row => C.mapTechnicalProposal(row, { pool })).filter(proposal => !onlyPending || C.PROPOSAL_PENDING_STATES.has(proposal.status)).reverse();
    return { ok: true, proposals };
  }, { isolationLevel: 'RepeatableRead', timeout: 20000 });
}
async function detail(rawPoolId, rawProposalId, user, kind) {
  const actor = identity(user), poolId = identifier(rawPoolId), proposalId = identifier(rawProposalId);
  return prisma.$transaction(async tx => {
    const pool = await poolScope(tx, poolId, actor), row = await proposalRow(tx, poolId, proposalId, actor), proposal = C.mapTechnicalProposal(row, { pool });
    if (kind === 'diff') return { ok: true, proposalId, status: proposal.status, version: proposal.version, diff: proposal.diff };
    const immutable = C.buildImmutableHistory(await events(tx, poolId, proposalId));
    if (immutable.events.at(-1)?.toState !== proposal.status || row.status !== proposal.status) immutable.chainValid = false;
    return { ok: true, proposalId, version: proposal.version, immutable, transitions: proposal.transitions };
  }, { isolationLevel: 'RepeatableRead', timeout: 20000 });
}
async function batch(rawPoolId, body = {}, user) {
  const actor = identity(user), poolId = identifier(rawPoolId); if (!actor.admin) fail('A revisão em lote requer administração.', 403);
  const { targetState } = transitionInput(body);
  if (!Array.isArray(body.proposalIds) || !body.proposalIds.length || body.proposalIds.length > 50) fail('Indique de uma a cinquenta propostas.');
  const ids = body.proposalIds.map(identifier); if (new Set(ids).size !== ids.length) fail('O lote contém propostas repetidas.');
  if (body.expectedVersions !== undefined && (!body.expectedVersions || typeof body.expectedVersions !== 'object' || ids.some(id => !/^technical-proposal-v1:[0-9a-f]{64}$/.test(body.expectedVersions[id])))) fail('Versões do lote inválidas.');
  const batchId = 'BATCH-' + randomUUID(), updated = [], failed = [];
  // Each item is atomic. A failed item never hides the result of committed items.
  for (const id of ids) {
    try { const result = await transition(poolId, id, { ...body, ...(body.expectedVersions ? { expectedVersion: body.expectedVersions[id] } : {}) }, user, batchId); updated.push(result.proposal); }
    catch (error) { failed.push({ proposalId: id, status: error.statusCode || 500, code: error.publicCode || 'TECHNICAL_PROPOSAL_WRITE_FAILED', error: error.statusCode ? error.message : 'Não foi possível gravar esta decisão. Consulte o estado antes de repetir.' }); }
  }
  return { ok: failed.length === 0, batchId, targetState, updatedCount: updated.length, failedCount: failed.length, updated, failed };
}
module.exports = { create, transition, list, detail, batch };
