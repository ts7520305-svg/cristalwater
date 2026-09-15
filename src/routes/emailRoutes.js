const express = require("express");
const router = express.Router();
router.use(require('../middlewares/authMiddleware')('ADMIN'));

const controller = require("../controllers/emailController");

router.post("/invoice", controller.sendInvoiceEmail);

module.exports = router;
