const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/authMiddleware");
const { roleIn } = require("../utils/roles");
const controller = require("../controllers/repairController");
const { resolveUploadSubdir } = require("../config/uploadPath");

const router = express.Router();

function allowRoles(...roles) {
	return (req, res, next) => {
		if (roleIn(req.user?.role, roles)) return next();
		return res.status(403).json({ ok: false, message: "Sem permissão" });
	};
}

router.use(auth());

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

router.post("/", allowRoles("ADMIN", "TECHNICIAN"), controller.createRepair);
router.get("/pool/:poolId", allowRoles("ADMIN", "TECHNICIAN"), controller.listRepairsByPool);
router.get("/:id/pdf", allowRoles("ADMIN", "TECHNICIAN"), controller.repairPdf);
router.put("/:id/quote", allowRoles("ADMIN"), controller.quoteRepair);
router.put("/:id/diagnose", allowRoles("ADMIN", "TECHNICIAN"), controller.diagnoseRepair);
router.put("/:id/schedule", allowRoles("ADMIN", "TECHNICIAN"), controller.scheduleRepair);
router.put("/:id/cancel", allowRoles("ADMIN", "TECHNICIAN"), controller.cancelRepair);
router.put("/:id/approve", allowRoles("ADMIN"), controller.approveRepair);
router.put("/:id/invoice", allowRoles("ADMIN"), controller.invoiceRepair);
router.put("/:id/payment", allowRoles("ADMIN"), controller.registerPayment);
router.put("/:id/close", allowRoles("ADMIN", "TECHNICIAN"), controller.closeRepair);
router.put("/:id/mark-sent", allowRoles("ADMIN"), controller.markSent);
router.put("/:id/complete", allowRoles("ADMIN", "TECHNICIAN"), controller.completeRepair);
router.post("/:id/photo", allowRoles("ADMIN", "TECHNICIAN"), upload.single("photo"), controller.recordRepairPhoto);
router.delete("/:id", allowRoles("ADMIN"), controller.deleteRepair);

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