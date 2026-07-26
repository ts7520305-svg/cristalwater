const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const OUT_JSON = path.join(ROOT, "docs", "product", "FCS14_CLIENT_PAYMENTS_SEMANTICS.json");
const OUT_MD = path.join(ROOT, "docs", "product", "FCS14_CLIENT_PAYMENTS_SEMANTICS.md");
const SHOT_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs14-client-payments");

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
  console.log(`[FCS14CLIENT] ${message}`);
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

async function createClient(runId) {
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const client = await prisma.client.create({
    data: {
      name: `QA FCS14 CLIENT MIN ${runId}`,
      email: `${runId.toLowerCase()}@qa-fcs14-client-min.test`,
      password,
      active: true,
      status: "ACTIVE",
      archiveStatus: "ATIVO",
      source: "QA_FCS14_CLIENT_MIN",
    },
  });

  const login = await requestJson("/api/client-auth/login", {
    method: "POST",
    body: { email: client.email, password: plainPassword },
  });

  assert(login.ok && login.data?.token, "Falha no login client temporario");

  return {
    token: login.data.token,
    user: {
      ...(login.data.client || {}),
      id: login.data.client?.id || client.id,
      clientId: login.data.client?.clientId || login.data.client?.id || client.id,
      name: login.data.client?.name || client.name,
      email: login.data.client?.email || client.email,
      role: "CLIENT",
    },
    clientId: client.id,
    cleanup: { clientId: client.id },
  };
}

async function primeClientSession(page, session) {
  await page.goto(`${BASE_URL}/client-login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", payload.token);
    localStorage.setItem("cristalwater_jwt", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
    localStorage.setItem("cw_client_id", String(payload.user.clientId || payload.user.id));
    localStorage.setItem("clientId", String(payload.user.clientId || payload.user.id));
  }, session);
}

function createPaymentsPayload(mode, clientId) {
  if (mode === "error") {
    return { status: 500, body: { ok: false, error: "Falha simulada de pagamentos." } };
  }

  if (mode === "data") {
    return {
      status: 200,
      body: {
        ok: true,
        client: { id: clientId, name: "Cliente QA", paymentReference: `CW-${String(clientId).padStart(6, "0")}` },
        summary: { totalOpen: 120, totalPaid: 0 },
        paymentInstructions: { paymentReference: `CW-${String(clientId).padStart(6, "0")}`, amountOpen: 120 },
        invoices: [{ id: 72001, invoiceNumber: "FT-QA-1", issueDate: nowIso(), total: 120, amountOpen: 120, status: "PENDING" }],
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      client: { id: clientId, name: "Cliente QA", paymentReference: `CW-${String(clientId).padStart(6, "0")}` },
      summary: { totalOpen: 0, totalPaid: 0 },
      paymentInstructions: { paymentReference: `CW-${String(clientId).padStart(6, "0")}`, amountOpen: 0 },
      invoices: [],
    },
  };
}

async function installClientRoutes(page, scenario, clientId, apiTrack) {
  await page.route("**/crystal-os-v2-shell.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('FCS14 client semantic shell bypass');" });
  });

  await page.route("**/ui/state-adapter-v2.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('FCS14 client semantic adapter bypass');" });
  });

  await page.route(`**/api/client-portal/${clientId}`, async (route) => {
    if (scenario.mode === "delayed-empty") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const payload = createPaymentsPayload(scenario.mode === "delayed-empty" ? "empty" : scenario.mode, clientId);
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

  const result = { scenario: scenario.name, route: `/client-payments?clientId=${session.clientId}`, debug: {}, expectedApiErrors: [], unexpectedApiErrors, observations: [], screenshot: "", console: consoleLines, pageErrors, pass: false };

  try {
    logStep(`scenario:${scenario.name}:prime-session`);
    await primeClientSession(page, session);
    logStep(`scenario:${scenario.name}:routes`);
    await installClientRoutes(page, scenario, session.clientId, apiTrack);
    logStep(`scenario:${scenario.name}:goto`);
    await page.goto(`${BASE_URL}/client-payments?clientId=${session.clientId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    logStep(`scenario:${scenario.name}:goto:done`);
    result.debug.urlAfterGoto = page.url();
    result.debug.titleAfterGoto = await page.title().catch(() => "(sem titulo)");

    if (scenario.name === "loading-delayed") {
      const statusText = await waitText(page, "#paymentStatus .status-text", 4000);
      result.observations.push(observation("#paymentStatus .status-text", statusText, "Loading visivel com texto de carregamento", contains(statusText, "A carregar informa") ? "Loading correto" : "Texto inesperado", contains(statusText, "A carregar informa")));
      const finalRowsText = await waitForTextMatch(page, "#rows", (text) => contains(text, "Ainda nao existem faturas ou pagamentos registados"), 7000);
      result.observations.push(observation("#rows", finalRowsText, "Empty state apos resposta vazia", contains(finalRowsText, "Ainda nao existem faturas ou pagamentos registados") ? "Empty correto" : "Texto inesperado", contains(finalRowsText, "Ainda nao existem faturas ou pagamentos registados")));
    }

    if (scenario.name === "empty") {
      const rowsText = await waitForTextMatch(page, "#rows", (text) => contains(text, "Ainda nao existem faturas ou pagamentos registados"), 7000);
      result.observations.push(observation("#rows", rowsText, "Empty state com lista vazia", contains(rowsText, "Ainda nao existem faturas ou pagamentos registados") ? "Empty correto" : "Texto inesperado", contains(rowsText, "Ainda nao existem faturas ou pagamentos registados")));
    }

    if (scenario.name === "data") {
      const rowText = await waitForTextMatch(page, "#rows", (text) => contains(text, "FT-QA-1") || contains(text, "Ainda nao existem faturas ou pagamentos registados"), 12000);
      result.observations.push(observation("#rows", rowText, "Linha renderizada com dados", contains(rowText, "FT-QA-1") ? "Dados renderizados" : "Texto inesperado", contains(rowText, "FT-QA-1")));
    }

    if (scenario.name === "error") {
      const statusText = await waitForTextMatch(
        page,
        "#paymentStatus .status-text",
        (text) => contains(text, "Falha simulada de pagamentos") || contains(text, "Nao foi possivel carregar os dados de pagamento") || !contains(text, "A carregar informa"),
        12000
      );
      result.expectedApiErrors.push({ urlIncludes: `/api/client-portal/${session.clientId}`, status: 500 });
      result.observations.push(observation("#paymentStatus .status-text", statusText, "Mensagem de erro apos resposta 500", contains(statusText, "Falha simulada de pagamentos") || contains(statusText, "Nao foi possivel carregar os dados de pagamento") ? "Erro mostrado" : "Texto inesperado", contains(statusText, "Falha simulada de pagamentos") || contains(statusText, "Nao foi possivel carregar os dados de pagamento")));
    }

    const shot = screenshotPath(runId, scenario.name);
    await page.locator("main").screenshot({ path: shot });
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
  lines.push("# FCS-1.4 - Client Payments Semantic Check");
  lines.push("");
  lines.push(`Data: ${report.generatedAt}`);
  lines.push(`Run: ${report.runId}`);
  lines.push(`Pagina: /client-payments`);
  lines.push("");
  lines.push("| Cenario | PASS | Screenshot | Console | API inesperados |\n|---|---|---|---:|---:|");
  for (const row of report.results) {
    lines.push(`| ${row.scenario} | ${row.pass ? "PASS" : "FAIL"} | ${row.screenshot} | ${row.console.length + row.pageErrors.length} | ${row.unexpectedApiErrors.length} |`);
  }
  return lines.join("\n");
}

async function cleanup(created) {
  await Promise.all([
    created.clientId ? prisma.client.updateMany({ where: { id: created.clientId }, data: { active: false, status: "ARCHIVED", archiveStatus: "ARQUIVADO" } }).catch(() => null) : null,
  ]);
}

async function main() {
  const runId = `FCS14CLIENT_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const created = {};

  try {
    logStep("main:create-client");
    const client = await createClient(runId);
    created.clientId = client.cleanup.clientId;

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
        results.push(await runScenario(browser, client, runId, scenario));
      }
    } finally {
      logStep("main:close-browser");
      await browser.close();
    }

    const report = { generatedAt: nowIso(), runId, route: `/client-payments?clientId=${client.clientId}`, results, pass: results.every((row) => row.pass) };
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
