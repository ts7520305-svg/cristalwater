'use strict';
// Secondary attribution of an existing cost. The original allocation remains
// the sole reservation against its salary/charge basis and measured visit time.
const r = require('./expenseLedgerRules'), targets = require('./expenseCostTargets'), time = require('./equipmentWorkTimeService'), quantities = require('./expenseValuationSources');
const reminders = require('./reminderVisitCostSource'), { identity } = reminders.rules;
const periods = require('../../frontend/cw-maintenance-material-rules');
const commands = ['SHARE_MAINTENANCE_LABOR', 'VOID_MAINTENANCE_LABOR_SHARE'];
const basis = 'CONFIRMED_PARENT_COST_TIME_SHARE';
const fields = ['id','expenseId','monthRef','amountCents','targetType','clientId','visitId','extraVisitId','repairId','maintenanceCompletionId','serviceReminderId','targetHash','targetSnapshot','expenseHash','expenseSnapshot','activeKey','reason','createdById','createdAt','reviewedAt','voidedAt','voidReason','valuationType','valuationKey','valuationHash','valuationSnapshot','quantity','quantityUnit','purchaseItemId','activeMeasurementKey'];
const json = value => JSON.parse(JSON.stringify(value));
const positive = n => Number.isSafeInteger(n) && n > 0, count = n => Number.isSafeInteger(n) && n >= 0;
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const refused = (code, message) => ({ applied: false, code, message });
const allocationFacts = a => json(Object.fromEntries(fields.map(k => [k, a[k]])));
const parentId = a => a.targetType === 'REGULAR' ? a.visitId : a.extraVisitId;
function duration(a) { const q = quantities.quantity(String(a.quantity)); return q !== null && q > 0n && q % 1000n === 0n && q / 1000n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(q / 1000n) : null; }
const live = rows => rows.filter(s => !s.voidedAt);
function budget(rows) {
  const active = live(rows), durationMs = active.reduce((n, s) => n + s.share.preview.workTime.durationMs, 0), amountCents = active.reduce((n, s) => n + s.share.preview.amountCents, 0);
  return { durationMs, amountCents, shares: active.map(s => ({ id: s.share.id, hash: s.hash })).sort((a, b) => a.id.localeCompare(b.id)) };
}
function calculation(totalCents, totalMs, used, ownMs) {
  return reminders.rules.timeCalculation(totalCents, totalMs, used, ownMs);
}
async function validPreview(p) {
  try {
    const { available, hash, ...value } = p, a = p.allocationBefore, w = p.workTime, t = p.target;
    const calc = calculation(a.amountCents, p.parentDurationMs, p.used, w.durationMs);
    periods.verifyPeriod(p, p.workTimeRevision!==undefined?5:w?.schema===2?4:1);
    if(p.workTimeRevision!==undefined)await time.journal.rules.share(p,r.hash);
    return available === true && p.basis === basis && sha(hash) && r.hash(value) === hash && positive(p.expenseId) && positive(p.expenseVersion) && positive(p.allocationId) && p.allocationId === a.id && a.expenseId === p.expenseId && a.valuationType === 'LABOR' && ['REGULAR','EXTRA'].includes(a.targetType) && a.quantityUnit === 'SECOND' && a.voidedAt === null && duration(a) === p.parentDurationMs && r.hash(a) === p.allocationHash && positive(a.clientId) && positive(parentId(a)) && iso(a.targetSnapshot?.endAt) &&
      p.reminderId === undefined && t.type === 'MAINTENANCE_EQUIPMENT' && t.id === p.completionId && positive(t.id) && t.valid === true && t.clientId === a.clientId && t.snapshot?.originVisitType === a.targetType && t.snapshot.originVisitId === parentId(a) && iso(t.snapshot.endAt) && r.hash(Object.fromEntries(targets.executionFields(t.type).map(k => [k, t.snapshot[k]]))) === t.hash &&
      time.sound(w) && w.origin?.visitType === a.targetType && w.origin.visitId === parentId(a) && w.origin.clientId === a.clientId && w.origin.poolId === t.snapshot.poolId && positive(w.origin.technicianId) && w.origin.technicianId === a.valuationSnapshot?.source?.service?.technicianId && time.intervals(w).every(i=>Date.parse(i.startAt)>=Date.parse(a.targetSnapshot.startAt)&&Date.parse(i.endAt)<=Date.parse(a.targetSnapshot.endAt)) && r.hash(w) === p.workTimeHash && calc && Object.entries(calc).every(([k, v]) => p[k] === v);
  } catch { return false; }
}
function validEvent(e) {
  const env = e.request, result = e.result, c = result?.receipt;
  return env?.requestId === e.requestId && env.command === e.command && env.expenseId === e.expenseId && r.hash({ v: 1, ...env }) === e.payloadHash && result?.ok === true && typeof result.applied === 'boolean' && c?.owner === 'ADMIN:' + e.actorId && c.requestId === e.requestId && c.command === e.command && c.requestedExpenseId === e.expenseId && c.expectedVersion === env.expectedVersion && c.payloadHash === e.payloadHash && iso(c.confirmedAt) && (!result.applied || result.expenseId === e.expenseId && result.version === env.expectedVersion + 1);
}
async function journal(db, expenseIds) {
  const result = new Map(expenseIds.map(id => [id, { records: [], review: false }]));
  const events = expenseIds.length ? await db.expenseEvent.findMany({ where: { expenseId: { in: expenseIds }, command: { in: commands } }, orderBy: { id: 'asc' } }) : [];
  for (const e of events) {
    const state = result.get(e.expenseId), d = e.request?.data, s = e.result?.share, reason = typeof d?.reason === 'string' ? d.reason.trim() : null;
    if (!validEvent(e)) { state.review = true; continue; }
    if (!e.result.applied) continue;
    if (e.command === commands[0]) {
      const p = s?.preview, prior = state.records.filter(row => row.share.allocationId === s?.allocationId);
      let verified = await validPreview(p); if (p?.reminderId !== undefined) { try { await reminders.rules.verify(p, r.hash); verified = true; } catch (_) { verified = false; } }
      if (!s || s.schema !== 1 || s.id !== e.requestId || s.expenseId !== e.expenseId || s.allocationId !== d.allocationId || !reminders.rules.matchesRequest(s, d) || s.createdById !== e.actorId || !iso(s.createdAt) || s.reason !== reason || e.result.reason !== reason || !verified || p.expenseVersion !== e.request.expectedVersion || p.expenseId !== s.expenseId || p.allocationId !== s.allocationId || p.reminderId !== s.reminderId || p.completionId !== s.completionId || p.hash !== d.previewHash || p.amountCents !== d.amountCents || d.confirmed !== true || r.hash(s) !== e.result.shareHash || r.hash(budget(prior)) !== r.hash(p.used) || live(prior).some(row => identity(row.share) === identity(s))) { state.review = true; continue; }
      state.records.push({ share: s, hash: e.result.shareHash, voidedAt: null, voidReason: null });
    } else {
      const previous = state.records.find(row => row.share.id === d.shareId);
      if (!previous || previous.voidedAt || previous.share.allocationId !== d.allocationId || previous.hash !== d.shareHash || d.confirmed !== true || e.result.shareHash !== d.shareHash || r.hash(e.result.share) !== d.shareHash || !iso(e.result.voidedAt) || e.result.reason !== reason) { state.review = true; continue; }
      previous.voidedAt = e.result.voidedAt; previous.voidReason = reason;
    }
  }
  return result;
}
async function ownTimes(db, parents) {
  const unique = [...new Map(parents.map(p => [p.type + ':' + p.id, p])).values()], ids = type => unique.filter(p => p.type === type).map(p => p.id);
  if (!unique.length) return new Map();
  const select = { id: true, poolId: true, clientId: true, technicianId: true, status: true, startAt: true, endAt: true };
  const [regular, extra, rows] = await Promise.all([
    db.serviceVisit.findMany({ where: { id: { in: ids('REGULAR') } }, select }), db.extraVisit.findMany({ where: { id: { in: ids('EXTRA') } }, select }),
    db.equipmentMaintenanceCompletion.findMany({ where: { OR: [{ visitId: { in: ids('REGULAR') } }, { extraVisitId: { in: ids('EXTRA') } }] }, select: { ...time.selection, visitId: true, extraVisitId: true } })
  ]);
  const groups = [...regular.map(visit => ({ visit, visitType: 'REGULAR' })), ...extra.map(visit => ({ visit, visitType: 'EXTRA' }))].map(g => ({ ...g, rows: rows.filter(row => (g.visitType === 'REGULAR' ? row.visitId : row.extraVisitId) === g.visit.id) }));
  const prepared = await time.prepareRead(db, groups), views = new Map();
  for (const g of groups) for (const [id, value] of await time.describe(db, g.rows, g.visit, g.visitType, prepared)) views.set(id, value);
  return views;
}
async function decorate(db, expenses) {
  const states = await journal(db, expenses.map(e => e.id)), records = [...states.values()].flatMap(s => live(s.records));
  const [current, times, reminderViews] = await Promise.all([
    require('./expenseMaintenanceTargets').read(db, 'MAINTENANCE_EQUIPMENT', [...new Set(records.filter(s => s.share.reminderId === undefined).map(s => s.share.completionId))]),
    ownTimes(db, records.map(s => ({ type: s.share.preview.allocationBefore.targetType, id: parentId(s.share.preview.allocationBefore) }))),
    reminders.read(db, records.filter(s => s.share.reminderId !== undefined).map(s => s.share.reminderId))
  ]);
  const byTarget = new Map(current.map(t => [t.id, t]));
  return expenses.map(e => {
    const state = states.get(e.id);
    if (live(state.records).some(s => !e.allocations.some(a => a.id === s.share.allocationId))) r.fail('Uma parcela de manutenção perdeu a atribuição de origem. É necessária revisão do histórico.', 503);
    const allocations = e.allocations.map(a => {
      const rows = state.records.filter(s => s.share.allocationId === a.id), active = live(rows), used = budget(rows);
      const shares = rows.map(s => {
        const p = s.share.preview, reminder = reminderViews.get(s.share.reminderId), t = s.share.reminderId === undefined ? byTarget.get(s.share.completionId) : reminder?.target, w = times.get(s.share.completionId);
        const sourceReview = s.share.reminderId === undefined ? w?.state !== 'RECORDED' || r.hash(w?.record || null) !== p.workTimeHash || (w?.revision?.headHash||null)!==(p.workTimeRevision?.hash||null) : !reminder?.valid || reminder.resourcesHash !== p.resourcesHash || r.hash(reminder.workTime) !== p.workTimeHash;
        const needsReview = !s.voidedAt && (state.review || a.voidedAt !== null || a.needsReview || p.allocationHash !== r.hash(allocationFacts(a)) || !t?.valid || t.hash !== p.target.hash || sourceReview);
        return { ...s, needsReview };
      });
      const invalidBudget = active.length > 0 && (!positive(duration(a)) || used.durationMs > duration(a) || used.amountCents > a.amountCents), review = state.review || invalidBudget || shares.some(s => s.needsReview);
      return { ...a, maintenanceShares: shares, maintenanceShareReview: !!review, maintenanceSharedAmountCents: review ? null : used.amountCents, maintenanceParentAmountCents: review ? null : a.amountCents - used.amountCents, needsReview: a.needsReview || !!review, reviewReasons: [...a.reviewReasons, ...(review ? ['MAINTENANCE_SHARE_REVIEW'] : [])] };
    });
    return { ...e, allocations, maintenanceShareHistoryReview: state.review, allocationReviewCount: allocations.filter(a => a.needsReview).length };
  });
}
function project(allocations) {
  return allocations.flatMap(a => {
    const shares = live(a.maintenanceShares || []);
    if (!shares.length) return [a];
    const used = budget(shares), remainder = a.amountCents - used.amountCents;
    // Invalid historical amounts never become negative or confirmed totals.
    if (!count(remainder)) return [{ ...a, needsReview: true }];
    const parent = { ...a, voidedAt: null, amountCents: remainder, sourceAllocationId: a.id, costAttributionBasis: basis, quantity: duration(a) >= used.durationMs ? quantities.decimal(BigInt(duration(a) - used.durationMs) * 1000n) : a.quantity };
    return [parent, ...shares.map(s => {
      const p = s.share.preview;
      return { ...a, voidedAt: null, sourceAllocationId: a.id, maintenanceShareId: s.share.id, monthRef: p.monthRef, ...(p.period ? { sourceMonthRef: p.period.parentMonthRef } : {}), costAttributionBasis: basis, targetType: p.target.type, targetId: p.target.id, maintenanceCompletionId: s.share.completionId, serviceReminderId: s.share.reminderId ?? null, visitId: null, extraVisitId: null, targetHash: p.target.hash, targetSnapshot: p.target.snapshot, targetLabel: p.target.label, clientName: p.target.clientName, amountCents: p.amountCents, quantity: quantities.decimal(BigInt(p.workTime.durationMs) * 1000n), reason: s.share.reason, needsReview: a.needsReview || s.needsReview };
    })];
  });
}
async function sourceAllocation(db, expense, allocationId) {
  const a = expense.expenseAllocations.find(a => a.id === allocationId);
  if (!a || a.voidedAt || a.valuationType !== 'LABOR' || !['REGULAR','EXTRA'].includes(a.targetType)) return null;
  const hashes = await require('./expenseSourceService').fingerprints(db, [expense]);
  const decorated = (await require('./expenseCostAllocationService').decorate(db, [require('./expenseLedgerService').view(expense, hashes)]))[0];
  return decorated.allocations.find(row => row.id === a.id);
}
async function candidates(db, expense, allocationId, page, reminderMode = false) {
  const a = await sourceAllocation(db, expense, allocationId);
  if (!a || a.needsReview || expense.cancelledAt) return { available: false, message: 'Confirme primeiro o custo de trabalho da visita e as suas origens.', rows: [], total: 0, page, pageSize: 10, allocationId, expenseId: expense.id, expenseVersion: expense.version };
  if (reminderMode) {
    const list = await reminders.candidates(db, a, page);
    return { available: true, targetType: 'MAINTENANCE_REMINDER', expenseId: expense.id, expenseVersion: expense.version, allocationId, page, pageSize: 10, total: list.total, rows: list.rows.map(v => ({ id: v.id, label: v.label, workTimeState: !v.valid ? 'REVIEW' : v.workTime ? 'RECORDED' : 'MISSING', durationMs: v.workTime?.durationMs || null, targetConfirmed: v.valid, shared: live(a.maintenanceShares).some(s => s.share.reminderId === v.id) })) };
  }
  const where = a.targetType === 'REGULAR' ? { visitId: parentId(a) } : { extraVisitId: parentId(a) };
  const [total, rows, times] = await Promise.all([db.equipmentMaintenanceCompletion.count({ where }), db.equipmentMaintenanceCompletion.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * 10, take: 10, select: { id: true } }), ownTimes(db, [{ type: a.targetType, id: parentId(a) }])]);
  const targetRows = await require('./expenseMaintenanceTargets').read(db, 'MAINTENANCE_EQUIPMENT', rows.map(row => row.id));
  return { available: true, expenseId: expense.id, expenseVersion: expense.version, allocationId, page, pageSize: 10, total, rows: rows.map(row => targetRows.find(t => t.id === row.id)).filter(Boolean).map(t => ({ id: t.id, label: t.label, workTimeState: times.get(t.id)?.state || 'MISSING', durationMs: times.get(t.id)?.record?.durationMs || null, targetConfirmed: t.valid, shared: live(a.maintenanceShares).some(s => s.share.completionId === t.id) })) };
}
async function preview(db, expense, allocationId, completionId, lock = false, reminderMode = false) {
  if (lock) { if (reminderMode) await reminders.current(db, completionId, true); else {const source=await db.equipmentMaintenanceCompletion.findUnique({where:{id:completionId},select:{visitId:true,extraVisitId:true}});if(source)await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'maintenance-material-share:'+(source.extraVisitId?'EXTRA':'REGULAR')+':'+(source.extraVisitId||source.visitId) }))::text`;await require('./expenseMaintenanceTargets').get(db, 'MAINTENANCE_EQUIPMENT', completionId, true);} }
  const a = await sourceAllocation(db, expense, allocationId);
  if (!a || a.needsReview || expense.cancelledAt) return refused('PARENT_COST_REVIEW', 'Confirme primeiro o custo de trabalho da visita e as suas origens.');
  if (reminderMode) return reminderPreview(db, expense, a, completionId);
  const [target, times] = await Promise.all([targets.get(db, 'MAINTENANCE_EQUIPMENT', completionId), ownTimes(db, [{ type: a.targetType, id: parentId(a) }])]);
  const w = times.get(completionId);
  if (!target?.valid || target.clientId !== a.clientId || target.snapshot.originVisitType !== a.targetType || target.snapshot.originVisitId !== parentId(a)) return refused('MAINTENANCE_SOURCE_REVIEW', 'A manutenção tem de pertencer a esta visita e cliente, com execução e decisão confirmadas.');
  if (w?.state !== 'RECORDED') return refused('MAINTENANCE_TIME_REQUIRED', 'Registe e confirme o tempo próprio desta revisão antes de repartir o custo.');
  let period; try { period = periods.sharePeriod(a, target, w.revision?5:w.record.schema===2?4:1); } catch (error) { return refused('MAINTENANCE_PERIOD_REVIEW', error.message); }
  if (live(a.maintenanceShares).some(s => s.share.completionId === completionId)) return refused('MAINTENANCE_ALREADY_SHARED', 'Esta manutenção já tem uma parcela ativa deste custo. Anule-a antes de corrigir.');
  const used = budget(a.maintenanceShares), parentDurationMs = duration(a), calc = calculation(a.amountCents, parentDurationMs, used, w.record.durationMs);
  if (!calc) return refused('MAINTENANCE_SHARE_BUDGET', 'O intervalo não permite atribuir um custo positivo em cêntimos dentro do tempo e valor restantes da visita.');
  const allocationBefore = allocationFacts(a), value = { ...period, ...(w.revision?{workTimeRevision:w.revision.proof}:{}), basis, expenseId: expense.id, expenseVersion: expense.version, allocationId, completionId, allocationBefore, allocationHash: r.hash(allocationBefore), parentDurationMs, used, workTime: w.record, workTimeHash: r.hash(w.record), target, ...calc };
  const p = { available: true, ...value, hash: r.hash(value) };
  if (!await validPreview(p)) return refused('MAINTENANCE_SHARE_REVIEW', 'As provas da repartição precisam de revisão.');
  return json(p);
}
async function reminderPreview(db, expense, a, reminderId) {
  const view = await reminders.current(db, reminderId), target = view.target, workTime = view.workTime;
  if (!view.valid || !workTime || target.clientId !== a.clientId || target.snapshot.originVisitType !== a.targetType || target.snapshot.originVisitId !== parentId(a)) return refused('REMINDER_RESOURCES_REVIEW', 'Confirme a associação e o tempo próprio do lembrete nesta visita.');
  let period; try { period = periods.sharePeriod(a, target, view.resources.event.preview.schema + 1); } catch (error) { return refused('MAINTENANCE_PERIOD_REVIEW', error.message); }
  if (live(a.maintenanceShares).some(s => s.share.reminderId === reminderId)) return refused('MAINTENANCE_ALREADY_SHARED', 'Este lembrete já tem uma parcela ativa deste custo. Anule-a antes de corrigir.');
  const used = budget(a.maintenanceShares), parentDurationMs = duration(a), calc = calculation(a.amountCents, parentDurationMs, used, workTime.durationMs);
  if (!calc) return refused('MAINTENANCE_SHARE_BUDGET', 'O tempo declarado tem de caber na duração e no valor ainda disponíveis da visita.');
  const allocationBefore = allocationFacts(a), value = { ...period, basis, expenseId: expense.id, expenseVersion: expense.version, allocationId: a.id, completionId: null, reminderId, allocationBefore, allocationHash: r.hash(allocationBefore), parentDurationMs, used, workTime, workTimeHash: r.hash(workTime), ...reminders.evidence(view), target, ...calc };
  try { return json(await reminders.rules.verify({ available: true, ...value, hash: r.hash(value) }, r.hash)); } catch (_) { return refused('MAINTENANCE_SHARE_REVIEW', 'As provas da repartição precisam de revisão.'); }
}
async function hasActive(db, allocations) {
  const states = await journal(db, [...new Set(allocations.map(a => a.expenseId))]);
  return allocations.some(a => { const s = states.get(a.expenseId); return s.review || live(s.records).some(row => row.share.allocationId === a.id); });
}
async function apply(db, who, env, expense) {
  const d = env.data, create = env.command === commands[0];
  r.object(d, create ? ['allocationId','completionId','reminderId','amountCents','previewHash','reason','confirmed'] : ['allocationId','shareId','shareHash','reason','confirmed']);
  r.id(d.allocationId); const reason = r.text(d.reason, 500, true);
  if (d.confirmed !== true) r.fail('Reveja e confirme a repartição.');
  let result;
  if (create) {
    const reminderMode = d.reminderId !== undefined; if (reminderMode && d.completionId !== undefined) r.fail('Escolha apenas um destino para a parcela.');
    r.id(reminderMode ? d.reminderId : d.completionId); r.money(d.amountCents); if (!sha(d.previewHash)) r.fail('Consulte o cálculo antes de confirmar.');
    const p = await preview(db, expense, d.allocationId, reminderMode ? d.reminderId : d.completionId, true, reminderMode); if (!p.available) return p;
    if (p.hash !== d.previewHash || p.amountCents !== d.amountCents) return refused('PREVIEW_CHANGED', 'A repartição mudou. Consulte e confirme novamente o cálculo.');
    const share = { schema: 1, id: env.requestId, expenseId: expense.id, allocationId: d.allocationId, completionId: reminderMode ? null : d.completionId, ...(reminderMode ? { reminderId: d.reminderId } : {}), preview: p, reason, createdAt: new Date().toISOString(), createdById: who.id };
    result = { share, shareHash: r.hash(share) };
  } else {
    if (typeof d.shareId !== 'string' || !/^[0-9a-f-]{36}$/.test(d.shareId) || !sha(d.shareHash)) r.fail('Consulte a parcela antes de anular.');
    let state = (await journal(db, [expense.id])).get(expense.id), row = state.records.find(s => s.share.id === d.shareId && s.share.allocationId === d.allocationId);
    if (row) { const a = row.share.preview.allocationBefore; await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ 'maintenance-material-share:' + a.targetType + ':' + parentId(a) }))::text`; state = (await journal(db, [expense.id])).get(expense.id); row = state.records.find(s => s.share.id === d.shareId && s.share.allocationId === d.allocationId); }
    if (state.review || !row || row.voidedAt || row.hash !== d.shareHash) return refused('MAINTENANCE_SHARE_STATE', 'A parcela mudou, está anulada ou o histórico precisa de revisão.');
    result = { share: row.share, shareHash: row.hash, voidedAt: new Date().toISOString() };
  }
  const updated = await db.companyExpense.update({ where: { id: expense.id }, data: { version: { increment: 1 } } });
  // ExpenseEvent is written by the enclosing command transaction. Failure of
  // either the version update or the receipt rolls this operation back in full.
  return { applied: true, expenseId: expense.id, version: updated.version, ...result, reason };
}
module.exports = { commands, basis, fields, allocationFacts, validPreview, journal, decorate, project, candidates, preview, hasActive, apply };
