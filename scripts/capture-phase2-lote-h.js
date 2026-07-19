const fs = require("fs");
const path = require("path");

require("../src/loadEnv")();

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const OUT_DIR = path.join(ROOT, "docs", "product", "screenshots", "phase2-lote-h");

const TARGET_PAGES = [
  "admin-ai.html",
  "admin-company-closures.html",
  "admin-crm.html",
  "admin-onboarding.html",
  "admin-operational-settings.html",
  "admin-payment-settings.html",
  "admin-security.html",
  "admin-technicians.html",
  "admin-ui-settings.html",
  "alerts.html",
  "billing-history.html",
  "client-wow.html",
  "technician-profit-dashboard.html",
  "technician-profit.html",
  "to-issue.html",
];

const TARGET_ROLES = {
  "client-wow.html": "CLIENT",
  "alerts.html": "ADMIN",
  "technician-profit-dashboard.html": "TECHNICIAN",
  "technician-profit.html": "TECHNICIAN",
};

const WIDTHS = [320, 390, 430, 768, 1024, 1440, 1920];
const THEMES = ["light", "dark"];
const SCENARIOS = ["noSession", "tamperedToken", "validReadOnly"];
const SCREENSHOT_WIDTHS = new Set([390, 1440]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function routeForPage(page) {
  const name = page.replace(/\.html$/i, "");
  if (name === "client") return "/client";
  if (name === "settings") return "/settings";
  return `/${name}`;
}

function fileLabel(page) {
  return page.replace(/\.html$/i, "");
}

function normalizeRole(role) {
  const raw = String(role || "").toUpperCase();
  if (raw.includes("CLIENT")) return "CLIENT";
  if (raw.includes("TECH")) return "TECHNICIAN";
  if (raw.includes("ADMIN")) return "ADMIN";
  return "ADMIN";
}

function roleScript(role) {
  if (role === "CLIENT") return "/client-auth-guard.js";
  if (role === "TECHNICIAN") return "/technician-auth-guard.js";
  return "/admin-auth-guard.js";
}

function parseSourceCompliance(page, role) {
  const html = fs.readFileSync(path.join(FRONTEND_DIR, page), "utf8");
  const foundationCss = /href\s*=\s*['\"][^'\"]*\/ui\/foundation\.css(?:\?[^'\"]*)?['\"]/i.test(html);
  const backNavigationPresent = /data-cw-back\b/i.test(html) || /data-cw-action\s*=\s*['\"]back['\"]/i.test(html);
  const contextPreservationPresent = /src\s*=\s*['\"][^'\"]*\/ui\/core\/navigation-context\.js(?:\?[^'\"]*)?['\"]/i.test(html);
  const guardCorrect = html.includes(roleScript(role));

  return {
    foundationCss,
    backNavigationPresent,
    contextPreservationPresent,
    guardCorrect,
  };
}

function buildHtmlComplianceTable(targetPages) {
  return targetPages.map((target) => ({
    page: target.page,
    foundationCss: Boolean(target.source.foundationCss),
    guardCorrect: Boolean(target.source.guardCorrect),
    backNavigationPresent: Boolean(target.source.backNavigationPresent),
    contextPreservationPresent: Boolean(target.source.contextPreservationPresent),
  }));
}

function sanitizeConsole(text) {
  return String(text || "")
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer ***")
    .replace(/[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{12,}/g, "***.***.***")
    .slice(0, 280);
}

async function safeGoto(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 });
    return "";
  } catch (error) {
    return String(error && error.message ? error.message : error);
  }
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
  return String(role || "").toUpperCase() === "CLIENT" ? sessions.client : sessions.admin;
}

function collectMetricsFromPage(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const elements = Array.from(document.querySelectorAll("body *"));
    let clippedText = false;
    let truncatedHeading = false;

    for (const el of elements) {
      const text = (el.textContent || "").trim();
      if (!text) continue;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const opacity = Number(style.opacity || "1");
      if (!Number.isFinite(opacity) || opacity < 0.6) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 12) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.right > window.innerWidth + 12 || rect.left < -12) {
        clippedText = true;
        break;
      }
      if (/^H[1-3]$/.test(el.tagName) && el.scrollWidth > el.clientWidth + 2) {
        truncatedHeading = true;
      }
    }

    const backCount = document.querySelectorAll("[data-cw-back]").length;
    const navContext = Boolean(document.querySelector("script[src*='/ui/core/navigation-context.js']"));
    const foundation = Boolean(document.querySelector("link[href*='/ui/foundation.css']"));
    const guardRole = body && (body.getAttribute("data-required-role") || body.getAttribute("data-cw-role") || "").toUpperCase();

    return {
      horizontalScroll: root.scrollWidth > root.clientWidth + 1,
      clippedText,
      truncatedHeading,
      duplicateNavigation: backCount > 1,
      hasBackControl: backCount > 0,
      hasNavigationContext: navContext,
      hasFoundation: foundation,
      guardRole,
      visibleSecrets: /token|apikey|secret|bearer\s+[a-z0-9\-._~+/=]+/i.test(body ? body.innerText || "" : ""),
      textSample: (body ? body.innerText || "" : "").slice(0, 300),
      scrollWidth: root.scrollWidth,
      viewport: root.clientWidth,
    };
  });
}

async function runCheck(context, target, width, theme, scenario, sessions) {
  await context.clearCookies().catch(() => {});

  const page = await context.newPage({ viewport: { width, height: 920 } });
  const payload = getPayloadForRole(target.role, sessions);
  const route = routeForPage(target.page);
  const label = fileLabel(target.page);
  const scenarioName = scenario;

  await page.route("**/api/**", (routeRequest) => {
    const req = routeRequest.request();
    const method = req.method().toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      routeRequest.abort("blockedbyclient");
      return;
    }
    routeRequest.continue();
  });

  if (scenarioName === "noSession") {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } else if (scenarioName === "tamperedToken") {
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
    await page.addInitScript((initPayload) => {
      localStorage.clear();
      sessionStorage.clear();
      const role = String(initPayload.role || "").toUpperCase();
      const user = { ...(initPayload.user || {}), role, name: initPayload.user?.name || (role === "CLIENT" ? "QA Cliente" : "QA Admin") };
      localStorage.setItem("token", initPayload.token);
      localStorage.setItem("cristalwater_jwt", initPayload.token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("cristalwater_user", JSON.stringify(user));
    }, { token: payload.token, user: payload.user, role: target.role });
  }

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
    failedRequests.push(`${req.method()} ${req.url()}`.slice(0, 280));
  });

  page.on("request", (req) => {
    const url = req.url() || "";
    if (!url.includes("/api/")) return;
    const headers = req.headers();
    if (!headers.authorization) {
      apiWithoutAuthorization.push(`${req.method()} ${url}`.slice(0, 280));
    }
  });

  const navigationError = await safeGoto(page, `${BASE_URL}${route}`);
  await page.waitForTimeout(500);

  const finalUrl = page.url();
  let finalPath = "";
  try {
    finalPath = new URL(finalUrl).pathname || "";
  } catch (_error) {
    finalPath = "";
  }

  const metrics = await collectMetricsFromPage(page);
  const screenshotEligible = SCREENSHOT_WIDTHS.has(width) && scenarioName === "validReadOnly";
  if (screenshotEligible) {
    const screenshotPath = path.join(OUT_DIR, `${label}-${width}-${theme}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  const result = {
    page: target.page,
    route,
    role: target.role,
    width,
    theme,
    scenario: scenarioName,
    navigationError,
    finalUrl,
    finalPath,
    redirectedFromTarget: Boolean(finalPath) && finalPath !== route,
    redirectedToLogin: /login|auth/i.test(finalPath),
    foundationCss: target.source.foundationCss,
    guardCorrect: target.source.guardCorrect,
    backNavigationPresent: target.source.backNavigationPresent,
    contextPreservationPresent: target.source.contextPreservationPresent,
    foundationCssPresent: target.source.foundationCss,
    hasBackControl: target.source.backNavigationPresent,
    hasNavigationContext: target.source.contextPreservationPresent,
    runtimeFoundationCssPresent: metrics.hasFoundation,
    runtimeBackNavigationPresent: metrics.hasBackControl,
    runtimeContextPreservationPresent: metrics.hasNavigationContext,
    runtimeBodyRole: metrics.guardRole,
    horizontalScroll: metrics.horizontalScroll,
    clippedText: metrics.clippedText,
    truncatedHeading: metrics.truncatedHeading,
    duplicateNavigation: metrics.duplicateNavigation,
    visibleSecrets: metrics.visibleSecrets,
    scrollWidth: metrics.scrollWidth,
    viewport: metrics.viewport,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 8),
    failedRequests: [...new Set(failedRequests)].slice(0, 8),
    apiWithoutAuthorization: [...new Set(apiWithoutAuthorization)].slice(0, 8),
  };

  await page.close();
  return result;
}

function buildFailedCheck(target, width, theme, scenario, error) {
  const route = routeForPage(target.page);
  return {
    page: target.page,
    route,
    role: target.role,
    width,
    theme,
    scenario,
    navigationError: String(error && error.message ? error.message : error),
    finalUrl: "",
    finalPath: "",
    redirectedFromTarget: false,
    redirectedToLogin: false,
    foundationCss: target.source.foundationCss,
    guardCorrect: target.source.guardCorrect,
    backNavigationPresent: target.source.backNavigationPresent,
    contextPreservationPresent: target.source.contextPreservationPresent,
    foundationCssPresent: target.source.foundationCss,
    hasBackControl: target.source.backNavigationPresent,
    hasNavigationContext: target.source.contextPreservationPresent,
    runtimeFoundationCssPresent: false,
    runtimeBackNavigationPresent: false,
    runtimeContextPreservationPresent: false,
    runtimeBodyRole: "",
    horizontalScroll: false,
    clippedText: false,
    truncatedHeading: false,
    duplicateNavigation: false,
    visibleSecrets: false,
    scrollWidth: 0,
    viewport: width,
    consoleErrors: [],
    failedRequests: [],
    apiWithoutAuthorization: [],
  };
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

  const audit = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "product", "phase2-global-audit-93-pages.json"), "utf8"));
  const targetPages = TARGET_PAGES.map((page) => {
    const entry = audit.pages.find((item) => item.page === page);
    if (!entry) {
      throw new Error(`Pagina nao encontrada no audit global: ${page}`);
    }
    const role = normalizeRole(TARGET_ROLES[page] || entry.profile || "ADMIN");
    return {
      page,
      role,
      source: parseSourceCompliance(page, role),
    };
  });

  const sessions = await buildSessions();
  const browser = await chromium.launch({ headless: true });
  const checks = [];
  const htmlComplianceTable = buildHtmlComplianceTable(targetPages);

  for (const theme of THEMES) {
    let context = await browser.newContext({ colorScheme: theme });
    for (const target of targetPages) {
      for (const scenario of SCENARIOS) {
        for (const width of WIDTHS) {
          console.log(`[lote-h] ${theme} ${scenario} ${width}px ${target.page}`);
          let check;
          try {
            check = await runCheck(context, target, width, theme, scenario, sessions);
          } catch (error) {
            const message = String(error && error.message ? error.message : error);
            const isClosed = /target page, context or browser has been closed|has been closed|browser has disconnected/i.test(message);
            console.warn(`[lote-h] retry ${theme} ${scenario} ${width}px ${target.page}: ${message}`);

            if (isClosed) {
              await context.close().catch(() => {});
              context = await browser.newContext({ colorScheme: theme });
            }

            try {
              check = await runCheck(context, target, width, theme, scenario, sessions);
            } catch (retryError) {
              check = buildFailedCheck(target, width, theme, scenario, retryError);
            }
          }
          checks.push(check);
        }
      }
    }
    await context.close();
  }

  await browser.close();

  const validChecks = checks.filter((check) => check.scenario === "validReadOnly");
  const uniquePageCount = (items, predicate) => new Set(items.filter(predicate).map((check) => check.page)).size;

  const negativeByScenario = SCENARIOS.filter((scenario) => scenario !== "validReadOnly").map((scenario) => {
    const items = checks.filter((check) => check.scenario === scenario);
    return {
      scenario,
      totalChecks: items.length,
      redirects: items.filter((check) => check.redirectedFromTarget).length,
      redirectsToLogin: items.filter((check) => check.redirectedToLogin).length,
      navigationErrors: items.filter((check) => Boolean(check.navigationError)).length,
      pagesRedirected: [...new Set(items.filter((check) => check.redirectedFromTarget).map((check) => check.page))],
    };
  });

  const visualChecks = validChecks;

  const totals = {
    totalPages: TARGET_PAGES.length,
    totalChecks: checks.length,
    totalScreenshots: TARGET_PAGES.length * SCREENSHOT_WIDTHS.size * THEMES.length,
    visualChecks: visualChecks.length,
    foundationMissing: uniquePageCount(visualChecks, (c) => !c.foundationCss),
    guardMismatch: uniquePageCount(visualChecks, (c) => !c.guardCorrect),
    backMissing: uniquePageCount(visualChecks, (c) => !c.backNavigationPresent),
    contextMissing: uniquePageCount(visualChecks, (c) => !c.contextPreservationPresent),
    horizontalScroll: uniquePageCount(visualChecks, (c) => c.horizontalScroll),
    clippedText: uniquePageCount(visualChecks, (c) => c.clippedText),
    truncatedHeading: uniquePageCount(visualChecks, (c) => c.truncatedHeading),
    duplicateNavigation: uniquePageCount(visualChecks, (c) => c.duplicateNavigation),
    visibleSecrets: uniquePageCount(visualChecks, (c) => c.visibleSecrets),
    navigationErrors: uniquePageCount(visualChecks, (c) => Boolean(c.navigationError)),
    consoleErrors: visualChecks.reduce((sum, c) => sum + c.consoleErrors.length, 0),
    failedRequests: visualChecks.reduce((sum, c) => sum + c.failedRequests.length, 0),
    apiWithoutAuthorization: visualChecks.reduce((sum, c) => sum + c.apiWithoutAuthorization.length, 0),
    negativeScenarios: negativeByScenario,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    pages: TARGET_PAGES,
    htmlComplianceTable,
    checks,
    totals,
  };

  fs.writeFileSync(path.join(OUT_DIR, "validation-report.json"), JSON.stringify(report, null, 2));
  console.log("Captura Lote H concluida:", totals);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});