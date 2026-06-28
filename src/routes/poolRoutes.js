const express = require("express");
const router = express.Router();
const poolController = require("../controllers/poolController");

router.get("/", poolController.listPools);
router.get("/:id", poolController.getPoolById);
router.post("/", poolController.createPool);
router.put("/:id", poolController.updatePool);
router.post("/:id/archive", poolController.archivePool);
router.patch("/:id/archive", poolController.archivePool);
router.post("/:id/restore", poolController.restorePool);
router.patch("/:id/unarchive", poolController.restorePool);
router.delete("/:id", poolController.deletePool);

module.exports = router;
