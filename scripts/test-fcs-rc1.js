const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "reports", `fcs-rc1-${Date.now()}.json`);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function compactOutput(out) {
  return String(out || "").trim().split("\n").slice(-10).join(" | ");
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

function pushCheck(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

(function main() {
  ensureDir(REPORT_PATH);

  const checks = [];
  const runs = [];

  const plan = [
    { id: "syntax", command: "node scripts/check-syntax.js", timeoutMs: 180000 },
    { id: "technician-t1", command: "npm run test:fcs-tech-t1", timeoutMs: 420000 },
    { id: "admin-t1", command: "npm run test:fcs-admin-t1", timeoutMs: 420000 },
    { id: "client-t1", command: "npm run test:fcs-client-t1", timeoutMs: 420000 },
    { id: "alert-engine-t1", command: "npm run test:fcs-alert-engine-t1", timeoutMs: 420000 },
    { id: "ia-t1", command: "npm run test:fcs-ia-t1", timeoutMs: 420000 },
    { id: "system-interconnections", command: "node scripts/test-system-interconnections.js", timeoutMs: 420000 },
    { id: "zero-bugs-backend-security", command: "node scripts/test-zero-bugs-backend-security.js", timeoutMs: 420000 },
    { id: "readiness", command: "node scripts/test-readiness.js", timeoutMs: 300000 },
    { id: "preflight-static-v22", command: "node scripts/preflight-static-v22.js", timeoutMs: 180000 },
  ];

  for (const item of plan) {
    console.log(`[RC1] START ${item.id}: ${item.command}`);
    const run = runCommand(item.command, item.timeoutMs);
    runs.push(run);
    console.log(`[RC1] END ${item.id}: ok=${run.ok}; status=${run.status}; timeout=${run.timeout}; ms=${run.runtimeMs}`);
    pushCheck(checks, item.id, run.ok, `exit=${run.status}; timeout=${run.timeout}; ${compactOutput(run.stdout || run.stderr)}`);
  }

  const passed = checks.filter((item) => item.pass).length;
  const total = checks.length;
  const mri = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const ok = checks.every((item) => item.pass) && mri >= 95;

  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    mission: "RC1",
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
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`MRI=${mri}`);
  console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);

  if (!ok) process.exitCode = 1;
})();
