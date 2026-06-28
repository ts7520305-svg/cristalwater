try { require('dotenv').config(); } catch (_) {}
const { prisma } = require('../src/prismaClient');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function stamp() { return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14); }

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const s = stamp();
  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: { name: `QA Cliente ${s}`, phone: '910000000', zone: 'QA', monthlyFee: 80, monthlyAmount: 80, active: true, status: 'ACTIVE' } });
    assert(client.id, 'Cliente não criado');
    const pool = await tx.pool.create({ data: { clientId: client.id, name: `QA Piscina ${s}`, type: 'POOL', zone: 'QA', volumeM3: 60, monthlyAmount: 80, active: true, scheduleMode: 'PENDING_ROUND' } });
    const jacuzzi = await tx.pool.create({ data: { clientId: client.id, name: `QA Jacuzzi ${s}`, type: 'JACUZZI', zone: 'QA', volumeM3: 5, monthlyAmount: 20, active: true, scheduleMode: 'PENDING_ROUND' } });
    assert(pool.clientId === client.id && jacuzzi.clientId === client.id, 'Piscinas não associadas ao cliente');
    const technician = await tx.technician.create({ data: { name: `QA Técnico ${s}`, pin: '1234', active: true } });
    const round = await tx.round.create({ data: { name: `QA Ronda ${s}`, dayOfWeek: 1, active: true } });
    await tx.roundTechnician.create({ data: { roundId: round.id, technicianId: technician.id } });
    await tx.roundPool.create({ data: { roundId: round.id, poolId: pool.id, order: 1 } });
    await tx.roundPool.create({ data: { roundId: round.id, poolId: jacuzzi.id, order: 2 } });
    const assigned = await tx.roundPool.count({ where: { roundId: round.id } });
    assert(assigned === 2, 'Piscinas não atribuídas à ronda');
    const visit = await tx.serviceVisit.create({ data: { clientId: client.id, poolId: pool.id, roundId: round.id, technicianId: technician.id, plannedDate: new Date(), status: 'PLANNED' } });
    const done = await tx.serviceVisit.update({ where: { id: visit.id }, data: { status: 'DONE', cleaned: true, ph: 7.2, chlorine: 1.5, notes: 'QA: visita concluída com alerta de bomba', endAt: new Date() } });
    assert(done.status === 'DONE', 'Visita não concluída');
    const repair = await tx.repair.create({ data: { poolId: pool.id, problem: 'QA Bomba com ruído', status: 'QUOTED', totalPrice: 150, priority: 'NORMAL' } });
    assert(repair.status === 'QUOTED', 'Reparação/orçamento não criado');
    const invoice = await tx.invoice.create({ data: { clientId: client.id, monthRef: `QA-${s}`, month: `QA-${s}`, amount: 250, total: 250, totalAmount: 250, amountOpen: 250, status: 'PENDING' } });
    await tx.invoiceLine.create({ data: { invoiceId: invoice.id, description: 'QA Mensalidade', type: 'MONTHLY', quantity: 1, unitPrice: 100, total: 100, lineTotal: 100 } });
    await tx.invoiceLine.create({ data: { invoiceId: invoice.id, description: 'QA Orçamento bomba', type: 'REPAIR', referenceId: repair.id, quantity: 1, unitPrice: 150, total: 150, lineTotal: 150 } });
    const payment = await tx.payment.create({ data: { invoiceId: invoice.id, amount: 250, method: 'QA' } });
    const paid = await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', amountPaid: 250, amountOpen: 0, paidAt: new Date() } });
    assert(paid.status === 'PAID' && payment.amount === 250, 'Pagamento não registado');
    return { clientId: client.id, poolId: pool.id, jacuzziId: jacuzzi.id, technicianId: technician.id, roundId: round.id, visitId: done.id, repairId: repair.id, invoiceId: paid.id, paymentId: payment.id };
  });
  console.log('✅ CORE FLOW OK');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => { console.error('❌ CORE FLOW FAIL'); console.error(err); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
