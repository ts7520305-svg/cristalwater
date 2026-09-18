'use strict';
const { invoiceTotal, invoiceOpen, isReceivableInvoice } = require('./clientCreditService');

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
const documentSelect = { status:true, amount:true, total:true, totalAmount:true, amountPaid:true, amountOpen:true, lines:{select:{type:true,lineType:true}} };

function document(invoice) {
  const unavailable = { amountCents:null, paidAmountCents:null, openAmountCents:null };
  const deposit = (invoice.lines || []).some(line => [line.type, line.lineType].some(type => normalize(type) === 'CREDIT_DEPOSIT'));
  if (deposit || !isReceivableInvoice(invoice)) return { ...unavailable, classification:'EXCLUDED', reason:deposit ? 'CREDIT_DEPOSIT' : 'NON_RECEIVABLE_STATUS' };
  if (!receivableStates.has(normalize(invoice.status))) return { ...unavailable, classification:'UNKNOWN_STATUS' };
  const raw = [invoice.amount, invoice.total, invoice.totalAmount, invoice.amountPaid, invoice.amountOpen].map(cents);
  // Zero aliases are historical defaults; different positive totals require review.
  if (raw.includes(null) || new Set(raw.slice(0, 3).filter(value => value > 0)).size > 1) return { ...unavailable, classification:'INVALID_AMOUNT' };
  const values = { amountCents:cents(invoiceTotal(invoice)), paidAmountCents:cents(invoice.amountPaid), openAmountCents:cents(invoiceOpen(invoice)) };
  if (Object.values(values).includes(null)) return { ...unavailable, classification:'INVALID_AMOUNT' };
  return { ...values, classification:'RECEIVABLE' };
}

// The caller supplies only cash-receipt records, after excluding internal credit.
function project(invoices, payments) {
  const rows = invoices.map(document), cashAmounts = payments.map(payment => cents(payment.amount));
  const documents = { total:invoices.length, receivableCount:0, excludedCount:0, unknownStatusCount:0, invalidAmountCount:0, amountCents:0, openAmountCents:0 };
  const amounts = [], balances = [];
  for (const row of rows) {
    if (row.classification === 'EXCLUDED') { documents.excludedCount++; continue; }
    if (row.classification === 'UNKNOWN_STATUS') { documents.unknownStatusCount++; continue; }
    documents.receivableCount++;
    if (row.classification === 'INVALID_AMOUNT') { documents.invalidAmountCount++; continue; }
    amounts.push(row.amountCents); balances.push(row.openAmountCents);
  }
  const needsReview = documents.unknownStatusCount > 0 || documents.invalidAmountCount > 0;
  documents.amountCents = needsReview ? null : sum(amounts);
  documents.openAmountCents = needsReview ? null : sum(balances);
  return { rows, summary:{
    basis:{ cash:'PAYMENT_PAID_AT_UTC', documents:'DOCUMENT_MONTH_REFERENCE_CURRENT_VALUES', balance:'CURRENT_DOCUMENT_BALANCE', internalCreditIncluded:false, historicalClosingBalance:false },
    currency:'EUR', cash:{ amountCents:sum(cashAmounts), paymentCount:payments.length, invalidAmountCount:cashAmounts.filter(value => value === null).length }, documents
  } };
}
module.exports = { cents, sum, document, documentSelect, project };
