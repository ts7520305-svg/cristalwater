'use strict';
const { prisma } = require('../../prismaClient');
const { prepareClientPaymentRequest, executePaymentRequest } = require('../../services/invoicePaymentRequestService');
const { isReceivableInvoice, invoiceOpen, invoicePaid, invoiceTotal } = require('../../services/clientCreditService');
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
const cents = amount => Math.round(Number(amount || 0) * 100);
async function adjust(clientId, body = {}, user) {
  if (!body.requestId) fail('Atualize o ecrã e confirme o ajuste com um identificador de pedido.');
  if (body.method !== undefined && body.method !== 'ADJUSTMENT') fail('Um ajuste de crédito não é um recebimento.');
  const prepared = prepareClientPaymentRequest(clientId, body.month, { ...body, method: 'ADJUSTMENT' }, user);
  if (!prepared.notes) fail('Indique o motivo do crédito interno.');
  if (!Number.isSafeInteger(body.expectedCreditCents) || body.expectedCreditCents < 0) fail('Consulte o saldo antes de confirmar o ajuste.');
  const request = { ...prepared, scope: 'CREDIT_ADJUSTMENT', expectedCreditCents: body.expectedCreditCents };
  return prisma.$transaction(tx => executePaymentRequest(tx, request, async () => {
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${request.clientId} FOR NO KEY UPDATE`;
    const client = await tx.client.findUnique({ where: { id: request.clientId } });
    if (!client) fail('Cliente não encontrado.', 404);
    const before = cents(client.creditBalance), after = before + request.amountCents;
    if (before !== request.expectedCreditCents) fail('O crédito mudou. Reveja o saldo antes de confirmar outro ajuste.', 409);
    if (!Number.isSafeInteger(after)) fail('Valor de crédito fora do limite permitido.');
    const updated = await tx.client.update({ where: { id: client.id }, data: { creditBalance: after / 100 } });
    const audit = await tx.auditTrail.create({ data: {
      eventType: 'CLIENT_CREDIT_ADJUSTED', action: 'CLIENT_CREDIT_ADJUSTED', entity: 'Client', entityId: client.id,
      clientId: client.id, userId: request.actorId, message: request.notes,
      beforeJson: { creditCents: before }, afterJson: { creditCents: after },
      metadata: { requestId: request.requestId, amountCents: request.amountCents, kind: 'NON_CASH_ADJUSTMENT', month: request.month },
    } });
    await tx.communicationLog.create({ data: { clientId: client.id, channel: 'CREDIT_ADJUSTMENT', referenceId: audit.id,
      message: `Crédito interno atribuído: ${(request.amountCents / 100).toFixed(2)} EUR. Não é dinheiro recebido. Motivo: ${request.notes}` } });
    return { ok: true, kind: 'NON_CASH_ADJUSTMENT', adjustmentId: audit.id, clientId: client.id, month: request.month,
      client: { id: client.id, name: client.name, creditBalance: updated.creditBalance }, appliedAmount: 0,
      creditAdded: request.amountCents / 100, creditBalance: after / 100, beforeCreditCents: before, afterCreditCents: after };
  }), { maxWait: 15000, timeout: 15000 });
}
async function list(monthRef = new Date().toISOString().slice(0, 7)) {
  if (typeof monthRef !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthRef) || Number(monthRef.slice(0, 4)) === 0) fail('Mês inválido.');
  const [invoices, clients] = await Promise.all([
    prisma.invoice.findMany({ where: { monthRef }, include: { lines: true, client: { include: { pools: { select: { id: true } } } } }, orderBy: { id: 'asc' } }),
    prisma.client.findMany({ select: { id: true, name: true, creditBalance: true }, orderBy: { name: 'asc' } }),
  ]);
  const items = invoices.filter(isReceivableInvoice).map(row => ({ invoiceId: row.id, clientId: row.clientId, clientName: row.client.name,
    total: invoiceTotal(row), amountPaid: invoicePaid(row), amountOpen: invoiceOpen(row), status: row.status,
    creditBalance: Number(row.client.creditBalance || 0), poolIds: row.client.pools.map(pool => pool.id),
    lines: row.lines.map(line => ({ type: line.type, description: line.description, total: Number(line.total || 0) })) }));
  const totals = {
    totalClients: new Set(items.map(row => row.clientId)).size, totalPools: new Set(items.flatMap(row => row.poolIds)).size,
    totalAmount: items.reduce((sum, row) => sum + cents(row.total), 0) / 100,
    totalPaid: items.reduce((sum, row) => sum + cents(row.amountPaid), 0) / 100,
    totalOpen: items.reduce((sum, row) => sum + cents(row.amountOpen), 0) / 100,
  };
  return { ok: true, monthRef, clients, items, totals: { ...totals, total: totals.totalAmount, paid: totals.totalPaid, open: totals.totalOpen } };
}
module.exports = { adjust, list };
