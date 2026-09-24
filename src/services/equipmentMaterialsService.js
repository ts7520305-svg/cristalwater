'use strict';
const { hash } = require('./fieldWriteRequestService');
const { quantity, decimal } = require('./expenseValuationSources');
const { normalizeProductName, normalizeUnit } = require('../utils/stockNormalizer');
const { isCompletedVisitStatus } = require('./operationalValueReportService');
const basis = 'DECLARED_EQUIPMENT_MATERIALS';
const positive = n => Number.isSafeInteger(n) && n > 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, fields) => object(value) && Object.keys(value).length === fields.length && fields.every(k => Object.hasOwn(value, k));
const productKey = item => JSON.stringify([normalizeProductName(item.productName), normalizeUnit(item.unit, '')]);
const selection = { id: true, planId: true, requestId: true, fingerprint: true, completedAt: true, result: true };
const movementSelection = { id: true, movementType: true, productId: true, productName: true, unit: true, quantity: true, visitId: true, extraVisitId: true, poolId: true, clientId: true, technicianId: true, createdAt: true };
function parse(value) {
  const invalid = () => { throw Object.assign(Error('Indique materiais distintos, produto, unidade e quantidade positiva (até 100000, com no máximo seis casas decimais), ou confirme sem materiais.'), { status: 400 }); };
  if (!keys(value, ['mode', 'items']) || !['NONE', 'DECLARED'].includes(value.mode) || !Array.isArray(value.items) || value.items.length > 20 || (value.mode === 'NONE' ? value.items.length !== 0 : value.items.length === 0)) invalid();
  const seen = new Set();
  const items = value.items.map(item => {
    if (!keys(item, ['productName', 'unit', 'quantity']) || typeof item.productName !== 'string' || item.productName.length > 160 || typeof item.unit !== 'string' || item.unit.length > 24 || typeof item.quantity !== 'string') invalid();
    const n = quantity(item.quantity), productName = normalizeProductName(item.productName), unit = normalizeUnit(item.unit, '');
    if (!productName || !unit || n === null || n <= 0n || n > 100000000000n) invalid();
    const key = productKey({ productName, unit }); if (seen.has(key)) invalid(); seen.add(key);
    return { productName, unit, quantity: decimal(n) };
  });
  return { mode: value.mode, items };
}
function origin(visit, visitType) {
  return { visitType, visitId: visit.id, poolId: visit.poolId, clientId: visit.clientId, technicianId: visit.technicianId };
}
function create(input, visit, visitType) {
  if (![visit.id, visit.poolId, visit.clientId, visit.technicianId].every(positive)) throw Object.assign(Error('Confirme o cliente, a piscina e o técnico da visita antes de declarar materiais.'), { status: 400 });
  return { schema: 1, basis, ...input, origin: origin(visit, visitType) };
}
function sound(record) {
  try {
    return keys(record, ['schema', 'basis', 'mode', 'items', 'origin']) && record.schema === 1 && record.basis === basis && hash(parse({ mode: record.mode, items: record.items })) === hash({ mode: record.mode, items: record.items }) && keys(record.origin, ['visitType', 'visitId', 'poolId', 'clientId', 'technicianId']) && ['REGULAR', 'EXTRA'].includes(record.origin.visitType) && ['visitId', 'poolId', 'clientId', 'technicianId'].every(k => positive(record.origin[k]));
  } catch (_) { return false; }
}
const recordOf = row => row.result?.completion?.materials;
function receiptFor(row, receipts) {
  return receipts.filter(p => p.requestId === row.requestId && p.response?.completion?.id === row.id);
}
function intact(row, receipts) {
  const matches = receiptFor(row, receipts), proof = matches[0], c = row.result?.completion, r = row.result?.receipt;
  return matches.length === 1 && proof.resourceId === row.planId && proof.payloadHash === row.fingerprint && proof.owner === r?.owner && r?.scope === 'EQUIPMENT_MAINTENANCE' && r.requestId === row.requestId && r.resourceId === row.planId && r.payloadHash === row.fingerprint && row.result?.applied === true && c?.planId === row.planId && c.requestId === row.requestId && c.completedAt === row.completedAt.toISOString() && hash(proof.response) === hash(row.result);
}
function assess(rows, visit, visitType, receipts, movements) {
  const expected = origin(visit, visitType), views = new Map(), totals = new Map();
  let siblingsInvalid = false;
  for (const row of rows) {
    const record = recordOf(row), hadRecord = Object.hasOwn(row.result?.completion || {}, 'materials') || receiptFor(row, receipts).some(p => Object.hasOwn(p.response.completion, 'materials'));
    if (!hadRecord) { views.set(row.id, { state: 'MISSING', record: null, comparison: null, reasons: [] }); continue; }
    const valid = sound(record) && intact(row, receipts) && hash(record.origin) === hash(expected);
    views.set(row.id, { state: valid ? record.mode === 'NONE' ? 'NONE' : 'DECLARED' : 'REVIEW', record: record || null, comparison: null, reasons: valid ? [] : ['DECLARATION_OR_ORIGIN_CHANGED'] });
    if (!valid) { siblingsInvalid = true; continue; }
    for (const item of record.items) {
      const key = productKey(item); totals.set(key, (totals.get(key) || 0n) + quantity(item.quantity));
    }
  }
  const closed = isCompletedVisitStatus(visit.status) && visit.endAt instanceof Date && Number.isFinite(+visit.endAt);
  const open = !!visit.startAt && !visit.endAt && ['IN_PROGRESS', 'STARTED', 'ON_ROUTE', 'INCOMPLETE', 'PENDING', 'PLANNED', 'ASSIGNED', 'SCHEDULED'].includes(String(visit.status).toUpperCase());
  for (const row of rows) {
    const view = views.get(row.id);
    if (view.state !== 'DECLARED') continue;
    const reasons = new Set();
    if (siblingsInvalid) reasons.add('SIBLING_DECLARATION_REVIEW');
    if (!closed && !open) reasons.add('VISIT_STATE');
    if (!visit.startAt || +row.completedAt < +visit.startAt) reasons.add('VISIT_DATES');
    if (!closed) {
      if (reasons.size) Object.assign(view, { state: 'REVIEW', reasons: [...reasons] });
      continue;
    }
    const lines = [], sourceMovements = new Map();
    if (!visit.startAt || +visit.endAt < +row.completedAt || +visit.endAt < +visit.startAt) reasons.add('VISIT_DATES');
    for (const item of view.record.items) {
      const key = productKey(item), selected = movements.filter(m => productKey(m) === key), ids = new Set(); let net = 0n;
      for (const m of selected) {
        sourceMovements.set(m.id, { ...m, createdAt: m.createdAt.toISOString() });
        if (m.productId !== null) ids.add(m.productId);
        const type = String(m.movementType).trim().toUpperCase(), n = quantity(m.quantity);
        if (!['CONSUMPTION', 'RETURN', 'EMERGENCY_DISTRIBUTED_CONSUMPTION'].includes(type) || n === null || n <= 0n || (visitType === 'REGULAR' ? m.visitId !== visit.id || m.extraVisitId !== null : m.extraVisitId !== visit.id || m.visitId !== null) || m.clientId !== null && m.clientId !== visit.clientId || m.poolId !== null && m.poolId !== visit.poolId || m.technicianId !== null && m.technicianId !== visit.technicianId || +m.createdAt < +visit.startAt) { reasons.add('MOVEMENT_REVIEW'); continue; }
        net += type === 'RETURN' ? -n : n;
      }
      if (ids.size > 1 || [...ids].some(id => !positive(id))) reasons.add('PRODUCT_IDENTITY');
      if (!selected.length || net <= 0n) reasons.add('NO_POSITIVE_NET_CONSUMPTION');
      const declared = totals.get(key);
      if (net < declared) reasons.add('DECLARATIONS_EXCEED_NET_CONSUMPTION');
      lines.push({ ...item, visitQuantity: net >= 0n ? decimal(net) : null, declaredMaintenanceQuantity: decimal(declared), unassignedQuantity: net >= declared ? decimal(net - declared) : null });
    }
    const source = { schema: 1, basis: 'CURRENT_NET_VISIT_CONSUMPTION', visit: { ...expected, status: visit.status, startAt: visit.startAt?.toISOString() || null, endAt: visit.endAt.toISOString() }, declarations: rows.filter(r => recordOf(r)).map(r => ({ id: r.id, fingerprint: r.fingerprint, materials: recordOf(r) })).sort((a, b) => a.id - b.id), movements: [...sourceMovements.values()].sort((a, b) => a.id - b.id) };
    view.comparison = { lines, source, sourceHash: hash(source) };
    view.state = reasons.size ? 'REVIEW' : 'MATCHED'; view.reasons = [...reasons];
  }
  return views;
}
async function describe(db, rows, visit, visitType) {
  const [receipts, movements] = await Promise.all([
    rows.length ? db.fieldWriteRequest.findMany({ where: { scope: 'EQUIPMENT_MAINTENANCE', requestId: { in: rows.map(r => r.requestId) } }, select: { owner: true, requestId: true, resourceId: true, payloadHash: true, response: true } }) : [],
    rows.length ? db.stockMovement.findMany({ where: visitType === 'EXTRA' ? { extraVisitId: visit.id } : { visitId: visit.id }, select: movementSelection, orderBy: { id: 'asc' } }) : []
  ]);
  return assess(rows, visit, visitType, receipts, movements);
}
module.exports = { parse, create, sound, describe, assess, selection };
