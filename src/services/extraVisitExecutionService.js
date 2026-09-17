'use strict';
const { prisma } = require('../prismaClient');
const requests = require('./fieldWriteRequestService');
const billing = require('./extraVisitBillingService');
const { validateVisitCompletionPayload } = require('./serviceVisitCompletionService');
const checks = ['cleaned','brushed','vacuumed','basketCleaned','waterlineClean','backwashDone'];
const readings = ['ph','chlorine','alkalinity','salt','temperature','orp','orpMv'];
const editable = new Set(['PLANNED','PENDING','SCHEDULED','ASSIGNED','ON_ROUTE','A_CAMINHO','IN_PROGRESS','STARTED','INCOMPLETE']);
const id = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647 ? Number(value) : requests.fail('Visita extra inválida.');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
function project(visit) {
  return { id: visit.id, visitType: 'EXTRA', poolId: visit.poolId, clientId: visit.clientId, technicianId: visit.technicianId, status: visit.status,
    startAt: visit.startAt, endAt: visit.endAt, completionRequestId: visit.completionRequestId, ...(visit.execution || {}), photos: visit.photos || [] };
}
async function locked(tx, actor, visitId, poolId) {
  const before = await tx.extraVisit.findUnique({ where: { id: visitId } });
  requests.authorize(actor, before);
  await billing.lockClient(tx, before);
  await tx.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${visitId} FOR UPDATE`;
  const visit = await tx.extraVisit.findUnique({ where: { id: visitId }, include: { pool: true, photos: true } });
  requests.authorize(actor, visit);
  if (visit.clientId !== before.clientId || visit.poolId !== before.poolId || (poolId !== undefined && poolId !== visit.poolId)) requests.fail('A piscina ou o cliente da visita mudou. Atualize a ronda.', 409);
  return visit;
}
function validate(body, completion) {
  const allowed = ['requestId','visitType','poolId', ...(completion ? [...readings,...checks,'products','notes','workGuideId','vehicleId','priority','problem'] : [])];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key)) || body.visitType !== 'EXTRA' || !Number.isSafeInteger(body.poolId) || body.poolId <= 0) requests.fail('Conserve o pedido original da visita extra.');
  if (!completion) return null;
  for (const field of readings) if (body[field] !== undefined && body[field] !== null && !['number','string'].includes(typeof body[field])) requests.fail('Medição inválida: ' + field);
  for (const field of checks) if (body[field] !== undefined && typeof body[field] !== 'boolean') requests.fail('Confirmação inválida: ' + field);
  for (const field of ['notes','problem']) if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > 6000)) requests.fail('Nota inválida ou demasiado longa.');
  for (const field of ['workGuideId','vehicleId']) if(body[field] !== undefined && !/^[1-9][0-9]*$/.test(String(body[field]))) requests.fail('Guia ou viatura inválida.');
  let rawProducts = body.products;
  if(typeof rawProducts === 'string' && rawProducts.trim().startsWith('[')) {try {rawProducts=JSON.parse(rawProducts);}catch(_){requests.fail('Lista de produtos inválida.');}}
  if(Array.isArray(rawProducts))for(const product of rawProducts){
    if(!product || typeof product !== 'object' || Array.isArray(product) || Object.keys(product).some(key=>!['name','productName','quantity','unit','notes'].includes(key)) || !['number','string'].includes(typeof product.quantity) || (product.notes!==undefined && (typeof product.notes!=='string'||product.notes.length>1000)))requests.fail('Dados do produto inválidos.');
  }
  const result = validateVisitCompletionPayload(body);
  if (result.productsText && !result.chemicalsJson) requests.fail('Registe cada produto e quantidade na lista.');
  if ((result.chemicalsJson || []).length > 50) requests.fail('Demasiados produtos nesta visita.');
  for (const product of result.chemicalsJson || []) {
    if (product.name.length > 200 || !['number','string'].includes(typeof product.quantity) || !Number.isFinite(product.quantity) || product.quantity > 100000 || typeof product.unit !== 'string' || !product.unit.trim()) requests.fail('Produto, quantidade ou unidade inválidos.');
  }
  return result;
}
async function audit(tx, actor, visit, action, request, metadata = {}) {
  await tx.auditTrail.create({ data: { eventType: action, entity: 'ExtraVisit', entityId: visit.id, technicianId: visit.technicianId, poolId: visit.poolId, clientId: visit.clientId,
    action, message: action === 'EXTRA_VISIT_STARTED' ? 'Visita extra iniciada.' : 'Visita extra concluída.', metadata: { owner: requests.owner(actor), requestId: request.requestId, visitType: 'EXTRA', ...metadata } } });
}
async function start(actor, value, body) {
  const visitId = id(value); validate(body, false);
  const { requestId, ...payload } = body, request = requests.context(actor, 'EXTRA_VISIT_START', visitId, requestId, payload);
  return prisma.$transaction(async tx => {
    const saved = await requests.recover(tx, request); if (saved) return saved;
    const visit = await locked(tx, actor, visitId, body.poolId);
    await require('./incompleteVisitLifecycle').assertNoReturn(tx,'EXTRA',visit);
    if (visit.endAt || !editable.has(visit.status)) requests.fail('Esta visita extra já não pode ser iniciada.', 409);
    if (visit.startAt && visit.status === 'IN_PROGRESS') return requests.confirm(tx, request, { ok: true, visit: project(visit) });
    const updated = await tx.extraVisit.update({ where: { id: visitId }, data: { status: 'IN_PROGRESS', startAt: visit.startAt || new Date() } });
    await audit(tx, actor, updated, 'EXTRA_VISIT_STARTED', request);
    return requests.confirm(tx, request, { ok: true, visit: project(updated) });
  }, { maxWait: 15000, timeout: 20000 });
}
async function consume(tx, visit, body, products, request) {
  if (!products.length) return;
  const tech = await tx.technician.findUnique({ where: { id: visit.technicianId }, select: { vehicleId: true } });
  if (!tech?.vehicleId || (body.vehicleId !== undefined && Number(body.vehicleId) !== tech.vehicleId)) requests.fail('A viatura da visita extra precisa de confirmação.', 409);
  const guide = body.workGuideId === undefined
    ? await tx.workGuide.findFirst({ where: { vehicleId: tech.vehicleId, status: 'OPEN' }, orderBy: { id: 'desc' } })
    : await tx.workGuide.findUnique({ where: { id: id(body.workGuideId) } });
  if (!guide || guide.status !== 'OPEN' || guide.vehicleId !== tech.vehicleId || (guide.technicianId && guide.technicianId !== visit.technicianId)) requests.fail('Confirme a guia de obra aberta da viatura deste técnico.', 409);
  await tx.$queryRaw`SELECT id FROM "WorkGuide" WHERE id=${guide.id} FOR UPDATE`;
  const currentGuide = await tx.workGuide.findUnique({ where: { id: guide.id } });
  if (currentGuide.status !== 'OPEN' || currentGuide.vehicleId !== tech.vehicleId || currentGuide.technicianId !== guide.technicianId) requests.fail('A guia mudou. Atualize os documentos.', 409);
  const stock = await tx.workGuideItem.findMany({ where: { workGuideId: guide.id }, orderBy: { id: 'asc' } });
  const grouped = new Map();
  for (const product of products) {
    const matches = stock.filter(item => normalize(item.name) === normalize(product.name) && normalize(item.unit) === normalize(product.unit));
    if (matches.length !== 1) requests.fail('Confirme o produto e a unidade na guia: ' + product.name, 409);
    const target = matches[0], previous = grouped.get(target.id);
    grouped.set(target.id, { target, quantity: (previous?.quantity || 0) + product.quantity });
  }
  for (const { target, quantity } of [...grouped.values()].sort((a,b) => a.target.id-b.target.id)) {
    const changed = await tx.workGuideItem.updateMany({ where: { id: target.id, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity }, usedQty: { increment: quantity } } });
    if (changed.count !== 1) requests.fail('Stock insuficiente na viatura para ' + target.name, 409);
    const notes = JSON.stringify({ extraVisitId: visit.id, visitType: 'EXTRA', poolId: visit.poolId, requestId: request.requestId, owner: request.owner });
    await tx.vehicleStockMovement.create({ data: { vehicleId: guide.vehicleId, workGuideId: guide.id, transportGuideId: guide.guideId, extraVisitId: visit.id, technicianId: visit.technicianId, itemName: target.name, itemType: target.type, unit: target.unit, quantity, movementType: 'CONSUMPTION', source: 'EXTRA_VISIT_COMPLETE', notes } });
    await tx.stockMovement.create({ data: { movementType: 'CONSUMPTION', scopeFrom: 'VEHICLE', vehicleId: guide.vehicleId, workGuideId: guide.id, transportGuideId: guide.guideId, extraVisitId: visit.id, poolId: visit.poolId, clientId: visit.clientId, technicianId: visit.technicianId, productName: target.name, category: target.type, unit: target.unit, quantity, notes, createdBy: request.owner } });
  }
}
async function complete(actor, value, body) {
  const visitId = id(value), validated = validate(body, true);
  const { requestId, ...payload } = body, request = requests.context(actor, 'EXTRA_VISIT_COMPLETION', visitId, requestId, payload);
  return prisma.$transaction(async tx => {
    const saved = await requests.recover(tx, request); if (saved) return saved;
    const current = await locked(tx, actor, visitId, body.poolId);
    await require('./incompleteVisitLifecycle').assertNoReturn(tx,'EXTRA',current);
    if (current.endAt || !editable.has(current.status)) requests.fail('A visita extra já está fechada. Conserve o pedido original; correções exigem revisão do escritório.', 409);
    const products = validated.chemicalsJson || [];
    const execution = { ...Object.fromEntries(Object.entries(validated).filter(([key, value]) => value !== undefined && key !== 'productsText')), products: validated.productsText || '[]', notes: body.notes || '',
      ...Object.fromEntries(checks.map(field => [field, body[field] === true])), ...(body.problem ? { problem: body.problem } : {}) };
    await consume(tx, current, body, products, request);
    const visit = await tx.extraVisit.update({ where: { id: visitId }, data: { status: 'DONE', startAt: current.startAt || new Date(), endAt: new Date(), execution, completionRequestId: request.requestId }, include: { photos: true, pool: true } });
    await billing.record(tx, visit);
    await require('./incompleteVisitLifecycle').settle(tx,'EXTRA',visit.id);
    await audit(tx, actor, visit, 'EXTRA_VISIT_COMPLETED', request, { execution });
    await tx.technicalHistory.create({ data: { poolId: visit.poolId, type: 'EXTRA_VISIT_COMPLETED', component: 'Extra Visit', message: 'Visita extra concluída', description: JSON.stringify({ extraVisitId: visit.id, owner: request.owner, execution }), status: 'DONE', performedAt: visit.startAt, doneAt: visit.endAt } });
    await tx.notification.create({ data: { role: 'ADMIN', type: 'EXTRA_VISIT_COMPLETED', eventType: 'EXTRA_VISIT_COMPLETED', title: 'Visita extra concluída', message: `${visit.pool?.name || 'Piscina'}: visita extra concluída.${body.problem ? ' Ocorrência: ' + body.problem : ''}`, metadata: { extraVisitId: visit.id, poolId: visit.poolId, technicianId: visit.technicianId } } });
    return requests.confirm(tx, request, { ok: true, visit: project(visit) });
  }, { maxWait: 15000, timeout: 20000 });
}
module.exports = { start, complete, project, locked, validate };
