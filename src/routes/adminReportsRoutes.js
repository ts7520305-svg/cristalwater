const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");

const {
  listMonthlyReports,
  getMonthlyReport,
} = require("../controllers/adminReportsController");

router.use(auth("ADMIN"));

// LISTAR
router.get("/reports", listMonthlyReports);

// DETALHE
router.get("/reports/:id", getMonthlyReport);

module.exports = router;