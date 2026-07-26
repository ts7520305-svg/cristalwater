const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const OUT_JSON = path.join(ROOT, "docs", "product", "FCS14_ADMIN_SERVICE_LOG_SEMANTICS.json");
const OUT_MD = path.join(ROOT, "docs", "product", "FCS14_ADMIN_SERVICE_LOG_SEMANTICS.md");
const SHOT_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs14-admin-service-log");

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
  console.log(`[FCS14ADM] ${message}`);
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

async function createAdmin(runId) {
  const email = `${runId.toLowerCase()}@qa-fcs14-admin-min.test`;
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      name: `QA FCS14 ADMIN MIN ${runId}`,
    },
  });

  const login = await requestJson("/api/auth/login", {
    method: "POST",
    body: { email, password: plainPassword },
  });

  assert(login.ok && login.data?.token, "Falha no login admin temporario");

  return {
    token: login.data.token,
    user: {
      ...(login.data.user || {}),
      id: login.data.user?.id || user.id,
      email: login.data.user?.email || email,
      role: "ADMIN",
    },
    cleanup: { userId: user.id },
  };
}

async function primeAdminSession(page, session) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", payload.token);
    localStorage.setItem("cristalwater_jwt", payload.token);
    localStorage.setItem("adminToken", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
  }, session);
}

function createDailyLogPayload(mode) {
  if (mode === "error") {
    return { status: 500, body: { ok: false, error: "Falha simulada no registo diario." } };
  }

  if (mode === "data") {
    return {
      status: 200,
      body: {
        day: "2026-07-22",
        summary: { services: 1, done: 1, technicians: 1, vehicles: 1, gpsPoints: 1 },
        services: [{
          id: 7001,
          status: "DONE",
          plannedAt: nowIso(),
          startAt: nowIso(),
          endAt: nowIso(),
          pool: { name: "Piscina QA", zone: "Centro" },
          client: { name: "Cliente QA" },
          technician: { name: "Tecnico QA" },
          vehicle: { plate: "AA-00-QA" },
          workGuide: { id: 1 },
          stockMovements: [],
          chemicals: [],
        }],
        timeline: [{
          type: "GPS",
          at: nowIso(),
          title: "Posicao capturada",
          message: "Ponto GPS QA",
          latitude: 38.72,
          longitude: -9.13,
        }],
      },
    };
  }

  return {
    status: 200,
    body: {
      day: "2026-07-22",
      summary: { services: 0, done: 0, technicians: 0, vehicles: 0, gpsPoints: 0 },
      services: [],
      timeline: [],
    },
  };
}

async function installAdminServiceLogRoutes(page, scenario, apiTrack) {
  await page.route("**/crystal-os-v2-shell.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "console.log('FCS14 admin semantic shell bypass');",
    });
  });

  await page.route("**/ui/state-adapter-v2.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "console.log('FCS14 admin semantic adapter bypass');",
    });
  });

  await page.route("**/api/technicians", async (route) => {
    apiTrack.matched.push({ url: route.request().url(), status: 200, expected: true });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ technicians: [] }),
    });
  });

  await page.route("**/api/guides/vehicles", async (route) => {
    apiTrack.matched.push({ url: route.request().url(), status: 200, expected: true });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ vehicles: [] }),
    });
  });

  await page.route("**/api/core/daily-service-log**", async (route) => {
    if (scenario.mode === "delayed-empty") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const payload = createDailyLogPayload(scenario.mode === "delayed-empty" ? "empty" : scenario.mode);
    apiTrack.matched.push({
      url: route.request().url(),
      status: payload.status,
      expected: payload.status >= 400,
    });
    await route.fulfill({
      status: payload.status,
      contentType: "application/json",
      body: JSON.stringify(payload.body),
    });
  });
}

async function waitVisibleText(page, selector, timeoutMs) {
  const locator = page.locator(selector).first();
  try {
    const startedAt = Date.now();
    let attached = 0;
    while (Date.now() - startedAt < timeoutMs) {
      attached = await locator.count();
      if (attached > 0) break;
      await page.waitForTimeout(100);
    }
    if (attached === 0) {
      const title = await page.title().catch(() => "(sem titulo)");
      throw new Error(`selector not attached: ${selector} | url=${page.url()} | title=${title}`);
    }
    return String((await locator.textContent({ timeout: timeoutMs })) || "").trim();
  } catch (error) {
    const title = await page.title().catch(() => "(sem titulo)");
    throw new Error(`${error.message} | url=${page.url()} | title=${title}`);
  }
}

async function count(page, selector) {
  return page.locator(selector).count();
}

async function waitForTextMatch(page, selector, matcher, timeoutMs) {
  const startedAt = Date.now();
  let lastText = "";
  while (Date.now() - startedAt < timeoutMs) {
    lastText = await waitVisibleText(page, selector, Math.min(1000, timeoutMs));
    if (matcher(lastText)) return lastText;
    await page.waitForTimeout(100);
  }
  return lastText;
}

function contains(text, snippet) {
  return String(text || "").toLowerCase().includes(String(snippet || "").toLowerCase());
}

function scenarioScreenshotPath(runId, scenarioName) {
  ensureFolder(SHOT_DIR);
  return path.join(SHOT_DIR, `${runId}-${scenarioName}.png`);
}

function buildObservation(selector, expectedState, observedState, textFound, pass) {
  return {
    selectorObserved: selector,
    textFound,
    expectedState,
    observedState,
    pass,
  };
}

async function runScenario(browser, session, runId, scenario) {
  logStep(`scenario:start:${scenario.name}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, colorScheme: "light" });
  const page = await context.newPage();
  const consoleLines = [];
  const pageErrors = [];
  const unexpectedApiErrors = [];
  const apiTrack = { matched: [] };

  page.on("console", (msg) => {
    consoleLines.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error));
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    if (response.status() < 400) return;
    const wasExpected = apiTrack.matched.some((item) => item.url === url && item.status === response.status() && item.expected);
    if (!wasExpected) {
      unexpectedApiErrors.push({ url, status: response.status() });
    }
  });

  const result = {
    scenario: scenario.name,
    route: "/admin-service-log",
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
    await primeAdminSession(page, session);
    logStep(`scenario:${scenario.name}:routes`);
    await installAdminServiceLogRoutes(page, scenario, apiTrack);
    logStep(`scenario:${scenario.name}:goto`);
    await page.goto(`${BASE_URL}/admin-service-log`, { waitUntil: "domcontentloaded", timeout: 30000 });
    logStep(`scenario:${scenario.name}:goto:done`);
    result.debug.urlAfterGoto = page.url();
    result.debug.titleAfterGoto = await page.title().catch(() => "(sem titulo)");
    logStep(`scenario:${scenario.name}:url=${result.debug.urlAfterGoto}`);
    logStep(`scenario:${scenario.name}:title=${result.debug.titleAfterGoto}`);
    logStep(`scenario:${scenario.name}:debug-ready`);

    if (scenario.name === "loading-delayed") {
      logStep(`scenario:${scenario.name}:read:services-loading:start`);
      const loadingServiceText = await waitVisibleText(page, "#services", 4000);
      logStep(`scenario:${scenario.name}:read:services-loading:done`);
      logStep(`scenario:${scenario.name}:read:timeline-loading:start`);
      const loadingTimelineText = await waitVisibleText(page, "#timeline", 4000);
      logStep(`scenario:${scenario.name}:read:timeline-loading:done`);
      const noPrematureEmpty = !contains(loadingServiceText, "Sem servicos registados") && !contains(loadingTimelineText, "Sem eventos na timeline");

      result.observations.push(buildObservation(
        "#services",
        "Loading visivel com texto de carregamento",
        contains(loadingServiceText, "A carregar registos") ? "Loading correto" : "Texto inesperado",
        loadingServiceText,
        contains(loadingServiceText, "A carregar registos")
      ));
      result.observations.push(buildObservation(
        "#timeline",
        "Loading visivel com texto de carregamento",
        contains(loadingTimelineText, "A carregar timeline") ? "Loading correto" : "Texto inesperado",
        loadingTimelineText,
        contains(loadingTimelineText, "A carregar timeline")
      ));
      result.observations.push(buildObservation(
        "#services + #timeline",
        "Sem empty state prematuro antes da resposta",
        noPrematureEmpty ? "Sem flicker prematuro" : "Empty prematuro",
        `${loadingServiceText} | ${loadingTimelineText}`,
        noPrematureEmpty
      ));

      logStep(`scenario:${scenario.name}:read:services-final:start`);
      const finalServiceText = await waitForTextMatch(
        page,
        "#services",
        (text) => contains(text, "Sem servicos registados para estes filtros"),
        7000
      );
      logStep(`scenario:${scenario.name}:read:services-final:done`);
      logStep(`scenario:${scenario.name}:read:timeline-final:start`);
      const finalTimelineText = await waitForTextMatch(
        page,
        "#timeline",
        (text) => contains(text, "Sem eventos na timeline para estes filtros"),
        7000
      );
      logStep(`scenario:${scenario.name}:read:timeline-final:done`);
      result.observations.push(buildObservation(
        "#services",
        "Empty state apos resposta vazia",
        contains(finalServiceText, "Sem servicos registados para estes filtros") ? "Empty correto" : "Texto inesperado",
        finalServiceText,
        contains(finalServiceText, "Sem servicos registados para estes filtros")
      ));
      result.observations.push(buildObservation(
        "#timeline",
        "Timeline vazia apos resposta vazia",
        contains(finalTimelineText, "Sem eventos na timeline para estes filtros") ? "Empty correto" : "Texto inesperado",
        finalTimelineText,
        contains(finalTimelineText, "Sem eventos na timeline para estes filtros")
      ));
    }

    if (scenario.name === "empty") {
      logStep(`scenario:${scenario.name}:read:services:start`);
      const serviceText = await waitVisibleText(page, "#services", 4000);
      logStep(`scenario:${scenario.name}:read:services:done`);
      logStep(`scenario:${scenario.name}:read:timeline:start`);
      const timelineText = await waitVisibleText(page, "#timeline", 4000);
      logStep(`scenario:${scenario.name}:read:timeline:done`);
      result.observations.push(buildObservation(
        "#services",
        "Empty state com lista vazia",
        contains(serviceText, "Sem servicos registados para estes filtros") ? "Empty correto" : "Texto inesperado",
        serviceText,
        contains(serviceText, "Sem servicos registados para estes filtros")
      ));
      result.observations.push(buildObservation(
        "#timeline",
        "Timeline vazia com lista vazia",
        contains(timelineText, "Sem eventos na timeline para estes filtros") ? "Empty correto" : "Texto inesperado",
        timelineText,
        contains(timelineText, "Sem eventos na timeline para estes filtros")
      ));
    }

    if (scenario.name === "data") {
      logStep(`scenario:${scenario.name}:wait:service:start`);
      await page.locator("#services .service").first().waitFor({ state: "visible", timeout: 5000 });
      logStep(`scenario:${scenario.name}:wait:service:done`);
      logStep(`scenario:${scenario.name}:wait:timeline:start`);
      await page.locator("#timeline .timeline-item").first().waitFor({ state: "visible", timeout: 5000 });
      logStep(`scenario:${scenario.name}:wait:timeline:done`);
      const serviceTitle = await waitVisibleText(page, "#services .service .service-title", 3000);
      const timelineTitle = await waitVisibleText(page, "#timeline .timeline-item strong", 3000);
      const emptyServicesCount = await count(page, "#services .empty");
      result.observations.push(buildObservation(
        "#services .service .service-title",
        "Registo renderizado com dados",
        serviceTitle ? "Dados renderizados" : "Sem dados",
        serviceTitle,
        Boolean(serviceTitle)
      ));
      result.observations.push(buildObservation(
        "#timeline .timeline-item strong",
        "Timeline renderizada com dados",
        timelineTitle ? "Dados renderizados" : "Sem dados",
        timelineTitle,
        Boolean(timelineTitle)
      ));
      result.observations.push(buildObservation(
        "#services .empty",
        "Empty state desaparece quando ha dados",
        emptyServicesCount === 0 ? "Empty removido" : `Empty residual (${emptyServicesCount})`,
        String(emptyServicesCount),
        emptyServicesCount === 0
      ));
    }

    if (scenario.name === "error") {
      logStep(`scenario:${scenario.name}:read:services:start`);
      const serviceText = await waitVisibleText(page, "#services", 5000);
      logStep(`scenario:${scenario.name}:read:services:done`);
      logStep(`scenario:${scenario.name}:read:timeline:start`);
      const timelineText = await waitVisibleText(page, "#timeline", 5000);
      logStep(`scenario:${scenario.name}:read:timeline:done`);
      result.expectedApiErrors.push({ urlIncludes: "/api/core/daily-service-log", status: 500 });
      result.observations.push(buildObservation(
        "#services",
        "Mensagem de erro apos resposta 500",
        contains(serviceText, "Falha simulada no registo diario") || contains(serviceText, "Erro de ligacao") ? "Erro mostrado" : "Texto inesperado",
        serviceText,
        (contains(serviceText, "Falha simulada no registo diario") || contains(serviceText, "Erro de ligacao")) && !contains(serviceText, "Sem servicos registados")
      ));
      result.observations.push(buildObservation(
        "#timeline",
        "Timeline mostra indisponibilidade e nao empty de dados",
        contains(timelineText, "Nao foi possivel carregar a timeline") ? "Erro mostrado" : "Texto inesperado",
        timelineText,
        contains(timelineText, "Nao foi possivel carregar a timeline") && !contains(timelineText, "Sem eventos na timeline")
      ));
    }

    const screenshotPath = scenarioScreenshotPath(runId, scenario.name);
    await page.locator("main.page").screenshot({ path: screenshotPath });
    result.screenshot = path.relative(ROOT, screenshotPath);
    result.pass = result.observations.every((item) => item.pass) && unexpectedApiErrors.length === 0 && pageErrors.length === 0;
    logStep(`scenario:end:${scenario.name}:pass=${result.pass}`);
    return result;
  } catch (error) {
    const screenshotPath = scenarioScreenshotPath(runId, `${scenario.name}-failure`);
    await page.locator("main.page").screenshot({ path: screenshotPath }).catch(() => null);
    throw error;
  } finally {
    await context.close();
  }
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# FCS-1.4 - Admin Service Log Semantic Check");
  lines.push("");
  lines.push(`Data: ${report.generatedAt}`);
  lines.push(`Run: ${report.runId}`);
  lines.push(`Pagina: /admin-service-log`);
  lines.push("");
  lines.push("| Cenario | PASS | Screenshot | Console | API inesperados |\n|---|---|---|---:|---:|");
  for (const row of report.results) {
    lines.push(`| ${row.scenario} | ${row.pass ? "PASS" : "FAIL"} | ${row.screenshot} | ${row.console.length + row.pageErrors.length} | ${row.unexpectedApiErrors.length} |`);
  }
  lines.push("");
  for (const row of report.results) {
    lines.push(`## ${row.scenario}`);
    lines.push("");
    lines.push("| Seletor observado | Texto encontrado | Estado esperado | Estado observado | PASS/FAIL |\n|---|---|---|---|---|");
    for (const item of row.observations) {
      const safeText = String(item.textFound || "").replace(/\|/g, "\\|");
      const safeExpected = String(item.expectedState || "").replace(/\|/g, "\\|");
      const safeObserved = String(item.observedState || "").replace(/\|/g, "\\|");
      lines.push(`| ${item.selectorObserved} | ${safeText} | ${safeExpected} | ${safeObserved} | ${item.pass ? "PASS" : "FAIL"} |`);
    }
    lines.push("");
    lines.push(`- Screenshot: ${row.screenshot}`);
    lines.push(`- Console lines: ${row.console.length}`);
    lines.push(`- Page errors: ${row.pageErrors.length}`);
    lines.push(`- API 4xx/5xx esperados: ${row.expectedApiErrors.length}`);
    lines.push(`- API 4xx/5xx inesperados: ${row.unexpectedApiErrors.length}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function cleanup(created) {
  await Promise.all([
    created.adminUserId
      ? prisma.user.updateMany({ where: { id: created.adminUserId }, data: { active: false } }).catch(() => null)
      : null,
  ]);
}

async function main() {
  const runId = `FCS14ADM_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const created = {};

  try {
    logStep("main:create-admin");
    const admin = await createAdmin(runId);
    created.adminUserId = admin.cleanup.userId;

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
        const row = await runScenario(browser, admin, runId, scenario);
        results.push(row);
      }
    } finally {
      logStep("main:close-browser");
      await browser.close();
    }

    const report = {
      generatedAt: nowIso(),
      runId,
      route: "/admin-service-log",
      results,
      pass: results.every((row) => row.pass),
    };

    ensureDir(OUT_JSON);
    ensureFolder(SHOT_DIR);
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUT_MD, buildMarkdown(report));

    console.log(JSON.stringify({
      ok: true,
      runId,
      route: report.route,
      pass: report.pass,
      scenarios: results.map((row) => ({ scenario: row.scenario, pass: row.pass })),
      outJson: path.relative(ROOT, OUT_JSON),
      outMd: path.relative(ROOT, OUT_MD),
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, runId, error: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await cleanup(created);
    await prisma.$disconnect().catch(() => null);
  }
}

main();
