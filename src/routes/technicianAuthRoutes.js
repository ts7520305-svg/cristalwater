// ==========================================
// TECHNICIAN AUTH ROUTES
// ==========================================

const express = require("express");
const router = express.Router();

const { loginTechnician } = require("../controllers/technicianAuthController");

router.post("/login", loginTechnician);

module.exports = router;
