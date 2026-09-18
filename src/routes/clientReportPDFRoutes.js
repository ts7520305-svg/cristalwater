// ==========================================
// CLIENT REPORT PDF ROUTES
// ==========================================

const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");

const {
  downloadReportPDF,
} = require("../controllers/clientReportPDFController");

router.use(require('../controllers/clientReportController').privateResponse, auth('CLIENT'));

// GET /api/client/reports/:id/pdf
router.get("/client/reports/:id/pdf", downloadReportPDF);

module.exports = router;
