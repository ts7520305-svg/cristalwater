"use strict";
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const { getMonthlyPrintableReport } = require("../controllers/reportController");
const reports = require("../services/visitReportService");
router.use(auth());
router.get("/monthly-print", auth("ADMIN"), getMonthlyPrintableReport);
router.get("/visit/:id", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const report = await reports.read(req.user, req.params.id, req.query);
    reports.headers(res, report, "visit-html");
    res.type("html").send(reports.html(report));
  } catch (error) {
    if (!error.statusCode) console.error("Visit HTML report:", error);
    res.status(error.statusCode || 503).json({ ok: false, error: error.statusCode ? error.message : "Não foi possível gerar o relatório. Tente novamente." });
  }
});
module.exports = router;
