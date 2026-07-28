const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "reports", `fcs-alert-engine-t1-${Date.now()}.json`);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function compactOutput(out) {
  return String(out || "").trim().split("\n").slice(-10).join(" | ");
}

function runNodeScript(scriptRelativePath, timeoutMs) {
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [path.join(ROOT, scriptRelativePath)], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 20,
  });

  return {
    script: scriptRelativePath,
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

function runWithRetry(scriptRelativePath, timeoutMs, retries = 0) {
  const attempts = [];
  for (let i = 0; i <= retries; i += 1) {
    const run = runNodeScript(scriptRelativePath, timeoutMs);
    attempts.push(run);
    if (run.ok) break;
  }
  const finalRun = attempts[attempts.length - 1];
  return { finalRun, attempts };
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
    .map((name) => ({ name, path: path.join(dirPath, name), mtimeMs: fs.statSync(path.join(dirPath, name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0] || null;
}

function pushCheck(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

(function main() {
  ensureDir(REPORT_PATH);

  const checks = [];
  const runs = [];

  const syntax = runNodeScript("scripts/check-syntax.js", 180000);
  runs.push({ ...syntax, attempts: 1 });
  pushCheck(checks, "syntax", syntax.ok, `exit=${syntax.status}; ${compactOutput(syntax.stdout || syntax.stderr)}`);

  const v18 = runNodeScript("scripts/test-v18-operational-state.js", 120000);
  runs.push({ ...v18, attempts: 1 });
  pushCheck(checks, "v18-operational-state", v18.ok && v18.stdout.includes("operational state engine OK"), `exit=${v18.status}; ${compactOutput(v18.stdout || v18.stderr)}`);

  const repairOperational = runNodeScript("scripts/test-repair-os-operational.js", 300000);
  runs.push({ ...repairOperational, attempts: 1 });
  pushCheck(
    checks,
    "repair-os-operational",
    repairOperational.ok && repairOperational.stdout.includes("REPAIR OS OPERATIONAL ACCEPTANCE OK"),
    `exit=${repairOperational.status}; ${compactOutput(repairOperational.stdout || repairOperational.stderr)}`
  );

  const alertE2E = runWithRetry("scripts/test-fcs13-repair-alert-e2e.js", 360000, 1);
  runs.push({ ...alertE2E.finalRun, attempts: alertE2E.attempts.length });
  const alertE2EOutput = `${alertE2E.finalRun.stdout}\n${alertE2E.finalRun.stderr}`;
  pushCheck(
    checks,
    "fcs13-repair-alert-e2e",
    alertE2E.finalRun.ok && alertE2EOutput.includes('"ok": true'),
    `exit=${alertE2E.finalRun.status}; attempts=${alertE2E.attempts.length}; ${compactOutput(alertE2EOutput)}`
  );

  const secAuth = runNodeScript("scripts/test-fcs-sec-tech-auth.js", 360000);
  runs.push({ ...secAuth, attempts: 1 });
  const latestSecAuth = latestByPrefix(path.join(ROOT, "reports"), "fcs-sec-tech-auth-");
  const secAuthReport = latestSecAuth ? readJsonSafe(latestSecAuth.path) : null;
  pushCheck(
    checks,
    "security-tech-auth",
    secAuth.ok && Number(secAuthReport?.totals?.fail ?? 1) === 0,
    `exit=${secAuth.status}; fail=${Number(secAuthReport?.totals?.fail ?? -1)}; pass=${Number(secAuthReport?.totals?.pass ?? -1)}`
  );

  const passed = checks.filter((item) => item.pass).length;
  const total = checks.length;
  const mri = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const ok = checks.every((item) => item.pass) && mri >= 95;

  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    mission: "ALERT_ENGINE_T1",
    totals: {
      checks: total,
      passed,
      failed: total - passed,
      mri,
      threshold: 95,
    },
    checks,
    runs: runs.map((run) => ({
      script: run.script,
      ok: run.ok,
      status: run.status,
      signal: run.signal,
      timeout: run.timeout,
      runtimeMs: run.runtimeMs,
      attempts: run.attempts || 1,
      stdoutTail: compactOutput(run.stdout),
      stderrTail: compactOutput(run.stderr),
      error: run.error,
    })),
    artifacts: {
      secTechAuth: latestSecAuth ? path.relative(ROOT, latestSecAuth.path) : null,
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`MRI=${mri}`);
  console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);

  if (!ok) process.exitCode = 1;
})();
