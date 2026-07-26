const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCES = [
  {
    label: "Admin",
    route: "/admin-service-log",
    file: path.join(ROOT, "docs", "product", "FCS14_ADMIN_SERVICE_LOG_SEMANTICS.json"),
  },
  {
    label: "Technician",
    route: "/technician-route",
    file: path.join(ROOT, "docs", "product", "FCS14_TECHNICIAN_ROUTE_SEMANTICS.json"),
  },
  {
    label: "Client",
    route: "/client-payments",
    file: path.join(ROOT, "docs", "product", "FCS14_CLIENT_PAYMENTS_SEMANTICS.json"),
  },
];
const OUT_JSON = path.join(ROOT, "docs", "product", "FCS14_STATE_SEMANTIC_CHECK.json");
const OUT_MD = path.join(ROOT, "docs", "product", "FCS14_STATE_SEMANTIC_CHECK.md");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenSummary(reports) {
  const rows = [];
  for (const report of reports) {
    for (const scenario of report.results) {
      rows.push({
        surface: report.surface,
        route: report.route,
        scenario: scenario.scenario,
        pass: scenario.pass,
        screenshot: scenario.screenshot,
        consoleCount: (scenario.console || []).length + (scenario.pageErrors || []).length,
        expectedApiErrors: (scenario.expectedApiErrors || []).length,
        unexpectedApiErrors: (scenario.unexpectedApiErrors || []).length,
      });
    }
  }
  return rows;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# FCS-1.4 - Validacao Semantica de Estados UX");
  lines.push("");
  lines.push(`Data: ${report.generatedAt}`);
  lines.push(`Aprovacao global: ${report.pass ? "PASS" : "FAIL"}`);
  lines.push("");
  lines.push("## Superficies validadas");
  lines.push("| Superficie | Rota | Loading atrasado | Empty | Data | Error | Resultado |\n|---|---|---|---|---|---|---|");
  for (const surface of report.surfaces) {
    const byName = Object.fromEntries(surface.results.map((row) => [row.scenario, row]));
    lines.push(`| ${surface.surface} | ${surface.route} | ${byName["loading-delayed"].pass ? "PASS" : "FAIL"} | ${byName["empty"].pass ? "PASS" : "FAIL"} | ${byName["data"].pass ? "PASS" : "FAIL"} | ${byName["error"].pass ? "PASS" : "FAIL"} | ${surface.pass ? "PASS" : "FAIL"} |`);
  }
  lines.push("");
  lines.push("## Evidencia por cenario");
  lines.push("| Superficie | Cenario | PASS | Screenshot | Console | API 4xx/5xx esperados | API 4xx/5xx inesperados |\n|---|---|---|---|---:|---:|---:|");
  for (const row of report.rows) {
    lines.push(`| ${row.surface} | ${row.scenario} | ${row.pass ? "PASS" : "FAIL"} | ${row.screenshot} | ${row.consoleCount} | ${row.expectedApiErrors} | ${row.unexpectedApiErrors} |`);
  }
  return lines.join("\n");
}

function main() {
  const surfaces = SOURCES.map((source) => {
    const data = readJson(source.file);
    return {
      surface: source.label,
      route: source.route,
      runId: data.runId,
      results: data.results,
      pass: data.pass,
    };
  });

  const rows = flattenSummary(surfaces);
  const report = {
    generatedAt: new Date().toISOString(),
    pass: surfaces.every((item) => item.pass),
    surfaces,
    rows,
  };

  ensureDir(OUT_JSON);
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(OUT_MD, buildMarkdown(report));

  console.log(JSON.stringify({
    ok: true,
    pass: report.pass,
    outJson: path.relative(ROOT, OUT_JSON),
    outMd: path.relative(ROOT, OUT_MD),
  }, null, 2));
}

main();
