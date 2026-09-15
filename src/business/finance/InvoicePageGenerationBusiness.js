'use strict';
const { prisma } = require('../../prismaClient');
const clientRates = require('./ClientRateBusiness');
const { applyClientCreditToInvoice } = require('../../services/clientCreditService');
const { getMonthRef, normalizeInvoice } = require('../../services/invoiceViewService');
const include = { client: true, lines: true, payments: true };
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function monthFromBody(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Dados de geração inválidos.');
  const monthRef = body.monthRef === undefined ? getMonthRef() : body.monthRef;
  if (typeof monthRef !== 'string' || !/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(monthRef)) fail('Mês inválido; use AAAA-MM entre 2000 e 2199.');
  return monthRef;
}
function clientIdentity(raw) {
  const id = Number(raw);
  if (!['string', 'number'].includes(typeof raw) || !/^\d+$/.test(String(raw)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) fail('Cliente inválido.');
  return id;
}
async function processClient(clientId, monthRef, batch) {
  const where = { clientId_monthRef: { clientId, monthRef } };
  const changedWhileWaiting = new Error('Invoice identity changed while waiting for the client');
  // A writer that only locks Client may insert while we wait. Restart without
  // writes so an existing Invoice is always locked before Client, like payments.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const monthlyKey = `monthly-billing:${clientId}:${monthRef}`, receiptKey = `client-receipt:${clientId}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${monthlyKey}))::text`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${receiptKey}))::text`;
        const selected = await tx.invoice.findUnique({ where, select: { id: true } });
        if (selected) await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${selected.id} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${clientId} FOR NO KEY UPDATE`;
        let invoice = await tx.invoice.findUnique({ where });
        if (invoice?.id !== selected?.id) throw changedWhileWaiting;
        const client = await tx.client.findUnique({ where: { id: clientId }, include: { pools: true } });
        if (!client) fail('Cliente não encontrado', 404);
        if (client.active === false || client.billingActive !== true || String(client.status || '').toUpperCase() !== 'ACTIVE') fail('Faturação desligada: ativa primeiro o contrato do cliente após receber o pagamento inicial.', 409);
        const existing = Boolean(invoice);
        let monthly;
        if (!existing) {
          const fallback = Number(client.monthlyFee || 0) || client.pools.reduce((sum, pool) => sum + Number(pool.monthlyAmount || 0), 0);
          const pricing = await clientRates.billing(client, monthRef, fallback, tx), cents = Math.round(Number(pricing.amount) * 100);
          if (!Number.isSafeInteger(cents) || cents < 0) fail('Preço mensal inválido. Reveja a configuração do cliente.');
          monthly = cents / 100;
          invoice = await tx.invoice.create({ data: {
            clientId, monthRef, month: monthRef, year: Number(monthRef.slice(0, 4)),
            total: monthly, totalAmount: monthly, amount: monthly, amountOpen: monthly, amountPaid: 0,
            status: monthly > 0 ? 'PENDING' : 'PAID', requiresInvoice: Boolean(client.requiresInvoice),
            lines: { create: [{ type: 'MONTHLY', description: `Mensalidade ${monthRef}`, quantity: 1, unitPrice: monthly, total: monthly }] },
          } });
        }
        const credit = await applyClientCreditToInvoice(tx, invoice.id, {
          reference: `Fatura ${monthRef}`,
          notes: batch
            ? existing ? 'Abatimento automatico em faturacao mensal existente.' : 'Abatimento automatico em faturacao mensal.'
            : existing ? 'Abatimento automatico ao abrir fatura existente.' : 'Abatimento automatico de credito positivo.',
        });
        const creditUsed = credit.creditUsed || 0;
        if (batch) return { clientId, status: `${existing ? 'EXISTS' : 'CREATED'}${creditUsed > 0 ? '_CREDIT_APPLIED' : ''}`, invoiceId: invoice.id, ...(!existing ? { amount: monthly } : {}), creditUsed };
        const full = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include });
        return { ok: true,
          message: existing
            ? creditUsed > 0 ? 'Fatura ja existia e credito positivo foi abatido.' : 'Fatura já existia'
            : creditUsed > 0 ? 'Fatura gerada com credito positivo abatido.' : 'Fatura gerada',
          invoice: normalizeInvoice(full), creditUsed,
        };
      }, { maxWait: 15000, timeout: 15000 });
    } catch (error) {
      if (error === changedWhileWaiting) continue;
      // The unique client/month key also protects against legacy writers that
      // do not use the shared advisory locks. Re-open their committed document.
      if (error.code === 'P2002' && await prisma.invoice.findUnique({ where, select: { id: true } })) continue;
      throw error;
    }
  }
  fail('A fatura mudou durante a geração. Consulte o documento antes de repetir.', 409);
}
async function generateForClient(raw, body) {
  return processClient(clientIdentity(raw), monthFromBody(body), false);
}
async function generateMonthly(body) {
  const monthRef = monthFromBody(body);
  const clients = await prisma.client.findMany({ where: { active: true, billingActive: true, status: 'ACTIVE' }, select: { id: true }, orderBy: { id: 'asc' } });
  const results = [];
  for (const client of clients) results.push(await processClient(client.id, monthRef, true));
  return { ok: true, message: 'Faturação mensal processada', monthRef, results };
}
module.exports = { generateForClient, generateMonthly };
