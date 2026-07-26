const fs = require("fs");
const path = require("path");
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const REPORT_JSON = path.join(ROOT, "reports", `fcs-technician-t1-${Date.now()}.json`);

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function randomToken(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function contains(haystack, text) {
  return String(haystack || "").toLowerCase().includes(String(text || "").toLowerCase());
}

function doneStatus(status) {
  const s = String(status || "").toUpperCase();
  return ["DONE", "COMPLETED", "CONCLUIDA", "CONCLUÍDA"].includes(s);
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

async function uploadPhoto(visitId, token, fileName, fileContent, type = "AFTER") {
  const form = new FormData();
  form.append("type", type);
  form.append("photo", new Blob([fileContent], { type: "image/jpeg" }), fileName);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}/api/visits/${visitId}/photo`, {
    method: "POST",
    headers,
    body: form,
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

async function safeDelete(modelName, where) {
  const model = prisma?.[modelName];
  if (!model || typeof model.deleteMany !== "function") return;
  await model.deleteMany({ where }).catch(() => null);
}

(async () => {
  const startedAt = Date.now();
  const checks = [];
  const created = {
    technicianId: null,
    clientId: null,
    poolIds: [],
    visitIds: [],
    reminderId: null,
    vehicleId: null,
    transportGuideId: null,
    workGuideId: null,
  };

  const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });

  ensureDir(REPORT_JSON);

  try {
    const pin = String(Math.floor(1000 + Math.random() * 8999));
    const technician = await prisma.technician.create({
      data: {
        name: `QA T1 TECH ${randomToken("t")}`,
        email: `${randomToken("tech")}@qa-t1.test`,
        pin,
        role: "TECHNICIAN",
        active: true,
        zone: "QA",
      },
    });
    created.technicianId = technician.id;

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: `QA-${String(Math.floor(Math.random() * 90) + 10)}-${String(Math.floor(Math.random() * 90) + 10)}`,
        name: `QA T1 VAN ${randomToken("v")}`,
        status: "ACTIVE",
        active: true,
      },
    });
    created.vehicleId = vehicle.id;

    await prisma.technician.update({
      where: { id: technician.id },
      data: { vehicleId: vehicle.id },
    });

    const transportGuide = await prisma.transportGuide.create({
      data: {
        codeAT: `AT-T1-${Date.now()}`,
        vehicleId: vehicle.id,
        status: "ACTIVE",
        origin: "QA Warehouse",
        destination: "QA Field",
        validFrom: new Date(Date.now() - 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isDraft: false,
      },
    });
    created.transportGuideId = transportGuide.id;

    const workGuide = await prisma.workGuide.create({
      data: {
        guideId: transportGuide.id,
        vehicleId: vehicle.id,
        technicianId: technician.id,
        status: "OPEN",
        startKm: 1000,
        isDraft: false,
      },
    });
    created.workGuideId = workGuide.id;

    await prisma.workGuideItem.create({
      data: {
        workGuideId: workGuide.id,
        name: "Cloro Granulado",
        type: "CHEMICAL",
        unit: "KG",
        initialQty: 20,
        quantity: 20,
        usedQty: 0,
      },
    });

    const client = await prisma.client.create({
      data: {
        name: `QA T1 CLIENT ${randomToken("c")}`,
        status: "ACTIVE",
        active: true,
      },
    });
    created.clientId = client.id;

    const poolA = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA T1 POOL A ${randomToken("p")}`,
        type: "POOL",
        active: true,
        zone: "QA",
      },
    });

    const poolB = await prisma.pool.create({
      data: {
        clientId: client.id,
        name: `QA T1 POOL B ${randomToken("p")}`,
        type: "POOL",
        active: true,
        zone: "QA",
      },
    });

    created.poolIds.push(poolA.id, poolB.id);

    const now = Date.now();
    const visitA = await prisma.serviceVisit.create({
      data: {
        clientId: client.id,
        poolId: poolA.id,
        technicianId: technician.id,
        technicianName: technician.name,
        plannedDate: new Date(now + 3 * 60 * 1000),
        status: "PLANNED",
      },
    });

    const visitB = await prisma.serviceVisit.create({
      data: {
        clientId: client.id,
        poolId: poolB.id,
        technicianId: technician.id,
        technicianName: technician.name,
        plannedDate: new Date(now + 35 * 60 * 1000),
        status: "PLANNED",
      },
    });

    created.visitIds.push(visitA.id, visitB.id);

    const login = await http("POST", "/api/technician-auth/login", null, { pin });
    const token = login.data?.token;
    check("login", login.status === 200 && Boolean(token), `status=${login.status}`);
    if (!token) throw new Error("TECHNICIAN_LOGIN_FAILED");

    const todayBefore = await http("GET", `/api/technician/today?technicianId=${technician.id}`, token);
    const todayBeforeVisits = Array.isArray(todayBefore.data?.visits) ? todayBefore.data.visits : [];
    const firstVisit = todayBeforeVisits.find((v) => Number(v.id) === Number(visitA.id)) || todayBeforeVisits[0];
    const secondVisit = todayBeforeVisits.find((v) => Number(v.id) === Number(visitB.id));

    check("hoje", todayBefore.status === 200 && todayBeforeVisits.length >= 2, `status=${todayBefore.status}; visits=${todayBeforeVisits.length}`);
    check("selecao-da-visita", Boolean(firstVisit && secondVisit), `first=${firstVisit?.id || "none"}; second=${secondVisit?.id || "none"}`);

    const checkin = await http("POST", `/api/visits/${visitA.id}/start`, token, {});
    check("check-in", checkin.status === 200 && checkin.data?.ok === true, `status=${checkin.status}`);

    const nowState = await http("GET", `/api/visits/${visitA.id}`, token);
    const nowStatus = String(nowState.data?.visit?.status || "").toUpperCase();
    check("agora", nowState.status === 200 && ["IN_PROGRESS", "EM_EXECUCAO"].includes(nowStatus), `status=${nowState.status}; state=${nowStatus}`);

    const docsTransport = await http("GET", `/api/guides/transport/latest/${vehicle.id}`, token);
    const docsWork = await http("GET", `/api/guides/stock/${vehicle.id}`, token);
    const docsInsurance = await http("GET", `/api/guides/vehicles/${vehicle.id}/insurance`, token);
    const docsOk = [docsTransport.status, docsWork.status, docsInsurance.status].every((s) => s === 200 || s === 404);
    check("documentos", docsOk, `transport=${docsTransport.status}; work=${docsWork.status}; insurance=${docsInsurance.status}`);

    const proposal = await http("POST", `/api/core/pools/${poolA.id}/technical-change-proposals`, token, {
      reason: "TECH T1 proposta em campo",
      changes: [{ field: "pumpPower", before: "1 CV", after: "1.5 CV" }],
      photos: ["https://example.com/t1-proposal.jpg"],
    });
    check("proposta-de-alteracao-tecnica", proposal.status === 201 && Boolean(proposal.data?.proposal?.id), `status=${proposal.status}`);

    const openWater = await http("POST", "/api/technician/water-reminders", token, {
      visitId: visitA.id,
      poolId: poolA.id,
      clientId: client.id,
      technicianId: technician.id,
      poolName: poolA.name,
      clientName: client.name,
      note: "TECH T1 water open",
      minutes: 5,
    });
    created.reminderId = Number(openWater.data?.reminder?.id || 0);
    check("agua-aberta", openWater.status === 200 && created.reminderId > 0, `status=${openWater.status}; reminderId=${created.reminderId}`);

    const waterAlarm = await http("POST", `/api/technician/water-reminders/${created.reminderId}/alarm`, token, {
      visitId: visitA.id,
      poolId: poolA.id,
      clientId: client.id,
      technicianId: technician.id,
      poolName: poolA.name,
      clientName: client.name,
    });
    check("agua-aberta-alarme", waterAlarm.status === 200 && waterAlarm.data?.ok === true, `status=${waterAlarm.status}`);

    const waterClose = await http("POST", `/api/technician/water-reminders/${created.reminderId}/close`, token, {
      visitId: visitA.id,
      poolId: poolA.id,
      clientId: client.id,
      technicianId: technician.id,
      poolName: poolA.name,
      clientName: client.name,
    });
    check("agua-aberta-fecho", waterClose.status === 200 && waterClose.data?.ok === true, `status=${waterClose.status}`);

    const problem = await http("POST", `/api/core/visits/${visitA.id}/problem`, token, {
      message: "TECH T1 problema em campo",
      type: "FIELD_PROBLEM",
      severity: "NORMAL",
    });
    check("problemas", problem.status === 200 && problem.data?.ok === true, `status=${problem.status}`);

    const photo = await uploadPhoto(visitA.id, token, "tech-t1-photo.jpg", `TECH_T1_${Date.now()}`, "AFTER");
    check("fotografias", photo.status === 200 && photo.data?.ok === true, `status=${photo.status}`);

    const checkout = await http("POST", `/api/core/visits/${visitA.id}/complete`, token, {
      visitId: visitA.id,
      technicianId: technician.id,
      cleaned: true,
      vacuumed: true,
      basketCleaned: true,
      brushed: true,
      waterlineClean: true,
      backwashDone: true,
      ph: 7.3,
      chlorine: 1.5,
      alkalinity: 95,
      salt: 2200,
      temperature: 26,
      notes: "TECH T1 checkout",
    });
    const checkoutDetail = `status=${checkout.status}; code=${checkout.data?.code || "-"}; error=${checkout.data?.error || "-"}`;
    check("leituras", checkout.status === 200 && checkout.data?.ok === true, checkoutDetail);
    check("check-out", checkout.status === 200 && checkout.data?.ok === true, checkoutDetail);

    const chemicalCorrection = await http("PATCH", `/api/technician/visits/${visitA.id}/correction`, token, {
      products: JSON.stringify([{ name: "Cloro Granulado", quantity: 1, unit: "KG" }]),
      notes: "TECH T1 produtos quimicos",
    });
    check(
      "produtos-quimicos",
      chemicalCorrection.status === 200 && chemicalCorrection.data?.ok === true,
      `status=${chemicalCorrection.status}; error=${chemicalCorrection.data?.error || "-"}`
    );

    const todayAfter = await http("GET", `/api/technician/today?technicianId=${technician.id}`, token);
    const todayAfterVisits = Array.isArray(todayAfter.data?.visits) ? todayAfter.data.visits : [];
    const doneA = todayAfterVisits.find((v) => Number(v.id) === Number(visitA.id));
    const pendingB = todayAfterVisits.find((v) => Number(v.id) === Number(visitB.id));

    check(
      "proxima-piscina",
      todayAfter.status === 200 && doneStatus(doneA?.status) && !doneStatus(pendingB?.status),
      `status=${todayAfter.status}; first=${doneA?.status || "none"}; second=${pendingB?.status || "none"}`
    );

    const noTokenCall = await http("GET", `/api/technician/today?technicianId=${technician.id}`, null);
    check("logout", noTokenCall.status === 401, `status=${noTokenCall.status}`);

    const proposalList = await http("GET", `/api/core/pools/${poolA.id}/technical-change-proposals`, token);
    check(
      "proposta-visivel-no-historico",
      proposalList.status === 200 && Array.isArray(proposalList.data?.proposals) && proposalList.data.proposals.some((p) => contains(p.reason, "TECH T1 proposta")),
      `status=${proposalList.status}`
    );

    const passed = checks.filter((item) => item.pass).length;
    const report = {
      ok: checks.length > 0 && checks.every((item) => item.pass),
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      runtimeMs: Date.now() - startedAt,
      totals: {
        checks: checks.length,
        passed,
        failed: checks.length - passed,
      },
      checks,
    };

    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_JSON)}`);
    console.log(`RESULT=${report.ok ? "PASS" : "FAIL"}`);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error("FCS_TECHNICIAN_T1_ERROR", error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.visitIds.length) {
        await safeDelete("stockMovement", { visitId: { in: created.visitIds } });
        await safeDelete("vehicleStockMovement", { visitId: { in: created.visitIds } });
        await safeDelete("chemicalUsage", { visitId: { in: created.visitIds } });
        await safeDelete("serviceVisitPhoto", { visitId: { in: created.visitIds } });
        await safeDelete("visitPhoto", { visitId: { in: created.visitIds } });
        await safeDelete("auditTrail", { visitId: { in: created.visitIds } });
      }

      if (created.clientId) {
        await safeDelete("operationalReminder", { clientId: created.clientId });
        await safeDelete("notification", { clientId: created.clientId });
      }

      if (created.poolIds.length) {
        await safeDelete("technicalAlert", { poolId: { in: created.poolIds } });
        await safeDelete("repair", { poolId: { in: created.poolIds } });
        await safeDelete("technicalHistory", { poolId: { in: created.poolIds } });
        await safeDelete("poolCalculationProfile", { poolId: { in: created.poolIds } });
        await safeDelete("technicalSheet", { poolId: { in: created.poolIds } });
        await safeDelete("poolEquipment", { poolId: { in: created.poolIds } });
        await safeDelete("technicalRoom", { poolId: { in: created.poolIds } });
      }

      if (created.visitIds.length) await safeDelete("serviceVisit", { id: { in: created.visitIds } });
      if (created.workGuideId) {
        await safeDelete("workGuideItem", { workGuideId: created.workGuideId });
        await safeDelete("workGuide", { id: created.workGuideId });
      }
      if (created.transportGuideId) {
        await safeDelete("transportGuideItem", { guideId: created.transportGuideId });
        await safeDelete("transportGuide", { id: created.transportGuideId });
      }
      if (created.poolIds.length) await safeDelete("pool", { id: { in: created.poolIds } });
      if (created.clientId) await safeDelete("client", { id: created.clientId });
      if (created.vehicleId) await safeDelete("vehicle", { id: created.vehicleId });
      if (created.technicianId) await safeDelete("technician", { id: created.technicianId });
    } catch (_) {}

    await prisma.$disconnect().catch(() => null);
  }
})();
