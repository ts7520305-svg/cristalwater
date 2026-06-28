const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Prisma, PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["warn", "error"] });

const backupDir = path.resolve(__dirname, "..", "..", "backups");

function ensureBackupDir() {
  fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizeDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const keep = new URLSearchParams();
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      const value = parsed.searchParams.get(key);
      if (value) keep.set(key, value);
    }
    parsed.search = keep.toString();
    return parsed.toString();
  } catch (_) {
    return String(databaseUrl).split("?")[0];
  }
}

function runPgDump(databaseUrl, outFile) {
  const candidates = [
    process.env.PG_DUMP_PATH,
    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe",
    "pg_dump",
  ].filter(Boolean);

  const pgDumpUrl = normalizeDatabaseUrl(databaseUrl);
  for (const command of candidates) {
    try {
      execFileSync(command, ["--no-owner", "--no-privileges", "--file", outFile, pgDumpUrl], {
        stdio: "pipe",
        windowsHide: true,
      });
      return { ok: true, file: outFile, type: "sql", command };
    } catch (_) {
      // Try next candidate.
    }
  }

  return { ok: false, reason: "pg_dump nao encontrado ou falhou" };
}

async function runJsonFallback(outFile) {
  const data = {};
  const models = Prisma.dmmf.datamodel.models
    .map((model) => model.name)
    .sort((a, b) => a.localeCompare(b));

  for (const modelName of models) {
    const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const delegate = prisma[delegateName];
    if (!delegate?.findMany) continue;
    data[modelName] = await delegate.findMany();
  }

  fs.writeFileSync(outFile, JSON.stringify({
    createdAt: new Date().toISOString(),
    format: "prisma-json-fallback",
    data,
  }, null, 2));

  return { ok: true, file: outFile, type: "json-fallback" };
}

function publicBackupInfo(file) {
  const stat = fs.statSync(file);
  return {
    name: path.basename(file),
    file,
    sizeBytes: stat.size,
    createdAt: stat.birthtime,
    updatedAt: stat.mtime,
    type: path.extname(file).replace(".", "") || "backup",
  };
}

function listBackups(limit = 8) {
  const dir = ensureBackupDir();
  return fs.readdirSync(dir)
    .filter((name) => /\.(sql|json)$/i.test(name))
    .map((name) => publicBackupInfo(path.join(dir, name)))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

async function createDatabaseBackup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL em falta.");

  const dir = ensureBackupDir();
  const stamp = timestamp();
  const sqlFile = path.join(dir, `cristalwater-db-${stamp}.sql`);
  const jsonFile = path.join(dir, `cristalwater-db-${stamp}.json`);

  const backup = runPgDump(databaseUrl, sqlFile);
  const result = backup.ok ? backup : await runJsonFallback(jsonFile);
  return {
    ok: true,
    backup: publicBackupInfo(result.file),
    fallback: result.type !== "sql",
  };
}

function getReleaseSafetyStatus() {
  let version = "desconhecida";
  try {
    const pkg = require("../../package.json");
    version = pkg.version || version;
  } catch (_) {
    // keep default
  }

  return {
    ok: true,
    version,
    mode: process.env.NODE_ENV || "development",
    backupDir: ensureBackupDir(),
    docs: "docs/SAFE_RELEASE_AND_ROLLBACK.md",
    canBackupNow: true,
    rollbackPolicy: "Rollback troca apenas o codigo. Base de dados, uploads, PDFs, guias e .env ficam preservados.",
    recommendedVpsLayout: {
      releases: "/opt/cristalwater/releases",
      shared: "/opt/cristalwater/shared",
      current: "/opt/cristalwater/current",
    },
    latestBackups: listBackups(6),
  };
}

async function disconnectDatabaseBackupService() {
  await prisma.$disconnect().catch(() => null);
}

module.exports = {
  backupDir,
  createDatabaseBackup,
  disconnectDatabaseBackupService,
  getReleaseSafetyStatus,
  listBackups,
};
