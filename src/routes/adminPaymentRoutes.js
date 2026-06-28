const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const {
  listClientPayments,
  markClientPaid,
  markClientReminded,
  registerManualReceived,
} = require("../controllers/adminPaymentController");

// Dashboard de cobranças usado por admin-collection.js
router.get("/", listClientPayments);
router.post("/:clientId/mark-paid", markClientPaid);
router.post("/:clientId/mark-reminded", markClientReminded);
router.post("/:clientId/manual-received", registerManualReceived);

// Ledger financeiro bruto
router.get("/ledger/all", async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { invoice: { include: { client: true } } },
      orderBy: { paidAt: "desc" },
    });
    res.json({ ok: true, payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/client/:clientId", async (req, res) => {
  try {
    const clientId = Number(req.params.clientId);
    const payments = await prisma.payment.findMany({
      where: { invoice: { clientId } },
      include: { invoice: true },
      orderBy: { paidAt: "desc" },
    });
    res.json({ ok: true, payments });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
