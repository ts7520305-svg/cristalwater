const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const {
  createCreditLedgerPayment,
  invoiceOpen,
  invoicePaid,
  invoiceStatus,
  invoiceTotal,
} = require("../services/clientCreditService");

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

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found"
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!current) throw new Error("Invoice not found");

      const open = invoiceOpen(current);
      const applied = Math.min(amount, open);
      let payment = null;
      let updatedInvoice = current;

      if (applied > 0) {
        payment = await tx.payment.create({
          data: {
            invoiceId,
            amount: applied,
            amountCents: Math.round(applied * 100),
            method,
            notes: notes || "Pagamento manual registado"
          }
        });

        const paidAfter = invoicePaid(current) + applied;
        const openAfter = Math.max(open - applied, 0);
        updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: paidAfter,
            amountOpen: openAfter,
            status: invoiceStatus(invoiceTotal(current), paidAfter, openAfter),
            paidAt: openAfter <= 0 ? new Date() : current.paidAt,
            paymentMethod: method,
          }
        });
      }

      const surplus = Math.max(amount - applied, 0);
      const credit = surplus > 0 && current.clientId
        ? await createCreditLedgerPayment(tx, current.clientId, surplus, {
          monthRef: current.monthRef || new Date().toISOString().slice(0, 7),
          method,
          notes: notes || "Excedente convertido em credito positivo",
        })
        : { creditAdded: 0 };

      return {
        payment,
        invoice: updatedInvoice,
        appliedAmount: applied,
        creditAdded: credit.creditAdded || 0,
        creditBalance: credit.creditBalance,
      };
    });

    res.json({
      ok: true,
      ...result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = router;
