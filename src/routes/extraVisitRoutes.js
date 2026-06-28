const express = require("express");
const router = express.Router();

const {
  createExtraVisit,
  listExtraVisits,
  updateExtraVisitStatus,
  updateExtraVisit,
} = require("../controllers/extraVisitController");

// CREATE
router.post("/", createExtraVisit);

// LIST
router.get("/", listExtraVisits);

// UPDATE STATUS
router.put("/:id/status", updateExtraVisitStatus);

// UPDATE FULL EXTRA VISIT
router.put("/:id", updateExtraVisit);

module.exports = router;
