'use strict';
const { prisma } = require('../prismaClient'), r = require('./fieldWriteRequestService');
const materials = require('./equipmentMaterialsService'), journal = require('./equipmentMaterialReviewJournal'), targets = require('./expenseMaintenanceTargets');
const { rules } = journal, { normalizeRole } = require('../utils/roles');
const json = value => JSON.parse(JSON.stringify(value));
const refuse = (code, message) => ({ available: false, code, message });
const id = value => { if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) r.fail('Identificador inválido.'); return Number(value); };
function admin(user) { if (normalizeRole(user?.role) !== 'ADMIN') r.fail('Só a administração pode corrigir declarações de materiais.', 403); return r.owner(user); }
function parse(body, command = false) {
  if (!rules.fields(body, command ? ['requestId','action','materials','previewHash','reason','confirmed'] : ['action','materials']) || !['REPLACE','WITHDRAW'].includes(body.action)) r.fail('Conserve a declaração e o contexto revistos.');
  const value = body.action === 'WITHDRAW' ? null : materials.parse(body.materials);
  if (body.action === 'WITHDRAW' && body.materials !== null || value && r.hash(value) !== r.hash(body.materials)) r.fail('Reveja os produtos, unidades e quantidades normalizados.');
  if (command && (!rules.uuid(body.requestId) || !rules.sha(body.previewHash) || typeof body.reason !== 'string' || body.reason !== body.reason.trim() || body.reason.length < 3 || body.reason.length > 500 || body.confirmed !== true)) r.fail('Indique o motivo e confirme a declaração revista.');
  return value;
}
const parent = row => row && !!row.visitId !== !!row.extraVisitId ? { visitType: row.visitId ? 'REGULAR' : 'EXTRA', visitId: row.visitId || row.extraVisitId } : null;
async function context(db, completionId, lock = false) {
  let row = await db.equipmentMaintenanceCompletion.findUnique({ where: { id: completionId } });
  if (!row) return refuse('NOT_FOUND', 'Revisão não encontrada.');
  const p = parent(row); if (!p) return refuse('ORIGIN_REVIEW', 'A visita de origem precisa de revisão.');
  if (lock) {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'maintenance-material-share:' + p.visitType + ':' + p.visitId }))::text`;
    await targets.get(db, 'MAINTENANCE_EQUIPMENT', completionId, true);
    if (p.visitType === 'REGULAR') await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${p.visitId} FOR UPDATE`;
    else await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${p.visitId} FOR UPDATE`;
    row = await db.equipmentMaintenanceCompletion.findUnique({ where: { id: completionId } });
    if (r.hash(parent(row)) !== r.hash(p)) return refuse('ORIGIN_CHANGED', 'A origem mudou. Atualize a revisão.');
    await db.$queryRaw`SELECT id FROM "EquipmentMaintenanceCompletion" WHERE "visitId"=${p.visitType === 'REGULAR' ? p.visitId : null} OR "extraVisitId"=${p.visitType === 'EXTRA' ? p.visitId : null} FOR SHARE`;
    await db.$queryRaw`SELECT id FROM "StockMovement" WHERE "visitId"=${p.visitType === 'REGULAR' ? p.visitId : null} OR "extraVisitId"=${p.visitType === 'EXTRA' ? p.visitId : null} FOR SHARE`;
  }
  const field = p.visitType === 'REGULAR' ? 'visitId' : 'extraVisitId';
  const [visit, rows, target] = await Promise.all([
    db[p.visitType === 'REGULAR' ? 'serviceVisit' : 'extraVisit'].findUnique({ where: { id: p.visitId }, select: { id:true,poolId:true,clientId:true,technicianId:true,status:true,startAt:true,endAt:true } }),
    db.equipmentMaintenanceCompletion.findMany({ where: { [field]: p.visitId }, select: materials.selection, orderBy: { id: 'asc' } }),
    targets.get(db, 'MAINTENANCE_EQUIPMENT', completionId)
  ]);
  if (!visit) return refuse('ORIGIN_REVIEW', 'Visita de origem indisponível.');
  const inputs = await materials.readInputs(db, rows, visit, p.visitType), state = inputs.revisions.get(completionId);
  if (lock) for (const source of rows) await db.$queryRaw`SELECT id FROM "FieldWriteRequest" WHERE (scope='EQUIPMENT_MAINTENANCE' AND "requestId"=${source.requestId}) OR (scope='EQUIPMENT_MATERIAL_REVIEW' AND "resourceId"=${source.id}) FOR SHARE`;
  const views = materials.assess(rows, visit, p.visitType, inputs.receipts, inputs.movements, inputs.revisions, inputs.associated), view = views.get(completionId);
  const ownOriginal = rows.find(s => s.id === completionId), original = journal.original(ownOriginal, inputs.receipts);
  // A later administrative declaration has its own author/date. It never
  // supplies a fictitious technician receipt to old, unverifiable records.
  const technical = materials.intact(ownOriginal, inputs.receipts) && (!original.record || materials.sound(original.record));
  const historical = technical ? null : await require('./equipmentHistoryMaterialSource').selection(db, ownOriginal, state);
  const trusted = technical || !!historical?.current || !!historical?.withdraw;
  const origin = { ...p, poolId: visit.poolId, clientId: visit.clientId, technicianId: visit.technicianId };
  const [pool, technician] = await Promise.all([visit.poolId ? db.pool.findUnique({ where: { id: visit.poolId }, select: { name: true } }) : null, visit.technicianId ? db.technician.findUnique({ where: { id: visit.technicianId }, select: { name: true } }) : null]);
  const editable = trusted && state?.valid && target?.valid && rules.origin(origin) && target.snapshot.originVisitType === p.visitType && target.snapshot.originVisitId === p.visitId && target.clientId === visit.clientId && target.snapshot.poolId === visit.poolId;
  const history = state?.history || [], result = { available: true, completionId, title: row.result?.plan?.title || 'Revisão #' + completionId, origin, clientName: target?.clientName || '', poolName: pool?.name || '', technicianName: technician?.name || '', original, originalHash: r.hash(original), current: view, history, journalValid: !!state?.valid, editable: !!editable, message: editable ? historical ? 'Materiais históricos: declaração administrativa ligada à origem e evidência revistas. O recibo técnico original continua indisponível.' : 'A declaração posterior será atribuída à administração e à data da confirmação.' : 'Confirme a execução, a decisão comercial, a origem e o recibo original antes de corrigir materiais.' };
  return { ...result, ...(historical?.context?.legacy ? { historicalReviewAvailable:true } : {}), ...(historical?.current || historical?.withdraw ? { historicalOrigin: { current:historical.current, withdrawalOnly:!historical.current, previous:historical.withdraw } } : {}), row, rows, visit, target, state, inputs, views, historical };
}
function publicContext(c) { if (!c.available) return c; const { row, rows, visit, target, state, inputs, views, historical, ...value } = c; return value; }
async function calculate(db, completionId, body, lock = false) {
  const input = parse(body), c = await context(db, completionId, lock);
  if (!c.available) return c;
  if (!c.editable) return refuse('MATERIAL_SOURCE_REVIEW', c.message);
  const originReview = c.historical ? body.action === 'WITHDRAW' ? c.historical.withdraw : c.historical.current : null;
  if (c.historical && !originReview) return refuse('HISTORICAL_ORIGIN_REVIEW', 'Confirme a origem histórica atual antes de declarar materiais. A declaração anterior pode ser anulada.');
  const proposed = { action: body.action, record: input ? materials.create(input, c.visit, c.origin.visitType, originReview?.hash) : null };
  const previous = { headHash: c.state.headHash, action: c.state.action, record: c.state.record };
  if (r.hash(previous.record) === r.hash(proposed.record)) return refuse('NO_CHANGE', 'A declaração proposta coincide com o registo atual.');
  const shares = await require('./maintenanceMaterialShareService').journal(db);
  if (shares.review) return refuse('MATERIAL_COST_HISTORY_REVIEW', 'O histórico das parcelas de materiais precisa de revisão antes de confirmar os efeitos desta alteração.');
  const affectedShares = shares.records.filter(s => !s.voidedAt && s.share.preview.allocationBefore.targetType === c.origin.visitType && require('./maintenanceMaterialShareService').rules.parentId(s.share.preview.allocationBefore) === c.origin.visitId).map(s => ({ id: s.share.id, hash: s.hash, expenseId: s.share.expenseId, allocationId: s.share.allocationId, completionId: s.share.completionId, amountCents: s.share.preview.amountCents, quantity: s.share.preview.quantity })).sort((a, b) => a.id.localeCompare(b.id));
  const tentative = new Map(c.inputs.revisions); tentative.set(completionId, { valid: true, headHash: '0'.repeat(64), ...proposed, history: [{ revision: { preview: { origin: c.origin } } }], ...(originReview ? { originReviewValid:true, originReview } : {}) });
  const after = materials.assess(c.rows, c.visit, c.origin.visitType, c.inputs.receipts, c.inputs.movements, tentative, c.inputs.associated).get(completionId);
  const value = { schema: originReview ? 2 : 1, ...(originReview ? { originReview } : {}), basis: rules.basis, completionId, origin: c.origin, original: c.original, baseHash: c.originalHash, previous, proposed, targetHash: c.target.hash, sourceHash: r.hash(json({ visit: c.visit, originals: c.rows.map(row => journal.original(row, c.inputs.receipts)), revisions: [...c.inputs.revisions].map(([id, s]) => ({ id, valid: s.valid, headHash: s.headHash })), movements: c.inputs.movements, ...(c.historical ? { historicalSource: c.historical.context.sourceHash, historicalState: c.historical.context.state?.headHash, historicalValid: c.historical.context.journalValid, historicalCurrent: c.historical.current?.hash || null } : {}), ...(c.inputs.associated.records.length || !c.inputs.associated.valid ? {associated:c.inputs.associated} : {}) })), beforeState: c.current.state, afterState: after.state, afterReasons: after.reasons, affectedShares };
  return rules.preview({ available: true, ...value, hash: r.hash(value) }, r.hash);
}
async function detail(user, completionId) { admin(user); const cid = id(completionId); return prisma.$transaction(async db => ({ ok: true, declaration: publicContext(await context(db, cid)) }), { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 20000 }); }
async function preview(user, completionId, body) { admin(user); const cid = id(completionId); parse(body); return prisma.$transaction(async db => ({ ok: true, preview: await calculate(db, cid, body) }), { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 20000 }); }
async function command(user, completionId, body) {
  const owner = admin(user), cid = id(completionId); parse(body, true);
  const { requestId, ...payload } = body, request = r.context(user, rules.scope, cid, requestId, payload);
  return prisma.$transaction(async db => {
    const saved = await r.recover(db, request); if (saved) return saved;
    const p = await calculate(db, cid, { action: body.action, materials: body.materials }, true);
    if (!p.available || p.hash !== body.previewHash) return r.confirm(db, request, { ok: true, applied: false, envelope: body, code: p.code || 'PREVIEW_CHANGED', message: p.message || 'A declaração, os consumos ou as parcelas mudaram. Atualize e confirme novamente.' });
    const revision = { schema: 1, id: requestId, owner, completionId: cid, reason: body.reason, createdAt: new Date().toISOString(), preview: p };
    const response = await r.confirm(db, request, { ok: true, applied: true, envelope: body, revision, revisionHash: r.hash(revision) });
    await rules.response(response, body, owner, cid, r.hash);
    await db.technicalHistory.create({ data: { poolId: p.origin.poolId, type: rules.scope, status: body.action === 'WITHDRAW' ? 'WITHDRAWN' : 'CORRECTED', message: 'Materiais da revisão #' + cid + ': ' + body.reason, description: JSON.stringify({ requestId, revisionHash: response.revisionHash, previousHash: p.previous.headHash }), performedAt: new Date(revision.createdAt) } });
    await db.userAuditLog.create({ data: { actor: owner, action: rules.scope, entity: 'EquipmentMaintenanceCompletion', entityId: String(cid), metadata: { requestId, revisionHash: response.revisionHash, action: body.action, affectedShareIds: p.affectedShares.map(s => s.id) } } });
    return response;
  }, { isolationLevel: 'ReadCommitted', maxWait: 15000, timeout: 25000 });
}
async function recover(user, requestId) {
  const owner = admin(user); if (!rules.uuid(requestId)) r.fail('Identificador de pedido inválido.');
  const saved = await prisma.fieldWriteRequest.findUnique({ where: { owner_requestId: { owner, requestId } } });
  if (!saved || saved.scope !== rules.scope) r.fail('Não existe confirmação deste pedido para esta conta.', 404);
  return saved.response;
}
module.exports = { detail, preview, command, recover, calculate, context };
