// src/routes/statsRoutes.js
const express = require("express");
const router = express.Router();
const { summary } = require("../controllers/statsController");

// Resumo geral do sistema
router.get("/summary", summary);

module.exports = router;