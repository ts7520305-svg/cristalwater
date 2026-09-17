'use strict';
const { prisma } = require('../../prismaClient');
const clientRates = require('./ClientRateBusiness');
const { applyClientCreditToInvoice } = require('../../services/clientCreditService');
const { reservedRepairIds } = require('../../services/repairInvoiceSourceService');
const include = { lines: true, payments: true, client: true };
const cent = value => Math.round(Number(value || 0) * 100);
const sourceAmount = row => row.totalPrice ?? row.price ?? row.revenue ?? row.unitPrice ?? 0;
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function sourceCents(value) {
  const amount = cent(value);
  if (!Number.isSafeInteger(amount) || amount < 0) fail('Valor de serviço inválido. Reveja os serviços antes de gerar a fatura.');
  return amount;
}
function identity(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Dados de geração inválidos.');
  const raw = body.clientId, clientId = Number(raw);
  if (!['string', 'number'].includes(typeof raw) || !/^\d+$/.test(String(raw)) || !Number.isSafeInteger(clientId) || clientId <= 0 || clientId > 2147483647) fail('Cliente inválido.');
  const monthRef = body.monthRef === undefined ? new Date().toISOString().slice(0, 7) : body.monthRef;
  if (typeof monthRef !== 'string' || !/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(monthRef)) fail('Mês inválido; use AAAA-MM entre 2000 e 2199.');
  return { clientId, monthRef };
}
function conflict(invoice) {
  return Object.assign(new Error('Já existe fatura para este mês. Consulte o documento; correções exigem uma ação explícita no editor financeiro.'), { status: 409, code: 'INVOICE_ALREADY_EXISTS', invoice });
}
async function refuseExisting(db, where) {
  const invoice = await db.invoice.findUnique({ where, include });
  if (invoice) throw conflict(invoice);
}
function line(type, description, amountCents, data = {}) {
  return { type, description, quantity: 1, unitPrice: amountCents / 100, total: amountCents / 100, lineTotal: amountCents / 100, ...data };
}
async function generate(mode, body = {}) {
  if (!['CORE', 'CORE_LEGACY', 'OPERATIONAL'].includes(mode)) fail('Percurso de faturação inválido.');
  const { clientId, monthRef } = identity(body), where = { clientId_monthRef: { clientId, monthRef } };
  try {
    return await prisma.$transaction(async tx => {
      const monthlyKey = `monthly-billing:${clientId}:${monthRef}`, receiptKey = `client-receipt:${clientId}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${monthlyKey}))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${receiptKey}))::text`;
      await refuseExisting(tx, where);
      // Same lock as monthly billing/credit; plan writers take FOR UPDATE.
      await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${clientId} FOR NO KEY UPDATE`;
      await refuseExisting(tx, where);
      const client = await tx.client.findUnique({ where: { id: clientId }, include: { pools: true } });
      if (!client) fail('Cliente não encontrado.', 404);
      if (client.active === false || client.billingActive !== true || String(client.status).toUpperCase() !== 'ACTIVE') fail('Faturação desligada: ative primeiro o contrato do cliente.', 409);
      const fallback = mode === 'OPERATIONAL'
        ? Number(client.monthlyAmount || client.monthlyFee || 0)
        : Number(client.monthlyFee || client.monthlyAmount || 0) + client.pools.reduce((sum, pool) => sum + Number(pool.monthlyAmount || 0), 0);
      const pricing = await clientRates.billing(client, monthRef, fallback, tx), monthlyCents = cent(pricing.amount);
      if (!Number.isSafeInteger(monthlyCents) || monthlyCents < 0) fail('Preço mensal inválido. Reveja a configuração do cliente.');
      const start = new Date(`${monthRef}-01T00:00:00Z`), end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
      const dates = { OR: [{ plannedDate: { gte: start, lt: end } }, { date: { gte: start, lt: end } }, { endAt: { gte: start, lt: end } }] };
      const [candidateRepairs, visits, candidateExtras] = await Promise.all([
        tx.repair.findMany({ where: { pool: { clientId }, paid: false,
          status: { in: mode === 'OPERATIONAL' ? ['DONE', 'QUOTED', 'APPROVED', 'QUOTE_REQUESTED'] : ['QUOTED', 'APPROVED', 'DONE'] },
          NOT: { status: { in: ['QUOTED', 'QUOTE_REQUESTED'] }, quotes: { some: {} } } }, include: { pool: true }, orderBy: { id: 'asc' } }),
        mode === 'CORE_LEGACY' ? [] : tx.serviceVisit.findMany({ where: { AND: [dates,
          mode === 'CORE' ? { OR: [{ clientId }, { pool: { clientId } }] } : { clientId },
          { billed: false, status: { in: mode === 'CORE' ? ['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUIDO'] : ['DONE'] } },
          ...(mode === 'CORE' ? [{ revenue: { gt: 0 } }] : [])] }, include: { pool: true }, orderBy: { id: 'asc' } }),
        mode !== 'CORE' ? [] : tx.extraVisit.findMany({ where: { AND: [
          { OR: [{ clientId }, { pool: { clientId } }] },
          { OR: [{ scheduledAt: { gte: start, lt: end } }, { date: { gte: start, lt: end } }] },
          { status: { in: ['DONE', 'COMPLETED', 'CONCLUIDA', 'CONCLUIDO'] } },
          { billingMode: 'EXTRA', includedInPackage: false },
          { billed: false },
          { OR: [{ totalPrice: { gt: 0 } }, { price: { gt: 0 } }, { unitPrice: { gt: 0 } }] },
        ] }, include: { pool: true }, orderBy: { id: 'asc' } }),
      ]);
      // The client/receipt lock serializes different months as well. A repair
      // remains reserved by any historical document, even a draft or withdrawal;
      // releasing it requires an explicit correction, never monthly generation.
      const reservedRepairs = await reservedRepairIds(tx, candidateRepairs.map(repair => repair.id));
      const repairs = candidateRepairs.filter(repair => !reservedRepairs.has(repair.id));
      const reservedExtras = new Set((await tx.invoiceLine.findMany({where:{type:'EXTRA_VISIT',referenceId:{in:candidateExtras.map(visit=>visit.id)}},select:{referenceId:true}})).map(line=>line.referenceId));
      const extras = candidateExtras.filter(visit=>!reservedExtras.has(visit.id)).filter(visit => {
        if (!visit.pool || visit.pool.clientId !== clientId || (visit.clientId && visit.clientId !== clientId)) {
          fail('Cliente e piscina da visita extra não correspondem. Reveja a associação antes de faturar.', 409);
        }
        // An explicit zero overrides stale fallback prices and must not claim a
        // source that produces no invoice line (including rounding below 1 cent).
        return sourceCents(visit.totalPrice ?? visit.unitPrice ?? visit.price) > 0;
      });
      const repairCents = repairs.reduce((sum, r) => sum + sourceCents(mode === 'OPERATIONAL' ? r.totalPrice || r.unitPrice : r.totalPrice), 0);
      const serviceCents = mode === 'CORE' ? visits.reduce((sum, v) => sum + sourceCents(sourceAmount(v)), 0) : 0;
      const extraCents = extras.reduce((sum, v) => sum + sourceCents(v.totalPrice ?? v.unitPrice ?? v.price), 0);
      const totalCents = monthlyCents + repairCents + serviceCents + extraCents;
      if (!Number.isSafeInteger(totalCents) || totalCents < 0) fail('Total inválido. Reveja os serviços antes de gerar a fatura.');
      const lines = monthlyCents > 0 ? [line('MONTHLY', `Mensalidade ${monthRef}`, monthlyCents)] : [];
      if (mode === 'CORE') for (const v of visits) if (cent(sourceAmount(v)) > 0) lines.push(line('SERVICE', `Servico: ${v.pool?.name || `Visita ${v.id}`}`, cent(sourceAmount(v)), {
        referenceId: v.id, serviceDate: v.endAt || v.plannedDate || v.date || null, sourceMonth: monthRef, notes: v.notes || null,
      }));
      for (const v of extras) if (cent(v.totalPrice ?? v.unitPrice ?? v.price) > 0) lines.push(line('EXTRA_VISIT', `Extra: ${v.pool?.name || `Visita extra ${v.id}`}`, cent(v.totalPrice ?? v.unitPrice ?? v.price), {
        referenceId: v.id, serviceDate: v.scheduledAt || v.date || null, sourceMonth: monthRef, notes: v.notes || null,
      }));
      for (const r of repairs) {
        const amount = cent(mode === 'OPERATIONAL' ? r.totalPrice || r.unitPrice : r.totalPrice);
        if (amount > 0) lines.push(line('REPAIR', mode === 'OPERATIONAL' ? r.problem : `Reparacao: ${r.problem}`, amount, {
          referenceId: r.id, quantity: mode === 'OPERATIONAL' ? r.quantity || 1 : 1, ...(mode === 'CORE' ? { sourceMonth: monthRef } : {}),
        }));
      }
      // Create, never upsert: a writer without the shared lock can still win the
      // unique client/month key, but it cannot have its invoice overwritten here.
      const invoice = await tx.invoice.create({ data: {
        clientId, monthRef, ...(mode === 'OPERATIONAL' ? { notes: 'Gerada pelo fluxo operacional.' } : { month: monthRef }),
        amount: totalCents / 100, total: totalCents / 100, totalAmount: totalCents / 100, amountPaid: 0, amountOpen: totalCents / 100,
        status: mode === 'OPERATIONAL' || totalCents > 0 ? 'PENDING' : 'PAID', requiresInvoice: Boolean(client.requiresInvoice),
        lines: { create: lines },
      } });
      const credit = await applyClientCreditToInvoice(tx, invoice.id, { reference: `Fatura ${monthRef}`, notes: 'Abatimento automático na geração de fatura.' });
      if (visits.length) {
        const claimed = await tx.serviceVisit.updateMany({ where: { id: { in: visits.map(v => v.id) }, billed: false }, data: { billed: true, billedAt: new Date() } });
        if (claimed.count !== visits.length) fail('Os serviços mudaram durante a geração. Consulte os dados antes de repetir.', 409);
      }
      if (extras.length) {
        const claimed = await tx.extraVisit.updateMany({ where: { id: { in: extras.map(v => v.id) }, billed: false }, data: { billed: true, billedAt: new Date(), billingStatus: 'IN_INVOICE' } });
        if (claimed.count !== extras.length) fail('As visitas extra mudaram durante a geração. Consulte os dados antes de repetir.', 409);
      }
      const full = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include });
      const result = { ok: true, invoice: full, creditUsed: credit.creditUsed || 0 };
      if (mode === 'CORE') return { ...result, lines: { monthly: monthlyCents / 100, services: serviceCents / 100, extras: extraCents / 100, repairs: repairCents / 100 }, next: 'PAYMENT' };
      if (mode === 'CORE_LEGACY') return { ...result, next: 'PAYMENT' };
      return { ...result, lines: { monthly: monthlyCents / 100, repairs: repairCents / 100 }, nextStep: 'PAYMENT' };
    }, { maxWait: 15000, timeout: 15000 });
  } catch (error) {
    if (error.code === 'P2002') await refuseExisting(prisma, where);
    throw error;
  }
}
module.exports = { generate };
