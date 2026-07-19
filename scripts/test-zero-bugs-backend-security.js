require("../src/loadEnv")();

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["warn", "error"] });
const fetchImpl = global.fetch || require("node-fetch");

const BASE_URL = process.env.CW_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`;
const missionPrefix = `ZERO-BUGS-BACKEND-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;

const created = {
  technicianIds: [],
  clientIds: [],
  poolIds: [],
  visitIds: [],
  extraVisitIds: [],
};

function check(name, ok, detail = "") {
  const line = `${ok ? "OK" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`;
  if (ok) console.log(line);
  else console.error(line);
  return Boolean(ok);
}

async function request(method, routePath, { token, body, expected = [200, 201] } = {}) {
  const response = await fetchImpl(`${BASE_URL}${routePath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text.slice(0, 300) };
  }

  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${routePath} -> ${response.status}: ${data.error || data.message || text.slice(0, 200)}`);
  }

  return { status: response.status, data };
}

async function loginAdmin() {
  const result = await request("POST", "/api/auth/login", {
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    expected: [200],
  });
  if (!result.data.token) {
    throw new Error("Admin token missing.");
  }
  return result.data.token;
}

async function createDisposableData(adminToken) {
  const pin = String(700000 + (Date.now() % 100000)).slice(-6);
  const technician = await request("POST", "/api/technicians", {
    token: adminToken,
    body: {
      name: `${missionPrefix} TECH`,
      email: `${missionPrefix.toLowerCase()}-tech@cristalwater.pt`,
      phone: "930001111",
      pin,
      role: "TECHNICIAN",
      active: true,
      notes: missionPrefix,
    },
    expected: [200, 201],
  });
  const technicianId = Number(technician.data.id || technician.data.technician?.id || 0);
  if (!technicianId) throw new Error("Failed to create technician.");
  created.technicianIds.push(technicianId);

  const password = `${missionPrefix}-ClientPwd1!`;
  const hash = await bcrypt.hash(password, 10);
  const client = await prisma.client.create({
    data: {
      name: `${missionPrefix} CLIENT`,
      email: `${missionPrefix.toLowerCase()}-client@cristalwater.pt`,
      phone: "910001111",
      address: `${missionPrefix} Street`,
      zone: `${missionPrefix}-ZONE`,
      notes: missionPrefix,
      active: true,
      password: hash,
    },
  });
  created.clientIds.push(client.id);

  const pool = await request("POST", "/api/pools", {
    token: adminToken,
    body: {
      clientId: client.id,
      name: `${missionPrefix} POOL`,
      volumeM3: 20,
      location: `${missionPrefix} Location`,
      address: `${missionPrefix} Street`,
      type: "RECTANGULAR",
      notes: missionPrefix,
    },
    expected: [200, 201],
  });
  const poolId = Number(pool.data.pool?.id || pool.data.id || 0);
  if (!poolId) throw new Error("Failed to create pool.");
  created.poolIds.push(poolId);

  return {
    technicianId,
    pin,
    clientId: client.id,
    clientEmail: client.email,
    clientPassword: password,
    poolId,
  };
}

async function loginTechnician(pin) {
  const result = await request("POST", "/api/technician-auth/login", {
    body: { pin },
    expected: [200],
  });
  if (!result.data.token) throw new Error("Technician token missing.");
  return result.data.token;
}

async function loginClient(email, password) {
  const result = await request("POST", "/api/client-auth/login", {
    body: { email, password },
    expected: [200],
  });
  if (!result.data.token) throw new Error("Client token missing.");
  return result.data.token;
}

async function run() {
  let ok = true;
  const adminToken = await loginAdmin();
  const ids = await createDisposableData(adminToken);
  const technicianToken = await loginTechnician(ids.pin);
  const clientToken = await loginClient(ids.clientEmail, ids.clientPassword);

  const adminClients = await request("GET", "/api/clients", { token: adminToken, expected: [200] });
  ok = check("admin can access client list", adminClients.status === 200) && ok;

  const techClients = await request("GET", "/api/clients", { token: technicianToken, expected: [403] });
  ok = check("technician gets 403 on client list", techClients.status === 403) && ok;

  const clientClients = await request("GET", "/api/clients", { token: clientToken, expected: [403] });
  ok = check("client gets 403 on client list", clientClients.status === 403) && ok;

  const adminMetrics = await request("GET", "/api/dashboard/metrics", { token: adminToken, expected: [200] });
  ok = check("admin can access dashboard metrics", adminMetrics.status === 200) && ok;

  const clientMetrics = await request("GET", "/api/dashboard/metrics", { token: clientToken, expected: [403] });
  ok = check("client gets 403 on dashboard metrics", clientMetrics.status === 403) && ok;

  const technicianMetrics = await request("GET", "/api/dashboard/metrics", { token: technicianToken, expected: [403] });
  ok = check("technician gets expected dashboard metrics result", technicianMetrics.status === 403) && ok;

  const portalOwn = await request("GET", `/api/client-portal/${ids.clientId}`, { token: clientToken, expected: [200] });
  ok = check("customer portal endpoint still works", portalOwn.status === 200) && ok;

  const technicianToday = await request("GET", `/api/technician/today?technicianId=${ids.technicianId}`, {
    token: technicianToken,
    expected: [200],
  });
  ok = check("technician route/visit endpoint still works", technicianToday.status === 200) && ok;

  const plannedNow = new Date().toISOString();
  const firstStart = await request("POST", "/api/visits/start", {
    token: adminToken,
    body: {
      poolId: ids.poolId,
      technicianId: ids.technicianId,
      plannedDate: plannedNow,
      notes: `${missionPrefix} first start`,
    },
    expected: [200, 201],
  });

  const firstVisitId = Number(firstStart.data.visit?.id || 0);
  if (!firstVisitId) throw new Error("First visit start did not return ID.");
  created.visitIds.push(firstVisitId);

  const secondStart = await request("POST", "/api/visits/start", {
    token: adminToken,
    body: {
      poolId: ids.poolId,
      technicianId: ids.technicianId,
      plannedDate: plannedNow,
      notes: `${missionPrefix} duplicate start`,
    },
    expected: [200, 201, 409],
  });

  const secondVisitId = Number(secondStart.data.visit?.id || 0);
  if (secondVisitId && secondVisitId !== firstVisitId) {
    created.visitIds.push(secondVisitId);
  }

  const sequentialDuplicateOk =
    secondStart.status === 409 ||
    (secondStart.status === 200 && secondStart.data.idempotent === true && secondVisitId === firstVisitId) ||
    secondVisitId === firstVisitId;

  ok = check("duplicate sequential visit request creates at most one visit", sequentialDuplicateOk) && ok;

  const concurrentPayload = {
    poolId: ids.poolId,
    technicianId: ids.technicianId,
    plannedDate: plannedNow,
    notes: `${missionPrefix} concurrent start`,
  };

  const [conA, conB] = await Promise.all([
    request("POST", "/api/visits/start", { token: adminToken, body: concurrentPayload, expected: [200, 201, 409] }),
    request("POST", "/api/visits/start", { token: adminToken, body: concurrentPayload, expected: [200, 201, 409] }),
  ]);

  const conIds = [Number(conA.data.visit?.id || 0), Number(conB.data.visit?.id || 0)].filter(Boolean);
  conIds.forEach((id) => {
    if (!created.visitIds.includes(id)) created.visitIds.push(id);
  });

  const uniqueConIds = Array.from(new Set(conIds));
  ok = check("duplicate concurrent visit requests create at most one visit", uniqueConIds.length <= 1) && ok;

  const futureStart = await request("POST", "/api/visits/start", {
    token: adminToken,
    body: {
      poolId: ids.poolId,
      technicianId: ids.technicianId,
      plannedDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      notes: `${missionPrefix} future start`,
    },
    expected: [200, 201],
  });

  const futureVisitId = Number(futureStart.data.visit?.id || 0);
  if (futureVisitId) created.visitIds.push(futureVisitId);
  ok = check("valid future visit succeeds", futureVisitId > 0 && futureVisitId !== firstVisitId) && ok;

  const extraVisit = await request("POST", "/api/extra-visits", {
    token: adminToken,
    body: {
      poolId: ids.poolId,
      technicianId: ids.technicianId,
      scheduledAt: plannedNow,
      visitType: "ONE_OFF",
      type: "EXTRA_SERVICE",
      source: "ADMIN_PLANNER",
      origin: "ADMIN",
      notes: `${missionPrefix} explicit extra visit`,
    },
    expected: [200, 201],
  });

  const extraVisitId = Number(extraVisit.data.extraVisit?.id || extraVisit.data.id || 0);
  if (extraVisitId) created.extraVisitIds.push(extraVisitId);
  ok = check("explicitly allowed extra visit succeeds", extraVisitId > 0) && ok;

  if (!ok) {
    throw new Error("Focused backend security/integrity checks failed.");
  }
}

async function cleanup() {
  if (created.extraVisitIds.length) {
    await prisma.extraVisit.deleteMany({ where: { id: { in: created.extraVisitIds } } });
  }

  if (created.visitIds.length) {
    await prisma.visitPhoto.deleteMany({ where: { visitId: { in: created.visitIds } } });
    await prisma.chemicalUsage.deleteMany({ where: { visitId: { in: created.visitIds } } });
    await prisma.attachment.deleteMany({ where: { serviceVisitId: { in: created.visitIds } } });
    await prisma.auditTrail.deleteMany({ where: { visitId: { in: created.visitIds } } });
    await prisma.serviceVisit.deleteMany({ where: { id: { in: created.visitIds } } });
  }

  if (created.poolIds.length) {
    await prisma.technicalHistory.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.technicalAlert.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.repair.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.poolMessage.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.poolEquipment.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.technicalRoom.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.technicalSheet.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.attachment.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.visit.deleteMany({ where: { poolId: { in: created.poolIds } } });
    await prisma.pool.deleteMany({ where: { id: { in: created.poolIds } } });
  }

  if (created.clientIds.length) {
    await prisma.clientMessage.deleteMany({ where: { clientId: { in: created.clientIds } } });
    await prisma.chatMessage.deleteMany({ where: { clientId: { in: created.clientIds } } });
    await prisma.communicationLog.deleteMany({ where: { clientId: { in: created.clientIds } } });
    await prisma.notification.deleteMany({ where: { clientId: { in: created.clientIds } } });
    await prisma.attachment.deleteMany({ where: { clientId: { in: created.clientIds } } });
    await prisma.visit.deleteMany({ where: { clientId: { in: created.clientIds } } });
    await prisma.clientAccess.deleteMany({ where: { clientId: { in: created.clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: created.clientIds } } });
  }

  if (created.technicianIds.length) {
    await prisma.serviceVisit.deleteMany({ where: { technicianId: { in: created.technicianIds } } });
    await prisma.visit.deleteMany({ where: { technicianId: { in: created.technicianIds } } });
    await prisma.technician.deleteMany({ where: { id: { in: created.technicianIds } } });
  }

  const [clients, technicians, pools, visits, extras] = await Promise.all([
    prisma.client.count({ where: { notes: { contains: missionPrefix, mode: "insensitive" } } }),
    prisma.technician.count({ where: { notes: { contains: missionPrefix, mode: "insensitive" } } }),
    prisma.pool.count({ where: { notes: { contains: missionPrefix, mode: "insensitive" } } }),
    prisma.serviceVisit.count({ where: { notes: { contains: missionPrefix, mode: "insensitive" } } }),
    prisma.extraVisit.count({ where: { notes: { contains: missionPrefix, mode: "insensitive" } } }),
  ]);

  const clean = clients === 0 && technicians === 0 && pools === 0 && visits === 0 && extras === 0;
  if (!clean) {
    throw new Error(`Cleanup residuals detected for ${missionPrefix}: c=${clients}, t=${technicians}, p=${pools}, v=${visits}, e=${extras}`);
  }

  console.log(`OK cleanup verified - ${missionPrefix}`);
}

run()
  .catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error(cleanupError.stack || cleanupError.message || String(cleanupError));
      process.exitCode = 1;
    }
    await prisma.$disconnect().catch(() => null);
  });
