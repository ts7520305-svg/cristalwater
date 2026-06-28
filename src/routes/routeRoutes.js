const express = require("express");
const router = express.Router();

const controller = require("../controllers/routeController");

router.get("/optimize", controller.optimizeRoute);

module.exports = router;