const NON_RECEIVABLE_STATUSES = ['DRAFT', 'RASCUNHO', 'CANCELLED', 'CANCELED', 'CANCELADO', 'VOID', 'ARCHIVED', 'SUPERSEDED'];
function isReceivableInvoice(invoice = {}) {
  return !NON_RECEIVABLE_STATUSES.includes(String(invoice.status || '').trim().toUpperCase());
}
function assertPayableInvoice(invoice) {
  if (!isReceivableInvoice(invoice)) throw Object.assign(new Error('Este documento esta em rascunho ou foi retirado da cobranca. Reveja o seu estado antes de registar pagamentos.'), { status: 409 });
}

function toMoney(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function invoiceTotal(invoice = {}) {
  return Math.max(
    toMoney(invoice.total),
    toMoney(invoice.totalAmount),
    toMoney(invoice.amount)
  );
}

function invoicePaid(invoice = {}) {
  return toMoney(invoice.amountPaid);
}

function invoiceOpen(invoice = {}) {
  if (!isReceivableInvoice(invoice)) return 0;
  const direct = toMoney(invoice.amountOpen);
  if (direct > 0) return direct;
  return Math.max(invoiceTotal(invoice) - invoicePaid(invoice), 0);
}

function invoiceStatus(total, paid, open) {
  if (total <= 0 || open <= 0) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "PENDING";
}

function moneyLabel(value) {
  return `${toMoney(value).toFixed(2)} EUR`;
}

async function applyClientCreditToInvoice(db, invoiceInput, options = {}) {
  if (db.$transaction) return db.$transaction(tx => applyClientCreditToInvoice(tx, invoiceInput, options), { maxWait: 15000, timeout: 15000 });
  const invoiceId = Number(invoiceInput?.id || invoiceInput);
  if (!invoiceId) return { creditUsed: 0 };

  await db.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true },
  });
  if (!invoice || !invoice.clientId) return { creditUsed: 0 };
  if (!isReceivableInvoice(invoice)) return { creditUsed: 0, invoice };

  // Invoice first, then client: same order as receipt/payment writers. NO KEY
  // UPDATE remains compatible with foreign-key checks when another invoice is created.
  await db.$queryRaw`SELECT id FROM "Client" WHERE id = ${invoice.clientId} FOR NO KEY UPDATE`;
  const client = await db.client.findUnique({ where: { id: invoice.clientId } });
  invoice.client = client;
  const availableCents = Math.max(Math.round(toMoney(client?.creditBalance) * 100), 0);
  const openCents = Math.max(Math.round(invoiceOpen(invoice) * 100), 0);
  const creditCents = Math.min(availableCents, openCents), creditUsed = creditCents / 100;
  if (creditCents <= 0) return { creditUsed: 0, invoice };

  const paidAfter = (Math.round(invoicePaid(invoice) * 100) + creditCents) / 100;
  const openAfter = (openCents - creditCents) / 100;
  const total = invoiceTotal(invoice);
  const status = invoiceStatus(total, paidAfter, openAfter);
  const notes = [
    options.reference,
    options.notes,
    `Credito positivo abatido automaticamente: ${moneyLabel(creditUsed)}`,
  ].filter(Boolean).join(" | ");

  const payment = await db.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: creditUsed,
      amountCents: Math.round(creditUsed * 100),
      method: "CREDIT",
      notes,
    },
  });

  const updatedInvoice = await db.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: paidAfter,
      amountOpen: openAfter,
      status,
      paidAt: status === "PAID" ? new Date() : invoice.paidAt,
      paymentMethod: invoice.paymentMethod || "CREDIT",
    },
  });

  const clientInvoices = await db.invoice.findMany({ where: { clientId: invoice.clientId } });
  const hasOpenInvoices = clientInvoices.some(row => invoiceOpen(row) > 0);

  const updatedClient = await db.client.update({
    where: { id: invoice.clientId },
    data: {
      creditBalance: (availableCents - creditCents) / 100,
      paymentStatus: hasOpenInvoices ? "PARTIAL" : "PAID",
      lastPaymentAt: new Date(),
    },
  });

  await db.communicationLog.create({
    data: {
      clientId: invoice.clientId,
      channel: "CLIENT_CREDIT",
      message: `Credito positivo abatido na fatura #${invoice.id}: ${moneyLabel(creditUsed)}. Credito restante: ${moneyLabel(updatedClient.creditBalance)}.`,
      referenceId: payment.id,
    },
  });

  return {
    creditUsed,
    payment,
    invoice: updatedInvoice,
    creditBalance: toMoney(updatedClient.creditBalance),
  };
}

async function createCreditLedgerPayment(db, clientId, amount, options = {}) {
  const creditAmount = toMoney(amount);
  if (!clientId || creditAmount <= 0) return { creditAdded: 0 };

  const monthRef = options.monthRef || new Date().toISOString().slice(0, 7);
  const ledgerRef = `${monthRef}-CREDIT-${Date.now()}`;
  const paymentReference = options.paymentReference || `CW-${String(Number(clientId)).padStart(6, "0")}`;
  const notes = [
    paymentReference,
    options.notes,
    `Credito positivo recebido: ${moneyLabel(creditAmount)}`,
  ].filter(Boolean).join(" | ");

  const invoice = await db.invoice.create({
    data: {
      clientId,
      monthRef: ledgerRef,
      month: monthRef,
      year: Number(String(monthRef).slice(0, 4)) || new Date().getFullYear(),
      amount: 0,
      total: 0,
      totalAmount: 0,
      amountPaid: creditAmount,
      amountOpen: 0,
      status: "PAID",
      paymentMethod: options.method || "MANUAL",
      notes: "Registo de credito positivo do cliente.",
      paidAt: new Date(),
      lines: {
        create: [{
          type: "CREDIT_DEPOSIT",
          description: "Credito positivo recebido",
          quantity: 1,
          unitPrice: 0,
          total: 0,
          lineTotal: 0,
          notes,
        }],
      },
    },
  });

  const payment = await db.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: creditAmount,
      amountCents: Math.round(creditAmount * 100),
      method: options.method || "MANUAL",
      notes,
    },
  });

  const client = await db.client.update({
    where: { id: clientId },
    data: {
      creditBalance: { increment: creditAmount },
      paymentStatus: "PAID",
      lastPaymentAt: new Date(),
    },
  });

  await db.communicationLog.create({
    data: {
      clientId,
      channel: "CLIENT_CREDIT",
      message: `Credito positivo recebido: ${moneyLabel(creditAmount)}. Credito atual: ${moneyLabel(client.creditBalance)}.`,
      referenceId: payment.id,
    },
  });

  return {
    creditAdded: creditAmount,
    invoice,
    payment,
    creditBalance: toMoney(client.creditBalance),
  };
}

module.exports = {
  NON_RECEIVABLE_STATUSES,
  isReceivableInvoice,
  assertPayableInvoice,
  applyClientCreditToInvoice,
  createCreditLedgerPayment,
  invoiceOpen,
  invoicePaid,
  invoiceStatus,
  invoiceTotal,
  moneyLabel,
  toMoney,
};
