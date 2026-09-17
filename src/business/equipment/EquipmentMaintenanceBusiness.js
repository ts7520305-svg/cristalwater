const { prisma } = require('../../prismaClient');
const { createHash } = require('node:crypto');
const requests = require('../../services/fieldWriteRequestService');
const { normalizeRole } = require('../../utils/roles');
const { civilDate, advance, dayLisbon } = require('../../services/equipmentMaintenanceCalendar');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function id(value) { if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) fail(400, 'Identificador inválido'); return Number(value); }
function version(value) { if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483646) fail(400, 'Versão inválida'); return value; }
function admin(user) { if (normalizeRole(user?.role) !== 'ADMIN') fail(403, 'Apenas a administração pode configurar os planos'); }
function identity(user) { return `${user.principalType || (normalizeRole(user.role) === 'TECHNICIAN' ? 'TECHNICIAN' : 'USER')}:${user.userId || user.id}:${user.technicianId || ''}`; }
function owns(user, visit) {
  if (!visit) fail(404, 'Visita não encontrada');
  const role = normalizeRole(user?.role);
  if (role !== 'ADMIN' && (!['TECHNICIAN','TEAM_LEADER'].includes(role) || visit.technicianId !== Number(user.technicianId || user.id))) fail(403, 'A visita não está atribuída a este técnico');
}
function open(visit) { return Boolean(visit.startAt && !visit.endAt && !['DONE','COMPLETED','CONCLUIDA','CONCLUÍDA','CONCLUIDO','CONCLUÍDO','CANCELLED','CANCELED','CANCELADA','CANCELADO','ARCHIVED','ARQUIVADA','ARQUIVADO','SKIPPED','CLOSED'].includes(String(visit.status).toUpperCase())); }
function publicPlan(plan, now = new Date()) {
  return { id: plan.id, poolId: plan.poolId, component: plan.component, title: plan.title, instructions: plan.instructions, intervalUnit: plan.intervalUnit, intervalCount: plan.intervalCount,
    nextDue: plan.nextDue.toISOString().slice(0, 10), active: plan.active, version: plan.version, lastCompletedAt: plan.lastCompletedAt,
    overdue: plan.active && plan.nextDue.toISOString().slice(0, 10) < dayLisbon(now) };
}
function data(body) {
  if (!body || typeof body !== 'object') fail(400, 'Plano inválido');
  const { component, title, instructions, intervalUnit, intervalCount } = body;
  if (!['FILTER','CHLORINATOR','PUMP','OTHER'].includes(component)) fail(400, 'Escolha o equipamento');
  if (typeof title !== 'string' || title.trim().length < 3 || title.length > 150 || typeof instructions !== 'string' || instructions.trim().length < 3 || instructions.length > 3000) fail(400, 'Indique título (3–150) e instruções (3–3000 caracteres)');
  if (typeof intervalCount !== 'number') fail(400, 'Intervalo inválido');
  let nextDue;
  try { nextDue = civilDate(body.nextDue); advance('2026-01-01', intervalUnit, intervalCount); } catch (e) { fail(400, e.message); }
  return { component, title: title.trim(), instructions: instructions.trim(), intervalUnit, intervalCount, nextDue };
}
async function listPool(user, poolId) {
  admin(user); const pid = id(poolId);
  if (!await prisma.pool.findUnique({ where: { id: pid }, select: { id: true } })) fail(404, 'Piscina não encontrada');
  return { ok: true, plans: (await prisma.equipmentMaintenancePlan.findMany({ where: { poolId: pid }, orderBy: [{ active: 'desc' }, { nextDue: 'asc' }, { id: 'asc' }] })).map(p => publicPlan(p)) };
}
async function create(user, poolId, body) {
  admin(user); const pid = id(poolId), values = data(body);
  if (body.active !== undefined && typeof body.active !== 'boolean') fail(400, 'Estado inválido');
  values.active = body.active === undefined ? true : body.active;
  return prisma.$transaction(async tx => {
    const pool = await tx.pool.findUnique({ where: { id: pid }, select: { id: true } });
    if (!pool) fail(404, 'Piscina não encontrada');
    const plan = await tx.equipmentMaintenancePlan.create({ data: { ...values, poolId: pid } });
    await tx.userAuditLog.create({ data: { actor: identity(user), action: 'EQUIPMENT_MAINTENANCE_CREATED', entity: 'EquipmentMaintenancePlan', entityId: String(plan.id), metadata: { poolId: pid, version: plan.version } } });
    return { ok: true, plan: publicPlan(plan) };
  });
}
async function update(user, planId, body) {
  admin(user); const pid = id(planId), expected = version(body?.expectedVersion), values = data(body);
  if (typeof body.active !== 'boolean' || body.poolId !== undefined) fail(400, 'Estado inválido ou tentativa de mudar a piscina');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "EquipmentMaintenancePlan" WHERE id = ${pid} FOR UPDATE`;
    const current = await tx.equipmentMaintenancePlan.findUnique({ where: { id: pid } });
    if (!current) fail(404, 'Plano não encontrado');
    if (current.version !== expected) fail(409, 'O plano foi alterado. Atualize antes de guardar');
    const plan = await tx.equipmentMaintenancePlan.update({ where: { id: pid }, data: { ...values, active: body.active, version: { increment: 1 } } });
    await tx.userAuditLog.create({ data: { actor: identity(user), action: 'EQUIPMENT_MAINTENANCE_UPDATED', entity: 'EquipmentMaintenancePlan', entityId: String(pid), metadata: { version: plan.version, active: plan.active } } });
    return { ok: true, plan: publicPlan(plan) };
  });
}
function visitKind(value = 'REGULAR') {
  if (!['REGULAR','EXTRA'].includes(value)) fail(400, 'Tipo de visita inválido');
  return value;
}
function completionWhere(planId, visitId, visitType) {
  return visitType === 'EXTRA' ? { planId_extraVisitId: { planId, extraVisitId: visitId } } : { planId_visitId: { planId, visitId } };
}
async function listVisit(user, visitId, type) {
  const vid = id(visitId), visitType = visitKind(type), field = visitType === 'EXTRA' ? 'extraVisitId' : 'visitId';
  // The assignment, pool and completions come from one relation snapshot.
  const visit = await prisma[visitType === 'EXTRA' ? 'extraVisit' : 'serviceVisit'].findUnique({ where: { id: vid }, include: { pool: { select: { maintenancePlans: { include: { completions: { where: { [field]: vid }, select: { id: true } } }, orderBy: [{ nextDue: 'asc' }, { id: 'asc' }] } } } } });
  owns(user, visit); const canComplete = open(visit) && Boolean(visit.poolId);
  return { ok: true, visitId: vid, visitType, poolId: visit.poolId, canComplete, plans: (visit.pool?.maintenancePlans || []).map(p => ({ ...publicPlan(p), completedInVisit: p.completions.length > 0, canComplete: canComplete && p.active && p.completions.length === 0 })) };
}
async function complete(user, planId, body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Revisão inválida');
  const modern = Object.hasOwn(body, 'visitType'), visitType = visitKind(body.visitType);
  const pid = id(planId), vid = id(body.visitId), expected = version(body.expectedVersion);
  if (modern && (Object.keys(body).some(key => !['requestId','visitType','visitId','poolId','expectedVersion','notes','confirmed'].includes(key)) || typeof body.visitId !== 'number' || typeof body.poolId !== 'number')) fail(400, 'Conserve o contexto original da revisão');
  const poolId = modern ? id(body.poolId) : null;
  if (body.confirmed !== true || typeof body.notes !== 'string' || body.notes.trim().length < 3 || body.notes.length > 3000) fail(400, 'Confirme a execução e descreva o que observou (3–3000 caracteres)');
  if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) fail(400, 'Identificador da operação inválido');
  const actor = identity(user), requestId = body.requestId.toLowerCase(), notes = body.notes.trim();
  const { requestId: ignored, ...payload } = body;
  const request = modern ? requests.context(user, 'EQUIPMENT_MAINTENANCE', pid, requestId, payload) : null;
  const fingerprint = modern ? request.payloadHash : createHash('sha256').update(JSON.stringify({ pid, vid, expected, notes, confirmed: true })).digest('hex');
  const context = { planId: pid, visitType, visitId: vid, poolId, expectedVersion: expected };
  try { return await prisma.$transaction(async tx => {
    // Recovery returns only this principal's original receipt, even after reassignment.
    if (request) { const saved = await requests.recover(tx, request); if (saved) return saved; }
    if (visitType === 'EXTRA') await tx.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id = ${vid} FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${vid} FOR UPDATE`;
    const visit = await tx[visitType === 'EXTRA' ? 'extraVisit' : 'serviceVisit'].findUnique({ where: { id: vid } }); owns(user, visit);
    const reject = (message, code) => request ? requests.confirm(tx, request, { ok: true, applied: false, context, code, message }) : fail(409, message);
    if (modern && visit.poolId !== poolId) return reject('A piscina da visita mudou. Atualize a visita antes de preparar outra revisão.', 'EQUIPMENT_CONTEXT');
    await tx.$queryRaw`SELECT id FROM "EquipmentMaintenancePlan" WHERE id = ${pid} FOR UPDATE`;
    const plan = await tx.equipmentMaintenancePlan.findUnique({ where: { id: pid } });
    if (!plan || plan.poolId !== visit.poolId) fail(404, 'Plano não disponível nesta visita');
    const prior = await tx.equipmentMaintenanceCompletion.findUnique({ where: { requestId } });
    if (prior) {
      if (modern || prior.actor !== actor || prior.fingerprint !== fingerprint) fail(409, 'Este identificador já corresponde a outro registo');
      return { ...prior.result, idempotent: true };
    }
    if (await tx.equipmentMaintenanceCompletion.findUnique({ where: completionWhere(pid, vid, visitType) })) return reject('Este equipamento já foi revisto nesta visita.', 'EQUIPMENT_DUPLICATE');
    if (!open(visit)) return reject('Inicie a visita antes de registar a manutenção; visitas fechadas não aceitam alterações.', 'EQUIPMENT_STATE');
    if (!plan.active || plan.version !== expected) return reject('O plano foi alterado ou está em pausa. Atualize a lista e reveja as instruções.', 'EQUIPMENT_STALE');
    const now = new Date(); let nextDue;
    try { nextDue = advance(dayLisbon(now), plan.intervalUnit, plan.intervalCount); } catch (e) { return reject(e.message, 'EQUIPMENT_STALE'); }
    const updated = await tx.equipmentMaintenancePlan.update({ where: { id: pid }, data: { nextDue, lastCompletedAt: now, version: { increment: 1 } } });
    const result = { ok: true, idempotent: false, plan: publicPlan(updated, now), completedAt: now.toISOString(), ...(modern ? { applied: true, context } : {}) };
    let snapshot = JSON.parse(JSON.stringify(result));
    const completed = await tx.equipmentMaintenanceCompletion.create({ data: { planId: pid, version: expected, ...(visitType === 'EXTRA' ? { extraVisitId: vid } : { visitId: vid }), requestId, actor, fingerprint, notes, completedAt: now, result: snapshot } });
    if (modern) {
      snapshot = await requests.confirm(tx, request, { ...snapshot, completion: { id: completed.id, planId: pid, visitType, visitId: vid, poolId, version: expected, requestId, notes, completedAt: now.toISOString() } });
      await tx.equipmentMaintenanceCompletion.update({ where: { id: completed.id }, data: { result: snapshot } });
    }
    await tx.technicalHistory.create({ data: { poolId: plan.poolId, type: 'EQUIPMENT_MAINTENANCE', component: plan.component, message: plan.title, description: JSON.stringify({ planId: pid, version: expected, visitType, visitId: vid, requestId, actor, notes, instructions: plan.instructions, nextDue: nextDue.toISOString().slice(0, 10) }), status: 'COMPLETED', performedAt: now } });
    await tx.userAuditLog.create({ data: { actor, action: 'EQUIPMENT_MAINTENANCE_COMPLETED', entity: 'EquipmentMaintenancePlan', entityId: String(pid), metadata: { visitType, visitId: vid, poolId: plan.poolId, version: expected, requestId, nextDue: snapshot.plan.nextDue } } });
    return snapshot;
  }, { maxWait: 15000, timeout: 20000 }); } catch (e) { if (e.code === 'P2002') fail(409, 'Esta operação ou versão já foi registada. Atualize a lista'); throw e; }
}
module.exports = { listPool, create, update, listVisit, complete, publicPlan, completionWhere };
