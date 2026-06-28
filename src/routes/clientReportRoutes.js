const express = require("express");
const router = express.Router();

const {
  listClientReports,
  downloadClientReportPDF,
} = require("../controllers/clientReportController");

// LISTAR RELATÓRIOS
router.get("/:clientId/reports", listClientReports);

// DOWNLOAD PDF
router.get("/:clientId/reports/:reportId/pdf", downloadClientReportPDF);

module.exports = router;