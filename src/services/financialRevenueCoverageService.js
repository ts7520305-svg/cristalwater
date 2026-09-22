'use strict';
const projection = require('./monthlyFinancialProjection');
const { isReceivableInvoice } = require('./clientCreditService');
const { isCompletedVisitStatus } = require('./operationalValueReportService');
const { included } = require('./clientServicePlan');
const maintenance = require('./financialMaintenanceRevenueService');
const repairs = require('./repairRevenueSourceService');
const normalize = value => String(value || '').trim().toUpperCase();
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const types = { SERVICE: 'REGULAR', EXTRA_VISIT: 'EXTRA' };
const lineSelect = { id: true, type: true, lineType: true, referenceId: true, total: true, lineTotal: true, quantity: true, unitPrice: true, description:true, notes:true, serviceDate:true, sourceMonth:true };
const documentSelect = { ...projection.documentSelect, id: true, clientId: true, amountCents: true, totalCents: true, taxAmount: true, client: { select: { name: true } }, lines: { select: lineSelect } };
const visitSelect = { id: true, clientId: true, status: true, endAt: true };
const sample = rows => ({ total: rows.length, limit: 10, sampleOnly: rows.length > 10, rows: rows.slice(0, 10) });
function sum(values) { const result = projection.sum(values); if (result === null) throw Error('Revenue coverage total unavailable'); return result; }
function lineType(line) {
  const a = normalize(line.type), b = normalize(line.lineType);
  const aliases = [a,b].filter(Boolean);
  if (aliases.every(t=>['MAINTENANCE','MAINTENANCE_EQUIPMENT','MAINTENANCE_REMINDER'].includes(t)) && maintenance.aliases(line).length <= 1 && aliases.length) return 'MAINTENANCE';
  return a && b && a !== b ? null : a || b || null;
}
// Conflicting aliases reserve both typed identities for review, never just one.
function references(line) { return positiveId(line.referenceId) ? [...new Set([line.type, line.lineType].map(normalize).map(t => types[t]).filter(Boolean))].map(type => type + ':' + line.referenceId) : []; }
function documentReason(invoice) {
  const value = projection.document(invoice);
  if (value.classification !== 'RECEIVABLE') return 'DOCUMENT_VALUES';
  if (!invoice.lines.length) return 'NO_LINES';
  const tax = projection.cents(invoice.taxAmount);
  if (tax === null || tax > 0) return 'TAX_UNALLOCATED';
  if ([invoice.amountCents, invoice.totalCents].some(c => !Number.isSafeInteger(c) || c < 0 || c > 0 && c !== value.amountCents)) return 'DOCUMENT_VALUES';
  for (const line of invoice.lines) {
    const aliases = [line.type, line.lineType].map(normalize);
    if (aliases.some(t => /CREDIT|DISCOUNT|ADJUST|ARREAR|CARRY|DEBT|BALANCE/.test(t)) || line.total < 0 || line.lineTotal < 0) return 'ADJUSTED_DOCUMENT';
    const type = lineType(line);
    if (!type) return 'CONFLICTING_LINE_TYPES';
    if (!['MONTHLY', 'SERVICE', 'EXTRA_VISIT', 'REPAIR', 'MAINTENANCE'].includes(type)) return 'UNSUPPORTED_LINE_TYPE';
    const amount = projection.cents(line.total), alias = projection.cents(line.lineTotal);
    if (amount === null || alias === null || amount !== alias) return 'LINE_VALUES';
  }
  if (sum(invoice.lines.map(line => projection.cents(line.total))) !== value.amountCents) return 'LINE_TOTAL_MISMATCH';
  return null;
}

// The month belongs to the document, not to cash receipt or service completion.
// This read-only partition never distributes a monthly contract automatically.
async function build(db, monthRef, generatedAt, invoices) {
  const maintenanceContext = await maintenance.load(db,invoices);
  const repairContext = await repairs.load(db,invoices,generatedAt);
  const monthlyStates = await require('./monthlyRevenueData').states(db);
  const monthlyById = new Map(monthlyStates.map(s => [s.lineId, s]));
  const activeAllocations = monthlyStates.flatMap(s => s.allocations).filter(a => !a.voidedAt);
  const candidates = invoices.flatMap(i => i.lines).flatMap(references);
  const ids = type => [...new Set(candidates.filter(k => k.startsWith(type + ':')).map(k => Number(k.split(':')[1])))];
  const regularIds = ids('REGULAR'), extraIds = ids('EXTRA');
  const [regular, extra, allReferences] = await Promise.all([
    db.serviceVisit.findMany({ where: { id: { in: regularIds } }, select: { ...visitSelect, contractService: true } }),
    db.extraVisit.findMany({ where: { id: { in: extraIds } }, select: { ...visitSelect, includedInPackage: true, billingMode: true } }),
    db.invoiceLine.findMany({ where: { referenceId: { in: [...new Set([...regularIds, ...extraIds])] } }, select: { ...lineSelect, invoice: { select: { status: true, lines: { select: { type: true, lineType: true } } } } } })
  ]);
  const current = new Map([...regular.map(v => ['REGULAR:' + v.id, v]), ...extra.map(v => ['EXTRA:' + v.id, v])]), counts = new Map();
  for (const line of allReferences) {
    if (!isReceivableInvoice(line.invoice) || line.invoice.lines.some(l => [l.type, l.lineType].map(normalize).includes('CREDIT_DEPOSIT'))) continue;
    for (const key of references(line)) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const documents = { total: invoices.length, reconciled: 0, review: 0, excluded: 0 };
  const lines = { total: 0, linked: 0, maintenanceLinked: 0, repairDocumented:0, monthly: 0, monthlyAllocated: 0, unassigned: 0, review: 0 };
  const values = { linked: [], maintenanceLinked: [], repairDocumented:[], monthly: [], monthlyAllocated: [], unassigned: [], review: [] }, documentValues = [], issues = [], linked = [], linkedMaintenance = [], linkedRepairs = [];
  for (const invoice of [...invoices].sort((a, b) => a.id - b.id)) {
    if (projection.document(invoice).classification === 'EXCLUDED') { documents.excluded++; continue; }
    const identity = { invoiceId: invoice.id, clientId: invoice.clientId, clientName: invoice.client.name };
    const reason = documentReason(invoice);
    if (reason) { documents.review++; issues.push({ ...identity, lineId: null, reason }); continue; }
    documents.reconciled++; documentValues.push(projection.document(invoice).amountCents);
    for (const line of [...invoice.lines].sort((a, b) => a.id - b.id)) {
      const type = lineType(line), targetType = types[type], amountCents = projection.cents(line.total);
      let bucket, issue;
      if (type === 'MONTHLY') {
        const state = monthlyById.get(line.id);
        if (!state?.valid) { bucket = 'review'; issue = 'MONTHLY_ALLOCATION_REVIEW'; }
        else {
          values.monthlyAllocated.push(state.allocatedAmountCents);
          values.monthly.push(state.availableAmountCents);
          lines.total++;
          if (state.availableAmountCents > 0) { lines.monthly++; issues.push({ ...identity, lineId:line.id, reason:'MONTHLY_UNALLOCATED' }); }
          else lines.monthlyAllocated++;
          continue;
        }
      }
      else if (type === 'MAINTENANCE' && maintenance.aliases(line).length) {
        const result = maintenance.match(maintenanceContext,invoice,line); issue=result.reason; bucket=issue?'review':'maintenanceLinked';
        if(!issue){const {reason,...source}=result;linkedMaintenance.push({...identity,lineId:line.id,...source,amountCents});}
      }
      else if (type === 'REPAIR') {
        const result=repairs.match(repairContext,invoice,line);issue=result.reason;bucket=issue?'review':'repairDocumented';
        if(!issue){const {reason,...source}=result;linkedRepairs.push({...identity,lineId:line.id,...source,amountCents});}
      }
      else if (!targetType) { bucket = 'unassigned'; issue = 'OTHER_SOURCE_UNALLOCATED'; }
      else {
        const key = targetType + ':' + line.referenceId, visit = current.get(key);
        issue = !positiveId(line.referenceId) ? 'MISSING_REFERENCE' : !visit ? 'MISSING_SERVICE' : counts.get(key) !== 1 ? 'DUPLICATE_REFERENCE' :
          visit.clientId !== invoice.clientId ? 'CLIENT_MISMATCH' : !isCompletedVisitStatus(visit.status) ? 'SERVICE_NOT_COMPLETED' : !visit.endAt ? 'MISSING_COMPLETION_DATE' :
          (targetType === 'REGULAR' ? included(visit) : visit.includedInPackage || normalize(visit.billingMode) !== 'EXTRA') ? 'SERVICE_INCLUDED_OR_UNCONFIRMED' : null;
        bucket = issue ? 'review' : 'linked';
        if (!issue) linked.push({ ...identity, lineId: line.id, type: targetType, id: visit.id, serviceMonth: visit.endAt.toISOString().slice(0, 7), amountCents });
      }
      lines.total++; lines[bucket]++; values[bucket].push(amountCents);
      if (issue) issues.push({ ...identity, lineId: line.id, reason: issue });
    }
  }
  const repairExecution={basis:require('./repairExecutionService').basis,total:linkedRepairs.length};
  for(const state of ['CONFIRMED','UNCONFIRMED','REVIEW']){const rows=linkedRepairs.filter(r=>r.execution.state===state),key=state.toLowerCase();repairExecution[key+'Count']=rows.length;repairExecution[key+'AmountCents']=sum(rows.map(r=>r.amountCents));}
  return { version: 5, monthRef, currency: 'EUR', generatedAt: generatedAt.toISOString(), state: 'PARTIAL', completeRevenueAllocation: false, revenue: null, profit: null, limitApplied: null,
    basis: { documents: 'DOCUMENT_MONTH_REFERENCE_CURRENT_VALUES', amounts: 'RECONCILED_DOCUMENT_LINES_ONLY', services: 'UNIQUE_TYPED_COMPLETED_SERVICE_CURRENT_STATE', maintenance:'ORIGINAL_EXTRA_DECISION_AND_CURRENT_COMPLETED_INTERVENTION', repairs:'ORIGINAL_DOCUMENT_LINE_AND_SEPARATE_EXECUTION_CONFIRMATION', duplicates: 'RECEIVABLE_REFERENCES_ALL_MONTHS', cashIncluded: false, historicalClosingBalance: false },
    monthlyAllocations: { basis:'EXPLICIT_CONTRACT_SERVICE_ALLOCATION_CURRENT_STATE_ALL_MONTHS', activeCount:activeAllocations.length, reviewCount:activeAllocations.filter(a=>a.needsReview).length },
    documents, lines, reconciledDocumentAmountCents: sum(documentValues), linkedServiceAmountCents: sum(values.linked), maintenanceLinkedAmountCents: sum(values.maintenanceLinked), repairDocumentedAmountCents:sum(values.repairDocumented), monthlyAllocatedAmountCents: sum(values.monthlyAllocated), monthlyUnallocatedAmountCents: sum(values.monthly), otherUnallocatedAmountCents: sum(values.unassigned), serviceReviewAmountCents: sum(values.review),
    repairExecution, linkedServices: sample(linked), linkedMaintenance: sample(linkedMaintenance), linkedRepairs:sample(linkedRepairs), issues: sample(issues) };
}
module.exports = { documentSelect, build, documentReason, lineType, references };
