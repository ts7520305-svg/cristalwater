const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs-technician-operations-sprint4-4");
const REPORT_JSON = path.join(ROOT, "reports", `fcs-technician-operations-sprint4-4-${Date.now()}.json`);

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

function logStep(step) {
  console.log(`[S44] ${step}`);
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

(async () => {
  const created = { users: [], technicians: [], clients: [], pools: [], visits: [] };
  const checks = [];
  const pushCheck = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
  const startedAt = Date.now();

  ensureDir(REPORT_JSON);

  try {
    const adminPass = `Pw-${randomToken("admin")}-A1!`;
    const adminEmail = `${randomToken("admin")}@qa-s44.test`;
    const adminHash = await bcrypt.hash(adminPass, 10);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: adminHash,
        role: "ADMIN",
        name: "QA S44 ADMIN",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(adminUser.id);

    const pin = String(Math.floor(1000 + Math.random() * 8999));
    const tech = await prisma.technician.create({
      data: {
        name: `QA S44 TECH ${randomToken("t")}`,
        email: `${randomToken("tech")}@qa-s44.test`,
        pin,
        role: "TECHNICIAN",
        active: true,
        zone: "QA",
      },
    });
    created.technicians.push(tech.id);

    const client = await prisma.client.create({ data: { name: `QA S44 CLIENT ${randomToken("c")}`, status: "ACTIVE", active: true } });
    created.clients.push(client.id);

    const pool = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA S44 POOL ${randomToken("p")}`,
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

    const proposalCreate = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals`, techLogin.data.token, {
      reason: "Sprint 4.4 propagation check",
      changes: [{ field: "pumpPower", before: "1 CV", after: "1.5 CV" }],
      photos: ["https://example.com/s44-photo.jpg"],
    });
    const proposalId = Number(proposalCreate.data?.proposal?.id || 0);
    pushCheck("proposal-created", proposalCreate.status === 201 && proposalId > 0, `status=${proposalCreate.status}; proposalId=${proposalId}`);

    const proposalApprove = await http("POST", `/api/core/pools/${pool.id}/technical-change-proposals/${proposalId}/workflow`, adminLogin.data.token, {
      nextStatus: "APPROVED",
      note: "Aprovada para propagacao sprint 4.4",
    });
    pushCheck("proposal-workflow-approved", proposalApprove.status === 200 && contains(proposalApprove.data?.proposal?.status, "APPROVED"), `status=${proposalApprove.status}`);

    const technicalSheetUpdate = await http("PUT", `/api/core/pools/${pool.id}/technical-sheet`, adminLogin.data.token, {
      actor: "QA S44 ADMIN",
      historyNote: "Atualizacao direta sprint 4.4",
      shape: "RECTANGULAR",
      lengthM: 9,
      widthM: 4,
      depthMinM: 1.2,
      depthMaxM: 1.8,
      pumpPower: "2 CV",
      filterType: "Areia",
      targetChlorinePpm: 2.2,
    });
    pushCheck("technical-sheet-update", technicalSheetUpdate.status === 200 && technicalSheetUpdate.data?.ok === true, `status=${technicalSheetUpdate.status}`);

    const timelineResponse = await http("GET", "/api/core/timeline/technical-sheet-events?limit=120", adminLogin.data.token);
    const timelineRows = Array.isArray(timelineResponse.data?.timeline) ? timelineResponse.data.timeline : [];
    const hasProposalCreated = timelineRows.some((row) => row.poolId === pool.id && contains(row.source, "TECHNICAL_PROPOSAL_CREATED"));
    const hasProposalWorkflow = timelineRows.some((row) => row.poolId === pool.id && contains(row.source, "TECHNICAL_PROPOSAL_WORKFLOW"));
    const hasDirectUpdate = timelineRows.some((row) => row.poolId === pool.id && contains(row.source, "TECHNICAL_SHEET_DIRECT_UPDATE"));
    pushCheck("timeline-propagation-visible", timelineResponse.status === 200 && hasProposalCreated && hasProposalWorkflow && hasDirectUpdate, `status=${timelineResponse.status}; rows=${timelineRows.length}`);

    const dashboardResponse = await http("GET", "/api/core/dashboard", adminLogin.data.token);
    const technicalPropagation = Array.isArray(dashboardResponse.data?.technicalPropagation) ? dashboardResponse.data.technicalPropagation : [];
    const counts = dashboardResponse.data?.counts || {};
    const dashboardHasPool = technicalPropagation.some((row) => Number(row.poolId) === Number(pool.id));
    pushCheck(
      "command-center-datasource-visible",
      dashboardResponse.status === 200 && dashboardHasPool && Number(counts.technicalSheetEvents24h || 0) >= 1,
      `status=${dashboardResponse.status}; events24h=${counts.technicalSheetEvents24h || 0}`
    );

    const knowledgeResponse = await http("GET", "/api/core/knowledge/technical-sheet?limit=120", adminLogin.data.token);
    const notes = Array.isArray(knowledgeResponse.data?.notes) ? knowledgeResponse.data.notes : [];
    const hasKnowledge = notes.some((note) => contains(note.title, `#${pool.id}`) || contains(note.body, `piscina ${pool.id}`) || contains(note.body, `pool ${pool.id}`));
    pushCheck("knowledge-base-visible", knowledgeResponse.status === 200 && hasKnowledge, `status=${knowledgeResponse.status}; notes=${notes.length}`);

    logStep("command-center-page-check:start");
    const commandCenterHtml = await http("GET", "/admin-master-control", adminLogin.data.token);
    const htmlRaw = String(commandCenterHtml.data?.raw || "");
    const commandCenterVisible = commandCenterHtml.status === 200 && contains(htmlRaw, "technicalPropagationList");
    pushCheck("command-center-ui-visible", commandCenterVisible, `status=${commandCenterHtml.status}`);

    const passed = checks.filter((item) => item.pass).length;
    const report = {
      ok: checks.length > 0 && passed === checks.length,
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      runtimeMs: Date.now() - startedAt,
      totals: {
        checks: checks.length,
        passed,
        failed: checks.length - passed,
      },
      checks,
      screenshots: [],
    };

    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_JSON)}`);
    console.log(`RESULT=${report.ok ? "PASS" : "FAIL"}`);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error("FCS_TECHNICIAN_SPRINT44_ERROR", error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.pools.length && prisma.poolCalculationProfile?.deleteMany) {
        await prisma.poolCalculationProfile.deleteMany({ where: { poolId: { in: created.pools } } }).catch(() => null);
      }
      if (created.pools.length && prisma.technicalSheet?.deleteMany) {
        await prisma.technicalSheet.deleteMany({ where: { poolId: { in: created.pools } } }).catch(() => null);
      }
      if (created.pools.length && prisma.poolEquipment?.deleteMany) {
        await prisma.poolEquipment.deleteMany({ where: { poolId: { in: created.pools } } }).catch(() => null);
      }
      if (created.pools.length && prisma.technicalRoom?.deleteMany) {
        await prisma.technicalRoom.deleteMany({ where: { poolId: { in: created.pools } } }).catch(() => null);
      }
      if (created.pools.length && prisma.technicalHistory?.deleteMany) {
        await prisma.technicalHistory.deleteMany({ where: { poolId: { in: created.pools } } }).catch(() => null);
      }
      if (created.visits.length) await prisma.serviceVisit.deleteMany({ where: { id: { in: created.visits } } }).catch(() => null);
      if (created.pools.length) await prisma.pool.deleteMany({ where: { id: { in: created.pools } } }).catch(() => null);
      if (created.clients.length) await prisma.client.deleteMany({ where: { id: { in: created.clients } } }).catch(() => null);
      if (created.technicians.length) await prisma.technician.deleteMany({ where: { id: { in: created.technicians } } }).catch(() => null);
      if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => null);
    } catch (_) {}
    await prisma.$disconnect().catch(() => null);
  }
})();
