const express = require("express");
const router = express.Router();

const poolEquipmentController = require("../controllers/poolEquipmentController");

// LISTAR TODOS OS EQUIPAMENTOS
router.get("/", poolEquipmentController.getAllPoolEquipments);

// OBTER EQUIPAMENTO POR ID
router.get("/:id", poolEquipmentController.getPoolEquipmentById);

// CRIAR EQUIPAMENTO
router.post("/", poolEquipmentController.createPoolEquipment);

// ATUALIZAR EQUIPAMENTO
router.put("/:id", poolEquipmentController.updatePoolEquipment);

// APAGAR EQUIPAMENTO
router.delete("/:id", poolEquipmentController.deletePoolEquipment);

module.exports = router;