'use strict';
const { fail } = require('./fieldWriteRequestService');
// A monthly report is a source register, never proof that an invoice exists.
async function record(tx, visit) {
  if (visit.status !== 'DONE' || visit.billingMode !== 'EXTRA' || visit.includedInPackage) return;
  const amount = visit.totalPrice ?? visit.unitPrice ?? visit.price ?? 0;
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) fail('Preço da visita extra inválido. Peça revisão ao escritório.', 409);
  if (!cents) return;
  const pool = visit.pool || await tx.pool.findUnique({ where: { id: visit.poolId } });
  const clientId = visit.clientId || pool?.clientId;
  if (!clientId || (pool?.clientId && pool.clientId !== clientId)) fail('Cliente da visita extra por confirmar.', 409);
  const month = new Date(visit.scheduledAt).toISOString().slice(0, 7);
  // Callers hold the client lock before the visit row, as invoice generation does.
  const reports = await tx.monthlyReport.findMany({ where: { clientId, month, type: 'EXTRA_VISITS' }, orderBy: { id: 'asc' } });
  if (reports.some(report => !report.data || !Array.isArray(report.data.items))) fail('Relatório de extras ilegível. Conserve o histórico e peça revisão.', 409);
  const matches = reports.flatMap(report => report.data.items.filter(item => Number(item.visitId) === visit.id));
  if (matches.length > 1 || (matches[0] && (Math.round(Number(matches[0].amount) * 100) !== cents || Number(matches[0].poolId) !== visit.poolId))) fail('O histórico comercial desta visita precisa de revisão.', 409);
  const reserved = await tx.invoiceLine.findFirst({ where: { type: 'EXTRA_VISIT', referenceId: visit.id } });
  if (visit.billed || reserved) return;
  if (!matches.length) {
    const item = { visitId: visit.id, source: 'EXTRA_VISIT', poolId: visit.poolId, clientId, poolName: pool?.name || '', amount: cents / 100, date: visit.scheduledAt, billingMode: 'EXTRA', status: 'DONE', notes: visit.notes || null };
    const report = reports[0];
    if (report) await tx.monthlyReport.update({ where: { id: report.id }, data: { data: { ...report.data, items: [...report.data.items, item] } } });
    else await tx.monthlyReport.create({ data: { clientId, month, type: 'EXTRA_VISITS', data: { items: [item] } } });
  }
  await tx.extraVisit.update({ where: { id: visit.id }, data: { billingStatus: 'IN_MONTHLY_REPORT' } });
}
async function lockClient(tx, visit) {
  const clientId = visit.clientId || (visit.poolId ? (await tx.pool.findUnique({ where: { id: visit.poolId }, select: { clientId: true } }))?.clientId : null);
  if (clientId) await tx.$queryRaw`SELECT id FROM "Client" WHERE id=${clientId} FOR NO KEY UPDATE`;
  return clientId;
}
async function pending(tx, clientId) {
  const rows = await tx.extraVisit.findMany({where:{billed:false,billingMode:'EXTRA',includedInPackage:false,status:{in:['DONE','COMPLETED','CONCLUIDA','CONCLUIDO']},...(clientId ? {pool:{clientId}} : {})},include:{pool:{include:{client:true}}},orderBy:{id:'asc'}});
  const reserved = new Set((await tx.invoiceLine.findMany({where:{type:'EXTRA_VISIT',referenceId:{in:rows.map(row=>row.id)}},select:{referenceId:true}})).map(row=>row.referenceId));
  return rows.filter(row=>!reserved.has(row.id)).map(row=>{
    const amount = Number(row.totalPrice ?? row.unitPrice ?? row.price ?? 0);
    if (!Number.isFinite(amount) || amount < 0 || !row.pool?.client || (row.clientId && row.clientId !== row.pool.clientId)) fail('Uma visita extra precisa de revisão comercial.',409);
    return {...row,price:Math.round(amount*100)/100};
  }).filter(row=>row.price>0);
}
module.exports = { record, lockClient, pending };
