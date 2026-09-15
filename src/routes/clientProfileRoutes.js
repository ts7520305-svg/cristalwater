const express = require("express");
const router = express.Router();
const { getClientProfile } = require("../controllers/clientProfileController");
router.use(require('../middlewares/authMiddleware')('CLIENT'));

router.get("/:clientId/profile", getClientProfile);

module.exports = router;
