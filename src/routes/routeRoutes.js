const express = require("express");
const router = express.Router();

const controller = require("../controllers/routeController");

router.get("/optimize", require("../middlewares/authMiddleware")("TECHNICIAN"), controller.optimizeRoute);

module.exports = router;