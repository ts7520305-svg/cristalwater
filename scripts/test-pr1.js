const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "reports", `pr1-${Date.now()}.json`);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function compactOutput(out) {
  return String(out || "").trim().split("\n").slice(-12).join(" | ");
}

function runCommand(command, timeoutMs) {
  const startedAt = Date.now();
  const result = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 20,
  });

  return {
    command,
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || null,
    timeout: Boolean(result.error && result.error.code === "ETIMEDOUT"),
    runtimeMs: Date.now() - startedAt,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    error: result.error ? String(result.error.message || result.error) : null,
  };
}

function latestByPrefix(dirPath, prefix) {
  if (!fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => ({
      name,
      path: path.join(dirPath, name),
      mtimeMs: fs.statSync(path.join(dirPath, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0] || null;
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return null;
  }
}

function pushCheck(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

function latestPassingReport(dirPath, prefix) {
  if (!fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => ({
      name,
      path: path.join(dirPath, name),
      mtimeMs: fs.statSync(path.join(dirPath, name)).mtimeMs,
      report: readJsonSafe(path.join(dirPath, name)),
    }))
    .filter((entry) => entry.report && entry.report.ok === true)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0] || null;
}

(function main() {
  ensureDir(REPORT_PATH);

  const checks = [];
  const runs = [];
  const reportsDir = path.join(ROOT, "reports");

  const syntax = runCommand("node scripts/check-syntax.js", 180000);
  runs.push(syntax);
  pushCheck(checks, "syntax", syntax.ok, `exit=${syntax.status}; ${compactOutput(syntax.stdout || syntax.stderr)}`);

  const rc1Artifact = latestPassingReport(reportsDir, "fcs-rc1-");
  const rc1Report = rc1Artifact?.report || null;
  pushCheck(
    checks,
    "rc1-baseline",
    Boolean(rc1Report?.ok && Number(rc1Report?.totals?.mri || 0) >= 95),
    rc1Artifact ? `${rc1Artifact.name}; MRI=${rc1Report?.totals?.mri ?? "-"}` : "missing-pass-artifact"
  );

  const prismaValidate = runCommand("npx prisma validate", 180000);
  runs.push(prismaValidate);
  pushCheck(checks, "prisma-validate", prismaValidate.ok, `exit=${prismaValidate.status}; ${compactOutput(prismaValidate.stdout || prismaValidate.stderr)}`);

  const readiness = runCommand("node scripts/test-readiness.js", 180000);
  runs.push(readiness);
  pushCheck(checks, "readiness-static", readiness.ok, `exit=${readiness.status}; ${compactOutput(readiness.stdout || readiness.stderr)}`);

  const vpsPreflight = runCommand("node scripts/preflight-vps.js", 180000);
  runs.push(vpsPreflight);
  pushCheck(checks, "installation-update-preflight", vpsPreflight.ok, `exit=${vpsPreflight.status}; ${compactOutput(vpsPreflight.stdout || vpsPreflight.stderr)}`);

  const runtimeHealth = runCommand("node scripts/test-production-runtime-health.js", 180000);
  runs.push(runtimeHealth);
  pushCheck(checks, "runtime-performance-health", runtimeHealth.ok, `exit=${runtimeHealth.status}; ${compactOutput(runtimeHealth.stdout || runtimeHealth.stderr)}`);

  const smoke = runCommand("node scripts/smoke-test.js", 180000);
  runs.push(smoke);
  const smokeOutput = `${smoke.stdout}\n${smoke.stderr}`;
  pushCheck(checks, "operational-smoke", smoke.ok, `exit=${smoke.status}; ${compactOutput(smokeOutput)}`);

  const security = runCommand("node scripts/test-zero-bugs-backend-security.js", 420000);
  runs.push(security);
  pushCheck(checks, "security-validation", security.ok, `exit=${security.status}; ${compactOutput(security.stdout || security.stderr)}`);

  const backupStartedAt = Date.now();
  const backup = runCommand("node scripts/backup-database.js", 420000);
  runs.push(backup);
  const latestBackup = latestByPrefix(path.join(ROOT, "backups"), "cristalwater-db-");
  const backupReport = (() => {
    try {
      return JSON.parse((backup.stdout || "{}").trim());
    } catch (_) {
      return null;
    }
  })();
  const backupFresh = Boolean(latestBackup && latestBackup.mtimeMs >= backupStartedAt - 5000);
  const backupFileExists = Boolean(backupReport?.backup?.file && fs.existsSync(backupReport.backup.file));
  pushCheck(
    checks,
    "backup-created",
    backup.ok && backupFresh && backupFileExists,
    `exit=${backup.status}; fresh=${backupFresh}; file=${backupReport?.backup?.name || latestBackup?.name || "-"}`
  );

  const logDir = path.join(ROOT, "logs");
  const logFiles = fs.existsSync(logDir)
    ? fs.readdirSync(logDir).filter((name) => name.endsWith(".log"))
    : [];
  pushCheck(
    checks,
    "monitoring-logs-active",
    fs.existsSync(path.join(ROOT, "ecosystem.config.js")) && logFiles.length > 0,
    `ecosystem=${fs.existsSync(path.join(ROOT, "ecosystem.config.js"))}; logFiles=${logFiles.length}`
  );

  const requiredArtifacts = [
    "README_VPS_DEPLOY.md",
    "PRODUCTION_READY_REPORT.md",
    "PRODUCTION_CLEAN_PLAN.md",
    "PRODUCTION_CLEAN_SAFETY_REPORT.md",
    "PRODUCTION_READINESS_PHASE.md",
    "docs/SAFE_RELEASE_AND_ROLLBACK.md",
  ];
  const missingArtifacts = requiredArtifacts.filter((relativePath) => !fs.existsSync(path.join(ROOT, relativePath)));
  pushCheck(checks, "rollback-evidence-runbooks", missingArtifacts.length === 0, missingArtifacts.length ? missingArtifacts.join(", ") : "all-present");

  const passed = checks.filter((item) => item.pass).length;
  const total = checks.length;
  const mri = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const ok = checks.every((item) => item.pass) && mri >= 95;

  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    mission: "PR1",
    baseline: "RC1",
    totals: {
      checks: total,
      passed,
      failed: total - passed,
      mri,
      threshold: 95,
    },
    checks,
    runs: runs.map((run) => ({
      command: run.command,
      ok: run.ok,
      status: run.status,
      signal: run.signal,
      timeout: run.timeout,
      runtimeMs: run.runtimeMs,
      stdoutTail: compactOutput(run.stdout),
      stderrTail: compactOutput(run.stderr),
      error: run.error,
    })),
    artifacts: {
      rc1Baseline: rc1Artifact ? path.relative(ROOT, rc1Artifact.path) : null,
      latestBackup: latestBackup ? path.relative(ROOT, latestBackup.path) : null,
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`MRI=${mri}`);
  console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);

  if (!ok) process.exitCode = 1;
})();