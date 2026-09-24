'use strict';
const { prisma } = require('../../prismaClient');
const { applyClientCreditToInvoice } = require('../../services/clientCreditService');
const clientRates = require('./ClientRateBusiness');
const seasonalPricing=require('../../services/clientServicePricing');
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
    // A saved plan is the total contract price, including every pool. Serialize
    // with plan changes and read it only after the invoice/receipt locks.
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${clientId} FOR NO KEY UPDATE`;
    if (!invoice && await tx.invoice.findUnique({ where: { clientId_monthRef: { clientId, monthRef } }, select: { id: true } })) return { changed: false, addedCents: 0 };
    const client = await tx.client.findUnique({ where: { id: clientId }, include: { pools: true } });
    if (!canBill(client)) return { changed: false, addedCents: 0 };
    const plan = await clientRates.latest(clientId, tx);
    // As in the other price-plan paths, even an unpaid service-only document
    // must not acquire a new contract price through repeated generation.
    if (plan && invoice) return { changed: false, addedCents: 0 };
    if(plan)await seasonalPricing.verify(tx,plan);
    const pricing = plan ? clientRates.calculate(plan.snapshot, monthRef) : null;
    const seasonal=invoice?{ids:[],lines:[],amountCents:0}:await seasonalPricing.collect(tx,clientId,monthRef);
    const lines = plan
      ? [{ amountCents: cent(pricing.amount), description: `Mensalidade ${monthRef} (plano v${plan.version})`, sourceMonth: monthRef }]
      : client.pools.map(pool => ({ amountCents: cent(pool.monthlyAmount), description: `Mensalidade - ${pool.name || 'Piscina'}` }));
    const billableLines = lines.filter(row => Number.isSafeInteger(row.amountCents) && row.amountCents > 0);
    const monthlyCents = billableLines.reduce((sum, row) => sum + row.amountCents, 0);
    const addedCents=monthlyCents+seasonal.amountCents;if(!Number.isSafeInteger(addedCents))throw Error('Total do contrato inválido.');
    if (!addedCents) return { changed: false, addedCents: 0 };
    if (!invoice) invoice = await tx.invoice.create({ data: { clientId, monthRef, month: monthRef, year: Number(monthRef.slice(0, 4)), status: 'PENDING', requiresInvoice: Boolean(client.requiresInvoice) } });
    for (const { description, sourceMonth, amountCents } of billableLines) await tx.invoiceLine.create({ data: {
      invoiceId: invoice.id, type: 'MONTHLY', description, sourceMonth, quantity: 1,
      unitPrice: amountCents / 100, total: amountCents / 100, lineTotal: amountCents / 100,
    } });
    for(const row of seasonal.lines)await tx.invoiceLine.create({data:{invoiceId:invoice.id,...row}});
    await seasonalPricing.claim(tx,seasonal.ids);
    const allLines = await tx.invoiceLine.findMany({ where: { invoiceId: invoice.id } });
    const totalCents = allLines.reduce((sum, line) => sum + cent(line.total), 0);
    await tx.invoice.update({ where: { id: invoice.id }, data: { total: totalCents / 100, totalAmount: totalCents / 100, amount: totalCents / 100, amountPaid: 0, amountOpen: Math.max(totalCents, 0) / 100, status: totalCents > 0 ? 'PENDING' : 'PAID' } });
    const credit = await applyClientCreditToInvoice(tx, invoice.id, { reference: `Fatura ${monthRef}`, notes: 'Abatimento automático na faturação mensal.' });
    if (plan) await tx.userAuditLog.create({ data: {
      action: 'MONTHLY_RATE_APPLIED', actor: 'monthly-billing', entity: 'Invoice', entityId: String(invoice.id),
      metadata: { clientId, monthRef, planId: plan.id, planVersion: plan.version, pricing },
    } });
    return { changed: true, addedCents: Math.max(addedCents - cent(credit.creditUsed), 0), invoiceId: invoice.id };
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
