const express = require("express");
const router = express.Router();

const {
  getRules,
  updateRule,
  getPaymentPolicy,
  updatePaymentPolicy,
} = require("../controllers/notificationRuleController");

router.get("/", getRules);
router.put("/:id", updateRule);

router.get("/payment-policy", getPaymentPolicy);
router.put("/payment-policy", updatePaymentPolicy);

module.exports = router;