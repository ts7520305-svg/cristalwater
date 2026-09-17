const { prisma } = require('../prismaClient');

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getMonthRef(date = new Date()) {
  return new Date(date).toISOString().slice(0, 7);
}

function getWeekRef(date = new Date()) {
  const d = new Date(date);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const days = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - first) / 86400000);
  const week = Math.ceil((days + first.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function createLock({ lockType, severity = 'WARNING', entity, entityId, clientId, poolId, visitId, technicianId, vehicleId, title, message, payload, requestedBy }) {
  return prisma.operationalLock.create({
    data: { lockType, severity, entity, entityId, clientId, poolId, visitId, technicianId, vehicleId, title, message, payload, requestedBy }
  });
}

async function validatePoolReadyForRound(poolId) {
  const pool = await prisma.pool.findUnique({
    where: { id: Number(poolId) },
    include: { client: true, equipment: true, calculationProfile: true }
  });
  if (!pool) return { ok: false, code: 'POOL_NOT_FOUND', message: 'Piscina não encontrada' };
  const missing = [];
  if (!pool.clientId) missing.push('cliente');
  if (!pool.volumeM3 && !pool.calculationProfile?.volumeM3) missing.push('cubicagem/ficha técnica');
  if (!pool.equipment && !pool.calculationProfile) missing.push('equipamentos/ficha técnica');
  if (missing.length) {
    await prisma.pool.update({ where: { id: pool.id }, data: { scheduleMode: 'PENDING_TECHNICAL_SHEET' } }).catch(() => null);
    await createLock({
      lockType: 'MISSING_TECHNICAL_SHEET',
      severity: 'BLOCKING',
      entity: 'Pool',
      entityId: pool.id,
      clientId: pool.clientId,
      poolId: pool.id,
      title: 'Piscina bloqueada para ronda',
      message: `Faltam dados obrigatórios: ${missing.join(', ')}`,
      payload: { missing }
    });
    return { ok: false, code: 'PENDING_TECHNICAL_SHEET', missing };
  }
  return { ok: true, pool };
}

async function validateVisitReadyForStock(visitId) {
  const visit = await prisma.serviceVisit.findUnique({
    where: { id: Number(visitId) },
    include: { technician: true, round: true, pool: { include: { client: true } } }
  });
  if (!visit) return { ok: false, code: 'VISIT_NOT_FOUND' };
  const vehicleId = visit.technician?.vehicleId || null;
  if (!vehicleId) {
    const lock = await createLock({
      lockType: 'VISIT_WITHOUT_VEHICLE',
      severity: 'BLOCKING',
      entity: 'ServiceVisit',
      entityId: visit.id,
      clientId: visit.clientId,
      poolId: visit.poolId,
      visitId: visit.id,
      technicianId: visit.technicianId,
      title: 'Visita sem viatura atribuída',
      message: 'A visita não pode consumir stock nem gerar guia de obra sem viatura atribuída ao técnico.'
    });
    return { ok: false, code: 'VISIT_WITHOUT_VEHICLE', lock };
  }
  return { ok: true, visit, vehicleId };
}

function safeChemicalLimit(productName, volumeM3) {
  const name = String(productName || '').toLowerCase();
  const v = Math.max(1, num(volumeM3, 50));
  if (name.includes('cloro') && (name.includes('choque') || name.includes('granulado'))) return Math.max(2, v * 0.12);
  if (name.includes('cloro')) return Math.max(2, v * 0.08);
  if (name.includes('ph')) return Math.max(1, v * 0.05);
  if (name.includes('sal')) return Math.max(25, v * 8);
  if (name.includes('ácido') || name.includes('acido')) return Math.max(1, v * 0.04);
  return Math.max(5, v * 0.1);
}

async function validateChemicalDose({ visitId, poolId, technicianId, productName, quantity, unit = 'KG', requestedBy }) {
  const pool = poolId ? await prisma.pool.findUnique({ where: { id: Number(poolId) }, include: { calculationProfile: true } }) : null;
  const volumeM3 = pool?.volumeM3 || pool?.calculationProfile?.volumeM3 || 50;
  const limit = safeChemicalLimit(productName, volumeM3);
  const qty = num(quantity, 0);
  if (qty > limit) {
    const lock = await createLock({
      lockType: 'CHEMICAL_DOSAGE_LIMIT',
      severity: 'CRITICAL',
      entity: 'ServiceVisit',
      entityId: visitId ? Number(visitId) : null,
      poolId: poolId ? Number(poolId) : null,
      visitId: visitId ? Number(visitId) : null,
      technicianId: technicianId ? Number(technicianId) : null,
      title: 'Dosagem química fora dos limites de segurança',
      message: `Dose ${qty}${unit} de ${productName} ultrapassa limite automático ${limit.toFixed(2)}${unit}. Requer aprovação administrativa.`,
      payload: { productName, quantity: qty, unit, volumeM3, limit },
      requestedBy
    });
    return { ok: false, blocked: true, lock, limit };
  }
  return { ok: true, blocked: false, limit };
}

async function setVisitState(payload = {}, user) {
  const { roleMatches } = require('../utils/roles');
  const requests = require('./fieldWriteRequestService');
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  if (!roleMatches(user?.role, 'TECHNICIAN')) fail('Sessão sem acesso à visita.', 403);
  const id = Number(payload.visitId);
  if (!Number.isSafeInteger(id) || id <= 0) fail('Visita inválida.');
  if (payload.visitType !== undefined && payload.visitType !== 'REGULAR') fail('Esta ação pertence a uma visita regular. A visita extra requer confirmação pelo escritório.', 409);
  if (payload.poolId !== undefined && (!Number.isSafeInteger(payload.poolId) || payload.poolId <= 0)) fail('Piscina de destino inválida.');
  const state = { AGENDADA:'SCHEDULED', SCHEDULED:'SCHEDULED', A_CAMINHO:'ON_ROUTE', ON_ROUTE:'ON_ROUTE', EM_EXECUCAO:'IN_PROGRESS', IN_PROGRESS:'IN_PROGRESS' }[payload.state];
  if (!state) fail('Utilize a conclusão ou o registo de impedimento da visita para encerrar o trabalho.', 409);
  if (state === 'IN_PROGRESS') {
    const result = await require('../business/technician/TechnicianVisitBusiness').startVisit(id, user, payload);
    if (!result.ok) fail(result.error, result.status);
    return result;
  }
  if (state === 'SCHEDULED' && !roleMatches(user.role, 'ADMIN')) fail('Só o escritório pode alterar o planeamento.', 403);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id = ${id} FOR UPDATE`;
    const visit = await tx.serviceVisit.findUnique({ where:{id} });
    requests.authorize(user, visit);
    if (payload.poolId !== undefined && payload.poolId !== visit.poolId) fail('A piscina da visita mudou. Atualize a rota.', 409);
    if (visit.startAt || visit.endAt || !['PLANNED','PENDING','SCHEDULED','AGENDADA','ASSIGNED','ON_ROUTE','A_CAMINHO'].includes(visit.status)) fail('O estado desta visita já não permite esta alteração. Atualize a rota.', 409);
    if (visit.status === state || (state === 'ON_ROUTE' && visit.status === 'A_CAMINHO') || (state === 'SCHEDULED' && visit.status === 'AGENDADA')) return { ok:true, visit, idempotent:true };
    const updated = await tx.serviceVisit.update({ where:{id}, data:{status:state} });
    await tx.visitStateLog.create({ data:{visitId:id,previousState:visit.status,newState:state,actor:requests.owner(user)} });
    return { ok:true, visit:updated };
  });
}

async function checkVehicleCompatibility({ poolId, vehicleId }) {
  const rule = await prisma.vehicleAccessibilityRule.findFirst({ where: { poolId: Number(poolId), active: true } });
  const vehicle = vehicleId ? await prisma.vehicle.findUnique({ where: { id: Number(vehicleId) } }) : null;
  if (!rule || !vehicle) return { ok: true, rule, vehicle };
  const vehicleType = String(vehicle.notes || vehicle.model || '').toUpperCase();
  const incompat = rule.accessibilityType === 'LIGEIRO' && /CARRINHA|CAMIAO|ALTA/.test(vehicleType);
  if (incompat) {
    const lock = await createLock({ lockType: 'VEHICLE_ROUTE_INCOMPATIBLE', severity: 'BLOCKING', entity: 'Pool', entityId: Number(poolId), poolId: Number(poolId), vehicleId: Number(vehicleId), title: 'Viatura incompatível com acesso da piscina', message: `A piscina exige ${rule.accessibilityType}; a viatura parece incompatível.`, payload: { rule, vehicle } });
    return { ok: false, lock, rule, vehicle };
  }
  return { ok: true, rule, vehicle };
}

async function createEmergencyConsumptionBatch({ technicianId, vehicleId, workGuideId, items = [], date, notes, createdBy }) {
  return prisma.emergencyConsumptionBatch.create({
    data: { technicianId: technicianId ? Number(technicianId) : null, vehicleId: vehicleId ? Number(vehicleId) : null, workGuideId: workGuideId ? Number(workGuideId) : null, date: date ? new Date(date) : new Date(), notes, createdBy, items: { create: items.map((it) => ({ productName: it.productName, unit: it.unit || 'KG', quantity: num(it.quantity), notes: it.notes || null })) } },
    include: { items: true }
  });
}

async function distributeEmergencyConsumption(batchId) {
  const batch = await prisma.emergencyConsumptionBatch.findUnique({ where: { id: Number(batchId) }, include: { items: true } });
  if (!batch) throw new Error('Batch não encontrado');
  const start = new Date(batch.date); start.setHours(0, 0, 0, 0);
  const end = new Date(batch.date); end.setHours(23, 59, 59, 999);
  const visits = await prisma.serviceVisit.findMany({ where: { technicianId: batch.technicianId || undefined, status: { in: ['DONE', 'CONCLUIDA'] }, plannedDate: { gte: start, lte: end } } });
  if (!visits.length) return { ok: false, code: 'NO_VISITS_TO_DISTRIBUTE' };
  const perVisit = [];
  for (const item of batch.items) {
    const share = item.quantity / visits.length;
    for (const visit of visits) {
      await prisma.chemicalUsage.create({ data: { visitId: visit.id, name: item.productName, quantity: share, unit: item.unit } }).catch(() => null);
      await prisma.stockMovement.create({ data: { movementType: 'EMERGENCY_DISTRIBUTED_CONSUMPTION', scopeFrom: 'VEHICLE', vehicleId: batch.vehicleId, productName: item.productName, unit: item.unit, quantity: share, visitId: visit.id, clientId: visit.clientId, poolId: visit.poolId, technicianId: batch.technicianId, workGuideId: batch.workGuideId, notes: `Rateio automático do batch ${batch.id}` } }).catch(() => null);
      perVisit.push({ visitId: visit.id, productName: item.productName, quantity: share, unit: item.unit });
    }
  }
  await prisma.emergencyConsumptionBatch.update({ where: { id: batch.id }, data: { status: 'DISTRIBUTED', approvedAt: new Date() } });
  return { ok: true, visits: visits.length, distributed: perVisit };
}

async function computeClientProfit(clientId, monthRef) {
  if (!/^[1-9]\d*$/.test(String(clientId)) || !Number.isSafeInteger(Number(clientId))) throw Object.assign(new Error('Cliente inválido.'), { status: 400 });
  const report = await require('./operationalValueReportService').clients(monthRef === undefined ? {} : { monthRef });
  const row = report.clients.find(client => client.clientId === Number(clientId));
  if (!row) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
  // Unknown costs cannot justify a persisted profit or a contract-price recommendation.
  return { ...row, clientId: Number(clientId), monthRef: report.monthRef, reportVersion: report.reportVersion,
    grossProfit: null, grossMarginPercent: null, chemicalCost: null, status: 'INSUFFICIENT_DATA', persisted: false,
    recommendation: 'Confirme a repartição das receitas e os custos históricos antes de avaliar a margem.',
    basis: report.basis, dataQuality: report.dataQuality };
}

async function createVehicleAudit({ vehicleId, technicianId, counted = [], weekRef = getWeekRef(), notes }) {
  const expectedBalances = await prisma.stockBalance.findMany({ where: { scope: 'VEHICLE', vehicleId: vehicleId ? Number(vehicleId) : null } }).catch(() => []);
  const expectedMap = new Map(expectedBalances.map((b) => [`${b.productName}|${b.unit}`, num(b.quantity)]));
  const countedMap = new Map(counted.map((c) => [`${c.productName}|${c.unit || 'KG'}`, num(c.quantity)]));
  const keys = new Set([...expectedMap.keys(), ...countedMap.keys()]);
  const items = [...keys].map((key) => {
    const [productName, unit] = key.split('|');
    const expectedQty = expectedMap.get(key) || 0;
    const countedQty = countedMap.get(key) || 0;
    return { productName, unit, expectedQty, countedQty, varianceQty: countedQty - expectedQty };
  });
  const hasVariance = items.some((i) => Math.abs(i.varianceQty) > 0.01);
  const audit = await prisma.vehicleStockAudit.create({ data: { vehicleId: vehicleId ? Number(vehicleId) : null, technicianId: technicianId ? Number(technicianId) : null, weekRef, status: hasVariance ? 'DIVERGENCE' : 'OK', expectedJson: Object.fromEntries(expectedMap), countedJson: Object.fromEntries(countedMap), varianceJson: items, varianceValue: items.reduce((s, i) => s + Math.abs(i.varianceQty), 0), notes, closedAt: new Date(), items: { create: items } }, include: { items: true } });
  if (hasVariance) {
    await createLock({ lockType: 'VEHICLE_STOCK_DIVERGENCE', severity: 'WARNING', entity: 'Vehicle', entityId: vehicleId ? Number(vehicleId) : null, vehicleId: vehicleId ? Number(vehicleId) : null, technicianId: technicianId ? Number(technicianId) : null, title: 'Desvio de stock na viatura', message: 'A contagem física não bate com o stock esperado.', payload: { auditId: audit.id, items } });
  }
  return audit;
}

module.exports = { validatePoolReadyForRound, validateVisitReadyForStock, validateChemicalDose, setVisitState, checkVehicleCompatibility, createEmergencyConsumptionBatch, distributeEmergencyConsumption, computeClientProfit, createVehicleAudit, createLock, getMonthRef };
