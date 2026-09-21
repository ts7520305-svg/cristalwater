const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const { sendInvoiceFull } = require("../controllers/invoiceController");
const generation = require("../controllers/invoicePageGenerationController");
const { normalizeInvoice } = require("../services/invoiceViewService");
const auth = require("../middlewares/authMiddleware");
const finance = require("../business/finance/FinanceOsBusiness");

router.use(auth("ADMIN"));

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
  res.set("Cache-Control", "private, no-store");
  try { return res.json(await finance.listExternalInvoices(req.query)); }
  catch (error) { return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : "Não foi possível consultar a faturação externa." }); }
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
  res.set("Cache-Control", "private, no-store");
  try {
    const result = await finance.registerExternalInvoice(req.params.id, req.body, req.user);
    return res.json({ ...result, invoice: normalizeInvoice(result.invoice) });
  } catch (error) { return res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : "Não foi possível guardar o número externo. Consulte o histórico antes de repetir." }); }
});

router.post("/send-full/:invoiceId", sendInvoiceFull);

module.exports = router;
