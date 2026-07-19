// ==========================================
// CRISTAL WATER - ADMIN ROUNDS ROUTES (DEV SEM TOKENS)
// ==========================================

const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");

const {
  listRounds,
  getWeeklyPlan,
  createRound,
  updateRound,
  deleteRound,
  assignTechnician,
  assignPool,
  movePoolToRound,
  updatePoolOrder,
} = require("../controllers/adminRoundsController");

router.use(auth("ADMIN"));

// LISTAR RONDAS
router.get("/", listRounds);

// PLANO SEMANAL
router.get("/week", getWeeklyPlan);

// CRIAR RONDA
router.post("/", createRound);

// EDITAR RONDA
router.put("/:id", updateRound);

// APAGAR RONDA
router.delete("/:id", deleteRound);

// ATRIBUIR TÉCNICO À RONDA
router.post("/:id/technicians", assignTechnician);

// ATRIBUIR PISCINA À RONDA
router.post("/:id/pools", assignPool);

router.post("/:id/move-pool", movePoolToRound);

// REORDENAR PISCINAS (drag & drop)
router.post("/:id/reorder-pools", updatePoolOrder);

module.exports = router;
