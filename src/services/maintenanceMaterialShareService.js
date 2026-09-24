'use strict';
// A secondary attribution, never a second stock movement or purchase valuation.
// The journal is read across expenses: a declaration cannot be reused through
// another purchase line/document. Its original allocation keeps every reserve.
const r = require('./expenseLedgerRules'), rules = require('../../frontend/cw-maintenance-material-rules');
const materials = require('./equipmentMaterialsService'), targets = require('./expenseMaintenanceTargets');
const reminders = require('./reminderVisitCostSource'), { identity } = reminders.rules;
const { basis, commands, quantity, decimal, parentId, parentKey, materialKey, productOf, sameProduct, allocationFacts, positive, iso, sha } = rules;
const json = value => JSON.parse(JSON.stringify(value)), live = rows => rows.filter(s => !s.voidedAt);
const refused = (code, message) => ({ applied: false, code, message });
function budget(rows, monetary = true) {
  const active = live(rows), units = active.reduce((n, s) => n + quantity(s.share.preview.quantity), 0n);
  return { quantity: decimal(units), ...(monetary ? { amountCents: active.reduce((n, s) => n + s.share.preview.amountCents, 0) } : {}), shares: active.map(s => ({ id: s.share.id, hash: s.hash })).sort((a, b) => a.id.localeCompare(b.id)) };
}
const ownRows = (rows, a, target) => rows.filter(s => identity(s.share) === identity(target) && materialKey(s.share.preview.allocationBefore) === materialKey(a));
function validEvent(e) {
  const env = e.request, result = e.result, c = result?.receipt;
  return env?.requestId === e.requestId && env.command === e.command && (env.expenseId === e.expenseId || e.expenseId === null && result?.applied === false) && r.hash({ v: 1, ...env }) === e.payloadHash && result?.ok === true && typeof result.applied === 'boolean' && c?.owner === 'ADMIN:' + e.actorId && c.requestId === e.requestId && c.command === e.command && c.requestedExpenseId === env.expenseId && c.expectedVersion === env.expectedVersion && c.payloadHash === e.payloadHash && iso(c.confirmedAt) && (!result.applied || result.expenseId === e.expenseId && result.version === env.expectedVersion + 1);
}
async function journal(db) {
  const records = []; let review = false;
  const events = await db.expenseEvent.findMany({ where: { command: { in: commands } }, orderBy: { id: 'asc' } });
  for (const e of events) {
    try {
      if (!validEvent(e)) throw Error('Invalid event');
      if (!e.result.applied) continue;
      const d = e.request.data, s = e.result.share, reason = r.text(d.reason, 500, true);
      if (e.command === commands[0]) {
        const p = await rules.verify(s?.preview, r.hash), prior = records.filter(row => row.share.allocationId === s.allocationId);
        if (s.schema !== 1 || s.id !== e.requestId || s.expenseId !== e.expenseId || s.allocationId !== d.allocationId || !reminders.rules.matchesRequest(s, d) || s.createdById !== e.actorId || !iso(s.createdAt) || s.reason !== reason || e.result.reason !== reason || p.expenseVersion !== e.request.expectedVersion || p.expenseId !== s.expenseId || p.allocationId !== s.allocationId || p.reminderId !== s.reminderId || p.completionId !== s.completionId || p.hash !== d.previewHash || p.amountCents !== d.amountCents || p.quantity !== d.quantity || d.confirmed !== true || r.hash(s) !== e.result.shareHash || r.hash(budget(prior)) !== r.hash(p.used) || r.hash(budget(ownRows(records, p.allocationBefore, s), false)) !== r.hash(p.maintenanceUsed) || live(prior).some(row => identity(row.share) === identity(s))) throw Error('Invalid share');
        records.push({ share: s, hash: e.result.shareHash, voidedAt: null, voidReason: null });
      } else {
        const previous = records.find(row => row.share.id === d.shareId);
        if (!previous || previous.voidedAt || previous.share.expenseId !== e.expenseId || previous.share.allocationId !== d.allocationId || previous.hash !== d.shareHash || d.confirmed !== true || e.result.shareHash !== d.shareHash || r.hash(s) !== d.shareHash || !iso(e.result.voidedAt) || e.result.reason !== reason) throw Error('Invalid undo');
        previous.voidedAt = e.result.voidedAt; previous.voidReason = reason;
      }
    } catch (_) { review = true; }
  }
  // An untrustworthy event cannot silently release a cross-document quantity.
  return { records, review };
}
async function ownMaterials(db, parents) {
  const unique = [...new Map(parents.map(a => [parentKey(a), a])).values()], ids = type => unique.filter(a => a.targetType === type).map(parentId);
  if (!unique.length) return new Map();
  const where = { OR: [{ visitId: { in: ids('REGULAR') } }, { extraVisitId: { in: ids('EXTRA') } }] };
  const visitSelect = { id: true, poolId: true, clientId: true, technicianId: true, status: true, startAt: true, endAt: true };
  const [regular, extra, rows, movements] = await Promise.all([
    db.serviceVisit.findMany({ where: { id: { in: ids('REGULAR') } }, select: visitSelect }), db.extraVisit.findMany({ where: { id: { in: ids('EXTRA') } }, select: visitSelect }),
    db.equipmentMaintenanceCompletion.findMany({ where, select: { ...materials.selection, visitId: true, extraVisitId: true } }),
    db.stockMovement.findMany({ where, select: { id:true,movementType:true,productId:true,productName:true,unit:true,quantity:true,visitId:true,extraVisitId:true,poolId:true,clientId:true,technicianId:true,createdAt:true }, orderBy: { id: 'asc' } })
  ]);
  const receipts = rows.length ? await db.fieldWriteRequest.findMany({ where: { scope: 'EQUIPMENT_MAINTENANCE', requestId: { in: rows.map(row => row.requestId) } }, select: { owner:true,requestId:true,resourceId:true,payloadHash:true,response:true } }) : [];
  const revisions = await require('./equipmentMaterialReviewJournal').read(db, rows, receipts);
  const result = new Map();
  for (const [visitType, visits] of [['REGULAR', regular], ['EXTRA', extra]]) for (const visit of visits) {
    const field = visitType === 'REGULAR' ? 'visitId' : 'extraVisitId';
    for (const [id, view] of materials.assess(rows.filter(row => row[field] === visit.id), visit, visitType, receipts, movements.filter(m => m[field] === visit.id), revisions, await require('./reminderVisitResourceJournal').reservations(db, visit, visitType))) result.set(id, view);
  }
  return result;
}
async function decorate(db, expenses) {
  const state = await journal(db), records = live(state.records).filter(s => expenses.some(e => e.id === s.share.expenseId));
  const [current, views, reminderViews] = await Promise.all([targets.read(db, 'MAINTENANCE_EQUIPMENT', [...new Set(records.filter(s => s.share.reminderId === undefined).map(s => s.share.completionId))]), ownMaterials(db, records.map(s => s.share.preview.allocationBefore)), reminders.read(db, records.filter(s => s.share.reminderId !== undefined).map(s => s.share.reminderId))]);
  const byTarget = new Map(current.map(t => [t.id, t]));
  return expenses.map(e => {
    if (records.some(s => s.share.expenseId === e.id && !e.allocations.some(a => a.id === s.share.allocationId))) r.fail('Uma parcela de materiais perdeu a atribuição de origem. Reveja o histórico antes de usar os totais.', 503);
    const allocations = e.allocations.map(a => {
      const rows = state.records.filter(s => s.share.allocationId === a.id), active = live(rows), used = budget(rows), total = quantity(a.quantity);
      const shares = rows.map(s => {
        const p = s.share.preview, reminder = reminderViews.get(s.share.reminderId), t = s.share.reminderId === undefined ? byTarget.get(s.share.completionId) : reminder?.target, m = views.get(s.share.completionId);
        const sourceReview = s.share.reminderId === undefined ? m?.state !== 'MATCHED' || r.hash(m.record) !== p.materialsHash || m.comparison.sourceHash !== p.consumptionHash : !reminder?.valid || reminder.resourcesHash !== p.resourcesHash || reminder.resourceSourceHash !== p.resourceSourceHash || r.hash(reminder.materials) !== p.materialsHash;
        const needsReview = !s.voidedAt && (state.review || a.voidedAt !== null || a.needsReview || r.hash(allocationFacts(a)) !== p.allocationHash || !t?.valid || t.hash !== p.target.hash || sourceReview);
        return { ...s, needsReview: !!needsReview };
      });
      const invalidBudget = active.length > 0 && (total === null || quantity(used.quantity) > total || used.amountCents > a.amountCents);
      const review = a.valuationType === 'MATERIAL' && state.review || invalidBudget || shares.some(s => s.needsReview);
      return { ...a, maintenanceMaterialShares: shares, maintenanceMaterialShareReview: !!review, maintenanceMaterialSharedAmountCents: review ? null : used.amountCents, maintenanceMaterialParentAmountCents: review ? null : a.amountCents - used.amountCents, maintenanceMaterialSharedQuantity: review ? null : used.quantity, maintenanceMaterialParentQuantity: review || total === null ? null : decimal(total - quantity(used.quantity)), needsReview: a.needsReview || !!review, reviewReasons: [...a.reviewReasons, ...(review ? ['MAINTENANCE_MATERIAL_SHARE_REVIEW'] : [])] };
    });
    return { ...e, allocations, allocationReviewCount: allocations.filter(a => a.needsReview).length };
  });
}
function project(allocations) {
  return allocations.flatMap(a => {
    const shares = live(a.maintenanceMaterialShares || []); if (!shares.length) return [a];
    const used = budget(shares), total = quantity(a.quantity), remainder = a.amountCents - used.amountCents;
    if (!rules.count(remainder) || total === null || quantity(used.quantity) > total) return [{ ...a, needsReview: true }];
    const parent = { ...a, voidedAt: null, amountCents: remainder, quantity: decimal(total - quantity(used.quantity)), sourceAllocationId: a.id, costAttributionBasis: basis };
    return [parent, ...shares.map(s => {
      const p = s.share.preview;
      return { ...a, voidedAt: null, sourceAllocationId: a.id, maintenanceShareId: s.share.id, costAttributionBasis: basis, targetType: p.target.type, targetId: p.target.id, maintenanceCompletionId: s.share.completionId, serviceReminderId: s.share.reminderId ?? null, visitId: null, extraVisitId: null, targetHash: p.target.hash, targetSnapshot: p.target.snapshot, targetLabel: p.target.label, clientName: p.target.clientName, amountCents: p.amountCents, quantity: p.quantity, reason: s.share.reason, needsReview: a.needsReview || s.needsReview };
    })];
  });
}
async function sourceAllocation(db, expense, id) {
  const a = expense.expenseAllocations.find(row => row.id === id);
  if (!a || a.voidedAt || a.valuationType !== 'MATERIAL' || !['REGULAR','EXTRA'].includes(a.targetType)) return null;
  const hashes = await require('./expenseSourceService').fingerprints(db, [expense]);
  const decorated = (await require('./expenseCostAllocationService').decorate(db, [require('./expenseLedgerService').view(expense, hashes)]))[0];
  return decorated.allocations.find(row => row.id === id);
}
async function candidates(db, expense, allocationId, page, reminderMode = false) {
  const a = await sourceAllocation(db, expense, allocationId), base = { expenseId: expense.id, expenseVersion: expense.version, allocationId, page, pageSize: 10 };
  if (!a || a.needsReview || expense.cancelledAt) return { ...base, available: false, message: 'Confirme primeiro o custo de materiais da visita e as suas origens.', total: 0, rows: [] };
  if (reminderMode) {
    const [list, state] = await Promise.all([reminders.candidates(db, a, page), journal(db)]);
    return { ...base, available: true, targetType: 'MAINTENANCE_REMINDER', total: list.total, material: productOf(a), parentQuantity: a.quantity, parentAvailableQuantity: a.maintenanceMaterialParentQuantity, rows: list.rows.map(view => {
      const line = view.materials?.items.find(item => sameProduct(item, productOf(a))), used = budget(ownRows(state.records, a, { reminderId: view.id }), false), declared = quantity(line?.quantity);
      return { id: view.id, label: view.label, materialsState: !view.valid ? 'REVIEW' : view.materials?.mode === 'NONE' ? 'NONE' : view.materials ? 'MATCHED' : 'MISSING', targetConfirmed: view.valid, shared: live(a.maintenanceMaterialShares).some(s => s.share.reminderId === view.id), declaredQuantity: line?.quantity || null, availableQuantity: declared !== null && declared >= quantity(used.quantity) ? decimal(declared - quantity(used.quantity)) : null };
    }) };
  }
  const where = a.targetType === 'REGULAR' ? { visitId: parentId(a) } : { extraVisitId: parentId(a) };
  const [total, rows, views, state] = await Promise.all([db.equipmentMaintenanceCompletion.count({ where }), db.equipmentMaintenanceCompletion.findMany({ where, select: { id: true }, orderBy: { id: 'desc' }, skip: (page - 1) * 10, take: 10 }), ownMaterials(db, [a]), journal(db)]);
  const targetRows = await targets.read(db, 'MAINTENANCE_EQUIPMENT', rows.map(row => row.id));
  return { ...base, available: true, total, material: productOf(a), parentQuantity: a.quantity, parentAvailableQuantity: a.maintenanceMaterialParentQuantity, rows: targetRows.map(t => {
    const view = views.get(t.id), line = view?.record?.items?.find(item => sameProduct(item, productOf(a))), used = budget(ownRows(state.records, a, { completionId: t.id }), false), declared = quantity(line?.quantity);
    return { id: t.id, label: t.label, materialsState: view?.state || 'MISSING', targetConfirmed: t.valid, shared: live(a.maintenanceMaterialShares).some(s => s.share.completionId === t.id), declaredQuantity: line?.quantity || null, availableQuantity: declared !== null && declared >= quantity(used.quantity) ? decimal(declared - quantity(used.quantity)) : null };
  }) };
}
async function preview(db, expense, allocationId, completionId, selectedQuantity = null, lock = false, reminderMode = false) {
  const initial = expense.expenseAllocations.find(a => a.id === allocationId);
  if (lock && initial && ['REGULAR','EXTRA'].includes(initial.targetType)) {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'maintenance-material-share:' + parentKey(initial) }))::text`;
    if (reminderMode) { const current = await reminders.current(db, completionId); if (!current.valid || current.target.snapshot.originVisitType !== initial.targetType || current.target.snapshot.originVisitId !== parentId(initial)) return refused('REMINDER_RESOURCES_REVIEW', 'Confirme as parcelas próprias do lembrete nesta visita.'); await reminders.current(db, completionId, true); } else await targets.get(db, 'MAINTENANCE_EQUIPMENT', completionId, true);
    // The visit's row lock also blocks newly FK-linked consumptions/returns.
    if (initial.targetType === 'REGULAR') await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${parentId(initial)} FOR UPDATE`;
    else await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${parentId(initial)} FOR UPDATE`;
    await db.$queryRaw`SELECT id FROM "StockMovement" WHERE "visitId"=${initial.targetType === 'REGULAR' ? parentId(initial) : null} OR "extraVisitId"=${initial.targetType === 'EXTRA' ? parentId(initial) : null} FOR SHARE`;
    await require('./expenseSourceService').source(db, expense.sourceType, expense.stockPurchaseId, true);
  }
  const a = await sourceAllocation(db, expense, allocationId);
  if (!a || a.needsReview || expense.cancelledAt) return refused('PARENT_COST_REVIEW', 'Confirme primeiro o custo de materiais da visita e as suas origens.');
  if (reminderMode) return reminderPreview(db, expense, a, completionId, selectedQuantity);
  const [target, views, state] = await Promise.all([targets.get(db, 'MAINTENANCE_EQUIPMENT', completionId), ownMaterials(db, [a]), journal(db)]), m = views.get(completionId);
  if (!target?.valid || target.clientId !== a.clientId || target.snapshot.originVisitType !== a.targetType || target.snapshot.originVisitId !== parentId(a)) return refused('MAINTENANCE_SOURCE_REVIEW', 'A manutenção tem de pertencer a esta visita e cliente, com execução e decisão confirmadas.');
  if (m?.state !== 'MATCHED') return refused('MAINTENANCE_MATERIALS_REQUIRED', 'Registe os materiais e confirme a compatibilidade com o consumo líquido desta visita.');
  if (target.snapshot.endAt.slice(0, 7) !== a.monthRef || a.targetSnapshot.endAt.slice(0, 7) !== a.monthRef) return refused('MAINTENANCE_PERIOD_REVIEW', 'A visita, manutenção e atribuição têm de pertencer ao mesmo mês de execução (UTC).');
  if (live(a.maintenanceMaterialShares).some(s => s.share.completionId === completionId)) return refused('MAINTENANCE_ALREADY_SHARED', 'Esta manutenção já tem uma parcela ativa desta atribuição. Anule-a antes de corrigir.');
  const item = m.record.items.find(line => sameProduct(line, productOf(a)));
  if (!item) return refused('MAINTENANCE_PRODUCT_REQUIRED', 'Este produto e unidade não foram declarados nesta revisão.');
  const used = budget(state.records.filter(s => s.share.allocationId === a.id)), maintenanceUsed = budget(ownRows(state.records, a, { completionId }), false), parentQuantity = decimal(quantity(a.quantity));
  const remaining = quantity(parentQuantity) - quantity(used.quantity), ownRemaining = quantity(item.quantity) - quantity(maintenanceUsed.quantity), available = remaining < ownRemaining ? remaining : ownRemaining;
  const chosen = selectedQuantity === null ? available > 0n ? decimal(available) : '0' : selectedQuantity;
  const calc = rules.calculation(a.amountCents, parentQuantity, used, maintenanceUsed, item.quantity, chosen);
  if (state.review || !calc) return refused('MAINTENANCE_SHARE_BUDGET', 'A quantidade tem de caber na revisão e na atribuição, incluindo todas as compras, e permitir uma parcela positiva em cêntimos.');
  const allocationBefore = allocationFacts(a), value = { version: 1, basis, expenseId: expense.id, expenseVersion: expense.version, allocationId, completionId, monthRef: a.monthRef, allocationBefore, allocationHash: r.hash(allocationBefore), parentQuantity, quantity: decimal(quantity(chosen)), material: { ...productOf(a), declaredQuantity: item.quantity }, used, maintenanceUsed, materials: m.record, materialsHash: r.hash(m.record), consumptionSource: m.comparison.source, consumptionHash: m.comparison.sourceHash, target, ...calc };
  try { return json(await rules.verify({ available: true, ...value, hash: r.hash(value) }, r.hash)); } catch (_) { return refused('MAINTENANCE_SHARE_REVIEW', 'As provas dos materiais ou da atribuição precisam de revisão.'); }
}
async function reminderPreview(db, expense, a, reminderId, selectedQuantity) {
  const [view, state] = await Promise.all([reminders.current(db, reminderId), journal(db)]), target = view.target;
  if (!view.valid || target.clientId !== a.clientId || target.snapshot.originVisitType !== a.targetType || target.snapshot.originVisitId !== parentId(a) || view.materials?.mode !== 'DECLARED') return refused('REMINDER_RESOURCES_REVIEW', 'Confirme a associação e os materiais próprios deste lembrete na mesma visita.');
  if (target.snapshot.endAt.slice(0, 7) !== a.monthRef || a.targetSnapshot.endAt.slice(0, 7) !== a.monthRef) return refused('MAINTENANCE_PERIOD_REVIEW', 'O lembrete, a visita e a atribuição têm de pertencer ao mesmo mês UTC.');
  if (live(a.maintenanceMaterialShares).some(s => s.share.reminderId === reminderId)) return refused('MAINTENANCE_ALREADY_SHARED', 'Este lembrete já tem uma parcela ativa desta atribuição. Anule-a antes de corrigir.');
  const item = view.materials.items.find(line => sameProduct(line, productOf(a)));
  if (!item) return refused('MAINTENANCE_PRODUCT_REQUIRED', 'Este produto e unidade não foram declarados no lembrete.');
  const used = budget(state.records.filter(s => s.share.allocationId === a.id)), maintenanceUsed = budget(ownRows(state.records, a, { reminderId }), false), parentQuantity = decimal(quantity(a.quantity));
  const remaining = quantity(parentQuantity) - quantity(used.quantity), ownRemaining = quantity(item.quantity) - quantity(maintenanceUsed.quantity), available = remaining < ownRemaining ? remaining : ownRemaining;
  const chosen = selectedQuantity === null ? available > 0n ? decimal(available) : '0' : selectedQuantity, calc = rules.calculation(a.amountCents, parentQuantity, used, maintenanceUsed, item.quantity, chosen);
  if (state.review || !calc) return refused('MAINTENANCE_SHARE_BUDGET', 'A quantidade tem de caber no lembrete e na atribuição, incluindo todas as compras e os restantes serviços.');
  const allocationBefore = allocationFacts(a), value = { version: view.resources.event.preview.schema + 1, basis, expenseId: expense.id, expenseVersion: expense.version, allocationId: a.id, completionId: null, reminderId, monthRef: a.monthRef, allocationBefore, allocationHash: r.hash(allocationBefore), parentQuantity, quantity: decimal(quantity(chosen)), material: { ...productOf(a), declaredQuantity: item.quantity }, used, maintenanceUsed, materials: view.materials, materialsHash: r.hash(view.materials), ...reminders.evidence(view), target, ...calc };
  try { return json(await rules.verify({ available: true, ...value, hash: r.hash(value) }, r.hash)); } catch (_) { return refused('MAINTENANCE_SHARE_REVIEW', 'As provas dos materiais ou da atribuição precisam de revisão.'); }
}
async function hasActive(db, allocations) {
  const selected = allocations.filter(a => a.valuationType === 'MATERIAL'); if (!selected.length) return false;
  const state = await journal(db); return state.review || live(state.records).some(s => selected.some(a => a.id === s.share.allocationId));
}
async function apply(db, who, env, expense) {
  const d = env.data, create = env.command === commands[0];
  r.object(d, create ? ['allocationId','completionId','reminderId','quantity','amountCents','previewHash','reason','confirmed'] : ['allocationId','shareId','shareHash','reason','confirmed']);
  r.id(d.allocationId); const reason = r.text(d.reason, 500, true); if (d.confirmed !== true) r.fail('Reveja e confirme a parcela dos materiais.');
  let result;
  if (create) {
    const reminderMode = d.reminderId !== undefined; if (reminderMode && d.completionId !== undefined) r.fail('Escolha apenas um destino para a parcela.');
    r.id(reminderMode ? d.reminderId : d.completionId); r.money(d.amountCents); if (!sha(d.previewHash) || quantity(d.quantity) === null || quantity(d.quantity) <= 0n || decimal(quantity(d.quantity)) !== d.quantity) r.fail('Consulte o cálculo e conserve a quantidade confirmada.');
    const p = await preview(db, expense, d.allocationId, reminderMode ? d.reminderId : d.completionId, d.quantity, true, reminderMode); if (!p.available) return p;
    if (p.hash !== d.previewHash || p.amountCents !== d.amountCents) return refused('PREVIEW_CHANGED', 'A quantidade, a parcela ou as origens mudaram. Calcule e confirme novamente.');
    const share = { schema: 1, id: env.requestId, expenseId: expense.id, allocationId: d.allocationId, completionId: reminderMode ? null : d.completionId, ...(reminderMode ? { reminderId: d.reminderId } : {}), preview: p, reason, createdAt: new Date().toISOString(), createdById: who.id };
    result = { share, shareHash: r.hash(share) };
  } else {
    if (typeof d.shareId !== 'string' || !/^[0-9a-f-]{36}$/.test(d.shareId) || !sha(d.shareHash)) r.fail('Consulte a parcela antes de anular.');
    let state = await journal(db), row = state.records.find(s => s.share.id === d.shareId && s.share.expenseId === expense.id && s.share.allocationId === d.allocationId);
    if (row) await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'maintenance-material-share:' + parentKey(row.share.preview.allocationBefore) }))::text`;
    state = await journal(db); row = state.records.find(s => s.share.id === d.shareId && s.share.expenseId === expense.id && s.share.allocationId === d.allocationId);
    if (state.review || !row || row.voidedAt || row.hash !== d.shareHash) return refused('MAINTENANCE_SHARE_STATE', 'A parcela mudou, está anulada ou o histórico precisa de revisão.');
    result = { share: row.share, shareHash: row.hash, voidedAt: new Date().toISOString() };
  }
  const updated = await db.companyExpense.update({ where: { id: expense.id }, data: { version: { increment: 1 } } });
  return { applied: true, expenseId: expense.id, version: updated.version, ...result, reason };
}
module.exports = { commands, basis, rules, budget, journal, ownMaterials, decorate, project, sourceAllocation, candidates, preview, hasActive, apply };
