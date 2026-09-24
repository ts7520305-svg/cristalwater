'use strict';
// Associated resources are read through their existing verifier. Financial
// shares refer to the original receipt; they never become independent costs.
const r = require('./expenseLedgerRules');
const rules = require('../../frontend/cw-reminder-visit-cost-rules');
const resources = require('./reminderVisitResourceService');
const journal = require('./reminderVisitResourceJournal');
async function current(db, reminderId, lock = false) {
  const c = await resources.context(db, reminderId, lock), row = c.active?.[0];
  if (!c.available || !c.peersValid || !c.journalValid || row?.state !== 'CONFIRMED') return { id: reminderId, valid: false, label: c.title || 'Lembrete #' + reminderId };
  const proof = row.result, p = proof.event.preview, data = p.selection.data;
  const target = await rules.target(proof, r.hash, c.clientName);
  const source = { schema: 1, basis: 'CURRENT_ASSOCIATED_REMINDER_RESOURCES', resourceId: row.id, resourceHash: row.hash, parent: c.parent, peers: c.peers, movements: c.movements, comparison: journal.rules.compare(data, c.parent, c.peers, c.movements) };
  const workTime = data.workTime ? { schema: 1, basis: 'DECLARED_REMINDER_VISIT_WORK_INTERVAL', startAt: data.workTime.startedAt, endAt: data.workTime.endedAt, durationMs: Date.parse(data.workTime.endedAt) - Date.parse(data.workTime.startedAt), origin: p.origin } : null;
  return { id: reminderId, valid: true, label: target.label, target, resources: proof, resourcesHash: row.hash, resourceSource: source, resourceSourceHash: r.hash(source), materials: data.materials, workTime };
}
async function read(db, ids) {
  const views = new Map();
  for (const id of [...new Set(ids)]) views.set(id, await current(db, id));
  return views;
}
async function candidates(db, allocation, page) {
  const type = allocation.targetType, id = type === 'REGULAR' ? allocation.visitId : allocation.extraVisitId;
  const parent = await require('./reminderVisitService').parent(db, type, id);
  if (!parent) return { total: 0, rows: [] };
  const states = await journal.forParent(db, parent, type);
  const links = await require('./reminderVisitJournal').read(db, [...states.keys()]);
  const ids = [...links].filter(([, s]) => { const p = s.active?.result.event.preview.parent; return p?.type === type && p.id === id; }).map(([id]) => id).sort((a, b) => b - a);
  return { total: ids.length, rows: [...(await read(db, ids.slice((page - 1) * 10, page * 10))).values()] };
}
function evidence(view) {
  return { resources: view.resources, resourcesHash: view.resourcesHash, resourceSource: view.resourceSource, resourceSourceHash: view.resourceSourceHash };
}
async function activeShares(db, reminderId) {
  const material = await require('./maintenanceMaterialShareService').journal(db), labor = require('./maintenanceLaborShareService');
  const expenses = await db.expenseEvent.findMany({ where: { command: { in: labor.commands }, expenseId: { not: null } }, distinct: ['expenseId'], select: { expenseId: true } });
  const states = [...(await labor.journal(db, expenses.map(e => e.expenseId))).values()];
  const all = [...material.records.map(s => ({ ...s, kind: 'MATERIAL' })), ...states.flatMap(s => s.records.map(row => ({ ...row, kind: 'LABOR' })))];
  return { valid: !material.review && !states.some(s => s.review), rows: all.filter(s => !s.voidedAt && s.share.reminderId === reminderId).map(s => ({ shareId: s.share.id, shareHash: s.hash, reminderId, kind: s.kind, expenseId: s.share.expenseId, allocationId: s.share.allocationId, amountCents: s.share.preview.amountCents })).sort((a, b) => a.shareId.localeCompare(b.shareId)) };
}
module.exports = { rules, current, read, candidates, evidence, activeShares };
