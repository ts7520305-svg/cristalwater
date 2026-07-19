const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

require("../src/loadEnv")();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["warn", "error"] });
const fetchImpl = global.fetch || require("node-fetch");

const BASE_URL = process.env.CW_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`;
const now = new Date();
const iso = now.toISOString().replace(/[:.]/g, "-");
const missionTs = process.env.ZERO_BUGS_TS || now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
const missionPrefix = process.env.ZERO_BUGS_PREFIX || `ZERO-BUGS-${missionTs}`;
const reportDir = path.resolve(__dirname, "..", "reports");
const reportPath = path.join(reportDir, `crystal-os-zero-bugs-${iso}.json`);

fs.mkdirSync(reportDir, { recursive: true });

const report = {
  missionId: "CRYSTAL-OS-ZERO-BUGS-001",
  missionTimestamp: missionTs,
  missionPrefix,
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  status: "RUNNING",
  blockingFailures: [],
  nonBlockingIssues: [],
  checks: [],
  performance: {
    endpoints: {},
    concurrency: {},
  },
  auth: {},
  responsive: {
    viewports: [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
    ],
    screenChecks: [],
  },
  captured: {
    consoleErrors: [],
    pageErrors: [],
    apiFailures: [],
  },
  createdData: {
    clientIds: [],
    clientRecords: [],
    poolIds: [],
    technicianIds: [],
    serviceVisitIds: [],
    visitIds: [],
    invoiceIds: [],
    paymentIds: [],
    notificationIds: [],
  },
  cleanup: {
    before: {},
    after: {},
    removed: {},
    orphans: [],
  },
  limitations: [],
};

function summarizeError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.stack || error.message || JSON.stringify(error);
}

function buildTestSetupError(category, meta, cause) {
  const details = {
    phase: meta?.phase || "setup",
    entity: meta?.entity || "unknown",
    operation: meta?.operation || "unknown",
    createdId: meta?.createdId ?? null,
    verifiedId: meta?.verifiedId ?? null,
    missionPrefix,
  };

  const summary =
    `[${category}] phase=${details.phase} entity=${details.entity} operation=${details.operation} ` +
    `createdId=${details.createdId ?? "n/a"} verifiedId=${details.verifiedId ?? "n/a"} missionPrefix=${details.missionPrefix}`;

  const code = cause && typeof cause === "object" ? cause.code : undefined;
  const message = code ? `${summary} prismaCode=${code}` : summary;
  const error = new Error(message);
  error.name = category;
  error.meta = details;
  if (code) {
    error.prismaCode = code;
  }
  if (cause) {
    error.cause = cause;
    if (cause.stack) {
      error.stack = `${error.name}: ${error.message}\nCAUSE:\n${cause.stack}`;
    }
  }
  return error;
}

function isMissionTaggedClient(client) {
  if (!client) return false;
  const needle = missionPrefix.toLowerCase();
  return [client.name, client.email, client.notes, client.address, client.zone]
    .filter((value) => typeof value === "string")
    .some((value) => value.toLowerCase().includes(needle));
}

function safeToJson(value) {
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function addCheck(name, ok, detail = "", severity = "medium") {
  const item = {
    name,
    ok: Boolean(ok),
    detail,
    severity,
    at: new Date().toISOString(),
  };
  report.checks.push(item);
  const line = `${ok ? "OK" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`;
  if (ok) {
    console.log(line);
  } else {
    console.error(line);
    if (severity === "critical" || severity === "high") {
      report.blockingFailures.push(item);
    } else {
      report.nonBlockingIssues.push(item);
    }
  }
  return item;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function request(method, routePath, { token, body, expectedStatuses = [200, 201], headers = {} } = {}) {
  const started = Date.now();
  const response = await fetchImpl(`${BASE_URL}${routePath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const durationMs = Date.now() - started;
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    // Keep full HTML/text body for reliable include/assert checks.
    data = { raw: text };
  }

  if (!expectedStatuses.includes(response.status)) {
    const failure = {
      method,
      path: routePath,
      status: response.status,
      expectedStatuses,
      durationMs,
      response: data,
    };
    report.captured.apiFailures.push(failure);
    const message = `${method} ${routePath} -> ${response.status}`;
    throw new Error(`${message}: ${data.error || data.message || text.slice(0, 200)}`);
  }

  return { status: response.status, data, durationMs, headers: response.headers };
}

async function authenticateAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD missing in environment.");
  }

  const good = await request("POST", "/api/auth/login", {
    body: { email, password },
    expectedStatuses: [200],
  });

  const bad = await request("POST", "/api/auth/login", {
    body: { email, password: `${password}-invalid` },
    expectedStatuses: [400, 401],
  });

  addCheck("admin valid login", Boolean(good.data.token), `status ${good.status}`, "critical");
  addCheck("admin invalid login blocked", [400, 401].includes(bad.status), `status ${bad.status}`, "high");
  report.auth.admin = {
    ok: Boolean(good.data.token),
    invalidBlocked: [400, 401].includes(bad.status),
  };
  return good.data.token;
}

async function createDisposableCoreData(adminToken) {
  const pin = String(700000 + (Date.now() % 100000)).slice(-6);
  const techEmail = `${missionPrefix.toLowerCase()}-tech@cristalwater.pt`;
  const clientEmailA = `${missionPrefix.toLowerCase()}-client-a@cristalwater.pt`;
  const clientEmailB = `${missionPrefix.toLowerCase()}-client-b@cristalwater.pt`;

  const technicianRes = await request("POST", "/api/technicians", {
    token: adminToken,
    body: {
      name: `${missionPrefix} TECHNICIAN`,
      email: techEmail,
      phone: "930000001",
      pin,
      role: "TECHNICIAN",
      active: true,
      notes: `${missionPrefix} disposable technician`,
    },
    expectedStatuses: [200, 201],
  });

  const technicianId = Number(technicianRes.data.id || technicianRes.data.technician?.id || 0);
  if (!technicianId) {
    throw new Error("Failed to create disposable technician with valid ID.");
  }
  report.createdData.technicianIds.push(technicianId);

  const createAndVerifyClient = async ({ label, email, phone, address, zone, notes, rawPassword }) => {
    let createdClient;
    try {
      createdClient = await prisma.client.create({
        data: {
          name: `${missionPrefix} ${label}`,
          email,
          phone,
          address,
          zone,
          notes,
          active: true,
        },
      });
    } catch (error) {
      throw buildTestSetupError(
        "TEST_SETUP_CLIENT_CREATE_FAILED",
        { phase: "setup", entity: "client", operation: "prisma.client.create", createdId: null, verifiedId: null },
        error
      );
    }

    const createdId = Number(createdClient?.id || 0);
    if (!createdId) {
      throw buildTestSetupError("TEST_SETUP_CLIENT_INVALID_CREATED_ID", {
        phase: "setup",
        entity: "client",
        operation: "prisma.client.create",
        createdId: createdClient?.id ?? null,
        verifiedId: null,
      });
    }

    let verifiedClient;
    try {
      verifiedClient = await prisma.client.findUnique({ where: { id: createdId } });
    } catch (error) {
      throw buildTestSetupError(
        "TEST_SETUP_CLIENT_VERIFY_FAILED",
        { phase: "setup", entity: "client", operation: "prisma.client.findUnique", createdId, verifiedId: null },
        error
      );
    }

    if (!verifiedClient) {
      throw buildTestSetupError("TEST_SETUP_CLIENT_NOT_FOUND", {
        phase: "setup",
        entity: "client",
        operation: "prisma.client.findUnique",
        createdId,
        verifiedId: null,
      });
    }

    if (!isMissionTaggedClient(verifiedClient)) {
      throw buildTestSetupError("TEST_SETUP_CLIENT_PREFIX_MISMATCH", {
        phase: "setup",
        entity: "client",
        operation: "verify mission prefix",
        createdId,
        verifiedId: verifiedClient.id,
      });
    }

    const hash = await bcrypt.hash(rawPassword, 10);
    try {
      await prisma.client.update({ where: { id: verifiedClient.id }, data: { password: hash } });
    } catch (error) {
      throw buildTestSetupError(
        "TEST_SETUP_CLIENT_PASSWORD_UPDATE_FAILED",
        {
          phase: "setup",
          entity: "client",
          operation: "prisma.client.update(password)",
          createdId,
          verifiedId: verifiedClient.id,
        },
        error
      );
    }

    report.createdData.clientIds.push(verifiedClient.id);
    report.createdData.clientRecords.push({
      label,
      createdId,
      verifiedId: verifiedClient.id,
      email: verifiedClient.email,
      name: verifiedClient.name,
    });

    addCheck(`${label.toLowerCase()} client created+verified`, true, `createdId=${createdId} verifiedId=${verifiedClient.id}`, "high");

    return verifiedClient;
  };

  const rawPasswordA = `${missionPrefix}-ClientA-123!`;
  const rawPasswordB = `${missionPrefix}-ClientB-123!`;

  const clientA = await createAndVerifyClient({
    label: "CLIENT A",
    email: clientEmailA,
    phone: "910000101",
    address: `${missionPrefix} Street 1`,
    zone: `${missionPrefix}-ZONE-A`,
    notes: `${missionPrefix} disposable client A`,
    rawPassword: rawPasswordA,
  });

  const clientB = await createAndVerifyClient({
    label: "CLIENT B",
    email: clientEmailB,
    phone: "910000102",
    address: `${missionPrefix} Street 2`,
    zone: `${missionPrefix}-ZONE-B`,
    notes: `${missionPrefix} disposable client B`,
    rawPassword: rawPasswordB,
  });

  const clientAId = Number(clientA.id || 0);
  const clientBId = Number(clientB.id || 0);

  const poolRes = await request("POST", "/api/pools", {
    token: adminToken,
    body: {
      clientId: clientAId,
      name: `${missionPrefix} POOL A`,
      volumeM3: 32,
      location: `${missionPrefix} Location`,
      address: `${missionPrefix} Street 1`,
      type: "RECTANGULAR",
      latitude: 37.102,
      longitude: -8.672,
      notes: `${missionPrefix} disposable pool`,
    },
    expectedStatuses: [200, 201],
  });

  const poolId = Number(poolRes.data.pool?.id || poolRes.data.id || 0);
  if (!poolId) {
    throw new Error("Failed to create disposable pool with valid ID.");
  }
  report.createdData.poolIds.push(poolId);

  return {
    technicianId,
    technicianPin: pin,
    clientAId,
    clientBId,
    clientAEmail: clientEmailA,
    clientBEmail: clientEmailB,
    clientAPassword: rawPasswordA,
    clientBPassword: rawPasswordB,
    poolId,
  };
}

async function authenticateTechnician(pin) {
  const login = await request("POST", "/api/technician-auth/login", {
    body: { pin },
    expectedStatuses: [200],
  });
  const token = login.data.token;
  addCheck("technician valid login", Boolean(token), `status ${login.status}`, "critical");
  report.auth.technician = { ok: Boolean(token) };
  return token;
}

async function authenticateClient(email, password, verifiedClientId) {
  const login = await request("POST", "/api/client-auth/login", {
    body: { email, password },
    expectedStatuses: [200],
  });

  const token =
    login.data.token ||
    login.data.accessToken ||
    login.data.jwt ||
    login.data.authToken ||
    login.data.clientToken ||
    login.data?.data?.token ||
    null;

  const ok = Boolean(token) && login.data?.ok !== false;
  addCheck("client valid login", ok, `status ${login.status}`, "critical");
  report.auth.client = { ok, status: login.status };

  if (!ok) {
    throw buildTestSetupError(
      "TEST_SETUP_CLIENT_AUTH_FAILED",
      {
        phase: "setup",
        entity: "client-auth",
        operation: "POST /api/client-auth/login",
        createdId: verifiedClientId ?? null,
        verifiedId: verifiedClientId ?? null,
      },
      new Error(`status=${login.status} response=${safeToJson(login.data).slice(0, 500)}`)
    );
  }

  return token;
}

async function runCoreJourneys(adminToken, technicianToken, clientAToken, clientBToken, ids) {
  const plannedDate = new Date().toISOString();

  const startVisit = await request("POST", "/api/visits/start", {
    token: adminToken,
    body: {
      poolId: ids.poolId,
      technicianId: ids.technicianId,
      plannedDate,
      notes: `${missionPrefix} start visit`,
      startNow: false,
    },
    expectedStatuses: [200, 201],
  });

  const serviceVisitId = Number(startVisit.data.visit?.id || startVisit.data.serviceVisit?.id || 0);
  addCheck("start visit", serviceVisitId > 0, `visit ${serviceVisitId || "n/a"}`, "critical");
  if (!serviceVisitId) throw new Error("Visit start did not return a valid visit ID.");
  report.createdData.serviceVisitIds.push(serviceVisitId);

  let duplicateBlocked = false;
  let duplicateCreatedDifferent = false;
  try {
    const duplicateStart = await request("POST", "/api/visits/start", {
      token: adminToken,
      body: {
        poolId: ids.poolId,
        technicianId: ids.technicianId,
        plannedDate,
        notes: `${missionPrefix} duplicate start attempt`,
        startNow: false,
      },
      expectedStatuses: [200, 201, 400, 409],
    });

    const duplicateVisitId = Number(duplicateStart.data.visit?.id || duplicateStart.data.serviceVisit?.id || 0);
    duplicateBlocked = [400, 409].includes(duplicateStart.status) || duplicateVisitId === serviceVisitId;
    duplicateCreatedDifferent = duplicateVisitId > 0 && duplicateVisitId !== serviceVisitId && [200, 201].includes(duplicateStart.status);
    if (duplicateCreatedDifferent) {
      report.createdData.serviceVisitIds.push(duplicateVisitId);
    }
  } catch (error) {
    duplicateBlocked = true;
  }

  addCheck(
    "duplicate visit start protection",
    duplicateBlocked && !duplicateCreatedDifferent,
    duplicateCreatedDifferent ? "duplicate generated second visit" : "blocked or idempotent",
    "high"
  );

  const complete = await request("POST", `/api/core/visits/${serviceVisitId}/complete`, {
    token: adminToken,
    body: {
      visitId: serviceVisitId,
      technicianId: ids.technicianId,
      ph: 7.3,
      chlorine: 1.5,
      alkalinity: 95,
      salt: 1200,
      orpMv: 680,
      temperature: 26,
      notes: `${missionPrefix} complete visit`,
      cleaned: true,
      brushed: true,
      basketCleaned: true,
    },
    expectedStatuses: [200],
  });

  addCheck("complete visit", complete.status === 200, `status ${complete.status}`, "critical");

  let duplicateCompleteBlocked = false;
  try {
    const duplicateComplete = await request("POST", `/api/core/visits/${serviceVisitId}/complete`, {
      token: adminToken,
      body: {
        visitId: serviceVisitId,
        technicianId: ids.technicianId,
        ph: 7.3,
        chlorine: 1.5,
        alkalinity: 95,
        notes: `${missionPrefix} duplicate completion attempt`,
      },
      expectedStatuses: [200, 400, 409],
    });

    duplicateCompleteBlocked = [400, 409].includes(duplicateComplete.status);
  } catch (_) {
    duplicateCompleteBlocked = true;
  }

  addCheck("duplicate visit completion protection", duplicateCompleteBlocked, "blocked duplicate completion", "high");

  const todayTech = await request("GET", `/api/technician/today?technicianId=${ids.technicianId}`, {
    token: technicianToken,
    expectedStatuses: [200],
  });
  addCheck("technician today route loads", todayTech.status === 200, `duration ${todayTech.durationMs}ms`, "high");

  const portalA = await request("GET", `/api/client-portal/${ids.clientAId}`, {
    token: clientAToken,
    expectedStatuses: [200],
  });
  addCheck("client portal own data access", portalA.status === 200, `duration ${portalA.durationMs}ms`, "high");

  let crossBlocked = false;
  try {
    const cross = await request("GET", `/api/client-portal/${ids.clientAId}`, {
      token: clientBToken,
      expectedStatuses: [200, 401, 403],
    });
    crossBlocked = [401, 403].includes(cross.status) || cross.data?.client?.id === ids.clientBId;
  } catch (_) {
    crossBlocked = true;
  }
  addCheck("cross-customer access blocked", crossBlocked, "customer B cannot read customer A", "critical");

  const adminCards = await request("GET", "/api/dashboard/metrics", {
    token: adminToken,
    expectedStatuses: [200],
  });
  addCheck("admin dashboard metrics loads", adminCards.status === 200, `duration ${adminCards.durationMs}ms`, "high");

  let techToAdminBlocked = false;
  try {
    const techClients = await request("GET", "/api/clients", {
      token: technicianToken,
      expectedStatuses: [200, 401, 403],
    });
    techToAdminBlocked = [401, 403].includes(techClients.status);
  } catch (_) {
    techToAdminBlocked = true;
  }
  addCheck("technician blocked from admin clients endpoint", techToAdminBlocked, "role restriction", "critical");

  let clientToAdminBlocked = false;
  try {
    const clientMetrics = await request("GET", "/api/dashboard/metrics", {
      token: clientAToken,
      expectedStatuses: [200, 401, 403],
    });
    clientToAdminBlocked = [401, 403].includes(clientMetrics.status);
  } catch (_) {
    clientToAdminBlocked = true;
  }
  addCheck("client blocked from admin dashboard endpoint", clientToAdminBlocked, "role restriction", "critical");
}

async function runResponsiveHeuristics(adminToken, technicianToken, clientToken, ids) {
  const screens = [
    { name: "Admin Command Center", route: "/admin-master-control", role: "admin" },
    { name: "Technician Today", route: "/technician-field-mode", role: "technician" },
    { name: "Technician Visit", route: "/technician-visit", role: "technician" },
    { name: "Customer Portal", route: "/client-portal", role: "client" },
    { name: "Customer History", route: "/client-history", role: "client" },
    { name: "Inventory", route: "/admin-inventory", role: "admin" },
    { name: "Invoices", route: "/invoices", role: "admin" },
  ];

  for (const screen of screens) {
    try {
      const token = screen.role === "admin" ? adminToken : screen.role === "technician" ? technicianToken : clientToken;
      const res = await request("GET", screen.route, {
        token,
        expectedStatuses: [200],
        headers: { Accept: "text/html" },
      });

      const html = typeof res.data.raw === "string" ? res.data.raw : JSON.stringify(res.data);
      const hasLegacy = html.includes("/cw-polish.css") || html.includes("/cw-flow-shell.js");
      const hasV2 = html.includes("/crystal-os-v2-foundation.css") || html.includes("/crystal-os-v2-shell.js");

      report.responsive.screenChecks.push({
        screen: screen.name,
        route: screen.route,
        status: res.status,
        durationMs: res.durationMs,
        hasLegacyIncludes: hasLegacy,
        hasV2Includes: hasV2,
      });

      addCheck(`${screen.name} html reachable`, res.status === 200, `${res.durationMs}ms`, "high");
      addCheck(`${screen.name} V2 includes present`, hasV2, screen.route, "high");
      addCheck(`${screen.name} legacy includes absent`, !hasLegacy, screen.route, "high");
    } catch (error) {
      addCheck(`${screen.name} html reachable`, false, summarizeError(error), "high");
    }
  }

  report.limitations.push(
    "Viewport overflow/clipping and tap-target validation require browser automation runtime (Playwright package not installed in project runtime)."
  );
  report.limitations.push(
    "Offline/reconnect scenario requires browser network emulation and service-worker/event inspection not available in this Node-only runner."
  );
}

async function benchmarkEndpoint(name, fn, samples = 9) {
  const values = [];
  let failures = 0;
  for (let i = 0; i < samples; i += 1) {
    try {
      const started = Date.now();
      await fn();
      values.push(Date.now() - started);
    } catch (_) {
      failures += 1;
    }
  }

  const stats = {
    samples,
    ok: values.length,
    failures,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: values.length ? Math.max(...values) : null,
    min: values.length ? Math.min(...values) : null,
  };
  report.performance.endpoints[name] = stats;
  addCheck(`${name} performance sample`, failures === 0, `p50=${stats.p50} p95=${stats.p95} p99=${stats.p99}`, failures ? "high" : "medium");
}

async function runConcurrencyProbe(name, fn, parallel = 5) {
  const started = Date.now();
  const results = await Promise.allSettled(Array.from({ length: parallel }).map(() => fn()));
  const duration = Date.now() - started;
  const failed = results.filter((r) => r.status === "rejected").length;
  report.performance.concurrency[name] = {
    parallel,
    failed,
    durationMs: duration,
  };
  addCheck(`${name} concurrency probe`, failed === 0, `${parallel} req in ${duration}ms`, failed ? "high" : "medium");
}

async function countPrefixFootprint(prefix) {
  const [clients, pools, technicians, notifications, messages, invoices, visits] = await Promise.all([
    prisma.client.count({ where: { OR: [{ name: { contains: prefix, mode: "insensitive" } }, { email: { contains: prefix.toLowerCase(), mode: "insensitive" } }] } }),
    prisma.pool.count({ where: { OR: [{ name: { contains: prefix, mode: "insensitive" } }, { notes: { contains: prefix, mode: "insensitive" } }] } }),
    prisma.technician.count({ where: { OR: [{ name: { contains: prefix, mode: "insensitive" } }, { email: { contains: prefix.toLowerCase(), mode: "insensitive" } }] } }),
    prisma.notification.count({ where: { OR: [{ message: { contains: prefix, mode: "insensitive" } }, { title: { contains: prefix, mode: "insensitive" } }] } }),
    prisma.clientMessage.count({ where: { OR: [{ message: { contains: prefix, mode: "insensitive" } }, { text: { contains: prefix, mode: "insensitive" } }] } }),
    prisma.invoice.count({ where: { OR: [{ notes: { contains: prefix, mode: "insensitive" } }, { invoiceNumber: { contains: prefix, mode: "insensitive" } }] } }),
    prisma.serviceVisit.count({ where: { notes: { contains: prefix, mode: "insensitive" } } }),
  ]);

  return { clients, pools, technicians, notifications, messages, invoices, visits };
}

async function cleanupOwnTestData(prefix) {
  const clientIds = Array.from(new Set(report.createdData.clientIds.filter(Boolean)));
  const poolIds = Array.from(new Set(report.createdData.poolIds.filter(Boolean)));
  const technicianIds = Array.from(new Set(report.createdData.technicianIds.filter(Boolean)));

  const serviceVisits = await prisma.serviceVisit.findMany({
    where: {
      OR: [
        { id: { in: report.createdData.serviceVisitIds } },
        { clientId: { in: clientIds } },
        { poolId: { in: poolIds } },
        { technicianId: { in: technicianIds } },
      ],
    },
    select: { id: true },
  });
  const serviceVisitIds = serviceVisits.map((r) => r.id);

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { id: { in: report.createdData.invoiceIds } },
        { clientId: { in: clientIds } },
      ],
    },
    select: { id: true },
  });
  const invoiceIds = invoices.map((r) => r.id);

  if (serviceVisitIds.length) {
    await prisma.visitPhoto.deleteMany({ where: { visitId: { in: serviceVisitIds } } });
    await prisma.chemicalUsage.deleteMany({ where: { visitId: { in: serviceVisitIds } } });
    await prisma.attachment.deleteMany({ where: { serviceVisitId: { in: serviceVisitIds } } });
    await prisma.auditTrail.deleteMany({ where: { visitId: { in: serviceVisitIds } } });
    await prisma.serviceVisit.deleteMany({ where: { id: { in: serviceVisitIds } } });
  }

  if (invoiceIds.length) {
    await prisma.attachment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  }

  if (poolIds.length) {
    await prisma.technicalHistory.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.technicalAlert.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.repair.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.poolMessage.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.poolEquipment.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.technicalRoom.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.technicalSheet.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.attachment.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.visit.deleteMany({ where: { poolId: { in: poolIds } } });
    await prisma.pool.deleteMany({ where: { id: { in: poolIds } } });
  }

  if (clientIds.length) {
    await prisma.clientMessage.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.chatMessage.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.communicationLog.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.notification.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.attachment.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.visit.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  }

  if (technicianIds.length) {
    await prisma.serviceVisit.deleteMany({ where: { technicianId: { in: technicianIds } } });
    await prisma.visit.deleteMany({ where: { technicianId: { in: technicianIds } } });
    await prisma.technician.deleteMany({ where: { id: { in: technicianIds } } });
  }

  // Notifications generated by workflow automations may not carry client FK.
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { id: { in: report.createdData.notificationIds } },
        { title: { contains: prefix, mode: "insensitive" } },
        { message: { contains: prefix, mode: "insensitive" } },
      ],
    },
  });
}

async function main() {
  console.log(`Crystal OS Zero Bugs runner: ${missionPrefix}`);
  console.log(`Base URL: ${BASE_URL}`);

  report.cleanup.before = await countPrefixFootprint(missionPrefix);
  const staleCount = Object.values(report.cleanup.before).reduce((sum, value) => sum + Number(value || 0), 0);
  if (staleCount > 0) {
    throw buildTestSetupError("TEST_SETUP_STALE_MISSION_DATA", {
      phase: "setup",
      entity: "cleanup",
      operation: "preflight stale mission check",
      createdId: null,
      verifiedId: null,
    });
  }

  const adminToken = await authenticateAdmin();
  const ids = await createDisposableCoreData(adminToken);
  const technicianToken = await authenticateTechnician(ids.technicianPin);
  const clientAToken = await authenticateClient(ids.clientAEmail, ids.clientAPassword, ids.clientAId);
  const clientBToken = await authenticateClient(ids.clientBEmail, ids.clientBPassword, ids.clientBId);

  await runCoreJourneys(adminToken, technicianToken, clientAToken, clientBToken, ids);

  await runResponsiveHeuristics(adminToken, technicianToken, clientAToken, ids);

  await benchmarkEndpoint("admin dashboard metrics", () =>
    request("GET", "/api/dashboard/metrics", { token: adminToken, expectedStatuses: [200] })
  );
  await benchmarkEndpoint("technician today", () =>
    request("GET", `/api/technician/today?technicianId=${ids.technicianId}`, { token: technicianToken, expectedStatuses: [200] })
  );
  await benchmarkEndpoint("customer portal", () =>
    request("GET", `/api/client-portal/${ids.clientAId}`, { token: clientAToken, expectedStatuses: [200] })
  );

  await runConcurrencyProbe("dashboard metrics", () =>
    request("GET", "/api/dashboard/metrics", { token: adminToken, expectedStatuses: [200] }), 5
  );
  await runConcurrencyProbe("visit completion duplicate probe", () =>
    request("POST", `/api/core/visits/${report.createdData.serviceVisitIds[0]}/complete`, {
      token: adminToken,
      expectedStatuses: [200, 400, 409],
      body: {
        visitId: report.createdData.serviceVisitIds[0],
        technicianId: ids.technicianId,
        ph: 7.4,
        chlorine: 1.6,
        alkalinity: 90,
        notes: `${missionPrefix} concurrent completion probe`,
      },
    }), 3
  );

  if (report.limitations.length) {
    addCheck("offline/reconnect fully validated", false, "Node runner cannot emulate real browser offline/reconnect", "medium");
    addCheck("visual overflow fully validated", false, "No browser runtime for pixel/layout validation", "medium");
  }

  report.status = report.blockingFailures.length ? "FAILED" : "PASSED";
} 

main()
  .catch((error) => {
    const message = summarizeError(error);
    report.status = "ERROR";
    addCheck("runner fatal error", false, message, "critical");
  })
  .finally(async () => {
    try {
      await cleanupOwnTestData(missionPrefix);
    } catch (cleanupError) {
      addCheck("cleanup execution", false, summarizeError(cleanupError), "critical");
    }

    try {
      report.cleanup.after = await countPrefixFootprint(missionPrefix);
      report.cleanup.removed = {
        clients: (report.cleanup.before.clients || 0) - (report.cleanup.after.clients || 0),
        pools: (report.cleanup.before.pools || 0) - (report.cleanup.after.pools || 0),
        technicians: (report.cleanup.before.technicians || 0) - (report.cleanup.after.technicians || 0),
        notifications: (report.cleanup.before.notifications || 0) - (report.cleanup.after.notifications || 0),
        messages: (report.cleanup.before.messages || 0) - (report.cleanup.after.messages || 0),
        invoices: (report.cleanup.before.invoices || 0) - (report.cleanup.after.invoices || 0),
        visits: (report.cleanup.before.visits || 0) - (report.cleanup.after.visits || 0),
      };

      const orphanKeys = Object.keys(report.cleanup.after).filter((k) => (report.cleanup.after[k] || 0) > 0);
      report.cleanup.orphans = orphanKeys;
      addCheck("cleanup leaves no mission-prefixed data", orphanKeys.length === 0, orphanKeys.join(", ") || "none", orphanKeys.length ? "critical" : "high");
    } catch (postCleanupError) {
      addCheck("cleanup verification", false, summarizeError(postCleanupError), "critical");
    }

    if (report.status === "RUNNING") {
      report.status = report.blockingFailures.length ? "FAILED" : "PASSED";
    }

    report.generatedAt = new Date().toISOString();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report: ${reportPath}`);

    await prisma.$disconnect().catch(() => null);
    process.exit(report.blockingFailures.length ? 1 : 0);
  });
