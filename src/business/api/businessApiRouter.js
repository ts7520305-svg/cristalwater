const express = require("express");

const {
  BusinessEngine,
  ClientService,
  PoolService,
  TechnicianService,
  VisitService,
  BillingService,
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

module.exports = router;
