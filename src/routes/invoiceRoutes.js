const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const { sendInvoiceFull } = require("../controllers/invoiceController");
const { applyClientCreditToInvoice } = require("../services/clientCreditService");
const auth = require("../middlewares/authMiddleware");
const { assertExternalOperationAllowed } = require("../config/externalIntegrations");

router.use(auth("ADMIN"));

function getMonthRef(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function canBillClient(client) {
  return Boolean(client && client.active !== false && client.billingActive === true && String(client.status || '').toUpperCase() === 'ACTIVE');
}

function blockedBillingResponse(res) {
  return res.status(409).json({ ok: false, error: 'Faturação desligada: ativa primeiro o contrato do cliente após receber o pagamento inicial.' });
}

function normalizeInvoice(inv) {
  const monthRef = inv.monthRef || inv.month || getMonthRef(inv.createdAt || new Date());
  const [yearPart, monthPart] = String(monthRef).includes("-")
    ? String(monthRef).split("-")
    : [String(inv.year || new Date().getFullYear()), String(inv.month || "")];
  const total = Number(inv.total || inv.totalAmount || inv.amount || 0);
  return {
    ...inv,
    clientName: inv.client?.name || null,
    year: inv.year || Number(yearPart),
    month: inv.month || monthPart,
    monthRef,
    amount: total,
    totalAmount: Number(inv.totalAmount || total),
    amountOpen: Number(inv.amountOpen || Math.max(total - Number(inv.amountPaid || 0), 0)),
  };
}

function invoiceAmount(inv) {
  return Number(inv.totalAmount || inv.total || inv.amount || 0);
}

function isInvoiceIssued(inv) {
  return Boolean(inv.invoiceIssued || inv.externalInvoiceNo);
}

function fiscalDataComplete(client = {}) {
  return Boolean(client.fiscalName && client.fiscalNif && client.fiscalAddress && client.fiscalEmail);
}

function normalizeOfficialClient(client) {
  const invoices = (client.invoices || []).map(normalizeInvoice);
  const billableInvoices = invoices.filter((invoice) => invoiceAmount(invoice) > 0);
  const pendingInvoices = billableInvoices.filter((invoice) => !isInvoiceIssued(invoice));
  const issuedInvoices = billableInvoices.filter(isInvoiceIssued);
  const pendingTotal = pendingInvoices.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0);
  const issuedTotal = issuedInvoices.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0);

  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    zone: client.zone,
    active: client.active,
    status: client.status,
    paymentReference: `CW-${String(Number(client.id || 0)).padStart(6, "0")}`,
    requiresInvoice: Boolean(client.requiresInvoice),
    fiscalName: client.fiscalName,
    fiscalNif: client.fiscalNif,
    fiscalAddress: client.fiscalAddress,
    fiscalEmail: client.fiscalEmail,
    externalBillingNotes: client.externalBillingNotes,
    fiscalDataComplete: fiscalDataComplete(client),
    poolsCount: (client.pools || []).length,
    invoices,
    pendingInvoices,
    issuedInvoices,
    pendingTotal,
    issuedTotal,
    lastIssuedAt: issuedInvoices[0]?.updatedAt || issuedInvoices[0]?.issueDate || null,
  };
}

router.get("/", async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { client: true, lines: true, payments: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(invoices.map(normalizeInvoice));
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/client/:clientId", async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const invoices = await prisma.invoice.findMany({
      where: { clientId },
      include: { client: true, lines: true, payments: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(invoices.map(normalizeInvoice));
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/to-issue", async (req, res) => {
  try {
    const status = String(req.query.status || "pending").toLowerCase();
    const query = String(req.query.q || "").trim().toLowerCase();
    const clients = await prisma.client.findMany({
      where: { requiresInvoice: true },
      include: {
        pools: { select: { id: true } },
        invoices: {
          include: { client: true, lines: true, payments: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
      },
      orderBy: { name: "asc" },
    });

    let officialClients = clients.map(normalizeOfficialClient);
    if (status === "pending") officialClients = officialClients.filter((client) => client.pendingInvoices.length > 0);
    if (status === "issued") officialClients = officialClients.filter((client) => client.issuedInvoices.length > 0);
    if (status === "missing-data") officialClients = officialClients.filter((client) => !client.fiscalDataComplete);

    if (query) {
      officialClients = officialClients.filter((client) => [
        client.name,
        client.email,
        client.phone,
        client.zone,
        client.fiscalName,
        client.fiscalNif,
        client.fiscalAddress,
        client.fiscalEmail,
        client.paymentReference,
      ].filter(Boolean).join(" ").toLowerCase().includes(query));
    }

    const allOfficialClients = clients.map(normalizeOfficialClient);
    const allInvoices = allOfficialClients.flatMap((client) => client.invoices.filter((invoice) => invoiceAmount(invoice) > 0));
    const pendingInvoices = allOfficialClients.flatMap((client) => client.pendingInvoices);
    const issuedInvoices = allOfficialClients.flatMap((client) => client.issuedInvoices);

    return res.json({
      ok: true,
      summary: {
        clients: allOfficialClients.length,
        missingFiscalData: allOfficialClients.filter((client) => !client.fiscalDataComplete).length,
        pendingInvoices: pendingInvoices.length,
        issuedInvoices: issuedInvoices.length,
        totalInvoices: allInvoices.length,
        pendingTotal: pendingInvoices.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0),
        issuedTotal: issuedInvoices.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0),
      },
      clients: officialClients,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("to-issue error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Erro ao listar faturacao oficial" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: true, lines: true, payments: true },
    });
    if (!invoice) return res.status(404).json({ ok: false, error: "Fatura não encontrada" });
    res.json(normalizeInvoice(invoice));
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/generate-for-client/:clientId", async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const monthRef = req.body?.monthRef || getMonthRef();
    const client = await prisma.client.findUnique({ where: { id: clientId }, include: { pools: true } });
    if (!client) return res.status(404).json({ ok: false, error: "Cliente não encontrado" });
    if (!canBillClient(client)) return blockedBillingResponse(res);

    const existing = await prisma.invoice.findFirst({ where: { clientId, monthRef } });
    if (existing) {
      const credit = await applyClientCreditToInvoice(prisma, existing, {
        reference: `Fatura ${monthRef}`,
        notes: "Abatimento automatico ao abrir fatura existente.",
      });
      const invoice = await prisma.invoice.findUnique({
        where: { id: existing.id },
        include: { client: true, lines: true, payments: true },
      });
      return res.json({
        ok: true,
        message: credit.creditUsed > 0 ? "Fatura ja existia e credito positivo foi abatido." : "Fatura já existia",
        invoice: normalizeInvoice(invoice || existing),
        creditUsed: credit.creditUsed || 0,
      });
    }

    const monthly = Number(client.monthlyFee || 0) || client.pools.reduce((sum, p) => sum + Number(p.monthlyAmount || 0), 0);
    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        monthRef,
        month: monthRef,
        year: Number(String(monthRef).slice(0, 4)),
        total: monthly,
        totalAmount: monthly,
        amount: monthly,
        amountOpen: monthly,
        amountPaid: 0,
        status: monthly > 0 ? "PENDING" : "PAID",
        requiresInvoice: Boolean(client.requiresInvoice),
        lines: {
          create: [{
            type: "MONTHLY",
            description: `Mensalidade ${monthRef}`,
            quantity: 1,
            unitPrice: monthly,
            total: monthly,
          }],
        },
      },
      include: { client: true, lines: true, payments: true },
    });

    const credit = await applyClientCreditToInvoice(prisma, invoice, {
      reference: `Fatura ${monthRef}`,
      notes: "Abatimento automatico de credito positivo.",
    });
    const finalInvoice = credit.invoice
      ? await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { client: true, lines: true, payments: true } })
      : invoice;

    res.json({
      ok: true,
      message: credit.creditUsed > 0 ? "Fatura gerada com credito positivo abatido." : "Fatura gerada",
      invoice: normalizeInvoice(finalInvoice || invoice),
      creditUsed: credit.creditUsed || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/generate-monthly", async (req, res) => {
  try {
    const monthRef = req.body?.monthRef || getMonthRef();
    const clients = await prisma.client.findMany({ where: { active: true, billingActive: true, status: "ACTIVE" }, include: { pools: true } });
    const results = [];
    for (const client of clients) {
      const existing = await prisma.invoice.findFirst({ where: { clientId: client.id, monthRef } });
      if (existing) {
        const credit = await applyClientCreditToInvoice(prisma, existing, {
          reference: `Fatura ${monthRef}`,
          notes: "Abatimento automatico em faturacao mensal existente.",
        });
        results.push({ clientId: client.id, status: credit.creditUsed > 0 ? "EXISTS_CREDIT_APPLIED" : "EXISTS", invoiceId: existing.id, creditUsed: credit.creditUsed || 0 });
        continue;
      }
      const monthly = Number(client.monthlyFee || 0) || client.pools.reduce((sum, p) => sum + Number(p.monthlyAmount || 0), 0);
      const invoice = await prisma.invoice.create({
        data: {
          clientId: client.id,
          monthRef,
          month: monthRef,
          year: Number(String(monthRef).slice(0, 4)),
          total: monthly,
          totalAmount: monthly,
          amount: monthly,
          amountOpen: monthly,
          amountPaid: 0,
          status: monthly > 0 ? "PENDING" : "PAID",
          requiresInvoice: Boolean(client.requiresInvoice),
          lines: { create: [{ type: "MONTHLY", description: `Mensalidade ${monthRef}`, quantity: 1, unitPrice: monthly, total: monthly }] },
        },
      });
      const credit = await applyClientCreditToInvoice(prisma, invoice, {
        reference: `Fatura ${monthRef}`,
        notes: "Abatimento automatico em faturacao mensal.",
      });
      results.push({ clientId: client.id, status: credit.creditUsed > 0 ? "CREATED_CREDIT_APPLIED" : "CREATED", invoiceId: invoice.id, amount: monthly, creditUsed: credit.creditUsed || 0 });
    }
    res.json({ ok: true, message: "Faturação mensal processada", monthRef, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/:id/mark-issued", async (req, res) => {
  try {
    try {
      assertExternalOperationAllowed("fiscal_issuing");
    } catch (gateErr) {
      return res.status(gateErr.statusCode || 503).json({ ok: false, error: gateErr.code || "disabled_in_qa" });
    }

    const id = Number(req.params.id);
    const externalInvoiceNo = String(req.body?.externalInvoiceNo || req.body?.invoiceNumber || req.body?.externalNumber || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "Fatura invalida" });
    if (!externalInvoiceNo) return res.status(400).json({ ok: false, error: "Numero da fatura externa obrigatorio" });

    const duplicate = await prisma.invoice.findFirst({
      where: {
        externalInvoiceNo,
        NOT: { id },
      },
      select: { id: true, clientId: true },
    });
    if (duplicate) {
      return res.status(409).json({
        ok: false,
        error: `Este numero externo ja esta associado a fatura interna #${duplicate.id}.`,
      });
    }

    const current = await prisma.invoice.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!current) return res.status(404).json({ ok: false, error: "Fatura nao encontrada" });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        invoiceIssued: true,
        externalInvoiceNo,
        issueDate: current.issueDate || new Date(),
        notes: [current.notes, `Fatura oficial externa: ${externalInvoiceNo}`].filter(Boolean).join("\n"),
      },
      include: { client: true, lines: true, payments: true },
    });

    await prisma.communicationLog.create({
      data: {
        clientId: updated.clientId,
        channel: "EXTERNAL_INVOICE",
        message: `Fatura interna #${updated.id} marcada como emitida externamente: ${externalInvoiceNo}`,
        referenceId: updated.id,
      },
    }).catch(() => null);

    return res.json({ ok: true, invoice: normalizeInvoice(updated) });
  } catch (err) {
    console.error("mark-issued error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Erro ao marcar fatura emitida" });
  }
});

router.post("/send-full/:invoiceId", sendInvoiceFull);

module.exports = router;
