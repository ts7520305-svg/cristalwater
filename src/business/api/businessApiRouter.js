const express = require("express");

const {
  BusinessEngine,
  ClientService,
  PoolService,
  TechnicianService,
  VisitService,
  BillingService,
  BusinessBrainService,
} = require("../index");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({
    ok: true,
    module: "Cristal Water Business Engine",
    status: BusinessEngine.start(),
    checkedAt: new Date().toISOString(),
  });
});

router.get("/summary", (req, res) => {
  res.json({
    ok: true,
    clients: ClientService.list().length,
    pools: PoolService.list().length,
    technicians: TechnicianService.list().length,
    visits: VisitService.list().length,
    billing: BillingService.list().length,
    pendingBilling: BillingService.pending().length,
    checkedAt: new Date().toISOString(),
  });
});

router.post("/clients", (req, res) => {
  res.status(201).json({ ok: true, client: ClientService.create(req.body || {}) });
});

router.get("/clients", (req, res) => {
  res.json({ ok: true, clients: ClientService.list() });
});

router.post("/pools", (req, res) => {
  res.status(201).json({ ok: true, pool: PoolService.create(req.body || {}) });
});

router.get("/pools", (req, res) => {
  res.json({ ok: true, pools: PoolService.list() });
});

router.post("/technicians", (req, res) => {
  res.status(201).json({ ok: true, technician: TechnicianService.create(req.body || {}) });
});

router.get("/technicians", (req, res) => {
  res.json({ ok: true, technicians: TechnicianService.list() });
});

router.post("/visits", (req, res) => {
  res.status(201).json({ ok: true, visit: VisitService.create(req.body || {}) });
});

router.get("/visits", (req, res) => {
  res.json({ ok: true, visits: VisitService.list() });
});

router.post("/billing", (req, res) => {
  res.status(201).json({ ok: true, billing: BillingService.create(req.body || {}) });
});

router.get("/billing", (req, res) => {
  res.json({ ok: true, billing: BillingService.list() });
});

router.post("/billing/:id/pay", (req, res) => {
  const bill = BillingService.markPaid(req.params.id);

  if (!bill) {
    return res.status(404).json({ ok: false, error: "Fatura não encontrada." });
  }

  res.json({ ok: true, billing: bill });
});


router.post("/brain", async (req, res) => {
  try {
    const { question } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({ ok: false, error: "Pergunta vazia." });
    }

    const result = await BusinessBrainService.ask(question);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
