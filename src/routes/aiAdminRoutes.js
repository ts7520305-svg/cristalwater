const express = require("express");
const router = express.Router();
const { requireAiAdmin } = require("../middlewares/aiAdminAuth");
const controller = require("../controllers/aiAdminController");

router.use(requireAiAdmin);
const run = handler => (req,res,next) => Promise.resolve(handler(req,res,next)).catch(error => {
  const status = error.status || error.statusCode;
  res.status([400,401,403,404,409].includes(status) ? status : 503).json({ok:false,error:[400,401,403,404,409].includes(status) ? error.message : 'Não foi possível concluir a consulta. Tente novamente sem assumir que os valores são zero.'});
});

router.get("/status", run(controller.status));
router.post("/chat", run(controller.chat));
router.get("/threads", run(controller.threads));
router.get("/threads/:id", run(controller.threadDetail));
router.get("/actions", run(controller.actions));
router.post("/actions/:id/approve", run(controller.approve));
router.post("/actions/:id/reject", run(controller.reject));

module.exports = router;
