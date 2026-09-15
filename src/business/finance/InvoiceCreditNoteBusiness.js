'use strict';
const { prisma } = require('../../prismaClient');
const { preparePaymentRequest, executePaymentRequest } = require('../../services/invoicePaymentRequestService');
const { isReceivableInvoice, invoiceTotal, invoiceStatus } = require('../../services/clientCreditService');
const { EVENT_TYPES, emitFinanceEvent } = require('../../services/financeOsEventService');
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
const cents = value => Math.round(Number(value || 0) * 100);
async function create(invoiceId, payload = {}, actor = 'finance-os', user = null) {
  const id = Number(invoiceId);
  if (!/^\d+$/.test(String(invoiceId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail('Fatura inválida.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !payload.requestId) fail('Identifique a nota de crédito com um pedido único.');
  if (typeof payload.reason !== 'string' || !payload.reason.trim() || payload.reason.length > 2000) fail('Indique o motivo da nota de crédito.');
  const prepared = preparePaymentRequest(id, { ...payload, method: 'CREDIT_NOTE' }, user);
  if (prepared.amountCents > 2147483647) fail('Valor fora do limite permitido.');
  const request = { ...prepared, scope: 'INVOICE_CREDIT_NOTE', reason: payload.reason.trim() };
  const result = await prisma.$transaction(tx => executePaymentRequest(tx, request, async () => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { lines: true, payments: true } });
    if (!invoice) fail('Fatura não encontrada.', 404);
    if (!isReceivableInvoice(invoice)) fail('Este documento não admite uma nota de crédito.', 409);
    const totalBefore = cents(invoiceTotal(invoice)), paid = cents(invoice.amountPaid);
    if (request.amountCents > totalBefore) fail('A nota excede o valor restante da fatura.', 409);
    const lineSum = invoice.lines.reduce((sum, line) => sum + cents(line.total || line.lineTotal), 0);
    const paymentSum = invoice.payments.reduce((sum, payment) => sum + cents(payment.amount), 0);
    if ((invoice.lines.length && lineSum !== totalBefore) || paymentSum !== paid || paid < 0 || totalBefore > 2147483647) fail('O histórico da fatura precisa de revisão antes do ajuste.', 409);
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${invoice.clientId} FOR NO KEY UPDATE`;
    const client = await tx.client.findUniqueOrThrow({ where: { id: invoice.clientId } });
    const totalAfter = totalBefore - request.amountCents;
    const creditCents = Math.max(paid - totalAfter, 0) - Math.max(paid - totalBefore, 0);
    const creditAfter = cents(client.creditBalance) + creditCents;
    if (!Number.isSafeInteger(creditAfter) || creditAfter < 0) fail('Saldo do cliente inválido.', 409);
    if (!invoice.lines.length) await tx.invoiceLine.create({ data: { invoiceId: id, type: 'LEGACY_BALANCE', lineType: 'LEGACY_BALANCE',
      description: 'Valor original do documento sem detalhe de linhas', quantity: 1, unitPrice: totalBefore / 100, total: totalBefore / 100, lineTotal: totalBefore / 100 } });
    const line = await tx.invoiceLine.create({ data: { invoiceId: id, type: 'CREDIT_NOTE', lineType: 'CREDIT_NOTE', description: request.reason,
      quantity: 1, unitPrice: -request.amountCents / 100, total: -request.amountCents / 100, lineTotal: -request.amountCents / 100,
      sourceMonth: new Date().toISOString().slice(0, 7), notes: request.notes || null } });
    const open = Math.max(totalAfter - paid, 0), status = invoiceStatus(totalAfter, paid, open);
    await tx.invoice.update({ where: { id }, data: { total: totalAfter / 100, totalAmount: totalAfter / 100, amount: totalAfter / 100,
      amountCents: totalAfter, totalCents: totalAfter, amountOpen: open / 100, status,
      paidAt: status === 'PAID' ? invoice.paidAt || new Date() : invoice.paidAt } });
    // Releasing an already paid amount creates available credit, not new cash.
    // Preserve every original payment and add only the newly released excess.
    if (creditCents) await tx.client.update({ where: { id: client.id }, data: { creditBalance: creditAfter / 100 } });
    await tx.auditTrail.create({ data: { action: 'FINANCE_CREDIT_NOTE_CREATED', eventType: 'FINANCE_CREDIT_NOTE_CREATED', entity: 'Invoice', entityId: id,
      clientId: client.id, userId: request.actorId, message: request.reason,
      beforeJson: { totalCents: totalBefore, creditCents: cents(client.creditBalance) }, afterJson: { totalCents: totalAfter, creditCents: creditAfter },
      metadata: { requestId: request.requestId, lineId: line.id, amountCents: request.amountCents, creditCents, actor, kind: 'NON_CASH_CREDIT_NOTE' } } });
    await tx.notification.create({ data: { clientId: client.id, type: 'CREDIT_NOTE', eventType: 'FINANCE_CREDIT_NOTE_CREATED', title: 'Nota de crédito registada',
      message: `Nota de crédito interna de ${(request.amountCents / 100).toFixed(2)} EUR na fatura #${id}.`, role: 'CLIENT', severity: 'INFO', status: 'PENDING', metadata: { invoiceId: id, lineId: line.id } } });
    await tx.communicationLog.create({ data: { clientId: client.id, channel: 'INVOICE_CREDIT_NOTE', referenceId: line.id,
      message: `Fatura #${id}: nota de crédito interna de ${(request.amountCents / 100).toFixed(2)} EUR; crédito disponível acrescentado: ${(creditCents / 100).toFixed(2)} EUR. Motivo: ${request.reason}` } });
    return { ok: true, kind: 'NON_CASH_CREDIT_NOTE', invoice: await tx.invoice.findUnique({ where: { id }, include: { client: true, lines: true, payments: true } }),
      creditNoteId: line.id, creditNoteAmount: request.amountCents / 100, appliedAmount: (request.amountCents - creditCents) / 100,
      creditAdded: creditCents / 100, creditBalance: creditAfter / 100 };
  }), { maxWait: 15000, timeout: 15000 });
  if (!result.idempotent) await emitFinanceEvent(EVENT_TYPES.FINANCE_CREDIT_NOTE_CREATED, { invoiceId: id, clientId: result.invoice.clientId, amount: result.creditNoteAmount, actor });
  return result;
}
module.exports = { create };
