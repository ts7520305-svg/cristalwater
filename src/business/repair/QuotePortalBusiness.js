const repository = require('../../dal/RepairRepository');
const RepairBusiness = require('./RepairBusiness');
const fail = (status, error) => ({ ok: false, status, error });
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
function publicQuote(publication, now = new Date()) {
  const quote = publication.quote, repair = quote.repair, s = quote.snapshot;
  const latest = repair.quotes[0]?.id === quote.id;
  const until = new Date(s.validUntil);
  const status = publication.decision || (!latest ? 'SUPERSEDED' : repair.status !== 'QUOTED' ? 'UNAVAILABLE' : !Number.isFinite(+until) || until <= now ? 'EXPIRED' : 'PENDING');
  return { id: quote.id, repairId: quote.repairId, version: quote.version,
    poolName: repair.pool.name, problem: repair.problem, publishedAt: publication.publishedAt,
    validUntil: s.validUntil, status, decisionAt: publication.decisionAt,
    currency: s.currency, lines: s.lines.map(line => ({ type: line.type, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, total: line.total })),
    subtotal: s.subtotal, discount: s.discount, net: s.net, taxPercent: s.taxPercent, tax: s.tax, total: s.total, terms: s.terms };
}
async function list(clientId) {
  if (!validId(clientId)) return fail(400, 'Cliente inválido');
  const rows = await repository.prisma.repairQuotePortal.findMany({
    where: { clientId: Number(clientId), quote: { repair: { pool: { clientId: Number(clientId) } } } },
    include: { quote: { include: { repair: { include: { pool: { select: { name: true } }, quotes: { orderBy: { version: 'desc' }, take: 1, select: { id: true } } } } } } },
    orderBy: { publishedAt: 'desc' }, take: 100,
  });
  return { ok: true, quotes: rows.map(row => publicQuote(row)) };
}
async function publish(repairId, quoteId, actor) {
  if (!validId(repairId) || !validId(quoteId)) return fail(400, 'Orçamento inválido');
  const id = Number(repairId), qid = Number(quoteId);
  return repository.transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Repair" WHERE id = ${id} FOR UPDATE`;
    const scope = await tx.repair.findUnique({ where: { id }, select: { poolId: true } });
    if (scope?.poolId) await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${scope.poolId} FOR SHARE`;
    const repair = await tx.repair.findUnique({ where: { id }, include: { pool: { select: { clientId: true } } } });
    if (!repair) return fail(404, 'Reparação não encontrada');
    const quote = await tx.repairQuote.findFirst({ where: { repairId: id }, orderBy: { version: 'desc' } });
    if (quote?.id !== qid || repair.status !== 'QUOTED') return fail(409, 'Publique apenas a versão atual de uma reparação por aprovar');
    if (!repair.pool?.clientId) return fail(409, 'Piscina sem cliente associado');
    const until = new Date(quote.snapshot.validUntil);
    if (!Number.isFinite(+until) || until <= new Date()) return fail(409, 'Orçamento expirado. Grave uma nova versão.');
    const prior = await tx.repairQuotePortal.findUnique({ where: { quoteId: qid } });
    if (prior) return prior.clientId === repair.pool.clientId ? { ok: true, alreadyPublished: true } : fail(409, 'Cliente alterado. Grave uma nova versão.');
    await tx.repairQuotePortal.create({ data: { quoteId: qid, clientId: repair.pool.clientId, publishedBy: actor } });
    await tx.notification.create({ data: { clientId: repair.pool.clientId, role: 'CLIENT', type: 'QUOTE_AVAILABLE', title: 'Orçamento disponível', message: `O orçamento da reparação #${id}, versão ${quote.version}, está disponível no portal para consulta e decisão.`, metadata: { repairId: id, quoteId: qid, href: '/client-portal#clientQuotes' } } });
    await tx.userAuditLog.create({ data: { actor, action: 'REPAIR_QUOTE_PUBLISHED', entity: 'RepairQuote', entityId: String(qid), metadata: { clientId: repair.pool.clientId, version: quote.version } } });
    return { ok: true, alreadyPublished: false };
  });
}
async function decide(clientId, quoteId, payload = {}) {
  if (!validId(clientId) || !validId(quoteId)) return fail(400, 'Orçamento inválido');
  if (!['APPROVED', 'DECLINED'].includes(payload.decision) || payload.confirm !== true) return fail(400, 'Confirme explicitamente a decisão sobre este orçamento');
  if (payload.reason != null && (typeof payload.reason !== 'string' || payload.reason.length > 1000)) return fail(400, 'Motivo inválido, máximo 1000 caracteres');
  const cid = Number(clientId), qid = Number(quoteId);
  return repository.transaction(async tx => {
    const owned = await tx.repairQuotePortal.findFirst({ where: { quoteId: qid, clientId: cid, quote: { repair: { pool: { clientId: cid } } } }, select: { quote: { select: { repairId: true } } } });
    if (!owned) return fail(404, 'Orçamento não encontrado');
    const repairId = owned.quote.repairId;
    await tx.$queryRaw`SELECT id FROM "Repair" WHERE id = ${repairId} FOR UPDATE`;
    const scope = await tx.repair.findUnique({ where: { id: repairId }, select: { poolId: true } });
    if (scope?.poolId) await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${scope.poolId} FOR SHARE`;
    const publication = await tx.repairQuotePortal.findFirst({ where: { quoteId: qid, clientId: cid, quote: { repair: { pool: { clientId: cid } } } }, include: { quote: { include: { repair: { include: { pool: { select: { name: true } }, quotes: { orderBy: { version: 'desc' }, take: 1, select: { id: true } } } } } } } });
    if (!publication) return fail(404, 'Orçamento não encontrado');
    if (publication.decision) return publication.decision === payload.decision ? { ok: true, alreadyDecided: true, decision: publication.decision } : fail(409, 'Já existe uma decisão registada. Contacte a administração para alterar.');
    if (publicQuote(publication).status !== 'PENDING') return fail(409, 'Orçamento alterado, expirado ou indisponível. Atualize a lista.');
    const actor = `CLIENT:${cid}`;
    if (payload.decision === 'APPROVED') {
      const result = await RepairBusiness.approveRepair(repairId, tx, actor, { quoteId: qid, approvalReference: `Confirmação autenticada no portal pelo cliente ${cid}, versão ${publication.quote.version}` });
      if (!result.ok) return result;
    }
    await tx.repairQuotePortal.update({ where: { quoteId: qid }, data: { decision: payload.decision, decisionAt: new Date(), reason: payload.reason?.trim() || null } });
    await tx.userAuditLog.create({ data: { actor, action: 'CLIENT_QUOTE_DECISION', entity: 'RepairQuote', entityId: String(qid), metadata: { clientId: cid, decision: payload.decision, version: publication.quote.version, total: publication.quote.snapshot.total, currency: publication.quote.snapshot.currency } } });
    await tx.notification.create({ data: { role: 'ADMIN', type: 'CLIENT_QUOTE_DECISION', title: 'Resposta ao orçamento', message: `O cliente ${cid} ${payload.decision === 'APPROVED' ? 'aprovou' : 'recusou'} o orçamento da reparação #${repairId}, versão ${publication.quote.version}.`, metadata: { clientId: cid, repairId, quoteId: qid, decision: payload.decision } } });
    return { ok: true, alreadyDecided: false, decision: payload.decision };
  });
}
module.exports = { publicQuote, list, publish, decide };
