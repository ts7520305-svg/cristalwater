const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { chromium, devices } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const COVERAGE_PATH = path.join(ROOT, "CRYSTAL_OS_V2_ROUTE_COVERAGE_TABLE.md");
const OUT_JSON = path.join(ROOT, "docs", "product", "FCS14_VISUAL_AUDIT_V2.json");
const OUT_MD = path.join(ROOT, "docs", "product", "FCS14_VISUAL_AUDIT_V2.md");

const DUPLICATE_REDIRECT_ROUTES = new Set([
  "/admin-core-flow",
  "/admin-operational-flow",
  "/admin-test-center",
]);

const METRIC_KEYS = [
  "spacing",
  "header",
  "cards",
  "buttons",
  "typography",
  "inputs",
  "tables",
  "modals",
  "emptyState",
  "loading",
  "responsiveness",
  "undefinedPlaceholders",
];

const VIEWPORT_PROFILES = [
  {
    id: "desktop",
    label: "Desktop 1440x920",
    contextOptions: {
      viewport: { width: 1440, height: 920 },
      colorScheme: "light",
    },
  },
  {
    id: "mobile390",
    label: "Mobile 390x844",
    contextOptions: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      colorScheme: "light",
    },
  },
  {
    id: "android",
    label: "Android Pixel 7",
    contextOptions: {
      ...devices["Pixel 7"],
      colorScheme: "light",
    },
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseCoverageTable(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const routes = [];

  for (const line of lines) {
    if (!line.startsWith("| /")) continue;
    const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cols.length < 6) continue;

    const route = cols[0];
    const allowedRolesRaw = cols[2];
    const reachable = cols[5];

    if (reachable.toUpperCase() !== "YES") continue;
    if (DUPLICATE_REDIRECT_ROUTES.has(route)) continue;
    const roles = allowedRolesRaw.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean);

    routes.push({ route, roles });
  }

  const dedup = new Map();
  for (const item of routes) {
    if (!dedup.has(item.route)) dedup.set(item.route, item);
  }

  return [...dedup.values()];
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function createAdmin(runId) {
  const email = `${runId.toLowerCase()}@qa-fcs14-admin.test`;
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      name: `QA FCS14 ADMIN ${runId}`,
    },
  });

  const login = await requestJson("/api/auth/login", {
    method: "POST",
    body: { email, password: plainPassword },
  });

  assert(login.ok && login.data?.token, "Falha no login admin temporario");

  return {
    role: "ADMIN",
    token: login.data.token,
    user: login.data.user || { id: user.id, role: "ADMIN", email },
    cleanup: { userId: user.id },
  };
}

async function createTechnician(runId) {
  const pin = String(Math.floor(1000 + Math.random() * 8999));
  const technician = await prisma.technician.create({
    data: {
      name: `QA FCS14 TECH ${runId}`,
      email: `${runId.toLowerCase()}@qa-fcs14-tech.test`,
      pin,
      role: "TECHNICIAN",
      active: true,
      zone: "QA",
    },
  });

  const login = await requestJson("/api/technician-auth/login", {
    method: "POST",
    body: { pin },
  });

  assert(login.ok && login.data?.token, "Falha no login technician temporario");

  return {
    role: "TECHNICIAN",
    token: login.data.token,
    user: login.data.user || { id: technician.id, role: "TECHNICIAN", name: technician.name },
    cleanup: { technicianId: technician.id },
  };
}

async function createClient(runId) {
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const client = await prisma.client.create({
    data: {
      name: `QA FCS14 CLIENT ${runId}`,
      email: `${runId.toLowerCase()}@qa-fcs14-client.test`,
      password,
      active: true,
      status: "ACTIVE",
      archiveStatus: "ATIVO",
      source: "QA_FCS14",
    },
  });

  const login = await requestJson("/api/client-auth/login", {
    method: "POST",
    body: { email: client.email, password: plainPassword },
  });

  assert(login.ok && login.data?.token, "Falha no login client temporario");

  return {
    role: "CLIENT",
    token: login.data.token,
    user: login.data.client || { id: client.id, role: "CLIENT", name: client.name, email: client.email },
    cleanup: { clientId: client.id },
  };
}

function pickRole(roles) {
  const normalized = roles.map((r) => r.toUpperCase());
  if (normalized.includes("ADMIN")) return "ADMIN";
  if (normalized.includes("TECHNICIAN")) return "TECHNICIAN";
  if (normalized.includes("CLIENT")) return "CLIENT";
  return "ADMIN";
}

function statusFromCheck(ok, details = null) {
  return { status: ok ? "PASS" : "FAIL", details };
}

async function evaluateVisualMetrics(page) {
  return page.evaluate(() => {
    const localStatus = (ok, details = null) => ({ status: ok ? "PASS" : "FAIL", details });

    const root = document.documentElement;
    const body = document.body;

    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const main = document.querySelector("main") || body;
    const mainStyle = window.getComputedStyle(main);
    const mainPadTop = parseFloat(mainStyle.paddingTop || "0");
    const mainPadX = parseFloat(mainStyle.paddingLeft || "0");

    const cards = Array.from(document.querySelectorAll(".card, [class*='card']")).filter((el) => visible(el));
    const buttons = Array.from(document.querySelectorAll("button, .btn, .cw-v2-btn")).filter((el) => visible(el));
    const headers = Array.from(document.querySelectorAll("h1, header h1, .page-head h1")).filter((el) => visible(el));
    const inputs = Array.from(document.querySelectorAll("input, select, textarea")).filter((el) => visible(el));
    const tables = Array.from(document.querySelectorAll("table")).filter((el) => visible(el));
    const modals = Array.from(document.querySelectorAll(".modal, [role='dialog'], .cw-modal, .repair-modal")).filter((el) => el instanceof Element);

    const bodyFont = parseFloat(window.getComputedStyle(body).fontSize || "16");
    const headingSizes = headers.map((h) => parseFloat(window.getComputedStyle(h).fontSize || "0")).filter((n) => Number.isFinite(n) && n > 0);

    const inputHeights = inputs.map((input) => input.getBoundingClientRect().height).filter((h) => h > 0);
    const minInputHeight = inputHeights.length ? Math.min(...inputHeights) : 0;

    const inputRadius = inputs.map((input) => parseFloat(window.getComputedStyle(input).borderRadius || "0")).filter((n) => Number.isFinite(n));
    const maxInputRadius = inputRadius.length ? Math.max(...inputRadius) : 0;

    const modalAccessible = modals.every((modal) => {
      const role = modal.getAttribute("role");
      if (role === "dialog") return true;
      return modal.getAttribute("aria-modal") === "true";
    });

    const rawText = body?.innerText || "";
    const text = rawText.toLowerCase();
    const emptyStatePresent = /sem dados|nenhum|ainda nao existem|empty/.test(text)
      || !!document.querySelector(".empty, .empty-box, .cw-empty, .cw-v2-state-empty, [data-cw-state='empty']");
    const loadingStatePresent = /a carregar|loading/.test(text)
      || !!document.querySelector(".loading, .cw-v2-state-loading, [aria-busy='true'], [data-cw-state='loading']");

    const suspiciousRegex = /\b(undefined|null|nan|todo|tbd|lorem ipsum|coming soon)\b/gi;
    const templateRegex = /(\{\{[^}]+\}\}|\$\{[^}]+\})/g;
    const suspiciousMatches = rawText.match(suspiciousRegex) || [];
    const templateMatches = rawText.match(templateRegex) || [];
    const undefinedPlaceholderCount = suspiciousMatches.length + templateMatches.length;
    const undefinedPlaceholderSamples = Array.from(new Set([...suspiciousMatches, ...templateMatches])).slice(0, 5);

    const hasHorizontalScroll = root.scrollWidth > root.clientWidth + 1;

    const spacingOk = mainPadTop >= 8 && mainPadX >= 8;
    const headerOk = headers.length > 0;
    const cardsOk = cards.length > 0;
    const buttonsOk = buttons.length > 0;
    const typographyOk = bodyFont >= 12 && bodyFont <= 20 && headingSizes.some((size) => size >= bodyFont + 4);
    const inputsOk = inputs.length === 0 || (minInputHeight >= 30 && maxInputRadius >= 4);
    const tablesOk = tables.length === 0 || !hasHorizontalScroll;
    const modalsOk = modals.length === 0 || modalAccessible;
    const emptyOk = emptyStatePresent;
    const loadingOk = loadingStatePresent;
    const responsivenessOk = !hasHorizontalScroll;
    const undefinedPlaceholdersOk = undefinedPlaceholderCount === 0;

    return {
      spacing: localStatus(spacingOk, { mainPadTop, mainPadX }),
      header: localStatus(headerOk, { headers: headers.length }),
      cards: localStatus(cardsOk, { cards: cards.length }),
      buttons: localStatus(buttonsOk, { buttons: buttons.length }),
      typography: localStatus(typographyOk, { bodyFont, headingSizes }),
      inputs: localStatus(inputsOk, { inputs: inputs.length, minInputHeight, maxInputRadius }),
      tables: localStatus(tablesOk, { tables: tables.length, hasHorizontalScroll }),
      modals: localStatus(modalsOk, { modals: modals.length, modalAccessible }),
      emptyState: localStatus(emptyOk, { emptyStatePresent }),
      loading: localStatus(loadingOk, { loadingStatePresent }),
      responsiveness: localStatus(responsivenessOk, { hasHorizontalScroll, scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }),
      undefinedPlaceholders: localStatus(undefinedPlaceholdersOk, { count: undefinedPlaceholderCount, samples: undefinedPlaceholderSamples }),
    };
  });
}

async function auditRoute(context, routeInfo, sessionByRole, profileId) {
  const role = pickRole(routeInfo.roles);
  const session = sessionByRole[role];
  const page = await context.newPage();

  await page.addInitScript((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    if (payload.token) {
      localStorage.setItem("token", payload.token);
      localStorage.setItem("cristalwater_jwt", payload.token);
    }
    if (payload.user) {
      localStorage.setItem("user", JSON.stringify(payload.user));
      localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
    }
  }, { token: session.token, user: session.user });

  const url = `${BASE_URL}${routeInfo.route}`;
  let navigationError = null;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (error) {
    navigationError = String(error?.message || error);
  }

  await page.waitForTimeout(500);

  let metrics = null;
  if (!navigationError) {
    metrics = await evaluateVisualMetrics(page);
  }

  await page.close();

  return {
    profile: profileId,
    route: routeInfo.route,
    role,
    navigationError,
    metrics,
  };
}

function aggregate(results) {
  const summary = {};
  for (const key of METRIC_KEYS) {
    summary[key] = { pass: 0, fail: 0, notEvaluated: 0 };
  }

  for (const result of results) {
    if (result.navigationError || !result.metrics) {
      for (const key of METRIC_KEYS) summary[key].notEvaluated += 1;
      continue;
    }

    for (const key of METRIC_KEYS) {
      const status = result.metrics[key]?.status;
      if (status === "PASS") summary[key].pass += 1;
      else if (status === "FAIL") summary[key].fail += 1;
      else summary[key].notEvaluated += 1;
    }
  }

  return summary;
}

function aggregateByProfile(results) {
  const grouped = {};
  for (const profile of VIEWPORT_PROFILES) {
    grouped[profile.id] = aggregate(results.filter((r) => r.profile === profile.id));
  }
  return grouped;
}

function countUndefinedPlaceholderHits(results) {
  let total = 0;
  for (const row of results) {
    const value = row.metrics?.undefinedPlaceholders?.details?.count;
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# FCS-1.4 - Auditoria Visual Automatica V2");
  lines.push("");
  lines.push(`Data: ${report.generatedAt}`);
  lines.push(`Escopo: ${report.totalRoutes} rotas V2 x ${report.viewportProfiles.length} perfis = ${report.totalEvaluations} avaliacoes`);
  lines.push(`Perfis: ${report.viewportProfiles.map((p) => p.label).join(", ")}`);
  lines.push(`Navegacao com erro: ${report.navigationErrors.length}`);
  lines.push(`Undefined/placeholders visiveis: ${report.undefinedPlaceholderVisibleCount}`);
  lines.push("");
  lines.push("## Consolidado (todos os perfis)");
  lines.push("| Item | PASS | FAIL | N/A |\n|---|---:|---:|---:|");

  const labelMap = {
    spacing: "Espacamento",
    header: "Header",
    cards: "Cards",
    buttons: "Botoes",
    typography: "Tipografia",
    inputs: "Inputs",
    tables: "Tabelas",
    modals: "Modais",
    emptyState: "Empty State",
    loading: "Loading",
    responsiveness: "Responsividade",
    undefinedPlaceholders: "Undefined/Placeholders",
  };

  for (const key of METRIC_KEYS) {
    const row = report.summaryGlobal[key];
    lines.push(`| ${labelMap[key]} | ${row.pass} | ${row.fail} | ${row.notEvaluated} |`);
  }

  for (const profile of report.viewportProfiles) {
    lines.push("");
    lines.push(`## ${profile.label}`);
    lines.push("| Item | PASS | FAIL | N/A |\n|---|---:|---:|---:|");
    for (const key of METRIC_KEYS) {
      const row = report.summaryByProfile[profile.id][key];
      lines.push(`| ${labelMap[key]} | ${row.pass} | ${row.fail} | ${row.notEvaluated} |`);
    }
  }

  if (report.navigationErrors.length) {
    lines.push("");
    lines.push("## Rotas com erro de navegacao");
    for (const item of report.navigationErrors) {
      lines.push(`- ${item.route} (${item.role}): ${item.navigationError}`);
    }
  }

  return lines.join("\n");
}

async function cleanup(created) {
  await Promise.all([
    created.adminUserId ? prisma.user.updateMany({ where: { id: created.adminUserId }, data: { active: false } }).catch(() => null) : null,
    created.technicianId ? prisma.technician.updateMany({ where: { id: created.technicianId }, data: { active: false, archiveStatus: "ARQUIVADO" } }).catch(() => null) : null,
    created.clientId ? prisma.client.updateMany({ where: { id: created.clientId }, data: { active: false, status: "ARCHIVED", archiveStatus: "ARQUIVADO" } }).catch(() => null) : null,
  ]);
}

async function main() {
  const runId = `FCS14_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const created = {};

  try {
    const routes = parseCoverageTable(COVERAGE_PATH);
    assert(routes.length > 0, "Sem rotas para auditar");

    const admin = await createAdmin(runId);
    created.adminUserId = admin.cleanup.userId;

    const technician = await createTechnician(runId);
    created.technicianId = technician.cleanup.technicianId;

    const client = await createClient(runId);
    created.clientId = client.cleanup.clientId;

    const sessionByRole = {
      ADMIN: admin,
      TECHNICIAN: technician,
      CLIENT: client,
    };

    const browser = await chromium.launch({ headless: true });
    const results = [];
    for (const profile of VIEWPORT_PROFILES) {
      const context = await browser.newContext(profile.contextOptions);
      for (const routeInfo of routes) {
        const row = await auditRoute(context, routeInfo, sessionByRole, profile.id);
        results.push(row);
      }
      await context.close();
    }
    await browser.close();

    const navigationErrors = results.filter((r) => r.navigationError);
    const summaryGlobal = aggregate(results);
    const summaryByProfile = aggregateByProfile(results);
    const undefinedPlaceholderVisibleCount = countUndefinedPlaceholderHits(results);

    const report = {
      generatedAt: new Date().toISOString(),
      runId,
      baseUrl: BASE_URL,
      viewportProfiles: VIEWPORT_PROFILES.map((profile) => ({ id: profile.id, label: profile.label })),
      totalRoutes: routes.length,
      totalEvaluations: routes.length * VIEWPORT_PROFILES.length,
      navigationErrors,
      summaryGlobal,
      summaryByProfile,
      undefinedPlaceholderVisibleCount,
      results,
    };

    ensureDir(OUT_JSON);
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUT_MD, buildMarkdown(report));

    console.log(JSON.stringify({
      ok: true,
      runId,
      totalRoutes: routes.length,
      profiles: VIEWPORT_PROFILES.map((p) => p.id),
      totalEvaluations: routes.length * VIEWPORT_PROFILES.length,
      navigationErrors: navigationErrors.length,
      undefinedPlaceholderVisibleCount,
      summaryGlobal,
      summaryByProfile,
      outJson: path.relative(ROOT, OUT_JSON),
      outMd: path.relative(ROOT, OUT_MD),
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, runId, error: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await cleanup(created);
    await prisma.$disconnect().catch(() => null);
  }
}

main();
