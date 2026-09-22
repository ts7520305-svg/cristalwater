'use strict';
const { period, isCompletedVisitStatus } = require('./operationalValueReportService');
const { quantity } = require('./expenseValuationSources');
const { normalizeProductName, normalizeUnit } = require('../utils/stockNormalizer');
const normalize = value => String(value || '').trim().toUpperCase();
const stockTypes = new Set(['CONSUMPTION', 'RETURN', 'EMERGENCY_DISTRIBUTED_CONSUMPTION']);
const visitKey = (type, id) => type + ':' + id;
const productKey = (name, unit) => JSON.stringify([normalizeProductName(name), normalizeUnit(unit, '')]);
const visitSelect = { id:true, clientId:true, poolId:true, technicianId:true, status:true, startAt:true, endAt:true };
const sample = rows => ({ total:rows.length, limit:10, sampleOnly:rows.length > 10, rows:rows.slice(0,10) });

// The caller supplies decorated expenses from the same RepeatableRead transaction.
// This describes gaps in recorded evidence; it cannot certify complete company costs.
async function build(db, monthRef, generatedAt, expenses) {
  const { start, end } = period({ monthRef }), between = { gte:start, lt:end };
  const [purchases, maintenance, regular, extras, undatedRegular, undatedExtras] = await Promise.all([
    db.stockPurchase.findMany({ select:{ id:true, supplierName:true, invoiceDate:true, status:true }, orderBy:{ id:'asc' } }),
    db.vehicleMaintenanceRecord.findMany({ select:{ id:true, title:true, completedAt:true, status:true }, orderBy:{ id:'asc' } }),
    db.serviceVisit.findMany({ where:{ endAt:between }, select:visitSelect, orderBy:{ id:'asc' } }),
    db.extraVisit.findMany({ where:{ endAt:between }, select:visitSelect, orderBy:{ id:'asc' } }),
    db.serviceVisit.findMany({ where:{ endAt:null, OR:[{ plannedDate:between }, { plannedDate:null, date:between }] }, select:visitSelect, orderBy:{ id:'asc' } }),
    db.extraVisit.findMany({ where:{ endAt:null, scheduledAt:between }, select:visitSelect, orderBy:{ id:'asc' } })
  ]);
  const sourceIssues = [], serviceIssues = [];
  const registered = new Map(expenses.filter(e => e.sourceType !== 'MANUAL').map(e => [visitKey(e.sourceType, e.stockPurchaseId || e.maintenanceId), e]));
  function sources(type, records) {
    const counts = { total:records.length, linked:0, unlinked:0, review:0, excluded:0, undated:0 };
    for (const row of records) {
      const status = normalize(row.status), stock = type === 'STOCK_PURCHASE';
      if (['CANCELLED', 'CANCELED', 'VOID', 'DRAFT', 'PENDING', 'PLANNED', 'IN_PROGRESS', 'SKIPPED'].includes(status)) { counts.excluded++; continue; }
      const known = stock ? ['POSTED', 'RECEIVED'].includes(status) : isCompletedVisitStatus(status);
      const expense = registered.get(visitKey(type, row.id)), dated = stock ? row.invoiceDate : row.completedAt;
      if (!dated) counts.undated++;
      const reason = !known ? 'UNKNOWN_SOURCE_STATUS' : expense?.cancelledAt ? 'CANCELLED_EXPENSE' : expense?.needsReview ? 'SOURCE_OR_EXPENSE_REVIEW' : !expense ? 'NO_EXPENSE_LINK' : !dated ? 'MISSING_SOURCE_DATE' : null;
      if (!reason) counts.linked++;
      else {
        counts[reason === 'NO_EXPENSE_LINK' ? 'unlinked' : 'review']++;
        sourceIssues.push({ type, id:row.id, label:String(stock ? row.supplierName || 'Compra de stock' : row.title), expenseId:expense?.id || null, reason, undated:!dated });
      }
    }
    return counts;
  }
  const sourceCounts = { stock:sources('STOCK_PURCHASE', purchases), vehicles:sources('VEHICLE_MAINTENANCE', maintenance) };
  const datedVisits = [...regular.map(v => ({ ...v, type:'REGULAR' })), ...extras.map(v => ({ ...v, type:'EXTRA' }))];
  const visits = datedVisits.filter(v => isCompletedVisitStatus(v.status));
  const selected = new Map(visits.map(v => [visitKey(v.type, v.id), v]));
  const regularIds = visits.filter(v => v.type === 'REGULAR').map(v => v.id), extraIds = visits.filter(v => v.type === 'EXTRA').map(v => v.id);
  // Returns recorded after the selected month still affect today's net consumption.
  const movements = await db.stockMovement.findMany({ where:{ OR:[{ visitId:{ in:regularIds } }, { extraVisitId:{ in:extraIds } }, { createdAt:between }] },
    select:{ id:true, movementType:true, productId:true, productName:true, unit:true, quantity:true, visitId:true, extraVisitId:true, clientId:true, poolId:true, createdAt:true }, orderBy:{ id:'asc' } });
  const [referencedRegular, referencedExtra] = await Promise.all([
    db.serviceVisit.findMany({ where:{ id:{ in:[...new Set(movements.map(m=>m.visitId).filter(Boolean))] } }, select:{ id:true } }),
    db.extraVisit.findMany({ where:{ id:{ in:[...new Set(movements.map(m=>m.extraVisitId).filter(Boolean))] } }, select:{ id:true } })
  ]);
  const existing = new Set([...referencedRegular.map(v=>visitKey('REGULAR',v.id)), ...referencedExtra.map(v=>visitKey('EXTRA',v.id))]);
  const byVisit = new Map(visits.map(v => [visitKey(v.type, v.id), { groups:new Map(), allocations:[], invalid:false }]));
  let unassignedMovementCount = 0;
  for (const m of movements) {
    if (!stockTypes.has(normalize(m.movementType))) continue;
    const key = m.visitId && !m.extraVisitId ? visitKey('REGULAR', m.visitId) : m.extraVisitId && !m.visitId ? visitKey('EXTRA', m.extraVisitId) : null;
    const entry = byVisit.get(key), visit = selected.get(key);
    if (!entry) {
      // A movement linked to a different month's visit is outside this denominator.
      if ((!key || !existing.has(key)) && m.createdAt >= start && m.createdAt < end) unassignedMovementCount++;
      if (m.visitId && m.extraVisitId) for (const k of [visitKey('REGULAR',m.visitId),visitKey('EXTRA',m.extraVisitId)]) if (byVisit.has(k)) byVisit.get(k).invalid = true;
      continue;
    }
    const p = productKey(m.productName, m.unit);
    if (!entry.groups.has(p)) entry.groups.set(p, { net:0n, valued:0n, invalid:false, ids:new Set() });
    const group = entry.groups.get(p), q = quantity(m.quantity);
    if (m.productId) group.ids.add(m.productId);
    if (q === null || q <= 0n || !normalizeProductName(m.productName) || !normalizeUnit(m.unit,'') || !visit.clientId || m.clientId && m.clientId !== visit.clientId || m.poolId && m.poolId !== visit.poolId) group.invalid = true;
    else group.net += normalize(m.movementType) === 'RETURN' ? -q : q;
  }
  for (const expense of expenses) for (const a of expense.allocations) {
    if (a.voidedAt || a.valuationType === 'MANUAL') continue;
    const entry = byVisit.get(visitKey(a.targetType, a.targetType === 'REGULAR' ? a.visitId : a.extraVisitId));
    if (!entry) continue;
    entry.allocations.push(a);
    if (a.valuationType !== 'MATERIAL') continue;
    const item = a.valuationSnapshot?.source?.item;
    const key = productKey(item?.productName, item?.unit);
    if (!entry.groups.has(key)) entry.groups.set(key, { net:0n, valued:0n, invalid:true, ids:new Set() });
    const group = entry.groups.get(key), q = quantity(a.quantity);
    if (item?.productId) group.ids.add(item.productId);
    if (a.needsReview || q === null || q <= 0n) group.invalid = true;
    else group.valued += q;
  }
  const labor = { total:visits.length, valued:0, missing:0, review:0 };
  const materials = { total:0, valued:0, partial:0, missing:0, review:0, zeroNet:0 };
  let noMaterialRecordVisits = 0;
  for (const visit of visits) {
    const entry = byVisit.get(visitKey(visit.type,visit.id)), reasons = [];
    const allocations = entry.allocations.filter(a => a.valuationType === 'LABOR');
    const duration = visit.startAt ? visit.endAt - visit.startAt : NaN;
    const valid = visit.clientId && visit.technicianId && Number.isSafeInteger(duration) && duration > 0;
    const laborState = !valid || allocations.length > 1 || allocations.some(a => a.needsReview || quantity(a.quantity) !== BigInt(duration) * 1000n) ? 'review' : allocations.length ? 'valued' : 'missing';
    labor[laborState]++;
    if (laborState !== 'valued') reasons.push('LABOR_' + laborState.toUpperCase());
    if (!entry.groups.size && !entry.invalid) { noMaterialRecordVisits++; reasons.push('NO_MATERIAL_RECORD'); }
    if (entry.invalid) reasons.push('MATERIAL_REVIEW');
    for (const group of entry.groups.values()) {
      materials.total++;
      const state = group.invalid || group.ids.size > 1 || group.net < 0n || group.valued > group.net ? 'review' : group.net === 0n ? 'zeroNet' : group.valued === group.net ? 'valued' : group.valued > 0n ? 'partial' : 'missing';
      materials[state]++;
      if (['review','partial','missing'].includes(state)) reasons.push('MATERIAL_' + state.toUpperCase());
    }
    if (reasons.length) serviceIssues.push({ type:visit.type, id:visit.id, clientId:visit.clientId, reasons:[...new Set(reasons)] });
  }
  const undated = [...undatedRegular.map(v => ({ ...v, type:'REGULAR' })), ...undatedExtras.map(v => ({ ...v, type:'EXTRA' }))].filter(v => isCompletedVisitStatus(v.status));
  for (const visit of undated) serviceIssues.push({ type:visit.type, id:visit.id, clientId:visit.clientId, reasons:['MISSING_COMPLETION_DATE'] });
  return { version:1, monthRef, generatedAt:generatedAt.toISOString(), state:'PARTIAL', completeOperatingCosts:false, profit:null, limitApplied:null,
    basis:{ sources:'CURRENT_SOURCE_LINKS_ALL_MONTHS', services:'COMPLETED_VISIT_END_AT_UTC', materials:'CURRENT_NET_CONSUMPTION_PER_VISIT_PRODUCT_UNIT', undated:'PLANNED_MONTH_WITHOUT_END_AT' },
    sources:sourceCounts, labor, materials, noMaterialRecordVisits, undatedCompleted:undated.length, excludedVisitCount:datedVisits.length-visits.length, unassignedMovementCount,
    sourceIssues:sample(sourceIssues), serviceIssues:sample(serviceIssues) };
}
module.exports = { build };
