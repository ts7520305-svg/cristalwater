const repository = require("../../dal/FinanceOsRepository");
const { processPaymentReminders } = require("../../services/paymentService");
const { NON_RECEIVABLE_STATUSES, isReceivableInvoice, createCreditLedgerPayment, invoiceOpen, invoicePaid, invoiceStatus, invoiceTotal } = require("../../services/clientCreditService");
const { EVENT_TYPES, emitFinanceEvent } = require("../../services/financeOsEventService");
const { preparePaymentRequest, executePaymentRequest } = require('../../services/invoicePaymentRequestService');
const { reservedRepairIds } = require('../../services/repairInvoiceSourceService');
const cashReceipts = require('../../services/cashReceiptReportService');

function monthRefFromDate(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeMethod(value) {
  const clean = String(value || "MANUAL").trim().toUpperCase();
  if (["MBWAY", "MB_WAY"].includes(clean)) return "MBWAY";
  if (["BANK", "BANK_TRANSFER", "TRANSFER", "WIRE"].includes(clean)) return "BANK_TRANSFER";
  if (["REFERENCE", "MULTIBANCO_REFERENCE", "REF"].includes(clean)) return "REFERENCE";
  if (["CASH", "DINHEIRO"].includes(clean)) return "CASH";
  if (["CREDIT_NOTE", "CREDIT"].includes(clean)) return "CREDIT_NOTE";
  return clean || "MANUAL";
}

function asMoney(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function toCents(value) {
  return Math.round(asMoney(value) * 100);
}

function fromCents(value) {
  const parsed = Number(value || 0);
  return Math.round(parsed) / 100;
}

function calcLineTotal(quantity, unitPrice) {
  const qtyCents = toCents(quantity || 0);
  const unitCents = toCents(unitPrice || 0);
  return fromCents((qtyCents * unitCents) / 100);
}

function statusFromInvoice(invoice) {
  const total = invoiceTotal(invoice);
  const paid = invoicePaid(invoice);
  const open = invoiceOpen(invoice);
  return invoiceStatus(total, paid, open);
}

function normalizeInvoiceStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function clampLimit(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function invoiceShape(invoice) {
  return {
    ...invoice,
    totalAmount: asMoney(invoice.totalAmount || invoice.total || invoice.amount),
    amountOpen: asMoney(invoice.amountOpen),
    amountPaid: asMoney(invoice.amountPaid),
  };
}

async function recalculateInvoice(tx, invoiceId) {
  const invoice = await tx.invoice.findUnique({
    where: { id: Number(invoiceId) },
    include: { lines: true, payments: true },
  });
  if (!invoice) return null;

  const totalCents = (invoice.lines || []).reduce((sum, line) => sum + toCents(line.total || line.lineTotal), 0);
  const paidCents = (invoice.payments || []).reduce((sum, payment) => sum + toCents(payment.amount), 0);
  const openCents = Math.max(totalCents - paidCents, 0);
  const total = fromCents(totalCents);
  const paid = fromCents(paidCents);
  const open = fromCents(openCents);
  const status = invoiceStatus(total, paid, open);

  return tx.invoice.update({
    where: { id: invoice.id },
    data: {
      total,
      amount: total,
      totalAmount: total,
      amountPaid: paid,
      amountOpen: open,
      status,
      paidAt: status === "PAID" ? (invoice.paidAt || new Date()) : null,
    },
    include: { client: true, lines: true, payments: true },
  });
}

async function createDraftInvoice(payload = {}, actor = "finance-os", transaction = null) {
  const clientId = Number(payload.clientId || 0);
  if (!clientId) return { ok: false, status: 400, error: "clientId obrigatório" };
  const monthRef = payload.standalone === true ? null : String(payload.monthRef || monthRefFromDate()).trim();
  const period = monthRef || monthRefFromDate();
  const lineItems = Array.isArray(payload.lines) ? payload.lines : [];
  for (const line of lineItems) {
    if (!line || typeof line !== 'object' || Array.isArray(line)) return { ok: false, status: 400, error: 'Linha inválida' };
    const ref = line.referenceId;
    if (ref != null && (!['string', 'number'].includes(typeof ref) || !/^\d+$/.test(String(ref)) || !Number.isSafeInteger(Number(ref)) || Number(ref) <= 0 || Number(ref) > 2147483647)) return { ok: false, status: 400, error: 'Referência de origem inválida' };
  }
  const repairIds = lineItems.filter(line => [line.type, line.lineType].some(type => String(type || '').trim().toUpperCase() === 'REPAIR') && line.referenceId != null).map(line => Number(line.referenceId));
  if (new Set(repairIds).size !== repairIds.length) return { ok: false, status: 409, error: 'A reparação está repetida nas linhas da fatura' };
  const run = async tx => {
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${clientId} FOR NO KEY UPDATE`;
    const client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client) return { ok: false, status: 404, error: "Cliente não encontrado" };
    if (payload.requireActiveContract && (!client.active || client.status !== 'ACTIVE' || !client.billingActive || client.deletedAt || client.archiveStatus !== 'ATIVO')) return { ok: false, status: 409, error: "Contrato inativo" };
    if (monthRef !== null && await tx.invoice.findFirst({ where: { clientId, monthRef } })) return { ok: false, status: 409, error: "Já existe fatura para este mês" };
    if ((await reservedRepairIds(tx, repairIds)).size) return { ok: false, status: 409, error: 'Reparação já associada a uma fatura. Consulte o documento existente.' };
    if (repairIds.length && await tx.repair.count({ where: { id: { in: repairIds }, pool: { clientId } } }) !== repairIds.length) return { ok: false, status: 409, error: 'A referência não pertence a uma reparação deste cliente' };
  const dueDate = repository.toDate(payload.dueDate) || new Date(Date.now() + 15 * 86400000);

  const invoice = await tx.invoice.create({ data: {
    clientId,
    monthRef,
    month: period,
    year: Number(String(period).slice(0, 4)) || new Date().getUTCFullYear(),
    dueDate,
    status: "DRAFT",
    requiresInvoice: Boolean(client.requiresInvoice),
    notes: String(payload.notes || "").trim() || null,
    lines: {
      create: lineItems.map((line) => ({
        type: String(line.type || line.lineType || "SERVICE").trim().toUpperCase() || "SERVICE",
        lineType: line.lineType ? String(line.lineType).trim().toUpperCase() : null,
        referenceId: line.referenceId == null ? null : Number(line.referenceId),
        description: String(line.description || "Linha").trim() || "Linha",
        quantity: asMoney(line.quantity || 1),
        unitPrice: asMoney(line.unitPrice || 0),
        total: asMoney(line.total || calcLineTotal(line.quantity || 1, line.unitPrice || 0)),
        lineTotal: asMoney(line.total || calcLineTotal(line.quantity || 1, line.unitPrice || 0)),
        notes: String(line.notes || "").trim() || null,
      })),
    },
  } });

  const recalculated = await recalculateInvoice(tx, invoice.id);
  await tx.invoice.update({ where: { id: invoice.id }, data: { status: "DRAFT" } });
  const finalInvoice = invoiceShape({ ...(recalculated || invoice), status: "DRAFT" });

  return { ok: true, invoice: finalInvoice };
  };
  const result = transaction ? await run(transaction) : await repository.transaction(run);
  if (result.ok && !transaction) await emitFinanceEvent(EVENT_TYPES.FINANCE_INVOICE_DRAFT, { invoiceId: result.invoice.id, clientId, monthRef, actor });
  return result;
}

async function issueInvoice(invoiceId, payload = {}, actor = "finance-os", transaction = null) {
  const include = { client: true, lines: true, payments: true };
  const invoice = transaction ? await transaction.invoice.findUnique({ where: { id: Number(invoiceId) }, include }) : await repository.getInvoice(invoiceId);
  if (!invoice) return { ok: false, status: 404, error: "Fatura não encontrada" };

  const invoiceNumber = String(payload.invoiceNumber || payload.externalInvoiceNo || "").trim() || null;
  const data = {
    status: "ISSUED",
    invoiceIssued: true,
    invoiceNumber: invoiceNumber || invoice.invoiceNumber,
    externalInvoiceNo: invoiceNumber || invoice.externalInvoiceNo,
    issueDate: invoice.issueDate || new Date(),
    notes: [invoice.notes, payload.notes].filter(Boolean).join("\n") || invoice.notes,
  };
  const issued = transaction ? await transaction.invoice.update({ where: { id: invoice.id }, data, include }) : await repository.updateInvoice(invoice.id, data);

  if (!transaction) await emitFinanceEvent(EVENT_TYPES.FINANCE_INVOICE_ISSUED, {
    invoiceId: issued.id,
    clientId: issued.clientId,
    actor,
  });

  return { ok: true, invoice: invoiceShape(issued) };
}

async function sendInvoice(invoiceId, payload = {}, actor = "finance-os") {
  const invoice = await repository.getInvoice(invoiceId);
  if (!invoice) return { ok: false, status: 404, error: "Fatura não encontrada" };

  const channel = String(payload.channel || "EMAIL").trim().toUpperCase();

  await repository.transaction(async (tx) => {
    await repository.createCommunicationLog(tx, {
      clientId: invoice.clientId,
      channel: `INVOICE_${channel}`,
      message: `Fatura #${invoice.id} enviada via ${channel}`,
      referenceId: invoice.id,
    });

    await repository.createNotification(tx, {
      clientId: invoice.clientId,
      type: "INVOICE_SENT",
      eventType: "FINANCE_INVOICE_SENT",
      title: "Fatura enviada",
      message: `A fatura #${invoice.id} foi enviada via ${channel}.`,
      role: "CLIENT",
      severity: "INFO",
      status: "PENDING",
      metadata: { invoiceId: invoice.id, channel },
    });

    await repository.createAudit(tx, {
      action: "FINANCE_INVOICE_SENT",
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { channel, actor },
    });

    await tx.invoice.update({ where: { id: invoice.id }, data: { status: invoice.status === "DRAFT" ? "ISSUED" : invoice.status } });
  });

  await emitFinanceEvent(EVENT_TYPES.FINANCE_INVOICE_SENT, {
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    channel,
    actor,
  });

  return { ok: true, invoice: invoiceShape(await repository.getInvoice(invoice.id)), channel };
}

async function registerPayment(invoiceId, payload = {}, actor = "finance-os", user = null, transaction = null) {
  const request = preparePaymentRequest(invoiceId, payload, user);
  if (request) payload = { ...payload, amount: request.amountCents / 100, method: request.method, notes: request.notes };
  const amount = asMoney(payload.amount || 0);
  if (amount <= 0) return { ok: false, status: 400, error: "amount inválido" };

  const method = normalizeMethod(payload.method);

  const run = async (tx) => executePaymentRequest(tx, request, async () => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${Number(invoiceId)} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: Number(invoiceId) }, include: { client: true, lines: true, payments: true } });
    if (!invoice) return { ok: false, status: 404, error: "Fatura não encontrada" };

    const currentStatus = normalizeInvoiceStatus(invoice.status);
    if (!isReceivableInvoice(invoice)) {
      return { ok: false, status: 409, error: `Não é possível registar pagamento para fatura ${currentStatus}` };
    }

    const openCents = toCents(invoiceOpen(invoice));
    const amountCents = toCents(amount);
    const appliedCents = Math.min(amountCents, openCents);
    const surplusCents = Math.max(amountCents - appliedCents, 0);
    const applied = fromCents(appliedCents);
    const surplus = fromCents(surplusCents);

    if (applied > 0) {
      await repository.createPayment(tx, {
        invoiceId: invoice.id,
        amount: applied,
        amountCents: appliedCents,
        method,
        notes: String(payload.notes || "Pagamento Finance OS").trim() || "Pagamento Finance OS",
      });
    }

    const updated = await recalculateInvoice(tx, invoice.id);
    // The whole cash receipt belongs in the payment ledger. Its unapplied part
    // becomes a deposit, never a second payment on the already settled invoice.
    const credit = surplus > 0 ? await createCreditLedgerPayment(tx, invoice.clientId, surplus, {
      monthRef: invoice.monthRef || monthRefFromDate(), method,
      notes: String(payload.notes || `Excedente da fatura #${invoice.id}`).trim(),
    }) : { creditAdded: 0 };

    await repository.createAudit(tx, {
      action: "FINANCE_PAYMENT_CONFIRMED",
      entity: "Invoice",
      entityId: invoice.id,
      metadata: {
        amount,
        applied,
        surplus,
        method,
        actor,
      },
    });

    await repository.createNotification(tx, {
      clientId: invoice.clientId,
      type: "PAYMENT_CONFIRMED",
      eventType: "FINANCE_PAYMENT_CONFIRMED",
      title: "Pagamento confirmado",
      message: `Recebido pagamento de ${amount.toFixed(2)} EUR para a fatura #${invoice.id}.`,
      role: "CLIENT",
      severity: "INFO",
      status: "PENDING",
      metadata: { invoiceId: invoice.id, amount, method },
    });

    await repository.createCommunicationLog(tx, {
      clientId: invoice.clientId,
      channel: "PAYMENT_CONFIRMATION",
      message: `Pagamento confirmado para fatura #${invoice.id}: ${amount.toFixed(2)} EUR (${method}).`,
      referenceId: invoice.id,
    });

    return {
      ok: true,
      invoice: invoiceShape(updated || invoice),
      appliedAmount: applied,
      surplusAmount: surplus,
      creditAdded: credit.creditAdded,
      creditBalance: credit.creditBalance,
      creditPaymentId: credit.payment?.id || null,
      method,
    };
  });
  const result = transaction ? await run(transaction) : await repository.transaction(run);

  if (!result.ok) return result;
  if (result.idempotent || transaction) return result;

  await emitFinanceEvent(EVENT_TYPES.FINANCE_PAYMENT_CONFIRMED, {
    invoiceId: result.invoice.id,
    clientId: result.invoice.clientId,
    method: result.method,
    amount,
    actor,
  });

  return result;
}

async function createCreditNote(invoiceId, payload = {}, actor = "finance-os", user = null) {
  return require('./InvoiceCreditNoteBusiness').create(invoiceId, payload, actor, user);
}

async function cancelInvoice(invoiceId, payload = {}, actor = "finance-os") {
  const id = Number(invoiceId);
  if (!/^\d+$/.test(String(invoiceId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return { ok: false, status: 400, error: 'Fatura inválida' };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || [payload.reason, payload.notes].some(value => value !== undefined && (typeof value !== 'string' || value.length > 2000))) return { ok: false, status: 400, error: 'Motivo inválido' };
  const reason = String(payload.reason || payload.notes || "Cancelada via Finance OS").trim();
  const result = await repository.transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { client: true, lines: true, payments: true } });
    if (!invoice) return { ok: false, status: 404, error: "Fatura não encontrada" };

    const currentStatus = normalizeInvoiceStatus(invoice.status);
    if (currentStatus === "CANCELLED" || currentStatus === "CANCELED") {
      return { ok: true, invoice: invoiceShape(invoice), alreadyCancelled: true };
    }

    if (currentStatus === "PAID") {
      return { ok: false, status: 409, error: "Não é possível cancelar fatura paga" };
    }

    if (invoicePaid(invoice) > 0 || (invoice.payments || []).some(payment => Number(payment.amount) > 0 || Number(payment.amountCents) > 0)) {
      return { ok: false, status: 409, error: "Não é possível cancelar fatura com pagamentos registados" };
    }

    const updated = await tx.invoice.update({
      where: { id: Number(invoice.id) },
      data: {
        status: "CANCELLED",
        amountOpen: 0,
        notes: [invoice.notes, `CANCELLED: ${reason}`].filter(Boolean).join("\n"),
      },
      include: { client: true, lines: true, payments: true },
    });

    await tx.auditTrail.create({ data: {
      action: "FINANCE_INVOICE_CANCELLED",
      eventType: "FINANCE_INVOICE_CANCELLED",
      entity: "Invoice",
      entityId: updated.id,
      clientId: updated.clientId,
      metadata: { reason, actor },
      message: `Fatura #${updated.id} cancelada`,
    } });

    await tx.notification.create({ data: {
      clientId: updated.clientId,
      type: "INVOICE_CANCELLED",
      eventType: "FINANCE_INVOICE_CANCELLED",
      title: "Fatura cancelada",
      message: `A fatura #${updated.id} foi cancelada. Motivo: ${reason}`,
      role: "CLIENT",
      severity: "WARNING",
      status: "PENDING",
      metadata: { invoiceId: updated.id, reason },
    } });

    await tx.communicationLog.create({ data: {
      clientId: updated.clientId,
      channel: "INVOICE_CANCELLATION",
      message: `Fatura #${updated.id} cancelada (${reason}).`,
      referenceId: updated.id,
    } });

    return { ok: true, invoice: invoiceShape(updated), reason };
  });

  if (!result.ok || result.alreadyCancelled) return result;
  await emitFinanceEvent(EVENT_TYPES.FINANCE_INVOICE_CANCELLED, {
    invoiceId: result.invoice.id,
    clientId: result.invoice.clientId,
    reason,
    actor,
  });

  return result;
}

async function getInvoiceHistory(invoiceId) {
  const invoice = await repository.getInvoice(invoiceId);
  if (!invoice) return { ok: false, status: 404, error: "Fatura não encontrada" };

  const auditEntries = await repository.listAuditTrail({
    entity: "Invoice",
    entityId: Number(invoice.id),
  });

  const paymentEvents = (invoice.payments || []).map((payment) => ({
    at: payment.paidAt || payment.createdAt,
    type: "PAYMENT",
    action: "FINANCE_PAYMENT_CONFIRMED",
    amount: asMoney(payment.amount),
    method: payment.method,
    note: payment.notes || null,
  }));

  const creditEvents = (invoice.lines || [])
    .filter((line) => String(line.type || line.lineType || "").toUpperCase().includes("CREDIT"))
    .map((line) => ({
      at: line.createdAt,
      type: "CREDIT_NOTE",
      action: "FINANCE_CREDIT_NOTE_CREATED",
      amount: asMoney(line.total || line.lineTotal),
      note: line.description || null,
    }));

  const auditEvents = (auditEntries || []).map((entry) => ({
    at: entry.createdAt,
    type: "AUDIT",
    action: entry.action || entry.eventType,
    note: entry.message || null,
    metadata: entry.metadata || null,
  }));

  const timeline = [...paymentEvents, ...creditEvents, ...auditEvents]
    .filter((event) => event.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    ok: true,
    invoice: invoiceShape(invoice),
    history: timeline,
  };
}

async function detectOverdueAndInterest(payload = {}, actor = "finance-os") {
  const now = new Date();
  const dailyRate = asMoney(payload.dailyInterestRate || 0.0005);
  const applyInterest = payload.applyInterest === true || String(payload.applyInterest || "").toLowerCase() === "true";

  const overdue = await repository.findOverdueInvoices(now);
  const processed = [];

  for (const invoice of overdue) {
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) continue;

    await repository.transaction(async (tx) => {
      const daysOverdue = Math.max(Math.floor((now.getTime() - dueDate.getTime()) / 86400000), 1);
      const open = invoiceOpen(invoice);
      const interest = Number((open * dailyRate * daysOverdue).toFixed(2));

      let interestApplied = 0;
      if (applyInterest && interest > 0) {
        const existingInterest = await tx.invoiceLine.findFirst({
          where: {
            invoiceId: invoice.id,
            type: "INTEREST_AUTO",
            sourceMonth: monthRefFromDate(now),
          },
        });

        if (!existingInterest) {
          await repository.createInvoiceLine(tx, {
            invoiceId: invoice.id,
            type: "INTEREST_AUTO",
            lineType: "INTEREST",
            description: `Juros mora (${daysOverdue} dias)`,
            quantity: 1,
            unitPrice: interest,
            total: interest,
            lineTotal: interest,
            sourceMonth: monthRefFromDate(now),
            notes: `Taxa diária ${dailyRate}`,
          });
          interestApplied = interest;
        }
      }

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "OVERDUE" },
        include: { client: true, lines: true, payments: true },
      });

      const recalculated = await recalculateInvoice(tx, updated.id);

      await repository.createAudit(tx, {
        action: "FINANCE_OVERDUE_DETECTED",
        entity: "Invoice",
        entityId: updated.id,
        metadata: { daysOverdue, open, interest, interestApplied, applyInterest, actor },
      });

      await repository.createNotification(tx, {
        clientId: updated.clientId,
        type: "INVOICE_OVERDUE",
        eventType: "FINANCE_OVERDUE_DETECTED",
        title: "Fatura em atraso",
        message: `A fatura #${updated.id} está em atraso há ${daysOverdue} dias.`,
        role: "CLIENT",
        severity: "WARNING",
        status: "PENDING",
        metadata: { invoiceId: updated.id, daysOverdue, interest, interestApplied },
      });

      processed.push({
        invoiceId: updated.id,
        clientId: updated.clientId,
        daysOverdue,
        openAmount: open,
        interestPreview: interest,
        interestApplied,
        status: (recalculated || updated).status,
      });
    });
  }

  if (processed.length) {
    await emitFinanceEvent(EVENT_TYPES.FINANCE_OVERDUE_DETECTED, {
      count: processed.length,
      applyInterest,
      actor,
    });
  }

  return { ok: true, processed, count: processed.length, applyInterest, dailyRate };
}

async function getCustomerBalance(clientId) {
  const id = Number(clientId);
  if (!id) return { ok: false, status: 400, error: "clientId inválido" };

  const client = await repository.getClient(id);
  if (!client) return { ok: false, status: 404, error: "Cliente não encontrado" };

  const invoices = await repository.getInvoices({ clientId: id });
  const totalInvoiced = invoices.filter(isReceivableInvoice).reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoicePaid(invoice), 0);
  const totalOpen = invoices.reduce((sum, invoice) => sum + invoiceOpen(invoice), 0);

  return {
    ok: true,
    balance: {
      clientId: id,
      clientName: client.name,
      totalInvoiced,
      totalPaid,
      totalOpen,
      creditBalance: asMoney(client.creditBalance),
      netBalance: totalOpen - asMoney(client.creditBalance),
    },
  };
}

async function getCustomerAccount(clientId) {
  const id = Number(clientId);
  if (!id) return { ok: false, status: 400, error: "clientId inválido" };

  const client = await repository.getClient(id);
  if (!client) return { ok: false, status: 404, error: "Cliente não encontrado" };

  const invoices = await repository.getInvoices({ clientId: id });
  const invoiceHistory = invoices.map((invoice) => ({
    invoiceId: invoice.id,
    status: invoice.status,
    dueDate: invoice.dueDate,
    issuedAt: isReceivableInvoice(invoice) ? invoice.issueDate || invoice.createdAt : null,
    totalAmount: invoiceTotal(invoice),
    paidAmount: invoicePaid(invoice),
    openAmount: invoiceOpen(invoice),
  }));

  const paymentHistory = invoices
    .flatMap((invoice) => (invoice.payments || []).map((payment) => ({
      paymentId: payment.id,
      invoiceId: invoice.id,
      paidAt: payment.paidAt || payment.createdAt,
      amount: asMoney(payment.amount),
      method: payment.method,
      notes: payment.notes || null,
    })))
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  const runningEvents = [];
  for (const invoice of invoices) {
    if (isReceivableInvoice(invoice)) runningEvents.push({
      at: invoice.issueDate || invoice.createdAt,
      type: "INVOICE",
      amount: invoiceTotal(invoice),
      invoiceId: invoice.id,
      description: `Fatura #${invoice.id}`,
    });
    for (const payment of invoice.payments || []) {
      runningEvents.push({
        at: payment.paidAt || payment.createdAt,
        type: "PAYMENT",
        amount: -asMoney(payment.amount),
        invoiceId: invoice.id,
        paymentId: payment.id,
        description: `Pagamento #${payment.id}`,
      });
    }
  }

  let runningBalance = 0;
  const runningBalanceHistory = runningEvents
    .filter((event) => event.at)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((event) => {
      runningBalance += asMoney(event.amount);
      return {
        ...event,
        runningBalance: Number(runningBalance.toFixed(2)),
      };
    })
    .reverse();

  const totalOpen = invoices.reduce((sum, invoice) => sum + invoiceOpen(invoice), 0);
  const creditBalance = asMoney(client.creditBalance);

  return {
    ok: true,
    account: {
      clientId: id,
      clientName: client.name,
      currentBalance: Number((totalOpen - creditBalance).toFixed(2)),
      creditBalance,
      debtBalance: Number(totalOpen.toFixed(2)),
      paymentHistory,
      invoiceHistory,
      runningBalanceHistory,
    },
  };
}

async function getCompanyBalance() {
  const [invoices, clients, payments] = await Promise.all([
    repository.getInvoices({}),
    repository.listClients({}),
    cashReceipts.payments(),
  ]);

  const totalInvoiced = invoices.filter(isReceivableInvoice).reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoicePaid(invoice), 0);
  const outstandingDebt = invoices.reduce((sum, invoice) => sum + invoiceOpen(invoice), 0);
  const customerCredit = clients.reduce((sum, client) => sum + asMoney(client.creditBalance), 0);
  const cashReceived = cashReceipts.total(payments);

  return {
    ok: true,
    balance: {
      totalInvoiced,
      totalPaid,
      cashReceived,
      outstandingDebt,
      customerCreditLiability: customerCredit,
      netCompanyBalance: asMoney(cashReceived - customerCredit),
    },
  };
}

async function getRevenueReport(query = {}) {
  const payments = await cashReceipts.payments(query.monthRef);
  return { ok: true, revenue: cashReceipts.total(payments), paymentsCount: payments.length, limitApplied: null, basis: 'CASH_RECEIPTS' };
}

async function getMonthlyRevenueReport() {
  const payments = await cashReceipts.payments();
  return {
    ok: true,
    monthlyRevenue: cashReceipts.monthly(payments),
    limitApplied: null,
    basis: 'CASH_RECEIPTS',
  };
}

async function getOutstandingDebtReport() {
  const limit = 10000;
  const invoices = (await repository.getInvoices({
    status: { notIn: NON_RECEIVABLE_STATUSES },
    OR: [{ amountOpen: { gt: 0 } }, { status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }],
  }, { take: limit })).filter(invoice => invoiceOpen(invoice) > 0);

  const totalOutstanding = invoices.reduce((sum, invoice) => sum + invoiceOpen(invoice), 0);
  return {
    ok: true,
    totalOutstanding,
    limitApplied: limit,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      clientId: invoice.clientId,
      clientName: invoice.client?.name || null,
      status: invoice.status,
      amountOpen: invoiceOpen(invoice),
      dueDate: invoice.dueDate,
    })),
  };
}

async function getCashflowReport() {
  const [payments, invoices] = await Promise.all([
    cashReceipts.payments(),
    repository.getInvoices({}),
  ]);

  const inflow = cashReceipts.total(payments);
  const receivables = invoices.reduce((sum, invoice) => sum + invoiceOpen(invoice), 0);
  const billed = invoices.filter(isReceivableInvoice).reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);

  return {
    ok: true,
    limitApplied: null,
    basis: 'CASH_RECEIPTS',
    cashflow: {
      inflow,
      receivables,
      billed,
      net: inflow - receivables,
    },
  };
}

async function getVatSummaryReport() {
  const limit = 10000;
  const invoices = await repository.getInvoices({}, { take: limit });
  let vatCollected = 0;
  let vatBase = 0;

  for (const invoice of invoices) {
    const total = invoiceTotal(invoice);
    const rate = asMoney(invoice.taxRate, 0);
    const amount = asMoney(invoice.taxAmount, 0);
    if (amount > 0) {
      vatCollected += amount;
      vatBase += Math.max(total - amount, 0);
      continue;
    }

    const effectiveRate = rate > 0 ? rate : 0.23;
    const base = effectiveRate > 0 ? total / (1 + effectiveRate) : total;
    const vat = total - base;
    vatBase += base;
    vatCollected += vat;
  }

  return {
    ok: true,
    limitApplied: limit,
    vatSummary: {
      vatBase: Number(vatBase.toFixed(2)),
      vatCollected: Number(vatCollected.toFixed(2)),
      vatPayableEstimate: Number(vatCollected.toFixed(2)),
    },
  };
}

async function getTechnicianProfitabilityReport(query = {}) {
  const monthRef = String(query.monthRef || monthRefFromDate()).trim();
  const limit = clampLimit(query.limit, 10000, 100, 20000);
  const start = new Date(`${monthRef}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const [technicians, visits, movements] = await Promise.all([
    repository.listTechnicians({ take: 200 }),
    repository.listServiceVisits({ plannedDate: { gte: start, lt: end } }, { take: limit }),
    repository.listStockMovements({ createdAt: { gte: start, lt: end } }, { take: limit }),
  ]);

  const costByTech = new Map();
  for (const movement of movements) {
    const techId = Number(movement.technicianId || 0);
    if (!techId) continue;
    costByTech.set(techId, asMoney(costByTech.get(techId), 0) + asMoney(movement.quantity, 0) * 1.5);
  }

  const report = technicians.map((technician) => {
    const techVisits = visits.filter((visit) => Number(visit.technicianId || 0) === technician.id);
    const visitsDone = techVisits.filter((visit) => String(visit.status || "").toUpperCase().includes("DONE") || String(visit.status || "").toUpperCase().includes("CONCL")).length;
    const estimatedRevenue = visitsDone * 45;
    const stockCost = asMoney(costByTech.get(technician.id), 0);
    const profitability = estimatedRevenue - stockCost;
    return {
      technicianId: technician.id,
      technicianName: technician.name,
      visitsDone,
      estimatedRevenue,
      stockCost,
      profitability,
    };
  });

  return { ok: true, monthRef, technicians: report, limitApplied: limit };
}

async function getCustomerProfitabilityReport(query = {}) {
  const monthRef = String(query.monthRef || monthRefFromDate()).trim();
  const limit = clampLimit(query.limit, 10000, 100, 20000);
  const start = new Date(`${monthRef}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const [clients, invoices, movements, visits] = await Promise.all([
    repository.listClients({ active: true }, { take: 2000 }),
    repository.getInvoices({ monthRef }, { take: limit }),
    repository.listStockMovements({ createdAt: { gte: start, lt: end } }, { take: limit }),
    repository.listServiceVisits({ plannedDate: { gte: start, lt: end } }, { take: limit }),
  ]);

  const byClient = clients.map((client) => {
    const clientInvoices = invoices.filter((invoice) => Number(invoice.clientId) === client.id);
    const revenue = clientInvoices.reduce((sum, invoice) => sum + invoicePaid(invoice), 0);
    const outstanding = clientInvoices.reduce((sum, invoice) => sum + invoiceOpen(invoice), 0);
    const stockCost = movements
      .filter((movement) => Number(movement.clientId || 0) === client.id)
      .reduce((sum, movement) => sum + asMoney(movement.quantity, 0) * 1.5, 0);
    const laborCost = visits.filter((visit) => Number(visit.clientId || 0) === client.id).length * 12;
    const profitability = revenue - stockCost - laborCost;

    return {
      clientId: client.id,
      clientName: client.name,
      revenue,
      outstanding,
      stockCost,
      laborCost,
      profitability,
    };
  });

  return { ok: true, monthRef, clients: byClient, limitApplied: limit };
}

async function triggerReminderAutomation(actor = "finance-os") {
  const result = await processPaymentReminders();
  return { ...result, message: result.skipped ? "Lembretes automáticos desligados nas configurações." : "Avisos de pagamento registados no portal." };
}

async function confirmPaymentAutomation(invoiceId, payload = {}, actor = "finance-os") {
  const invoice = await repository.getInvoice(invoiceId);
  if (!invoice) return { ok: false, status: 404, error: "Fatura não encontrada" };

  await repository.transaction(async (tx) => {
    await repository.createNotification(tx, {
      clientId: invoice.clientId,
      type: "PAYMENT_CONFIRMATION",
      eventType: "FINANCE_PAYMENT_CONFIRMED",
      title: "Confirmação de pagamento",
      message: String(payload.message || `Pagamento da fatura #${invoice.id} confirmado.`),
      role: "CLIENT",
      severity: "INFO",
      status: "PENDING",
      metadata: { invoiceId: invoice.id },
    });

    await repository.createAudit(tx, {
      action: "FINANCE_AUTOMATION_PAYMENT_CONFIRMATION",
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { actor },
    });
  });

  await emitFinanceEvent(EVENT_TYPES.FINANCE_PAYMENT_CONFIRMED, {
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    automation: true,
    actor,
  });

  return { ok: true, message: "Confirmação de pagamento enviada", invoice: invoiceShape(invoice) };
}

module.exports = {
  createDraftInvoice,
  issueInvoice,
  sendInvoice,
  registerPayment,
  createCreditNote,
  cancelInvoice,
  getInvoiceHistory,
  detectOverdueAndInterest,
  getCustomerBalance,
  getCustomerAccount,
  getCompanyBalance,
  getRevenueReport,
  getMonthlyRevenueReport,
  getOutstandingDebtReport,
  getCashflowReport,
  getVatSummaryReport,
  getTechnicianProfitabilityReport,
  getCustomerProfitabilityReport,
  triggerReminderAutomation,
  confirmPaymentAutomation,
};
