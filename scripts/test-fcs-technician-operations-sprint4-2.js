const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { chromium, devices } = require("playwright");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs-technician-operations-sprint4-2");
const REPORT_JSON = path.join(ROOT, "reports", `fcs-technician-operations-sprint4-2-${Date.now()}.json`);

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
  let shotPath = "";

  try {
    await primeSession(
      page,
      { id: contextData.admin.userId, role: "ADMIN", name: contextData.admin.name, email: contextData.admin.email },
      contextData.admin.token
    );
    await page.goto(`${BASE_URL}/admin-pool-technical?poolId=${contextData.poolId}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => {
      const summary = String(document.querySelector("#technicalProposalSummary")?.textContent || "").trim();
      const listText = String(document.querySelector("#technicalProposalAdminList")?.textContent || "").trim();
      const summaryReady = summary && !summary.toLowerCase().includes("a carregar");
      const listReady = listText && !listText.toLowerCase().includes("a carregar");
      return summaryReady && listReady;
    }, { timeout: 8000 }).catch(() => null);

    const summary = await page.evaluate(() => String(document.querySelector("#technicalProposalSummary")?.textContent || "").trim());
    const listText = await page.evaluate(() => String(document.querySelector("#technicalProposalAdminList")?.textContent || "").trim());

    addCheck("admin-ui-summary-workflow", contains(summary, "Aprovada") || contains(summary, "Aprovada: 1") || contains(summary, "Aprovada: 0") || contains(summary, "Aprovada"), summary);
    addCheck("admin-ui-approved-visible", contains(listText, "APPROVED") && contains(listText, contextData.proposalReason), listText);

    ensureFolder(EVIDENCE_DIR);
    shotPath = path.join(EVIDENCE_DIR, `s42-admin-${viewport.id}.png`);
    await page.locator("#technicalProposalAdminList").screenshot({ path: shotPath });

    return {
      viewport: viewport.label,
      viewportId: viewport.id,
      pass: checks.every((item) => item.pass),
      checks,
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
    const adminEmail = `${randomToken("admin")}@qa-s42.test`;
    const adminHash = await bcrypt.hash(adminPass, 10);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: adminHash,
        role: "ADMIN",
        name: "QA S42 ADMIN",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(adminUser.id);

    const pin = String(Math.floor(1000 + Math.random() * 8999));
    const tech = await prisma.technician.create({
      data: {
        name: `QA S42 TECH ${randomToken("t")}`,
        email: `${randomToken("tech")}@qa-s42.test`,
        pin,
        role: "TECHNICIAN",
        active: true,
        zone: "QA",
      },
    });
    created.technicians.push(tech.id);

    const client = await prisma.client.create({
      data: { name: `QA S42 CLIENT ${randomToken("c")}`, status: "ACTIVE", active: true },
    });
    created.clients.push(client.id);

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA S42 POOL ${randomToken("p")}`,
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

    const proposalReason = "Sprint 4.2 workflow transition validation";
    const createDraft = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals`, techLogin.data.token, {
      asDraft: true,
      reason: proposalReason,
      changes: [{ field: "pumpPower", before: "1 CV", after: "1.5 CV" }],
      photos: ["https://example.com/s42-draft-photo.jpg"],
    });
    pushApiCheck("draft-created", createDraft.status === 201 && createDraft.data?.proposal?.status === "DRAFT", `status=${createDraft.status}`);

    const proposalId = createDraft.data?.proposal?.id;
    if (!proposalId) throw new Error("proposal id not returned");

    const draftToSubmitted = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, techLogin.data.token, {
      nextStatus: "SUBMITTED",
      note: "Submissão pelo técnico",
    });
    pushApiCheck("tech-draft-to-submitted", draftToSubmitted.status === 200 && draftToSubmitted.data?.proposal?.status === "SUBMITTED", `status=${draftToSubmitted.status}`);

    const submittedToReview = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, adminLogin.data.token, {
      nextStatus: "IN_REVIEW",
      note: "Análise iniciada",
    });
    pushApiCheck("admin-submitted-to-review", submittedToReview.status === 200 && submittedToReview.data?.proposal?.status === "IN_REVIEW", `status=${submittedToReview.status}`);

    const reviewToNeedsInfo = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, adminLogin.data.token, {
      nextStatus: "NEEDS_INFO",
      note: "Confirmação de etiqueta da bomba",
    });
    pushApiCheck("admin-review-to-needs-info", reviewToNeedsInfo.status === 200 && reviewToNeedsInfo.data?.proposal?.status === "NEEDS_INFO", `status=${reviewToNeedsInfo.status}`);

    const techForbiddenApprove = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, techLogin.data.token, {
      nextStatus: "APPROVED",
      note: "Não permitido",
    });
    pushApiCheck("tech-cannot-approve", techForbiddenApprove.status === 403, `status=${techForbiddenApprove.status}`);

    const needsInfoToSubmitted = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, techLogin.data.token, {
      nextStatus: "SUBMITTED",
      note: "Informação adicional enviada",
    });
    pushApiCheck("tech-needs-info-to-submitted", needsInfoToSubmitted.status === 200 && needsInfoToSubmitted.data?.proposal?.status === "SUBMITTED", `status=${needsInfoToSubmitted.status}`);

    const reviewAgain = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, adminLogin.data.token, {
      nextStatus: "IN_REVIEW",
      note: "Revisão retomada",
    });
    pushApiCheck("admin-submitted-to-review-again", reviewAgain.status === 200 && reviewAgain.data?.proposal?.status === "IN_REVIEW", `status=${reviewAgain.status}`);

    const reviewToApproved = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, adminLogin.data.token, {
      nextStatus: "APPROVED",
      note: "Aprovado com validação",
    });
    pushApiCheck("admin-review-to-approved", reviewToApproved.status === 200 && reviewToApproved.data?.proposal?.status === "APPROVED", `status=${reviewToApproved.status}`);

    const approvedInvalidBack = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, adminLogin.data.token, {
      nextStatus: "IN_REVIEW",
      note: "Transição inválida",
    });
    pushApiCheck("approved-terminal", approvedInvalidBack.status === 409, `status=${approvedInvalidBack.status}`);

    const pendingList = await http("GET", `/api/core/pools/${pool.id}/technical-change-proposals?onlyPending=true`, adminLogin.data.token);
    const pendingHasApproved = Array.isArray(pendingList.data?.proposals)
      ? pendingList.data.proposals.some((item) => String(item.status || "").toUpperCase() === "APPROVED")
      : false;
    pushApiCheck("pending-excludes-approved", pendingList.status === 200 && !pendingHasApproved, `status=${pendingList.status}`);

    const fullList = await http("GET", `/api/core/pools/${pool.id}/technical-change-proposals`, adminLogin.data.token);
    const approvedInFullList = Array.isArray(fullList.data?.proposals)
      ? fullList.data.proposals.some((item) => Number(item.id) === Number(proposalId) && String(item.status || "").toUpperCase() === "APPROVED")
      : false;
    pushApiCheck("full-list-has-approved", fullList.status === 200 && approvedInFullList, `status=${fullList.status}`);

    const contextData = {
      admin: { token: adminLogin.data.token, userId: adminUser.id, name: adminUser.name, email: adminUser.email },
      poolId: pool.id,
      proposalReason,
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
    console.error("FCS_TECHNICIAN_SPRINT42_ERROR", error);
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
