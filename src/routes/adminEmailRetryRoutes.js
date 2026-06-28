const express = require("express");
const router = express.Router();

const { adminAuth } = require("../middlewares/adminAuth");
const { retryFailed } = require("../controllers/adminEmailRetryController");

router.post("/email/retry-failed/:id", adminAuth, retryFailed);

module.exports = router;