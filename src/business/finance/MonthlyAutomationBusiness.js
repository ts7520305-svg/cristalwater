const { prisma } = require('../../prismaClient');
const { getBooleanSetting } = require('../../services/systemSettingService');
const activeClient = { active: true, status: 'ACTIVE', billingActive: true, archiveStatus: 'ATIVO', deletedAt: null };
const DAY = 86400000;
const clientRates = require('./ClientRateBusiness');
const legacyAmount = client => Math.round((Number(client.monthlyFee || client.monthlyAmount || 0) + (client.pools || []).reduce((n,p) => n + Number(p.monthlyAmount || 0),0))*100)/100;
function scope(clientIds) { return Array.isArray(clientIds) ? { id: { in: clientIds.map(Number).filter(Number.isSafeInteger) } } : {}; }
async function monthly({ now = new Date(), preview = false, clientIds } = {}) {
  if (!Number.isFinite(now.getTime())) throw Error('Data inválida');
  const enabled = await getBooleanSetting('AUTO_MONTHLY_BILLING_ENABLED', false);
  if (!enabled && !preview) return { ok: true, skipped: 'DISABLED', created: 0 };
  const monthRef = now.toISOString().slice(0, 7);
  const clients = await prisma.client.findMany({ where: { ...activeClient, ...scope(clientIds) }, include: { pools: true }, orderBy: { id: 'asc' } });
  const candidates = [];
  for (const client of clients) {
    const plan = await clientRates.latest(client.id);
    const amount = plan ? clientRates.calculate(plan.snapshot,monthRef).amount : legacyAmount(client);
    if (Number.isFinite(amount) && amount > 0) candidates.push({clientId:client.id,name:client.name,amount,planVersion:plan?.version || null});
  }
  if (preview) return { ok: true, preview: true, enabled, monthRef, candidates };
  // A transaction-scoped lock coordinates scheduler instances. Existing Finance
  // OS remains responsible for creating and calculating reviewable drafts.
  return prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(93615001::bigint) AS acquired`;
    if (!lock.acquired) return { ok: true, skipped: 'BUSY', created: 0 };
    let created = 0; const errors = [];
    for (const row of candidates) {
      await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${row.clientId} FOR UPDATE`;
      const current = await tx.client.findFirst({ where: { id: row.clientId, ...activeClient }, include: {pools:true} });
      if (!current || await tx.invoice.findUnique({where:{clientId_monthRef:{clientId:current.id,monthRef}}})) continue;
      const pricing = await clientRates.billing(current,monthRef,legacyAmount(current),tx);
      if (pricing.amount <= 0) continue;
      row.amount = pricing.amount;
        const result = await require('./FinanceOsBusiness').createDraftInvoice({ clientId: row.clientId, monthRef, requireActiveContract: true, dueDate: new Date(now.getTime() + 15 * DAY).toISOString(), notes: 'Mensalidade preparada automaticamente; rever antes de emitir. Não inclui serviços extra.', lines: [{ type: 'MONTHLY', description: `Mensalidade ${monthRef}`, quantity: 1, unitPrice: row.amount, total: row.amount }] }, 'monthly-scheduler', tx);
        if (result.ok) { created++; await tx.userAuditLog.create({ data: { actor: 'monthly-scheduler', action: 'AUTO_MONTHLY_DRAFT', entity: 'Invoice', entityId: String(result.invoice.id), metadata: { monthRef, clientId: row.clientId, amount: row.amount, ...(pricing.planId?{planId:pricing.planId,planVersion:pricing.planVersion,segments:pricing.segments}:{}) } } }); }
        else if (result.status !== 409) errors.push({ clientId: row.clientId, error: result.error });
    }
    return { ok: errors.length === 0, monthRef, created, errors };
  }, { timeout: 120000 });
}
async function reminders({ now = new Date(), clientIds } = {}) {
  if (!Number.isFinite(now.getTime())) throw Error('Data inválida');
  if (!await getBooleanSetting('PAYMENT_REMINDERS_ENABLED', false)) return { ok: true, skipped: 'DISABLED', created: 0 };
  const invoices = await prisma.invoice.findMany({ where: { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE', 'ISSUED', 'SENT'] }, amountOpen: { gt: 0 }, dueDate: { lte: new Date(now.getTime() - 7 * DAY) }, client: { ...activeClient, ...scope(clientIds) } }, select: { id: true } });
  let created = 0;
  for (const { id } of invoices) {
    created += await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${id} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id }, include: { client: true } });
      if (!invoice || invoice.amountOpen <= 0 || !['PENDING','PARTIAL','OVERDUE','ISSUED','SENT'].includes(invoice.status) || !invoice.client.active || invoice.client.status !== 'ACTIVE' || !invoice.client.billingActive || invoice.client.deletedAt || invoice.client.archiveStatus !== 'ATIVO') return 0;
      const age = now.getTime() - new Date(invoice.dueDate).getTime();
      if (!invoice.dueDate || age < 7 * DAY) return 0;
      const sourceKey = `payment-reminder:${id}:${Math.floor(age / (7 * DAY))}`;
      if (await tx.operationalReminder.findUnique({ where: { sourceKey } })) return 0;
      await tx.operationalReminder.create({ data: { sourceKey, clientId: invoice.clientId, title: 'Aviso de pagamento registado', dueDate: now, isCompleted: true, metadata: { invoiceId: id, amountOpen: invoice.amountOpen, channel: 'PORTAL' } } });
      await tx.notification.create({ data: { clientId: invoice.clientId, role: 'CLIENT', type: 'PAYMENT_REMINDER', eventType: 'FINANCE_PAYMENT_REMINDER', title: 'Pagamento em atraso', message: `Em ${now.toISOString().slice(0,10)}, a fatura #${id} tinha ${Number(invoice.amountOpen).toFixed(2)} EUR por liquidar. Se já pagou, envie o comprovativo à administração.`, status: 'PENDING', metadata: { invoiceId: id, sourceKey, channel: 'PORTAL' } } });
      return 1;
    });
  }
  return { ok: true, created, channel: 'PORTAL' };
}
module.exports = { monthly, reminders };
