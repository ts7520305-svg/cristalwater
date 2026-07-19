const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientController");
const auth = require("../middlewares/authMiddleware");

// Restrict unrestricted client list/details to internal roles only.
router.use(auth("TEAM_LEADER"));

router.get("/", clientController.listClients);
router.get("/:id", clientController.getClientById);
router.post("/", clientController.createClient);
router.put("/:id", clientController.updateClient);
router.post("/:id/activate", clientController.activateClient);
router.post("/:id/activate-contract", clientController.activateClient);
router.post("/:id/archive", clientController.archiveClient);
router.patch("/:id/archive", clientController.archiveClient);
router.post("/:id/restore", clientController.restoreClient);
router.patch("/:id/unarchive", clientController.restoreClient);
router.delete("/:id", clientController.deleteClient);

module.exports = router;
