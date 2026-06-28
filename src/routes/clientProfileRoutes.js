const express = require("express");
const router = express.Router();
const { getClientProfile } = require("../controllers/clientProfileController");

router.get("/:clientId/profile", getClientProfile);

module.exports = router;