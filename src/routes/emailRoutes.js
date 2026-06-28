const express = require("express");
const router = express.Router();

const controller = require("../controllers/emailController");

router.post("/invoice", controller.sendInvoiceEmail);

module.exports = router;