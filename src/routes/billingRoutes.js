const express = require("express");
const router = express.Router(); // 🔥 IMPORTANTE
const { prisma } = require("../prismaClient");
const billingController = require("../controllers/billingController");
const PDFDocument = require("pdfkit");
const { sendExtrasInvoiceEmail } = require("../services/emailService");

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
router.get("/monthly", async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { client: true }
    });

    const totals = {
      total: invoices.reduce((s,i)=>s+i.total,0),
      paid: invoices.reduce((s,i)=>s+i.amountPaid,0),
      open: invoices.reduce((s,i)=>s+i.amountOpen,0)
    };

    res.json({ ok:true, totals });

  } catch {
    res.json({ ok:false });
  }
});

// ==========================================================
// EXTRAS NÃO FATURADOS
// ==========================================================
router.get("/extras", async (req, res) => {
  try {
    const extras = await prisma.extraVisit.findMany({
      where:{ billed:false },
      include:{ pool:{ include:{ client:true } } }
    });

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
router.post("/extras/confirm", async (req, res) => {
  try {
    const extras = await prisma.extraVisit.findMany({
      where:{ billed:false },
      include:{ pool:{ include:{ client:true } } }
    });

    const grouped = {};

    extras.forEach(e=>{
      const client = e.pool.client;

      if(!grouped[client.id]){
        grouped[client.id] = { client, items:[], total:0 };
      }

      grouped[client.id].items.push(e);
      grouped[client.id].total += e.price;
    });

    for(const id in grouped){

      const g = grouped[id];
      const doc = new PDFDocument();
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));

      doc.on("end", async ()=>{
        const pdf = Buffer.concat(buffers);
        await sendExtrasInvoiceEmail(g.client, pdf);
      });

      doc.text(`Cliente: ${g.client.name}`);
      g.items.forEach(e=>{
        doc.text(`${e.pool.name} - €${e.price}`);
      });

      doc.text(`Total: €${g.total.toFixed(2)}`);
      doc.end();
    }

    await prisma.extraVisit.updateMany({
      where:{ billed:false },
      data:{
        billed:true,
        billedAt:new Date()
      }
    });

    res.json({ ok:true });

  } catch {
    res.json({ ok:false });
  }
});

// ==========================================================
// 🔥 LUCRO REAL + ALERTAS
// ==========================================================
router.get("/technician-profit", async (req, res) => {
  try {

    const { month, year } = req.query;

    let start = null;
    let end = null;

    if (month && year) {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 1);
    }

    const techs = await prisma.user.findMany({
      where: { role: "tecnico" }
    });

    const visits = await prisma.serviceVisit.findMany({
      where: {
        technicianName: { not: null },
        ...(start && end
          ? {
              OR: [
                { startAt: { gte: start, lt: end } },
                { endAt: { gte: start, lt: end } }
              ]
            }
          : {})
      }
    });

    const extras = await prisma.extraVisit.findMany({
      where: {
        billed: true,
        ...(start && end
          ? { billedAt: { gte: start, lt: end } }
          : {})
      },
      include: { user: true }
    });

    const result = {};
    const alerts = {};

    const techByName = {};
    techs.forEach(t => {
      techByName[t.name] = t;
    });

    techs.forEach(t => {
      result[t.id] = {
        technician: t.name,
        visits: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        costPerVisit: t.costPerVisit || 0
      };
    });

    visits.forEach(v => {
      const tech = techByName[v.technicianName];
      if (!tech) return;
      result[tech.id].visits += 1;
    });

    extras.forEach(e => {
      if (!e.userId) return;
      if (!result[e.userId]) return;
      result[e.userId].revenue += Number(e.price || 0);
    });

    Object.values(result).forEach(t => {
      t.cost = t.visits * t.costPerVisit;
      t.profit = t.revenue - t.cost;

      if (t.profit < 0) {
        alerts[t.technician] = t;
      }
    });

    const ranking = Object.values(result)
      .sort((a,b)=>b.profit-a.profit);

    res.json({ ok:true, ranking, alerts });

  } catch (err) {
    console.error(err);
    res.json({ ok:false });
  }
});

module.exports = router;