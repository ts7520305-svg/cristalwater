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
  const invoiceId = Number(invoiceInput?.id || invoiceInput);
  if (!invoiceId) return { creditUsed: 0 };

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true },
  });
  if (!invoice || !invoice.clientId) return { creditUsed: 0 };

  const client = invoice.client || await db.client.findUnique({ where: { id: invoice.clientId } });
  const availableCredit = toMoney(client?.creditBalance);
  const openBefore = invoiceOpen(invoice);
  const creditUsed = Math.min(availableCredit, openBefore);
  if (creditUsed <= 0) return { creditUsed: 0, invoice };

  const paidAfter = invoicePaid(invoice) + creditUsed;
  const openAfter = Math.max(openBefore - creditUsed, 0);
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

  const remainingOpenInvoices = await db.invoice.count({
    where: {
      clientId: invoice.clientId,
      OR: [
        { amountOpen: { gt: 0 } },
        { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      ],
    },
  });

  const updatedClient = await db.client.update({
    where: { id: invoice.clientId },
    data: {
      creditBalance: { decrement: creditUsed },
      paymentStatus: remainingOpenInvoices > 0 ? "PARTIAL" : "PAID",
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
  }).catch(() => null);

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
  }).catch(() => null);

  return {
    creditAdded: creditAmount,
    invoice,
    payment,
    creditBalance: toMoney(client.creditBalance),
  };
}

module.exports = {
  applyClientCreditToInvoice,
  createCreditLedgerPayment,
  invoiceOpen,
  invoicePaid,
  invoiceStatus,
  invoiceTotal,
  moneyLabel,
  toMoney,
};
