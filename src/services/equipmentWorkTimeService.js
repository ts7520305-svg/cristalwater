'use strict';
const recorded = require('./recordedWorkTimeService');
const { hash } = require('./fieldWriteRequestService');
const basis = 'DECLARED_EQUIPMENT_WORK_INTERVAL';
const positive = n => Number.isSafeInteger(n) && n > 0;
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function valid(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && instant(value.startAt) && instant(value.endAt) && Date.parse(value.endAt) > Date.parse(value.startAt);
}
function parse(value) {
  if (!valid(value)) throw Object.assign(new Error('Indique início e fim válidos para o trabalho, com o fim posterior ao início.'), { status: 400 });
  return { startAt: value.startAt, endAt: value.endAt };
}
function origin(visit, visitType) {
  return { visitType, visitId: visit.id, poolId: visit.poolId, clientId: visit.clientId, technicianId: visit.technicianId, visitStartAt: visit.startAt?.toISOString() || null };
}
function create(input, visit, visitType) {
  return { schema: 1, basis, ...input, durationMs: Date.parse(input.endAt) - Date.parse(input.startAt), origin: origin(visit, visitType) };
}
function time(row) { return row.result?.completion?.workTime; }
const selection = { id: true, requestId: true, planId: true, fingerprint: true, completedAt: true, result: true };
async function receipts(db, rows) {
  const ids = rows.map(row => row.requestId);
  return new Map((ids.length ? await db.fieldWriteRequest.findMany({ where: { scope: 'EQUIPMENT_MAINTENANCE', requestId: { in: ids } }, select: { owner: true, requestId: true, resourceId: true, payloadHash: true, response: true } }) : []).filter(r => r.response?.applied === true && positive(r.response.completion?.id)).map(r => [r.requestId + ':' + r.response.completion.id, r]));
}
function intact(row, proofs) {
  const saved = proofs.get(row.requestId + ':' + row.id);
  return !!saved && saved.resourceId === row.planId && saved.payloadHash === row.fingerprint && saved.response?.applied === true && saved.response.completion?.id === row.id && hash(saved.response) === hash(row.result);
}
const hadTime = (row, proofs) => time(row) || proofs.get(row.requestId + ':' + row.id)?.response?.completion?.workTime;
function sound(record) {
  return !!record && record.schema === 1 && record.basis === basis && valid({ startAt: record.startAt, endAt: record.endAt }) && record.durationMs === Date.parse(record.endAt) - Date.parse(record.startAt) && positive(record.origin?.technicianId);
}
function overlaps(a, b) { return Date.parse(a.startAt) < Date.parse(b.endAt) && Date.parse(b.startAt) < Date.parse(a.endAt); }
function within(input, visit, completedAt) {
  return positive(visit.technicianId) && visit.startAt instanceof Date && Date.parse(input.startAt) >= +visit.startAt && Date.parse(input.endAt) <= +completedAt && (!visit.endAt || Date.parse(input.endAt) <= +visit.endAt);
}
async function conflict(db, input, visit, visitType) {
  return (await recorded.conflicts(db, [{ type: visitType, id: visit.id, technicianId: visit.technicianId, startAt: new Date(input.startAt), endAt: new Date(input.endAt) }])).size > 0;
}
async function check(db, input, visit, visitType, completedAt) {
  if (!within(input, visit, completedAt)) return 'O tempo da revisão tem de ficar dentro da visita iniciada, com técnico atribuído, e não pode terminar no futuro.';
  // The caller holds the parent visit lock, serializing every plan in this visit.
  const rows = await db.equipmentMaintenanceCompletion.findMany({ where: visitType === 'EXTRA' ? { extraVisitId: visit.id } : { visitId: visit.id }, select: selection }), proofs = await receipts(db, rows);
  if (rows.some(row => hadTime(row, proofs) && (!sound(time(row)) || !intact(row, proofs) || overlaps(input, time(row))))) return 'Já existe tempo registado noutra revisão desta visita. Reveja os intervalos antes de confirmar.';
  if (await conflict(db, input, visit, visitType)) return 'O técnico tem tempo registado em simultâneo noutro serviço. Reveja os horários antes de confirmar.';
  return null;
}
async function describe(db, rows, visit, visitType) {
  const expected = origin(visit, visitType), views = new Map(), proofs = await receipts(db, rows);
  const candidates = rows.filter(row => sound(time(row))), conflicts = await recorded.conflicts(db, candidates.map(row => ({ type: visitType, id: visit.id, technicianId: time(row).origin.technicianId, startAt: new Date(time(row).startAt), endAt: new Date(time(row).endAt) })));
  for (const row of rows) {
    const record = time(row);
    if (!record) { views.set(row.id, { state: hadTime(row, proofs) ? 'REVIEW' : 'MISSING', record: null }); continue; }
    const review = !sound(record) || !intact(row, proofs) || Object.entries(expected).some(([key, value]) => record.origin?.[key] !== value) || !within(record, visit, row.completedAt) || rows.some(other => other.id !== row.id && time(other) && (!sound(time(other)) || overlaps(record, time(other)))) || conflicts.has(visitType + ':' + visit.id);
    views.set(row.id, { state: review ? 'REVIEW' : 'RECORDED', record });
  }
  return views;
}
module.exports = { parse, create, check, describe, selection };
