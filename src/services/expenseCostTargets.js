'use strict';
const r = require('./expenseLedgerRules');
const repairs = require('./expenseRepairTargets'), maintenance = require('./expenseMaintenanceTargets');
const { isCompletedVisitStatus } = require('./operationalValueReportService');
const types = ['COMPANY', 'CLIENT', 'REGULAR', 'EXTRA', 'REPAIR', ...Object.keys(maintenance.types)];
const serviceTypes = types.filter(type => !['COMPANY','CLIENT'].includes(type));
const clientSelect = { id: true, name: true, active: true };
const visitSelect = { id: true, clientId: true, poolId: true, status: true, startAt: true, endAt: true, client: { select: clientSelect }, pool: { select: { name: true } } };
const targetId = a => a.targetType === 'CLIENT' ? a.clientId : a.targetType === 'REGULAR' ? a.visitId : a.targetType === 'EXTRA' ? a.extraVisitId : a.targetType === 'REPAIR' ? a.repairId : a.targetType === 'MAINTENANCE_EQUIPMENT' ? a.maintenanceCompletionId : a.targetType === 'MAINTENANCE_REMINDER' ? a.serviceReminderId : null;
const executionFields = type => ['type', 'id', 'clientId', 'poolId', 'status', 'startAt', 'endAt', ...(type === 'REPAIR' ? repairs.proofFields : maintenance.types[type] ? maintenance.proofFields : [])];
function project(type, row) {
  if (!types.includes(type)) r.fail('Destino inválido.');
  if (type !== 'COMPANY' && !row) return null;
  const company = type === 'COMPANY', clientOnly = type === 'CLIENT';
  const client = company ? null : clientOnly ? row : row.client;
  const facts = { type, id: company ? null : row.id, clientId: client?.id || null, poolId: !company && !clientOnly ? row.poolId : null, status: !company && !clientOnly ? String(row.status).trim().toUpperCase() : null, startAt: !company && !clientOnly ? row.startAt?.toISOString() || null : null, endAt: !company && !clientOnly ? row.endAt?.toISOString() || null : null };
  const valid = company || !!client && (clientOnly || isCompletedVisitStatus(row.status) && row.clientId === client.id);
  const label = company ? 'Custos gerais da empresa' : clientOnly ? (client.name || 'Cliente') + ' · #' + client.id + (client.active ? '' : ' · inativo') : (type === 'REGULAR' ? 'Visita regular #' : 'Visita extra #') + row.id + ' · ' + (row.pool?.name || 'Sem instalação') + ' · ' + (r.day(row.endAt) || 'Sem data de conclusão');
  return { type, id: facts.id, clientId: facts.clientId, clientName: client?.name || null, label, valid, hash: r.hash(facts), snapshot: { ...facts, label, clientName: client?.name || null }, warning: !valid ? 'Confirme a conclusão e o cliente registado diretamente neste serviço.' : !company && !clientOnly && !row.endAt ? 'Sem data de conclusão: confirme explicitamente o mês da atribuição.' : 'Confirme o destinatário e o mês desta atribuição.' };
}
async function get(db, type, id, lock = false) {
  if (!types.includes(type)) r.fail('Destino inválido.');
  if (type === 'COMPANY') { if (id !== null) r.fail('Destino inválido.'); return project(type); }
  r.id(id);
  if (type === 'REPAIR') return repairs.get(db, id, lock);
  if (maintenance.types[type]) return maintenance.get(db,type,id,lock);
  if (lock) {
    if (type === 'CLIENT') await db.$queryRaw`SELECT id FROM "Client" WHERE id=${id} FOR SHARE`;
    else if (type === 'REGULAR') await db.$queryRaw`SELECT id FROM "ServiceVisit" WHERE id=${id} FOR SHARE`;
    else await db.$queryRaw`SELECT id FROM "ExtraVisit" WHERE id=${id} FOR SHARE`;
  }
  const model = type === 'CLIENT' ? db.client : type === 'REGULAR' ? db.serviceVisit : db.extraVisit;
  const row = await model.findUnique({ where: { id }, select: type === 'CLIENT' ? clientSelect : visitSelect });
  return project(type, row);
}
async function current(db, allocations) {
  const ids = type => [...new Set(allocations.filter(a => a.targetType === type).map(targetId))];
  const [clients, regular, extras, repairTargets, equipmentTargets, reminderTargets] = await Promise.all([
    db.client.findMany({ where: { id: { in: ids('CLIENT') } }, select: clientSelect }),
    db.serviceVisit.findMany({ where: { id: { in: ids('REGULAR') } }, select: visitSelect }),
    db.extraVisit.findMany({ where: { id: { in: ids('EXTRA') } }, select: visitSelect }),
    repairs.read(db, ids('REPAIR')),
    maintenance.read(db,'MAINTENANCE_EQUIPMENT',ids('MAINTENANCE_EQUIPMENT')),
    maintenance.read(db,'MAINTENANCE_REMINDER',ids('MAINTENANCE_REMINDER'))
  ]);
  const map = new Map([['COMPANY:null', project('COMPANY')]]);
  for (const [type, rows] of [['CLIENT', clients], ['REGULAR', regular], ['EXTRA', extras]]) for (const row of rows) map.set(type + ':' + row.id, project(type, row));
  for (const row of repairTargets) map.set('REPAIR:' + row.id, row);
  for(const row of [...equipmentTargets,...reminderTargets]) map.set(row.type+':'+row.id,row);
  return map;
}
async function list(db, query) {
  r.object(query, ['type', 'q', 'clientId', 'page']);
  const type = query.type, q = r.text(query.q || '', 160), page = r.queryId(query.page === undefined ? '1' : query.page);
  if (!['CLIENT', ...serviceTypes].includes(type)) r.fail('Destino inválido.');
  if (type === 'CLIENT' && query.clientId !== undefined) r.fail('Pesquisa de cliente inválida.');
  const clientId = type === 'CLIENT' ? null : r.queryId(query.clientId);
  const model = type === 'CLIENT' ? db.client : type === 'REGULAR' ? db.serviceVisit : db.extraVisit;
  // Service state aliases are normalized in project(); include every matching source before paging.
  const records = maintenance.types[type] ? await maintenance.list(db,type,clientId) : type === 'REPAIR' ? await repairs.list(db, clientId) : (await model.findMany({ where: type === 'CLIENT' ? {} : { clientId }, select: type === 'CLIENT' ? clientSelect : visitSelect, orderBy: { id: 'desc' } })).map(row => project(type, row));
  const all = records.filter(row => row.valid && (!q || r.normalized(row.label).includes(r.normalized(q))));
  return { ok: true, type, q, clientId, page, pageSize: 10, total: all.length, rows: all.slice((page - 1) * 10, page * 10) };
}
module.exports = { types, serviceTypes, targetId, executionFields, get, current, list };
