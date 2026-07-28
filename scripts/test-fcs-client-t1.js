const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const bcrypt = require("bcryptjs");
const { prisma } = require("../src/prismaClient");

const ROOT = path.join(__dirname, "..");
const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const REPORT_PATH = path.join(ROOT, "reports", `fcs-client-t1-${Date.now()}.json`);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function compactOutput(out) {
  return String(out || "").trim().split("\n").slice(-8).join(" | ");
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

function runSemanticWithReportRetry(scriptRelativePath, reportPath, timeoutMs, retries = 1) {
  let run = null;
  let report = null;
  let pass = false;
  let attempts = 0;

  for (let i = 0; i <= retries; i += 1) {
    attempts += 1;
    const startedAt = Date.now();
    run = runNodeScript(scriptRelativePath, timeoutMs);
    report = readJsonSafe(reportPath);
    let reportFresh = false;
    try {
      reportFresh = fs.statSync(reportPath).mtimeMs >= startedAt - 2000;
    } catch (_) {
      reportFresh = false;
    }
    pass = Boolean(run.ok && reportFresh && report?.pass);
    if (pass) break;
  }

  return { run, report, pass, attempts };
}

async function requestJson(method, endpoint, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text };
  }
  return { status: response.status, ok: response.ok, data };
}

async function verifyClientScopeIsolation() {
  const marker = `CLIENT_SCOPE_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const password = "ClientScope123!";
  const hash = await bcrypt.hash(password, 10);
  const created = { clientA: null, clientB: null };

  try {
    const clientA = await prisma.client.create({
      data: {
        name: `QA ${marker} A`,
        email: `${marker.toLowerCase()}a@qa-client-scope.test`,
        password: hash,
        active: true,
        status: "ACTIVE",
      },
    });
    created.clientA = clientA.id;

    const clientB = await prisma.client.create({
      data: {
        name: `QA ${marker} B`,
        email: `${marker.toLowerCase()}b@qa-client-scope.test`,
        password: hash,
        active: true,
        status: "ACTIVE",
      },
    });
    created.clientB = clientB.id;

    const loginA = await requestJson("POST", "/api/client-auth/login", { email: clientA.email, password });
    if (!loginA.ok || !loginA.data?.token) {
      return { ok: false, detail: `loginA status=${loginA.status}` };
    }

    const ownDashboard = await requestJson("GET", `/api/client-portal/${clientA.id}/dashboard`, undefined, loginA.data.token);
    const foreignDashboard = await requestJson("GET", `/api/client-portal/${clientB.id}/dashboard`, undefined, loginA.data.token);

    const pass = ownDashboard.status === 200 && [401, 403, 404].includes(foreignDashboard.status);
    const detail = `own=${ownDashboard.status}; foreign=${foreignDashboard.status}`;
    return { ok: pass, detail };
  } finally {
    if (created.clientA) {
      await prisma.clientMessage.deleteMany({ where: { clientId: created.clientA } }).catch(() => null);
      await prisma.notification.deleteMany({ where: { clientId: created.clientA } }).catch(() => null);
      await prisma.communicationLog.deleteMany({ where: { clientId: created.clientA } }).catch(() => null);
      await prisma.client.deleteMany({ where: { id: created.clientA } }).catch(() => null);
    }
    if (created.clientB) {
      await prisma.clientMessage.deleteMany({ where: { clientId: created.clientB } }).catch(() => null);
      await prisma.notification.deleteMany({ where: { clientId: created.clientB } }).catch(() => null);
      await prisma.communicationLog.deleteMany({ where: { clientId: created.clientB } }).catch(() => null);
      await prisma.client.deleteMany({ where: { id: created.clientB } }).catch(() => null);
    }
  }
}

(async function main() {
  ensureDir(REPORT_PATH);

  const checks = [];
  const runs = [];

  const syntax = runNodeScript("scripts/check-syntax.js", 180000);
  runs.push(syntax);
  pushCheck(checks, "syntax", syntax.ok, `exit=${syntax.status}; ${compactOutput(syntax.stdout || syntax.stderr)}`);

  const customerOperational = runNodeScript("scripts/test-customer-os-operational.js", 300000);
  runs.push(customerOperational);
  pushCheck(
    checks,
    "customer-os-operational",
    customerOperational.ok && customerOperational.stdout.includes("\"ok\": true"),
    `exit=${customerOperational.status}; ${compactOutput(customerOperational.stdout || customerOperational.stderr)}`
  );

  const clientPaymentsResult = runSemanticWithReportRetry(
    "scripts/test-fcs14-client-payments-semantics.js",
    path.join(ROOT, "docs", "product", "FCS14_CLIENT_PAYMENTS_SEMANTICS.json"),
    300000,
    1
  );
  const clientPaymentsSemantics = clientPaymentsResult.run;
  const paymentsReport = clientPaymentsResult.report;
  runs.push({ ...clientPaymentsSemantics, attempts: clientPaymentsResult.attempts });
  pushCheck(
    checks,
    "fcs14-client-payments-semantics",
    clientPaymentsResult.pass,
    `exit=${clientPaymentsSemantics.status}; reportPass=${Boolean(paymentsReport?.pass)}; attempts=${clientPaymentsResult.attempts}`
  );

  const financeAcceptance = runNodeScript("scripts/test-finance-os-acceptance.js", 300000);
  runs.push(financeAcceptance);
  pushCheck(
    checks,
    "finance-os-acceptance",
    financeAcceptance.ok && financeAcceptance.stdout.includes("\"ok\": true"),
    `exit=${financeAcceptance.status}; ${compactOutput(financeAcceptance.stdout || financeAcceptance.stderr)}`
  );

  const scopeIsolation = await verifyClientScopeIsolation();
  pushCheck(checks, "client-portal-scope-isolation", scopeIsolation.ok, scopeIsolation.detail);

  const passed = checks.filter((item) => item.pass).length;
  const total = checks.length;
  const mri = total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const ok = checks.every((item) => item.pass) && mri >= 95;

  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    mission: "CLIENT_T1",
    baseUrl: BASE_URL,
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
      clientPaymentsSemantics: "docs/product/FCS14_CLIENT_PAYMENTS_SEMANTICS.json",
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`MRI=${mri}`);
  console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);

  await prisma.$disconnect().catch(() => null);
  if (!ok) process.exitCode = 1;
})();
