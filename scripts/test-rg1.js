const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "reports", `rg1-${Date.now()}.json`);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return null;
  }
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

function compactOutput(out) {
  return String(out || "").trim().split("\n").slice(-8).join(" | ");
}

function pushCheck(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

function gitExactTag(tagName) {
  const result = spawnSync("git", ["tag", "--list", tagName], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  return result.status === 0 && String(result.stdout || "").split("\n").map((item) => item.trim()).includes(tagName);
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return "";
  }
}

function statusLineMatches(filePath, expected) {
  const text = readTextSafe(filePath);
  return new RegExp(`^Status:\\s*${expected}\\s*$`, "mi").test(text);
}

(function main() {
  ensureDir(REPORT_PATH);

  const checks = [];
  const reportsDir = path.join(ROOT, "reports");
  const pkg = readJsonSafe(path.join(ROOT, "package.json")) || {};
  const version = String(pkg.version || "").trim();
  const releaseTag = process.env.RELEASE_TAG || (version ? `v${version}` : "");

  const rc1Artifact = latestPassingReport(reportsDir, "fcs-rc1-");
  const rc1Report = rc1Artifact?.report || null;
  pushCheck(checks, "rc1-baseline-intact", Boolean(rc1Report?.ok), rc1Artifact ? `${rc1Artifact.name}; MRI=${rc1Report?.totals?.mri ?? "-"}` : "missing");

  const pr1Artifact = latestPassingReport(reportsDir, "pr1-");
  const pr1Report = pr1Artifact?.report || null;
  pushCheck(checks, "pr1-pass", Boolean(pr1Report?.ok), pr1Artifact ? `${pr1Artifact.name}; MRI=${pr1Report?.totals?.mri ?? "-"}` : "missing");

  const backupsDir = path.join(ROOT, "backups");
  const backupFiles = fs.existsSync(backupsDir)
    ? fs.readdirSync(backupsDir).filter((name) => /\.(sql|json|dump)$/i.test(name))
    : [];
  pushCheck(checks, "backup-artifacts-present", backupFiles.length > 0, `${backupFiles.length} artifact(s)`);

  const requiredEvidence = [
    "README_VPS_DEPLOY.md",
    "PRODUCTION_READINESS_PHASE.md",
    "PRODUCTION_READY_REPORT.md",
    "PRODUCTION_CLEAN_PLAN.md",
    "PRODUCTION_CLEAN_SAFETY_REPORT.md",
    "docs/SAFE_RELEASE_AND_ROLLBACK.md",
    "docs/RELEASE_RESTORE_DRILL_REPORT.md",
    "docs/RELEASE_HYPERCARE_PLAN.md",
    "VERSION.txt",
  ];
  const missingEvidence = requiredEvidence.filter((relativePath) => !fs.existsSync(path.join(ROOT, relativePath)));
  pushCheck(checks, "evidence-archived", missingEvidence.length === 0, missingEvidence.length ? missingEvidence.join(", ") : "all-present");

  const restoreDrillFile = path.join(ROOT, "docs", "RELEASE_RESTORE_DRILL_REPORT.md");
  pushCheck(
    checks,
    "restore-drill-evidence",
    statusLineMatches(restoreDrillFile, "EXECUTED"),
    fs.existsSync(restoreDrillFile) ? "awaiting Status: EXECUTED" : "missing"
  );

  const hypercareFile = path.join(ROOT, "docs", "RELEASE_HYPERCARE_PLAN.md");
  pushCheck(
    checks,
    "hypercare-approved",
    statusLineMatches(hypercareFile, "APPROVED"),
    fs.existsSync(hypercareFile) ? "awaiting Status: APPROVED" : "missing"
  );

  pushCheck(checks, "version-identified", Boolean(version), version || "missing-package-version");
  pushCheck(checks, "git-tag-present", Boolean(releaseTag) && gitExactTag(releaseTag), releaseTag || "missing-release-tag");

  const manualChecklist = [
    "all critical bugs resolved",
    "no known blocking bugs",
    "rollback operator assigned",
    "production window approved",
  ];

  const passed = checks.filter((item) => item.pass).length;
  const total = checks.length;
  const mri = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const ok = checks.every((item) => item.pass) && mri >= 95;

  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    mission: "RG1",
    baseline: "RC1",
    version,
    releaseTag,
    totals: {
      checks: total,
      passed,
      failed: total - passed,
      mri,
      threshold: 95,
    },
    checks,
    manualChecklist,
    artifacts: {
      rc1: rc1Artifact ? path.relative(ROOT, rc1Artifact.path) : null,
      pr1: pr1Artifact ? path.relative(ROOT, pr1Artifact.path) : null,
      restoreDrill: fs.existsSync(restoreDrillFile) ? path.relative(ROOT, restoreDrillFile) : null,
      hypercarePlan: fs.existsSync(hypercareFile) ? path.relative(ROOT, hypercareFile) : null,
      backups: backupFiles.slice(-10),
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`MRI=${mri}`);
  console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);
  if (!ok) {
    console.log(`MANUAL_CHECKLIST=${compactOutput(manualChecklist.join("\n"))}`);
    process.exitCode = 1;
  }
})();