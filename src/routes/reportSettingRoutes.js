const express = require("express");
const router = express.Router();

const controller = require("../controllers/reportSettingController");

// obter configuração do cliente
router.get("/:clientId", controller.getClientReportSetting);

// atualizar configuração do cliente
router.post("/:clientId", controller.updateClientReportSetting);

module.exports = router;