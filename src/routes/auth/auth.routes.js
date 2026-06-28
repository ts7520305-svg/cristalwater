const express = require("express");
const router = express.Router();

const authController = require("../../controllers/authController");
const currentUser = require("../../middleware/currentUser");

router.post("/login", authController.login);
router.get("/me", currentUser, authController.me);

module.exports = router;