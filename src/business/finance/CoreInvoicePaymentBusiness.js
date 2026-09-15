const { assertPayableInvoice, createCreditLedgerPayment, invoiceOpen, invoicePaid, invoiceStatus, invoiceTotal } = require('../../services/clientCreditService');
const { preparePaymentRequest, executePaymentRequest, cashMethod } = require('../../services/invoicePaymentRequestService');

function fail(message, status) { throw Object.assign(new Error(message), { status }); }

async function registerPayment(prisma, id, body = {}, user = null) {
  body = { ...body, method: cashMethod(body.method) };
  const request = preparePaymentRequest(id, body, user);
  if (request) { id = request.invoiceId; body = { ...body, amount: request.amountCents / 100, method: request.method, notes: request.notes }; }
  return prisma.$transaction(async tx => executePaymentRequest(tx, request, async () => {
    // Read the balance only after acquiring the row lock. Concurrent payments
    // must see the previous committed payment rather than overwrite its totals.
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const current = await tx.invoice.findUnique({ where: { id } });
    if (!current) fail('Fatura não encontrada', 404);
    assertPayableInvoice(current);
    const requested = Number(body.amount);
    const amount = Number.isFinite(requested) ? requested : (current.amountOpen || current.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) fail('Valor invalido', 400);
    const open = invoiceOpen(current), applied = Math.min(amount, open);
    let payment = null, updated = current;
    if (applied > 0) {
      payment = await tx.payment.create({ data: { invoiceId: id, amount: applied, amountCents: Math.round(applied * 100), method: body.method || 'MANUAL', notes: body.notes || null } });
      const paidTotal = invoicePaid(current) + applied, openAfter = Math.max(open - applied, 0);
      updated = await tx.invoice.update({ where: { id }, data: {
        amountPaid: paidTotal, amountOpen: openAfter,
        status: invoiceStatus(invoiceTotal(current), paidTotal, openAfter),
        paidAt: openAfter <= 0 ? new Date() : current.paidAt,
        paymentMethod: body.method || 'MANUAL',
      } });
    }
    const surplus = Math.max(amount - applied, 0);
    const credit = surplus > 0 && current.clientId
      ? await createCreditLedgerPayment(tx, current.clientId, surplus, {
        monthRef: current.monthRef || new Date().toISOString().slice(0, 7),
        method: body.method || 'MANUAL', notes: body.notes || 'Excedente convertido em credito positivo.',
      }) : { creditAdded: 0 };
    return { payment, invoice: updated, appliedAmount: applied, creditAdded: credit.creditAdded || 0, creditBalance: credit.creditBalance };
  }), { maxWait: 15000, timeout: 15000 });
}

module.exports = { registerPayment };
