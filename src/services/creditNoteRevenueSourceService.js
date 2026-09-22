'use strict';
const { cents, sum, document } = require('./monthlyFinancialProjection');
const { hash } = require('./fieldWriteRequestService');
const event = 'FINANCE_CREDIT_NOTE_CREATED';
const basis = 'AUTHENTICATED_INTERNAL_CREDIT_NOTE_RECEIPT_CHAIN';
const normal = value => String(value || '').trim().toUpperCase();
const id = value => Number.isSafeInteger(value) && value > 0;
const amount = value => Number.isSafeInteger(value) && value >= 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const candidate = line => [line.type, line.lineType].map(normal).includes('CREDIT_NOTE');
const isNote = line => line.type === 'CREDIT_NOTE' && line.lineType === 'CREDIT_NOTE';
const signedCents = value => { const n = typeof value === 'number' ? cents(Math.abs(value)) : null; return n === null ? null : value < 0 ? -n : n; };
const fields = ['id','type','lineType','referenceId','description','quantity','unitPrice','total','lineTotal','serviceDate','sourceMonth','notes'];
const lineSnapshot = line => Object.fromEntries(fields.map(key => [key, line[key] instanceof Date ? line[key].toISOString() : line[key]]));
const linesSnapshot = lines => lines.map(lineSnapshot).sort((a,b) => a.id - b.id);
const identity = invoice => ({ id:invoice.id, clientId:invoice.clientId, monthRef:invoice.monthRef, month:invoice.month, year:invoice.year, taxAmount:invoice.taxAmount });
const reason = code => ({ reason:code, rows:[] });

async function load(db, invoices) {
  // Include invoices whose credit line has been removed: an audit cannot silently
  // disappear from the reconciliation just because the current line is missing.
  const audits = await db.auditTrail.findMany({ where:{ entity:'Invoice', entityId:{ in:invoices.map(i=>i.id) }, OR:[{ eventType:event },{ action:event }] },
    select:{ id:true, action:true, eventType:true, entityId:true, clientId:true, userId:true, message:true, beforeJson:true, afterJson:true, metadata:true, createdAt:true }, orderBy:{ id:'asc' } });
  const keys = [...new Set(audits.map(a=>a.metadata?.requestId).filter(v=>typeof v==='string'&&uuid.test(v)).map(v=>'invoice-payment:'+v))];
  const receipts = await db.operationalReminder.findMany({ where:{ sourceKey:{ in:keys } }, select:{ sourceKey:true, isCompleted:true, metadata:true } });
  const byInvoice = new Map();
  for (const audit of audits) { const rows = byInvoice.get(audit.entityId) || []; rows.push(audit); byInvoice.set(audit.entityId, rows); }
  return { byInvoice, receipts:new Map(receipts.map(r=>[r.sourceKey,r])) };
}

// Existing atomic receipts contain the exact post-command invoice and its lines.
// Read those originals; never manufacture evidence or alter historical records.
function match(context, invoice, asOf) {
  const notes = invoice.lines.filter(candidate), audits = context.byInvoice.get(invoice.id) || [];
  if (!notes.length && !audits.length) return { reason:null, rows:[] };
  const unconfirmed = () => reason('CREDIT_NOTE_ORIGIN_UNCONFIRMED'), changed = () => reason('CREDIT_NOTE_SOURCE_CHANGED');
  if (!notes.length || notes.length !== audits.length) return unconfirmed();
  let previous = null, previousTotal = null;
  const rows = [], seenLines = new Set(), seenRequests = new Set();
  for (const audit of audits) {
    const m = audit.metadata, before = audit.beforeJson, after = audit.afterJson;
    if (audit.action !== event || audit.eventType !== event || !id(audit.userId) || audit.clientId !== invoice.clientId || !object(m) || m.kind !== 'NON_CASH_CREDIT_NOTE' || !uuid.test(m.requestId) || !id(m.lineId) || !id(m.amountCents) || !amount(m.creditCents) || m.creditCents > m.amountCents || !object(before) || !object(after) || ![before.totalCents,after.totalCents,before.creditCents,after.creditCents].every(amount) || before.totalCents - m.amountCents !== after.totalCents || before.creditCents + m.creditCents !== after.creditCents || seenLines.has(m.lineId) || seenRequests.has(m.requestId) || !Number.isFinite(audit.createdAt?.getTime()) || audit.createdAt > asOf) return unconfirmed();
    const receipt = context.receipts.get('invoice-payment:'+m.requestId), result = receipt?.metadata?.result, command = result?.requestReceipt;
    let fingerprint;
    try { fingerprint = JSON.parse(receipt?.metadata?.fingerprint); } catch (_) { return unconfirmed(); }
    if (!receipt.isCompleted || !object(command) || !object(fingerprint) || result.ok !== true || result.kind !== 'NON_CASH_CREDIT_NOTE' || command.version !== 1 || command.scope !== 'INVOICE_CREDIT_NOTE' || command.method !== 'CREDIT_NOTE' || command.invoiceId !== invoice.id || command.actorId !== audit.userId || command.actorRole !== 'ADMIN' || command.requestId !== m.requestId || command.amountCents !== m.amountCents || command.creditCents !== m.creditCents || command.appliedCents !== m.amountCents-m.creditCents || command.reason !== audit.message || typeof command.reason !== 'string' || !command.reason.trim() || typeof command.notes !== 'string' || result.creditNoteId !== m.lineId || cents(result.creditNoteAmount) !== m.amountCents || cents(result.creditAdded) !== m.creditCents || cents(result.appliedAmount) !== command.appliedCents || cents(result.creditBalance) !== after.creditCents) return unconfirmed();
    const { version, appliedCents, creditCents, ...request } = command;
    if (hash(request) !== hash(fingerprint)) return unconfirmed();
    const saved = result.invoice;
    if (!object(saved) || !Array.isArray(saved.lines) || saved.lines.some(l=>!object(l)||!id(l.id)||l.invoiceId!==invoice.id) || new Set(saved.lines.map(l=>l.id)).size !== saved.lines.length || hash(identity(saved)) !== hash(identity(invoice))) return changed();
    const line = saved.lines.find(l=>l.id===m.lineId), current = notes.find(l=>l.id===m.lineId);
    if (!line || !current || !isNote(line) || !isNote(current) || hash(lineSnapshot(line)) !== hash(lineSnapshot(current)) || line.referenceId !== null || line.quantity !== 1 || signedCents(line.unitPrice) !== -m.amountCents || signedCents(line.total) !== -m.amountCents || signedCents(line.lineTotal) !== -m.amountCents || line.description !== command.reason || line.notes !== (command.notes || null) || line.serviceDate !== null || line.sourceMonth !== audit.createdAt.toISOString().slice(0,7)) return changed();
    const projection = document(saved), paid = cents(saved.amountPaid);
    if (projection.classification !== 'RECEIVABLE' || [saved.amount,saved.total,saved.totalAmount].some(v=>cents(v)!==after.totalCents) || saved.amountCents !== after.totalCents || saved.totalCents !== after.totalCents || sum(saved.lines.map(l=>signedCents(l.total))) !== after.totalCents || paid === null || Math.max(paid-after.totalCents,0)-Math.max(paid-before.totalCents,0) !== m.creditCents) return unconfirmed();
    const priorLines = saved.lines.filter(l=>l.id!==m.lineId);
    if (previous ? previousTotal !== before.totalCents || hash(linesSnapshot(previous)) !== hash(linesSnapshot(priorLines)) : priorLines.some(candidate) || sum(priorLines.map(l=>signedCents(l.total))) !== before.totalCents) return unconfirmed();
    previous = saved.lines; previousTotal = after.totalCents; seenLines.add(m.lineId); seenRequests.add(m.requestId);
    rows.push({ lineId:m.lineId, auditId:audit.id, amountCents:m.amountCents, creditReleasedCents:m.creditCents, recordedAt:audit.createdAt.toISOString(), reason:command.reason });
  }
  if (hash(linesSnapshot(previous)) !== hash(linesSnapshot(invoice.lines)) || document(invoice).amountCents !== previousTotal || [invoice.amount,invoice.total,invoice.totalAmount].some(v=>cents(v)!==previousTotal) || invoice.amountCents !== previousTotal || invoice.totalCents !== previousTotal) return changed();
  return { reason:null, rows };
}
module.exports = { basis, candidate, isNote, signedCents, load, match };
