require("../src/loadEnv")();

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["warn", "error"] });

const reportDir = path.resolve(__dirname, "..", "reports");
fs.mkdirSync(reportDir, { recursive: true });

const runId = `FIELD_RESET_${Date.now()}`;
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const adminName = process.env.ADMIN_NAME || "Cristal Water Admin";

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function tableCounts(tx) {
  const rows = await tx.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  const counts = {};
  for (const row of rows) {
    const table = row.tablename;
    if (table === "_prisma_migrations") continue;
    const result = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(table)}`);
    counts[table] = Number(result?.[0]?.count || 0);
  }
  return counts;
}

function backupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return { ok: false, reason: "DATABASE_URL em falta" };

  let pgDumpUrl = databaseUrl;
  try {
    const parsed = new URL(databaseUrl);
    const keep = new URLSearchParams();
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      const value = parsed.searchParams.get(key);
      if (value) keep.set(key, value);
    }
    parsed.search = keep.toString();
    pgDumpUrl = parsed.toString();
  } catch (_) {
    pgDumpUrl = databaseUrl.split("?")[0];
  }

  const candidates = [
    process.env.PG_DUMP_PATH,
    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
    "pg_dump",
  ].filter(Boolean);

  const outFile = path.join(reportDir, `backup-before-${runId}.sql`);
  for (const command of candidates) {
    try {
      execFileSync(command, ["--no-owner", "--no-privileges", "--file", outFile, pgDumpUrl], {
        stdio: "pipe",
        windowsHide: true,
      });
      return { ok: true, file: outFile, command };
    } catch (_) {
      // Try the next possible pg_dump location.
    }
  }
  return { ok: false, reason: "pg_dump nao encontrado ou falhou" };
}

async function ensureAdmin(tx) {
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD sao obrigatorios para manter o administrador.");
  }

  const password = await bcrypt.hash(adminPassword, 12);
  return tx.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      password,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: adminEmail,
      name: adminName,
      password,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
    },
  });
}

async function resetOperationalData() {
  const backup = backupDatabase();

  const result = await prisma.$transaction(async (tx) => {
    const before = await tableCounts(tx);
    const admin = await ensureAdmin(tx);

    const tables = await tx.$queryRaw`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    const preserved = new Set(["_prisma_migrations", "User"]);
    const targets = tables
      .map((row) => row.tablename)
      .filter((name) => !preserved.has(name));

    if (targets.length) {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${targets.map(quoteIdent).join(", ")} RESTART IDENTITY CASCADE`);
    }

    await tx.user.deleteMany({ where: { id: { not: admin.id } } });
    const keptAdmin = await ensureAdmin(tx);
    const after = await tableCounts(tx);
    return { before, after, admin: { id: keptAdmin.id, email: keptAdmin.email, role: keptAdmin.role } };
  }, { timeout: 60000, maxWait: 10000 });

  const report = {
    runId,
    createdAt: new Date().toISOString(),
    backup,
    adminKept: result.admin,
    before: result.before,
    after: result.after,
  };

  const reportFile = path.join(reportDir, `reset-field-simulation-${runId}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`RESET_OK ${runId}`);
  console.log(`Administrador mantido: ${result.admin.email}`);
  console.log(`Backup: ${backup.ok ? backup.file : backup.reason}`);
  console.log(`Relatorio: ${reportFile}`);
}

resetOperationalData()
  .catch((error) => {
    console.error(`RESET_FAILED ${runId}: ${error.message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
