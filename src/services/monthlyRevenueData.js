'use strict';
const r = require('./expenseLedgerRules'), projection = require('./monthlyFinancialProjection');
const coverage = require('./financialRevenueCoverageService');
const { isReceivableInvoice } = require('./clientCreditService');
const { isCompletedVisitStatus } = require('./operationalValueReportService');
const normal = value => String(value || '').trim().toUpperCase();
const monthPattern = /^(20|21)\d{2}-(0[1-9]|1[0-2])$/;
const json = value => JSON.parse(JSON.stringify(value));
const lineSelect = { id:true, type:true, lineType:true, description:true, referenceId:true, quantity:true, unitPrice:true, total:true, lineTotal:true, sourceMonth:true, serviceDate:true, notes:true };
const documentSelect = { ...coverage.documentSelect, monthRef:true, month:true, year:true, lines:{ select:lineSelect } };
const visitSelect = { id:true, clientId:true, poolId:true, status:true, startAt:true, endAt:true, client:{select:{name:true}}, pool:{select:{name:true}} };
const regularSelect = { ...visitSelect, contractService:true }, extraSelect = { ...visitSelect, billingMode:true, includedInPackage:true };
function documentMonth(invoice) {
  if (invoice.monthRef !== null) return monthPattern.test(invoice.monthRef) ? invoice.monthRef : null;
  if (monthPattern.test(invoice.month)) return invoice.month;
  return /^(20|21)\d{2}$/.test(String(invoice.year)) && /^(0?[1-9]|1[0-2])$/.test(invoice.month) ? invoice.year + '-' + invoice.month.padStart(2,'0') : null;
}
function source(invoice, line) {
  const documentMonthRef = documentMonth(invoice), monthRef = line.sourceMonth === null ? documentMonthRef : monthPattern.test(line.sourceMonth) ? line.sourceMonth : null;
  const reason = coverage.documentReason(invoice) || (!documentMonthRef || !monthRef ? 'INVALID_PERIOD' : coverage.lineType(line) !== 'MONTHLY' ? 'NOT_MONTHLY' : !(projection.cents(line.total) > 0) ? 'EMPTY_LINE' : null);
  // Payment timestamps, cash and status transitions among receivable states do not change the documented price.
  const snapshot = json({ invoiceId:invoice.id, lineId:line.id, clientId:invoice.clientId, documentMonth:documentMonthRef, monthRef,
    amountCents:projection.cents(line.total), documentAmountCents:projection.document(invoice).amountCents,
    lines:[...invoice.lines].sort((a,b)=>a.id-b.id) });
  return { ...snapshot, lines:undefined, clientName:invoice.client.name, label:line.description, valid:!reason, excluded:projection.document(invoice).classification === 'EXCLUDED', reason, hash:r.hash(snapshot), snapshot };
}
function target(type, row, references) {
  const facts = json({ type, id:row.id, clientId:row.clientId, poolId:row.poolId, status:normal(row.status), startAt:row.startAt, endAt:row.endAt,
    ...(type === 'REGULAR' ? { contractService:row.contractService } : { billingMode:normal(row.billingMode), includedInPackage:row.includedInPackage }) });
  const legacy = type === 'REGULAR' && row.contractService === null;
  const included = type === 'REGULAR' ? legacy || row.contractService?.billing === 'INCLUDED_MONTHLY' : row.includedInPackage === true && normal(row.billingMode) === 'INCLUDED';
  const reason = !row.clientId ? 'CLIENT_MISMATCH' : !isCompletedVisitStatus(row.status) ? 'SERVICE_NOT_COMPLETED' : !row.endAt ? 'MISSING_COMPLETION_DATE' : !included ? 'NOT_INCLUDED' : references.has(type + ':' + row.id) ? 'EXPLICIT_CHARGE' : null;
  const label = (type === 'REGULAR' ? 'Visita regular #' : 'Visita extra #') + row.id + ' · ' + (row.pool?.name || 'Sem instalação') + ' · ' + (r.day(row.endAt) || 'Sem data');
  return { type, id:row.id, clientId:row.clientId, monthRef:row.endAt?.toISOString().slice(0,7) || null, valid:!reason, reason, legacy, label, hash:r.hash(facts), snapshot:{ ...facts, label, clientName:row.client?.name || null } };
}
async function targets(db, ids, clientId) {
  const where = type => clientId === undefined ? {id:{in:[...new Set(ids.filter(i=>i.type===type).map(i=>i.id))]}} : {clientId};
  const [regular, extra] = await Promise.all([db.serviceVisit.findMany({where:where('REGULAR'),select:regularSelect}), db.extraVisit.findMany({where:where('EXTRA'),select:extraSelect})]);
  const lines = await db.invoiceLine.findMany({where:{referenceId:{in:[...new Set([...regular,...extra].map(v=>v.id))]}}, select:{ type:true, lineType:true, referenceId:true, invoice:{select:{status:true,lines:{select:{type:true,lineType:true}}}} }});
  const references = new Set();
  for (const line of lines) if (isReceivableInvoice(line.invoice) && !line.invoice.lines.some(l=>[l.type,l.lineType].some(t=>normal(t)==='CREDIT_DEPOSIT'))) for (const key of coverage.references(line)) references.add(key);
  return new Map([...regular.map(v=>['REGULAR:'+v.id,target('REGULAR',v,references)]),...extra.map(v=>['EXTRA:'+v.id,target('EXTRA',v,references)])]);
}
function state(current, allocations, targetMap) {
  const active = allocations.filter(a=>!a.voidedAt), historical = allocations[0]?.sourceSnapshot;
  const amount = current?.amountCents ?? null, reserved = projection.sum(active.map(a=>a.amountCents));
  const over = reserved === null || current && (amount === null || reserved > amount);
  const decorated = allocations.map(a=>{
    const t = targetMap.get(a.targetType+':'+a.targetId);
    const reason = !current ? 'SOURCE_MISSING' : !current.valid || current.hash !== a.sourceHash ? 'SOURCE_CHANGED' : over ? 'OVER_BUDGET' : !t || !t.valid || t.hash !== a.targetHash || t.clientId !== a.clientId || t.monthRef !== a.monthRef ? 'TARGET_CHANGED' : null;
    return {...a, needsReview:!a.voidedAt && !!reason, reviewReason:a.voidedAt ? null : reason};
  });
  const reviewCount = decorated.filter(a=>a.needsReview).length, valid = !!current?.valid && !reviewCount && !over;
  const facts = {sourceHash:current?.hash || null, sourceValid:current?.valid || false, active:decorated.filter(a=>!a.voidedAt).map(a=>({id:a.id,amountCents:a.amountCents,sourceHash:a.sourceHash,targetHash:a.targetHash,reviewReason:a.reviewReason}))};
  return { lineId:current?.lineId || historical.lineId, invoiceId:current?.invoiceId || historical.invoiceId,
    clientId:current?.clientId || historical.clientId, clientName:current?.clientName || allocations[0]?.targetSnapshot?.clientName || 'Cliente histórico',
    label:current?.label || 'Linha de mensalidade retirada', monthRef:current?.monthRef || historical?.monthRef || null, documentMonth:current?.documentMonth || historical?.documentMonth || null,
    source:current || null, valid, excluded:!active.length && (!current || current.excluded || current.reason === 'NOT_MONTHLY'), reviewCount, amountCents:current?.valid ? amount : null, reservedAmountCents:reserved,
    allocatedAmountCents:valid ? reserved : null, availableAmountCents:valid ? amount - reserved : null,
    stateHash:r.hash(facts), allocations:decorated };
}
async function states(db, lineId) {
  let allocations = await db.revenueAllocation.findMany({where:lineId ? {lineId} : {},orderBy:{id:'asc'}});
  const invoices = await db.invoice.findMany({where:lineId ? {OR:[{lines:{some:{id:lineId}}},{id:{in:allocations.map(a=>a.invoiceId)}}]} : {},select:documentSelect});
  // Replacement lines cannot reuse a document's budget while old reservations
  // still need review. Include sibling lines even when reading one exact source.
  if (lineId && invoices.length) allocations = await db.revenueAllocation.findMany({where:{invoiceId:{in:invoices.map(i=>i.id)}},orderBy:{id:'asc'}});
  const targetMap = await targets(db, allocations.filter(a=>!a.voidedAt).map(a=>({type:a.targetType,id:a.targetId})));
  const sources = new Map();
  for (const invoice of invoices) for (const line of invoice.lines) if ([line.type,line.lineType].map(normal).includes('MONTHLY') || allocations.some(a=>a.lineId===line.id)) sources.set(line.id,source(invoice,line));
  const ids = new Set([...sources.keys(),...allocations.map(a=>a.lineId)]);
  const rows = [...ids].sort((a,b)=>b-a).map(id=>state(sources.get(id),allocations.filter(a=>a.lineId===id),targetMap));
  const reviews = rows.flatMap(s=>s.allocations).filter(a=>a.needsReview);
  return rows.map(s=>{
    const siblings = reviews.filter(a=>a.invoiceId===s.invoiceId).map(a=>({id:a.id,reason:a.reviewReason,amountCents:a.amountCents}));
    return s.valid && siblings.length ? {...s,valid:false,allocatedAmountCents:null,availableAmountCents:null,stateHash:r.hash({source:s.stateHash,documentReviews:siblings})} : s;
  }).filter(s=>!lineId||s.lineId===lineId);
}
module.exports = { json, documentMonth, documentSelect, targets, states };
