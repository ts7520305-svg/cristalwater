'use strict';
const { prisma } = require('../prismaClient');
const cashReceipts = require('./cashReceiptReportService');
const { period, documentMonthWhere } = require('./operationalValueReportService');
const { invoiceTotal, invoiceOpen, isReceivableInvoice } = require('./clientCreditService');

const sections = new Set(['financial', 'reports', 'communications']);
const receivableStates = new Set(['PENDING', 'PARTIAL', 'OVERDUE', 'ISSUED', 'SENT', 'PAID']);
const normalize = value => String(value || '').trim().toUpperCase();
const cents = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001 ? Math.round(value * 100) : null;
function sum(values) {
  let result = 0;
  for (const value of values) {
    if (value === null || !Number.isSafeInteger(result + value)) return null;
    result += value;
  }
  return result;
}

async function financial(db, monthRef) {
  const [payments, invoices] = await Promise.all([
    cashReceipts.payments(monthRef, db),
    db.invoice.findMany({where:documentMonthWhere(monthRef),select:{status:true,amount:true,total:true,totalAmount:true,amountPaid:true,amountOpen:true,lines:{select:{type:true,lineType:true}}}})
  ]);
  const cashAmounts = payments.map(payment => cents(payment.amount));
  const documents = {total:invoices.length,receivableCount:0,excludedCount:0,unknownStatusCount:0,invalidAmountCount:0,amountCents:0,openAmountCents:0};
  const amounts = [], balances = [];
  for (const invoice of invoices) {
    const deposit = invoice.lines.some(line => [line.type,line.lineType].some(type => normalize(type) === 'CREDIT_DEPOSIT'));
    if (deposit || !isReceivableInvoice(invoice)) { documents.excludedCount++; continue; }
    if (!receivableStates.has(normalize(invoice.status))) { documents.unknownStatusCount++; continue; }
    documents.receivableCount++;
    const raw = [invoice.amount,invoice.total,invoice.totalAmount,invoice.amountPaid,invoice.amountOpen].map(cents);
    const totals = raw.slice(0,3).filter(value => value > 0);
    // Zero aliases are historical defaults. Conflicting positive totals require review.
    if (raw.includes(null) || new Set(totals).size > 1) { documents.invalidAmountCount++; continue; }
    amounts.push(cents(invoiceTotal(invoice))); balances.push(cents(invoiceOpen(invoice)));
  }
  const needsReview = documents.unknownStatusCount > 0 || documents.invalidAmountCount > 0;
  documents.amountCents = needsReview ? null : sum(amounts);
  documents.openAmountCents = needsReview ? null : sum(balances);
  return {
    basis:{cash:'PAYMENT_PAID_AT_UTC',documents:'DOCUMENT_MONTH_REFERENCE_CURRENT_VALUES',balance:'CURRENT_DOCUMENT_BALANCE',internalCreditIncluded:false,historicalClosingBalance:false},
    currency:'EUR',
    cash:{amountCents:sum(cashAmounts),paymentCount:payments.length,invalidAmountCount:cashAmounts.filter(value => value === null).length},
    documents
  };
}

async function reports(db, monthRef) {
  const groups = await db.monthlyReport.groupBy({by:['type'],where:{month:monthRef},_count:{_all:true}});
  const result = {basis:'MONTHLY_REPORT_MONTH',total:0,adminCount:0,clientCount:0,otherCount:0};
  for (const group of groups) {
    result.total += group._count._all;
    result[group.type === 'ADMIN' ? 'adminCount' : group.type === 'CLIENT' ? 'clientCount' : 'otherCount'] += group._count._all;
  }
  return result;
}

async function communications(db, start, end) {
  const where = {createdAt:{gte:start,lt:end}};
  const [total,latest] = await Promise.all([
    db.communicationLog.count({where}),
    db.communicationLog.findMany({where,select:{id:true,channel:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:5})
  ]);
  return {basis:'COMMUNICATION_LOG_CREATED_AT_UTC',deliveryConfirmed:false,total,latestLimit:5,latest};
}

async function summary(query = {}) {
  if (Object.keys(query).some(key => !['monthRef','section'].includes(key)) || typeof query.monthRef !== 'string' || !sections.has(query.section)) {
    throw Object.assign(new Error('Indique mês e secção válidos para o relatório.'),{status:400});
  }
  const {monthRef,start,end} = period({monthRef:query.monthRef});
  return prisma.$transaction(async db => {
    const data = query.section === 'financial' ? await financial(db,monthRef) : query.section === 'reports' ? await reports(db,monthRef) : await communications(db,start,end);
    return {ok:true,reportVersion:1,section:query.section,monthRef,period:{start,end,timeZone:'UTC'},generatedAt:new Date().toISOString(),complete:true,limitApplied:null,data};
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:30000});
}

module.exports = {summary};
