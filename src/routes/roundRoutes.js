const express = require("express");
const router = express.Router();

const controller = require("../controllers/roundController");

// gerar semana
router.post("/generate", controller.generateWeek);

// ver semana
router.get("/week", controller.getWeek);

// alterar tecnico/data/estado de uma visita planeada
router.patch("/visits/:id", controller.updateVisit);

module.exports = router;
