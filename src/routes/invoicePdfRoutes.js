const express = require("express");
const router = express.Router();

const controller = require("../controllers/invoicePdfController");
router.use(require('../middlewares/authMiddleware')());

// ==========================================================
// 🔥 PDF EXTRAS (PRIMEIRO — MUITO IMPORTANTE)
// ==========================================================

router.get("/extras/:id", controller.generateExtrasPdf);

// ==========================================================
// PDF FATURA NORMAL
// ==========================================================

router.get("/:id", controller.generateInvoicePdf);

module.exports = router;
