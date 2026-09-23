'use strict';
const r = require('./expenseLedgerRules'), execution = require('./repairExecutionService');
const select = { id: true, poolId: true, problem: true, quantity: true, createdAt: true, status: true, doneAt: true, pool: { select: { name: true } } };
const proofFields = ['executionBasis', 'executionProofId', 'executionFingerprint', 'materialMode'];
const positive = n => Number.isSafeInteger(n) && n > 0;
async function read(db, ids) {
  if (!ids.length) return [];
  const [repairs, context] = await Promise.all([db.repair.findMany({ where: { id: { in: ids } }, select }), execution.load(db, ids)]);
  // The authenticated completion owns the historical client identity. A later
  // pool transfer, invoice or sale-price change must not move an expense.
  const clientIds = [...new Set([...context.proofs.values()].flat().map(p => p.clientId).filter(positive))];
  const clients = new Map((await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })).map(c => [c.id, c]));
  return repairs.map(repair => {
    const proofs = context.proofs.get(repair.id) || [], proof = proofs.length === 1 ? proofs[0] : null, client = clients.get(proof?.clientId);
    const state = execution.evaluate(context, repair, client?.id), valid = !!client && state.state === 'CONFIRMED';
    const facts = { type: 'REPAIR', id: repair.id, clientId: client?.id || null, poolId: repair.poolId, status: state.state, startAt: null, endAt: state.confirmedAt,
      executionBasis: valid ? execution.basis : null, executionProofId: valid ? proof.id : null, executionFingerprint: valid ? proof.metadata.fingerprint : null, materialMode: valid ? proof.metadata.schema === 2 ? 'NONE' : 'RESERVED' : null };
    const label = 'Reparação #' + repair.id + ' · ' + (repair.pool?.name || 'Sem instalação') + ' · ' + (state.confirmedAt?.slice(0, 10) || 'Execução por confirmar');
    return { type: 'REPAIR', id: repair.id, clientId: facts.clientId, clientName: client?.name || null, label, valid, hash: r.hash(facts), snapshot: { ...facts, label, clientName: client?.name || null },
      warning: valid ? 'Execução confirmada em ' + state.confirmedAt.slice(0, 10) + '. Confirme a parcela da despesa e o mês; o preço da reparação não determina o custo.' : 'A execução autenticada e as suas fontes precisam de confirmação.' };
  });
}
async function get(db, id, lock) {
  if (!lock) return (await read(db, [id]))[0] || null;
  const before = (await read(db, [id]))[0];
  if (!before?.valid) return before || null;
  // Match completion's client -> repair order. Re-read every source after
  // acquiring locks; cost attribution never changes execution or inventory.
  await db.$queryRaw`SELECT id FROM "Client" WHERE id=${before.clientId} FOR SHARE`;
  await db.$queryRaw`SELECT id FROM "Repair" WHERE id=${id} FOR SHARE`;
  await db.$queryRaw`SELECT id FROM "AuditTrail" WHERE "eventType"=${execution.eventType} AND entity='Repair' AND "entityId"=${id} ORDER BY id FOR SHARE`;
  const context = await execution.load(db, [id]);
  for (const sourceId of [...context.reservations.keys()].sort((a, b) => a - b)) await db.$queryRaw`SELECT id FROM "OperationalLock" WHERE id=${sourceId} FOR SHARE`;
  for (const sourceId of [...context.movements.keys()].sort((a, b) => a - b)) await db.$queryRaw`SELECT id FROM "StockMovement" WHERE id=${sourceId} FOR SHARE`;
  const after = (await read(db, [id]))[0] || null;
  return after && after.clientId !== before.clientId ? { ...after, valid: false } : after;
}
async function list(db, clientId) {
  const proofs = await db.auditTrail.findMany({ where: { eventType: execution.eventType, entity: 'Repair', clientId }, select: { entityId: true } });
  return (await read(db, [...new Set(proofs.map(p => p.entityId).filter(positive))])).sort((a, b) => b.id - a.id);
}
module.exports = { get, read, list, proofFields };
