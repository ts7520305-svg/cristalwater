const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const auth = require("../middlewares/authMiddleware");
const CoreInvoicePaymentBusiness = require('../business/finance/CoreInvoicePaymentBusiness');

router.use(auth("ADMIN"));

// ==========================================
// LISTAR PAGAMENTOS
// ==========================================

router.get("/", async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: {
        paidAt: "desc"
      }
    });

    res.json({
      ok: true,
      payments
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ==========================================
// REGISTAR PAGAMENTO
// ==========================================

router.post("/invoice/:invoiceId", async (req, res) => {
  try {
    const invoiceId = Number(req.params.invoiceId);
    const amount = Number(req.body.amount || 0);
    const method = String(req.body.method || "MANUAL").trim() || "MANUAL";
    const notes = String(req.body.notes || "").trim();

    if (!invoiceId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Indica uma fatura e um valor valido"
      });
    }

    const result = await CoreInvoicePaymentBusiness.registerPayment(prisma, invoiceId, {
      amount, method, notes: notes || 'Pagamento manual registado',
    });

    res.json({
      ok: true,
      ...result
    });

  } catch (err) {
    console.error(err);
    res.status([400, 404, 409].includes(err.status) ? err.status : 500).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = router;
