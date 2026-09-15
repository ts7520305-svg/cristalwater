const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const { sendInvoiceFull } = require("../controllers/invoiceController");
const generation = require("../controllers/invoicePageGenerationController");
const { normalizeInvoice } = require("../services/invoiceViewService");
const auth = require("../middlewares/authMiddleware");
const { assertExternalOperationAllowed } = require("../config/externalIntegrations");

router.use(auth("ADMIN"));

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
    res.status(err.status || 500).json({ ok: false, error: err.message });
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
    res.status(err.status || 500).json({ ok: false, error: err.message });
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
    res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

router.post("/generate-for-client/:clientId", generation.generateForClient);
router.post("/generate-monthly", generation.generateMonthly);

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
