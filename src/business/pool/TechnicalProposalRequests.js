'use strict';
const { createHash } = require('node:crypto');
const { prisma } = require('../../prismaClient');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function fail(message, statusCode = 400, publicCode = 'INVALID_TECHNICAL_PROPOSAL_REQUEST') { throw Object.assign(new Error(message), { statusCode, publicCode }); }
const allowed = {
  CREATE: ['reason', 'changes', 'photos', 'riskLevel', 'asDraft'],
  WORKFLOW: ['nextStatus', 'note', 'expectedVersion'],
  BATCH: ['proposalIds', 'nextStatus', 'note', 'expectedVersions'],
  APPLY: ['expectedVersion', 'expectedSheetVersion', 'expectedEffectsHash', 'resolutions'],
};
function context(actor, poolId, proposalId, action, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Pedido de proposta inválido.');
  if (body.requestId === undefined && action !== 'APPLY') return null;
  if (typeof body.requestId !== 'string' || !uuid.test(body.requestId) || Object.keys(body).some(key => key !== 'requestId' && !allowed[action].includes(key))) fail('Conserve o pedido original da proposta.');
  if (['WORKFLOW', 'APPLY'].includes(action) && !/^technical-proposal-v1:[0-9a-f]{64}$/.test(body.expectedVersion)) fail('É necessária a versão revista da proposta.');
  const intent = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'requestId'));
  return { actorKey: actor.key, requestId: body.requestId.toLowerCase(), poolId, proposalId, action, payloadHash: hash({ v: 1, poolId, proposalId, action, intent }) };
}
async function lock(tx, request) { await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`technical-proposal:${request.actorKey}:${request.requestId}`}))::text`; }
const where = request => ({ actorKey_requestId: { actorKey: request.actorKey, requestId: request.requestId } });
function matches(saved, request) {
  if (saved.payloadHash !== request.payloadHash || saved.poolId !== request.poolId || saved.action !== request.action || saved.proposalId !== request.proposalId) fail('Este identificador pertence a outro pedido. Conserve o envio original.', 409, 'TECHNICAL_PROPOSAL_REQUEST_REUSED');
}
async function run(request, writer, parent = null) {
  return prisma.$transaction(async tx => {
    if (parent) {
      await lock(tx, parent);
      const batch = await tx.technicalProposalRequest.findUniqueOrThrow({ where: where(parent) }); matches(batch, parent);
      if (batch.response) return { batchComplete: true, response: { ...batch.response, replayed: true } };
    }
    if (request) {
      await lock(tx, request);
      const saved = await tx.technicalProposalRequest.findUnique({ where: where(request) });
      if (saved) {
        matches(saved, request);
        if (!saved.response) fail('O comprovativo deste pedido precisa de revisão.', 409, 'TECHNICAL_PROPOSAL_REQUEST_REUSED');
        return { response: { ...saved.response, replayed: true } };
      }
    }
    const result = await writer(tx);
    result.response = JSON.parse(JSON.stringify({ ...result.response, ...(request ? { replayed: false, receipt: { scope: 'TECHNICAL_PROPOSAL', ...request } } : {}) }));
    if (request) await tx.technicalProposalRequest.create({ data: { ...request, response: result.response } });
    return result;
  }, { maxWait: 15000, timeout: request?.action === 'BATCH' ? 60000 : 20000 });
}
async function batch(request, ids, execute) {
  const existing = await prisma.$transaction(async tx => {
    await lock(tx, request);
    const saved = await tx.technicalProposalRequest.findUnique({ where: where(request) });
    if (saved) { matches(saved, request); return saved.response; }
    await tx.technicalProposalRequest.create({ data: request }); return null;
  });
  if (existing) return { ...existing, replayed: true };
  // No connection is held while an item commits. Each item and finalization
  // take the parent lock, so a finalized batch cannot gain a late success.
  const outcome = await execute();
  return prisma.$transaction(async tx => {
    await lock(tx, request);
    const saved = await tx.technicalProposalRequest.findUniqueOrThrow({ where: where(request) }); matches(saved, request);
    if (saved.response) return { ...saved.response, replayed: true };
    const children = await tx.technicalProposalRequest.findMany({ where: { actorKey: request.actorKey, requestId: { in: ids.map(id => itemId(request.requestId, id)) }, action: 'WORKFLOW' } });
    const updated = [], failed = [];
    for (const id of ids) {
      const child = children.find(row => row.requestId === itemId(request.requestId, id));
      if (child?.response?.ok === true) updated.push(child.response.proposal);
      else failed.push(outcome.failed.find(item => item.proposalId === id) || { proposalId: id, status: 500, error: 'Decisão não confirmada.' });
    }
    const response = { ...outcome, ok: failed.length === 0, updated, failed, updatedCount: updated.length, failedCount: failed.length, replayed: false, receipt: { scope: 'TECHNICAL_PROPOSAL', ...request } };
    await tx.technicalProposalRequest.update({ where: where(request), data: { response } });
    return response;
  }, { maxWait: 15000, timeout: 20000 });
}
function itemId(requestId, proposalId) {
  const chars = hash({ requestId, proposalId }).slice(0, 32).split(''); chars[12] = '5'; chars[16] = '8'; const hex = chars.join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
module.exports = { context, run, batch, itemId, hash };
