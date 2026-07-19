const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");

const controller = require("../controllers/reportSettingController");

router.use(auth("ADMIN"));

// obter configuração do cliente
router.get("/:clientId", controller.getClientReportSetting);

// atualizar configuração do cliente
router.post("/:clientId", controller.updateClientReportSetting);

module.exports = router;