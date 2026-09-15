const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { randomUUID } = require("crypto");
const execute = promisify(execFile);
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

async function runPgDump(databaseUrl, outFile) {
  const candidates = [
    process.env.PG_DUMP_PATH,
    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe",
    "pg_dump",
  ].filter(Boolean);

  const pgDumpUrl = normalizeDatabaseUrl(databaseUrl);
  for (const command of candidates) {
    try {
      const temporary = `${outFile}.partial`;
      fs.writeFileSync(temporary, "", { mode: 0o600 });
      await execute(command, ["--no-owner", "--no-privileges", "--file", temporary], {
        env: { ...process.env, PGDATABASE: pgDumpUrl },
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
      });
      if (!fs.statSync(temporary).size) throw new Error("Backup SQL vazio");
      fs.renameSync(temporary, outFile);
      return { ok: true, file: outFile, type: "sql", command };
    } catch (_) {
      fs.rmSync(`${outFile}.partial`, { force: true });
      // Only completed files are listed as backups. Try the next candidate.
    }
  }

  return { ok: false, reason: "pg_dump nao encontrado ou falhou" };
}

async function runJsonFallback(outFile) {
  const data = {};
  const models = Prisma.dmmf.datamodel.models
    .map((model) => model.name)
    .sort((a, b) => a.localeCompare(b));

  await prisma.$transaction(async tx => {
    for (const modelName of models) {
      const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
      const delegate = tx[delegateName];
      if (!delegate?.findMany) throw new Error("Modelo indisponível para exportação");
      data[modelName] = await delegate.findMany();
    }
  }, { isolationLevel: "RepeatableRead", timeout: 120000 });

  const temporary = `${outFile}.partial`;
  try {
    fs.writeFileSync(temporary, JSON.stringify({
    createdAt: new Date().toISOString(),
    format: "prisma-json-fallback",
    data,
    }, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2), { mode: 0o600 });
    fs.renameSync(temporary, outFile);
  } finally {
    fs.rmSync(temporary, { force: true });
  }

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
  const stamp = `${timestamp()}-${randomUUID()}`;
  const sqlFile = path.join(dir, `cristalwater-db-${stamp}.sql`);
  const jsonFile = path.join(dir, `cristalwater-db-${stamp}.json`);

  const backup = await runPgDump(databaseUrl, sqlFile);
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
    backupHealth: require("./backupHealthService").inspectBackups({directory:backupDir}),
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
