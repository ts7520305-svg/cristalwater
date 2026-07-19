const express = require("express");
const auth = require("../middlewares/authMiddleware");
const c = require("../controllers/installationController");

const router = express.Router();

router.use(auth("TECHNICIAN"));

router.post("/", c.requestInstallation);
router.get("/:id", c.getInstallation);

router.put("/:id/proposal", c.proposeEquipment);
router.put("/:id/quote", c.createQuote);
router.put("/:id/approval", c.approveCustomer);
router.put("/:id/schedule", c.scheduleInstallation);
router.put("/:id/assign-technician", c.assignTechnician);
router.put("/:id/reserve-stock", c.reserveStock);
router.put("/:id/work-order", c.generateWorkOrder);
router.put("/:id/start", c.startInstallation);
router.put("/:id/gps-checkin", c.gpsCheckIn);
router.put("/:id/equipment", c.installEquipment);
router.post("/:id/photo", c.addPhoto);
router.put("/:id/serials", c.registerSerialNumbers);
router.put("/:id/warranty", c.registerWarranty);
router.put("/:id/checklist", c.submitChecklist);
router.put("/:id/sign-tech", c.signTechnician);
router.put("/:id/sign-customer", c.signCustomer);
router.put("/:id/acceptance", c.acceptCustomer);
router.put("/:id/consume-stock", c.consumeStock);
router.put("/:id/invoice", c.generateInvoice);
router.put("/:id/payment", c.trackPayment);
router.put("/:id/complete", c.completeInstallation);

module.exports = router;
