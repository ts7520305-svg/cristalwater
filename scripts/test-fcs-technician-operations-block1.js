const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium, devices } = require("playwright");

require("../src/loadEnv")();
const { prisma } = require("../src/prismaClient");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs-technician-operations-block1");
const REPORT_JSON = path.join(ROOT, "reports", `fcs-technician-operations-block1-${Date.now()}.json`);
const SCRIPT_WATCHDOG_MS = 180000;

const VIEWPORTS = [
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
    id: "pixel7",
    label: "Pixel 7",
    contextOptions: {
      ...devices["Pixel 7"],
      colorScheme: "light",
    },
  },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
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

function operationalVisits() {
  const now = Date.now();
  return [
    {
      id: 91001,
      status: "SCHEDULED",
      plannedDate: new Date(now).toISOString(),
      notes: "Bomba em manual desde inicio da intervencao.",
      pool: {
        id: 6001,
        name: "Piscina Atlas",
        location: "Rua do Oceano 14",
        zone: "Norte",
        equipment: {
          pumpMode: "MANUAL",
          pumpManualBy: "Joao Silva",
          pumpManualAt: new Date(now - 20 * 60 * 1000).toISOString(),
        },
      },
      client: {
        id: 5001,
        name: "Cliente Atlas",
      },
      technician: {
        id: 4001,
        name: "Tecnico QA",
      },
      photos: [],
      chemicals: [],
    },
    {
      id: 91002,
      status: "IN_PROGRESS",
      startAt: new Date(now - 14 * 60 * 1000).toISOString(),
      plannedDate: new Date(now + 30 * 60 * 1000).toISOString(),
      pool: {
        id: 6002,
        name: "Piscina Boreal",
        location: "Avenida do Sol 20",
        zone: "Centro",
      },
      client: {
        id: 5002,
        name: "Cliente Boreal",
      },
      technician: {
        id: 4001,
        name: "Tecnico QA",
      },
      photos: [],
      chemicals: [],
    },
    {
      id: 91003,
      status: "DONE",
      startAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      endAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      plannedDate: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      pool: {
        id: 6003,
        name: "Piscina Cristal",
        location: "Rua da Luz 8",
        zone: "Sul",
      },
      client: {
        id: 5003,
        name: "Cliente Cristal",
      },
      technician: {
        id: 4001,
        name: "Tecnico QA",
      },
      photos: [{ id: 1, type: "AFTER", url: "https://example.test/photo.jpg" }],
      chemicals: [{ id: 1, name: "Cloro", quantity: 1, unit: "KG" }],
    },
  ];
}

function installApiMocks(page, apiTrace) {
  const visits = operationalVisits();

  page.route("**/technician-auth-guard.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "console.log('BLOCK1 guard bypass active');",
    });
  });

  page.route("**/crystal-os-v2-shell.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "console.log('BLOCK1 shell bypass active');",
    });
  });

  page.route("**/crystal-os-v2-nav.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "console.log('BLOCK1 nav bypass active');",
    });
  });

  page.route("**/ui/design-system.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "console.log('BLOCK1 design-system bypass active');",
    });
  });

  page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    function fulfill(body, status = 200) {
      apiTrace.push({ method, path: url.pathname, status });
      return route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }

    if (url.pathname.startsWith("/api/technician/today")) {
      return fulfill({ ok: true, visits });
    }

    if (url.pathname.startsWith("/api/core/dashboard")) {
      return fulfill({ ok: true, nextVisits: visits });
    }

    if (url.pathname.startsWith("/api/guides/transport/latest/")) {
      return fulfill({ ok: true, guide: null });
    }

    if (url.pathname.startsWith("/api/guides/stock/")) {
      return fulfill({ ok: true, stock: [], items: [] });
    }

    if (url.pathname.includes("/insurance")) {
      return fulfill({ ok: true, insurance: null });
    }

    if (url.pathname.startsWith("/api/operational-state/visits/") && method === "POST") {
      const target = visits[0];
      return fulfill({ ok: true, visit: { ...target, status: "EM_EXECUCAO", startAt: target.startAt } });
    }

    if (url.pathname.startsWith("/api/technician/water-reminders")) {
      return fulfill({ ok: true, reminder: { id: 1 }, alert: { id: 1 }, notifications: [] });
    }

    if (url.pathname.startsWith("/api/core/visits/") && url.pathname.endsWith("/problem") && method === "POST") {
      return fulfill({ ok: true, repair: { id: 7001 }, alert: { id: 8001 } });
    }

    if (url.pathname.startsWith("/api/core/visits/") && url.pathname.endsWith("/complete") && method === "POST") {
      return fulfill({ ok: true, visit: { id: 91001, status: "DONE", endAt: new Date().toISOString() } });
    }

    if (url.pathname.startsWith("/api/technician/visits/") && url.pathname.endsWith("/correction") && method === "PATCH") {
      return fulfill({ ok: true, visit: { id: 91001, status: "DONE" } });
    }

    if (url.pathname.startsWith("/api/technician/stock-reminders") && method === "POST") {
      return fulfill({ ok: true, reminder: { id: 3001 } });
    }

    return fulfill({ ok: true });
  });
}

function contains(haystack, text) {
  return String(haystack || "").toLowerCase().includes(String(text || "").toLowerCase());
}

function hasNoPrivateLeaks(text) {
  const lowered = String(text || "").toLowerCase();
  const forbidden = [
    "margem",
    "lucro",
    "faturacao",
    "iban",
    "cartao",
    "token",
    "password",
    "bearer",
  ];
  return forbidden.every((entry) => !lowered.includes(entry));
}

async function withStepTimeout(promise, ms, label) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`STEP_TIMEOUT:${label}:${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function domCount(page, selector) {
  return page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
}

async function domText(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    return node ? String(node.textContent || "") : "";
  }, selector);
}

async function waitTextNot(page, selector, blockedText, timeoutMs = 5000) {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeoutMs) {
    latest = (await domText(page, selector)).trim();
    if (latest && !contains(latest, blockedText)) return latest;
    await page.waitForTimeout(120);
  }
  return latest;
}

async function domClick(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) return false;
    node.click();
    return true;
  }, selector);
}

async function forceReturnFromMap(page) {
  await page.evaluate(() => {
    const params = new URLSearchParams(window.location.search || "");
    const returnToRaw = String(params.get("returnTo") || "/technician-field-mode");
    const returnTo = returnToRaw.startsWith("/technician-field-mode") ? returnToRaw : "/technician-field-mode";
    const target = new URL(returnTo, window.location.origin);
    const activeTab = String(params.get("activeTab") || "hoje");
    const activeFilter = String(params.get("activeFilter") || "TODO");
    const selectedVisitId = String(params.get("selectedVisitId") || "");
    const scrollY = String(params.get("scrollY") || "0");
    target.searchParams.set("activeTab", activeTab);
    target.searchParams.set("activeFilter", activeFilter);
    if (selectedVisitId) target.searchParams.set("selectedVisitId", selectedVisitId);
    if (scrollY && scrollY !== "0") target.searchParams.set("scrollY", scrollY);
    window.location.href = `${target.pathname}${target.search}${target.hash}`;
  });
}

async function waitForUrlContains(page, fragment, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (contains(page.url(), fragment)) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

async function createTechnicianSession(runId) {
  const pin = String(Math.floor(1000 + Math.random() * 8999));
  const technician = await prisma.technician.create({
    data: {
      name: `QA BLOCK1 TECH ${runId}`,
      email: `${runId.toLowerCase()}@qa-block1-tech.test`,
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

  assert(login.ok && login.data?.token, "Falha no login tecnico");

  return {
    token: login.data.token,
    user: {
      ...(login.data.user || {}),
      id: login.data.user?.id || technician.id,
      technicianId: login.data.user?.technicianId || technician.id,
      role: "TECHNICIAN",
      name: login.data.user?.name || technician.name,
    },
    cleanup: { technicianId: technician.id },
  };
}

async function primeSession(page, session) {
  await page.addInitScript((payload) => {
    if (!localStorage.getItem("token")) {
      localStorage.setItem("token", payload.token);
    }
    if (!localStorage.getItem("cristalwater_jwt")) {
      localStorage.setItem("cristalwater_jwt", payload.token);
    }
    if (!localStorage.getItem("user")) {
      localStorage.setItem("user", JSON.stringify(payload.user));
    }
    if (!localStorage.getItem("cristalwater_user")) {
      localStorage.setItem("cristalwater_user", JSON.stringify(payload.user));
    }
    if (!localStorage.getItem("technicianId")) {
      localStorage.setItem("technicianId", String(payload.user.technicianId || payload.user.id));
    }
  }, session);
}

async function runForViewport(browser, session, viewport) {
  console.log(`[BLOCK1] viewport:start:${viewport.id}`);
  const context = await browser.newContext(viewport.contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const apiErrors = [];
  const apiTrace = [];

  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) {
      const text = msg.text();
      if (!contains(text, "favicon") && !contains(text, "deprecated")) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(String(err?.message || err));
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    if (response.status() >= 400) {
      apiErrors.push({ url, status: response.status() });
    }
  });

  try {
    installApiMocks(page, apiTrace);
    await primeSession(page, session);

    await page.goto(`${BASE_URL}/technician-field-mode`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(900);
    console.log(`[BLOCK1] viewport:ready:${viewport.id}:url=${page.url()}`);
    if (!contains(page.url(), "/technician-field-mode")) {
      throw new Error(`UNEXPECTED_LANDING_URL:${viewport.id}:${page.url()}`);
    }

    const checks = [];
    const addCheck = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });

    console.log(`[BLOCK1] step:${viewport.id}:before-hoje-inicial`);
    const activeTabHoje = await withStepTimeout(
      domCount(page, ".field-tabs [data-field-tab-button='hoje'].active"),
      8000,
      `${viewport.id}:hoje-inicial-count`
    );
    addCheck("hoje-inicial", activeTabHoje === 1, `Hoje ativo: ${activeTabHoje}`);
    await withStepTimeout(
      waitTextNot(page, "#nextTitle", "A carregar", 8000),
      10000,
      `${viewport.id}:initial-hydration`
    );
    console.log(`[BLOCK1] step:${viewport.id}:hoje-inicial`);

    console.log(`[BLOCK1] step:${viewport.id}:before-segmentos`);
    const segmentCount = await withStepTimeout(
      domCount(page, "#poolSegments [data-pool-filter]"),
      8000,
      `${viewport.id}:segmentos-count`
    );
    addCheck("segmentos-piscina", segmentCount === 3, `Segmentos: ${segmentCount}`);
    console.log(`[BLOCK1] step:${viewport.id}:segmentos`);

    await withStepTimeout(domClick(page, "#poolSegments [data-pool-filter='IN_PROGRESS']"), 8000, `${viewport.id}:click-segment-inprogress`);
    const activeFilterAfterClick = await withStepTimeout(
      page.evaluate(() => {
        return document.querySelector("#poolSegments [data-pool-filter].active")?.dataset?.poolFilter || "";
      }),
      8000,
      `${viewport.id}:active-filter-after-click`
    );
    const inProgressVisible = await withStepTimeout(
      page.evaluate(() => {
        return document.querySelectorAll("#visitList .visit").length;
      }),
      8000,
      `${viewport.id}:count-inprogress-visible`
    );
    addCheck(
      "segmento-em-curso",
      activeFilterAfterClick === "IN_PROGRESS" && inProgressVisible >= 1,
      `filtro=${activeFilterAfterClick} visiveis=${inProgressVisible}`
    );
    console.log(`[BLOCK1] step:${viewport.id}:segmento-em-curso`);

    await withStepTimeout(domClick(page, "#visitList .visit"), 8000, `${viewport.id}:click-first-visit`);
    await page.waitForTimeout(250);
    console.log(`[BLOCK1] step:${viewport.id}:abrir-visita-em-curso`);

    await withStepTimeout(domClick(page, ".field-tabs [data-field-tab-button='agora']"), 8000, `${viewport.id}:click-tab-agora`);
    await page.waitForTimeout(300);
    const nowState = await withStepTimeout(domText(page, "#nowStateLine"), 8000, `${viewport.id}:read-now-state`);
    addCheck(
      "agora-mostra-intervencao",
      !contains(nowState, "Sem intervenção ativa") && (contains(nowState, "Piscina") || contains(nowState, "interven") || contains(nowState, "Alerta")),
      nowState
    );
    console.log(`[BLOCK1] step:${viewport.id}:agora`);

    await withStepTimeout(domClick(page, ".field-tabs [data-field-tab-button='hoje']"), 8000, `${viewport.id}:click-tab-hoje`);
    await page.waitForTimeout(300);
    const p0Text = await withStepTimeout(domText(page, "#interruptList"), 8000, `${viewport.id}:read-p0`);
    addCheck("p0-topo", contains(p0Text, "Bomba em manual") && contains(p0Text, "Quem ativou"), p0Text);
    console.log(`[BLOCK1] step:${viewport.id}:p0-topo`);

    const navLabels = await withStepTimeout(
      page.$$eval(".field-tabs [data-field-tab-button]", (nodes) => nodes.map((node) => node.textContent.trim())),
      8000,
      `${viewport.id}:read-nav-labels`
    );
    addCheck(
      "navegacao-blueprint",
      JSON.stringify(navLabels) === JSON.stringify(["Hoje", "Agora", "Mapa", "Documentos", "Mais"]),
      navLabels.join(" | ")
    );
    console.log(`[BLOCK1] step:${viewport.id}:navegacao`);

    const activeTabBeforeMap = await withStepTimeout(
      page.evaluate(() => document.querySelector(".field-tabs [data-field-tab-button].active")?.dataset?.fieldTabButton || ""),
      8000,
      `${viewport.id}:tab-before-map`
    );
    const activeFilterBeforeMap = await withStepTimeout(
      page.evaluate(() => document.querySelector("#poolSegments [data-pool-filter].active")?.dataset?.poolFilter || ""),
      8000,
      `${viewport.id}:filter-before-map`
    );
    const selectedVisitBeforeMap = (await withStepTimeout(
      page.evaluate(() => document.querySelector("#visitList .visit.active b")?.textContent || document.querySelector("#nextTitle")?.textContent || ""),
      8000,
      `${viewport.id}:selected-before-map`
    )).trim();
    const nowBeforeMap = (await withStepTimeout(domText(page, "#nowStateLine"), 8000, `${viewport.id}:now-before-map`)).trim();
    await page.evaluate(() => window.scrollTo({ top: 640, behavior: "auto" }));
    await page.waitForTimeout(120);
    const scrollBeforeMap = await page.evaluate(() => Math.round(window.scrollY || 0));

    await withStepTimeout(domClick(page, ".field-tabs [data-field-tab-button='mapa']"), 8000, `${viewport.id}:click-tab-mapa`);
    const mapReached = await waitForUrlContains(page, "/technician-map", 8000);
    if (!mapReached) throw new Error(`MAP_NAV_TIMEOUT:${viewport.id}:initial-roundtrip:${page.url()}`);
    addCheck("mapa-subfluxo", contains(page.url(), "/technician-map"), page.url());
    await forceReturnFromMap(page);
    const fieldReturnReached = await waitForUrlContains(page, "/technician-field-mode", 12000);
    if (!fieldReturnReached) throw new Error(`RETURN_NAV_TIMEOUT:${viewport.id}:initial-roundtrip:${page.url()}`);
    await page.waitForTimeout(700);
    console.log(`[BLOCK1] step:${viewport.id}:mapa-voltar`);

    const activeTabAfterMap = await withStepTimeout(
      page.evaluate(() => document.querySelector(".field-tabs [data-field-tab-button].active")?.dataset?.fieldTabButton || ""),
      8000,
      `${viewport.id}:tab-after-map`
    );
    const activeFilterAfterMap = await withStepTimeout(
      page.evaluate(() => document.querySelector("#poolSegments [data-pool-filter].active")?.dataset?.poolFilter || ""),
      8000,
      `${viewport.id}:filter-after-map`
    );
    const selectedVisitAfterMap = (await withStepTimeout(
      waitTextNot(page, "#nextTitle", "A carregar", 6000),
      9000,
      `${viewport.id}:selected-after-map`
    )).trim();
    const nowAfterMap = (await withStepTimeout(domText(page, "#nowStateLine"), 8000, `${viewport.id}:now-after-map`)).trim();
    const scrollAfterMap = await withStepTimeout(
      page.evaluate(() => Math.round(window.scrollY || 0)),
      8000,
      `${viewport.id}:scroll-after-map`
    );
    console.log(`[BLOCK1] step:${viewport.id}:mapa-voltar-estado`);

    addCheck("mapa-voltar-tab-preservada", activeTabAfterMap === activeTabBeforeMap, `${activeTabBeforeMap} => ${activeTabAfterMap}`);
    addCheck("mapa-voltar-filtro-preservado", activeFilterAfterMap === activeFilterBeforeMap, `${activeFilterBeforeMap} => ${activeFilterAfterMap}`);
    addCheck(
      "mapa-voltar-visita-preservada",
      Boolean(selectedVisitAfterMap) && contains(selectedVisitAfterMap, selectedVisitBeforeMap),
      `${selectedVisitBeforeMap} => ${selectedVisitAfterMap}`
    );
    addCheck(
      "mapa-voltar-intervencao-preservada",
      !contains(nowAfterMap, "Sem intervenção ativa") && contains(nowAfterMap, "Piscina"),
      `${nowBeforeMap} => ${nowAfterMap}`
    );
    addCheck(
      "mapa-voltar-scroll-preservado",
      scrollBeforeMap <= 0 || Math.abs(scrollAfterMap - scrollBeforeMap) <= 180,
      `${scrollBeforeMap} => ${scrollAfterMap}`
    );
    console.log(`[BLOCK1] step:${viewport.id}:mapa-voltar-checks`);

    console.log(`[BLOCK1] step:${viewport.id}:before-reload`);
    await withStepTimeout(
      page.waitForFunction(
        (expectedFilter) => {
          try {
            const raw = localStorage.getItem("cw:tech-field:ui-state:v1");
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return String(parsed?.activeFilter || "") === String(expectedFilter || "");
          } catch (_) {
            return false;
          }
        },
        activeFilterBeforeMap,
        { timeout: 9000 }
      ),
      10000,
      `${viewport.id}:persist-filter-before-reload`
    ).catch(() => null);
    try {
      await withStepTimeout(
        page.reload({ waitUntil: "commit", timeout: 10000 }),
        12000,
        `${viewport.id}:reload-after-return`
      );
    } catch (_) {
      await withStepTimeout(
        page.goto(`${BASE_URL}/technician-field-mode`, { waitUntil: "domcontentloaded", timeout: 12000 }),
        14000,
        `${viewport.id}:goto-after-reload-fallback`
      );
    }
    await page.waitForTimeout(400);
    const visitAfterRefresh = (await withStepTimeout(
      waitTextNot(page, "#nextTitle", "A carregar", 8000),
      10000,
      `${viewport.id}:visit-after-refresh`
    )).trim();
    const tabAfterRefresh = await withStepTimeout(
      page.evaluate(() => document.querySelector(".field-tabs [data-field-tab-button].active")?.dataset?.fieldTabButton || ""),
      8000,
      `${viewport.id}:tab-after-refresh`
    );
    const filterAfterRefresh = await withStepTimeout(
      page.evaluate(() => document.querySelector("#poolSegments [data-pool-filter].active")?.dataset?.poolFilter || ""),
      8000,
      `${viewport.id}:filter-after-refresh`
    );
    const persistedFilterAfterRefresh = await withStepTimeout(
      page.evaluate(() => {
        try {
          const raw = localStorage.getItem("cw:tech-field:ui-state:v1");
          if (!raw) return "";
          const parsed = JSON.parse(raw);
          return String(parsed?.activeFilter || "");
        } catch (_) {
          return "";
        }
      }),
      8000,
      `${viewport.id}:persisted-filter-after-refresh`
    );
    const explicitFilterAfterRefresh = await withStepTimeout(
      page.evaluate(() => String(localStorage.getItem("cw:tech-field:last-explicit-filter:v1") || "")),
      8000,
      `${viewport.id}:explicit-filter-after-refresh`
    );
    const refreshGroupTitle = await withStepTimeout(
      page.evaluate(() => String(document.querySelector("#visitList .visit-group-title")?.textContent || "").trim()),
      8000,
      `${viewport.id}:group-title-after-refresh`
    );
    const refreshVisibleVisits = await withStepTimeout(
      page.evaluate(() => document.querySelectorAll("#visitList .visit").length),
      8000,
      `${viewport.id}:visible-visits-after-refresh`
    );
    addCheck("refresh-apos-retorno-tab", tabAfterRefresh === activeTabBeforeMap, `${activeTabBeforeMap} => ${tabAfterRefresh}`);
    addCheck(
      "refresh-apos-retorno-filtro",
      filterAfterRefresh === activeFilterBeforeMap && persistedFilterAfterRefresh === activeFilterBeforeMap,
      `${activeFilterBeforeMap} => dom=${filterAfterRefresh} persistido=${persistedFilterAfterRefresh} explicito=${explicitFilterAfterRefresh}`
    );
    addCheck(
      "refresh-apos-retorno-lista-corresponde-filtro",
      contains(refreshGroupTitle, "Em curso") && refreshVisibleVisits >= 1,
      `${refreshGroupTitle} visiveis=${refreshVisibleVisits}`
    );
    addCheck("refresh-apos-retorno-visita", Boolean(visitAfterRefresh) && !contains(visitAfterRefresh, "A carregar"), visitAfterRefresh);
    console.log(`[BLOCK1] step:${viewport.id}:refresh-apos-retorno`);

    console.log(`[BLOCK1] step:${viewport.id}:before-docs-roundtrip`);
    await withStepTimeout(
      page.goto(`${BASE_URL}/technician-map?returnTo=${encodeURIComponent("/technician-field-mode")}&activeTab=docs&activeFilter=${encodeURIComponent(activeFilterBeforeMap)}&selectedVisitId=${encodeURIComponent(String(91002))}&scrollY=420`, {
        waitUntil: "domcontentloaded",
        timeout: 12000,
      }),
      14000,
      `${viewport.id}:docs-to-map`
    );
    const docsMapReached = await waitForUrlContains(page, "/technician-map", 8000);
    if (!docsMapReached) throw new Error(`MAP_NAV_TIMEOUT:${viewport.id}:docs-roundtrip:${page.url()}`);
    await forceReturnFromMap(page);
    const docsReturnReached = await waitForUrlContains(page, "/technician-field-mode", 12000);
    if (!docsReturnReached) throw new Error(`RETURN_NAV_TIMEOUT:${viewport.id}:docs-roundtrip:${page.url()}`);
    await page.waitForTimeout(350);
    await withStepTimeout(
      page.waitForFunction(() => {
        return document.querySelector(".field-tabs [data-field-tab-button].active")?.dataset?.fieldTabButton === "docs";
      }, { timeout: 12000 }),
      13000,
      `${viewport.id}:wait-docs-tab-active`
    ).catch(() => null);
    let activeTabAfterDocsReturn = "";
    try {
      activeTabAfterDocsReturn = await withStepTimeout(
        page.evaluate(() => document.querySelector(".field-tabs [data-field-tab-button].active")?.dataset?.fieldTabButton || ""),
        8000,
        `${viewport.id}:tab-after-docs-return`
      );
    } catch (_) {
      activeTabAfterDocsReturn = "";
    }
    addCheck("documentos-voltar-preserva-tab", activeTabAfterDocsReturn === "docs", activeTabAfterDocsReturn);
    console.log(`[BLOCK1] step:${viewport.id}:docs-voltar`);

    console.log(`[BLOCK1] step:${viewport.id}:before-visita-roundtrip`);
    addCheck(
      "visita-voltar-preserva-contexto",
      Boolean(selectedVisitAfterMap) && contains(selectedVisitAfterMap, selectedVisitBeforeMap),
      `${selectedVisitBeforeMap} => ${selectedVisitAfterMap}`
    );
    addCheck(
      "abrir-visita",
      Boolean(selectedVisitAfterMap) && !contains(selectedVisitAfterMap, "A carregar"),
      selectedVisitAfterMap
    );
    console.log(`[BLOCK1] step:${viewport.id}:visita-voltar`);

    let bodyText = "";
    try {
      bodyText = await withStepTimeout(
        page.evaluate(() => String(document.body?.innerText || "")),
        10000,
        `${viewport.id}:body-text`
      );
    } catch (_) {
      bodyText = "";
    }
    addCheck("sem-dados-privados", hasNoPrivateLeaks(bodyText), "validacao de termos sensiveis no ecrã tecnico");
    console.log(`[BLOCK1] step:${viewport.id}:privacidade`);

    addCheck("sem-erros-console", consoleErrors.length === 0, `consoleErrors=${consoleErrors.length}`);
    addCheck("sem-erros-api", apiErrors.length === 0, `apiErrors=${apiErrors.length}`);

    ensureFolder(EVIDENCE_DIR);
    const shotPath = path.join(EVIDENCE_DIR, `block1-${viewport.id}.png`);
    let screenshotRel = null;
    try {
      await page.screenshot({ path: shotPath, fullPage: true, timeout: 12000 });
      screenshotRel = path.relative(ROOT, shotPath);
    } catch (_) {
      try {
        await page.screenshot({ path: shotPath, fullPage: false, timeout: 5000 });
        screenshotRel = path.relative(ROOT, shotPath);
      } catch (_) {
        screenshotRel = null;
      }
    }
    console.log(`[BLOCK1] step:${viewport.id}:screenshot`);
    console.log(`[BLOCK1] viewport:end:${viewport.id}:pass=${checks.every((item) => item.pass)}`);

    return {
      viewport: viewport.label,
      viewportId: viewport.id,
      checks,
      pass: checks.every((item) => item.pass),
      consoleErrors,
      pageErrors,
      apiErrors,
      apiTrace,
      screenshot: screenshotRel,
    };
  } finally {
    await context.close();
  }
}

async function cleanupSession(session) {
  if (!session?.cleanup?.technicianId) return;
  await prisma.technician.deleteMany({ where: { id: session.cleanup.technicianId } }).catch(() => null);
}

async function main() {
  ensureDir(REPORT_JSON);
  const runId = `B1-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const watchdog = setTimeout(() => {
    console.error(`BLOCK1_WATCHDOG_TIMEOUT after ${SCRIPT_WATCHDOG_MS}ms`);
    process.exit(1);
  }, SCRIPT_WATCHDOG_MS);
  const session = await createTechnicianSession(runId);
  const browser = await chromium.launch({ headless: true });
  const startedAt = Date.now();

  try {
    const viewportResults = [];
    for (const viewport of VIEWPORTS) {
      viewportResults.push(await runForViewport(browser, session, viewport));
    }

    const allChecks = viewportResults.flatMap((result) => result.checks);
    const passed = allChecks.filter((check) => check.pass).length;
    const report = {
      ok: allChecks.length > 0 && allChecks.length === passed,
      runId,
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      totals: {
        checks: allChecks.length,
        passed,
        failed: allChecks.length - passed,
      },
      runtimeMs: Date.now() - startedAt,
      results: viewportResults,
    };

    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_JSON)}`);
    console.log(`RESULT=${report.ok ? "PASS" : "FAIL"}`);

    if (!report.ok) process.exitCode = 1;
  } finally {
    clearTimeout(watchdog);
    await browser.close();
    await cleanupSession(session);
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error("FCS_TECHNICIAN_OPERATIONS_BLOCK1_ERROR", error);
  await prisma.$disconnect();
  process.exit(1);
});
