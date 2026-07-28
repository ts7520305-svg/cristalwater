const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const OUT_JSON = path.join(ROOT, "docs", "product", "FCS14_TECHNICIAN_ROUTE_SEMANTICS.json");
const OUT_MD = path.join(ROOT, "docs", "product", "FCS14_TECHNICIAN_ROUTE_SEMANTICS.md");
const SHOT_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs14-technician-route");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function logStep(message) {
  console.log(`[FCS14TECH] ${message}`);
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function createTechnician(runId) {
  const pin = String(Math.floor(1000 + Math.random() * 8999));
  const technician = await prisma.technician.create({
    data: {
      name: `QA FCS14 TECH MIN ${runId}`,
      email: `${runId.toLowerCase()}@qa-fcs14-tech-min.test`,
      pin,
      role: "TECHNICIAN",
      active: true,
      zone: "QA",
    },
  });

  const login = await requestJson("/api/technician-auth/login", {
    method: "POST",
    body: { pin },
  });

  assert(login.ok && login.data?.token, "Falha no login technician temporario");

  return {
    token: login.data.token,
    user: {
      ...(login.data.user || {}),
      id: login.data.user?.id || technician.id,
      technicianId: login.data.user?.technicianId || technician.id,
      name: login.data.user?.name || technician.name,
      role: "TECHNICIAN",
    },
    cleanup: { technicianId: technician.id },
  };
}

async function primeTechnicianSession(page, session) {
  await page.goto(`${BASE_URL}/technician-login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", payload.token);
    localStorage.setItem("cristalwater_jwt", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
    localStorage.setItem("technicianId", String(payload.user.technicianId || payload.user.id));
  }, session);
}

function createRoutePayload(mode) {
  if (mode === "error") {
    return { status: 500, body: { ok: false, error: "Falha simulada na rota tecnica." } };
  }

  if (mode === "data") {
    return {
      status: 200,
      body: {
        ok: true,
        visits: [{
          id: 81001,
          plannedDate: nowIso(),
          pool: { id: 300, name: "Piscina QA", location: "Rua QA", zone: "Norte" },
          client: { id: 200, name: "Cliente QA" },
        }],
      },
    };
  }

  return { status: 200, body: { ok: true, visits: [] } };
}

async function installTechnicianRoutes(page, scenario, apiTrack) {
  await page.route("**/crystal-os-v2-shell.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('FCS14 tech semantic shell bypass');" });
  });

  await page.route("**/ui/state-adapter-v2.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('FCS14 tech semantic adapter bypass');" });
  });

  await page.route("**/api/technician/today**", async (route) => {
    if (scenario.mode === "delayed-empty") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const payload = createRoutePayload(scenario.mode === "delayed-empty" ? "empty" : scenario.mode);
    apiTrack.matched.push({ url: route.request().url(), status: payload.status, expected: payload.status >= 400 });
    await route.fulfill({ status: payload.status, contentType: "application/json", body: JSON.stringify(payload.body) });
  });
}

async function waitText(page, selector, timeoutMs) {
  const locator = page.locator(selector).first();
  const startedAt = Date.now();
  let attached = 0;
  while (Date.now() - startedAt < timeoutMs) {
    attached = await locator.count();
    if (attached > 0) break;
    await page.waitForTimeout(100);
  }
  if (attached === 0) throw new Error(`selector not attached: ${selector} | url=${page.url()} | title=${await page.title().catch(() => "(sem titulo)")}`);
  return String((await locator.textContent({ timeout: timeoutMs })) || "").trim();
}

async function waitForTextMatch(page, selector, matcher, timeoutMs) {
  const startedAt = Date.now();
  let lastText = "";
  while (Date.now() - startedAt < timeoutMs) {
    lastText = await waitText(page, selector, Math.min(1000, timeoutMs));
    if (matcher(lastText)) return lastText;
    await page.waitForTimeout(100);
  }
  return lastText;
}

function contains(text, snippet) {
  return String(text || "").toLowerCase().includes(String(snippet || "").toLowerCase());
}

function screenshotPath(runId, scenarioName) {
  ensureFolder(SHOT_DIR);
  return path.join(SHOT_DIR, `${runId}-${scenarioName}.png`);
}

function observation(selectorObserved, textFound, expectedState, observedState, pass) {
  return { selectorObserved, textFound, expectedState, observedState, pass };
}

async function runScenario(browser, session, runId, scenario) {
  logStep(`scenario:start:${scenario.name}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, colorScheme: "light" });
  const page = await context.newPage();
  const consoleLines = [];
  const pageErrors = [];
  const unexpectedApiErrors = [];
  const apiTrack = { matched: [] };

  page.on("console", (msg) => consoleLines.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    if (response.status() < 400) return;
    const wasExpected = apiTrack.matched.some((item) => item.url === url && item.status === response.status() && item.expected);
    if (!wasExpected) unexpectedApiErrors.push({ url, status: response.status() });
  });

  const result = {
    scenario: scenario.name,
    route: "/technician-route",
    debug: {},
    expectedApiErrors: [],
    unexpectedApiErrors,
    observations: [],
    screenshot: "",
    console: consoleLines,
    pageErrors,
    pass: false,
  };

  try {
    logStep(`scenario:${scenario.name}:prime-session`);
    await primeTechnicianSession(page, session);
    logStep(`scenario:${scenario.name}:routes`);
    await installTechnicianRoutes(page, scenario, apiTrack);
    logStep(`scenario:${scenario.name}:goto`);
    await page.goto(`${BASE_URL}/technician-route`, { waitUntil: "domcontentloaded", timeout: 30000 });
    logStep(`scenario:${scenario.name}:goto:done`);
    result.debug.urlAfterGoto = page.url();
    result.debug.titleAfterGoto = await page.title().catch(() => "(sem titulo)");

    if (scenario.name === "loading-delayed") {
      const statusText = await waitText(page, "#statusBox", 4000);
      const routeText = await waitText(page, "#route", 4000);
      result.observations.push(observation("#statusBox", statusText, "Loading visivel com texto de carregamento", contains(statusText, "A carregar rota do dia") ? "Loading correto" : "Texto inesperado", contains(statusText, "A carregar rota do dia")));
      result.observations.push(observation("#route", routeText, "Sem empty prematuro durante loading", contains(routeText, "Sem rota planeada") ? "Empty prematuro" : "Sem flicker prematuro", !contains(routeText, "Sem rota planeada")));
      const finalRouteText = await waitForTextMatch(page, "#route", (text) => contains(text, "Sem rota planeada para hoje"), 7000);
      const finalStatusText = await waitForTextMatch(page, "#statusBox", (text) => contains(text, "Sem paragens para hoje"), 7000);
      result.observations.push(observation("#route", finalRouteText, "Empty state apos resposta vazia", contains(finalRouteText, "Sem rota planeada para hoje") ? "Empty correto" : "Texto inesperado", contains(finalRouteText, "Sem rota planeada para hoje")));
      result.observations.push(observation("#statusBox", finalStatusText, "Estado final sem paragens", contains(finalStatusText, "Sem paragens para hoje") ? "Estado correto" : "Texto inesperado", contains(finalStatusText, "Sem paragens para hoje")));
    }

    if (scenario.name === "empty") {
      const routeText = await waitText(page, "#route", 4000);
      const statusText = await waitText(page, "#statusBox", 4000);
      result.observations.push(observation("#route", routeText, "Empty state com lista vazia", contains(routeText, "Sem rota planeada para hoje") ? "Empty correto" : "Texto inesperado", contains(routeText, "Sem rota planeada para hoje")));
      result.observations.push(observation("#statusBox", statusText, "Estado final sem paragens", contains(statusText, "Sem paragens para hoje") ? "Estado correto" : "Texto inesperado", contains(statusText, "Sem paragens para hoje")));
    }

    if (scenario.name === "data") {
      await page.locator("#route .route-item").first().waitFor({ state: "visible", timeout: 5000 });
      const routeTitle = await waitText(page, "#route .route-item b", 3000);
      const statusText = await waitText(page, "#statusBox", 3000);
      const emptyCount = await page.locator("#route .empty").count();
      result.observations.push(observation("#route .route-item b", routeTitle, "Registo renderizado com dados", routeTitle ? "Dados renderizados" : "Sem dados", Boolean(routeTitle)));
      result.observations.push(observation("#statusBox", statusText, "Estado final com paragens carregadas", contains(statusText, "Rota carregada com 1 paragem") ? "Estado correto" : "Texto inesperado", contains(statusText, "Rota carregada com 1 paragem")));
      result.observations.push(observation("#route .empty", String(emptyCount), "Empty state desaparece quando ha dados", emptyCount === 0 ? "Empty removido" : `Empty residual (${emptyCount})`, emptyCount === 0));
    }

    if (scenario.name === "error") {
      const routeText = await waitText(page, "#route", 5000);
      const statusText = await waitText(page, "#statusBox", 5000);
      result.expectedApiErrors.push({ urlIncludes: "/api/technician/today", status: 500 });
      result.observations.push(observation("#statusBox", statusText, "Mensagem de erro apos resposta 500", contains(statusText, "Falha simulada na rota tecnica") ? "Erro mostrado" : "Texto inesperado", contains(statusText, "Falha simulada na rota tecnica")));
      result.observations.push(observation("#route", routeText, "Error state nao usa empty de sucesso", contains(routeText, "Sem rota planeada para hoje") ? "Fallback vazio" : "Sem empty de sucesso", !contains(statusText, "Sem paragens para hoje")));
    }

    const shot = screenshotPath(runId, scenario.name);
    await page.locator("main.route-shell").screenshot({ path: shot });
    result.screenshot = path.relative(ROOT, shot);
    result.pass = result.observations.every((item) => item.pass) && unexpectedApiErrors.length === 0 && pageErrors.length === 0;
    logStep(`scenario:end:${scenario.name}:pass=${result.pass}`);
    return result;
  } finally {
    await context.close();
  }
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# FCS-1.4 - Technician Route Semantic Check");
  lines.push("");
  lines.push(`Data: ${report.generatedAt}`);
  lines.push(`Run: ${report.runId}`);
  lines.push(`Pagina: /technician-route`);
  lines.push("");
  lines.push("| Cenario | PASS | Screenshot | Console | API inesperados |\n|---|---|---|---:|---:|");
  for (const row of report.results) {
    lines.push(`| ${row.scenario} | ${row.pass ? "PASS" : "FAIL"} | ${row.screenshot} | ${row.console.length + row.pageErrors.length} | ${row.unexpectedApiErrors.length} |`);
  }
  return lines.join("\n");
}

async function cleanup(created) {
  await Promise.all([
    created.technicianId ? prisma.technician.updateMany({ where: { id: created.technicianId }, data: { active: false, archiveStatus: "ARQUIVADO" } }).catch(() => null) : null,
  ]);
}

async function main() {
  const runId = `FCS14TECH_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const created = {};

  try {
    logStep("main:create-technician");
    const technician = await createTechnician(runId);
    created.technicianId = technician.cleanup.technicianId;

    logStep("main:launch-browser");
    const browser = await chromium.launch({ headless: true });
    const scenarios = [
      { name: "loading-delayed", mode: "delayed-empty" },
      { name: "empty", mode: "empty" },
      { name: "data", mode: "data" },
      { name: "error", mode: "error" },
    ];

    const results = [];
    try {
      for (const scenario of scenarios) {
        logStep(`main:run:${scenario.name}`);
        results.push(await runScenario(browser, technician, runId, scenario));
      }
    } finally {
      logStep("main:close-browser");
      await browser.close();
    }

    const report = { generatedAt: nowIso(), runId, route: "/technician-route", results, pass: results.every((row) => row.pass) };
    ensureDir(OUT_JSON);
    ensureFolder(SHOT_DIR);
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUT_MD, buildMarkdown(report));

    console.log(JSON.stringify({ ok: true, runId, route: report.route, pass: report.pass, scenarios: results.map((row) => ({ scenario: row.scenario, pass: row.pass })), outJson: path.relative(ROOT, OUT_JSON), outMd: path.relative(ROOT, OUT_MD) }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, runId, error: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await cleanup(created);
    await prisma.$disconnect().catch(() => null);
  }
}

main();
