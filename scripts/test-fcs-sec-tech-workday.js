const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.FCS_SEC_BASE_URL || "http://127.0.0.1:3010";

function randomToken(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toDateOnly(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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
  return { status: response.status, data };
}

function addCase(cases, payload) {
  cases.push(payload);
}

(async () => {
  const created = { users: [] };
  const cases = [];
  const t0 = Date.now();
  const today = toDateOnly(new Date());

  try {
    const adminPass = `Pw-${randomToken("admin")}-A1!`;
    const tech1Pass = `Pw-${randomToken("tech1")}-A1!`;
    const tech2Pass = `Pw-${randomToken("tech2")}-A1!`;

    const admin = await prisma.user.create({
      data: {
        email: `${randomToken("admin")}@qa-workday.test`,
        password: await bcrypt.hash(adminPass, 10),
        role: "ADMIN",
        name: "QA Workday Admin",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(admin.id);

    const techUser1 = await prisma.user.create({
      data: {
        email: `${randomToken("tech1")}@qa-workday.test`,
        password: await bcrypt.hash(tech1Pass, 10),
        role: "TECHNICIAN",
        name: "QA Workday Technician 1",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(techUser1.id);

    const techUser2 = await prisma.user.create({
      data: {
        email: `${randomToken("tech2")}@qa-workday.test`,
        password: await bcrypt.hash(tech2Pass, 10),
        role: "TECHNICIAN",
        name: "QA Workday Technician 2",
        active: true,
        mustChangePassword: false,
      },
    });
    created.users.push(techUser2.id);

    // Ensure deterministic baseline for today's workdays.
    await prisma.technicianWorkDay.deleteMany({
      where: { userId: { in: [techUser1.id, techUser2.id] }, date: today },
    });

    const adminLogin = await http("POST", "/api/auth/login", null, { email: admin.email, password: adminPass });
    const tech1Login = await http("POST", "/api/auth/login", null, { email: techUser1.email, password: tech1Pass });
    const tech2Login = await http("POST", "/api/auth/login", null, { email: techUser2.email, password: tech2Pass });

    if (adminLogin.status !== 200 || !adminLogin.data?.token) throw new Error("admin login failed");
    if (tech1Login.status !== 200 || !tech1Login.data?.token) throw new Error("technician user1 login failed");
    if (tech2Login.status !== 200 || !tech2Login.data?.token) throw new Error("technician user2 login failed");

    const adminToken = adminLogin.data.token;
    const tech1Token = tech1Login.data.token;
    const tech2Token = tech2Login.data.token;

    const badUserId = 987654321;

    // 1) admin with valid technician user -> real write expected.
    const beforeAdminValid = await prisma.technicianWorkDay.count({ where: { userId: techUser1.id, date: today } });
    const adminValid = await http("POST", "/api/workday/start", adminToken, { userId: techUser1.id });
    const afterAdminValid = await prisma.technicianWorkDay.count({ where: { userId: techUser1.id, date: today } });
    addCase(cases, {
      name: "admin with valid technician userId",
      expectedStatus: 201,
      gotStatus: adminValid.status,
      bodyOk: adminValid.data?.ok === true,
      dbChanged: beforeAdminValid === 0 && afterAdminValid === 1,
      pass: adminValid.status === 201 && adminValid.data?.ok === true && beforeAdminValid === 0 && afterAdminValid === 1,
      details: {
        message: adminValid.data?.message,
        beforeCount: beforeAdminValid,
        afterCount: afterAdminValid,
      },
    });

    // 2) idempotency -> second start returns success without duplicate write.
    const beforeIdempotent = await prisma.technicianWorkDay.count({ where: { userId: techUser1.id, date: today } });
    const idempotent = await http("POST", "/api/workday/start", adminToken, { userId: techUser1.id });
    const afterIdempotent = await prisma.technicianWorkDay.count({ where: { userId: techUser1.id, date: today } });
    addCase(cases, {
      name: "idempotency on repeated start",
      expectedStatus: 200,
      gotStatus: idempotent.status,
      bodyOk: idempotent.data?.ok === true && idempotent.data?.idempotent === true,
      dbChanged: beforeIdempotent === afterIdempotent,
      pass: idempotent.status === 200 && idempotent.data?.ok === true && idempotent.data?.idempotent === true && beforeIdempotent === afterIdempotent,
      details: {
        message: idempotent.data?.message,
        beforeCount: beforeIdempotent,
        afterCount: afterIdempotent,
      },
    });

    // 3) admin with nonexistent userId -> no write and no 200.
    const beforeMissing = await prisma.technicianWorkDay.count({ where: { userId: badUserId, date: today } });
    const adminMissing = await http("POST", "/api/workday/start", adminToken, { userId: badUserId });
    const afterMissing = await prisma.technicianWorkDay.count({ where: { userId: badUserId, date: today } });
    addCase(cases, {
      name: "admin with nonexistent technician reference",
      expectedStatus: 404,
      gotStatus: adminMissing.status,
      bodyOk: adminMissing.data?.ok === false && adminMissing.data?.code === "USER_NOT_FOUND",
      dbChanged: beforeMissing === afterMissing,
      pass: adminMissing.status === 404 && adminMissing.data?.ok === false && adminMissing.data?.code === "USER_NOT_FOUND" && beforeMissing === afterMissing,
      details: {
        body: adminMissing.data,
        beforeCount: beforeMissing,
        afterCount: afterMissing,
      },
    });

    // 4) technician on own workday.
    const beforeTechOwn = await prisma.technicianWorkDay.count({ where: { userId: techUser2.id, date: today } });
    const techOwn = await http("POST", "/api/workday/start", tech2Token, {});
    const afterTechOwn = await prisma.technicianWorkDay.count({ where: { userId: techUser2.id, date: today } });
    addCase(cases, {
      name: "technician on own workday",
      expectedStatus: 201,
      gotStatus: techOwn.status,
      bodyOk: techOwn.data?.ok === true,
      dbChanged: beforeTechOwn === 0 && afterTechOwn === 1,
      pass: techOwn.status === 201 && techOwn.data?.ok === true && beforeTechOwn === 0 && afterTechOwn === 1,
      details: {
        message: techOwn.data?.message,
        beforeCount: beforeTechOwn,
        afterCount: afterTechOwn,
      },
    });

    // 5) technician on someone else's workday.
    const beforeOther = await prisma.technicianWorkDay.count({ where: { userId: techUser1.id, date: today } });
    const techOther = await http("POST", "/api/workday/start", tech2Token, { userId: techUser1.id });
    const afterOther = await prisma.technicianWorkDay.count({ where: { userId: techUser1.id, date: today } });
    addCase(cases, {
      name: "technician on another technician workday",
      expectedStatus: 403,
      gotStatus: techOther.status,
      bodyOk: techOther.data?.ok === false,
      dbChanged: beforeOther === afterOther,
      pass: techOther.status === 403 && techOther.data?.ok === false && beforeOther === afterOther,
      details: {
        body: techOther.data,
        beforeCount: beforeOther,
        afterCount: afterOther,
      },
    });

    // 6) invalid reference payload.
    const beforeInvalid = await prisma.technicianWorkDay.count({ where: { userId: techUser2.id, date: today } });
    const invalidRef = await http("POST", "/api/workday/start", adminToken, { userId: -7 });
    const afterInvalid = await prisma.technicianWorkDay.count({ where: { userId: techUser2.id, date: today } });
    addCase(cases, {
      name: "invalid reference payload",
      expectedStatus: 422,
      gotStatus: invalidRef.status,
      bodyOk: invalidRef.data?.ok === false,
      dbChanged: beforeInvalid === afterInvalid,
      pass: invalidRef.status === 422 && invalidRef.data?.ok === false && beforeInvalid === afterInvalid,
      details: {
        body: invalidRef.data,
        beforeCount: beforeInvalid,
        afterCount: afterInvalid,
      },
    });

    // 7) optional mismatch payload (technicianId only, no userId).
    const techIdOnly = await http("POST", "/api/workday/start", adminToken, { technicianId: 999999 });
    addCase(cases, {
      name: "admin payload with technicianId only",
      expectedStatus: 422,
      gotStatus: techIdOnly.status,
      bodyOk: techIdOnly.data?.ok === false,
      dbChanged: true,
      pass: techIdOnly.status === 422 && techIdOnly.data?.ok === false,
      details: {
        body: techIdOnly.data,
      },
    });

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
    const outPath = path.join(reportsDir, `fcs-sec-tech-workday-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

    console.log(JSON.stringify({ ok: failCount === 0, outPath, totals: result.totals }, null, 2));
    if (failCount > 0) process.exitCode = 1;
  } catch (err) {
    console.error("FCS_SEC_TECH_WORKDAY_TEST_ERROR", err);
    process.exitCode = 1;
  } finally {
    try {
      if (created.users.length) {
        await prisma.technicianWorkDay.deleteMany({ where: { userId: { in: created.users }, date: today } }).catch(() => null);
        await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => null);
      }
    } catch (_) {
      // noop cleanup guard
    }
    await prisma.$disconnect().catch(() => null);
  }
})();
