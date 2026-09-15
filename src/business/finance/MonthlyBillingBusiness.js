'use strict';
const { prisma } = require('../../prismaClient');
const { applyClientCreditToInvoice } = require('../../services/clientCreditService');
const cent = amount => Math.round(Number(amount || 0) * 100);
function canBill(client) { return client && client.active !== false && client.billingActive === true && client.status === 'ACTIVE'; }
function validateMonth(monthRef) {
  if (typeof monthRef !== 'string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(monthRef)) throw Object.assign(new Error('Mês inválido; use AAAA-MM.'), { status: 400 });
}
async function generateForClient(clientId, monthRef) {
  validateMonth(monthRef);
  return prisma.$transaction(async tx => {
    const key = `monthly-billing:${clientId}:${monthRef}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
    // Share the receipt allocation lock before inserting/locking invoices, so
    // a concurrent receipt sees either the complete monthly invoice or its absence.
    const receiptKey = `client-receipt:${clientId}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${receiptKey}))::text`;
    let invoice = await tx.invoice.findUnique({ where: { clientId_monthRef: { clientId, monthRef } } });
    if (invoice) {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoice.id} FOR UPDATE`;
      invoice = await tx.invoice.findUnique({ where: { id: invoice.id }, include: { lines: true, payments: true } });
      // Repeated generation must preserve historical payments, issued documents
      // and withdrawn/draft documents, even if they lack a MONTHLY line.
      if (!invoice || invoice.lines.some(line => ['MONTHLY', 'CREDIT'].includes(line.type)) || invoice.status !== 'PENDING' || invoice.externalInvoiceNo || invoice.amountPaid > 0 || invoice.payments.length > 0) return { changed: false, addedCents: 0 };
    }
    const client = await tx.client.findUnique({ where: { id: clientId }, include: { pools: true } });
    if (!canBill(client)) return { changed: false, addedCents: 0 };
    // Preserve this endpoint's configured pool prices. Client price plans are
    // already handled by the current invoice-generation routes.
    const lines = client.pools.map(pool => ({ pool, amountCents: cent(pool.monthlyAmount) })).filter(row => Number.isSafeInteger(row.amountCents) && row.amountCents > 0);
    const monthlyCents = lines.reduce((sum, row) => sum + row.amountCents, 0);
    if (!monthlyCents) return { changed: false, addedCents: 0 };
    if (!invoice) invoice = await tx.invoice.create({ data: { clientId, monthRef, month: monthRef, year: Number(monthRef.slice(0, 4)), status: 'PENDING', requiresInvoice: Boolean(client.requiresInvoice) } });
    for (const { pool, amountCents } of lines) await tx.invoiceLine.create({ data: {
      invoiceId: invoice.id, type: 'MONTHLY', description: `Mensalidade - ${pool.name || 'Piscina'}`, quantity: 1,
      unitPrice: amountCents / 100, total: amountCents / 100, lineTotal: amountCents / 100,
    } });
    const allLines = await tx.invoiceLine.findMany({ where: { invoiceId: invoice.id } });
    const totalCents = allLines.reduce((sum, line) => sum + cent(line.total), 0);
    await tx.invoice.update({ where: { id: invoice.id }, data: { total: totalCents / 100, totalAmount: totalCents / 100, amount: totalCents / 100, amountPaid: 0, amountOpen: Math.max(totalCents, 0) / 100, status: totalCents > 0 ? 'PENDING' : 'PAID' } });
    const credit = await applyClientCreditToInvoice(tx, invoice.id, { reference: `Fatura ${monthRef}`, notes: 'Abatimento automático na faturação mensal.' });
    return { changed: true, addedCents: Math.max(monthlyCents - cent(credit.creditUsed), 0), invoiceId: invoice.id };
  }, { maxWait: 15000, timeout: 15000 });
}
async function generateMonthly(monthRef = new Date().toISOString().slice(0, 7)) {
  validateMonth(monthRef);
  const clients = await prisma.client.findMany({ where: { active: true, billingActive: true, status: 'ACTIVE' }, select: { id: true }, orderBy: { id: 'asc' } });
  let totalCents = 0, processed = 0, skipped = 0;
  for (const client of clients) {
    const result = await generateForClient(client.id, monthRef);
    totalCents += result.addedCents;
    if (result.changed) processed++; else skipped++;
  }
  return { ok: true, totalAdded: totalCents / 100, processed, skipped };
}
module.exports = { generateMonthly, generateForClient };
