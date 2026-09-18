'use strict';
const { prisma } = require('../../prismaClient');
const { normalizeRole } = require('../../utils/roles');
const { hash } = require('../../services/fieldWriteRequestService');
const { SERVICE_CATEGORIES } = require('../../services/reminderScopeService');
const finance = require('../finance/FinanceOsBusiness');
const { cents } = require('../admin/AlertBillingBusiness');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const key = (kind, id) => `maintenance-billing:${kind}:${id}`;
const lineType = kind => `MAINTENANCE_${kind}`;
const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
function id(value) { if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !positive(Number(value))) fail(400, 'Identificador inválido.'); return Number(value); }
function kind(value) { if (!['EQUIPMENT', 'REMINDER'].includes(value)) fail(400, 'Tipo de intervenção inválido.'); return value; }
function admin(user) { if (normalizeRole(user?.role) !== 'ADMIN' || !positive(Number(user.userId || user.id))) fail(403, 'Apenas a administração pode rever cobranças.'); return `ADMIN:${user.userId || user.id}`; }
const equipmentInclude = { plan: { select: { poolId: true, title: true } }, visit: { select: { poolId: true, clientId: true } }, extraVisit: { select: { poolId: true, clientId: true } } };
function projection(type, row, pool) {
  const equipment = type === 'EQUIPMENT', visit = row.extraVisitId ? row.extraVisit : row.visit;
  const complete = equipment || (row.completedAt && !['CANCELLED', 'CANCELED'].includes(String(row.status).toUpperCase()) && SERVICE_CATEGORIES.includes(row.category));
  const sourcePool = equipment ? row.plan.poolId : row.poolId;
  const matches = sourcePool === pool.id && (equipment ? Boolean(visit && visit.poolId === pool.id && (!visit.clientId || visit.clientId === pool.clientId)) : (!row.clientId || row.clientId === pool.clientId));
  const title = equipment ? row.result?.plan?.title || row.plan.title : row.title;
  const details = equipment ? row.notes : row.description || '';
  const source = { kind: type, sourceId: row.id, poolId: pool.id, clientId: pool.clientId, poolName: pool.name, clientName: pool.client.name,
    title, details, completedAt: row.completedAt?.toISOString() || null,
    visitType: equipment ? (row.extraVisitId ? 'EXTRA' : 'REGULAR') : null, visitId: equipment ? row.extraVisitId || row.visitId : null };
  return { ...source, expectedVersion: `v1:${hash({ source, row })}`, reviewable: Boolean(complete && matches),
    reviewIssue: !complete ? 'O serviço não tem uma conclusão válida.' : !matches ? 'A piscina ou o cliente mudou. Reveja a origem antes de cobrar.' : null };
}
function input(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['expectedVersion','expectedClientId','expectedPoolId','mode','amount','note','confirmed'].includes(k))) fail(400, 'Pedido comercial inválido.');
  if (typeof body.expectedVersion !== 'string' || !/^v1:[a-f0-9]{64}$/.test(body.expectedVersion) || !positive(body.expectedClientId) || !positive(body.expectedPoolId) || body.confirmed !== true) fail(400, 'Atualize e confirme a intervenção, piscina e cliente.');
  if (!['INCLUDED','EXTRA'].includes(body.mode) || typeof body.note !== 'string' || body.note.trim().length < 3 || body.note.length > 2000) fail(400, 'Escolha a condição comercial e indique uma nota (3–2000 caracteres).');
  const amountCents = body.mode === 'EXTRA' ? cents(body.amount) : 0;
  if (body.mode === 'INCLUDED' && ![0, '0', '0.00', '0,00'].includes(body.amount)) fail(400, 'Uma intervenção incluída não pode ter um valor extra.');
  return { expectedVersion: body.expectedVersion, expectedClientId: body.expectedClientId, expectedPoolId: body.expectedPoolId, mode: body.mode, amountCents, note: body.note.trim() };
}
async function list(user, poolId, query = {}) {
  admin(user); const pid = id(poolId), type = kind(query.kind || 'EQUIPMENT'), before = query.before === undefined ? null : id(query.before);
  const pool = await prisma.pool.findUnique({ where: { id: pid }, include: { client: { select: { name: true } } } });
  if (!pool) fail(404, 'Piscina não encontrada.');
  const where = { ...(before ? { id: { lt: before } } : {}), ...(type === 'EQUIPMENT' ? { plan: { poolId: pid } } : { poolId: pid, category: { in: SERVICE_CATEGORIES }, completedAt: { not: null }, status: { notIn: ['CANCELLED','CANCELED'] } }) };
  const records = await prisma[type === 'EQUIPMENT' ? 'equipmentMaintenanceCompletion' : 'generalReminder'].findMany({ where, ...(type === 'EQUIPMENT' ? { include: equipmentInclude } : {}), orderBy: { id: 'desc' }, take: 26 });
  const rows = records.slice(0, 25).map(row => projection(type, row, pool));
  const decisions = await prisma.operationalReminder.findMany({ where: { sourceKey: { in: rows.map(row => key(type, row.sourceId)) } }, select: { sourceKey: true, metadata: true } });
  const saved = new Map(decisions.map(row => [row.sourceKey, row.metadata.result]));
  const contexts = new Map(decisions.map(row => [row.sourceKey, { clientId: row.metadata.source.clientId, clientName: row.metadata.source.clientName, poolId: row.metadata.source.poolId, poolName: row.metadata.source.poolName }]));
  const invoices = await prisma.invoice.findMany({ where: { id: { in: decisions.map(row => row.metadata.result.invoiceId).filter(positive) } }, select: { id: true, status: true } });
  const states = new Map(invoices.map(row => [row.id, row.status]));
  return { ok: true, kind: type, poolId: pid, clientId: pool.clientId, poolName: pool.name, clientName: pool.client.name,
    rows: rows.map(row => { const decision = saved.get(key(type, row.sourceId)) || null; return { ...row, decision, reviewedFor: contexts.get(key(type, row.sourceId)) || null, invoiceStatus: decision?.invoiceId ? states.get(decision.invoiceId) || 'UNAVAILABLE' : null }; }),
    nextBefore: records.length > 25 ? rows.at(-1).sourceId : null };
}
async function review(user, rawKind, sourceId, body) {
  const actor = admin(user), type = kind(rawKind), sid = id(sourceId), values = input(body), sourceKey = key(type, sid), fingerprint = hash(values);
  return prisma.$transaction(async tx => {
    // This source remains reserved even if its reminder is later deleted or its document withdrawn.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
    const previous = await tx.operationalReminder.findUnique({ where: { sourceKey } });
    if (previous) {
      if (previous.metadata.fingerprint !== fingerprint) fail(409, 'Esta intervenção já tem uma decisão comercial. Consulte o registo existente.');
      return { ...previous.metadata.result, idempotent: true };
    }
    if (type === 'EQUIPMENT') await tx.$queryRaw`SELECT id FROM "EquipmentMaintenanceCompletion" WHERE id = ${sid} FOR SHARE`;
    else await tx.$queryRaw`SELECT id FROM "GeneralReminder" WHERE id = ${sid} FOR UPDATE`;
    const row = await tx[type === 'EQUIPMENT' ? 'equipmentMaintenanceCompletion' : 'generalReminder'].findUnique({ where: { id: sid }, ...(type === 'EQUIPMENT' ? { include: equipmentInclude } : {}) });
    if (!row) fail(404, 'Intervenção não encontrada.');
    if (type === 'EQUIPMENT') {
      if (row.extraVisitId) await tx.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id = ${row.extraVisitId} FOR SHARE`;
      else if (row.visitId) await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${row.visitId} FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "EquipmentMaintenancePlan" WHERE id = ${row.planId} FOR SHARE`;
      const current = await tx.equipmentMaintenanceCompletion.findUnique({ where: { id: sid }, include: equipmentInclude });
      if (!current) fail(404, 'Intervenção não encontrada.'); Object.assign(row, current);
    }
    const pid = type === 'EQUIPMENT' ? row.plan.poolId : row.poolId;
    if (!pid || pid !== values.expectedPoolId) fail(409, 'A piscina da intervenção mudou. Atualize a lista.');
    await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${pid} FOR SHARE`;
    const pool = await tx.pool.findUnique({ where: { id: pid }, include: { client: { select: { name: true } } } });
    if (!pool || pool.clientId !== values.expectedClientId) fail(409, 'O cliente da piscina mudou. Atualize a lista.');
    const source = projection(type, row, pool);
    if (!source.reviewable) fail(409, source.reviewIssue);
    if (source.expectedVersion !== values.expectedVersion) fail(409, 'A intervenção mudou. Atualize e reveja os dados antes de confirmar.');
    const reserved = await tx.invoiceLine.findFirst({ where: { referenceId: sid, lineType: lineType(type) } });
    if (reserved) fail(409, `Esta intervenção já está associada ao documento #${reserved.invoiceId}. Reveja esse documento.`);
    const amount = values.amountCents / 100; let invoiceId = null, invoiceLineId = null;
    if (values.mode === 'EXTRA') {
      const draft = await finance.createDraftInvoice({ clientId: pool.clientId, standalone: true, notes: `Intervenção periódica revista pela administração. ${values.note}`,
        lines: [{ type: 'MAINTENANCE', lineType: lineType(type), referenceId: sid, description: `${source.title} — ${pool.name} (${source.completedAt.slice(0, 10)})`, quantity: 1, unitPrice: amount, total: amount, notes: sourceKey }] }, actor, tx);
      if (!draft.ok) fail(draft.status || 409, draft.error);
      invoiceId = draft.invoice.id; invoiceLineId = draft.invoice.lines[0].id;
      await tx.invoice.update({ where: { id: invoiceId }, data: { amountCents: values.amountCents, totalCents: values.amountCents, subtotal: amount, subtotalCurrent: amount } });
    }
    const result = { ok: true, schema: 1, kind: type, sourceId: sid, poolId: pid, clientId: pool.clientId, expectedVersion: values.expectedVersion,
      mode: values.mode, amountCents: values.amountCents, amount, note: values.note, invoiceId, invoiceLineId, status: invoiceId ? 'DRAFT' : 'INCLUDED',
      reviewedAt: new Date().toISOString(), actor };
    await tx.operationalReminder.create({ data: { sourceKey, title: 'Decisão comercial de manutenção', dueDate: new Date(), isCompleted: true, metadata: { fingerprint, source, result } } });
    await tx.userAuditLog.create({ data: { actor, action: 'MAINTENANCE_BILLING_REVIEWED', entity: type === 'EQUIPMENT' ? 'EquipmentMaintenanceCompletion' : 'GeneralReminder', entityId: String(sid), metadata: result } });
    return result;
  }, { maxWait: 15000, timeout: 30000 });
}
module.exports = { list, review };
