// src/routes/technicalHistoryRoutes.js
const express = require("express");
const router = express.Router();

const {
  listAll,
  listByPool,
  getById,
  create,
  update,
  remove,
} = require("../controllers/technicalHistoryController");

// LISTAR TODOS OS REGISTOS
router.get("/", listAll);

// LISTAR POR PISCINA
router.get("/pool/:poolId", listByPool);

// BUSCAR UM REGISTO POR ID
router.get("/:id", getById);

// CRIAR
router.post("/", create);

// ATUALIZAR
router.put("/:id", update);

// APAGAR
router.delete("/:id", remove);

module.exports = router;