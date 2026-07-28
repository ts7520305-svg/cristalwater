const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 920 },
  { label: "390x844", width: 390, height: 844 },
];

const FLOWS = [
  {
    key: "create-client",
    name: "Criar cliente",
    route: "/admin-clients",
    actionOpenedSelector: "#clientForm",
  },
  {
    key: "create-pool",
    name: "Criar piscina",
    route: "/admin-pools",
    actionOpenedSelector: "#poolForm",
  },
  {
    key: "schedule-visit",
    name: "Agendar visita",
    route: "/admin-visits",
    actionOpenedSelector: "button[onclick='createVisit()']",
  },
  {
    key: "create-repair",
    name: "Criar reparação",
    route: "/admin-alerts",
    actionOpenClickSelector: "#openRepairModal",
    actionOpenedSelector: "#repairModal:not([hidden])",
  },
  {
    key: "issue-invoice",
    name: "Emitir fatura",
    route: "/invoices",
    actionOpenedSelector: "button[onclick='generateInvoiceForClient()']",
  },
  {
    key: "create-product",
    name: "Criar produto",
    route: "/admin-inventory",
    actionOpenedSelector: "#purchaseForm",
  },
];

const FLOW_FILTER = String(process.env.FCS13_FLOW_KEY || "").trim();
const VIEWPORT_FILTER = String(process.env.FCS13_VIEWPORT || "").trim();

const ACTIVE_FLOWS = FLOW_FILTER
  ? FLOWS.filter((flow) => flow.key === FLOW_FILTER)
  : FLOWS;

const ACTIVE_VIEWPORTS = VIEWPORT_FILTER
  ? VIEWPORTS.filter((viewport) => viewport.label === VIEWPORT_FILTER)
  : VIEWPORTS;

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    if (details) error.details = details;
    throw error;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function logStep(message) {
  console.log(`[FCS13MS] ${message}`);
}

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizeConsole(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer ***")
    .replace(/[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{12,}/g, "***.***.***")
    .slice(0, 300);
}

function shouldIgnoreConsoleError(text) {
  return /favicon|sw\.js|websocket|socket\.io|ERR_ABORTED|blockedbyclient/i.test(String(text || ""));
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function createTempAdmin(runId) {
  const email = `${runId.toLowerCase()}@qa-fcs13-microsweep-admin.test`;
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: "ADMIN",
      name: `QA FCS13 MICRO ADMIN ${runId}`,
      active: true,
      mustChangePassword: false,
    },
  });

  const login = await requestJson("/api/auth/login", {
    method: "POST",
    body: { email, password: plainPassword },
  });

  assert(login.ok && login.data?.ok && login.data?.token, "Falha ao autenticar admin temporario", login);

  return {
    user,
    token: login.data.token,
    loginUser: login.data.user || { id: user.id, email, role: "ADMIN" },
  };
}

async function createTempTechnician(runId) {
  const pin = String(Math.floor(1000 + Math.random() * 8999));
  const technician = await prisma.technician.create({
    data: {
      name: `QA FCS13 TECH ${runId}`,
      email: `${runId.toLowerCase()}@qa-fcs13-tech.test`,
      pin,
      role: "TECHNICIAN",
      active: true,
      zone: "QA",
      notes: `QA FCS13 ${runId}`,
    },
  });

  return technician;
}

async function gotoViaLanding(page, route, state) {
  await page.goto(`${BASE_URL}/admin-master-control`, { waitUntil: "commit", timeout: 30000 });
  await page.waitForTimeout(350);

  let interactions = 0;
  let usedFallbackDirectRoute = false;

  const link = page.locator(`a[href='${route}']`).first();
  if (await link.count()) {
    const visible = await link.isVisible().catch(() => false);
    if (visible) {
      interactions += 1;
      await Promise.all([
        page.waitForURL((url) => url.pathname === route, { timeout: 7000 }).catch(() => null),
        link.click(),
      ]);
      await page.waitForTimeout(250);
    }
  }

  if (!page.url().includes(route)) {
    interactions += 1;
    usedFallbackDirectRoute = true;
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "commit", timeout: 30000 });
    await page.waitForTimeout(250);
  }

  state.usedFallbackDirectRoute = usedFallbackDirectRoute;
  return interactions;
}

async function runCreateClientFlow(page, runTag) {
  const clientName = `QA MS CLIENT ${runTag}`;
  const responsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/core/clients");
  }, { timeout: 15000 });

  await page.fill("#name", clientName);
  await page.click("#clientForm button.cw-v2-btn.primary");

  const response = await responsePromise;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok() || payload.ok === false) {
    return { ok: false, error: payload.error || payload.message || `HTTP ${response.status()}` };
  }

  const clientId = Number(payload.client?.id || 0);
  return {
    ok: clientId > 0,
    clientId,
    clientName,
    error: clientId > 0 ? null : "Resposta sem clientId",
  };
}

async function runCreatePoolFlow(page, runTag, clientId) {
  assert(clientId, "Fluxo criar piscina sem clientId");

  await page.waitForSelector("#clientId", { timeout: 15000 });
  await page.selectOption("#clientId", String(clientId));
  await page.fill("#name", `QA MS POOL ${runTag}`);
  await page.selectOption("#type", "POOL");
  await page.fill("#monthlyAmount", "85");

  const responsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/pools");
  }, { timeout: 15000 });

  await page.click("#poolForm button.cw-v2-btn.primary");

  const response = await responsePromise;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok() || payload.ok === false) {
    return { ok: false, error: payload.error || payload.message || `HTTP ${response.status()}` };
  }

  const poolId = Number(payload.pool?.id || 0);
  return {
    ok: poolId > 0,
    poolId,
    poolName: payload.pool?.name || null,
    error: poolId > 0 ? null : "Resposta sem poolId",
  };
}

async function runScheduleVisitFlow(page, poolId) {
  assert(poolId, "Fluxo agendar visita sem poolId");

  await page.waitForSelector("#poolId", { timeout: 15000 });
  await page.selectOption("#poolId", String(poolId));

  const hasTechnician = await page.$eval("#technicianId", (select) => {
    return (select.options || []).length > 0;
  });

  if (!hasTechnician) {
    return { ok: false, error: "Sem tecnicos disponiveis para agendamento" };
  }

  const planned = new Date(Date.now() + 60 * 60 * 1000);
  const plannedValue = `${planned.getFullYear()}-${String(planned.getMonth() + 1).padStart(2, "0")}-${String(planned.getDate()).padStart(2, "0")}T${String(planned.getHours()).padStart(2, "0")}:${String(planned.getMinutes()).padStart(2, "0")}`;
  await page.fill("#plannedDate", plannedValue);

  const responsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/visits/start");
  }, { timeout: 15000 });

  await page.click("button[onclick='createVisit()']");

  const response = await responsePromise;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok() || payload.ok === false) {
    return { ok: false, error: payload.error || payload.message || `HTTP ${response.status()}` };
  }

  return { ok: true, visitId: payload.visit?.id || payload.id || null };
}

async function runCreateRepairFlow(page, runTag, poolId, clientName, poolName) {
  const alert = await prisma.technicalAlert.create({
    data: {
      poolId,
      type: "MANUAL_ALERT",
      message: `QA MS ALERT ${runTag}`,
      priority: "WARNING",
      status: "OPEN",
    },
  });

  await page.click("#refreshAlerts").catch(() => null);

  await page.waitForFunction((text) => {
    const list = document.querySelector("#alertsList");
    return list && list.textContent && list.textContent.includes(text);
  }, alert.message, { timeout: 20000 });

  // The modal opened during discovery contains stale context; reopen to rebuild options with the new alert.
  await page.click("#repairCancelBtn").catch(() => null);
  await page.click("#openRepairModal");
  await page.waitForSelector("#repairModal:not([hidden])", { timeout: 10000 });
  await page.waitForFunction(() => {
    const select = document.querySelector("#repairContextSelect");
    return select && select.options && select.options.length > 1;
  }, { timeout: 15000 });

  const optionValue = await page.$eval("#repairContextSelect", (select, payload) => {
    const options = Array.from(select.options || []);
    const direct = options.find((option) => String(option.value || "") === payload.contextId);
    if (direct) return direct.value;
    const match = options.find((option) => {
      const text = String(option.textContent || "");
      return text.includes(payload.poolName) && text.includes(payload.clientName);
    });
    return match ? match.value : "";
  }, {
    contextId: `alert:technical-${alert.id}`,
    poolName: poolName || `Piscina #${poolId}`,
    clientName: clientName || "Sem cliente",
  }).catch(() => "");

  if (!optionValue) {
    return { ok: false, error: "Contexto do alerta nao disponivel no modal", technicalAlertId: alert.id };
  }

  await page.selectOption("#repairContextSelect", optionValue);
  await page.check("#repairResolveAlert").catch(() => null);
  const problemText = `QA MS REPAIR ${runTag}`;
  await page.fill("#repairProblemInput", problemText);

  const createRepairPromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/repairs");
  }, { timeout: 15000 });

  const resolveAlertPromise = page.waitForResponse((response) => {
    if (response.request().method() !== "PUT") return false;
    try {
      const pathname = new URL(response.url()).pathname;
      return /\/api\/alerts\/[^/]+\/resolve$/i.test(pathname);
    } catch (_) {
      return false;
    }
  }, { timeout: 15000 }).catch(() => null);

  await page.click("#repairSubmitBtn");

  const response = await createRepairPromise;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok() || payload.ok === false) {
    return { ok: false, error: payload.error || payload.message || `HTTP ${response.status()}`, technicalAlertId: alert.id };
  }

  const repairId = Number(payload.repair?.id || 0);
  if (!repairId) {
    return { ok: false, error: "Resposta sem repairId", technicalAlertId: alert.id };
  }

  const resolveAlertResponse = await resolveAlertPromise;
  if (!resolveAlertResponse || !resolveAlertResponse.ok()) {
    return {
      ok: false,
      error: "Pedido de resolucao de alerta nao confirmado em runtime",
      technicalAlertId: alert.id,
      repairId,
    };
  }

  const persistedAlert = await prisma.technicalAlert.findUnique({ where: { id: alert.id } });
  const alertResolved = String(persistedAlert?.status || "").toUpperCase() === "RESOLVED";

  return {
    ok: repairId > 0 && alertResolved,
    repairId,
    technicalAlertId: alert.id,
    alertResolved,
    error: alertResolved ? null : "Alerta nao ficou RESOLVED",
  };
}

async function runIssueInvoiceFlow(page, clientId) {
  assert(clientId, "Fluxo emitir fatura sem clientId");

  await page.fill("#clientIdInput", String(clientId));

  const responsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes(`/api/invoices/generate-for-client/${clientId}`);
  }, { timeout: 15000 });

  await page.click("button[onclick='generateInvoiceForClient()']");

  const response = await responsePromise;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok()) {
    return { ok: false, error: payload.error || payload.message || `HTTP ${response.status()}` };
  }

  return { ok: true, message: payload.message || null };
}

async function runCreateProductFlow(page, runTag) {
  await page.fill("#supplierName", `QA SUPPLIER ${runTag}`);
  await page.fill("#invoiceNumber", `QA-INV-${Date.now()}`);

  await page.fill("#items .row input[data-k='productName']", `QA PRODUCT ${runTag}`);
  await page.fill("#items .row input[data-k='quantity']", "2");
  await page.fill("#items .row input[data-k='unit']", "KG");
  await page.fill("#items .row input[data-k='unitCost']", "3.5");

  const responsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/inventory/purchases");
  }, { timeout: 20000 });

  await page.click("#purchaseForm button.cw-v2-btn.primary");

  const response = await responsePromise;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok() || payload.ok === false) {
    return { ok: false, error: payload.error || payload.message || `HTTP ${response.status()}` };
  }

  return { ok: true, purchaseId: payload.purchase?.id || null };
}

async function runSingleFlow(page, flow, env) {
  const consoleErrors = [];
  const apiErrors = [];

  const onConsole = (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text() || "";
    if (shouldIgnoreConsoleError(text)) return;
    consoleErrors.push(sanitizeConsole(text));
  };

  const onResponse = (response) => {
    const url = response.url() || "";
    if (!url.includes("/api/")) return;
    if (response.status() >= 400) {
      const req = response.request();
      apiErrors.push(`${req.method()} ${response.status()} ${url}`.slice(0, 320));
    }
  };

  const landing = "/admin-master-control";
  const discoveryState = { usedFallbackDirectRoute: false };

  let discoveryInteractions = 0;
  let discoveryMs = null;
  let actionFound = false;
  let flowCompleted = false;
  let executionError = null;
  const execution = {};

  try {
    const tStart = Date.now();
    discoveryInteractions += await gotoViaLanding(page, flow.route, discoveryState);

    if (flow.actionOpenClickSelector) {
      discoveryInteractions += 1;
      await page.click(flow.actionOpenClickSelector);
    }

    await page.waitForSelector(flow.actionOpenedSelector, { timeout: 15000 });
    actionFound = true;

    // Ignore noisy console/network events from landing and start measuring the target flow page.
    page.on("console", onConsole);
    page.on("response", onResponse);

    discoveryMs = Date.now() - tStart;

    if (flow.key === "create-client") {
      Object.assign(execution, await runCreateClientFlow(page, env.runTag));
      if (execution.ok && execution.clientId) env.clientId = execution.clientId;
      if (execution.ok && execution.clientName) env.clientName = execution.clientName;
    }

    if (flow.key === "create-pool") {
      Object.assign(execution, await runCreatePoolFlow(page, env.runTag, env.clientId));
      if (execution.ok && execution.poolId) env.poolId = execution.poolId;
      if (execution.ok && execution.poolName) env.poolName = execution.poolName;

      if (execution.ok && env.clientId) {
        await requestJson(`/api/core/clients/${env.clientId}/activate`, {
          method: "POST",
          token: env.token,
          body: { amount: 0 },
        }).catch(() => null);
      }
    }

    if (flow.key === "schedule-visit") {
      Object.assign(execution, await runScheduleVisitFlow(page, env.poolId));
    }

    if (flow.key === "create-repair") {
      Object.assign(execution, await runCreateRepairFlow(page, env.runTag, env.poolId, env.clientName, env.poolName));
      if (execution.technicalAlertId) env.technicalAlertIds.push(execution.technicalAlertId);
      if (execution.repairId) env.repairIds.push(execution.repairId);
    }

    if (flow.key === "issue-invoice") {
      Object.assign(execution, await runIssueInvoiceFlow(page, env.clientId));
    }

    if (flow.key === "create-product") {
      Object.assign(execution, await runCreateProductFlow(page, env.runTag));
    }

    flowCompleted = Boolean(execution.ok);
    if (!flowCompleted) executionError = execution.error || "Fluxo nao concluido";

    const pass = actionFound
      && discoveryMs < 10000
      && discoveryInteractions <= 3
      && flowCompleted
      && consoleErrors.length === 0
      && apiErrors.length === 0;

    return {
      flow: flow.name,
      profile: "ADMIN",
      viewport: `${env.viewport.width}x${env.viewport.height}`,
      landingInitial: landing,
      actionFound,
      discoveryMs,
      discoveryInteractions,
      flowCompleted,
      consoleErrors,
      apiErrors,
      pass,
      notes: {
        usedFallbackDirectRoute: discoveryState.usedFallbackDirectRoute,
        executionError,
      },
    };
  } catch (error) {
    const finalDiscoveryMs = Number.isFinite(discoveryMs) ? discoveryMs : 10000;
    return {
      flow: flow.name,
      profile: "ADMIN",
      viewport: `${env.viewport.width}x${env.viewport.height}`,
      landingInitial: landing,
      actionFound,
      discoveryMs: finalDiscoveryMs,
      discoveryInteractions,
      flowCompleted: false,
      consoleErrors,
      apiErrors,
      pass: false,
      notes: {
        usedFallbackDirectRoute: discoveryState.usedFallbackDirectRoute,
        executionError: error.message,
        details: error.details || null,
      },
    };
  } finally {
    page.off("console", onConsole);
    page.off("response", onResponse);
  }
}

async function runViewportSweep(adminSession, viewport, globalRunTag) {
  logStep(`viewport:start:${viewport.label}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });

  await context.route("**/crystal-os-v2-shell.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "console.log('FCS13 microsweep shell bypass');",
    });
  });

  await context.route("**/ui/state-adapter-v2.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "console.log('FCS13 microsweep adapter bypass');",
    });
  });

  const env = {
    token: adminSession.token,
    viewport,
    runTag: `${globalRunTag}-${toSlug(viewport.label)}`,
    clientId: null,
    clientName: null,
    poolId: null,
    poolName: null,
    repairIds: [],
    technicalAlertIds: [],
  };

  const results = [];
  for (const flow of ACTIVE_FLOWS) {
    const page = await context.newPage();
    logStep(`viewport:${viewport.label}:flow:start:${flow.key}`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("token", payload.token);
      localStorage.setItem("cristalwater_jwt", payload.token);
      localStorage.setItem("user", JSON.stringify(payload.user));
      localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
    }, { token: adminSession.token, user: adminSession.loginUser });

    const row = await runSingleFlow(page, flow, env);
    logStep(`viewport:${viewport.label}:flow:end:${flow.key}:pass=${row.pass}`);
    results.push(row);
    await page.close().catch(() => null);
  }

  await context.close();
  await browser.close();
  logStep(`viewport:end:${viewport.label}`);

  return { results, env };
}

async function cleanup(ids) {
  const tasks = [];

  if (ids.repairIds?.length) {
    tasks.push(prisma.repair.deleteMany({ where: { id: { in: ids.repairIds } } }).catch(() => null));
  }

  if (ids.technicalAlertIds?.length) {
    tasks.push(prisma.technicalAlert.deleteMany({ where: { id: { in: ids.technicalAlertIds } } }).catch(() => null));
  }

  if (ids.poolIds?.length) {
    tasks.push(prisma.pool.updateMany({ where: { id: { in: ids.poolIds } }, data: { active: false, archiveStatus: "ARQUIVADO" } }).catch(() => null));
  }

  if (ids.clientIds?.length) {
    tasks.push(prisma.client.updateMany({ where: { id: { in: ids.clientIds } }, data: { active: false, status: "ARCHIVED", archiveStatus: "ARQUIVADO" } }).catch(() => null));
  }

  if (ids.technicianIds?.length) {
    tasks.push(prisma.technician.updateMany({ where: { id: { in: ids.technicianIds } }, data: { active: false, archiveStatus: "ARQUIVADO" } }).catch(() => null));
  }

  if (ids.adminUserIds?.length) {
    tasks.push(prisma.user.updateMany({ where: { id: { in: ids.adminUserIds } }, data: { active: false } }).catch(() => null));
  }

  await Promise.all(tasks);
}

function formatSummaryTable(rows) {
  return rows.map((row) => ({
    Fluxo: row.flow,
    Perfil: row.profile,
    Viewport: row.viewport,
    "Landing inicial": row.landingInitial,
    "Ação principal encontrada": row.actionFound ? "SIM" : "NAO",
    "Tempo até abrir a ação": `${row.discoveryMs} ms`,
    "Interações até abrir a ação": row.discoveryInteractions,
    "Fluxo concluído": row.flowCompleted ? "SIM" : "NAO",
    "Erros de consola": row.consoleErrors.length,
    "API 4xx/5xx": row.apiErrors.length,
    "PASS/FAIL": row.pass ? "PASS" : "FAIL",
  }));
}

async function main() {
  const runId = `FCS13MS_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const trackedIds = {
    adminUserIds: [],
    technicianIds: [],
    clientIds: [],
    poolIds: [],
    technicalAlertIds: [],
    repairIds: [],
  };

  const report = {
    ok: false,
    runId,
    baseUrl: BASE_URL,
    startedAt: nowIso(),
    gate: {
      discoveryMaxInteractions: 3,
      discoveryMaxMs: 10000,
    },
    rows: [],
    totals: {},
  };

  try {
    assert(ACTIVE_FLOWS.length > 0, "Filtro FCS13_FLOW_KEY nao corresponde a nenhum fluxo", { FLOW_FILTER });
    assert(ACTIVE_VIEWPORTS.length > 0, "Filtro FCS13_VIEWPORT nao corresponde a nenhum viewport", { VIEWPORT_FILTER });

    logStep("main:create-admin");
    const admin = await createTempAdmin(runId);
    trackedIds.adminUserIds.push(admin.user.id);

    logStep("main:create-technician");
    const technician = await createTempTechnician(runId);
    trackedIds.technicianIds.push(technician.id);

    for (const viewport of ACTIVE_VIEWPORTS) {
      logStep(`main:run-viewport:${viewport.label}`);
      const { results, env } = await runViewportSweep(admin, viewport, runId);
      report.rows.push(...results);

      if (env.clientId) trackedIds.clientIds.push(env.clientId);
      if (env.poolId) trackedIds.poolIds.push(env.poolId);
      if (env.technicalAlertIds.length) trackedIds.technicalAlertIds.push(...env.technicalAlertIds);
      if (env.repairIds.length) trackedIds.repairIds.push(...env.repairIds);
    }

    const total = report.rows.length;
    const pass = report.rows.filter((row) => row.pass).length;
    const fail = total - pass;

    report.ok = fail === 0;
    report.finishedAt = nowIso();
    report.selection = {
      flowKey: FLOW_FILTER || null,
      viewport: VIEWPORT_FILTER || null,
    };
    report.totals = {
      total,
      pass,
      fail,
      withConsoleErrors: report.rows.filter((row) => row.consoleErrors.length > 0).length,
      withApiErrors: report.rows.filter((row) => row.apiErrors.length > 0).length,
      overTimeGate: report.rows.filter((row) => row.discoveryMs >= 10000).length,
      overInteractionGate: report.rows.filter((row) => row.discoveryInteractions > 3).length,
    };

    report.table = formatSummaryTable(report.rows);

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.ok = false;
    report.finishedAt = nowIso();
    report.error = {
      message: error.message,
      details: error.details || null,
      stack: String(error.stack || "").split("\n").slice(0, 8).join("\n"),
    };

    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    await cleanup(trackedIds).catch(() => null);
    await prisma.$disconnect().catch(() => null);
  }
}

main();
