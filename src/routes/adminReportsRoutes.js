const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");

const {
  listMonthlyReports,
  getMonthlyReport,
} = require("../controllers/adminReportsController");

router.use(auth("ADMIN"));

// Explicit monthly sources; keep this before the historical /reports/:id route.
router.get("/reports/summary", async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { res.json(await require('../services/adminMonthlySummaryService').summary(req.query)); }
  catch (error) {
    const invalid = error.status === 400;
    res.status(invalid ? 400 : 503).json({ok:false,error:invalid ? error.message : 'Não foi possível confirmar esta secção do relatório. Tente novamente.'});
  }
});

// LISTAR
router.get("/reports", listMonthlyReports);

// DETALHE
router.get("/reports/:id", getMonthlyReport);

module.exports = router;
