'use strict';
const R = require('../../frontend/cw-visit-product-identity');
const { sum } = require('../../frontend/cw-field-materials');
const fail = message => { throw Object.assign(Error(message), { statusCode: 409, code: 'STOCK_CORRECTION_REVIEW' }); };
const identity = row => { try { return R.identity(row); } catch (error) { fail(error.message); } };
const total = values => { const value = sum(values); if (value === null) fail('Quantidades anteriores por confirmar.'); return Number(value); };
const add = (map, key, n) => map.set(key, total([map.get(key) || 0, n]));
function equivalent(a, b, withIdentity = true) {
  function grouped(rows) {
    const map = new Map();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || !R.text(row.name) || !R.text(row.unit) || !Number.isFinite(row.quantity) || row.quantity <= 0) fail('O consumo anterior precisa de revisão do escritório.');
      const id = identity(row), key = withIdentity && id ? JSON.stringify([id, row.name, row.unit]) : R.key(row);
      add(map, key, row.quantity);
    }
    return JSON.stringify([...map].sort((a, b) => a[0].localeCompare(b[0])));
  }
  return grouped(a) === grouped(b);
}
function movementProduct(row) {
  let notes = {}; try { notes = JSON.parse(row.notes || '{}'); } catch (_) {}
  const selected = notes && Object.hasOwn(notes, 'workGuideItemId') ? identity(notes) : null;
  if (selected && selected.workGuideId !== row.workGuideId) fail('A identidade no histórico de stock é incoerente.');
  return { name: row.itemName, unit: row.unit, quantity: row.quantity, ...(selected || {}) };
}
async function reconcile(tx, visit, previous, desired, options = {}) {
  if (!Array.isArray(previous) || !Array.isArray(desired)) fail('Reveja o registo anterior de produtos.');
  if (equivalent(previous, desired)) return;
  const extra = options.visitType === 'EXTRA', link = extra ? { extraVisitId: visit.id } : { visitId: visit.id };
  const movements = await tx.vehicleStockMovement.findMany({ where: { ...link, movementType: { in: ['CONSUMPTION', 'RETURN'] } }, orderBy: { id: 'asc' } });
  const original = [...new Set(movements.map(row => row.workGuideId))];
  if (!original.every(R.positive)) fail('A guia original não está identificada.');
  const journal = movements.map(row => ({ row, product: movementProduct(row) }));
  if (!original.length) {
    if (previous.length || extra) fail('A visita não tem uma guia de consumo original confirmada.');
    const tech = await tx.technician.findUnique({ where: { id: visit.technicianId }, select: { vehicleId: true } });
    const guides = tech?.vehicleId ? await tx.workGuide.findMany({ where: { vehicleId: tech.vehicleId, technicianId: visit.technicianId, status: 'OPEN' }, take: 2 }) : [];
    if (guides.length !== 1) fail('Confirme uma única guia aberta para acrescentar produtos.');
    original.push(guides[0].id);
  }
  function guideFor(product) {
    const id = identity(product);
    if (id) { if (!original.includes(id.workGuideId)) fail('O produto não pertence à guia original desta visita.'); return id.workGuideId; }
    const matching = [...new Set(journal.filter(entry => R.key(entry.product) === R.key(product)).map(entry => entry.row.workGuideId))];
    const ids = matching.length ? matching : original;
    if (ids.length !== 1) fail('O produto não identifica uma única guia original.');
    return ids[0];
  }
  const guides = new Map();
  for (const id of [...original].sort((a, b) => a - b)) {
    await tx.$queryRaw`SELECT id FROM "WorkGuide" WHERE id=${id} FOR UPDATE`;
    const guide = await tx.workGuide.findUnique({ where: { id }, include: { items: true } });
    if (!guide || guide.status !== 'OPEN' || guide.technicianId && guide.technicianId !== visit.technicianId) fail('A guia original está encerrada ou mudou de responsável. Peça revisão ao escritório.');
    guides.set(id, guide);
  }
  const selected = new Map();
  function itemFor(product, guideId = guideFor(product)) {
    const guide = guides.get(guideId); let item;
    try { item = R.resolve(guide.items, product, guide.id); } catch (error) { fail(error.message); }
    selected.set(item.id, { item, guide }); return item.id;
  }
  const before = new Map(), after = new Map(), actual = new Map();
  for (const product of previous) add(before, itemFor(product), product.quantity);
  for (const product of desired) add(after, itemFor(product), product.quantity);
  for (const { row, product } of journal) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) fail('O histórico contém uma quantidade por confirmar.');
    add(actual, itemFor(product, row.workGuideId), row.movementType === 'RETURN' ? -row.quantity : row.quantity);
  }
  for (const id of new Set([...before.keys(), ...actual.keys()])) {
    const recorded = before.get(id) || 0, journalled = actual.get(id) || 0;
    if (Math.abs(recorded - journalled) > Number.EPSILON * Math.max(1, Math.abs(recorded), Math.abs(journalled)) * 8) fail('O histórico de stock diverge do consumo da visita. Peça revisão ao escritório.');
  }
  for (const id of [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b)) {
    const delta = total([after.get(id) || 0, -(before.get(id) || 0)]); if (!delta) continue;
    const { item, guide } = selected.get(id);
    const changed = await tx.workGuideItem.updateMany({ where: { id, ...(delta > 0 ? { quantity: { gte: delta } } : { usedQty: { gte: -delta } }) }, data: { quantity: { decrement: delta }, usedQty: { increment: delta } } });
    if (changed.count !== 1) fail('Saldo insuficiente para corrigir ' + item.name + '.');
    const notes = JSON.stringify({ cwGuideMovement: true, userNotes: 'Correção de produtos na visita ' + visit.id, visitType: extra ? 'EXTRA' : 'REGULAR', ...link, workGuideId: guide.id, workGuideItemId: id, ...(options.requestId ? { requestId: options.requestId } : {}), ...(options.owner ? { owner: options.owner } : {}) });
    const movementType = delta > 0 ? 'CONSUMPTION' : 'RETURN', quantity = Math.abs(delta);
    const common = { vehicleId: guide.vehicleId, transportGuideId: guide.guideId, workGuideId: guide.id, ...link, technicianId: visit.technicianId, unit: item.unit, quantity, movementType, notes };
    await tx.vehicleStockMovement.create({ data: { ...common, itemName: item.name, itemType: item.type, source: extra ? 'EXTRA_VISIT_CORRECTION' : 'VISIT_CORRECTION' } });
    await tx.stockMovement.create({ data: { ...common, poolId: visit.poolId || null, clientId: visit.clientId || null, productName: item.name, category: item.type, ...(delta > 0 ? { scopeFrom: 'VEHICLE' } : { scopeTo: 'VEHICLE' }), createdBy: options.owner || 'TECHNICIAN_FIELD_CORRECTION' } });
  }
}
module.exports = { equivalent, reconcile };
