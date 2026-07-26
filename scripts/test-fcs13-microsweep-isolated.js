const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

require("../src/loadEnv")();

const ROOT = path.join(__dirname, "..");
const OUT_JSON = path.join(ROOT, "docs", "product", "FCS13_MICROSWEEP_ISOLATED.json");
const OUT_MD = path.join(ROOT, "docs", "product", "FCS13_MICROSWEEP_ISOLATED.md");
const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";

const VIEWPORTS = ["desktop", "390x844"];
const FLOWS = [
  { key: "create-client", name: "Criar cliente" },
  { key: "create-pool", name: "Criar piscina" },
  { key: "schedule-visit", name: "Agendar visita" },
  { key: "create-repair", name: "Criar reparação" },
  { key: "issue-invoice", name: "Emitir fatura" },
  { key: "create-product", name: "Criar produto" },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function freeMemSnapshot() {
  return new Promise((resolve, reject) => {
    const child = spawn("free", ["-m"], { cwd: ROOT });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("close", () => resolve(output.trim()));
  });
}

function diskSnapshot() {
  return new Promise((resolve, reject) => {
    const child = spawn("df", ["-h", ROOT], { cwd: ROOT });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("close", () => resolve(output.trim()));
  });
}

function killOrphans() {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-lc", "pkill -9 -f 'test-fcs13-microsweep-six-flows.js' || true; pkill -9 -f 'playwright_chromiumdev_profile-' || true; pkill -9 -f 'chrome-headless-shell' || true"], { cwd: ROOT });
    child.on("error", reject);
    child.on("close", () => resolve());
  });
}

function extractJsonBlock(text) {
  const lines = String(text || "").trim().split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim().startsWith("{")) continue;
    const candidate = lines.slice(index).join("\n");
    try {
      return JSON.parse(candidate);
    } catch (_) {
      continue;
    }
  }
  return null;
}

function runCase(flow, viewport) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      FCS13_FLOW_KEY: flow.key,
      FCS13_VIEWPORT: viewport,
    };

    const child = spawn("node", [path.join("scripts", "test-fcs13-microsweep-six-flows.js")], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); process.stdout.write(chunk); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); process.stderr.write(chunk); });

    child.on("close", async (code, signal) => {
      const parsed = extractJsonBlock(stdout) || extractJsonBlock(stderr);
      const row = parsed?.rows?.[0] || null;
      resolve({
        flow: flow.name,
        flowKey: flow.key,
        viewport,
        exitCode: code,
        signal: signal || null,
        pass: Boolean(row?.pass),
        consoleErrors: row?.consoleErrors || [],
        apiErrors: row?.apiErrors || [],
        row,
        rawStdout: stdout,
        rawStderr: stderr,
      });
    });
  });
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# FCS-1.3 - Microsweep Isolado");
  lines.push("");
  lines.push(`Data: ${report.generatedAt}`);
  lines.push(`Base URL: ${report.baseUrl}`);
  lines.push("");
  lines.push("## Ambiente");
  lines.push("```text");
  lines.push(report.memoryBefore);
  lines.push(report.diskBefore);
  lines.push(report.memoryAfter);
  lines.push(report.diskAfter);
  lines.push("```");
  lines.push("");
  lines.push("| Fluxo | Viewport | PASS | Exit | Console | API 4xx/5xx | RunId |\n|---|---|---|---:|---:|---:|---|");
  for (const item of report.results) {
    lines.push(`| ${item.flow} | ${item.viewport} | ${item.pass ? "PASS" : "FAIL"} | ${item.exitCode} | ${item.consoleErrors.length} | ${item.apiErrors.length} | ${report.runId} |`);
  }
  return lines.join("\n");
}

async function main() {
  const runId = `FCS13ISO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const memoryBefore = await freeMemSnapshot();
  const diskBefore = await diskSnapshot();
  await killOrphans();

  const results = [];
  for (const viewport of VIEWPORTS) {
    for (const flow of FLOWS) {
      const item = await runCase(flow, viewport);
      results.push(item);
      await killOrphans();
    }
  }

  const memoryAfter = await freeMemSnapshot();
  const diskAfter = await diskSnapshot();

  const report = {
    runId,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    memoryBefore,
    diskBefore,
    memoryAfter,
    diskAfter,
    results,
    pass: results.every((item) => item.pass && item.exitCode === 0),
  };

  ensureDir(OUT_JSON);
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(OUT_MD, buildMarkdown(report));

  console.log(JSON.stringify({
    ok: true,
    runId,
    pass: report.pass,
    total: results.length,
    passCount: results.filter((item) => item.pass && item.exitCode === 0).length,
    failCount: results.filter((item) => !item.pass || item.exitCode !== 0).length,
    outJson: path.relative(ROOT, OUT_JSON),
    outMd: path.relative(ROOT, OUT_MD),
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
