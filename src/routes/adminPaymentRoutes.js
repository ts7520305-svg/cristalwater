const express = require("express");
const router = express.Router();
const { prisma } = require("../prismaClient");
const auth = require("../middlewares/authMiddleware");
const {
  listClientPayments,
  markClientPaid,
  markClientReminded,
  registerManualReceived,
} = require("../controllers/adminPaymentController");

router.use('/ledger/page', (req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-CW-Ledger':'admin-payments-v1'});res.vary('Authorization');next();});
router.use(auth("ADMIN"));

router.get('/ledger/page', async (req,res)=>{
  try {const result=await require('../services/adminPaymentLedgerService').read(req.user,req.query);res.set('X-CW-Owner',result.owner).json(result);}
  catch(error){const known=[400,403,404].includes(error.statusCode);res.status(known?error.statusCode:503).json({ok:false,error:known?error.message:'Não foi possível confirmar os pagamentos. Tente novamente.'});}
});

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
