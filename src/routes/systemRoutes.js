const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { prisma } = require("../prismaClient");
const auth = require("../middlewares/authMiddleware");
const {
  createDatabaseBackup,
  getReleaseSafetyStatus,
} = require("../services/databaseBackupService");
const {
  activateUpgradePackage,
  ensureUpgradeDirs,
  getUpgradeState,
  registerUpgradePackage,
  rollbackUpgrade,
} = require("../services/upgradePackageService");

const upgradeUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUpgradeDirs().uploadTempDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${String(file.originalname || "upgrade.zip").replace(/[^a-zA-Z0-9._-]/g, "_")}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!String(file.originalname || "").toLowerCase().endsWith(".zip")) {
      return cb(new Error("O pacote de upgrade tem de ser .zip"));
    }
    return cb(null, true);
  },
});

router.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      status: "ONLINE",
      database: "ONLINE",
      at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      status: "ERROR",
      database: "ERROR",
      error: err.message,
    });
  }
});

router.get("/version", (req, res) => {
  res.json({
    ok: true,
    app: "Cristal Water",
    version: "enterprise-v3",
    mode: process.env.NODE_ENV || "development",
    at: new Date().toISOString(),
  });
});

router.get("/modules", (req, res) => {
  const routesDir = path.join(__dirname);
  const frontendDir = path.join(__dirname, "../../frontend");

  const routes = fs
    .readdirSync(routesDir)
    .filter(file => file.endsWith(".js"))
    .sort();

  const pages = fs.existsSync(frontendDir)
    ? fs.readdirSync(frontendDir).filter(file => file.endsWith(".html")).sort()
    : [];

  res.json({
    ok: true,
    counts: {
      backendRoutes: routes.length,
      frontendPages: pages.length,
    },
    routes,
    pages,
  });
});

router.get("/release-safety", auth("ADMIN"), (req, res) => {
  try {
    return res.json(getReleaseSafetyStatus());
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Erro ao ler estado de atualizacoes" });
  }
});

router.post("/backup", auth("ADMIN"), async (req, res) => {
  try {
    const result = await createDatabaseBackup();
    await prisma.userAuditLog.create({
      data: {
        actor: req.user?.email || "admin",
        action: "DATABASE_BACKUP_CREATED",
        entity: "System",
        metadata: {
          file: result.backup?.file,
          type: result.backup?.type,
          fallback: result.fallback,
        },
      },
    }).catch(() => null);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Erro ao criar backup" });
  }
});

router.get("/upgrade", auth("ADMIN"), (req, res) => {
  try {
    return res.json(getUpgradeState());
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Erro ao ler upgrades" });
  }
});

router.post("/upgrade/upload", auth("ADMIN"), upgradeUpload.single("package"), async (req, res) => {
  try {
    const backup = await createDatabaseBackup();
    const record = registerUpgradePackage({
      file: req.file,
      actor: req.user?.email || "admin",
      backup,
    });
    await prisma.userAuditLog.create({
      data: {
        actor: req.user?.email || "admin",
        action: "UPGRADE_PACKAGE_STAGED",
        entity: "SystemUpgrade",
        entityId: record.id,
        metadata: {
          originalName: record.originalName,
          sha256: record.sha256,
          backup: record.backupBeforeUpgrade?.file || null,
        },
      },
    }).catch(() => null);
    return res.status(201).json({ ok: true, package: record, state: getUpgradeState() });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ ok: false, error: err.message || "Erro ao carregar pacote de upgrade" });
  }
});

router.post("/upgrade/:id/activate", auth("ADMIN"), async (req, res) => {
  try {
    const result = activateUpgradePackage(req.params.id, req.user?.email || "admin");
    if (!result.ok) return res.status(409).json(result);
    await prisma.userAuditLog.create({
      data: {
        actor: req.user?.email || "admin",
        action: "UPGRADE_PACKAGE_ACTIVATE",
        entity: "SystemUpgrade",
        entityId: req.params.id,
        metadata: result,
      },
    }).catch(() => null);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Erro ao ativar pacote" });
  }
});

router.post("/upgrade/rollback", auth("ADMIN"), async (req, res) => {
  try {
    const result = rollbackUpgrade(req.user?.email || "admin");
    if (!result.ok) return res.status(result.requiresVpsConfig ? 409 : 400).json(result);
    await prisma.userAuditLog.create({
      data: {
        actor: req.user?.email || "admin",
        action: "UPGRADE_ROLLBACK",
        entity: "SystemUpgrade",
        entityId: result.activeReleaseId || "rollback",
        metadata: result,
      },
    }).catch(() => null);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Erro ao fazer rollback" });
  }
});

module.exports = router;
