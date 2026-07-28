const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { chromium, devices } = require("playwright");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs-technician-operations-sprint4-3");
const REPORT_JSON = path.join(ROOT, "reports", `fcs-technician-operations-sprint4-3-${Date.now()}.json`);

const VIEWPORTS = [
  { id: "desktop", label: "Desktop 1440x920", contextOptions: { viewport: { width: 1440, height: 920 }, colorScheme: "light" } },
  { id: "mobile390", label: "Mobile 390x844", contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "light" } },
  { id: "pixel7", label: "Pixel 7", contextOptions: { ...devices["Pixel 7"], colorScheme: "light" } },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function randomToken(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function contains(haystack, text) {
  return String(haystack || "").toLowerCase().includes(String(text || "").toLowerCase());
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

async function primeSession(page, user, token) {
  await page.addInitScript(({ userData, tokenValue }) => {
    localStorage.setItem("token", tokenValue);
    localStorage.setItem("cristalwater_jwt", tokenValue);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("cristalwater_user", JSON.stringify(userData));
  }, { userData: user, tokenValue: token });
}

async function runAdminViewport(browser, viewport, contextData) {
  const context = await browser.newContext(viewport.contextOptions);
  const page = await context.newPage();
  const checks = [];
  const addCheck = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });

  try {
    await primeSession(
      page,
      { id: contextData.admin.userId, role: "ADMIN", name: contextData.admin.name, email: contextData.admin.email },
      contextData.admin.token
    );

    await page.goto(`${BASE_URL}/admin-pool-technical?poolId=${contextData.poolId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => {
      const summary = String(document.querySelector("#technicalProposalSummary")?.textContent || "").trim();
      const list = String(document.querySelector("#technicalProposalAdminList")?.textContent || "").trim();
      const loadingSummary = summary === "" || /A carregar propostas/i.test(summary);
      const loadingList = list === "" || /A carregar propostas/i.test(list);
      return !loadingSummary && !loadingList;
    }, null, { timeout: 12000 }).catch(() => null);
    await page.waitForTimeout(600);

    const summaryText = await page.evaluate(() => String(document.querySelector("#technicalProposalSummary")?.textContent || "").trim());
    addCheck(
      "admin-workflow-summary",
      contains(summaryText, "Aprovada") && contains(summaryText, "Pedida info"),
      summaryText
    );

    const controlsVisible = await page.evaluate(() => {
      return Boolean(
        document.querySelector("#proposalBatchApproveBtn")
        && document.querySelector("#proposalBatchNeedsInfoBtn")
        && document.querySelector("#proposalSelectPendingBtn")
        && document.querySelector("#proposalBatchRejectBtn")
        && document.querySelector("#proposalBatchReviewBtn")
      );
    });
    addCheck("admin-batch-controls-visible", controlsVisible, `visible=${controlsVisible}`);

    const listText = await page.evaluate(() => String(document.querySelector("#technicalProposalAdminList")?.textContent || "").trim());
    addCheck("admin-diff-visual-visible", contains(listText, "Diff visual") || contains(listText, "Alterações"), listText);

    const batchStatusNode = await page.evaluate(() => Boolean(document.querySelector("#proposalBatchStatus")));
    addCheck("admin-batch-status-node-visible", batchStatusNode, `visible=${batchStatusNode}`);

    ensureFolder(EVIDENCE_DIR);
    const shotPath = path.join(EVIDENCE_DIR, `s43-admin-${viewport.id}.png`);
    await page.locator("#technicalProposalAdminList").screenshot({ path: shotPath });

    return {
      viewport: viewport.label,
      viewportId: viewport.id,
      checks,
      pass: checks.every((item) => item.pass),
      screenshots: [path.relative(ROOT, shotPath)],
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
    const adminPass = `Pw-${randomToken("admin")}-A1!`;
    const adminEmail = `${randomToken("admin")}@qa-s43.test`;
    const adminHash = await bcrypt.hash(adminPass, 10);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: adminHash,
        role: "ADMIN",
        name: "QA S43 ADMIN",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(adminUser.id);

    const pin = String(Math.floor(1000 + Math.random() * 8999));
    const tech = await prisma.technician.create({
      data: {
        name: `QA S43 TECH ${randomToken("t")}`,
        email: `${randomToken("tech")}@qa-s43.test`,
        pin,
        role: "TECHNICIAN",
        active: true,
        zone: "QA",
      },
    });
    created.technicians.push(tech.id);

    const client = await prisma.client.create({ data: { name: `QA S43 CLIENT ${randomToken("c")}`, status: "ACTIVE", active: true } });
    created.clients.push(client.id);

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA S43 POOL ${randomToken("p")}`,
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

    const reasons = [
      "S43 proposta A",
      "S43 proposta B",
      "S43 proposta C",
    ];

    const createdProposals = [];
    for (let i = 0; i < reasons.length; i++) {
      const response = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals`, techLogin.data.token, {
        reason: reasons[i],
        changes: [{ field: i === 2 ? "volumeM3" : "pumpPower", before: i === 2 ? "68" : "1 CV", after: i === 2 ? "72" : `1.${i + 2} CV` }],
        photos: [`https://example.com/s43-${i + 1}.jpg`],
      });
      pushApiCheck(`proposal-created-${i + 1}`, response.status === 201, `status=${response.status}`);
      if (response.data?.proposal?.id) createdProposals.push(response.data.proposal.id);
    }

    pushApiCheck("proposal-count-3", createdProposals.length === 3, `count=${createdProposals.length}`);

    const listResponse = await http("GET", `/api/core/pools/${pool.id}/technical-change-proposals`, adminLogin.data.token);
    const listed = Array.isArray(listResponse.data?.proposals) ? listResponse.data.proposals : [];
    const proposalA = listed.find((item) => Number(item.id) === Number(createdProposals[0]));
    const hasDiff = Array.isArray(proposalA?.diff) && proposalA.diff.length > 0;
    pushApiCheck("visual-diff-present", listResponse.status === 200 && hasDiff, `status=${listResponse.status}`);

    const batchApprove = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/workflow/batch`, adminLogin.data.token, {
      proposalIds: [createdProposals[0], createdProposals[1]],
      nextStatus: "APPROVED",
      note: "Aprovação em lote S43",
    });
    pushApiCheck("batch-approve-two", batchApprove.status === 200 && Number(batchApprove.data?.updatedCount || 0) === 2, `status=${batchApprove.status}`);

    const batchNeedsInfo = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/workflow/batch`, adminLogin.data.token, {
      proposalIds: [createdProposals[2]],
      nextStatus: "NEEDS_INFO",
      note: "Falta confirmação em campo",
    });
    pushApiCheck("batch-needs-info-one", batchNeedsInfo.status === 200 && Number(batchNeedsInfo.data?.updatedCount || 0) === 1, `status=${batchNeedsInfo.status}`);

    const approvedTerminal = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${createdProposals[0]}/workflow`, adminLogin.data.token, {
      nextStatus: "IN_REVIEW",
      note: "Nao permitido",
    });
    pushApiCheck("approved-is-terminal", approvedTerminal.status === 409, `status=${approvedTerminal.status}`);

    const pendingOnly = await http("GET", `/api/core/pools/${pool.id}/technical-change-proposals?onlyPending=true`, adminLogin.data.token);
    const pendingStatuses = Array.isArray(pendingOnly.data?.proposals)
      ? pendingOnly.data.proposals.map((item) => String(item.status || "").toUpperCase())
      : [];
    pushApiCheck("pending-filter-states", pendingOnly.status === 200 && pendingStatuses.every((state) => ["SUBMITTED", "IN_REVIEW", "NEEDS_INFO"].includes(state)), `status=${pendingOnly.status}`);

    const immutableHistory = await http("GET", `/api/core/pools/${pool.id}/technical-change-proposals/${createdProposals[0]}/history`, adminLogin.data.token);
    const chainValid = Boolean(immutableHistory.data?.immutable?.chainValid);
    const totalEvents = Number(immutableHistory.data?.immutable?.totalEvents || 0);
    pushApiCheck("immutable-history-valid", immutableHistory.status === 200 && chainValid && totalEvents >= 2, `status=${immutableHistory.status}`);

    const diffEndpoint = await http("GET", `/api/core/pools/${pool.id}/technical-change-proposals/${createdProposals[2]}/diff`, adminLogin.data.token);
    const diffHasRows = Array.isArray(diffEndpoint.data?.diff) && diffEndpoint.data.diff.length > 0;
    pushApiCheck("diff-endpoint-ok", diffEndpoint.status === 200 && diffHasRows, `status=${diffEndpoint.status}`);

    const contextData = {
      admin: { token: adminLogin.data.token, userId: adminUser.id, name: adminUser.name, email: adminUser.email },
      poolId: pool.id,
    };

    const browser = await chromium.launch({ headless: true });
    const viewportResults = [];
    try {
      for (const viewport of VIEWPORTS) {
        viewportResults.push(await runAdminViewport(browser, viewport, contextData));
      }
    } finally {
      await browser.close();
    }

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
    console.error("FCS_TECHNICIAN_SPRINT43_ERROR", error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.visits.length) await prisma.serviceVisit.deleteMany({ where: { id: { in: created.visits } } }).catch(() => null);
      if (created.pools.length) await prisma.pool.deleteMany({ where: { id: { in: created.pools } } }).catch(() => null);
      if (created.clients.length) await prisma.client.deleteMany({ where: { id: { in: created.clients } } }).catch(() => null);
      if (created.technicians.length) await prisma.technician.deleteMany({ where: { id: { in: created.technicians } } }).catch(() => null);
      if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => null);
    } catch (_) {}
    await prisma.$disconnect().catch(() => null);
  }
})();
