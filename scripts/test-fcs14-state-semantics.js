const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const OUT_JSON = path.join(ROOT, "docs", "product", "FCS14_STATE_SEMANTIC_CHECK.json");
const OUT_MD = path.join(ROOT, "docs", "product", "FCS14_STATE_SEMANTIC_CHECK.md");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function logStep(message) {
  console.log(`[FCS14SEM] ${message}`);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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
  const email = `${runId.toLowerCase()}@qa-fcs14-sem-admin.test`;
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      name: `QA FCS14 SEM ADMIN ${runId}`,
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

async function createTechnician(runId) {
  const pin = String(Math.floor(1000 + Math.random() * 8999));
  const technician = await prisma.technician.create({
    data: {
      name: `QA FCS14 SEM TECH ${runId}`,
      email: `${runId.toLowerCase()}@qa-fcs14-sem-tech.test`,
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

async function createClient(runId) {
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const client = await prisma.client.create({
    data: {
      name: `QA FCS14 SEM CLIENT ${runId}`,
      email: `${runId.toLowerCase()}@qa-fcs14-sem-client.test`,
      password,
      active: true,
      status: "ACTIVE",
      archiveStatus: "ATIVO",
      source: "QA_FCS14_SEM",
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

function toJsonResponse(status, body) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function setSession(page, session) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "commit", timeout: 30000 });
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", payload.token);
    localStorage.setItem("cristalwater_jwt", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
    if (payload.user?.clientId) {
      localStorage.setItem("cw_client_id", String(payload.user.clientId));
      localStorage.setItem("clientId", String(payload.user.clientId));
    }
    if (payload.user?.technicianId) {
      localStorage.setItem("technicianId", String(payload.user.technicianId));
    }
  }, session);
}

async function gotoReady(page, url) {
  await page.goto(url, { waitUntil: "commit", timeout: 30000 });
  await page.waitForTimeout(250);
}

function delayed(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockScenario(page, pageKey, mode, context) {
  await page.addInitScript((mock) => {
    const nativeFetch = window.fetch.bind(window);
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input && input.url) || "";

      if (mock.pageKey === "admin_service_log") {
        if (url.includes("/api/technicians")) return jsonResponse(200, { technicians: [] });
        if (url.includes("/api/guides/vehicles")) return jsonResponse(200, { vehicles: [] });
        if (url.includes("/api/core/daily-service-log")) {
          if (mock.mode === "error") return jsonResponse(500, { ok: false, error: "Falha simulada no registo diario." });
          if (mock.mode === "delayedEmpty") await delay(1400);
          if (mock.mode === "data") {
            return jsonResponse(200, {
              day: "2026-07-21",
              summary: { services: 1, done: 1, technicians: 1, vehicles: 1, gpsPoints: 1 },
              services: [{
                id: 7001,
                status: "DONE",
                plannedAt: new Date().toISOString(),
                startAt: new Date().toISOString(),
                endAt: new Date().toISOString(),
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
                at: new Date().toISOString(),
                title: "Posicao capturada",
                message: "Ponto GPS QA",
                latitude: 38.72,
                longitude: -9.13,
              }],
            });
          }
          return jsonResponse(200, {
            day: "2026-07-21",
            summary: { services: 0, done: 0, technicians: 0, vehicles: 0, gpsPoints: 0 },
            services: [],
            timeline: [],
          });
        }
      }

      if (mock.pageKey === "technician_route" && url.includes("/api/technician/today")) {
        if (mock.mode === "error") return jsonResponse(500, { ok: false, error: "Falha simulada na rota tecnica." });
        if (mock.mode === "delayedEmpty") await delay(1400);
        if (mock.mode === "data") {
          return jsonResponse(200, {
            ok: true,
            visits: [{
              id: 81001,
              plannedDate: new Date().toISOString(),
              pool: { id: 300, name: "Piscina QA", location: "Rua QA", zone: "Norte" },
              client: { id: 200, name: "Cliente QA" },
            }],
          });
        }
        return jsonResponse(200, { ok: true, visits: [] });
      }

      if (mock.pageKey === "client_payments" && url.includes(`/api/client-portal/${mock.context.clientId}`)) {
        if (mock.mode === "error") return jsonResponse(500, { ok: false, error: "Falha simulada de pagamentos." });
        if (mock.mode === "delayedEmpty") await delay(1400);
        if (mock.mode === "data") {
          return jsonResponse(200, {
            ok: true,
            client: { id: mock.context.clientId, name: "Cliente QA", paymentReference: `CW-${String(mock.context.clientId).padStart(6, "0")}` },
            summary: { totalOpen: 120, totalPaid: 0 },
            paymentInstructions: { paymentReference: `CW-${String(mock.context.clientId).padStart(6, "0")}`, amountOpen: 120 },
            invoices: [{
              id: 72001,
              invoiceNumber: "FT-QA-1",
              issueDate: new Date().toISOString(),
              total: 120,
              amountOpen: 120,
              status: "PENDING",
            }],
          });
        }
        return jsonResponse(200, {
          ok: true,
          client: { id: mock.context.clientId, name: "Cliente QA", paymentReference: `CW-${String(mock.context.clientId).padStart(6, "0")}` },
          summary: { totalOpen: 0, totalPaid: 0 },
          paymentInstructions: { paymentReference: `CW-${String(mock.context.clientId).padStart(6, "0")}`, amountOpen: 0 },
          invoices: [],
        });
      }

      return nativeFetch(input, init);
    };
  }, { pageKey, mode, context });
}

async function captureStateSignals(page, pageKey) {
  const textOf = async (selector) => String((await page.locator(selector).first().textContent().catch(() => "")) || "").toLowerCase();
  const countOf = async (selector) => page.locator(selector).count().catch(() => 0);

  if (pageKey === "admin_service_log") {
    const text = await textOf("#services");
    const timelineText = await textOf("#timeline");
    const serviceCount = await countOf("#services .service");
    return {
      loadingVisible: text.includes("a carregar") || timelineText.includes("a carregar"),
      prematureEmptyVisible: text.includes("sem servicos registados") || timelineText.includes("sem eventos na timeline"),
      emptyVisible: text.includes("sem servicos registados") || timelineText.includes("sem eventos na timeline"),
      dataVisible: serviceCount > 0,
      errorVisible: text.includes("falha simulada") || text.includes("erro") || timelineText.includes("nao foi possivel carregar a timeline"),
      errorUsesEmptyCopy: text.includes("falha simulada") ? false : (text.includes("sem servicos registados") && !text.includes("erro")),
    };
  }

  if (pageKey === "technician_route") {
    const routeText = await textOf("#route");
    const statusText = await textOf("#statusBox");
    const routeCount = await countOf("#route .route-item");
    return {
      loadingVisible: statusText.includes("a carregar rota"),
      prematureEmptyVisible: routeText.includes("sem rota planeada"),
      emptyVisible: routeText.includes("sem rota planeada"),
      dataVisible: routeCount > 0,
      errorVisible: statusText.includes("falha") || statusText.includes("erro"),
      errorUsesEmptyCopy: routeText.includes("sem rota") && !statusText.includes("erro") && !statusText.includes("falha"),
    };
  }

  if (pageKey === "client_payments") {
    const statusText = await textOf("#paymentStatus .status-text");
    const rowsText = await textOf("#rows");
    const rowCount = await countOf("#rows tr");
    return {
      loadingVisible: statusText.includes("a carregar"),
      prematureEmptyVisible: rowsText.includes("ainda nao existem faturas"),
      emptyVisible: rowsText.includes("ainda nao existem faturas"),
      dataVisible: rowCount > 0,
      errorVisible: statusText.includes("nao foi possivel") || statusText.includes("erro"),
      errorUsesEmptyCopy: rowsText.includes("ainda nao existem faturas") && (statusText.includes("nao foi possivel") || statusText.includes("erro")),
    };
  }

  return {
    loadingVisible: false,
    prematureEmptyVisible: false,
    emptyVisible: false,
    dataVisible: false,
    errorVisible: false,
    errorUsesEmptyCopy: false,
  };
}

async function runScenario(browser, spec, session, context) {
  logStep(`scenario:start:${spec.key}`);
  const contextBrowser = await browser.newContext({ viewport: { width: 1440, height: 920 }, colorScheme: "light" });
  const page = await contextBrowser.newPage();
  page.on("dialog", async (dialog) => {
    console.warn(`[${spec.key}] dialog: ${dialog.message()}`);
    await dialog.dismiss().catch(() => null);
  });
  await setSession(page, session);

  const row = {
    pageKey: spec.key,
    role: spec.role,
    route: spec.route,
    delayedEmpty: {},
    data: {},
    error: {},
    pass: false,
  };

  try {
    logStep(`scenario:${spec.key}:delayedEmpty:mock`);
    await mockScenario(page, spec.key, "delayedEmpty", context);
    logStep(`scenario:${spec.key}:delayedEmpty:goto`);
    await gotoReady(page, `${BASE_URL}${spec.route}`);
    logStep(`scenario:${spec.key}:delayedEmpty:goto:done`);

    await page.waitForTimeout(250);
    logStep(`scenario:${spec.key}:delayedEmpty:capture:start`);
    const delayedStart = await captureStateSignals(page, spec.key);
    logStep(`scenario:${spec.key}:delayedEmpty:capture:done`);

    await page.waitForTimeout(1700);
    logStep(`scenario:${spec.key}:delayedEmpty:postwait`);
    const delayedEnd = await captureStateSignals(page, spec.key);

    row.delayedEmpty = {
      loadingVisible: delayedStart.loadingVisible,
      prematureEmptyVisible: delayedStart.prematureEmptyVisible,
      emptyVisibleAfterResponse: delayedEnd.emptyVisible,
      pass:
        delayedStart.loadingVisible
        && !delayedStart.prematureEmptyVisible
        && delayedEnd.emptyVisible,
    };
  } finally {
    await contextBrowser.close();
  }

  const contextData = await browser.newContext({ viewport: { width: 1440, height: 920 }, colorScheme: "light" });
  const pageData = await contextData.newPage();
  pageData.on("dialog", async (dialog) => {
    console.warn(`[${spec.key}] dialog: ${dialog.message()}`);
    await dialog.dismiss().catch(() => null);
  });
  await setSession(pageData, session);
  try {
    logStep(`scenario:${spec.key}:data:mock`);
    await mockScenario(pageData, spec.key, "data", context);
    logStep(`scenario:${spec.key}:data:goto`);
    await gotoReady(pageData, `${BASE_URL}${spec.route}`);
    logStep(`scenario:${spec.key}:data:goto:done`);
    await pageData.waitForTimeout(900);
    const dataSignals = await captureStateSignals(pageData, spec.key);
    row.data = {
      dataVisible: dataSignals.dataVisible,
      emptyCleared: !dataSignals.emptyVisible,
      pass: dataSignals.dataVisible && !dataSignals.emptyVisible,
    };
  } finally {
    await contextData.close();
  }

  const contextError = await browser.newContext({ viewport: { width: 1440, height: 920 }, colorScheme: "light" });
  const pageError = await contextError.newPage();
  pageError.on("dialog", async (dialog) => {
    console.warn(`[${spec.key}] dialog: ${dialog.message()}`);
    await dialog.dismiss().catch(() => null);
  });
  await setSession(pageError, session);
  try {
    logStep(`scenario:${spec.key}:error:mock`);
    await mockScenario(pageError, spec.key, "error", context);
    logStep(`scenario:${spec.key}:error:goto`);
    await gotoReady(pageError, `${BASE_URL}${spec.route}`);
    logStep(`scenario:${spec.key}:error:goto:done`);
    await pageError.waitForTimeout(900);
    const errorSignals = await captureStateSignals(pageError, spec.key);
    row.error = {
      errorVisible: errorSignals.errorVisible,
      errorWithoutEmptyCopy: !errorSignals.errorUsesEmptyCopy,
      pass: errorSignals.errorVisible && !errorSignals.errorUsesEmptyCopy,
    };
  } finally {
    await contextError.close();
  }

  row.pass = row.delayedEmpty.pass && row.data.pass && row.error.pass;
  logStep(`scenario:end:${spec.key}:pass=${row.pass}`);
  return row;
}

function summarize(rows) {
  const summary = {
    totalPages: rows.length,
    totalChecks: rows.length * 5,
    step1LoadingDelayPass: 0,
    step2EmptyOnEmptyPass: 0,
    step3DataClearsEmptyPass: 0,
    step4ErrorStatePass: 0,
    step5NoPrematureEmptyPass: 0,
    pagesPass: 0,
    pagesFail: 0,
  };

  for (const row of rows) {
    if (row.delayedEmpty.loadingVisible) summary.step1LoadingDelayPass += 1;
    if (row.delayedEmpty.emptyVisibleAfterResponse) summary.step2EmptyOnEmptyPass += 1;
    if (row.data.pass) summary.step3DataClearsEmptyPass += 1;
    if (row.error.pass) summary.step4ErrorStatePass += 1;
    if (!row.delayedEmpty.prematureEmptyVisible) summary.step5NoPrematureEmptyPass += 1;

    if (row.pass) summary.pagesPass += 1;
    else summary.pagesFail += 1;
  }

  return summary;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# FCS-1.4 - Validacao Semantica de Estados UX");
  lines.push("");
  lines.push(`Data: ${report.generatedAt}`);
  lines.push(`Run: ${report.runId}`);
  lines.push(`Paginas representativas: ${report.rows.length}`);
  lines.push("");
  lines.push("## Criterios validados");
  lines.push("1. API atrasada => Loading visivel");
  lines.push("2. API vazia => Empty State correto");
  lines.push("3. API com dados => Empty State desaparece");
  lines.push("4. API com erro => Error State (nao sem dados)");
  lines.push("5. Sem flicker de empty state prematuro");
  lines.push("");
  lines.push("| Pagina | Perfil | Step1 | Step2 | Step3 | Step4 | Step5 | Resultado |\n|---|---|---|---|---|---|---|---|");

  for (const row of report.rows) {
    lines.push(`| ${row.route} | ${row.role} | ${row.delayedEmpty.loadingVisible ? "PASS" : "FAIL"} | ${row.delayedEmpty.emptyVisibleAfterResponse ? "PASS" : "FAIL"} | ${row.data.pass ? "PASS" : "FAIL"} | ${row.error.pass ? "PASS" : "FAIL"} | ${!row.delayedEmpty.prematureEmptyVisible ? "PASS" : "FAIL"} | ${row.pass ? "PASS" : "FAIL"} |`);
  }

  lines.push("");
  lines.push("## Resumo");
  lines.push(`- Step1 Loading: ${report.summary.step1LoadingDelayPass}/${report.summary.totalPages}`);
  lines.push(`- Step2 Empty: ${report.summary.step2EmptyOnEmptyPass}/${report.summary.totalPages}`);
  lines.push(`- Step3 Data limpa empty: ${report.summary.step3DataClearsEmptyPass}/${report.summary.totalPages}`);
  lines.push(`- Step4 Error State: ${report.summary.step4ErrorStatePass}/${report.summary.totalPages}`);
  lines.push(`- Step5 Sem flicker: ${report.summary.step5NoPrematureEmptyPass}/${report.summary.totalPages}`);
  lines.push(`- Paginas aprovadas: ${report.summary.pagesPass}/${report.summary.totalPages}`);

  return lines.join("\n");
}

async function cleanup(created) {
  await Promise.all([
    created.adminUserId ? prisma.user.updateMany({ where: { id: created.adminUserId }, data: { active: false } }).catch(() => null) : null,
    created.technicianId ? prisma.technician.updateMany({ where: { id: created.technicianId }, data: { active: false, archiveStatus: "ARQUIVADO" } }).catch(() => null) : null,
    created.clientId ? prisma.client.updateMany({ where: { id: created.clientId }, data: { active: false, status: "ARCHIVED", archiveStatus: "ARQUIVADO" } }).catch(() => null) : null,
  ]);
}

async function main() {
  const runId = `FCS14SEM_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const created = {};

  try {
    logStep("main:createAdmin");
    const admin = await createAdmin(runId);
    created.adminUserId = admin.cleanup.userId;

    logStep("main:createTechnician");
    const technician = await createTechnician(runId);
    created.technicianId = technician.cleanup.technicianId;

    logStep("main:createClient");
    const client = await createClient(runId);
    created.clientId = client.cleanup.clientId;

    logStep("main:launchBrowser");
    const browser = await chromium.launch({ headless: true });

    const specs = [
      { key: "admin_service_log", role: "ADMIN", route: "/admin-service-log", session: admin },
      { key: "technician_route", role: "TECHNICIAN", route: "/technician-route", session: technician },
      { key: "client_payments", role: "CLIENT", route: `/client-payments?clientId=${client.clientId}`, session: client },
    ];

    const rows = [];
    for (const spec of specs) {
      logStep(`main:runScenario:${spec.key}`);
      const row = await runScenario(browser, spec, spec.session, { clientId: client.clientId });
      rows.push(row);
    }

    logStep("main:closeBrowser");
    await browser.close();

    const summary = summarize(rows);
    const report = {
      generatedAt: new Date().toISOString(),
      runId,
      baseUrl: BASE_URL,
      rows,
      summary,
    };

    ensureDir(OUT_JSON);
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUT_MD, buildMarkdown(report));

    console.log(JSON.stringify({
      ok: true,
      runId,
      summary,
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
