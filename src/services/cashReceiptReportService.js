'use strict';
const { prisma } = require('../prismaClient');
const { INTERNAL_PAYMENT_METHODS } = require('./invoicePaymentRequestService');
const internalMethods = new Set(INTERNAL_PAYMENT_METHODS);
const isCashPayment = row => !internalMethods.has(String(row.method || '').trim().toUpperCase());
const total = rows => rows.reduce((sum, row) => sum + Math.round(Number(row.amount || 0) * 100), 0) / 100;
async function payments(monthRef, db = prisma) {
  const where = {};
  if (monthRef !== undefined) {
    if (typeof monthRef !== 'string' || !/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(monthRef)) throw Object.assign(new Error('Mês inválido; use AAAA-MM.'), { status: 400 });
    const start = new Date(`${monthRef}-01T00:00:00Z`), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
    where.paidAt = { gte: start, lt: end };
  }
  // These are aggregate reports. A display-page limit must not truncate money.
  const rows = await db.payment.findMany({ where, select: { amount: true, paidAt: true, method: true } });
  return rows.filter(isCashPayment);
}
function monthly(rows) {
  const months = new Map();
  for (const row of rows) {
    const month = row.paidAt.toISOString().slice(0, 7);
    months.set(month, (months.get(month) || 0) + Math.round(Number(row.amount || 0) * 100));
  }
  return [...months].sort(([a], [b]) => a.localeCompare(b)).map(([monthRef, amount]) => ({ monthRef, amount: amount / 100 }));
}
module.exports = { payments, total, monthly, isCashPayment };
