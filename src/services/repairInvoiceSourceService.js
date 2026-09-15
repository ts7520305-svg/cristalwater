'use strict';
// Call after locking the client. All source IDs are locked in the same order,
// including when a pool moves between clients; history is never inferred from text.
async function reservedRepairIds(tx, repairIds) {
  const ids = [...new Set(repairIds)].sort((a, b) => a - b);
  for (const id of ids) {
    const key = `repair-billing:${id}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
  }
  if (!ids.length) return new Set();
  const lines = await tx.invoiceLine.findMany({ where: {
    referenceId: { in: ids }, OR: [{ type: 'REPAIR' }, { lineType: 'REPAIR' }],
  }, select: { referenceId: true } });
  return new Set(lines.map(line => line.referenceId));
}
module.exports = { reservedRepairIds };
