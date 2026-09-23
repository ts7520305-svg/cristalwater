'use strict';
const { prisma } = require('../prismaClient');
const writes = require('./fieldWriteRequestService');
const targets = require('./expenseRepairTargets');
const scope = 'REPAIR_WORK_INTERVAL', basis = 'EXPLICIT_AUTHENTICATED_REPAIR_WORK_INTERVAL';
const json = value => JSON.parse(JSON.stringify(value));
const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const iso = value => value instanceof Date ? value.toISOString() : value;
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
function id(value) { const n = Number(value); if (!positive(n) || typeof value !== 'number' && String(n) !== value) fail('Identificador inválido.'); return n; }
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(k => !keys.includes(k))) fail('Reveja os campos do registo de trabalho.');
}
function text(value) {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 5 || value.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('Indique uma justificação entre 5 e 1000 caracteres.');
  return value;
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('Indique um horário UTC válido, com precisão de segundos.');
  return new Date(value);
}
function authority(actor) {
  const owner = writes.owner(actor), admin = owner.startsWith('ADMIN:');
  return { owner, admin, technicianId: admin ? null : Number(actor.technicianId || actor.id) };
}
const allowed = (who, technicianId) => who.admin || who.technicianId === technicianId;
const facts = target => target ? Object.fromEntries(Object.entries(target.snapshot).filter(([k]) => !['label', 'clientName'].includes(k))) : null;
const recordHash = row => writes.hash(json(row));
const activeKey = row => writes.hash({ repairId: row.repairId, technicianId: row.technicianId, startedAt: iso(row.startedAt), endedAt: iso(row.endedAt) });
function snapshot(row, source, repairCreatedAt) {
  return { version: 1, basis, repairId: row.repairId, clientId: row.clientId, poolId: row.poolId,
    technicianId: row.technicianId, technicianName: row.technicianName, startedAt: iso(row.startedAt), endedAt: iso(row.endedAt),
    durationSeconds: row.durationSeconds, sourceHash: row.sourceHash, source, repairCreatedAt: iso(repairCreatedAt),
    reason: row.reason, createdBy: row.createdBy, createdAt: iso(row.createdAt) };
}
function intact(row) {
  const s = row.snapshot, duration = (row.endedAt - row.startedAt) / 1000;
  return s && sha(row.fingerprint) && writes.hash(s) === row.fingerprint && writes.hash(s) === writes.hash(snapshot(row, s.source, s.repairCreatedAt))
    && s.source?.type === 'REPAIR' && s.source.id === row.repairId && s.source.clientId === row.clientId && s.source.poolId === row.poolId
    && s.source.status === 'CONFIRMED' && sha(s.source.executionFingerprint) && positive(s.source.executionProofId)
    && writes.hash(s.source) === row.sourceHash && Number.isFinite(Date.parse(s.repairCreatedAt))
    && row.startedAt >= new Date(s.repairCreatedAt) && row.endedAt <= new Date(s.source.endAt)
    && Number.isSafeInteger(duration) && duration > 0 && duration === row.durationSeconds
    && (row.voidedAt ? row.activeKey === null : row.activeKey === activeKey(row));
}
async function overlaps(db, technicianId, startedAt, endedAt, exceptId = null) {
  return (await require('./recordedWorkTimeService').conflicts(db, [
    { type: 'REPAIR_INTERVAL', id: exceptId, technicianId, startAt: startedAt, endAt: endedAt }
  ])).size > 0;
}
async function inspectRow(db, row, target, knownTechnicians) {
  const reasons = [];
  if (!intact(row)) reasons.push('INTERVAL_EVIDENCE_CHANGED');
  if (!target?.valid || target.hash !== row.sourceHash) reasons.push('EXECUTION_EVIDENCE_CHANGED');
  if (!knownTechnicians.has(row.technicianId)) reasons.push('TECHNICIAN_MISSING');
  if (!row.voidedAt && await overlaps(db, row.technicianId, row.startedAt, row.endedAt, row.id)) reasons.push('RECORDED_TIME_OVERLAP');
  return { ...json(row), recordHash: recordHash(row), state: row.voidedAt ? 'VOIDED' : reasons.length ? 'REVIEW' : 'CONFIRMED', reviewReasons: reasons, canVoid: !row.voidedAt };
}
// Internal financial reads use the same evidence and overlap checks as the work page.
async function readForValuation(db, repairIds, preparedTargets) {
  if (!repairIds.length) return new Map();
  const rows = await db.repairWorkInterval.findMany({ where: { repairId: { in: repairIds } }, orderBy: [{ startedAt: 'asc' }, { id: 'asc' }] });
  const technicians = new Set((await db.technician.findMany({ where: { id: { in: [...new Set(rows.map(r => r.technicianId))] } }, select: { id: true } })).map(t => t.id));
  const reviewed = await Promise.all(rows.map(row => inspectRow(db, row, preparedTargets.get(row.repairId), technicians)));
  return new Map(reviewed.map(row => [row.id, row]));
}
async function inspect(db, actor, repairId, preparedTarget) {
  const who = authority(actor);
  const [target, repair, all, technicians] = await Promise.all([
    preparedTarget === undefined ? targets.get(db, repairId, false) : preparedTarget,
    db.repair.findUnique({ where: { id: repairId }, select: { id: true, problem: true, createdAt: true, pool: { select: { name: true } } } }),
    db.repairWorkInterval.findMany({ where: { repairId }, orderBy: [{ startedAt: 'asc' }, { id: 'asc' }] }),
    db.technician.findMany({ where: who.admin ? {} : { id: who.technicianId }, select: { id: true, name: true, active: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] })
  ]);
  if (!repair && !all.some(r => allowed(who, r.technicianId))) fail('Reparação ou histórico não encontrado.', 404);
  const knownTechnicians = new Set(technicians.map(t => t.id));
  const visible = all.filter(r => allowed(who, r.technicianId));
  const rows = await Promise.all(visible.map(row => inspectRow(db, row, target, knownTechnicians)));
  const confirmed = rows.filter(r => r.state === 'CONFIRMED'), totalSeconds = confirmed.reduce((sum, r) => sum + r.durationSeconds, 0);
  if (!Number.isSafeInteger(totalSeconds)) fail('A duração acumulada precisa de revisão.', 409);
  const source = { hash: target?.valid ? target.hash : null, facts: target?.valid ? facts(target) : null,
    earliestStartAt: repair?.createdAt.toISOString() || null, latestEndAt: target?.valid ? target.snapshot.endAt : null };
  const contextVersion = writes.hash({ repairId, source, rows: json(all), visibleStates: rows.map(r => ({ id: r.id, state: r.state, reviewReasons: r.reviewReasons })), technicians: [...technicians].sort((a, b) => a.id - b.id) });
  return { version: 1, basis, repairId, contextVersion, visibility: who.admin ? 'ALL_REPAIR_TECHNICIANS' : 'OWN_TECHNICIAN',
    problem: repair?.problem || 'Reparação removida — histórico preservado', poolName: repair?.pool?.name || null,
    source, canRegister: !!target?.valid && technicians.length > 0, technicians, rows,
    summary: { unit: 'PERSON_SECOND', count: rows.length, confirmedCount: confirmed.length, reviewCount: rows.filter(r => r.state === 'REVIEW').length, voidedCount: rows.filter(r => r.state === 'VOIDED').length, totalSeconds },
    message: target?.valid ? 'Registe intervalos de trabalho efetivo entre a criação e a confirmação da reparação. Exclua pausas e tempos já registados noutras intervenções.' : 'A execução autenticada precisa de confirmação ou revisão. O histórico de tempos permanece disponível.' };
}
function parse(actor, value, body) {
  const repairId = id(value), who = authority(actor);
  object(body, ['requestId', 'command', 'expectedVersion', 'data']);
  if (!['RECORD', 'VOID'].includes(body.command) || !sha(body.expectedVersion)) fail('Reveja o intervalo antes de confirmar.');
  const d = body.data;
  object(d, body.command === 'RECORD' ? ['technicianId', 'startedAt', 'endedAt', 'reason', 'confirmed'] : ['intervalId', 'recordHash', 'reason', 'confirmed']);
  if (d.confirmed !== true) fail('Confirme expressamente o registo ou a anulação.');
  text(d.reason);
  if (body.command === 'RECORD') {
    if (!positive(d.technicianId)) fail('Escolha o técnico que realizou o trabalho.');
    if (!allowed(who, d.technicianId)) fail('Só pode registar o seu próprio tempo de trabalho.', 403);
    const start = date(d.startedAt), end = date(d.endedAt), seconds = (end - start) / 1000;
    if (!positive(seconds) || end > new Date()) fail('O fim tem de ser posterior ao início e não pode estar no futuro.');
  } else if (!positive(d.intervalId) || !sha(d.recordHash)) fail('Reveja o intervalo a anular.');
  const payload = { command: body.command, expectedVersion: body.expectedVersion, data: d };
  return { who, repairId, payload, request: writes.context(actor, scope, repairId, body.requestId, payload) };
}
async function command(actor, value, body) {
  const { who, repairId, payload, request } = parse(actor, value, body), d = payload.data;
  return prisma.$transaction(async db => {
    const saved = await writes.recover(db, request); if (saved) return saved;
    await db.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', 'repair-work:' + repairId);
    const old = payload.command === 'VOID' ? await db.repairWorkInterval.findUnique({ where: { id: d.intervalId } }) : null;
    if (old && (old.repairId !== repairId || !allowed(who, old.technicianId))) fail('Sem permissão para este intervalo.', 403);
    const technicianId = old?.technicianId || d.technicianId;
    const target = await targets.get(db, repairId, true);
    if (technicianId) {
      await db.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', 'repair-work-technician:' + technicianId);
      await db.$queryRawUnsafe('SELECT id FROM "Technician" WHERE id=$1 FOR SHARE', technicianId);
    }
    let view;
    try { view = await inspect(db, actor, repairId, target); } catch (e) { if (e.status !== 404) throw e; }
    const refuse = (code, message) => writes.confirm(db, request, { ok: true, applied: false, context: payload, code, message });
    if (!view || view.contextVersion !== payload.expectedVersion) return refuse('REPAIR_WORK_CHANGED', 'A execução, o técnico ou os tempos mudaram. O pedido não foi aplicado. Consulte novamente.');
    let interval;
    if (payload.command === 'RECORD') {
      const technician = view.technicians.find(t => t.id === d.technicianId), start = date(d.startedAt), end = date(d.endedAt);
      if (!view.canRegister || !technician || start < new Date(view.source.earliestStartAt) || end > new Date(view.source.latestEndAt)) return refuse('REPAIR_WORK_CHANGED', 'Confirme a execução e um intervalo dentro das datas apresentadas.');
      if (await overlaps(db, d.technicianId, start, end)) return refuse('WORK_TIME_CONFLICT', 'Este técnico já tem tempo registado nesse intervalo. Reveja os tempos antes de criar outro pedido.');
      const row = { repairId, clientId: target.clientId, poolId: target.snapshot.poolId, technicianId: technician.id,
        technicianName: technician.name, startedAt: start, endedAt: end, durationSeconds: (end - start) / 1000,
        sourceHash: target.hash, reason: d.reason, createdBy: who.owner, createdAt: new Date() };
      const proof = snapshot(row, view.source.facts, view.source.earliestStartAt);
      interval = await db.repairWorkInterval.create({ data: { ...row, snapshot: proof, fingerprint: writes.hash(proof), activeKey: activeKey(row) } });
    } else {
      if (!old || old.voidedAt || recordHash(old) !== d.recordHash) return refuse('REPAIR_WORK_CHANGED', 'O intervalo mudou ou já foi anulado. Consulte o histórico.');
      interval = await db.repairWorkInterval.update({ where: { id: old.id }, data: { voidedAt: new Date(), voidedBy: who.owner, voidReason: d.reason, activeKey: null } });
    }
    const eventType = payload.command === 'RECORD' ? 'REPAIR_WORK_RECORDED' : 'REPAIR_WORK_VOIDED';
    await db.auditTrail.create({ data: { eventType, action: eventType, entity: 'RepairWorkInterval', entityId: interval.id,
      clientId: interval.clientId, poolId: interval.poolId, message: payload.command === 'RECORD' ? 'Intervalo de trabalho declarado e confirmado.' : 'Intervalo de trabalho anulado com justificação.',
      metadata: { version: 1, repairId, owner: who.owner, requestId: request.requestId, interval: json(interval) } } });
    return writes.confirm(db, request, { ok: true, applied: true, context: payload, interval: json(interval), recordHash: recordHash(interval) });
  }, { maxWait: 15000, timeout: 20000 });
}
async function detail(actor, value) {
  const repairId = id(value);
  return prisma.$transaction(async db => ({ ok: true, detail: await inspect(db, actor, repairId) }), { isolationLevel: 'RepeatableRead', timeout: 20000 });
}
async function lookup(actor, value, requestId, payloadHash) {
  const repairId = id(value), owner = authority(actor).owner;
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) || !sha(payloadHash)) fail('Pedido de recuperação inválido.');
  const saved = await prisma.fieldWriteRequest.findUnique({ where: { owner_requestId: { owner, requestId: requestId.toLowerCase() } } });
  if (!saved) return { ok: true, found: false };
  if (saved.scope !== scope || saved.resourceId !== repairId || saved.payloadHash !== payloadHash) fail('O pedido não corresponde ao intervalo guardado.', 409);
  return { ok: true, found: true, result: saved.response };
}
module.exports = { detail, command, lookup, inspect, intact, readForValuation, basis, scope };
