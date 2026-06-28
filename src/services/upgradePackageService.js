const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const upgradeRoot = path.resolve(__dirname, "..", "..", "upgrades");
const packageDir = path.join(upgradeRoot, "packages");
const uploadTempDir = path.join(upgradeRoot, "tmp");
const stateFile = path.join(upgradeRoot, "upgrade-state.json");

function ensureUpgradeDirs() {
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(uploadTempDir, { recursive: true });
  return { upgradeRoot, packageDir, uploadTempDir };
}

function readState() {
  ensureUpgradeDirs();
  if (!fs.existsSync(stateFile)) {
    return {
      activeReleaseId: null,
      previousReleaseId: null,
      packages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch (_) {
    return {
      activeReleaseId: null,
      previousReleaseId: null,
      packages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warning: "Estado de upgrade anterior estava ilegivel e foi ignorado.",
    };
  }
}

function writeState(state) {
  ensureUpgradeDirs();
  const next = { ...state, updatedAt: new Date().toISOString() };
  fs.writeFileSync(stateFile, JSON.stringify(next, null, 2));
  return next;
}

function cleanFileName(name) {
  return String(name || "upgrade.zip")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function fileSha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function hasZipSignature(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  } finally {
    fs.closeSync(fd);
  }
}

function activationConfig() {
  const enabled = String(process.env.ENABLE_BROWSER_UPGRADE_ACTIVATE || "").toLowerCase() === "true";
  return {
    enabled,
    releasesDir: process.env.UPGRADE_RELEASES_DIR || "/opt/cristalwater/releases",
    sharedDir: process.env.UPGRADE_SHARED_DIR || "/opt/cristalwater/shared",
    currentPath: process.env.UPGRADE_CURRENT_PATH || "/opt/cristalwater/current",
    restartCommandConfigured: Boolean(process.env.UPGRADE_RESTART_COMMAND || process.env.UPGRADE_ACTIVATE_SCRIPT),
  };
}

function getUpgradeState() {
  const state = readState();
  return {
    ok: true,
    stateFile,
    packageDir,
    uploadTempDir,
    activation: activationConfig(),
    activeReleaseId: state.activeReleaseId || null,
    previousReleaseId: state.previousReleaseId || null,
    packages: (state.packages || []).slice(0, 20),
  };
}

function registerUpgradePackage({ file, actor, backup }) {
  ensureUpgradeDirs();
  if (!file?.path) throw new Error("Ficheiro ZIP em falta.");
  if (!String(file.originalname || "").toLowerCase().endsWith(".zip")) {
    fs.unlinkSync(file.path);
    throw new Error("O pacote de upgrade tem de ser um ficheiro .zip.");
  }
  if (!hasZipSignature(file.path)) {
    fs.unlinkSync(file.path);
    throw new Error("O ficheiro enviado nao parece ser um ZIP valido.");
  }

  const id = `UPG-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`;
  const originalName = cleanFileName(file.originalname);
  const storedName = `${id}-${originalName}`;
  const target = path.join(packageDir, storedName);
  fs.renameSync(file.path, target);

  const record = {
    id,
    originalName,
    storedName,
    file: target,
    sizeBytes: fs.statSync(target).size,
    sha256: fileSha256(target),
    status: "STAGED",
    createdAt: new Date().toISOString(),
    createdBy: actor || "admin",
    backupBeforeUpgrade: backup?.backup || null,
    notes: "Pacote carregado e guardado. Dados reais preservados. Ativacao depende da configuracao segura no VPS.",
  };

  const state = readState();
  state.packages = [record, ...(state.packages || [])].slice(0, 50);
  writeState(state);
  return record;
}

function packageById(id) {
  const state = readState();
  return (state.packages || []).find((item) => item.id === id);
}

function activationBlockedResponse() {
  return {
    ok: false,
    requiresVpsConfig: true,
    error: "Ativacao automatica bloqueada neste ambiente. Configura ENABLE_BROWSER_UPGRADE_ACTIVATE=true e a estrutura releases/current/shared no VPS.",
    activation: activationConfig(),
  };
}

function activateUpgradePackage(id, actor) {
  const pkg = packageById(id);
  if (!pkg) throw new Error("Pacote de upgrade nao encontrado.");
  if (!activationConfig().enabled) return activationBlockedResponse();

  const state = readState();
  state.previousReleaseId = state.activeReleaseId || null;
  state.activeReleaseId = id;
  state.packages = (state.packages || []).map((item) => item.id === id
    ? { ...item, status: "ACTIVE", activatedAt: new Date().toISOString(), activatedBy: actor || "admin" }
    : item
  );
  writeState(state);

  return {
    ok: true,
    activeReleaseId: id,
    previousReleaseId: state.previousReleaseId,
    message: "Pacote marcado como ativo. No VPS, o servico deve apontar current para esta release e reiniciar.",
  };
}

function rollbackUpgrade(actor) {
  const state = readState();
  if (!state.previousReleaseId) {
    return { ok: false, error: "Nao existe versao anterior registada para rollback." };
  }
  if (!activationConfig().enabled) return activationBlockedResponse();

  const oldActive = state.activeReleaseId || null;
  state.activeReleaseId = state.previousReleaseId;
  state.previousReleaseId = oldActive;
  state.packages = (state.packages || []).map((item) => {
    if (item.id === state.activeReleaseId) {
      return { ...item, status: "ACTIVE", rollbackActivatedAt: new Date().toISOString(), rollbackBy: actor || "admin" };
    }
    if (item.id === oldActive) return { ...item, status: "ROLLED_BACK" };
    return item;
  });
  writeState(state);

  return {
    ok: true,
    activeReleaseId: state.activeReleaseId,
    previousReleaseId: state.previousReleaseId,
    message: "Rollback registado. Dados preservados.",
  };
}

module.exports = {
  activateUpgradePackage,
  ensureUpgradeDirs,
  getUpgradeState,
  registerUpgradePackage,
  rollbackUpgrade,
};
