'use strict';
const { invoiceOpen } = require('./clientCreditService');
function getMonthRef(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function normalizeInvoice(inv) {
  const monthRef = inv.monthRef || inv.month || getMonthRef(inv.createdAt || new Date());
  const [yearPart, monthPart] = String(monthRef).includes('-')
    ? String(monthRef).split('-')
    : [String(inv.year || new Date().getFullYear()), String(inv.month || '')];
  const total = Number(inv.total || inv.totalAmount || inv.amount || 0);
  return {
    ...inv,
    clientName: inv.client?.name || null,
    year: inv.year || Number(yearPart),
    month: inv.month || monthPart,
    monthRef,
    amount: total,
    totalAmount: Number(inv.totalAmount || total),
    amountOpen: invoiceOpen(inv),
  };
}
module.exports = { getMonthRef, normalizeInvoice };
