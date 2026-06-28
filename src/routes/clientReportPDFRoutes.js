// ==========================================
// CLIENT REPORT PDF ROUTES
// ==========================================

const express = require("express");
const router = express.Router();

const {
  downloadReportPDF,
} = require("../controllers/clientReportPDFController");

// GET /api/client/reports/:id/pdf
router.get("/client/reports/:id/pdf", downloadReportPDF);

module.exports = router;