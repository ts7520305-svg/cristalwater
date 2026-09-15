'use strict';
const { prisma } = require('../../prismaClient');
const { buildClientPaymentReference } = require('../../utils/clientPaymentReference');
const { createCreditLedgerPayment, invoiceOpen, invoicePaid, invoiceStatus, invoiceTotal, moneyLabel } = require('../../services/clientCreditService');
const { prepareClientPaymentRequest, paymentDetails, executePaymentRequest, cashMethod } = require('../../services/invoicePaymentRequestService');

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
const cents = amount => Math.round(Number(amount || 0) * 100);

async function registerReceived(clientId, month, body = {}, user = null, transaction = null) {
  body = { ...body, method: cashMethod(body.method) };
  const id = Number(clientId);
  if (!Number.isSafeInteger(id) || id <= 0) fail('Cliente inválido.');
  const request = prepareClientPaymentRequest(id, month, body, user), details = request || paymentDetails(body);
  const { amountCents, method, notes } = details;
  const run = tx => executePaymentRequest(tx, request, async () => {
    // Serialize allocations for this client, then acquire invoice locks in the
    // same order before touching the client row (invoice payments do this too).
    const allocationKey = `client-receipt:${id}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${allocationKey}))::text`;
    const client = await tx.client.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!client) fail('Cliente não encontrado.', 404);
    const locked = await tx.$queryRaw`SELECT id FROM "Invoice" WHERE "clientId" = ${id} ORDER BY id FOR UPDATE`;
    const openInvoices = await tx.invoice.findMany({
      where: { clientId: id, id: { in: locked.map(row => row.id) } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    let remainingCents = amountCents;
    const payments = [], invoices = [], allocations = [], reference = buildClientPaymentReference(id);
    for (const invoice of openInvoices) {
      if (!remainingCents) break;
      const openCents = cents(invoiceOpen(invoice));
      if (openCents <= 0) continue;
      const appliedCents = Math.min(remainingCents, openCents), paidCents = cents(invoicePaid(invoice)) + appliedCents;
      const openAfter = (openCents - appliedCents) / 100, paidAfter = paidCents / 100;
      const status = invoiceStatus(invoiceTotal(invoice), paidAfter, openAfter);
      const payment = await tx.payment.create({ data: {
        invoiceId: invoice.id, amount: appliedCents / 100, amountCents: appliedCents, method,
        notes: [reference, notes, `Aplicado a fatura #${invoice.id}`].filter(Boolean).join(' | '),
      } });
      invoices.push(await tx.invoice.update({ where: { id: invoice.id }, data: {
        amountPaid: paidAfter, amountOpen: openAfter, status, paidAt: status === 'PAID' ? new Date() : invoice.paidAt, paymentMethod: method,
      } }));
      payments.push(payment); allocations.push({ invoiceId: invoice.id, paymentId: payment.id, amountCents: appliedCents });
      remainingCents -= appliedCents;
    }
    const credit = remainingCents > 0 ? await createCreditLedgerPayment(tx, id, remainingCents / 100, { monthRef: month, method, notes, paymentReference: reference }) : { creditAdded: 0 };
    const remainingInvoices = await tx.invoice.findMany({ where: { clientId: id } });
    const openCents = remainingInvoices.reduce((sum, invoice) => sum + Math.max(cents(invoiceOpen(invoice)), 0), 0);
    const updatedClient = await tx.client.update({ where: { id }, data: { lastPaymentAt: new Date(), paymentStatus: openCents > 0 ? 'PARTIAL' : 'PAID' } });
    const applied = (amountCents - remainingCents) / 100;
    await tx.communicationLog.create({ data: {
      clientId: id, channel: 'ADMIN_MANUAL_PAYMENT', referenceId: payments[0]?.id || credit.payment?.id || null,
      message: [`Pagamento confirmado pelo administrador. Ref. ${reference}. Valor ${moneyLabel(amountCents / 100)}. Metodo ${method}.`,
        applied > 0 ? `Aplicado em faturas: ${moneyLabel(applied)}.` : 'Sem faturas em aberto para abater.',
        credit.creditAdded > 0 ? `Credito positivo criado: ${moneyLabel(credit.creditAdded)}.` : '', notes ? `Nota: ${notes}` : ''].filter(Boolean).join(' '),
    } });
    return {
      ok: true, clientId: id, month, payments, invoices, allocations, appliedAmount: applied, creditAdded: credit.creditAdded || 0,
      creditBalance: Number(updatedClient.creditBalance || 0), creditPaymentId: credit.payment?.id || null, remainingOpen: openCents / 100, paymentReference: reference,
      message: credit.creditAdded > 0 ? `Pagamento registado. ${moneyLabel(applied)} abatido e ${moneyLabel(credit.creditAdded)} ficou em credito positivo.` : `Pagamento registado em ${client.name} com referencia ${reference}.`,
    };
  });
  return transaction ? run(transaction) : prisma.$transaction(run, { maxWait: 15000, timeout: 15000 });
}

module.exports = { registerReceived };
