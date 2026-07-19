const express = require("express");
const multer = require("multer");
const controller = require("../controllers/repairController");
const { resolveUploadSubdir } = require("../config/uploadPath");

const router = express.Router();

const uploadDir = resolveUploadSubdir("repairs");

const upload = multer({
	storage: multer.diskStorage({
		destination: uploadDir,
		filename: (req, file, cb) => cb(null, `${Date.now()}-${String(file.originalname || "photo").replace(/[^a-zA-Z0-9_.-]/g, "_")}`),
	}),
	limits: { fileSize: 20 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		if (!String(file?.mimetype || "").startsWith("image/")) {
			const error = new Error("Formato de ficheiro inválido. Envie apenas imagens.");
			error.statusCode = 400;
			return cb(error);
		}
		return cb(null, true);
	},
});

router.post("/", controller.createRepair);
router.get("/pool/:poolId", controller.listRepairsByPool);
router.get("/:id/pdf", controller.repairPdf);
router.put("/:id/quote", controller.quoteRepair);
router.put("/:id/diagnose", controller.diagnoseRepair);
router.put("/:id/schedule", controller.scheduleRepair);
router.put("/:id/cancel", controller.cancelRepair);
router.put("/:id/approve", controller.approveRepair);
router.put("/:id/invoice", controller.invoiceRepair);
router.put("/:id/payment", controller.registerPayment);
router.put("/:id/close", controller.closeRepair);
router.put("/:id/mark-sent", controller.markSent);
router.put("/:id/complete", controller.completeRepair);
router.post("/:id/photo", upload.single("photo"), controller.recordRepairPhoto);
router.delete("/:id", controller.deleteRepair);

router.use((error, req, res, next) => {
	if (!error) return next();
	if (error instanceof multer.MulterError) {
		const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
		const message = error.code === "LIMIT_FILE_SIZE"
			? "Ficheiro demasiado grande. Limite máximo: 20MB."
			: error.message || "Erro no upload da imagem.";
		return res.status(status).json({ ok: false, error: message });
	}
	if (error.statusCode) {
		return res.status(error.statusCode).json({ ok: false, error: error.message });
	}
	return next(error);
});

module.exports = router;