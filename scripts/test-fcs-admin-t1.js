const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "reports", `fcs-admin-t1-${Date.now()}.json`);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function runNodeScript(scriptRelativePath, timeoutMs) {
  const scriptPath = path.join(ROOT, scriptRelativePath);
  const startedAt = Date.now();
  const proc = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 20,
  });

  return {
    script: scriptRelativePath,
    ok: proc.status === 0,
    status: proc.status,
    signal: proc.signal || null,
    timeout: Boolean(proc.error && proc.error.code === "ETIMEDOUT"),
    runtimeMs: Date.now() - startedAt,
    stdout: String(proc.stdout || ""),
    stderr: String(proc.stderr || ""),
    error: proc.error ? String(proc.error.message || proc.error) : null,
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

function compactOutput(out) {
  return String(out || "").trim().split("\n").slice(-8).join(" | ");
}

function check(id, pass, detail, checks) {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

function execShell(command) {
  return spawnSync(command, {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
}

function runSemanticWithReportRetry(scriptRelativePath, reportPath, timeoutMs, retries = 1) {
  let run = null;
  let report = null;
  let pass = false;
  let attempts = 0;

  for (let i = 0; i <= retries; i += 1) {
    attempts += 1;
    run = runNodeScript(scriptRelativePath, timeoutMs);
    report = readJsonSafe(reportPath);
    pass = Boolean(run.ok && report?.pass);
    if (pass) break;
  }

  return { run, report, pass, attempts };
}

(function main() {
  ensureDir(REPORT_PATH);

  const checks = [];
  const runs = [];

  const syntax = runNodeScript("scripts/check-syntax.js", 180000);
  runs.push(syntax);
  check("syntax", syntax.ok, `exit=${syntax.status}; ${compactOutput(syntax.stdout || syntax.stderr)}`, checks);

  const adminLogin = runNodeScript("scripts/test-admin-login-alias.js", 120000);
  runs.push(adminLogin);
  check("admin-login-alias", adminLogin.ok, `exit=${adminLogin.status}; ${compactOutput(adminLogin.stdout || adminLogin.stderr)}`, checks);

  const adminOperational = runNodeScript("scripts/test-administration-os-operational.js", 240000);
  runs.push(adminOperational);
  check(
    "administration-os-operational",
    adminOperational.ok && adminOperational.stdout.includes("ADMINISTRATION OS OPERATIONAL ACCEPTANCE OK"),
    `exit=${adminOperational.status}; ${compactOutput(adminOperational.stdout || adminOperational.stderr)}`,
    checks
  );

  const adminServiceLog = runNodeScript("scripts/test-fcs14-admin-service-log-semantics.js", 300000);
  runs.push(adminServiceLog);
  const adminServiceReport = readJsonSafe(path.join(ROOT, "docs", "product", "FCS14_ADMIN_SERVICE_LOG_SEMANTICS.json"));
  check(
    "admin-service-log-semantics",
    adminServiceLog.ok && Boolean(adminServiceReport?.pass),
    `exit=${adminServiceLog.status}; reportPass=${Boolean(adminServiceReport?.pass)}`,
    checks
  );

  const clientPaymentsResult = runSemanticWithReportRetry(
    "scripts/test-fcs14-client-payments-semantics.js",
    path.join(ROOT, "docs", "product", "FCS14_CLIENT_PAYMENTS_SEMANTICS.json"),
    300000,
    1
  );
  const clientPayments = clientPaymentsResult.run;
  const clientPaymentsReport = clientPaymentsResult.report;
  runs.push({ ...clientPayments, attempts: clientPaymentsResult.attempts });
  check(
    "client-payments-semantics",
    clientPaymentsResult.pass,
    `exit=${clientPayments.status}; reportPass=${Boolean(clientPaymentsReport?.pass)}; attempts=${clientPaymentsResult.attempts}`,
    checks
  );

  const secureStartedAt = Date.now();
  const secureAuth = runNodeScript("scripts/test-secure-auth-matrix.js", 180000);
  runs.push(secureAuth);

  if (secureAuth.timeout) {
    execShell('pkill -f "node scripts/test-secure-auth-matrix.js" || true');
  }

  const latestSecure = latestByPrefix(path.join(ROOT, "reports"), "secure-auth-matrix-");
  const secureReport = latestSecure ? readJsonSafe(latestSecure.path) : null;
  const secureIsFresh = Boolean(latestSecure && latestSecure.mtimeMs >= secureStartedAt - 5000);

  check(
    "secure-auth-backend-matrix",
    secureIsFresh && Boolean(secureReport?.assertions?.backendPass),
    `fresh=${secureIsFresh}; backendPass=${Boolean(secureReport?.assertions?.backendPass)}`,
    checks
  );
  check(
    "secure-auth-revocation",
    secureIsFresh && Boolean(secureReport?.assertions?.controlledRevocationPass),
    `fresh=${secureIsFresh}; revocationPass=${Boolean(secureReport?.assertions?.controlledRevocationPass)}`,
    checks
  );
  check(
    "secure-auth-report-sanitization",
    secureIsFresh && Boolean(secureReport?.reportSanitization?.pass),
    `fresh=${secureIsFresh}; sanitizationPass=${Boolean(secureReport?.reportSanitization?.pass)}`,
    checks
  );
  check(
    "secure-auth-token-expiration-window",
    secureIsFresh && Boolean(secureReport?.tokenExposureAssessment?.allExpired),
    `fresh=${secureIsFresh}; allExpired=${Boolean(secureReport?.tokenExposureAssessment?.allExpired)}`,
    checks
  );

  const sanitizeCheck = runNodeScript("scripts/test-security-report-sanitization.js", 120000);
  runs.push(sanitizeCheck);
  check("security-report-sanitization", sanitizeCheck.ok, `exit=${sanitizeCheck.status}; ${compactOutput(sanitizeCheck.stdout || sanitizeCheck.stderr)}`, checks);

  const passed = checks.filter((item) => item.pass).length;
  const total = checks.length;
  const mri = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const ok = checks.every((item) => item.pass) && mri >= 95;

  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    mission: "ADMIN_T1",
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
      adminServiceLog: "docs/product/FCS14_ADMIN_SERVICE_LOG_SEMANTICS.json",
      clientPayments: "docs/product/FCS14_CLIENT_PAYMENTS_SEMANTICS.json",
      secureAuthMatrix: latestSecure ? path.relative(ROOT, latestSecure.path) : null,
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`MRI=${mri}`);
  console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);

  if (!ok) process.exitCode = 1;
})();
