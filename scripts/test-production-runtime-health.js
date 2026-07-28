require("../src/loadEnv")();

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "reports", `production-runtime-health-${Date.now()}.json`);
const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`;

const endpoints = [
  { id: "system-health", path: "/api/system/health", expected: [200], maxMs: 2500 },
  { id: "system-version", path: "/api/system/version", expected: [200], maxMs: 2500 },
  { id: "system-modules", path: "/api/system/modules", expected: [200], maxMs: 2500 },
  { id: "dashboard-metrics", path: "/api/dashboard/metrics", expected: [200, 401, 403], maxMs: 5000 },
  { id: "core-dashboard", path: "/api/core/dashboard", expected: [200, 401, 403], maxMs: 5000 },
  { id: "gps-live", path: "/api/gps/live", expected: [200, 401, 403], maxMs: 5000 },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function hitEndpoint(target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${target.path}`, { signal: controller.signal });
    const text = await response.text();
    const runtimeMs = Date.now() - startedAt;
    const pass = target.expected.includes(response.status) && runtimeMs <= target.maxMs;
    return {
      id: target.id,
      path: target.path,
      status: response.status,
      ok: response.ok,
      runtimeMs,
      maxMs: target.maxMs,
      expected: target.expected,
      pass,
      bodyPreview: String(text || "").slice(0, 180),
    };
  } catch (error) {
    return {
      id: target.id,
      path: target.path,
      status: 0,
      ok: false,
      runtimeMs: Date.now() - startedAt,
      maxMs: target.maxMs,
      expected: target.expected,
      pass: false,
      bodyPreview: "",
      error: String(error && error.message ? error.message : error),
    };
  } finally {
    clearTimeout(timer);
  }
}

(async function main() {
  ensureDir(REPORT_PATH);

  const results = [];
  for (const endpoint of endpoints) {
    const result = await hitEndpoint(endpoint);
    results.push(result);
    console.log(`${result.pass ? "OK" : "FAIL"} ${result.id} status=${result.status} ms=${result.runtimeMs}/${result.maxMs}`);
  }

  const passed = results.filter((item) => item.pass).length;
  const total = results.length;
  const ok = passed === total;

  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    gate: "PRODUCTION_RUNTIME_HEALTH",
    baseUrl: BASE_URL,
    totals: {
      checks: total,
      passed,
      failed: total - passed,
    },
    results,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`RESULT=${ok ? "PASS" : "FAIL"}`);

  if (!ok) process.exitCode = 1;
})();