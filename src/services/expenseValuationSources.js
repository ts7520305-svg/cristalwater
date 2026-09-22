'use strict';
const r = require('./expenseLedgerRules');
const { normalizeProductName, normalizeUnit } = require('../utils/stockNormalizer');
const { isCompletedVisitStatus } = require('./operationalValueReportService');
const scale = 1000000n, max = 999999999999999999n;
const quantity = value => {
  if (typeof value === 'number') {
    const scaled = Math.round(value * 1e6);
    if (!Number.isFinite(value) || !Number.isSafeInteger(scaled) || Math.abs(value * 1e6 - scaled) > 0.00001) return null;
    value = value.toFixed(6);
  } else if (value && typeof value === 'object') value = value.toString();
  if (typeof value !== 'string' || !/^\d{1,12}(\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.'), n = BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'));
  return n <= max ? n : null;
};
const decimal = n => (n / scale).toString() + (n % scale ? '.' + (n % scale).toString().padStart(6, '0').replace(/0+$/, '') : '');
const round = (n, d) => (2n * n + d) / (2n * d);
const visitSelect = { id: true, clientId: true, poolId: true, technicianId: true, status: true, startAt: true, endAt: true };
const movementSelect = { id: true, movementType: true, productId: true, productName: true, unit: true, quantity: true, visitId: true, extraVisitId: true, clientId: true, poolId: true, createdAt: true };
const itemSelect = { id: true, purchaseId: true, productId: true, productName: true, unit: true, quantity: true, unitCost: true, totalCost: true, lot: true, purchase: { select: { status: true, invoiceDate: true, totalAmount: true } } };
const measurementKey = (type, id) => type + ':' + id;
const targetId = a => a.targetType === 'REGULAR' ? a.visitId : a.extraVisitId;
const selected = a => ({ kind: a.valuationType, expenseId: a.expenseId, targetType: a.targetType, targetId: targetId(a), purchaseItemId: a.purchaseItemId });
function laborBasis(b) { return b ? { id: b.id, expenseId: b.expenseId, technicianId: b.technicianId, periodStart: r.day(b.periodStart), periodEnd: r.day(b.periodEnd), paidMinutes: b.paidMinutes } : null; }
async function prepare(db, allocations, extra = []) {
  const selections = [...allocations.filter(a => a.valuationType !== 'MANUAL').map(selected), ...extra];
  if (!selections.length) return { regular: new Map(), extra: new Map(), items: new Map(), movements: [], active: [] };
  const ids = type => [...new Set(selections.filter(s => s.targetType === type).map(s => s.targetId))];
  const regularIds = ids('REGULAR'), extraIds = ids('EXTRA'), itemIds = [...new Set(selections.map(s => s.purchaseItemId).filter(Boolean))];
  const laborExpenseIds = [...new Set(selections.filter(s => s.kind === 'LABOR').map(s => s.expenseId).filter(Boolean))];
  const [regular, extras, items, movements, active] = await Promise.all([
    db.serviceVisit.findMany({ where: { id: { in: regularIds } }, select: visitSelect }),
    db.extraVisit.findMany({ where: { id: { in: extraIds } }, select: visitSelect }),
    db.stockPurchaseItem.findMany({ where: { id: { in: itemIds } }, select: itemSelect }),
    db.stockMovement.findMany({ where: { OR: [{ visitId: { in: regularIds } }, { extraVisitId: { in: extraIds } }] }, select: movementSelect, orderBy: { id: 'asc' } }),
    db.expenseAllocation.findMany({ where: { voidedAt: null, valuationType: { not: 'MANUAL' }, OR: [{ visitId: { in: regularIds } }, { extraVisitId: { in: extraIds } }, { purchaseItemId: { in: itemIds } }, { expenseId: { in: laborExpenseIds } }] }, select: { id: true, expenseId: true, valuationType: true, valuationKey: true, purchaseItemId: true, quantity: true, amountCents: true, activeMeasurementKey: true, valuationSnapshot: true } })
  ]);
  return { regular: new Map(regular.map(v => [v.id, v])), extra: new Map(extras.map(v => [v.id, v])), items: new Map(items.map(v => [v.id, v])), movements, active };
}
function build(data, expense, selection) {
  const { kind, targetType, targetId: id, purchaseItemId } = selection;
  const visit = (targetType === 'REGULAR' ? data.regular : data.extra).get(id);
  const errors = [], add = message => errors.push(message);
  if (!visit || !visit.clientId || !isCompletedVisitStatus(visit.status) || !visit.endAt) return { valid: false, errors: ['Confirme a conclusão, data e cliente registados diretamente no serviço.'] };
  const end = visit.endAt.getTime(), start = visit.startAt?.getTime();
  const service = { ...visit, startAt: visit.startAt?.toISOString() || null, endAt: visit.endAt.toISOString() };
  let key, units, totalQuantity, totalCents, snapshot, label;
  if (kind === 'MATERIAL') {
    const item = data.items.get(purchaseItemId);
    if (!item || expense.sourceType !== 'STOCK_PURCHASE' || item.purchaseId !== expense.stockPurchaseId || !['STOCK', 'MATERIAL'].includes(expense.category)) return { valid: false, errors: ['Escolha uma linha da compra ligada a esta despesa de materiais.'] };
    const product = normalizeProductName(item.productName), unit = normalizeUnit(item.unit, '');
    const movements = data.movements.filter(m => (targetType === 'REGULAR' ? m.visitId === id : m.extraVisitId === id) && ['CONSUMPTION', 'RETURN', 'EMERGENCY_DISTRIBUTED_CONSUMPTION'].includes(String(m.movementType).trim().toUpperCase()) && normalizeProductName(m.productName) === product && normalizeUnit(m.unit, '') === unit);
    if (!product || !unit || !movements.length) add('Não há consumo identificado deste produto e unidade neste serviço.');
    let net = 0n;
    const productIds = new Set([item.productId, ...movements.map(m => m.productId)].filter(Boolean));
    if (productIds.size > 1) add('Os identificadores dos produtos não coincidem; reveja a origem do consumo.');
    for (const m of movements) {
      const q = quantity(m.quantity);
      if (q === null || q <= 0n || m.visitId && m.extraVisitId || m.clientId && m.clientId !== visit.clientId || m.poolId && m.poolId !== visit.poolId) { add('Há movimentos com quantidade ou destinatário por confirmar.'); continue; }
      net += String(m.movementType).trim().toUpperCase() === 'RETURN' ? -q : q;
    }
    if (net <= 0n) add('O consumo líquido, depois das devoluções, tem de ser positivo.');
    totalQuantity = quantity(item.quantity); units = net;
    const lineCents = typeof item.totalCost === 'number' && Number.isFinite(item.totalCost) ? Math.round(item.totalCost * 100) : null;
    if (totalQuantity === null || totalQuantity <= 0n || !Number.isSafeInteger(lineCents) || lineCents <= 0 || lineCents > 2147483647 || !Number.isFinite(item.unitCost) || item.unitCost <= 0 || Math.round(item.quantity * item.unitCost * 100) !== lineCents) add('Confirme a quantidade, preço e total da linha da compra.');
    if (!item.purchase.invoiceDate || ['CANCELLED', 'CANCELED', 'VOID'].includes(String(item.purchase.status).trim().toUpperCase())) add('A compra precisa de data e estado válidos.');
    if (item.purchase.invoiceDate && item.purchase.invoiceDate.getTime() > end) add('A compra é posterior ao serviço. Reveja a origem histórica antes de valorizar.');
    totalCents = lineCents;
    key = r.hash({ kind, targetType, id, product, unit });
    snapshot = { version: 1, kind, service, item: { ...item, purchase: { ...item.purchase, invoiceDate: r.day(item.purchase.invoiceDate) } }, movements: movements.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })) };
    label = item.productName + ' · ' + unit + ' · Linha #' + item.id + (item.lot ? ' · Lote ' + item.lot : '');
    return { valid: !errors.length, errors, key, kind, monthRef: service.endAt.slice(0, 7), units, totalQuantity, totalCents, snapshot, hash: r.hash(snapshot), label, unit, visit, method: 'CONFIRMED_PURCHASE_LINE', measurement: measurementKey(targetType, id) };
  }
  const basis = laborBasis(expense.laborBasis);
  if (expense.category !== 'LABOR' || expense.sourceType !== 'MANUAL' || !basis || basis.technicianId !== visit.technicianId) return { valid: false, errors: ['Confirme a base de trabalho da despesa e o técnico deste serviço.'] };
  if (!Number.isFinite(start) || start >= end) add('O serviço precisa de início e fim válidos para apurar o tempo.');
  const from = Date.parse(basis.periodStart + 'T00:00:00Z'), until = Date.parse(basis.periodEnd + 'T00:00:00Z') + 86400000;
  if (start < from || end > until) add('O serviço não está inteiramente dentro do período pago confirmado.');
  units = Number.isSafeInteger(end - start) && end > start ? BigInt(end - start) * 1000n : null;
  totalQuantity = Number.isSafeInteger(basis.paidMinutes) && basis.paidMinutes > 0 ? BigInt(basis.paidMinutes) * 60n * scale : null;
  if (!totalQuantity || !units) add('Confirme o tempo pago e o tempo do serviço.');
  key = r.hash({ kind, targetType, id }); totalCents = expense.amountCents;
  snapshot = { version: 1, kind, service, basis, expenseAmountCents: expense.amountCents };
  return { valid: !errors.length, errors, key, kind, monthRef: service.endAt.slice(0, 7), units, totalQuantity, totalCents, snapshot, hash: r.hash(snapshot), label: 'Tempo do técnico #' + visit.technicianId + ' · ' + basis.periodStart + ' a ' + basis.periodEnd, unit: 'SECOND', visit, method: 'CONFIRMED_EXPENSE_PAID_TIME', measurement: measurementKey(targetType, id) };
}
function totals(rows) {
  let units = 0n, cents = 0;
  for (const row of rows) { const q = quantity(row.quantity); if (q === null || q <= 0n || !Number.isSafeInteger(row.amountCents) || row.amountCents <= 0) return null; units += q; cents += row.amountCents; }
  return Number.isSafeInteger(cents) ? { units, cents } : null;
}
function reservations(data, expense, source, purchaseItemId) {
  const poolRows = data.active.filter(a => source.kind === 'MATERIAL' ? a.valuationType === 'MATERIAL' && a.purchaseItemId === purchaseItemId : a.valuationType === 'LABOR' && a.expenseId === expense.id);
  const basisMatches = poolRows.every(a => {
    const c = a.valuationSnapshot?.calculation;
    return c && quantity(c.baseQuantity) === source.totalQuantity && c.baseAmountCents === source.totalCents && c.quantityUnit === source.unit && c.method === source.method;
  });
  return { measured: totals(data.active.filter(a => a.valuationKey === source.key)), pool: totals(poolRows), basisMatches };
}
module.exports = { quantity, decimal, round, prepare, build, reservations, selected, totals, laborBasis };
