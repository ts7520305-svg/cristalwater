const express = require("express");
const router = express.Router(); // 🔥 IMPORTANTE
const auth = require("../middlewares/authMiddleware");
const { prisma } = require("../prismaClient");
const billingController = require("../controllers/billingController");

router.use(auth("ADMIN"));

// ==========================================================
// GERAR MENSALIDADES
// ==========================================================
router.post("/generate-monthly", billingController.generateMonthly);

// ==========================================================
// ADICIONAR CRÉDITO
// ==========================================================
router.post("/client/:id/credit", billingController.addCredit);

// ==========================================================
// LISTAR FATURAÇÃO
// ==========================================================
router.get("/monthly", billingController.listMonthly);

// ==========================================================
// EXTRAS NÃO FATURADOS
// ==========================================================
router.get("/extras", async (req, res) => {
  try {
    const extras = await require('../services/extraVisitBillingService').pending(prisma);

    const grouped = {};

    extras.forEach(e=>{
      const id = e.pool.client.id;

      if(!grouped[id]){
        grouped[id] = { client:e.pool.client.name, total:0, items:[] };
      }

      grouped[id].items.push({
        pool:e.pool.name,
        price:e.price
      });

      grouped[id].total += e.price;
    });

    res.json({ ok:true, data:grouped });

  } catch {
    res.json({ ok:false });
  }
});

// ==========================================================
// HISTÓRICO DE EXTRAS
// ==========================================================
router.get("/extras/history", async (req, res) => {
  try {
    const extras = await prisma.extraVisit.findMany({
      where:{ billed:true },
      include:{ pool:{ include:{ client:true } } },
      orderBy:{ billedAt:"desc" }
    });

    const grouped = {};

    extras.forEach(e=>{
      const id = e.pool.client.id;

      if(!grouped[id]){
        grouped[id] = { client:e.pool.client.name, total:0, items:[] };
      }

      grouped[id].items.push({
        pool:e.pool.name,
        price:e.price,
        date:e.billedAt
      });

      grouped[id].total += e.price;
    });

    res.json({ ok:true, data:grouped });

  } catch {
    res.json({ ok:false });
  }
});

// ==========================================================
// CONFIRMAR + EMAIL + PDF
// ==========================================================
router.post('/extras/confirm', (req,res) => res.status(409).json({ok:false,code:'INVOICE_REQUIRED',error:'Abra Faturas e gere o documento do cliente e mês. Os extras só ficam faturados quando forem incluídos numa fatura.',next:'/invoices'}));

// ==========================================================
// 🔥 LUCRO REAL + ALERTAS
// ==========================================================
router.get('/technician-profit', async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await require('../services/operationalValueReportService').technicians(req.query)); }
  catch (error) { res.status(error.status || 500).json({ok:false,error:error.status ? error.message : 'Não foi possível confirmar o relatório.'}); }
});

module.exports = router;
