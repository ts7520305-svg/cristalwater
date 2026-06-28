const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const router = express.Router();

const c = require("../controllers/guideController");

const guideUploadDir = path.join(__dirname, "../../uploads/guides");
fs.mkdirSync(guideUploadDir, { recursive: true });

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
router.get("/vehicles", c.listVehicles);
router.post("/vehicles", c.createVehicle);
router.put("/vehicles/:id", c.updateVehicle);
router.delete("/vehicles/:id", c.deleteVehicle);
router.post("/vehicles/:id/restore", c.restoreVehicle);
router.post("/vehicles/assign", c.assignTechnicianVehicle);
router.get("/vehicles/:vehicleId/stock-preset", c.getVehicleStockPreset);
router.put("/vehicles/:vehicleId/stock-preset", c.saveVehicleStockPreset);
router.get("/vehicles/:id/insurance", c.getVehicleInsurance);
router.get("/vehicles/:id/insurance/pdf", c.downloadVehicleInsurancePdf);

// Guias de transporte / AT
router.get("/transport", c.listTransportGuides);
router.get("/transport/latest/:vehicleId", c.getLatestTransportGuide);
router.get("/transport/latest/:vehicleId/pdf", c.downloadLatestTransportGuidePdf);
router.get("/transport/:id/document", c.getTransportGuideDocument);
router.post("/transport/:id/document", guideDocumentUpload.single("document"), c.uploadTransportGuideDocument);
router.get("/transport/:id/pdf", c.downloadTransportGuidePdf);
router.post("/transport", c.createTransportGuide);
router.put("/transport/:id", c.updateTransportGuide);
router.put("/transport/:id/items", c.updateTransportGuideItems);

// Guias de obra / stock diário
router.get("/work", c.listWorkGuides);
router.post("/start", c.startWorkGuide);
router.post("/work/start", c.startWorkGuide);
router.post("/consume", c.consumeMaterial);
router.post("/work/consume", c.consumeMaterial);
router.get("/work/:id/pdf", c.downloadWorkGuidePdf);
router.post("/work/:id/close", c.closeWorkGuide);

// Stock e movimentos
router.get("/stock/:vehicleId", c.getVehicleStock);
router.get("/movements", c.listMovements);

// Manutenção viaturas
router.get("/maintenance", c.listMaintenance);
router.post("/maintenance", c.createMaintenance);
router.post("/maintenance/:id/complete", c.completeMaintenance);

module.exports = router;
