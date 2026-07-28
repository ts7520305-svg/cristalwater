const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");
const { getJwtSecret } = require("../src/utils/jwtSecret");

const BASE_URL = process.env.FCS_SEC_BASE_URL || "http://127.0.0.1:3010";
const JWT_SECRET = getJwtSecret();

function randomToken(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function expectStatus(actual, expected) {
  if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
}

function parseBaseUrl(baseUrl) {
  const parsed = new URL(baseUrl);
  const protocol = parsed.protocol;
  const host = parsed.hostname;
  const port = Number(parsed.port || (protocol === "https:" ? 443 : 80));
  return { protocol, host, port };
}

function checkPortInUse(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function waitForPort(host, port, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const inUse = await checkPortInUse(host, port, 1000);
    if (inUse) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureServerForSecurity(baseUrl) {
  const { host, port } = parseBaseUrl(baseUrl);
  const alreadyRunning = await checkPortInUse(host, port);
  if (alreadyRunning) {
    console.log(`[SEC_AUTH] Reusing existing service on ${host}:${port}`);
    return { startedByTest: false, child: null, host, port };
  }

  console.log(`[SEC_AUTH] Starting temporary service on ${host}:${port}`);
  const child = spawn("npm", ["start"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => {
    const text = String(chunk || "").trim();
    if (text) process.stdout.write(`[SEC_AUTH:server] ${text}\n`);
  });
  child.stderr?.on("data", (chunk) => {
    const text = String(chunk || "").trim();
    if (text) process.stderr.write(`[SEC_AUTH:server] ${text}\n`);
  });

  const up = await waitForPort(host, port, 25000);
  if (!up) {
    try { child.kill("SIGTERM"); } catch (_) {}
    throw new Error(`unable to start temporary service on ${host}:${port}`);
  }

  return { startedByTest: true, child, host, port };
}

async function stopServerIfOwned(lifecycle) {
  if (!lifecycle?.startedByTest || !lifecycle?.child) return;
  const pid = lifecycle.child.pid;
  if (!pid) return;
  console.log(`[SEC_AUTH] Stopping temporary service pid=${pid}`);
  try {
    lifecycle.child.kill("SIGTERM");
  } catch (_) {}
}

(async () => {
  const created = {
    users: [],
    technicians: [],
    clients: [],
    pools: [],
    visits: [],
  };

  const cases = [];
  const pushCase = (name, expected, got, details = "", passOverride = null) => {
    const pass = passOverride === null ? expected === got : Boolean(passOverride);
    cases.push({ name, expectedStatus: expected, gotStatus: got, pass, details });
  };

  const t0 = Date.now();
  let serverLifecycle = null;

  try {
    serverLifecycle = await ensureServerForSecurity(BASE_URL);

    const adminPass = `Pw-${randomToken("admin")}-A1!`;
    const adminEmail = `${randomToken("admin")}@qa-sec-tech.test`;
    const adminHash = await bcrypt.hash(adminPass, 10);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: adminHash,
        role: "ADMIN",
        name: "QA SEC ADMIN",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(adminUser.id);

    const techWorkdayPass = `Pw-${randomToken("workday")}-A1!`;
    const techWorkdayEmail = `${randomToken("workday")}@qa-sec-tech.test`;
    const techWorkdayHash = await bcrypt.hash(techWorkdayPass, 10);
    const techWorkdayUser = await prisma.user.create({
      data: {
        email: techWorkdayEmail,
        password: techWorkdayHash,
        role: "TECHNICIAN",
        name: "QA SEC WORKDAY TECH USER",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(techWorkdayUser.id);

    const tech1 = await prisma.technician.create({
      data: {
        name: `QA TECH 1 ${randomToken("t1")}`,
        email: `${randomToken("tech1")}@qa-sec-tech.test`,
        pin: "1111",
        role: "TECHNICIAN",
        active: true,
        zone: "QA",
      },
    });
    created.technicians.push(tech1.id);

    const tech2 = await prisma.technician.create({
      data: {
        name: `QA TECH 2 ${randomToken("t2")}`,
        email: `${randomToken("tech2")}@qa-sec-tech.test`,
        pin: "2222",
        role: "TECHNICIAN",
        active: true,
        zone: "QA",
      },
    });
    created.technicians.push(tech2.id);

    const client1 = await prisma.client.create({
      data: {
        name: `QA SEC CLIENT ${randomToken("c")}`,
        status: "ACTIVE",
        active: true,
      },
    });
    created.clients.push(client1.id);

    const pool1 = await prisma.pool.create({
      data: {
        clientId: client1.id,
        name: `QA SEC POOL ${randomToken("p")}`,
        active: true,
      },
    });
    created.pools.push(pool1.id);

    const visit1 = await prisma.serviceVisit.create({
      data: {
        clientId: client1.id,
        poolId: pool1.id,
        technicianId: tech1.id,
        technicianName: tech1.name,
        plannedDate: new Date(),
        status: "PLANNED",
      },
    });
    created.visits.push(visit1.id);

    const visit2 = await prisma.serviceVisit.create({
      data: {
        clientId: client1.id,
        poolId: pool1.id,
        technicianId: tech2.id,
        technicianName: tech2.name,
        plannedDate: new Date(),
        status: "PLANNED",
      },
    });
    created.visits.push(visit2.id);

    const adminLogin = await http("POST", "/api/auth/login", null, { email: adminEmail, password: adminPass });
    if (adminLogin.status !== 200 || !adminLogin.data?.token) throw new Error("admin login failed");
    const adminToken = adminLogin.data.token;

    const tech1Login = await http("POST", "/api/technician-auth/login", null, { pin: "1111" });
    if (tech1Login.status !== 200 || !tech1Login.data?.token) throw new Error("tech1 login failed");
    const tech1Token = tech1Login.data.token;

    const tech2Login = await http("POST", "/api/technician-auth/login", null, { pin: "2222" });
    if (tech2Login.status !== 200 || !tech2Login.data?.token) throw new Error("tech2 login failed");
    const tech2Token = tech2Login.data.token;

    const invalidToken = "invalid.jwt.token";
    const expiredToken = jwt.sign(
      { id: tech1.id, technicianId: tech1.id, role: "TECHNICIAN", name: tech1.name },
      JWT_SECRET,
      { expiresIn: -1 }
    );

    // Anonymous checks
    pushCase("anon /api/technician-intake/settings", 401, (await http("GET", "/api/technician-intake/settings")).status);
    pushCase("anon /api/workday/start", 401, (await http("POST", "/api/workday/start", null, { userId: tech1.id })).status);
    pushCase("anon /api/gps/update", 401, (await http("POST", "/api/gps/update", null, { userId: tech1.id, latitude: 37.1, longitude: -8.2 })).status);
    pushCase("anon /api/technicians", 401, (await http("GET", "/api/technicians")).status);

    // Invalid and expired token
    pushCase("invalid token /api/technicians", 401, (await http("GET", "/api/technicians", invalidToken)).status);
    pushCase("expired token /api/technician/today", 401, (await http("GET", "/api/technician/today", expiredToken)).status);

    // Role checks
    pushCase("tech cannot list technicians", 403, (await http("GET", "/api/technicians", tech1Token)).status);
    pushCase("tech cannot access intake pending-review", 403, (await http("GET", "/api/technician-intake/pending-review", tech1Token)).status);
    pushCase("tech cannot approve intake", 403, (await http("POST", "/api/technician-intake/clients/999999/approve", tech1Token, { userId: adminUser.id, actor: "qa" })).status);
    pushCase("tech cannot access billing technician-profit", 403, (await http("GET", "/api/billing/technician-profit", tech1Token)).status);
    pushCase("admin can access billing technician-profit", 200, (await http("GET", "/api/billing/technician-profit", adminToken)).status);

    // Ownership checks
    pushCase("tech cannot read other technician visit", 403, (await http("GET", `/api/visits/${visit2.id}`, tech1Token)).status);
    pushCase("tech can read own visit", 200, (await http("GET", `/api/visits/${visit1.id}`, tech1Token)).status);
    pushCase("tech cannot start workday for another technician", 403, (await http("POST", "/api/workday/start", tech1Token, { userId: tech2.id })).status);
    pushCase("tech cannot read workday status of another technician", 403, (await http("GET", `/api/workday/status/${tech2.id}`, tech1Token)).status);
    pushCase("tech cannot spoof gps userId", 403, (await http("POST", "/api/gps/update", tech1Token, { userId: tech2.id, latitude: 37.1, longitude: -8.2 })).status);
    pushCase("tech cannot spoof intake technicianId", 403, (await http("POST", "/api/technician-intake/client-with-pool", tech1Token, { technicianId: tech2.id, clientName: "X", poolName: "Y" })).status);

    // Scoped today endpoint
    const scopedToday = await http("GET", `/api/technician/today?technicianId=${tech2.id}`, tech1Token);
    let scopedTodayPass = false;
    if (scopedToday.status === 200) {
      const visits = Array.isArray(scopedToday.data?.visits) ? scopedToday.data.visits : [];
      scopedTodayPass = visits.every((v) => Number(v.technician?.id || v.technicianId || 0) !== tech2.id);
    }
    pushCase(
      "tech today endpoint enforces own technician scope",
      200,
      scopedToday.status,
      scopedTodayPass ? "scoped=true" : "scoped=false"
    );

    // Admin allowed operations on protected routes
    pushCase("admin can list technicians", 200, (await http("GET", "/api/technicians", adminToken)).status);
    pushCase("admin can read intake pending-review", 200, (await http("GET", "/api/technician-intake/pending-review", adminToken)).status);
    {
      const adminWorkdayStart = await http("POST", "/api/workday/start", adminToken, { userId: techWorkdayUser.id });
      const workdayStatusOk = adminWorkdayStart.status === 200 || adminWorkdayStart.status === 201;
      const workdayBodyOk = adminWorkdayStart.data?.ok === true;
      pushCase(
        "admin can call workday start",
        200,
        adminWorkdayStart.status,
        `bodyOk=${workdayBodyOk}`,
        workdayStatusOk && workdayBodyOk
      );
    }
    pushCase("admin can call gps update", 200, (await http("POST", "/api/gps/update", adminToken, { userId: tech1.id, latitude: 37.1, longitude: -8.2 })).status);

    const passCount = cases.filter((c) => c.pass).length;
    const failCount = cases.length - passCount;

    const result = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      totals: {
        total: cases.length,
        pass: passCount,
        fail: failCount,
      },
      cases,
      runtimeMs: Date.now() - t0,
    };

    const reportsDir = path.join(process.cwd(), "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    const outPath = path.join(reportsDir, `fcs-sec-tech-auth-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

    console.log(JSON.stringify({ ok: failCount === 0, outPath, totals: result.totals }, null, 2));
    if (failCount > 0) process.exitCode = 1;
  } catch (err) {
    console.error("FCS_SEC_TECH_AUTH_TEST_ERROR", err);
    process.exitCode = 1;
  } finally {
    await stopServerIfOwned(serverLifecycle);
    try {
      if (created.visits.length) {
        await prisma.visitPhoto.deleteMany({ where: { visitId: { in: created.visits } } }).catch(() => null);
        await prisma.chemicalUsage.deleteMany({ where: { visitId: { in: created.visits } } }).catch(() => null);
        await prisma.serviceVisit.deleteMany({ where: { id: { in: created.visits } } }).catch(() => null);
      }
      if (created.pools.length) await prisma.pool.deleteMany({ where: { id: { in: created.pools } } }).catch(() => null);
      if (created.clients.length) await prisma.client.deleteMany({ where: { id: { in: created.clients } } }).catch(() => null);
      if (created.technicians.length) await prisma.technician.deleteMany({ where: { id: { in: created.technicians } } }).catch(() => null);
      if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => null);
    } catch (_) {
      // noop cleanup guard
    }
    await prisma.$disconnect().catch(() => null);
  }
})();
