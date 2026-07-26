const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { chromium } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const ROOT = path.join(__dirname, "..");
const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const OUT_JSON = path.join(ROOT, "docs", "product", "FCS13_CREATE_CLIENT_DIAGNOSTIC.json");
const OUT_MD = path.join(ROOT, "docs", "product", "FCS13_CREATE_CLIENT_DIAGNOSTIC.md");
const SHOT_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs13-create-client-diagnostic");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function logStep(message) {
  console.log(`[FCS13DIAG] ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  const email = `${runId.toLowerCase()}@qa-fcs13-diag-admin.test`;
  const plainPassword = `Tmp-${crypto.randomBytes(8).toString("hex")}-A1!`;
  const password = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password,
      role: "ADMIN",
      name: `QA FCS13 DIAG ADMIN ${runId}`,
      active: true,
      mustChangePassword: false,
    },
  });

  const login = await requestJson("/api/auth/login", {
    method: "POST",
    body: { email, password: plainPassword },
  });

  assert(login.ok && login.data?.token, "Falha ao autenticar admin temporario");

  return {
    userId: user.id,
    token: login.data.token,
    loginUser: {
      ...(login.data.user || {}),
      id: login.data.user?.id || user.id,
      email: login.data.user?.email || email,
      role: "ADMIN",
    },
  };
}

async function primeSession(page, session) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("token", payload.token);
    localStorage.setItem("cristalwater_jwt", payload.token);
    localStorage.setItem("adminToken", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
  }, { token: session.token, user: session.loginUser });
}

async function attachPageInstrumentation(page) {
  await page.addInitScript(() => {
    window.__FCS13_DIAG__ = {
      lifecycle: [],
    };

    ["pagehide", "pageshow", "beforeunload"].forEach((eventName) => {
      window.addEventListener(eventName, () => {
        window.__FCS13_DIAG__.lifecycle.push({
          type: eventName,
          href: location.href,
          at: Date.now(),
          readyState: document.readyState,
        });
      });
    });
  });
}

async function snapshotPageState(page, label, pendingRequests) {
  const evaluateState = page.evaluate(async (stepLabel) => {
    const link = document.querySelector("a[href='/admin-clients']");
    const rect = link ? link.getBoundingClientRect() : null;
    let topAtCenter = null;
    let overlays = [];
    if (rect && rect.width > 0 && rect.height > 0) {
      const cx = Math.floor(rect.left + rect.width / 2);
      const cy = Math.floor(rect.top + rect.height / 2);
      const topNode = document.elementFromPoint(cx, cy);
      if (topNode) {
        topAtCenter = {
          tag: topNode.tagName,
          id: topNode.id || "",
          className: String(topNode.className || ""),
          text: String(topNode.textContent || "").trim().slice(0, 120),
        };
      }
    }

    const nodes = Array.from(document.querySelectorAll("body *"));
    overlays = nodes
      .map((node) => {
        const style = window.getComputedStyle(node);
        const box = node.getBoundingClientRect();
        const isOverlay =
          (style.position === "fixed" || style.position === "sticky") &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0.01 &&
          box.width > 40 &&
          box.height > 40;
        if (!isOverlay) return null;
        return {
          tag: node.tagName,
          id: node.id || "",
          className: String(node.className || ""),
          zIndex: style.zIndex,
          box: {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          },
          text: String(node.textContent || "").trim().slice(0, 120),
        };
      })
      .filter(Boolean)
      .slice(0, 12);

    const clientForm = document.querySelector("#clientForm");
    const lifecycle = window.__FCS13_DIAG__?.lifecycle || [];
    const serviceWorker = navigator.serviceWorker ? {
      controllerActive: Boolean(navigator.serviceWorker.controller),
      controllerState: navigator.serviceWorker.controller?.state || null,
    } : {
      controllerActive: false,
      controllerState: null,
    };

    return {
      label: stepLabel,
      href: location.href,
      readyState: document.readyState,
      title: document.title,
      clientFormPresent: Boolean(clientForm),
      clientFormVisible: Boolean(clientForm && clientForm.getBoundingClientRect().width > 0 && clientForm.getBoundingClientRect().height > 0),
      clientFormNameFieldPresent: Boolean(document.querySelector("#name")),
      linkVisible: Boolean(link && rect && rect.width > 0 && rect.height > 0),
      linkEnabled: Boolean(link && !link.hasAttribute("disabled") && link.getAttribute("aria-disabled") !== "true"),
      linkBoundingBox: rect ? {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      } : null,
      topElementAtLinkCenter: topAtCenter,
      overlaysVisible: overlays,
      serviceWorker,
      lifecycle,
    };
  }, label);

  const fallbackState = new Promise((resolve) => {
    const fallbackUrl = page.url();
    setTimeout(() => {
      resolve({
        label,
        href: fallbackUrl,
        readyState: "snapshot-timeout",
        title: "(snapshot-timeout)",
        clientFormPresent: null,
        clientFormVisible: null,
        clientFormNameFieldPresent: null,
        linkVisible: null,
        linkEnabled: null,
        linkBoundingBox: null,
        topElementAtLinkCenter: null,
        overlaysVisible: [],
        serviceWorker: { controllerActive: null, controllerState: null },
        lifecycle: [],
        snapshotTimedOut: true,
      });
    }, 3000);
  });

  const state = await Promise.race([evaluateState, fallbackState]);

  return {
    ...state,
    pendingRequests: Array.from(pendingRequests),
  };
}

async function collectTimelineSnapshots(page, pendingRequests) {
  await page.waitForTimeout(1000);
  const after1s = await snapshotPageState(page, "after-1s", pendingRequests);
  await page.waitForTimeout(2000);
  const after3s = await snapshotPageState(page, "after-3s", pendingRequests);
  await page.waitForTimeout(7000);
  const after10s = await snapshotPageState(page, "after-10s", pendingRequests);
  return { after1s, after3s, after10s };
}

async function screenshot(page, runId, variant, name) {
  ensureFolder(SHOT_DIR);
  const filePath = path.join(SHOT_DIR, `${runId}-${variant}-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => null);
  return path.relative(ROOT, filePath);
}

async function runVariant(browser, session, runId, variant) {
  logStep(`variant:start:${variant}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, colorScheme: "light" });
  const page = await context.newPage();
  const pendingRequests = new Set();
  const consoleLines = [];
  const pageErrors = [];
  const responses = [];

  page.on("console", (msg) => consoleLines.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
  page.on("request", (request) => pendingRequests.add(`${request.method()} ${request.url()}`));
  page.on("requestfinished", (request) => pendingRequests.delete(`${request.method()} ${request.url()}`));
  page.on("requestfailed", (request) => pendingRequests.delete(`${request.method()} ${request.url()}`));
  page.on("response", (response) => {
    if (!response.url().includes("/api/")) return;
    responses.push({ url: response.url(), status: response.status(), method: response.request().method() });
  });

  try {
    await attachPageInstrumentation(page);
    const urlInitial = "about:blank";
    logStep(`variant:${variant}:prime-session:start`);
    await primeSession(page, session);
    logStep(`variant:${variant}:prime-session:done`);
    const urlAfterLoginPrime = page.url();

    logStep(`variant:${variant}:landing:start`);
    await page.goto(`${BASE_URL}/admin-master-control`, { waitUntil: "domcontentloaded", timeout: 30000 });
    logStep(`variant:${variant}:landing:done`);
    const urlAfterLanding = page.url();
    logStep(`variant:${variant}:landing-snapshot:start`);
    const landingState = await snapshotPageState(page, "after-landing", pendingRequests);
    logStep(`variant:${variant}:landing-snapshot:done`);
    const landingShot = await screenshot(page, runId, variant, "landing");

    let clickedSelector = null;
    let directGotoError = null;
    let clickError = null;
    let immediateAfterClick = null;

    if (variant === "menu-click") {
      clickedSelector = "a[href='/admin-clients']";
      const link = page.locator(clickedSelector).first();
      try {
        logStep(`variant:${variant}:click:start`);
        await link.click({ timeout: 10000 });
        logStep(`variant:${variant}:click:done`);
      } catch (error) {
        clickError = error.message;
        logStep(`variant:${variant}:click:error`);
      }
      logStep(`variant:${variant}:snapshot-immediate:start`);
      immediateAfterClick = await snapshotPageState(page, "immediate-after-click", pendingRequests);
      logStep(`variant:${variant}:snapshot-immediate:done`);
    }

    if (variant === "direct-route") {
      try {
        logStep(`variant:${variant}:direct-goto:start`);
        await page.goto(`${BASE_URL}/admin-clients`, { waitUntil: "commit", timeout: 30000 });
        logStep(`variant:${variant}:direct-goto:done`);
      } catch (error) {
        directGotoError = error.message;
        logStep(`variant:${variant}:direct-goto:error`);
      }
      logStep(`variant:${variant}:snapshot-immediate:start`);
      immediateAfterClick = await snapshotPageState(page, "immediate-after-direct-goto", pendingRequests);
      logStep(`variant:${variant}:snapshot-immediate:done`);
    }

    logStep(`variant:${variant}:timeline:start`);
    const timeline = await collectTimelineSnapshots(page, pendingRequests);
    logStep(`variant:${variant}:timeline:done`);
    const finalShot = await screenshot(page, runId, variant, "final");

    return {
      variant,
      urlInitial,
      urlAfterLoginPrime,
      urlAfterLanding,
      clickedSelector,
      clickError,
      directGotoError,
      landingState,
      immediateAfterAction: immediateAfterClick,
      timeline,
      screenshots: {
        landing: landingShot,
        final: finalShot,
      },
      console: consoleLines,
      pageErrors,
      apiResponses: responses,
    };
  } finally {
    await context.close().catch(() => null);
  }
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# FCS-1.3 - Create Client Desktop Diagnostic");
  lines.push("");
  lines.push(`Data: ${report.generatedAt}`);
  lines.push(`Run: ${report.runId}`);
  lines.push("");
  for (const variant of report.variants) {
    lines.push(`## ${variant.variant}`);
    lines.push("");
    lines.push(`- URL inicial: ${variant.urlInitial}`);
    lines.push(`- URL após login: ${variant.urlAfterLoginPrime}`);
    lines.push(`- URL após landing: ${variant.urlAfterLanding}`);
    lines.push(`- Seletor clicado: ${variant.clickedSelector || "(n/a)"}`);
    lines.push(`- Erro de clique: ${variant.clickError || "(nenhum)"}`);
    lines.push(`- Erro de navegação direta: ${variant.directGotoError || "(nenhum)"}`);
    lines.push(`- Screenshot landing: ${variant.screenshots.landing}`);
    lines.push(`- Screenshot final: ${variant.screenshots.final}`);
    lines.push("");
    lines.push("| Momento | URL | readyState | clientForm presente | clientForm visível | #name presente | link visível | pendentes | SW controller |\n|---|---|---|---|---|---|---|---:|---|");
    const states = [variant.landingState, variant.immediateAfterAction, variant.timeline.after1s, variant.timeline.after3s, variant.timeline.after10s].filter(Boolean);
    for (const state of states) {
      lines.push(`| ${state.label} | ${state.href} | ${state.readyState} | ${state.clientFormPresent ? "SIM" : "NAO"} | ${state.clientFormVisible ? "SIM" : "NAO"} | ${state.clientFormNameFieldPresent ? "SIM" : "NAO"} | ${state.linkVisible ? "SIM" : "NAO"} | ${state.pendingRequests.length} | ${state.serviceWorker.controllerActive ? state.serviceWorker.controllerState || "SIM" : "NAO"} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function cleanup(userId) {
  if (!userId) return;
  await prisma.user.updateMany({ where: { id: userId }, data: { active: false } }).catch(() => null);
}

async function main() {
  const runId = `FCS13DIAG_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let adminUserId = null;

  try {
    const session = await createAdmin(runId);
    adminUserId = session.userId;
    const browser = await chromium.launch({ headless: true });

    let variants;
    try {
      variants = [
        await runVariant(browser, session, runId, "menu-click"),
        await runVariant(browser, session, runId, "direct-route"),
      ];
    } finally {
      await browser.close().catch(() => null);
    }

    const report = {
      generatedAt: nowIso(),
      runId,
      baseUrl: BASE_URL,
      variants,
    };

    ensureDir(OUT_JSON);
    ensureFolder(SHOT_DIR);
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
    fs.writeFileSync(OUT_MD, buildMarkdown(report));

    console.log(JSON.stringify({
      ok: true,
      runId,
      outJson: path.relative(ROOT, OUT_JSON),
      outMd: path.relative(ROOT, OUT_MD),
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, runId, error: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await cleanup(adminUserId);
    await prisma.$disconnect().catch(() => null);
  }
}

main();
