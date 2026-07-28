const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { chromium, devices } = require("playwright");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs-technician-operations-sprint4-1");
const REPORT_JSON = path.join(ROOT, "reports", `fcs-technician-operations-sprint4-1-${Date.now()}.json`);

const VIEWPORTS = [
  {
    id: "desktop",
    label: "Desktop 1440x920",
    contextOptions: { viewport: { width: 1440, height: 920 }, colorScheme: "light" },
  },
  {
    id: "mobile390",
    label: "Mobile 390x844",
    contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "light" },
  },
  {
    id: "pixel7",
    label: "Pixel 7",
    contextOptions: { ...devices["Pixel 7"], colorScheme: "light" },
  },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function contains(haystack, text) {
  return String(haystack || "").toLowerCase().includes(String(text || "").toLowerCase());
}

function randomToken(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function http(method, endpoint, token, body) {
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

async function primeSession(page, user, token, extra = {}) {
  await page.addInitScript(({ userData, tokenValue, extraData }) => {
    localStorage.setItem("token", tokenValue);
    localStorage.setItem("cristalwater_jwt", tokenValue);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("cristalwater_user", JSON.stringify(userData));
    if (extraData.technicianId) localStorage.setItem("technicianId", String(extraData.technicianId));
    if (extraData.vehicleId) localStorage.setItem("cwVehicleId", String(extraData.vehicleId));
  }, { userData: user, tokenValue: token, extraData: extra });
}

async function runViewport(browser, viewport, contextData) {
  console.log(`[S41] viewport:start:${viewport.id}`);
  const context = await browser.newContext(viewport.contextOptions);
  const page = await context.newPage();
  const checks = [];
  const consoleErrors = [];
  const apiErrors = [];
  const addCheck = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });

  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      const text = msg.text();
      if (!contains(text, "favicon") && !contains(text, "deprecated")) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    if (response.status() >= 400) apiErrors.push({ url, status: response.status() });
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror:${String(err?.message || err)}`);
  });

  page.on("dialog", async (dialog) => {
    console.log(`[S41] viewport:dialog:${viewport.id}:${dialog.type()}:${dialog.message()}`);
    await dialog.dismiss().catch(() => null);
  });

  try {
    const proposalReason = contextData.seedProposalReason;

    const techUiResponse = await fetch(`${BASE_URL}/technician-field-mode`, {
      headers: { Authorization: `Bearer ${contextData.technician.token}` },
    });
    const techUiHtml = await techUiResponse.text();
    const hasProposalInputs = ["proposalFieldName", "proposalReason", "submitTechnicalProposalBtn", "technicalProposalList"]
      .every((id) => techUiHtml.includes(`id=\"${id}\"`) || techUiHtml.includes(`id='${id}'`));
    addCheck("tecnico-card-proposta-visivel", hasProposalInputs, `ready=${hasProposalInputs}`);
    addCheck("tecnico-form-proposta-presente", hasProposalInputs, `present=${hasProposalInputs}`);
    addCheck("tecnico-ui-http-200", techUiResponse.status === 200, `status=${techUiResponse.status}`);

    ensureFolder(EVIDENCE_DIR);
    const techShot = path.join(EVIDENCE_DIR, `s41-tech-${viewport.id}.png`);
    let techShotSaved = false;

    const adminPage = await context.newPage();
    adminPage.on("pageerror", (err) => {
      consoleErrors.push(`admin-pageerror:${String(err?.message || err)}`);
    });
    adminPage.on("dialog", async (dialog) => {
      console.log(`[S41] viewport:admin-dialog:${viewport.id}:${dialog.type()}:${dialog.message()}`);
      await dialog.dismiss().catch(() => null);
    });
    await primeSession(
      adminPage,
      { id: contextData.admin.userId, role: "ADMIN", name: contextData.admin.name, email: contextData.admin.email },
      contextData.admin.token
    );
    console.log(`[S41] viewport:admin-goto:start:${viewport.id}`);
    await adminPage.goto(`${BASE_URL}/admin-pool-technical?poolId=${contextData.pool.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await adminPage.waitForFunction(() => {
      const summary = String(document.querySelector("#technicalProposalSummary")?.textContent || "").trim();
      const list = String(document.querySelector("#technicalProposalAdminList")?.textContent || "").trim();
      const loadingSummary = summary === "" || /A carregar propostas/i.test(summary);
      const loadingList = list === "" || /A carregar propostas/i.test(list);
      return !loadingSummary && !loadingList;
    }, null, { timeout: 12000 }).catch(() => null);
    await adminPage.waitForTimeout(600);
    console.log(`[S41] viewport:admin-ready:${viewport.id}`);

    const adminProposalText = await adminPage.evaluate(() => String(document.querySelector("#technicalProposalAdminList")?.textContent || "").trim());
    const hasExpectedField = contains(adminProposalText, "volumeM3") || contains(adminProposalText, "pumpPower");
    addCheck("admin-ve-proposta", contains(adminProposalText, proposalReason) && hasExpectedField, adminProposalText);

    const summaryText = await adminPage.evaluate(() => String(document.querySelector("#technicalProposalSummary")?.textContent || "").trim());
    addCheck("resumo-risco-visivel", contains(summaryText, "Baixo") && contains(summaryText, "Médio") && contains(summaryText, "Alto"), summaryText);

    const adminShot = path.join(EVIDENCE_DIR, `s41-admin-${viewport.id}.png`);
    let adminShotSaved = false;
    console.log(`[S41] viewport:screenshot-admin:start:${viewport.id}`);
    try {
      await adminPage.locator("#technicalProposalAdminList").screenshot({ path: adminShot });
      adminShotSaved = true;
      console.log(`[S41] viewport:screenshot-admin:done:${viewport.id}`);
    } catch (error) {
      console.log(`[S41] viewport:screenshot-admin:skip:${viewport.id}:${error.message}`);
    }

    addCheck("sem-erros-console", consoleErrors.length === 0, `consoleErrors=${consoleErrors.length}`);
    addCheck("sem-erros-api", apiErrors.length === 0, `apiErrors=${apiErrors.length}`);

    console.log(`[S41] viewport:end:${viewport.id}:pass=${checks.every((item) => item.pass)}`);

    return {
      viewport: viewport.label,
      viewportId: viewport.id,
      checks,
      pass: checks.every((item) => item.pass),
      consoleErrors,
      apiErrors,
      screenshots: [
        techShotSaved ? path.relative(ROOT, techShot) : null,
        adminShotSaved ? path.relative(ROOT, adminShot) : null,
      ].filter(Boolean),
    };
  } finally {
    await context.close();
  }
}

(async () => {
  const created = { users: [], technicians: [], clients: [], pools: [], visits: [] };
  const apiChecks = [];
  const pushApiCheck = (id, pass, detail) => apiChecks.push({ id, pass: Boolean(pass), detail });
  const startedAt = Date.now();

  ensureDir(REPORT_JSON);

  try {
    console.log("[S41] setup:start");
    const adminPass = `Pw-${randomToken("admin")}-A1!`;
    const adminEmail = `${randomToken("admin")}@qa-s41.test`;
    const adminHash = await bcrypt.hash(adminPass, 10);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: adminHash,
        role: "ADMIN",
        name: "QA S41 ADMIN",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(adminUser.id);

    const pin = String(Math.floor(1000 + Math.random() * 8999));
    const tech = await prisma.technician.create({
      data: {
        name: `QA S41 TECH ${randomToken("t")}`,
        email: `${randomToken("tech")}@qa-s41.test`,
        pin,
        role: "TECHNICIAN",
        active: true,
        zone: "QA",
      },
    });
    created.technicians.push(tech.id);

    const client = await prisma.client.create({
      data: {
        name: `QA S41 CLIENT ${randomToken("c")}`,
        status: "ACTIVE",
        active: true,
      },
    });
    created.clients.push(client.id);

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA S41 POOL ${randomToken("p")}`,
        type: "POOL",
        active: true,
        zone: "QA",
      },
    });
    created.pools.push(pool.id);

    const visit = await prisma.serviceVisit.create({
      data: {
        clientId: client.id,
        poolId: pool.id,
        technicianId: tech.id,
        technicianName: tech.name,
        plannedDate: new Date(),
        status: "PLANNED",
      },
    });
    created.visits.push(visit.id);

    const adminLogin = await http("POST", "/api/auth/login", null, { email: adminEmail, password: adminPass });
    if (adminLogin.status !== 200 || !adminLogin.data?.token) throw new Error("admin login failed");

    const techLogin = await http("POST", "/api/technician-auth/login", null, { pin });
    if (techLogin.status !== 200 || !techLogin.data?.token) throw new Error("technician login failed");
    console.log("[S41] setup:auth-ready");

    const anonProposal = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals`, null, {
      reason: "x",
      changes: [{ field: "pumpPower", before: "1", after: "2" }],
    });
    pushApiCheck("anon-proposal-blocked", anonProposal.status === 401, `status=${anonProposal.status}`);

    const missingReason = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals`, techLogin.data.token, {
      changes: [{ field: "pumpPower", before: "1", after: "2" }],
    });
    pushApiCheck("motivo-obrigatorio", missingReason.status === 400, `status=${missingReason.status}`);

    const seedProposalReason = "Ajuste de cubicagem validado em campo";
    const highRiskProposal = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals`, techLogin.data.token, {
      reason: seedProposalReason,
      changes: [{ field: "volumeM3", before: "68", after: "72" }],
      photos: ["https://example.com/volume-before.jpg"],
    });
    pushApiCheck("proposta-criada", highRiskProposal.status === 201, `status=${highRiskProposal.status}`);
    pushApiCheck("risco-auto-high", String(highRiskProposal.data?.proposal?.riskLevel || "") === "HIGH", JSON.stringify(highRiskProposal.data?.proposal || {}));

    const proposalsTech = await http("GET", `/api/core/pools/${pool.id}/technical-change-proposals?onlyPending=true`, techLogin.data.token);
    const hasPhotos = Array.isArray(proposalsTech.data?.proposals) && proposalsTech.data.proposals.some((item) => Array.isArray(item.photos) && item.photos.length > 0);
    pushApiCheck("tecnico-lista-propostas", proposalsTech.status === 200 && hasPhotos, `status=${proposalsTech.status}`);

    const proposalsAdmin = await http("GET", `/api/core/pools/${pool.id}/technical-change-proposals`, adminLogin.data.token);
    pushApiCheck("admin-lista-propostas", proposalsAdmin.status === 200 && Array.isArray(proposalsAdmin.data?.proposals), `status=${proposalsAdmin.status}`);

    const techCannotUpdateSheet = await http("PUT", `/api/core/pools/${pool.id}/technical-sheet`, techLogin.data.token, { name: "Nao deve atualizar" });
    pushApiCheck("permissoes-tecnico-sem-edicao-direta", techCannotUpdateSheet.status === 403, `status=${techCannotUpdateSheet.status}`);

    const contextData = {
      admin: { token: adminLogin.data.token, name: adminUser.name, email: adminUser.email, userId: adminUser.id },
      technician: { token: techLogin.data.token, id: tech.id, name: tech.name, userId: tech.id },
      pool,
      seedProposalReason,
    };

    const viewportResults = [];
    const browser = await chromium.launch({ headless: true });
    try {
      for (const viewport of VIEWPORTS) {
        viewportResults.push(await runViewport(browser, viewport, contextData));
      }
    } finally {
      await browser.close();
    }
    console.log("[S41] ui:done");

    const allChecks = [...apiChecks, ...viewportResults.flatMap((item) => item.checks)];
    const passed = allChecks.filter((item) => item.pass).length;

    const report = {
      ok: allChecks.length > 0 && passed === allChecks.length,
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      runtimeMs: Date.now() - startedAt,
      totals: {
        checks: allChecks.length,
        passed,
        failed: allChecks.length - passed,
      },
      apiChecks,
      results: viewportResults,
    };

    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_JSON)}`);
    console.log(`RESULT=${report.ok ? "PASS" : "FAIL"}`);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error("FCS_TECHNICIAN_SPRINT41_ERROR", error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.visits.length) {
        await prisma.serviceVisit.deleteMany({ where: { id: { in: created.visits } } }).catch(() => null);
      }
      if (created.pools.length) await prisma.pool.deleteMany({ where: { id: { in: created.pools } } }).catch(() => null);
      if (created.clients.length) await prisma.client.deleteMany({ where: { id: { in: created.clients } } }).catch(() => null);
      if (created.technicians.length) await prisma.technician.deleteMany({ where: { id: { in: created.technicians } } }).catch(() => null);
      if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => null);
    } catch (_) {}
    await prisma.$disconnect().catch(() => null);
  }
})();
