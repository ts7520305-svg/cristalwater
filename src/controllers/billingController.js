const { prisma } = require("../prismaClient");

// ==========================================================
// HELPERS
// ==========================================================

function canBillClient(client) {
  return Boolean(client && client.active !== false && client.billingActive === true && String(client.status || '').toUpperCase() === 'ACTIVE');
}

function getMonthRef(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}

// ==========================================================
// RECALCULAR FATURA (CRÍTICO)
// ==========================================================

async function recalculateInvoice(invoiceId) {

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: true,
      payments: true
    }
  });

  if (!invoice) return;

  const total = invoice.lines.reduce((sum, l) => sum + Number(l.total || 0), 0);

  const amountPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const amountOpen = Math.max(total - amountPaid, 0);

  let status = "PENDING";

  if (amountPaid > 0 && amountOpen > 0) status = "PARTIAL";
  if (amountOpen === 0 && total > 0) status = "PAID";

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      total,
      amountPaid,
      amountOpen,
      status
    }
  });
}

// ==========================================================
// OBTER OU CRIAR FATURA
// ==========================================================

async function getOrCreateInvoice(clientId, monthRef = getMonthRef()) {

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!canBillClient(client)) {
    const err = new Error('Faturação desligada: ativa primeiro o contrato do cliente após receber o pagamento inicial.');
    err.code = 'BILLING_DISABLED';
    throw err;
  }

  let invoice = await prisma.invoice.findFirst({
    where: { clientId, monthRef }
  });

  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        clientId,
        monthRef,
        total: 0,
        amountPaid: 0,
        amountOpen: 0,
        status: "PENDING",
        requiresInvoice: Boolean(client.requiresInvoice)
      }
    });
  }

  return invoice;
}

// ==========================================================
// MENSALIDADE + CRÉDITO (CORRIGIDO)
// ==========================================================

async function ensureMonthlyLines(invoice, clientId) {

  const exists = await prisma.invoiceLine.findFirst({
    where: {
      invoiceId: invoice.id,
      type: "MONTHLY"
    }
  });

  if (exists) return 0;

  const client = await prisma.client.findUnique({
    where: { id: clientId }
  });

  if (!canBillClient(client)) return 0;

  const pools = await prisma.pool.findMany({
    where: { clientId }
  });

  let monthlyTotal = 0;

  // =============================
  // CRIAR LINHAS DE MENSALIDADE
  // =============================

  for (const p of pools) {

    const price = Number(p.monthlyAmount || 0);

    if (price <= 0) continue;

    await prisma.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        type: "MONTHLY",
        description: `Mensalidade - ${p.name || "Piscina"}`,
        quantity: 1,
        unitPrice: price,
        total: price
      }
    });

    monthlyTotal += price;
  }

  // =============================
  // APLICAR CRÉDITO
  // =============================

  let creditUsed = 0;

  if (client.creditBalance > 0 && monthlyTotal > 0) {

    creditUsed = Math.min(client.creditBalance, monthlyTotal);

    await prisma.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        type: "CREDIT",
        description: "Crédito cliente",
        quantity: 1,
        unitPrice: -creditUsed,
        total: -creditUsed
      }
    });

    await prisma.client.update({
      where: { id: clientId },
      data: {
        creditBalance: {
          decrement: creditUsed
        }
      }
    });
  }

  // =============================
  // RECALCULAR FATURA
  // =============================

  await recalculateInvoice(invoice.id);

  return monthlyTotal - creditUsed;
}

// ==========================================================
// GERAR MENSALIDADES
// ==========================================================

async function generateMonthly(req, res) {

  try {

    const monthRef = req.body.monthRef || getMonthRef();

    const clients = await prisma.client.findMany({ where: { active: true, billingActive: true, status: "ACTIVE" } });

    let totalAdded = 0;
    let processed = 0;
    let skipped = 0;

    for (const c of clients) {

      const invoice = await getOrCreateInvoice(c.id, monthRef);

      const added = await ensureMonthlyLines(invoice, c.id);

      if (added > 0) {
        totalAdded += added;
        processed++;
      } else {
        skipped++;
      }
    }

    res.json({
      ok: true,
      totalAdded,
      processed,
      skipped
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}

// ==========================================================
// ADICIONAR CRÉDITO
// ==========================================================

async function addCredit(req, res) {

  try {

    const clientId = Number(req.params.id);
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false });
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        creditBalance: {
          increment: amount
        }
      }
    });

    res.json({ ok: true, client });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}

module.exports = {
  generateMonthly,
  addCredit
};