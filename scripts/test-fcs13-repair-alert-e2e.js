const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    if (details) error.details = details;
    throw error;
  }
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
  const email = `${runId.toLowerCase()}@qa-fcs13-admin.test`;
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: "ADMIN",
      name: `QA FCS13 ADMIN ${runId}`,
      active: true,
      mustChangePassword: false,
    },
  });

  const login = await requestJson("/api/auth/login", {
    method: "POST",
    body: { email, password: plainPassword },
  });

  assert(login.ok && login.data && login.data.ok && login.data.token, "Falha ao autenticar admin temporario", login);

  return {
    user,
    token: login.data.token,
    loginUser: login.data.user || { id: user.id, email, role: "ADMIN" },
  };
}

async function createTempClientAndPool(runId) {
  const clientPassword = await bcrypt.hash(`TmpClient-${runId}`, 10);

  const client = await prisma.client.create({
    data: {
      name: `QA FCS13 CLIENT ${runId}`,
      email: `${runId.toLowerCase()}@qa-fcs13-client.test`,
      password: clientPassword,
      status: "ACTIVE",
      active: true,
      archiveStatus: "ATIVO",
      source: "QA_FCS13",
      notes: `QA FCS13 ${runId}`,
    },
  });

  const pool = await prisma.pool.create({
    data: {
      clientId: client.id,
      name: `QA FCS13 POOL ${runId}`,
      type: "POOL",
      zone: "QA",
      location: `QA LAB ${runId}`,
      address: `QA LAB ${runId}`,
      active: true,
      archiveStatus: "ATIVO",
      notes: `QA FCS13 ${runId}`,
    },
  });

  return { client, pool };
}

async function createTechnicalAlert(pool, runId) {
  return prisma.technicalAlert.create({
    data: {
      poolId: pool.id,
      type: "MANUAL_ALERT",
      message: `QA FCS13 ALERT ${runId}`,
      priority: "WARNING",
      status: "OPEN",
    },
  });
}

async function runUiScenario({ token, loginUser, alertMessage, poolName, clientName, poolId }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();

  const interactions = {
    openPage: 0,
    openModal: 0,
    selectContext: 0,
    fillProblem: 0,
    submitRepair: 0,
    refreshAndPersist: 0,
  };

  const timings = {};

  await page.addInitScript((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", payload.token);
    localStorage.setItem("cristalwater_jwt", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
  }, { token, user: loginUser });

  const t0 = Date.now();
  await page.goto(`${BASE_URL}/admin-alerts`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#alertsList", { timeout: 15000 });
  interactions.openPage += 1;
  timings.openPageMs = Date.now() - t0;

  await page.waitForFunction((text) => {
    const list = document.querySelector("#alertsList");
    return list && list.textContent && list.textContent.includes(text);
  }, alertMessage, { timeout: 15000 });

  const t1 = Date.now();
  await page.click("#openRepairModal");
  interactions.openModal += 1;
  await page.waitForSelector("#repairModal:not([hidden])", { timeout: 10000 });
  await page.waitForFunction(() => {
    const select = document.querySelector("#repairContextSelect");
    return select && select.options && select.options.length > 1;
  }, { timeout: 15000 });
  timings.openModalMs = Date.now() - t1;

  const contextValue = await page.$eval("#repairContextSelect", (select, payload) => {
    const options = Array.from(select.options || []);
    const match = options.find((option) => {
      const text = String(option.textContent || "");
      return text.includes(payload.poolName) && text.includes(payload.clientName);
    });
    return match ? match.value : "";
  }, { poolName, clientName });

  assert(contextValue, "Nao foi encontrado contexto do alerta para selecao");

  const t2 = Date.now();
  await page.selectOption("#repairContextSelect", contextValue);
  interactions.selectContext += 1;
  timings.selectContextMs = Date.now() - t2;

  await page.waitForFunction((id) => {
    const poolEl = document.querySelector("#repairPoolSelect");
    return poolEl && String(poolEl.value) === String(id);
  }, poolId, { timeout: 10000 });

  const problemText = `QA FCS13 PROBLEM ${Date.now()}`;
  const t3 = Date.now();
  await page.fill("#repairProblemInput", problemText);
  interactions.fillProblem += 1;
  timings.fillProblemMs = Date.now() - t3;

  const createResponsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/repairs") && response.request().method() === "POST";
  }, { timeout: 15000 });

  const t4 = Date.now();
  await page.click("#repairSubmitBtn");
  interactions.submitRepair += 1;
  const createResponse = await createResponsePromise;
  const createPayload = await createResponse.json().catch(() => ({}));
  timings.submitRepairMs = Date.now() - t4;

  assert(createResponse.ok(), "Falha HTTP ao criar reparacao", { status: createResponse.status(), payload: createPayload });
  assert(createPayload && createPayload.ok && createPayload.repair && createPayload.repair.id, "Resposta de criacao sem repair.id", createPayload);

  const repairId = Number(createPayload.repair.id);

  await page.waitForFunction((text) => {
    const status = document.querySelector("#alertsStatus");
    return status && status.textContent && status.textContent.includes(text);
  }, "fila atualizada", { timeout: 20000 }).catch(() => null);

  await page.waitForTimeout(1200);

  const openAlertStillVisible = await page.locator("#alertsList article", { hasText: alertMessage }).count();

  const t5 = Date.now();
  await page.reload({ waitUntil: "domcontentloaded" });
  interactions.refreshAndPersist += 1;
  await page.waitForSelector("#alertsList", { timeout: 15000 });
  timings.refreshAndPersistMs = Date.now() - t5;

  const repairsForPool = await page.evaluate(async (payload) => {
    const res = await fetch(`/api/repairs/pool/${encodeURIComponent(payload.poolId)}`, {
      headers: { Authorization: `Bearer ${payload.token}` },
    });
    const body = await res.json().catch(() => []);
    return { status: res.status, body };
  }, { token, poolId });

  await context.close();
  await browser.close();

  return {
    repairId,
    problemText,
    openAlertStillVisible,
    repairsForPool,
    interactions,
    timings,
  };
}

async function verifyPersistenceAndState({ repairId, technicalAlertId, token, poolId }) {
  const [repair, technicalAlert, repairPdfResponse, repairsByPool] = await Promise.all([
    prisma.repair.findUnique({ where: { id: repairId } }),
    prisma.technicalAlert.findUnique({ where: { id: technicalAlertId } }),
    fetch(`${BASE_URL}/api/repairs/${repairId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    requestJson(`/api/repairs/pool/${poolId}`, { token }),
  ]);

  const contentType = repairPdfResponse.headers.get("content-type") || "";

  assert(repair && Number(repair.id) === Number(repairId), "Reparacao nao persistiu na base de dados");
  assert(["RESOLVED", "DONE", "CLOSED"].includes(String(technicalAlert?.status || "").toUpperCase()), "Alerta nao mudou para estado fechado", technicalAlert);
  assert(repairPdfResponse.ok, "Nao foi possivel reabrir a reparacao via endpoint PDF", { status: repairPdfResponse.status });
  assert(contentType.toLowerCase().includes("application/pdf"), "Endpoint de reabertura nao devolveu PDF", { contentType });
  assert(repairsByPool.ok && Array.isArray(repairsByPool.data) && repairsByPool.data.some((item) => Number(item.id) === Number(repairId)), "Reparacao nao aparece na lista por piscina", repairsByPool);

  return {
    repairStatus: repair.status,
    alertStatus: technicalAlert.status,
    pdfStatus: repairPdfResponse.status,
    pdfContentType: contentType,
  };
}

async function bestEffortCleanup(ids) {
  const tasks = [];

  if (ids.technicalAlertId) {
    tasks.push(prisma.technicalAlert.deleteMany({ where: { id: ids.technicalAlertId } }).catch(() => null));
  }

  if (ids.poolId) {
    tasks.push(prisma.pool.updateMany({ where: { id: ids.poolId }, data: { active: false, archiveStatus: "ARQUIVADO" } }).catch(() => null));
  }

  if (ids.clientId) {
    tasks.push(prisma.client.updateMany({ where: { id: ids.clientId }, data: { active: false, archiveStatus: "ARQUIVADO", status: "ARCHIVED" } }).catch(() => null));
  }

  if (ids.adminUserId) {
    tasks.push(prisma.user.updateMany({ where: { id: ids.adminUserId }, data: { active: false } }).catch(() => null));
  }

  await Promise.all(tasks);
}

async function main() {
  const runId = `FCS13_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ids = {
    adminUserId: null,
    clientId: null,
    poolId: null,
    technicalAlertId: null,
    repairId: null,
  };

  const report = {
    ok: false,
    runId,
    baseUrl: BASE_URL,
    startedAt: new Date().toISOString(),
    scenario: [
      "1. Abrir Alertas",
      "2. Carregar em Nova reparacao",
      "3. Selecionar contexto de alerta (ou cliente+piscina)",
      "4. Criar reparacao",
      "5. Confirmar reparacao na lista por piscina",
      "6. Confirmar alerta resolvido",
      "7. Reabrir reparacao e confirmar persistencia",
    ],
  };

  try {
    const admin = await createTempAdmin(runId);
    ids.adminUserId = admin.user.id;

    const { client, pool } = await createTempClientAndPool(runId);
    ids.clientId = client.id;
    ids.poolId = pool.id;

    const technicalAlert = await createTechnicalAlert(pool, runId);
    ids.technicalAlertId = technicalAlert.id;

    const uiResult = await runUiScenario({
      token: admin.token,
      loginUser: admin.loginUser,
      alertMessage: technicalAlert.message,
      poolName: pool.name,
      clientName: client.name,
      poolId: pool.id,
    });

    ids.repairId = uiResult.repairId;

    const verification = await verifyPersistenceAndState({
      repairId: uiResult.repairId,
      technicalAlertId: technicalAlert.id,
      token: admin.token,
      poolId: pool.id,
    });

    report.ok = true;
    report.finishedAt = new Date().toISOString();
    report.ids = {
      adminUserId: ids.adminUserId,
      clientId: ids.clientId,
      poolId: ids.poolId,
      technicalAlertId: ids.technicalAlertId,
      repairId: ids.repairId,
    };
    report.assertions = {
      alertVisibleBeforeCreate: true,
      repairCreated: Boolean(uiResult.repairId),
      repairListedByPool: true,
      alertClosed: true,
      repairReopenedViaPdf: true,
      persistenceConfirmed: true,
      alertStillVisibleAfterResolve: uiResult.openAlertStillVisible > 0,
    };
    report.ui = uiResult;
    report.verification = verification;

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.ok = false;
    report.finishedAt = new Date().toISOString();
    report.error = {
      message: error.message,
      details: error.details || null,
      stack: String(error.stack || "").split("\n").slice(0, 8).join("\n"),
    };
    report.ids = ids;

    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    await bestEffortCleanup(ids).catch(() => null);
    await prisma.$disconnect().catch(() => null);
  }
}

main();
