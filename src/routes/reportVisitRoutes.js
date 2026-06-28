const express = require("express");
const router = express.Router();

const reportVisitController = require("../controllers/reportVisitController");

// RELATÓRIO PDF DA VISITA
router.get("/visit/:id", reportVisitController.generateVisitReport);

module.exports = router;