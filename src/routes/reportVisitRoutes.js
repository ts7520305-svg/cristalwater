const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");

const reportVisitController = require("../controllers/reportVisitController");

router.use(auth());

// RELATÓRIO PDF DA VISITA
router.get("/visit/:id", reportVisitController.generateVisitReport);

module.exports = router;