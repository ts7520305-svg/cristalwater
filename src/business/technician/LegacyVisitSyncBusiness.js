const crypto = require('crypto');
const repository = require('../../dal/EquipmentStockRepository');
const { roleMatches } = require('../../utils/roles');
const { buildChemicalAdvice } = require('../../services/chemicalAdviceService');

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function number(value, label) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error(`${label}: indique um número não negativo.`);
  return Number(value);
}
function identifier(value) {
  const id = number(value, 'Identificador');
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Identificador inválido.');
  return id;
}
function stockItems(raw, vehicleId) {
  if (!Array.isArray(raw) || raw.length > 100) throw new Error('Consumos: lista de até 100 produtos obrigatória.');
  const grouped = new Map();
  for (const item of raw) {
    if (!object(item)) throw new Error('Consumo inválido.');
    const name = item.productName ?? item.name;
    if (typeof name !== 'string' || !name.trim() || name.length > 160 || (item.unit != null && (typeof item.unit !== 'string' || !item.unit.trim() || item.unit.length > 24))) throw new Error('Produto ou unidade inválidos.');
    const quantity = number(item.quantity, 'Quantidade');
    const row = { vehicleId: identifier(item.vehicleId ?? vehicleId), productName: name.trim().replace(/\s+/g, ' ').toUpperCase(), unit: (item.unit || 'KG').trim().toUpperCase(), quantity };
    const key = stable([row.vehicleId, row.productName, row.unit]);
    const previous = grouped.get(key);
    row.quantity += previous?.quantity || 0;
    if (!Number.isFinite(row.quantity)) throw new Error('Quantidade inválida.');
    grouped.set(key, row);
  }
  return [...grouped.values()].filter(row => row.quantity > 0).sort((a,b) => stable(a).localeCompare(stable(b)));
}
function stockKey(row) { return stable([row.vehicleId, row.productName, row.unit]); }

async function sync(user, payload) {
  if (!object(payload)) throw new Error('Registo de visita inválido.');
  const id = identifier(payload.id ?? payload.visitId ?? payload.serviceVisitId);
  if (payload.checklistJson != null && !object(payload.checklistJson)) throw new Error('Checklist inválida.');
  const checklist = payload.checklistJson || {};
  const rawItems = payload.consumos ?? checklist.consumos;
  const items = rawItems === undefined ? undefined : stockItems(rawItems, payload.vehicleId ?? checklist.vehicleId);
  const readings = {
    ph: payload.phRead ?? payload.ph ?? payload.pH,
    chlorine: payload.clRead ?? payload.chlorine ?? payload.cl,
    alkalinity: payload.alkalinity,
  };
  for (const key of Object.keys(readings)) {
    if (readings[key] == null) delete readings[key];
    else readings[key] = number(readings[key], key);
  }
  if (readings.ph > 14) throw new Error('pH fora do intervalo de 0 a 14.');
  // Client copies of server bookkeeping never influence the receipt or stored state.
  const cleanChecklist = { ...checklist };
  for (const key of ['lastSyncHash','lastSyncAt','stockSnapshot','aiChemicalAdvice','consumos','vehicleId']) delete cleanChecklist[key];
  if (payload.expectedSyncHash != null && (typeof payload.expectedSyncHash !== 'string' || payload.expectedSyncHash.length > 128)) throw new Error('Versão da sincronização inválida.');
  const actor = `${user.role}:${user.id}`;
  const syncHash = crypto.createHash('sha256').update(stable({ id, actor, baseVersion:payload.expectedSyncHash ?? null, readings, checklist: cleanChecklist, items: items ?? null })).digest('hex');
  return repository.prisma.$transaction(async tx => {
    let kind = 'ServiceVisit';
    await tx.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR UPDATE`;
    let visit = await tx.serviceVisit.findUnique({ where:{id}, include:{pool:{include:{calculationProfile:true}}} });
    if (!visit) {
      kind = 'Visit';
      await tx.$queryRaw`SELECT id FROM "Visit" WHERE id=${id} FOR UPDATE`;
      visit = await tx.visit.findUnique({ where:{id}, include:{pool:{include:{calculationProfile:true}}} });
    }
    if (!visit) throw new Error('Visita não encontrada.');
    const admin = roleMatches(user.role, 'ADMIN');
    if (!admin && visit.technicianId !== Number(user.technicianId || user.id)) throw new Error('Sem permissão para sincronizar visita de outro técnico.');
    const receiptKey = `legacy-sync:${kind}:${id}:${syncHash}`;
    const receipt = await tx.operationalReminder.findUnique({where:{sourceKey:receiptKey}});
    if (receipt) return { ...receipt.metadata.result, idempotent:true };
    if (visit.endAt || visit.executedAt || ['DONE','COMPLETED','CANCELLED','CANCELED','SKIPPED','ARCHIVED'].includes(visit.status)) throw new Error('A visita está encerrada. Utilize o procedimento de correção do registo.');
    const stateKey = `legacy-sync-state:${kind}:${id}`;
    const state = await tx.operationalReminder.findUnique({where:{sourceKey:stateKey}});
    const oldChecklist = object(visit.chemicalsJson) ? visit.chemicalsJson : state?.metadata.checklist || {};
    const currentHash = state?.metadata.syncHash || oldChecklist.lastSyncHash || null;
    // Every changed payload after a successful sync must refer to the version read.
    if (currentHash && payload.expectedSyncHash !== currentHash) throw new Error('A visita mudou. Atualize o registo e envie expectedSyncHash antes de guardar alterações.');
    const previousItems = state?.metadata.items ?? null;
    const legacyUnknown = state?.metadata.legacyUnknown ?? Boolean(!state && (oldChecklist.lastSyncHash || oldChecklist.consumos?.length));
    if (items !== undefined && legacyUnknown) throw new Error('Consumos antigos sem registo de reconciliação. Solicite revisão à gestão antes de alterar produtos.');
    const nextItems = items ?? previousItems ?? [];
    const changes = new Map();
    for (const row of previousItems || []) changes.set(stockKey(row), { ...row, delta:-row.quantity });
    for (const row of nextItems) changes.set(stockKey(row), { ...row, delta:row.quantity + (changes.get(stockKey(row))?.delta || 0) });
    const deltas = [...changes.values()].filter(row => row.delta !== 0).sort((a,b) => stockKey(a).localeCompare(stockKey(b)));
    // Reassignment and authorization are checked inside the same transaction as stock.
    if (!admin && deltas.length) {
      await tx.$queryRaw`SELECT id FROM "Technician" WHERE id=${visit.technicianId} FOR UPDATE`;
      const technician = await tx.technician.findUnique({where:{id:visit.technicianId}});
      if (!technician?.active || deltas.some(row => row.vehicleId !== technician.vehicleId)) throw new Error('Só pode alterar consumos da sua viatura atribuída. Peça à gestão a reconciliação de outra viatura.');
    }
    for (const vehicleId of new Set(deltas.map(row => row.vehicleId))) {
      const vehicle = await tx.vehicle.findUnique({where:{id:vehicleId}});
      if (!vehicle?.active || vehicle.deletedAt || vehicle.archiveStatus !== 'ATIVO') throw new Error('Viatura indisponível para sincronizar consumos.');
    }
    const stock = [];
    for (const row of deltas) {
      const balance = await repository.adjustBalance(tx, {scope:'VEHICLE', ...row, delta:-row.delta});
      await tx.stockMovement.create({data:{movementType:row.delta>0?'V22_SYNC_CONSUMPTION':'V22_SYNC_CORRECTION_RETURN',scopeFrom:row.delta>0?'VEHICLE':null,scopeTo:row.delta<0?'VEHICLE':null,vehicleId:row.vehicleId,productId:balance.productId,productName:row.productName,unit:row.unit,quantity:Math.abs(row.delta),category:balance.category,visitId:kind==='ServiceVisit'?id:null,technicianId:visit.technicianId,createdBy:actor,notes:`Sincronização ${kind} ${id}: ${syncHash}`}});
      stock.push({skipped:false, productName:row.productName, quantity:row.delta, unit:row.unit, vehicleId:row.vehicleId});
    }
    const savedReadings = { ...(state?.metadata.readings || {}), ...readings };
    const advice = buildChemicalAdvice({pool:visit.pool,readings:{phRead:savedReadings.ph ?? visit.ph,clRead:savedReadings.chlorine ?? visit.chlorine,alkalinity:savedReadings.alkalinity ?? visit.alkalinity}});
    const merged = {...oldChecklist,...cleanChecklist,consumos:legacyUnknown?oldChecklist.consumos||[]:nextItems,aiChemicalAdvice:advice,inputMethod:'DIGITAL_WHEEL_PICKER_V22',lastSyncHash:syncHash,lastSyncAt:new Date().toISOString()};
    if (kind === 'ServiceVisit') await tx.serviceVisit.update({where:{id},data:{...readings,chemicalsJson:merged,...(visit.status==='SYNCED'?{status:visit.startAt?'IN_PROGRESS':'PLANNED'}:{})}});
    // Legacy Visit has no reading fields: keep readings/checklist in its durable sync state.
    const result = {id,status:'SYNCED',kind,stock,advice,syncHash};
    const metadata = JSON.parse(JSON.stringify({syncHash,items:nextItems,legacyUnknown,readings:savedReadings,checklist:merged}));
    await tx.operationalReminder.upsert({where:{sourceKey:stateKey},create:{sourceKey:stateKey,title:'Estado de sincronização da visita',dueDate:new Date(),isCompleted:true,metadata},update:{metadata}});
    await tx.auditTrail.create({data:{eventType:'SYNC',entity:kind,entityId:id,technicianId:visit.technicianId,action:'V22_SYNC_CHEMICAL_WHEEL_SUCCESS',message:'Sincronização com controlo de versão e reconciliação dos consumos.',metadata:{syncHash,actor}}});
    await tx.operationalReminder.create({data:{sourceKey:receiptKey,title:'Sincronização registada',dueDate:new Date(),isCompleted:true,metadata:{result:JSON.parse(JSON.stringify(result))}}});
    return result;
  }, {maxWait:15000,timeout:15000});
}
module.exports = {sync};
