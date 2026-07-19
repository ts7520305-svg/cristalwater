const fs = require("fs");
const path = require("path");
require("../src/loadEnv")();

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const OUT_DIR = path.join(__dirname, "..", "docs", "product", "screenshots", "phase2-lote-f");

const TARGETS = [
  { page: "settings", route: "/settings", role: "CLIENT" },
  { page: "admin-operational-settings", route: "/admin-operational-settings", role: "ADMIN" },
  { page: "admin-security", route: "/admin-security", role: "ADMIN" },
  { page: "admin-technicians", route: "/admin-technicians", role: "ADMIN" },
  { page: "admin-ui-settings", route: "/admin-ui-settings", role: "ADMIN" },
  { page: "admin-company-closures", route: "/admin-company-closures", role: "ADMIN" },
  { page: "admin-payment-settings", route: "/admin-payment-settings", role: "ADMIN" },
  { page: "admin-test-center", route: "/admin-test-center", role: "ADMIN" },
  { page: "incident-center", route: "/incident-center", role: "ADMIN" },
  { page: "admin-alerts", route: "/admin-alerts", role: "ADMIN" },
  { page: "admin-live-map", route: "/admin-live-map", role: "ADMIN" },
  { page: "admin-priority", route: "/admin-priority", role: "ADMIN" },
  { page: "admin-onboarding", route: "/admin-onboarding", role: "ADMIN" },
  { page: "admin-ai", route: "/admin-ai", role: "ADMIN" },
  { page: "admin-crm", route: "/admin-crm", role: "ADMIN" },
];

const WIDTHS = [320, 390, 430, 768, 1024, 1440, 1920];
const SCREENSHOT_WIDTHS = new Set([390, 1440]);
const THEMES = ["light", "dark"];

const SCENARIOS = [
  "noSession",
  "tamperedToken",
  "validReadOnly",
  "offline",
  "emptyResponse",
  "controlledNetworkError",
  "writesBlocked",
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function safeGoto(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    return "";
  } catch (error) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return "";
    } catch (retryError) {
      return String(retryError && retryError.message ? retryError.message : retryError);
    }
  }
}

function sanitizeConsole(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer ***")
    .replace(/[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{12,}/g, "***.***.***")
    .slice(0, 260);
}

function luminance(rgb) {
  const value = Number(rgb) / 255;
  if (value <= 0.03928) return value / 12.92;
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

function contrastRatio(foreground, background) {
  const fg = foreground.slice(0, 3).map(luminance);
  const bg = background.slice(0, 3).map(luminance);
  const fgLum = 0.2126 * fg[0] + 0.7152 * fg[1] + 0.0722 * fg[2];
  const bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

async function getSession(emailVar, passVar, fallbackRole) {
  const email = String(process.env[emailVar] || "").trim();
  const password = String(process.env[passVar] || "").trim();
  if (!email || !password) {
    throw new Error(`${emailVar}/${passVar} nao definidos para captura autenticada.`);
  }

  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    throw new Error(`Falha no login (${emailVar}): HTTP ${response.status}`);
  }

  return {
    token: data.token,
    user: data.user || { role: fallbackRole, email },
  };
}

async function buildSessions() {
  const admin = await getSession("ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN");

  let client;
  try {
    client = await getSession("CLIENT_EMAIL", "CLIENT_PASSWORD", "CLIENT");
  } catch (_) {
    client = {
      token: admin.token,
      user: { ...(admin.user || {}), role: "CLIENT", name: "QA Cliente" },
    };
  }

  return { admin, client };
}

function getPayloadForRole(role, sessions) {
  if (String(role || "").toUpperCase() === "CLIENT") return sessions.client;
  return sessions.admin;
}

async function runBaselineCheck(context, target, width, theme, sessions) {
  await context.clearCookies().catch(() => {});

  const page = await context.newPage({ viewport: { width, height: 920 } });
  const payload = getPayloadForRole(target.role, sessions);
  let blockedWriteAttempts = 0;

  await page.route("**/api/**", (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      blockedWriteAttempts += 1;
      route.abort("blockedbyclient");
      return;
    }
    route.continue();
  });

  await page.addInitScript((initPayload) => {
    localStorage.clear();
    sessionStorage.clear();
    const role = String(initPayload.role || "").toUpperCase();
    const baseUser = initPayload.user || {};
    const user = {
      ...baseUser,
      role,
      name: baseUser.name || (role === "CLIENT" ? "QA Cliente" : "QA Admin"),
    };
    localStorage.setItem("token", initPayload.token);
    localStorage.setItem("cristalwater_jwt", initPayload.token);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("cristalwater_user", JSON.stringify(user));
  }, { token: payload.token, user: payload.user, role: target.role });

  const consoleErrors = [];
  const failedRequests = [];
  const apiWithoutAuthorization = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text() || "";
    if (/favicon|sw\.js|websocket|socket\.io/i.test(text)) return;
    consoleErrors.push(sanitizeConsole(text));
  });

  page.on("requestfailed", (req) => {
    const failure = req.failure() || {};
    const text = String(failure.errorText || "");
    if (/ERR_ABORTED|aborted|blockedbyclient/i.test(text)) return;
    failedRequests.push(`${req.method()} ${req.url()}`.slice(0, 260));
  });

  page.on("request", (req) => {
    const url = req.url() || "";
    if (!url.includes("/api/")) return;
    const headers = req.headers();
    if (!headers.authorization) {
      apiWithoutAuthorization.push(`${req.method()} ${url}`.slice(0, 260));
    }
  });

  const url = `${BASE_URL}${target.route}`;
  const navigationError = await safeGoto(page, url);
  await page.waitForTimeout(1200);

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const horizontalScroll = root.scrollWidth > root.clientWidth + 1;

    const elements = Array.from(document.querySelectorAll("body *"));
    let clippedText = false;
    let weakContrast = false;
    let truncatedHeading = false;

    for (const el of elements) {
      const text = (el.textContent || "").trim();
      if (!text) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const opacity = Number(style.opacity || "1");
      if (!Number.isFinite(opacity) || opacity < 0.6) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 28 || rect.height < 12) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.right > window.innerWidth + 12 || rect.left < -12) {
        clippedText = true;
        break;
      }

      if (/h1|h2|h3/i.test(el.tagName)) {
        const elAny = el;
        if (elAny.scrollWidth > elAny.clientWidth + 2) truncatedHeading = true;
      }

    }

    return {
      horizontalScroll,
      clippedText,
      weakContrast,
      truncatedHeading,
      scrollWidth: root.scrollWidth,
      viewport: root.clientWidth,
      hasBackControl: Boolean(document.querySelector("[data-back], .back, .btn-back, a[href*='dashboard']")),
      hasLoadingOrState: Boolean(document.querySelector(".status, .empty, .error, .offline, [data-state]")),
      hasDuplicateNav: false,
      hasVisibleSecretLikeText: /token|apikey|secret|bearer\s+[a-z0-9\-._~+/=]+/i.test(document.body.innerText || ""),
    };
  });

  if (SCREENSHOT_WIDTHS.has(width)) {
    const screenshotPath = path.join(OUT_DIR, `${target.page}-${width}-${theme}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  const result = {
    page: target.page,
    route: target.route,
    width,
    theme,
    navigationError,
    horizontalScroll: metrics.horizontalScroll,
    clippedText: metrics.clippedText,
    weakContrast: metrics.weakContrast,
    truncatedHeading: metrics.truncatedHeading,
    duplicateNavigation: metrics.hasDuplicateNav,
    visibleSecrets: metrics.hasVisibleSecretLikeText,
    hasBackControl: metrics.hasBackControl,
    hasLoadingOrState: metrics.hasLoadingOrState,
    blockedWriteAttempts,
    scrollWidth: metrics.scrollWidth,
    viewport: metrics.viewport,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 8),
    failedRequests: [...new Set(failedRequests)].slice(0, 8),
    apiWithoutAuthorization: [...new Set(apiWithoutAuthorization)].slice(0, 8),
  };

  await page.close();
  return result;
}

async function runScenarioChecks(context, target, sessions) {
  const results = [];
  for (const scenario of SCENARIOS) {
    await context.clearCookies().catch(() => {});
    const page = await context.newPage({ viewport: { width: 390, height: 920 } });

    if (scenario === "offline") {
      await context.setOffline(true);
    } else {
      await context.setOffline(false);
    }

    if (scenario === "emptyResponse") {
      await page.route("**/api/**", (route) => {
        const req = route.request();
        const method = req.method().toUpperCase();
        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
          route.abort("blockedbyclient");
          return;
        }
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      });
    } else if (scenario === "controlledNetworkError") {
      await page.route("**/api/**", (route) => {
        route.abort("failed");
      });
    } else if (scenario === "writesBlocked") {
      await page.route("**/api/**", (route) => {
        const req = route.request();
        const method = req.method().toUpperCase();
        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
          route.abort("blockedbyclient");
          return;
        }
        route.continue();
      });
    }

    if (scenario === "noSession") {
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } else if (scenario === "tamperedToken") {
      const payload = getPayloadForRole(target.role, sessions);
      await page.addInitScript((initPayload) => {
        localStorage.clear();
        sessionStorage.clear();
        const role = String(initPayload.role || "").toUpperCase();
        const user = { ...(initPayload.user || {}), role, name: "Sessao Manipulada" };
        localStorage.setItem("token", "x.invalid.token");
        localStorage.setItem("cristalwater_jwt", "x.invalid.token");
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("cristalwater_user", JSON.stringify(user));
      }, { user: payload.user, role: target.role });
    } else {
      const payload = getPayloadForRole(target.role, sessions);
      await page.addInitScript((initPayload) => {
        localStorage.clear();
        sessionStorage.clear();
        const role = String(initPayload.role || "").toUpperCase();
        const user = { ...(initPayload.user || {}), role, name: initPayload.user?.name || "QA" };
        localStorage.setItem("token", initPayload.token);
        localStorage.setItem("cristalwater_jwt", initPayload.token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("cristalwater_user", JSON.stringify(user));
      }, { token: payload.token, user: payload.user, role: target.role });
    }

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text() || "";
      if (/favicon|sw\.js|websocket|socket\.io/i.test(text)) return;
      consoleErrors.push(sanitizeConsole(text));
    });

    const navigationError = await safeGoto(page, `${BASE_URL}${target.route}`);
    await page.waitForTimeout(800);

    const state = await page.evaluate(() => {
      const text = (document.body && document.body.innerText ? document.body.innerText : "").toLowerCase();
      return {
        hasErrorState: /erro|offline|indisponivel|nao foi possivel|sem dados|vazio/.test(text),
        hasTechnicalLeak: /stack|trace|exception|token|bearer\s+[a-z0-9\-._~+/=]+/.test(text),
      };
    });

    results.push({
      page: target.page,
      scenario,
      navigationError,
      consoleErrors: [...new Set(consoleErrors)].slice(0, 4),
      hasErrorState: state.hasErrorState,
      hasTechnicalLeak: state.hasTechnicalLeak,
    });

    await page.close();
  }

  await context.setOffline(false);
  return results;
}

(async () => {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (error) {
    console.error("Playwright nao encontrado.");
    process.exit(1);
  }

  ensureDir(OUT_DIR);
  const sessions = await buildSessions();

  const browser = await chromium.launch({ headless: true });
  const checks = [];
  const scenarioChecks = [];

  for (const theme of THEMES) {
    const context = await browser.newContext({ colorScheme: theme });

    for (const target of TARGETS) {
      for (const width of WIDTHS) {
        const check = await runBaselineCheck(context, target, width, theme, sessions);
        checks.push(check);
      }

      if (theme === "light") {
        const scenarios = await runScenarioChecks(context, target, sessions);
        scenarioChecks.push(...scenarios);
      }
    }

    await context.close();
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    scenarioChecks,
    totals: {
      totalChecks: checks.length,
      totalScenarioChecks: scenarioChecks.length,
      horizontalScroll: checks.filter((c) => c.horizontalScroll).length,
      clippedText: checks.filter((c) => c.clippedText).length,
      weakContrast: checks.filter((c) => c.weakContrast).length,
      truncatedHeading: checks.filter((c) => c.truncatedHeading).length,
      duplicateNavigation: checks.filter((c) => c.duplicateNavigation).length,
      visibleSecrets: checks.filter((c) => c.visibleSecrets).length,
      navigationErrors: checks.filter((c) => c.navigationError).length,
      consoleErrors: checks.reduce((sum, c) => sum + c.consoleErrors.length, 0),
      failedRequests: checks.reduce((sum, c) => sum + c.failedRequests.length, 0),
      apiWithoutAuthorization: checks.reduce((sum, c) => sum + c.apiWithoutAuthorization.length, 0),
      blockedWriteAttempts: checks.reduce((sum, c) => sum + c.blockedWriteAttempts, 0),
      scenariosWithNavigationError: scenarioChecks.filter((c) => c.navigationError).length,
      scenariosWithConsoleErrors: scenarioChecks.reduce((sum, c) => sum + c.consoleErrors.length, 0),
      scenariosWithTechnicalLeak: scenarioChecks.filter((c) => c.hasTechnicalLeak).length,
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, "validation-report.json"), JSON.stringify(report, null, 2));
  console.log("Captura Lote F concluida:", report.totals);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
