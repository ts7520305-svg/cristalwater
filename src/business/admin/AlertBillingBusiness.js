'use strict';
const { prisma } = require('../../prismaClient');
const { roleMatches } = require('../../utils/roles');
const { parseReference, resolutionVersion, expectedVersion, fail } = require('../../services/alertResolutionStateService');
const { lock } = require('./AlertResolutionBusiness');
const finance = require('../finance/FinanceOsBusiness');
const model = { notification: 'notification', technical: 'technicalAlert', visit: 'serviceVisit', generic: 'alert' };
function cents(value) {
  if (typeof value !== 'string' && typeof value !== 'number') fail(400, 'Valor invalido');
  const text = String(value).trim().replace(',', '.');
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) fail(400, 'Indique um valor positivo com ate duas casas decimais');
  const [whole, part = ''] = text.split('.'), result = Number(whole) * 100 + Number(part.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result <= 0 || result > 2147483647) fail(400, 'Valor fora do intervalo permitido');
  return result;
}
function input(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Pedido de faturacao invalido');
  const amountCents = cents(body.price === undefined ? body.amount : body.price);
  if (body.price !== undefined && body.amount !== undefined && cents(body.amount) !== amountCents) fail(400, 'Valores de faturacao diferentes');
  const clientId = body.expectedClientId === undefined ? null : body.expectedClientId;
  if (clientId !== null && (!Number.isInteger(clientId) || clientId <= 0 || clientId > 2147483647)) fail(400, 'Cliente invalido');
  return { amountCents, clientId, version: expectedVersion(body.expectedVersion) };
}
async function convert(user, rawReference, body = {}) {
  if (!roleMatches(user?.role, 'ADMIN') || !Number.isInteger(user?.id) || user.id <= 0) fail(403, 'Apenas a gestao pode preparar faturacao');
  const parsed = parseReference(rawReference), requested = `${parsed.source}-${parsed.id}`, values = input(body);
  return prisma.$transaction(async tx => {
    // Receipts outlive the source and never depend on the current calendar month.
    const previous = await tx.operationalReminder.findFirst({ where: { sourceKey: { startsWith: 'alert-billing:' },
      metadata: { path: ['references'], array_contains: [requested] } } });
    function replay(receipt) {
      const result = receipt.metadata.result;
      if (result.amountCents !== values.amountCents || (values.clientId && values.clientId !== result.clientId)) {
        fail(409, `Este alerta ja foi preparado no rascunho #${result.invoiceId}, por ${(result.amountCents / 100).toFixed(2)} EUR. Reveja esse documento.`);
      }
      return { ...result, reference: requested, idempotent: true };
    }
    if (previous) return replay(previous);
    const initial = await tx[model[parsed.source]].findUnique({ where: { id: parsed.id } });
    if (!initial) fail(404, 'Alerta nao encontrado');
    const linkedId = parsed.source === 'notification' ? initial.metadata?.alertId : null;
    if (parsed.source === 'notification' && initial.eventType === 'MANUAL_POOL_ALERT' && !linkedId) fail(409, 'Aviso manual antigo sem associacao segura. Prepare o rascunho a partir do alerta tecnico original.');
    if (linkedId !== null && linkedId !== undefined && (!Number.isInteger(linkedId) || linkedId <= 0 || linkedId > 2147483647)) fail(409, 'Associacao do alerta invalida. Reveja o contexto.');
    const canonical = linkedId ? { source: 'technical', id: linkedId } : parsed;
    const reference = `${canonical.source}-${canonical.id}`, sourceKey = `alert-billing:${reference}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceKey}))::text`;
    await lock(tx, canonical.source, canonical.id);
    if (reference !== requested) await lock(tx, parsed.source, parsed.id);
    const source = await tx[model[parsed.source]].findUnique({ where: { id: parsed.id } });
    const root = reference === requested ? source : await tx.technicalAlert.findUnique({ where: { id: canonical.id } });
    if (!source || !root) fail(404, 'Alerta associado nao encontrado');
    if (reference !== requested && source.metadata?.alertId !== canonical.id) fail(409, 'O alerta foi alterado. Atualize a lista.');
    const receipt = await tx.operationalReminder.findUnique({ where: { sourceKey } });
    if (receipt) return replay(receipt);
    if (values.version && values.version !== resolutionVersion(parsed.source, source)) fail(409, 'O alerta foi alterado. Atualize a lista e confirme novamente.');
    const linkedNotices = canonical.source === 'technical' ? await tx.notification.findMany({ where: { metadata: { path: ['alertId'], equals: canonical.id } }, select: { metadata: true } }) : [];
    if (source.metadata?.repairId || linkedNotices.some(row => row.metadata?.repairId)) fail(409, 'Este alerta pertence a uma reparacao. Prepare a faturacao no fluxo da reparacao para evitar duplicacoes.');
    let pool = null;
    if (root.poolId) {
      await tx.$queryRaw`SELECT id FROM "Pool" WHERE id = ${root.poolId} FOR SHARE`;
      pool = await tx.pool.findUnique({ where: { id: root.poolId } });
    }
    const clientId = canonical.source === 'technical' ? pool?.clientId : root.clientId || pool?.clientId;
    if (!clientId) fail(400, 'Alerta sem cliente associado');
    if ((values.clientId && values.clientId !== clientId) || (reference !== requested && source.clientId && source.clientId !== clientId)) fail(409, 'O cliente do alerta foi alterado. Atualize e reveja o destino.');
    const legacy = await tx.invoiceLine.findFirst({ where: { lineType: 'ALERT', referenceId: { in: [...new Set([parsed.id, canonical.id])] },
      invoice: { clientId }, OR: [{ notes: null }, { NOT: { notes: { startsWith: 'alert-billing:' } } }] } });
    if (legacy) fail(409, `Existe uma linha antiga possivelmente associada na fatura #${legacy.invoiceId}. Reveja-a antes de preparar outra.`);
    const amount = values.amountCents / 100;
    const draft = await finance.createDraftInvoice({ clientId, standalone: true, notes: `Extra preparado a partir de ${reference}; rever antes de emitir.`,
      lines: [{ type: 'REPAIR', description: root.message || root.alerts || root.reason || 'Servico associado a alerta', quantity: 1, unitPrice: amount, total: amount, notes: sourceKey }] }, `ADMIN:${user.id}`, tx);
    if (!draft.ok) fail(draft.status || 409, draft.error);
    const line = draft.invoice.lines[0];
    await tx.invoiceLine.update({ where: { id: line.id }, data: { lineType: 'ALERT', referenceId: canonical.id, sourceMonth: draft.invoice.month } });
    await tx.invoice.update({ where: { id: draft.invoice.id }, data: { amountCents: values.amountCents, totalCents: values.amountCents, subtotal: amount, subtotalCurrent: amount } });
    const result = { ok: true, invoiceId: draft.invoice.id, invoiceLineId: line.id, amount, amountCents: values.amountCents,
      clientId, reference: requested, convertedReference: reference, preparedAt: new Date().toISOString(), status: 'DRAFT' };
    await tx.operationalReminder.create({ data: { sourceKey, title: 'Rascunho de alerta preparado', dueDate: new Date(), isCompleted: true,
      metadata: { actor: `ADMIN:${user.id}`, references: [...new Set([requested, reference])], original: JSON.parse(JSON.stringify(source)), result } } });
    return result;
  }, { timeout: 30000 });
}
module.exports = { convert, cents, input };
