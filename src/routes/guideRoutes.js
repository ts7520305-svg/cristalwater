const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/authMiddleware");
const { roleIn } = require("../utils/roles");
const router = express.Router();
const { resolveUploadSubdir } = require("../config/uploadPath");

const c = require("../controllers/guideController");

function allowRoles(...roles) {
  return (req, res, next) => {
    if (roleIn(req.user?.role, roles)) return next();
    return res.status(403).json({ ok: false, message: "Sem permissão" });
  };
}

router.use(auth());

const guideUploadDir = resolveUploadSubdir("guides");

const guideDocumentUpload = multer({
  storage: multer.diskStorage({
    destination: guideUploadDir,
    filename: (req, file, cb) => {
      const safeName = String(file.originalname || "guia-at")
        .replace(/[^a-zA-Z0-9_.-]/g, "_")
        .slice(-120);
      cb(null, `${Date.now()}-${safeName}`);
    }
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const nameOk = /\.(pdf|png|jpe?g|webp|xml|txt)$/i.test(file.originalname || "");
    const mimeOk = [
      "application/pdf",
      "application/xml",
      "text/xml",
      "text/plain",
      "image/png",
      "image/jpeg",
      "image/webp"
    ].includes(file.mimetype);
    cb(null, nameOk || mimeOk);
  }
});

// Frota / veículos
router.get("/vehicles", allowRoles("ADMIN", "TECHNICIAN"), c.listVehicles);
router.post("/vehicles", allowRoles("ADMIN"), c.createVehicle);
router.put("/vehicles/:id", allowRoles("ADMIN"), c.updateVehicle);
router.delete("/vehicles/:id", allowRoles("ADMIN"), c.deleteVehicle);
router.post("/vehicles/:id/restore", allowRoles("ADMIN"), c.restoreVehicle);
router.post("/vehicles/assign", allowRoles("ADMIN"), c.assignTechnicianVehicle);
router.get("/vehicles/:vehicleId/stock-preset", allowRoles("ADMIN", "TECHNICIAN"), c.getVehicleStockPreset);
router.put("/vehicles/:vehicleId/stock-preset", allowRoles("ADMIN"), c.saveVehicleStockPreset);
router.get("/vehicles/:id/insurance", allowRoles("ADMIN", "TECHNICIAN"), c.getVehicleInsurance);
router.get("/vehicles/:id/insurance/pdf", allowRoles("ADMIN", "TECHNICIAN"), c.downloadVehicleInsurancePdf);

// Guias de transporte / AT
router.get("/transport", allowRoles("ADMIN", "TECHNICIAN"), c.listTransportGuides);
router.get("/transport/latest/:vehicleId", allowRoles("ADMIN", "TECHNICIAN"), c.getLatestTransportGuide);
router.get("/transport/latest/:vehicleId/pdf", allowRoles("ADMIN", "TECHNICIAN"), c.downloadLatestTransportGuidePdf);
router.get("/transport/:id/document", allowRoles("ADMIN", "TECHNICIAN"), c.getTransportGuideDocument);
router.post("/transport/:id/document", allowRoles("ADMIN"), guideDocumentUpload.single("document"), c.uploadTransportGuideDocument);
router.get("/transport/:id/pdf", allowRoles("ADMIN", "TECHNICIAN"), c.downloadTransportGuidePdf);
router.post("/transport", allowRoles("ADMIN"), c.createTransportGuide);
router.put("/transport/:id", allowRoles("ADMIN"), c.updateTransportGuide);
router.put("/transport/:id/items", allowRoles("ADMIN"), c.updateTransportGuideItems);

// Guias de obra / stock diário
router.get("/work", allowRoles("ADMIN", "TECHNICIAN"), c.listWorkGuides);
router.post("/start", allowRoles("ADMIN", "TECHNICIAN"), c.startWorkGuide);
router.post("/work/start", allowRoles("ADMIN", "TECHNICIAN"), c.startWorkGuide);
router.post("/consume", allowRoles("ADMIN", "TECHNICIAN"), c.consumeMaterial);
router.post("/work/consume", allowRoles("ADMIN", "TECHNICIAN"), c.consumeMaterial);
router.get("/work/:id/pdf", allowRoles("ADMIN", "TECHNICIAN"), c.downloadWorkGuidePdf);
router.post("/work/:id/close", allowRoles("ADMIN", "TECHNICIAN"), c.closeWorkGuide);

// Stock e movimentos
router.get("/stock/:vehicleId", allowRoles("ADMIN", "TECHNICIAN"), c.getVehicleStock);
router.get("/movements", allowRoles("ADMIN", "TECHNICIAN"), c.listMovements);

// Manutenção viaturas
router.get("/maintenance", allowRoles("ADMIN", "TECHNICIAN"), c.listMaintenance);
router.post("/maintenance", allowRoles("ADMIN", "TECHNICIAN"), c.createMaintenance);
router.post("/maintenance/:id/complete", allowRoles("ADMIN", "TECHNICIAN"), c.completeMaintenance);

module.exports = router;
