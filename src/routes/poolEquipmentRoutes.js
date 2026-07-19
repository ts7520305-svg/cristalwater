const express = require("express");
const router = express.Router();

const poolEquipmentController = require("../controllers/poolEquipmentController");

// LISTAR TODOS OS EQUIPAMENTOS
router.get("/", poolEquipmentController.getAllPoolEquipments);

// OBTER EQUIPAMENTO POR ID
router.get("/:id", poolEquipmentController.getPoolEquipmentById);

// CRIAR EQUIPAMENTO
router.post("/", poolEquipmentController.createPoolEquipment);

// INSTALAR EQUIPAMENTO
router.post("/:poolId/install", poolEquipmentController.installPoolEquipment);

// REGISTO DE EQUIPAMENTOS (V2)
router.get("/:poolId/registry", poolEquipmentController.getPoolEquipmentRegistry);
router.post("/:poolId/assets/install", poolEquipmentController.installRegistryAsset);
router.post("/:poolId/assets/:assetId/replace", poolEquipmentController.replaceRegistryAsset);
router.post("/:poolId/assets/:assetId/warranty", poolEquipmentController.updateRegistryAssetWarranty);
router.post("/:poolId/assets/:assetId/remove", poolEquipmentController.removeRegistryAsset);

// ATUALIZAR EQUIPAMENTO
router.put("/:id", poolEquipmentController.updatePoolEquipment);

// APAGAR EQUIPAMENTO
router.delete("/:id", poolEquipmentController.deletePoolEquipment);

module.exports = router;