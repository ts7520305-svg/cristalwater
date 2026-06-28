const express = require("express");
const router = express.Router();

const {
  listCommunications
} = require("../controllers/comunicationController");

router.get("/", listCommunications);

module.exports = router;