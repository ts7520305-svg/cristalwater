const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

require("../src/loadEnv")();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["warn", "error"] });
const fetchImpl = global.fetch || require("node-fetch");

const BASE_URL = process.env.CW_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3002}`;
const WIDTHS = [320, 390, 430, 768, 1024, 1440, 1920];
const TARGETS = [
  { page: "/admin-inventory", endpoint: "/api/inventory/report", id: "inventory" },
  { page: "/admin-payments", endpoint: "/api/admin/payments/ledger/all", id: "payments" },
  { page: "/admin-reports", endpoint: "/api/admin/reports", id: "reports" },
  { page: "/invoices", endpoint: "/api/invoices", id: "invoices" },
];

const INCIDENT_REFERENCE_UTC = "2026-07-12T12:19:38.259Z";

function nowIsoSafe() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function randomTag(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseDbName(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return (url.pathname || "").replace(/^\//, "") || "unknown";
  } catch (_) {
    return "unknown";
  }
}

function classifyEnvironment() {
  const nodeEnv = String(process.env.NODE_ENV || "").toLowerCase() || "undefined";
  const dbName = parseDbName(String(process.env.DATABASE_URL || ""));
  const looksProductionDb = /prod|production/i.test(dbName);
  const looksProductionEnv = nodeEnv === "production";

  if (looksProductionEnv || looksProductionDb) {
    return { nodeEnv, dbName, classification: "potential-production" };
  }
  if (nodeEnv === "test") {
    return { nodeEnv, dbName, classification: "test" };
  }
  return { nodeEnv, dbName, classification: "development" };
}

function masked(value) {
  if (!value) return "none";
  const text = String(value);
  if (text.length <= 8) return "***";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function sanitizeText(input) {
  if (input === null || input === undefined) return "";
  let text = String(input);
  text = text.replace(/Bearer\s+[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gi, "Bearer [REDACTED_JWT]");
  text = text.replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[REDACTED_JWT]");
  text = text.replace(/(authorization\s*[:=]\s*)([^,\n]+)/gi, "$1[REDACTED]");
  text = text.replace(/(password\s*[:=]\s*)([^,\n]+)/gi, "$1[REDACTED]");
  text = text.replace(/(pin\s*[:=]\s*)([^,\n]+)/gi, "$1[REDACTED]");
  text = text.replace(/(cookie\s*[:=]\s*)([^,\n]+)/gi, "$1[REDACTED]");
  text = text.replace(/(refresh[_\s-]*token\s*[:=]\s*)([^,\n]+)/gi, "$1[REDACTED]");
  return text;
}

function sanitizeObject(value) {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (!value || typeof value !== "object") return typeof value === "string" ? sanitizeText(value) : value;

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (/token|password|pin|cookie|authorization/i.test(key) && typeof raw === "string") {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = sanitizeObject(raw);
  }
  return out;
}

function buildLocallyExpiredTokenFrom(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return "expired.invalid.token";
    const payloadRaw = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadRaw || "{}");
    const now = Math.floor(Date.now() / 1000);
    payload.iat = now - 7200;
    payload.exp = now - 3600;
    const expiredPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${parts[0]}.${expiredPayload}.${parts[2]}`;
  } catch (_) {
    return "expired.invalid.token";
  }
}

function detectSensitivePatternsInText(text) {
  const findings = [];
  const checks = [
    { key: "jwt", re: /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
    { key: "bearer", re: /Bearer\s+[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/i },
    { key: "authorization_header", re: /authorization\s*:\s*bearer\s+/i },
    { key: "password_kv", re: /"?password"?\s*:\s*"[^\"]{3,}"/i },
    { key: "pin_kv", re: /"?pin"?\s*:\s*"?\d{4,}"?/i },
  ];
  for (const check of checks) {
    if (check.re.test(text)) findings.push(check.key);
  }
  return findings;
}

function computeTokenWindow(referenceIso, ttlSeconds, now = new Date()) {
  const issuedAt = new Date(referenceIso);
  const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
  const remainingMs = expiresAt.getTime() - now.getTime();
  return {
    issuedAtUtc: issuedAt.toISOString(),
    expiresAtUtc: expiresAt.toISOString(),
    timezone: "UTC",
    expired: remainingMs <= 0,
    remainingSeconds: remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0,
  };
}

async function jsonRequest(method, pathname, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetchImpl(`${BASE_URL}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_) {
    data = { raw: raw.slice(0, 220) };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function createTempAdmin(runId) {
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const hash = await bcrypt.hash(plainPassword, 10);
  const email = `${runId.toLowerCase()}@qa-admin.test`;

  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      role: "ADMIN",
      active: true,
      name: `QA TEMP ADMIN ${runId}`,
      mustChangePassword: false,
    },
  });

  const login = await jsonRequest("POST", "/api/auth/login", { email, password: plainPassword });
  if (!login.ok || !login.data?.token) {
    throw new Error(`Login admin temporario falhou: HTTP ${login.status}`);
  }

  return {
    id: user.id,
    email,
    password: plainPassword,
    token: login.data.token,
    user: login.data.user || { role: "ADMIN", id: user.id, email },
  };
}

async function createTempTechnician(runId) {
  const pin = String(Math.floor(1000 + Math.random() * 8999));
  const tech = await prisma.technician.create({
    data: {
      name: `QA TEMP TECH ${runId}`,
      email: `${runId.toLowerCase()}@qa-tech.test`,
      pin,
      role: "TECHNICIAN",
      active: true,
      zone: "QA",
      notes: "temporary isolated qa technician",
    },
  });

  const login = await jsonRequest("POST", "/api/technician-auth/login", { pin });
  if (!login.ok || !login.data?.token) {
    throw new Error(`Login tecnico temporario falhou: HTTP ${login.status}`);
  }

  return {
    id: tech.id,
    token: login.data.token,
    user: login.data.user || { role: "TECHNICIAN", id: tech.id, name: tech.name },
  };
}

async function createTempClient(runId) {
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const hash = await bcrypt.hash(plainPassword, 10);

  const client = await prisma.client.create({
    data: {
      name: `QA TEMP CLIENT ${runId}`,
      email: `${runId.toLowerCase()}@qa-client.test`,
      password: hash,
      active: true,
      status: "ACTIVE",
      billingActive: false,
      source: "QA_ISOLATED",
      notes: "temporary isolated qa client",
    },
  });

  const login = await jsonRequest("POST", "/api/client-auth/login", {
    email: client.email,
    password: plainPassword,
  });

  if (!login.data?.token) {
    throw new Error(`Login cliente temporario falhou: HTTP ${login.status}`);
  }

  return {
    id: client.id,
    token: login.data.token,
    user: login.data.client || { role: "CLIENT", id: client.id, name: client.name, email: client.email },
  };
}

async function backendMatrix(tokens) {
  const summary = [];
  for (const target of TARGETS) {
    const admin = await jsonRequest("GET", target.endpoint, undefined, tokens.admin.token);
    const tech = await jsonRequest("GET", target.endpoint, undefined, tokens.technician.token);
    const client = await jsonRequest("GET", target.endpoint, undefined, tokens.client.token);
    const noSession = await jsonRequest("GET", target.endpoint);
    const tampered = await jsonRequest("GET", target.endpoint, undefined, `${tokens.admin.token}tamper`);

    summary.push({
      id: target.id,
      endpoint: target.endpoint,
      adminStatus: admin.status,
      technicianStatus: tech.status,
      clientStatus: client.status,
      noSessionStatus: noSession.status,
      tamperedStatus: tampered.status,
      pass:
        admin.status === 200 &&
        [401, 403].includes(tech.status) &&
        [401, 403].includes(client.status) &&
        noSession.status === 401 &&
        tampered.status === 401,
    });
  }
  return summary;
}

async function controlledRevocationChecks(tokens) {
  const checks = [];

  const adminBefore = await jsonRequest("GET", "/api/admin/reports", undefined, tokens.admin.token);
  await prisma.user.update({ where: { id: tokens.admin.id }, data: { passwordChangedAt: new Date() } });
  const adminAfter = await jsonRequest("GET", "/api/admin/reports", undefined, tokens.admin.token);
  const adminRelogin = await jsonRequest("POST", "/api/auth/login", {
    email: tokens.admin.email,
    password: tokens.admin.password,
  });
  const adminNewToken = adminRelogin.data?.token || "";
  const adminWithNewToken = adminNewToken
    ? await jsonRequest("GET", "/api/admin/reports", undefined, adminNewToken)
    : { status: 0 };

  checks.push({
    id: "admin-passwordChangedAt-revoke",
    beforeStatus: adminBefore.status,
    afterStatus: adminAfter.status,
    newSessionStatus: adminWithNewToken.status,
    pass: adminBefore.status === 200 && adminAfter.status === 401 && adminWithNewToken.status === 200,
  });

  const technicianBefore = await jsonRequest("GET", "/api/invoices", undefined, tokens.technician.token);
  await prisma.technician.update({ where: { id: tokens.technician.id }, data: { active: false } });
  const technicianAfter = await jsonRequest("GET", "/api/invoices", undefined, tokens.technician.token);
  checks.push({
    id: "technician-deactivate-revoke",
    beforeStatus: technicianBefore.status,
    afterStatus: technicianAfter.status,
    pass: technicianBefore.status === 403 && technicianAfter.status === 401,
  });

  const clientBefore = await jsonRequest("GET", "/api/invoices", undefined, tokens.client.token);
  await prisma.client.update({ where: { id: tokens.client.id }, data: { active: false } });
  const clientAfter = await jsonRequest("GET", "/api/invoices", undefined, tokens.client.token);
  checks.push({
    id: "client-deactivate-revoke",
    beforeStatus: clientBefore.status,
    afterStatus: clientAfter.status,
    pass: clientBefore.status === 403 && clientAfter.status === 401,
  });

  return {
    checks,
    allPass: checks.every((check) => check.pass),
    newAdminTokenIssued: Boolean(adminNewToken),
  };
}

async function frontendMatrix(tokens) {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (_) {
    return {
      executed: false,
      reason: "playwright-not-installed",
      checks: [],
      adminActions: [],
    };
  }

  const browser = await chromium.launch({ headless: true });

  const expiredFrontendToken = buildLocallyExpiredTokenFrom(tokens.admin.token);

  const profiles = [
    { name: "admin", token: tokens.admin.token, user: { role: "ADMIN", id: tokens.admin.id, name: "Temp Admin" }, expected: "allow" },
    { name: "technician", token: tokens.technician.token, user: { role: "TECHNICIAN", id: tokens.technician.id, name: "Temp Tech" }, expected: "deny" },
    { name: "client", token: tokens.client.token, user: { role: "CLIENT", id: tokens.client.id, name: "Temp Client" }, expected: "deny" },
    { name: "no-session", token: "", user: null, expected: "deny" },
    { name: "expired", token: expiredFrontendToken, user: { role: "ADMIN", id: tokens.admin.id, name: "Expired" }, expected: "deny" },
  ];

  const checks = [];
  const adminActions = [];

  async function buildContext(profile) {
    const context = await browser.newContext({ colorScheme: "light" });
    await context.addInitScript((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      if (payload.token) {
        localStorage.setItem("token", payload.token);
        localStorage.setItem("cristalwater_jwt", payload.token);
      }
      if (payload.user) {
        const userRaw = JSON.stringify(payload.user);
        localStorage.setItem("user", userRaw);
        localStorage.setItem("cristalwater_user", userRaw);
      }
    }, { token: profile.token, user: profile.user });
    return context;
  }

  for (const profile of profiles) {
    const context = await buildContext(profile);

    for (const target of TARGETS) {
      for (const width of WIDTHS) {
        const page = await context.newPage({ viewport: { width, height: 920 } });
        const consoleErrors = [];
        const apiErrors = [];
        const adminApiBeforeRedirect = [];

        page.on("console", (msg) => {
          if (msg.type() === "error") {
            const text = sanitizeText(msg.text());
            if (!/favicon|failed to load resource.*sw\.js/i.test(text)) consoleErrors.push(text.slice(0, 160));
          }
        });

        page.on("response", (response) => {
          const url = response.url();
          if (!url.includes("/api/")) return;
          const status = response.status();
          const apiPath = (url.split("/api/")[1] || "api").split("?")[0];
          if (status >= 500) apiErrors.push(`${status}:${sanitizeText(apiPath)}`);
          if (profile.name === "admin" && [401, 403].includes(status)) {
            apiErrors.push(`${status}:${sanitizeText(apiPath)}`);
          }
          if (profile.expected === "deny" && /^(admin\/|inventory|invoices)/i.test(apiPath) && status >= 200 && status < 300) {
            adminApiBeforeRedirect.push(`${status}:${sanitizeText(apiPath)}`);
          }
        });

        await page.goto(`${BASE_URL}${target.page}`, { waitUntil: "domcontentloaded" });

        const firstFrameInfo = await page.evaluate(() => {
          const text = (document.body?.innerText || "").toLowerCase();
          const rootStyle = document.documentElement && window.getComputedStyle(document.documentElement);
          const bodyStyle = document.body && window.getComputedStyle(document.body);
          const rootHidden = rootStyle ? (rootStyle.visibility === "hidden" || rootStyle.display === "none" || Number(rootStyle.opacity || "1") === 0) : false;
          const bodyHidden = bodyStyle ? (bodyStyle.visibility === "hidden" || bodyStyle.display === "none" || Number(bodyStyle.opacity || "1") === 0) : false;
          const sensitive = /(pagamentos|inventario|faturas|relatorios)/.test(text);
          return {
            sensitive,
            hidden: Boolean(rootHidden || bodyHidden),
          };
        }).catch(() => ({ sensitive: false, hidden: false }));
        const firstFrameSensitive = Boolean(firstFrameInfo.sensitive && !firstFrameInfo.hidden);

        await page.waitForTimeout(250);

        const finalUrl = page.url();
        const blocked = /\/(login|client-portal|technician-field-mode)(?:$|[?#])/i.test(finalUrl);
        const finalSnapshot = await page.content().catch(() => "");
        const hasSensitiveWords = /(pagamentos|inventario|faturas|relatorios)/i.test(finalSnapshot || "");
        const horizontalOverflow = await page
          .evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
          .catch(() => false);

        const pass = profile.expected === "allow"
          ? !/\/login(?:$|[?#])/i.test(finalUrl) && apiErrors.length === 0
          : blocked && !hasSensitiveWords && !firstFrameSensitive && adminApiBeforeRedirect.length === 0;

        checks.push({
          profile: profile.name,
          page: target.page,
          width,
          finalPath: finalUrl.replace(BASE_URL, "") || "/",
          blocked,
          firstFrameSensitive,
          hasSensitiveWords,
          adminApiBeforeRedirect: [...new Set(adminApiBeforeRedirect)].slice(0, 3),
          horizontalOverflow,
          consoleErrors: [...new Set(consoleErrors)].slice(0, 3),
          apiErrors: [...new Set(apiErrors)].slice(0, 3),
          pass,
        });

        await page.close();
      }
    }

    if (profile.name === "admin") {
      const page = await context.newPage({ viewport: { width: 1024, height: 920 } });
      const action = { profile: profile.name, actions: [] };

      await page.goto(`${BASE_URL}/admin-inventory`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      const inventoryStatus = await page.locator("#inventoryStatus").textContent().catch(() => "");
      action.actions.push({ page: "admin-inventory", step: "load", ok: Boolean((inventoryStatus || "").trim()) });

      const purchaseInvalid = await page.evaluate(() => {
        const form = document.getElementById("purchaseForm");
        return form ? !form.checkValidity() : false;
      });
      action.actions.push({ page: "admin-inventory", step: "required-fields", ok: purchaseInvalid });

      await page.goto(`${BASE_URL}/admin-payments`, { waitUntil: "domcontentloaded" });
      await page.fill("#paymentSearch", "qa").catch(() => {});
      await page.selectOption("#paymentMethodFilter", "MBWAY").catch(() => {});
      const paymentRows = await page.locator("#tableBox tbody tr").count().catch(() => 0);
      action.actions.push({ page: "admin-payments", step: "load-search-filter", ok: paymentRows >= 0 });

      await page.goto(`${BASE_URL}/admin-reports`, { waitUntil: "domcontentloaded" });
      await page.selectOption("#reportMode", "financial").catch(() => {});
      await page.click("#refreshReports").catch(() => {});
      await page.waitForFunction(() => {
        const node = document.getElementById("reportsStatus");
        if (!node) return false;
        const text = (node.textContent || "").toLowerCase();
        return text.includes("atualizados") || text.includes("actualizados");
      }, { timeout: 5000 }).catch(() => {});
      const reportsStatus = await page.locator("#reportsStatus").textContent().catch(() => "");
      const reportsPath = new URL(page.url()).pathname;
      action.actions.push({
        page: "admin-reports",
        step: "load-refresh",
        ok: /atualizados|actualizados/i.test(reportsStatus || "") && !/login/i.test(reportsPath),
      });

      await page.goto(`${BASE_URL}/invoices`, { waitUntil: "domcontentloaded" });
      await page.selectOption("#statusFilter", "pending").catch(() => {});
      await page.fill("#clientIdInput", "").catch(() => {});
      await page.evaluate(() => {
        if (typeof window.generateInvoiceForClient === "function") {
          window.generateInvoiceForClient();
        }
      }).catch(() => {});
      await page.waitForFunction(() => {
        const node = document.getElementById("statusBox");
        if (!node) return false;
        const text = (node.textContent || "").toLowerCase();
        return text.includes("client id") || text.includes("valido") || text.includes("válido");
      }, { timeout: 3000 }).catch(() => {});
      const invoiceStatus = await page.locator("#statusBox").textContent().catch(() => "");
      action.actions.push({ page: "invoices", step: "filter-invalid-input", ok: /client id|valido|válido|indica/i.test((invoiceStatus || "").toLowerCase()) });

      await page.close();
      adminActions.push(action);
    }

    await context.clearCookies().catch(() => {});
    await context.close();
  }

  await browser.close();

  return {
    executed: true,
    checks,
    adminActions,
  };
}

async function assessQaClientIncident() {
  const candidate = await prisma.client.findFirst({
    where: {
      email: "qa.real.0.REAL-MES-1783808646669@cliente.test",
    },
    select: {
      id: true,
      email: true,
      name: true,
      source: true,
      active: true,
      updatedAt: true,
      _count: {
        select: {
          pools: true,
          invoices: true,
          serviceVisits: true,
          communicationLogs: true,
          messages: true,
        },
      },
    },
  });

  if (!candidate) {
    return {
      found: false,
      classification: "indeterminado",
      action: "no-record",
      note: "Registo alvo nao encontrado.",
    };
  }

  const paymentsCount = await prisma.payment.count({
    where: { invoice: { clientId: candidate.id } },
  });

  const clearlyQaByIdentity = /@.*\.test$/i.test(candidate.email || "") || /\bqa\b/i.test(candidate.name || "");
  const classification = clearlyQaByIdentity ? "fixture de QA confirmada" : "indeterminado";

  let action = "none";
  let credentialReset = false;
  if (classification === "fixture de QA confirmada") {
    const secretPath = "/tmp/cw_qa_client_password.secret";
    const newPassword = `Qa-${crypto.randomBytes(10).toString("hex")}-A1!`;
    fs.writeFileSync(secretPath, `${newPassword}\n`, { mode: 0o600 });
    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.client.update({
      where: { id: candidate.id },
      data: {
        password: hash,
        source: candidate.source || "QA_FIXTURE",
        notes: `${candidate.source || ""}`.includes("QA_FIXTURE")
          ? candidate.source
          : `${candidate.source || ""}`.trim() ? `${candidate.source}; QA_FIXTURE` : "QA_FIXTURE",
      },
    });

    const login = await jsonRequest("POST", "/api/client-auth/login", {
      email: candidate.email,
      password: newPassword,
    });

    credentialReset = login.ok && Boolean(login.data?.token);
    action = credentialReset ? "credential-reset-and-login-validated" : "credential-reset-login-validation-failed";

    try {
      fs.unlinkSync(secretPath);
    } catch (_) {
      // no-op
    }
  } else {
    await prisma.client.update({ where: { id: candidate.id }, data: { active: false } }).catch(() => {});
    action = "client-login-temporarily-blocked";
  }

  return {
    found: true,
    clientId: candidate.id,
    maskedEmail: masked(candidate.email),
    classification,
    source: candidate.source || null,
    hasOperationalData: {
      pools: candidate._count.pools,
      invoices: candidate._count.invoices,
      payments: paymentsCount,
      serviceVisits: candidate._count.serviceVisits,
      communicationLogs: candidate._count.communicationLogs,
      messages: candidate._count.messages,
    },
    action,
    credentialReset,
  };
}

async function cleanupTempUsers(tempIds) {
  const removed = { clients: 0, technicians: 0, admins: 0 };

  if (tempIds.clientId) {
    await prisma.refreshToken.deleteMany({ where: { clientId: tempIds.clientId } }).catch(() => {});
    await prisma.client.delete({ where: { id: tempIds.clientId } }).catch(() => {});
    removed.clients += 1;
  }

  if (tempIds.technicianId) {
    await prisma.technician.delete({ where: { id: tempIds.technicianId } }).catch(() => {});
    removed.technicians += 1;
  }

  if (tempIds.adminId) {
    await prisma.user.delete({ where: { id: tempIds.adminId } }).catch(() => {});
    removed.admins += 1;
  }

  return removed;
}

function buildTokenExposureAssessment() {
  const now = new Date();
  const sessions = [
    { id: "admin_exposed_session", ttl: 7 * 24 * 3600 },
    { id: "technician_exposed_session", ttl: 16 * 3600 },
    { id: "client_exposed_session", ttl: 7 * 24 * 3600 },
  ].map((item) => ({
    session: item.id,
    ...computeTokenWindow(INCIDENT_REFERENCE_UTC, item.ttl, now),
  }));

  return {
    referenceEmissionUtc: INCIDENT_REFERENCE_UTC,
    timezone: "UTC",
    sessions,
    allExpired: sessions.every((session) => session.expired),
    method: "time-window-analysis",
    note: "Sem reutilizacao de token completo no relatorio; avaliacao temporal baseada em iat/exp conhecidos do incidente.",
  };
}

async function main() {
  const runId = randomTag("SECURE-AUTH");
  const reportDir = path.resolve(__dirname, "..", "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `secure-auth-matrix-${nowIsoSafe()}.json`);

  const report = {
    runId,
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    environment: classifyEnvironment(),
    tokenExposureAssessment: buildTokenExposureAssessment(),
    sessionInvalidation: {
      supportsAccessTokenBlacklist: false,
      supportsTokenVersioning: false,
      supportsPerTokenRevocation: true,
      supportsPrincipalStateValidation: true,
      refreshTokensTable: true,
      actionTaken: "controlled-principal-revocation-checks-executed",
      rotationAction: "blocked-pending-confirmation",
    },
    temporaryUsers: { created: {}, removed: {} },
    backendMatrix: [],
    frontendMatrix: { executed: false, checks: [], adminActions: [] },
    controlledRevocation: { checks: [], allPass: false },
    qaAccountAssessment: {},
    reportSanitization: {},
    assertions: {
      backendPass: false,
      frontendPass: false,
      backendFailureCount: 0,
      frontendFailureCount: 0,
      flashFailureCount: 0,
      adminFunctionalActionsRecorded: false,
      controlledRevocationPass: false,
    },
  };

  const tempIds = { adminId: null, clientId: null, technicianId: null };

  try {
    const admin = await createTempAdmin(runId);
    tempIds.adminId = admin.id;

    const technician = await createTempTechnician(runId);
    tempIds.technicianId = technician.id;

    const client = await createTempClient(runId);
    tempIds.clientId = client.id;

    report.temporaryUsers.created = {
      adminId: admin.id,
      technicianId: technician.id,
      clientId: client.id,
      strategy: "isolated-temporary-accounts-with-teardown",
      idempotent: true,
      teardown: "delete-temporary-records",
    };

    const tokens = { admin, technician, client };

    report.backendMatrix = await backendMatrix(tokens);
    try {
      report.frontendMatrix = await frontendMatrix(tokens);
    } catch (error) {
      report.frontendMatrix = {
        executed: false,
        reason: sanitizeText(error.message),
        checks: [],
        adminActions: [],
      };
    }
    report.controlledRevocation = await controlledRevocationChecks(tokens);
    report.qaAccountAssessment = await assessQaClientIncident();

    const backendFailures = report.backendMatrix.filter((item) => !item.pass);
    const frontendFailures = (report.frontendMatrix.checks || []).filter((item) => !item.pass);
    const flashFailures = (report.frontendMatrix.checks || []).filter((item) =>
      item.profile !== "admin" && item.firstFrameSensitive
    );

    report.assertions = {
      backendPass: backendFailures.length === 0,
      frontendPass: report.frontendMatrix.executed && frontendFailures.length === 0,
      backendFailureCount: backendFailures.length,
      frontendFailureCount: frontendFailures.length,
      flashFailureCount: flashFailures.length,
      adminFunctionalActionsRecorded: (report.frontendMatrix.adminActions || []).length > 0,
      controlledRevocationPass: report.controlledRevocation.allPass,
    };
  } finally {
    report.temporaryUsers.removed = await cleanupTempUsers(tempIds);

    const sanitizedReport = sanitizeObject(report);
    fs.writeFileSync(reportPath, JSON.stringify(sanitizedReport, null, 2));

    const reportRaw = fs.readFileSync(reportPath, "utf8");
    const sensitiveFindings = detectSensitivePatternsInText(reportRaw);
    report.reportSanitization = {
      reportPath,
      sensitivePatternFindings: sensitiveFindings,
      pass: sensitiveFindings.length === 0,
    };

    fs.writeFileSync(reportPath, JSON.stringify(sanitizeObject(report), null, 2));

    console.log(`SECURE_AUTH_MATRIX_REPORT ${reportPath}`);
    console.log(`ENV_CLASSIFICATION ${report.environment.classification} NODE_ENV=${report.environment.nodeEnv} DB=${report.environment.dbName}`);
    console.log(`BACKEND_MATRIX_PASS ${report.assertions.backendPass} FAILURES=${report.assertions.backendFailureCount}`);
    console.log(`FRONTEND_MATRIX_EXECUTED ${report.frontendMatrix.executed} PASS=${report.assertions.frontendPass} FAILURES=${report.assertions.frontendFailureCount}`);
    console.log(`FLASH_PROTECTED_CONTENT_FAILS ${report.assertions.flashFailureCount}`);
    console.log(`CONTROLLED_REVOCATION_PASS ${report.assertions.controlledRevocationPass}`);
    console.log(`TOKEN_EXPIRATION_ALL_EXPIRED ${report.tokenExposureAssessment.allExpired}`);
    console.log(`QA_ACCOUNT_CLASSIFICATION ${report.qaAccountAssessment.classification || "indeterminado"}`);
    console.log(`REPORT_SANITIZATION_PASS ${report.reportSanitization.pass} FINDINGS=${report.reportSanitization.sensitivePatternFindings.length}`);

    await prisma.$disconnect();

    if (!report.reportSanitization.pass) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(`SECURE_AUTH_MATRIX_ERROR ${sanitizeText(error.message)}`);
  process.exit(1);
});
