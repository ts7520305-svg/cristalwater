const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const { roleMatches } = require("../utils/roles");

const {
  listClientReports,
  downloadClientReportPDF,
} = require("../controllers/clientReportController");

router.use(auth());

function ensureClientScope(req, res, next) {
  const clientId = Number(req.params.clientId || 0);
  if (!clientId) {
    return res.status(400).json({ ok: false, error: "clientId inválido" });
  }

  const role = String(req.user?.role || "").trim().toUpperCase();
  if (roleMatches(role, "ADMIN")) return next();

  const authClientId = Number(req.user?.clientId || req.user?.id || 0);
  if (!authClientId || authClientId !== clientId) {
    return res.status(403).json({ ok: false, error: "Acesso negado" });
  }

  return next();
}

// LISTAR RELATÓRIOS
router.get("/:clientId/reports", ensureClientScope, listClientReports);

// DOWNLOAD PDF
router.get("/:clientId/reports/:reportId/pdf", ensureClientScope, downloadClientReportPDF);

module.exports = router;