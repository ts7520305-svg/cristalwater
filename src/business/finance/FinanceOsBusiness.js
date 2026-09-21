const repository = require("../../dal/FinanceOsRepository");
const { processPaymentReminders } = require("../../services/paymentService");
const { NON_RECEIVABLE_STATUSES, isReceivableInvoice, createCreditLedgerPayment, invoiceOpen, invoicePaid, invoiceStatus, invoiceTotal } = require("../../services/clientCreditService");
const { EVENT_TYPES, emitFinanceEvent } = require("../../services/financeOsEventService");
const { preparePaymentRequest, executePaymentRequest, cashMethod } = require('../../services/invoicePaymentRequestService');
const { reservedRepairIds } = require('../../services/repairInvoiceSourceService');
const cashReceipts = require('../../services/cashReceiptReportService');
const { createHash } = require('node:crypto');
const { normalizeInvoice } = require('../../services/invoiceViewService');

function externalFailure(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

// Both internal numbering and external reference registration reserve the number
// before locking an invoice. The association covers the complete document.
async function lockInvoiceNumber(tx, number) {
  const key = `invoice-number:${number}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
}
// Same whitespace set as String.trim(), including historical non-breaking spaces.
const referenceWhitespace = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
async function conflictingInvoiceIds(tx, number, id) {
  const rows = await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id <> ${id}
    AND (btrim("externalInvoiceNo", ${referenceWhitespace}) = ${number} OR btrim("invoiceNumber", ${referenceWhitespace}) = ${number}) ORDER BY id`;
  return rows.map(row => row.id);
}
async function reserveInvoiceNumber(tx, number, id) {
  await lockInvoiceNumber(tx, number);
  const duplicates = await conflictingInvoiceIds(tx, number, id);
  if (duplicates.length) externalFailure(`Este número já está associado ao documento #${duplicates[0]}.`, 409);
}

function externalSnapshot(invoice) {
  return {
    id: invoice.id, clientId: invoice.clientId, status: invoice.status, requiresInvoice: invoice.requiresInvoice,
    amount: invoice.amount, total: invoice.total, totalAmount: invoice.totalAmount,
    taxRate: invoice.taxRate, taxAmount: invoice.taxAmount, monthRef: invoice.monthRef, month: invoice.month,
    client: Object.fromEntries(['name', 'requiresInvoice', 'fiscalName', 'fiscalNif', 'fiscalAddress', 'fiscalEmail'].map(key => [key, invoice.client?.[key] ?? null])),
    lines: [...(invoice.lines || [])].sort((a, b) => a.id - b.id).map(line => ({
      id: line.id, type: line.type, lineType: line.lineType, referenceId: line.referenceId,
      description: line.description, quantity: line.quantity, unitPrice: line.unitPrice,
      total: line.total, lineTotal: line.lineTotal, serviceDate: line.serviceDate, sourceMonth: line.sourceMonth, notes: line.notes,
    })),
  };
}

function externalReviewToken(invoice) {
  return createHash('sha256').update(JSON.stringify(externalSnapshot(invoice))).digest('hex');
}

function externalRequested(invoice) { return Boolean(invoice.requiresInvoice || invoice.client?.requiresInvoice); }
function externalEligible(invoice) { return externalRequested(invoice) && isReceivableInvoice(invoice) && invoiceTotal(invoice) > 0; }
function externalRegistered(invoice) { return typeof invoice.externalInvoiceNo === 'string' && Boolean(invoice.externalInvoiceNo.trim()); }
const externalSum = invoices => invoices.reduce((sum, row) => sum + toCents(invoiceTotal(row)), 0) / 100;
const externalHistoryActions = ['EXTERNAL_INVOICE_REGISTERED', 'EXTERNAL_INVOICE_REFERENCE_REVIEWED'];
const validExternalNumber = value => typeof value === 'string' && Boolean(value.trim()) && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);

function externalConfirmation(entry) {
  const metadata = entry.metadata;
  return metadata?.kind === 'EXTERNAL_REFERENCE_ONLY' && metadata.association === 'WHOLE_INTERNAL_DOCUMENT'
    && (entry.action === 'EXTERNAL_INVOICE_REGISTERED' || metadata.decision === 'CONFIRM_EXTERNAL')
    && typeof metadata.externalInvoiceNo === 'string' && Array.isArray(metadata.snapshot?.lines);
}
function referenceReview(invoice, history, conflicts) {
  const number = invoice.externalInvoiceNo?.trim() || '';
  const confirmations = history.filter(externalConfirmation);
  const confirmation = confirmations.find(entry => entry.metadata.externalInvoiceNo.trim() === number
    && entry.metadata.snapshot.id === invoice.id && entry.metadata.snapshot.clientId === invoice.clientId);
  const internalMatch = Boolean(number && invoice.invoiceNumber?.trim() === number);
  let status = number ? 'REVIEW_REQUIRED' : history.some(entry => entry.metadata?.decision === 'INTERNAL_ONLY') ? 'INTERNAL_ONLY' : 'NO_REFERENCE';
  if (number && internalMatch) status = 'INTERNAL_MATCH';
  if (confirmation) status = 'CONFIRMED';
  if (confirmations.length && !confirmation) status = 'HISTORY_MISMATCH';
  if (number && conflicts.length) status = 'DUPLICATE_REFERENCE';
  if (number && !validExternalNumber(invoice.externalInvoiceNo)) status = 'INVALID_REFERENCE';
  const needsReview = !['CONFIRMED', 'NO_REFERENCE', 'INTERNAL_ONLY'].includes(status);
  const token = createHash('sha256').update(JSON.stringify({ snapshot: externalSnapshot(invoice),
    invoiceNumber: invoice.invoiceNumber, externalInvoiceNo: invoice.externalInvoiceNo, invoiceIssued: invoice.invoiceIssued,
    history: history.map(entry => ({ id: entry.id, action: entry.action, metadata: entry.metadata })), conflicts })).digest('hex');
  return { status, needsReview, token, conflictInvoiceIds: conflicts,
    canConfirm: Boolean(number && validExternalNumber(invoice.externalInvoiceNo) && !conflicts.length && !confirmations.length),
    canMarkInternal: Boolean(internalMatch && validExternalNumber(invoice.externalInvoiceNo) && !confirmations.length),
    confirmation: confirmation || null };
}

function referenceHistory(history) {
  return history.map(entry => ({ id: entry.id, recordedAt: entry.createdAt, actor: entry.metadata?.actor || null,
    decision: entry.metadata?.decision || 'REGISTER_EXTERNAL', reference: entry.metadata?.externalInvoiceNo || null,
    note: entry.metadata?.note || null, snapshot: entry.metadata?.snapshot || null }));
}

async function listExternalInvoices(query = {}, flat = false) {
  const status = String(query.status || 'pending').toLowerCase(), search = String(query.q || '').trim().toLocaleLowerCase('pt-PT');
  if (!['pending', 'issued', 'review', 'missing-data', 'all'].includes(status)) externalFailure('Filtro inválido.');
  const { rows, registrations, references } = await repository.transaction(async tx => {
    const registrations = await tx.auditTrail.findMany({ where: { action: { in: externalHistoryActions }, entity: 'Invoice' }, orderBy: { id: 'desc' } });
    const reviewedIds = [...new Set(registrations.map(entry => entry.entityId).filter(Number.isInteger))];
    const rows = await tx.client.findMany({
    where: { OR: [{ requiresInvoice: true }, { invoices: { some: { OR: [{ requiresInvoice: true }, { externalInvoiceNo: { not: null } }, { invoiceIssued: true }, { id: { in: reviewedIds } }] } } }] },
    include: { pools: { select: { id: true } }, invoices: { include: { client: true, lines: { orderBy: { id: 'asc' } }, payments: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const references = await tx.invoice.findMany({ select: { id: true, invoiceNumber: true, externalInvoiceNo: true } });
    return { rows, registrations, references };
  });
  const history = new Map(), numberOwners = new Map();
  for (const entry of registrations) { if (!history.has(entry.entityId)) history.set(entry.entityId, []); history.get(entry.entityId).push(entry); }
  for (const row of references) for (const value of [row.invoiceNumber, row.externalInvoiceNo]) {
    const number = value?.trim(); if (!number) continue;
    if (!numberOwners.has(number)) numberOwners.set(number, new Set()); numberOwners.get(number).add(row.id);
  }
  const clients = rows.map(client => {
    const invoices = client.invoices.filter(row => externalRegistered(row) || externalEligible(row) || history.has(row.id)).map(row => {
      const entries = history.get(row.id) || [];
      const conflicts = [...(numberOwners.get(row.externalInvoiceNo?.trim()) || [])].filter(id => id !== row.id).sort((a, b) => a - b);
      const { confirmation, ...review } = referenceReview(row, entries, conflicts);
      return {
      ...normalizeInvoice(row), externalReviewToken: externalReviewToken(row),
      externalRegistration: confirmation?.metadata || null,
      externalRegisteredAt: confirmation?.createdAt || null,
      externalReferenceReview: review, externalReferenceHistory: referenceHistory(entries),
      externalRegistrationAllowed: externalEligible(row) && !externalRegistered(row) && !review.needsReview,
      externalRegistrationStatus: externalRegistered(row) ? 'REGISTERED' : row.invoiceIssued ? 'NUMBER_MISSING' : 'PENDING',
      };
    });
    const pendingInvoices = invoices.filter(row => !externalRegistered(row) && row.externalRegistrationAllowed), issuedInvoices = invoices.filter(externalRegistered);
    const historyInvoices = invoices.filter(row => !externalRegistered(row) && !row.externalRegistrationAllowed);
    return {
      id: client.id, name: client.name, email: client.email, phone: client.phone, zone: client.zone,
      active: client.active, status: client.status, paymentReference: `CW-${String(client.id).padStart(6, '0')}`,
      requiresInvoice: Boolean(client.requiresInvoice), fiscalName: client.fiscalName, fiscalNif: client.fiscalNif,
      fiscalAddress: client.fiscalAddress, fiscalEmail: client.fiscalEmail, externalBillingNotes: client.externalBillingNotes,
      fiscalDataComplete: ['fiscalName', 'fiscalNif', 'fiscalAddress', 'fiscalEmail'].every(key => typeof client[key] === 'string' && client[key].trim()),
      poolsCount: client.pools.length, invoices, pendingInvoices, issuedInvoices, historyInvoices,
      pendingTotal: externalSum(pendingInvoices), issuedTotal: externalSum(issuedInvoices),
      lastIssuedAt: issuedInvoices[0]?.updatedAt || issuedInvoices[0]?.issueDate || null,
    };
  }).filter(client => client.requiresInvoice || client.invoices.length);
  if (flat) return { ok: true, invoices: clients.flatMap(client => client.invoices) };
  const pending = clients.flatMap(client => client.pendingInvoices), issued = clients.flatMap(client => client.issuedInvoices);
  const allInvoices = clients.flatMap(client => client.invoices);
  return {
    ok: true,
    summary: { clients: clients.length, missingFiscalData: clients.filter(client => !client.fiscalDataComplete).length,
      pendingInvoices: pending.length, issuedInvoices: issued.length, totalInvoices: allInvoices.length,
      confirmedReferences: allInvoices.filter(row => row.externalReferenceReview.status === 'CONFIRMED').length,
      reviewReferences: allInvoices.filter(row => row.externalReferenceReview.needsReview).length,
      pendingTotal: externalSum(pending), issuedTotal: externalSum(issued) },
    clients: clients.filter(client => (status === 'all' || (status === 'pending' && client.pendingInvoices.length) || (status === 'issued' && client.issuedInvoices.length) || (status === 'review' && client.invoices.some(row => row.externalReferenceReview.needsReview)) || (status === 'missing-data' && !client.fiscalDataComplete))
      && (!search || [client.name, client.email, client.phone, client.zone, client.fiscalName, client.fiscalNif, client.fiscalAddress, client.fiscalEmail, client.paymentReference, ...client.invoices.flatMap(row => [row.externalInvoiceNo, row.invoiceNumber, ...row.externalReferenceHistory.map(entry => entry.reference)])].filter(Boolean).join(' ').toLocaleLowerCase('pt-PT').includes(search))),
    generatedAt: new Date().toISOString(),
  };
}

async function registerExternalInvoice(rawId, payload, user) {
  const id = Number(rawId);
  if (!/^[1-9]\d*$/.test(String(rawId)) || !Number.isSafeInteger(id) || id > 2147483647) externalFailure('Documento inválido.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) externalFailure('Dados inválidos.');
  const numbers = ['externalInvoiceNo', 'invoiceNumber', 'externalNumber'].filter(key => payload[key] !== undefined).map(key => payload[key]);
  if (!numbers.length || numbers.some(number => typeof number !== 'string' || !number.trim() || number.length > 200 || /[\u0000-\u001f\u007f]/.test(number))) externalFailure('Indique um número de fatura externa válido, até 200 caracteres.');
  const number = numbers[0].trim();
  if (numbers.some(value => value.trim() !== number)) externalFailure('Os números indicados são diferentes.');
  const reviewing = ['externalReviewToken', 'reviewedLineIds', 'expectedClientId'].some(key => payload[key] !== undefined);
  if (reviewing && (typeof payload.externalReviewToken !== 'string' || !/^[a-f0-9]{64}$/.test(payload.externalReviewToken) || !Number.isInteger(payload.expectedClientId) || payload.expectedClientId <= 0 || !Array.isArray(payload.reviewedLineIds)
    || payload.reviewedLineIds.some(value => !Number.isInteger(value) || value <= 0) || new Set(payload.reviewedLineIds).size !== payload.reviewedLineIds.length)) externalFailure('A confirmação dos serviços está incompleta. Atualize a lista.');
  return repository.transaction(async tx => {
    await reserveInvoiceNumber(tx, number, id);
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "InvoiceLine" WHERE "invoiceId" = ${id} ORDER BY id FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { client: true, lines: { orderBy: { id: 'asc' } }, payments: true } });
    if (!invoice) externalFailure('Documento não encontrado.', 404);
    if (reviewing && payload.expectedClientId !== invoice.clientId) externalFailure('O cliente do documento mudou. Atualize a lista.', 409);
    if (externalRegistered(invoice)) {
      if (invoice.externalInvoiceNo !== number) externalFailure('O número externo já está registado. O histórico não pode ser substituído por esta ação.', 409);
      return { ok: true, invoice, idempotent: true };
    }
    const history = await tx.auditTrail.findMany({ where: { entity: 'Invoice', entityId: id, action: { in: externalHistoryActions } } });
    if (history.some(externalConfirmation)) externalFailure('O histórico contém uma confirmação externa anterior. Reveja a divergência antes de associar outra referência.', 409);
    if (!externalEligible(invoice)) externalFailure('Confirme o pedido de fatura e um documento válido com valor positivo. Rascunhos e documentos retirados não podem ser associados.', 409);
    if (reviewing && (payload.externalReviewToken !== externalReviewToken(invoice) || JSON.stringify([...payload.reviewedLineIds].sort((a, b) => a - b)) !== JSON.stringify(invoice.lines.map(line => line.id)))) externalFailure('Os serviços ou dados do documento mudaram. Atualize e confirme novamente todas as linhas.', 409);
    const snapshot = JSON.parse(JSON.stringify(externalSnapshot(invoice)));
    const updated = await tx.invoice.update({ where: { id }, data: {
      invoiceIssued: true, externalInvoiceNo: number,
      notes: [invoice.notes, `Fatura oficial externa: ${number}`].filter(Boolean).join('\n'),
    }, include: { client: true, lines: true, payments: true } });
    await tx.communicationLog.create({ data: { clientId: invoice.clientId, channel: 'EXTERNAL_INVOICE', referenceId: id,
      message: `Documento interno #${id} associado à fatura externa: ${number}` } });
    await tx.auditTrail.create({ data: { action: 'EXTERNAL_INVOICE_REGISTERED', eventType: 'EXTERNAL_INVOICE_REGISTERED', entity: 'Invoice', entityId: id,
      clientId: invoice.clientId, metadata: { actor: `ADMIN:${user?.id}`, kind: 'EXTERNAL_REFERENCE_ONLY', externalInvoiceNo: number,
        association: 'WHOLE_INTERNAL_DOCUMENT', checklistConfirmed: reviewing, reviewToken: externalReviewToken(invoice), snapshot },
      beforeJson: { invoiceIssued: invoice.invoiceIssued, externalInvoiceNo: invoice.externalInvoiceNo },
      afterJson: { invoiceIssued: true, externalInvoiceNo: number } } });
    return { ok: true, invoice: updated };
  });
}

async function reviewExternalReference(rawId, payload, user) {
  const id = Number(rawId);
  if (!/^[1-9]\d*$/.test(String(rawId)) || !Number.isSafeInteger(id) || id > 2147483647) externalFailure('Documento inválido.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !['CONFIRM_EXTERNAL', 'INTERNAL_ONLY'].includes(payload.decision)
    || !validExternalNumber(payload.externalInvoiceNo) || typeof payload.note !== 'string' || !payload.note.trim() || payload.note.length > 1000
    || typeof payload.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.requestId)
    || typeof payload.externalReferenceReviewToken !== 'string' || !/^[a-f0-9]{64}$/.test(payload.externalReferenceReviewToken)
    || !Number.isInteger(payload.expectedClientId) || payload.expectedClientId <= 0 || payload.expectedClientId > 2147483647
    || !Array.isArray(payload.reviewedLineIds) || payload.reviewedLineIds.some(value => !Number.isInteger(value) || value <= 0 || value > 2147483647)
    || new Set(payload.reviewedLineIds).size !== payload.reviewedLineIds.length) externalFailure('Confirme a decisão, o motivo, o cliente e todas as linhas da referência.');
  const intent = { id, requestId: payload.requestId, decision: payload.decision, note: payload.note.trim(),
    externalInvoiceNo: payload.externalInvoiceNo, expectedClientId: payload.expectedClientId,
    externalReferenceReviewToken: payload.externalReferenceReviewToken, reviewedLineIds: [...payload.reviewedLineIds].sort((a, b) => a - b) };
  const fingerprint = createHash('sha256').update(JSON.stringify(intent)).digest('hex');
  return repository.transaction(async tx => {
    const key = `external-reference-review:${id}:${intent.requestId}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
    const previous = await tx.auditTrail.findFirst({ where: { entity: 'Invoice', entityId: id, action: 'EXTERNAL_INVOICE_REFERENCE_REVIEWED', metadata: { path: ['requestId'], equals: intent.requestId } } });
    if (previous) {
      if (previous.metadata?.fingerprint !== fingerprint) externalFailure('Este pedido já registou outra decisão. Atualize e consulte o histórico.', 409);
      return { ...previous.metadata.result, idempotent: true };
    }
    await lockInvoiceNumber(tx, intent.externalInvoiceNo.trim());
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "InvoiceLine" WHERE "invoiceId" = ${id} ORDER BY id FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { client: true, lines: { orderBy: { id: 'asc' } } } });
    if (!invoice) externalFailure('Documento não encontrado.', 404);
    if (invoice.clientId !== intent.expectedClientId || invoice.externalInvoiceNo !== intent.externalInvoiceNo) externalFailure('A referência ou o cliente mudou. Atualize e confirme novamente.', 409);
    const history = await tx.auditTrail.findMany({ where: { entity: 'Invoice', entityId: id, action: { in: externalHistoryActions } }, orderBy: { id: 'desc' } });
    const conflicts = await conflictingInvoiceIds(tx, intent.externalInvoiceNo.trim(), id);
    const review = referenceReview(invoice, history, conflicts);
    if (review.token !== intent.externalReferenceReviewToken || JSON.stringify(intent.reviewedLineIds) !== JSON.stringify(invoice.lines.map(line => line.id))) externalFailure('Os dados, serviços ou referências relacionadas mudaram. Atualize a revisão.', 409);
    if (intent.decision === 'CONFIRM_EXTERNAL' ? !review.canConfirm : !review.canMarkInternal) externalFailure('Esta decisão não está disponível para a referência atual. Consulte os conflitos e o histórico.', 409);
    const recordedAt = new Date();
    const result = { ok: true, invoiceId: id, clientId: invoice.clientId, requestId: intent.requestId, decision: intent.decision,
      reviewedReference: intent.externalInvoiceNo, externalInvoiceNo: intent.decision === 'INTERNAL_ONLY' ? null : invoice.externalInvoiceNo, recordedAt: recordedAt.toISOString() };
    // Only the explicitly reviewed duplicate of this document's internal number
    // can be removed from the fiscal field. Preserve the original in the audit.
    if (intent.decision === 'INTERNAL_ONLY') await tx.invoice.update({ where: { id }, data: { externalInvoiceNo: null } });
    await tx.communicationLog.create({ data: { clientId: invoice.clientId, channel: 'EXTERNAL_INVOICE_REVIEW', referenceId: id,
      message: `Revisão do documento #${id}: ${intent.decision === 'INTERNAL_ONLY' ? 'apenas número interno' : 'fatura externa confirmada'} — ${intent.externalInvoiceNo}. ${intent.note}` } });
    await tx.auditTrail.create({ data: { action: 'EXTERNAL_INVOICE_REFERENCE_REVIEWED', eventType: 'EXTERNAL_INVOICE_REFERENCE_REVIEWED', entity: 'Invoice', entityId: id,
      clientId: invoice.clientId, createdAt: recordedAt,
      beforeJson: { externalInvoiceNo: invoice.externalInvoiceNo, invoiceNumber: invoice.invoiceNumber, invoiceIssued: invoice.invoiceIssued },
      afterJson: { externalInvoiceNo: result.externalInvoiceNo, invoiceNumber: invoice.invoiceNumber, invoiceIssued: invoice.invoiceIssued },
      metadata: { actor: `ADMIN:${user?.id}`, kind: 'EXTERNAL_REFERENCE_ONLY', association: 'WHOLE_INTERNAL_DOCUMENT',
        decision: intent.decision, requestId: intent.requestId, fingerprint, externalInvoiceNo: intent.externalInvoiceNo, note: intent.note,
        checklistConfirmed: true, snapshot: JSON.parse(JSON.stringify(externalSnapshot(invoice))), result } } });
    return result;
  });
}

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
  const serviceIds = lineItems.filter(line => String(line.type || line.lineType || 'SERVICE').trim().toUpperCase() === 'SERVICE' && line.referenceId != null).map(line => Number(line.referenceId));
  if (new Set(repairIds).size !== repairIds.length) return { ok: false, status: 409, error: 'A reparação está repetida nas linhas da fatura' };
  const run = async tx => {
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${clientId} FOR NO KEY UPDATE`;
    const client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client) return { ok: false, status: 404, error: "Cliente não encontrado" };
    if (payload.requireActiveContract && (!client.active || client.status !== 'ACTIVE' || !client.billingActive || client.deletedAt || client.archiveStatus !== 'ATIVO')) return { ok: false, status: 409, error: "Contrato inativo" };
    if (monthRef !== null && await tx.invoice.findFirst({ where: { clientId, monthRef } })) return { ok: false, status: 409, error: "Já existe fatura para este mês" };
    if ((await reservedRepairIds(tx, repairIds)).size) return { ok: false, status: 409, error: 'Reparação já associada a uma fatura. Consulte o documento existente.' };
    if (repairIds.length && await tx.repair.count({ where: { id: { in: repairIds }, pool: { clientId } } }) !== repairIds.length) return { ok: false, status: 409, error: 'A referência não pertence a uma reparação deste cliente' };
    if(serviceIds.length){const sources=await tx.serviceVisit.findMany({where:{id:{in:serviceIds}},select:{contractService:true}});if(sources.some(require('../../services/clientServicePlan').included))return {ok:false,status:409,error:'Esta visita está incluída no contrato mensal e não pode ser cobrada novamente como serviço avulso.'};}
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
  const id = Number(invoiceId);
  if (!/^\d+$/.test(String(invoiceId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return { ok: false, status: 400, error: 'Fatura inválida' };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || [payload.invoiceNumber, payload.externalInvoiceNo, payload.notes].some(value => value !== undefined && (typeof value !== 'string' || value.length > 2000))) return { ok: false, status: 400, error: 'Dados de emissão inválidos' };
  if (payload.invoiceNumber && payload.externalInvoiceNo && payload.invoiceNumber.trim() !== payload.externalInvoiceNo.trim()) return { ok: false, status: 400, error: 'Números de documento diferentes' };
  const include = { client: true, lines: true, payments: true };
  const invoiceNumber = String(payload.invoiceNumber || payload.externalInvoiceNo || "").trim() || null;
  const run = async tx => {
    if (invoiceNumber) {
      try { await reserveInvoiceNumber(tx, invoiceNumber, id); }
      catch (error) { if (error.status) return { ok: false, status: error.status, error: error.message }; throw error; }
    }
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id }, include });
    if (!invoice) return { ok: false, status: 404, error: "Fatura não encontrada" };
    const status = normalizeInvoiceStatus(invoice.status);
    if (NON_RECEIVABLE_STATUSES.includes(status) && !['DRAFT', 'RASCUNHO'].includes(status)) return { ok: false, status: 409, error: 'Documento retirado; não pode ser reaberto por emissão' };
    if ((invoice.invoiceNumber && invoiceNumber && invoice.invoiceNumber !== invoiceNumber) || (invoice.externalInvoiceNo && payload.externalInvoiceNo && invoice.externalInvoiceNo !== payload.externalInvoiceNo.trim())) return { ok: false, status: 409, error: 'O número do documento já está definido' };
    if (invoice.invoiceIssued || status === 'ISSUED') return { ok: true, invoice: invoiceShape(invoice), alreadyIssued: true };
    if (!['DRAFT', 'RASCUNHO', 'PENDING'].includes(status) || invoicePaid(invoice) > 0 || invoice.payments.some(payment => Number(payment.amount) > 0 || Number(payment.amountCents) > 0)) return { ok: false, status: 409, error: 'O estado ou pagamentos do documento não permitem esta emissão' };
    const issued = await tx.invoice.update({ where: { id }, data: {
      status: 'ISSUED', invoiceIssued: true, invoiceNumber: invoiceNumber || invoice.invoiceNumber,
      // An internal document number alone does not confirm an external invoice.
      externalInvoiceNo: payload.externalInvoiceNo?.trim() || invoice.externalInvoiceNo, issueDate: invoice.issueDate || new Date(),
      notes: [invoice.notes, payload.notes].filter(Boolean).join('\n') || invoice.notes,
    }, include });
    await tx.auditTrail.create({ data: { eventType: 'FINANCE_INVOICE_ISSUED', action: 'FINANCE_INVOICE_ISSUED', entity: 'Invoice', entityId: id,
      clientId: invoice.clientId, metadata: { actor, invoiceNumber: issued.invoiceNumber, kind: 'INTERNAL_ISSUE' }, beforeJson: { status: invoice.status }, afterJson: { status: issued.status } } });
    return { ok: true, invoice: invoiceShape(issued) };
  };
  let result;
  try { result = transaction ? await run(transaction) : await repository.transaction(run); }
  catch (error) { if (error.code === 'P2002' && !transaction) return { ok: false, status: 409, error: 'Número de documento já utilizado' }; throw error; }
  if (result.ok && !result.alreadyIssued && !transaction) await emitFinanceEvent(EVENT_TYPES.FINANCE_INVOICE_ISSUED, {
    invoiceId: result.invoice.id,
    clientId: result.invoice.clientId,
    actor,
  });
  return result;
}

async function sendInvoice(invoiceId, payload = {}, actor = "finance-os") {
  const id = Number(invoiceId);
  if (!/^\d+$/.test(String(invoiceId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return { ok: false, status: 400, error: 'Fatura inválida' };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || (payload.channel !== undefined && typeof payload.channel !== 'string')) return { ok: false, status: 400, error: 'Canal inválido' };
  const channel = String(payload.channel || "EMAIL").trim().toUpperCase();
  if (!['EMAIL', 'WHATSAPP', 'SMS', 'CHAT', 'PORTAL'].includes(channel)) return { ok: false, status: 400, error: 'Canal inválido' };
  const result = await repository.transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { client: true, lines: true, payments: true } });
    if (!invoice) return { ok: false, status: 404, error: 'Fatura não encontrada' };
    if (!isReceivableInvoice(invoice)) return { ok: false, status: 409, error: 'Emita o rascunho ou reveja o documento retirado antes de preparar o envio' };
    const sourceKey = `invoice-delivery-preparation:${id}:${channel}`;
    const previous = await tx.operationalReminder.findUnique({ where: { sourceKey } });
    if (previous) return { ...previous.metadata.result, invoice: invoiceShape(invoice), idempotent: true };
    await tx.communicationLog.create({ data: { clientId: invoice.clientId, channel: 'INVOICE_DELIVERY_PREPARATION', referenceId: id,
      message: `Preparação da fatura #${id} para ${channel}. A entrega externa ainda não foi efetuada.` } });
    await tx.notification.create({ data: { clientId: invoice.clientId, type: 'INVOICE_DELIVERY_PREPARED', eventType: 'FINANCE_INVOICE_DELIVERY_PREPARED',
      title: 'Documento preparado', message: `Fatura #${id} preparada para ${channel}; envio externo por concluir.`, role: 'ADMIN', severity: 'INFO', status: 'PENDING', metadata: { invoiceId: id, channel, deliveryStatus: 'NOT_SENT' } } });
    await tx.auditTrail.create({ data: { action: 'FINANCE_INVOICE_DELIVERY_PREPARED', eventType: 'FINANCE_INVOICE_DELIVERY_PREPARED', entity: 'Invoice', entityId: id,
      clientId: invoice.clientId, metadata: { channel, actor, deliveryStatus: 'NOT_SENT' } } });
    const prepared = { ok: true, invoice: invoiceShape(invoice), channel, prepared: true, deliveryStatus: 'NOT_SENT',
      message: 'Documento preparado. A entrega externa ainda não foi efetuada.' };
    await tx.operationalReminder.create({ data: { sourceKey, title: 'Preparação de documento registada', dueDate: new Date(), isCompleted: true,
      metadata: { result: JSON.parse(JSON.stringify(prepared)) } } });
    return prepared;
  });
  if (result.ok && !result.idempotent) await emitFinanceEvent(EVENT_TYPES.FINANCE_INVOICE_DELIVERY_PREPARED, { invoiceId: id, clientId: result.invoice.clientId, channel, actor, deliveryStatus: 'NOT_SENT' });
  return result;
}

async function registerPayment(invoiceId, payload = {}, actor = "finance-os", user = null, transaction = null) {
  payload = { ...payload, method: cashMethod(payload.method) };
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
  return require('../../services/operationalValueReportService').technicians(query);
}

async function getCustomerProfitabilityReport(query = {}) {
  return require('../../services/operationalValueReportService').clients(query);
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
  listExternalInvoices,
  registerExternalInvoice,
  reviewExternalReference,
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
