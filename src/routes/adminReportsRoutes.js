const express = require("express");
const router = express.Router();

const {
  listMonthlyReports,
  getMonthlyReport,
} = require("../controllers/adminReportsController");

// LISTAR
router.get("/reports", listMonthlyReports);

// DETALHE
router.get("/reports/:id", getMonthlyReport);

module.exports = router;