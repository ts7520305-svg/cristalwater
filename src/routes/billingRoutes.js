const express = require("express");
const router = express.Router(); // 🔥 IMPORTANTE
const auth = require("../middlewares/authMiddleware");
const { prisma } = require("../prismaClient");
const billingController = require("../controllers/billingController");

router.use('/extras/history', (req,res,next)=>{res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.vary('Authorization');next();});
router.use(auth("ADMIN"));

router.get('/extras/history/page', async (req,res)=>{
  res.set('X-CW-Extra-History','extra-history-v1');
  try{const result=await require('../services/extraHistoryService').read(req.user,req.query);res.set('X-CW-Owner',result.owner).json(result);}
  catch(error){const known=[400,403,404].includes(error.statusCode);res.status(known?error.statusCode:503).json({ok:false,error:known?error.message:'Não foi possível confirmar o histórico de extras. Tente novamente.'});}
});

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
  res.set('Cache-Control','private, no-store');
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

  } catch (error) {
    res.status(error.statusCode||error.status||503).json({ok:false,error:(error.statusCode||error.status)?error.message:'Não foi possível consultar os extras. Tente novamente.'});
  }
});

// ==========================================================
// HISTÓRICO DE EXTRAS
// ==========================================================
router.get("/extras/history", async (req, res) => {
  try {
    const extras = await prisma.extraVisit.findMany({
      where:{ billed:true },
      include:{ client:{select:{id:true,name:true}},pool:{select:{name:true}} },
      orderBy:{ billedAt:"desc" }
    });

    const grouped = {};

    extras.forEach(e=>{
      const id = e.clientId ?? 'UNASSIGNED';

      if(!grouped[id]){
        grouped[id] = { client:e.client?.name ?? 'Cliente não registado', total:0, items:[] };
      }

      grouped[id].items.push({
        pool:e.pool?.name ?? 'Piscina não registada',
        price:e.price,
        date:e.billedAt
      });

      grouped[id].total += e.price;
    });

    res.json({ ok:true, data:grouped });

  } catch {
    res.status(503).json({ ok:false });
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
