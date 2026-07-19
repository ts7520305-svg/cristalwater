const fs = require("fs");
const path = require("path");
require("../src/loadEnv")();

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const OUT_DIR = path.join(__dirname, "..", "docs", "product", "screenshots", "phase2-lote-e");

const TARGETS = [
  { page: "technician", route: "/technician", role: "TECHNICIAN" },
  { page: "technician-route", route: "/technician-route", role: "TECHNICIAN" },
  { page: "technician-field-mode", route: "/technician-field-mode", role: "TECHNICIAN" },
  { page: "technician-visit", route: "/technician-visit", role: "TECHNICIAN" },
  { page: "technician-gps", route: "/technician-gps", role: "TECHNICIAN" },
  { page: "technician-map", route: "/technician-map", role: "TECHNICIAN" },
  { page: "technician-guide", route: "/technician-guide", role: "TECHNICIAN" },
  { page: "technician-history", route: "/technician-history", role: "TECHNICIAN" },
  { page: "technician-profile", route: "/technician-profile", role: "TECHNICIAN" },
  { page: "technician-chat", route: "/technician-chat", role: "TECHNICIAN" },
  { page: "admin-keys", route: "/admin-keys", role: "ADMIN" },
  { page: "admin-vehicles", route: "/admin-vehicles", role: "ADMIN" },
];

const WIDTHS = [390, 1440];
const THEMES = ["light", "dark"];

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

async function getAdminSession() {
  const email = String(process.env.ADMIN_EMAIL || "").trim();
  const password = String(process.env.ADMIN_PASSWORD || "").trim();
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD nao definidos para captura autenticada.");
  }

  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    throw new Error(`Falha no login admin para capturas: HTTP ${response.status}`);
  }

  return {
    token: data.token,
    user: data.user || { role: "ADMIN", email },
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
  const session = await getAdminSession();

  const browser = await chromium.launch({ headless: true });
  const checks = [];

  for (const theme of THEMES) {
    const context = await browser.newContext({ colorScheme: theme });

    for (const target of TARGETS) {
      for (const width of WIDTHS) {
        await context.clearCookies().catch(() => {});

        const page = await context.newPage({ viewport: { width, height: 920 } });

        await page.addInitScript((payload) => {
          localStorage.clear();
          sessionStorage.clear();
          const user = { ...(payload.user || {}), role: payload.role, name: payload.role === "TECHNICIAN" ? "QA Tech" : (payload.user?.name || "QA Admin") };
          localStorage.setItem("token", payload.token);
          localStorage.setItem("cristalwater_jwt", payload.token);
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("cristalwater_user", JSON.stringify(user));
        }, { token: session.token, user: session.user, role: target.role });

        const consoleErrors = [];
        const failedRequests = [];
        const apiWithoutAuthorization = [];

        page.on("console", (msg) => {
          if (msg.type() === "error") {
            const text = msg.text() || "";
            if (!/favicon|sw\.js|websocket|socket\.io/i.test(text)) {
              consoleErrors.push(text.slice(0, 260));
            }
          }
        });

        page.on("requestfailed", (req) => {
          const failure = req.failure() || {};
          const text = String(failure.errorText || "");
          if (/ERR_ABORTED|aborted/i.test(text)) return;
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
          }

          return {
            horizontalScroll,
            clippedText,
            scrollWidth: root.scrollWidth,
            viewport: root.clientWidth,
          };
        });

        const screenshotPath = path.join(OUT_DIR, `${target.page}-${width}-${theme}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        checks.push({
          page: target.page,
          route: target.route,
          width,
          theme,
          navigationError,
          horizontalScroll: metrics.horizontalScroll,
          clippedText: metrics.clippedText,
          scrollWidth: metrics.scrollWidth,
          viewport: metrics.viewport,
          consoleErrors: [...new Set(consoleErrors)].slice(0, 8),
          failedRequests: [...new Set(failedRequests)].slice(0, 8),
          apiWithoutAuthorization: [...new Set(apiWithoutAuthorization)].slice(0, 8),
        });

        await page.close();
      }
    }

    await context.close();
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    totals: {
      totalChecks: checks.length,
      horizontalScroll: checks.filter((c) => c.horizontalScroll).length,
      clippedText: checks.filter((c) => c.clippedText).length,
      navigationErrors: checks.filter((c) => c.navigationError).length,
      consoleErrors: checks.reduce((sum, c) => sum + c.consoleErrors.length, 0),
      failedRequests: checks.reduce((sum, c) => sum + c.failedRequests.length, 0),
      apiWithoutAuthorization: checks.reduce((sum, c) => sum + c.apiWithoutAuthorization.length, 0),
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, "validation-report.json"), JSON.stringify(report, null, 2));
  console.log("Captura Lote E concluida:", report.totals);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
