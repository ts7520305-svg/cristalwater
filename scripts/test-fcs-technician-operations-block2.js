const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs-technician-operations-block2");
const REPORT_JSON = path.join(ROOT, "reports", `fcs-technician-operations-block2-${Date.now()}.json`);

const VIEWPORTS = [
  {
    id: "desktop",
    label: "Desktop 1440x920",
    contextOptions: { viewport: { width: 1440, height: 920 }, colorScheme: "light" },
  },
  {
    id: "mobile390",
    label: "Mobile 390x844",
    contextOptions: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "light" },
  },
  {
    id: "pixel7",
    label: "Pixel 7",
    contextOptions: { ...devices["Pixel 7"], colorScheme: "light" },
  },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function contains(haystack, text) {
  return String(haystack || "").toLowerCase().includes(String(text || "").toLowerCase());
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

async function domText(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    return node ? String(node.textContent || "") : "";
  }, selector);
}

async function domCount(page, selector) {
  return page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
}

async function domClick(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) return false;
    node.click();
    return true;
  }, selector);
}

async function waitTextNot(page, selector, blockedText, timeoutMs = 6000) {
  const started = Date.now();
  let latest = "";
  while (Date.now() - started < timeoutMs) {
    latest = (await domText(page, selector)).trim();
    if (latest && !contains(latest, blockedText)) return latest;
    await page.waitForTimeout(120);
  }
  return latest;
}

function mockedVisits(mode = "p0") {
  const now = Date.now();
  if (mode === "free") return [];

  if (mode === "scheduled") {
    return [
      {
        id: 92011,
        status: "PLANNED",
        plannedDate: new Date(now + 35 * 60 * 1000).toISOString(),
        notes: "Visita programada",
        pool: {
          id: 6211,
          name: "Piscina Lira",
          location: "Rua da Agenda 21",
          zone: "Centro",
          equipment: {
            pumpMode: "AUTO",
            pumpManual: false,
          },
        },
        client: {
          id: 5211,
          name: "Cliente Lira",
        },
        technician: {
          id: 4201,
          name: "Tecnico QA",
        },
        photos: [],
        chemicals: [],
      },
    ];
  }

  if (mode === "intervention") {
    return [
      {
        id: 92021,
        status: "IN_PROGRESS",
        startAt: new Date(now - 18 * 60 * 1000).toISOString(),
        plannedDate: new Date(now - 40 * 60 * 1000).toISOString(),
        notes: "Intervencao em curso sem P0",
        pool: {
          id: 6221,
          name: "Piscina Vega",
          location: "Rua da Intervencao 7",
          zone: "Sul",
          equipment: {
            pumpMode: "AUTO",
            pumpManual: false,
          },
        },
        client: {
          id: 5221,
          name: "Cliente Vega",
        },
        technician: {
          id: 4201,
          name: "Tecnico QA",
        },
        photos: [],
        chemicals: [],
      },
    ];
  }

  return [
    {
      id: 92001,
      status: "IN_PROGRESS",
      startAt: new Date(now - 35 * 60 * 1000).toISOString(),
      plannedDate: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      notes: "Anomalia critica no skimmer.",
      pool: {
        id: 6201,
        name: "Piscina Orion",
        location: "Rua do Campo 10",
        zone: "Norte",
        equipment: {
          pumpMode: "MANUAL",
          pumpManual: true,
          pumpManualBy: "Joao Silva",
          pumpManualAt: new Date(now - 25 * 60 * 1000).toISOString(),
        },
      },
      client: {
        id: 5201,
        name: "Cliente Orion",
      },
      technician: {
        id: 4201,
        name: "Tecnico QA",
      },
      photos: [],
      chemicals: [],
    },
  ];
}

function installApiMocks(page, apiTrace, scenarioRef) {

  page.route("**/technician-auth-guard.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('BLOCK2 guard bypass active');" });
  });

  page.route("**/crystal-os-v2-shell.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('BLOCK2 shell bypass active');" });
  });

  page.route("**/crystal-os-v2-nav.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('BLOCK2 nav bypass active');" });
  });

  page.route("**/ui/design-system.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('BLOCK2 design-system bypass active');" });
  });

  page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    function fulfill(body, status = 200) {
      apiTrace.push({ method, path: url.pathname, status });
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    }

    if (url.pathname.startsWith("/api/technician/today")) {
      const visits = mockedVisits(scenarioRef.mode);
      return fulfill({ ok: true, visits });
    }
    if (url.pathname.startsWith("/api/core/dashboard")) {
      const visits = mockedVisits(scenarioRef.mode);
      return fulfill({ ok: true, nextVisits: visits });
    }
    if (url.pathname.startsWith("/api/guides/transport/latest/")) {
      return fulfill({ ok: true, guide: null, items: [] });
    }
    if (url.pathname.startsWith("/api/guides/stock/")) {
      return fulfill({ ok: true, workGuide: null, stock: [], movements: [] });
    }
    if (url.pathname.includes("/insurance")) {
      return fulfill({ ok: true, insurance: null });
    }
    if (url.pathname.startsWith("/api/technician/water-reminders") && method === "POST") {
      return fulfill({ ok: true, reminder: { id: 991 }, notification: { id: 881 } }, 200);
    }
    if (url.pathname.includes("/water-reminders/") && url.pathname.endsWith("/alarm") && method === "POST") {
      return fulfill({ ok: true, reminder: { id: 991 }, alert: { id: 777 }, notifications: [{ id: 1 }, { id: 2 }] });
    }
    if (url.pathname.includes("/water-reminders/") && url.pathname.endsWith("/close") && method === "POST") {
      return fulfill({ ok: true, reminder: { id: 991, status: "CLOSED" } });
    }
    if (url.pathname.startsWith("/api/core/visits/") && url.pathname.endsWith("/problem") && method === "POST") {
      return fulfill({ ok: true, repair: { id: 7002 }, alert: { id: 8002 } });
    }
    return fulfill({ ok: true });
  });
}

async function primeSession(page) {
  await page.addInitScript(() => {
    const user = {
      id: 4201,
      technicianId: 4201,
      role: "TECHNICIAN",
      name: "Tecnico QA",
    };
    if (!localStorage.getItem("token")) localStorage.setItem("token", "block2-mocked-token");
    if (!localStorage.getItem("cristalwater_jwt")) localStorage.setItem("cristalwater_jwt", "block2-mocked-token");
    if (!localStorage.getItem("user")) localStorage.setItem("user", JSON.stringify(user));
    if (!localStorage.getItem("cristalwater_user")) localStorage.setItem("cristalwater_user", JSON.stringify(user));
    if (!localStorage.getItem("technicianId")) localStorage.setItem("technicianId", "4201");
  });
}

async function runForViewport(browser, viewport) {
  const context = await browser.newContext(viewport.contextOptions);
  const page = await context.newPage();
  const checks = [];
  const consoleErrors = [];
  const pageErrors = [];
  const apiErrors = [];
  const apiTrace = [];
  const addCheck = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });

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
    if (response.status() >= 400) apiErrors.push({ url, status: response.status() });
  });

  try {
    const scenarioRef = { mode: "p0" };
    installApiMocks(page, apiTrace, scenarioRef);
    await primeSession(page);
    await page.goto(`${BASE_URL}/technician-field-mode`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(900);

    addCheck("landing-tecnico", contains(page.url(), "/technician-field-mode"), page.url());

    const title = (await withStepTimeout(waitTextNot(page, "#nextTitle", "A carregar", 9000), 11000, `${viewport.id}:title`)).trim();
    addCheck("titulo-carregado", Boolean(title) && !contains(title, "A carregar"), title);

    const interruptCount = await withStepTimeout(domCount(page, "#interruptList [data-exception-id]"), 8000, `${viewport.id}:exception-count`);
    addCheck("excecoes-operacionais-render", interruptCount >= 3, `excecoes=${interruptCount}`);

    const interruptText = await withStepTimeout(domText(page, "#interruptList"), 8000, `${viewport.id}:exception-text`);
    addCheck("excecoes-cobrem-casos", contains(interruptText, "Bomba em manual") && contains(interruptText, "Documento obrigatorio") && contains(interruptText, "Visita atrasada"), interruptText);
    addCheck("motor-responsabilidade-visivel", contains(interruptText, "Responsabilidade:") && contains(interruptText, "Tempo em curso:"), interruptText);

    const navState = await withStepTimeout(
      page.evaluate(() => {
        const tabs = [...document.querySelectorAll(".field-tabs [data-field-tab-button]")];
        const visibleTabs = tabs.filter((button) => {
          const style = getComputedStyle(button);
          return style.display !== "none" && style.visibility !== "hidden";
        });
        return {
          totalTabs: tabs.length,
          visibleTabs: visibleTabs.length,
          quickRailCount: document.querySelectorAll(".field-action-rail").length,
        };
      }),
      8000,
      `${viewport.id}:nav-state`
    );
    addCheck("navegacao-sempre-acessivel", navState.totalTabs === 5 && navState.visibleTabs === 5, JSON.stringify(navState));
    addCheck("ausencia-atalhos-duplicados", navState.quickRailCount === 0, `quickRail=${navState.quickRailCount}`);

    const p0HeroState = await withStepTimeout(
      page.evaluate(() => {
        const buttons = [...document.querySelectorAll("#fieldHeroActions button")].filter((button) => !button.hidden);
        return {
          mode: document.body.dataset.fieldMode || "",
          priority: document.body.dataset.fieldPriority || "",
          primaryAction: buttons[0]?.dataset?.heroAction || "",
          primaryText: (buttons[0]?.textContent || "").trim(),
        };
      }),
      8000,
      `${viewport.id}:p0-hero`
    );
    addCheck(
      "acao-principal-correta-p0",
      p0HeroState.mode === "active" && p0HeroState.priority === "p0" && p0HeroState.primaryAction === "p0" && contains(p0HeroState.primaryText, "Tratar alerta"),
      JSON.stringify(p0HeroState)
    );

    await withStepTimeout(domClick(page, ".field-tabs [data-field-tab-button='more']"), 8000, `${viewport.id}:tab-more`);
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      document.querySelector("#waterReminderList")?.scrollIntoView({ behavior: "auto", block: "start" });
    });
    await page.fill("#waterMinutes", "1");
    await page.fill("#waterNote", "Teste bloco 2");
    await withStepTimeout(domClick(page, "#openWaterBtn"), 8000, `${viewport.id}:open-water`);
    await page.waitForTimeout(500);
    const afterWaterText = await withStepTimeout(domText(page, "#interruptList"), 8000, `${viewport.id}:after-water-text`);
    addCheck("excecao-agua-aberta", contains(afterWaterText, "Agua aberta"), afterWaterText);

    const firstExceptionId = await withStepTimeout(
      page.evaluate(() => document.querySelector("#interruptList [data-exception-id]")?.dataset?.exceptionId || ""),
      8000,
      `${viewport.id}:first-exception-id`
    );

    if (firstExceptionId) {
      await withStepTimeout(domClick(page, `#interruptList [data-interrupt-action='assume'][data-exception-id='${firstExceptionId}']`), 8000, `${viewport.id}:assume`);
      await page.waitForTimeout(200);
      await withStepTimeout(domClick(page, `#interruptList [data-interrupt-action='confirm'][data-exception-id='${firstExceptionId}']`), 8000, `${viewport.id}:confirm`);
      await page.waitForTimeout(200);
      await withStepTimeout(domClick(page, `#interruptList [data-interrupt-action='resolve'][data-exception-id='${firstExceptionId}']`), 8000, `${viewport.id}:resolve`);
      await page.waitForTimeout(300);

      const state = await withStepTimeout(
        page.evaluate(({ key, id }) => {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed?.[id] || null;
          } catch (_) {
            return null;
          }
        }, { key: "cw:tech-field:op-exception-state:v1", id: firstExceptionId }),
        8000,
        `${viewport.id}:state-after-resolve`
      );

      addCheck(
        "lifecycle-assume-confirm-resolve",
        state && state.status === "RESOLVED" && Boolean(state.assumedBy) && Boolean(state.confirmedBy) && Boolean(state.resolvedBy),
        JSON.stringify(state || {})
      );
    } else {
      addCheck("lifecycle-assume-confirm-resolve", false, "Sem excecao para acionar lifecycle");
    }

    const historyCountBeforeReload = await withStepTimeout(domCount(page, "#interruptList [data-history-entry]"), 8000, `${viewport.id}:history-before-reload`);
    addCheck("historico-local-gerado", historyCountBeforeReload >= 3, `history=${historyCountBeforeReload}`);

    await withStepTimeout(page.reload({ waitUntil: "domcontentloaded", timeout: 10000 }), 12000, `${viewport.id}:reload`);
    await page.waitForTimeout(500);

    const historyCountAfterReload = await withStepTimeout(domCount(page, "#interruptList [data-history-entry]"), 8000, `${viewport.id}:history-after-reload`);
    addCheck("historico-local-persistido", historyCountAfterReload >= historyCountBeforeReload && historyCountAfterReload >= 1, `before=${historyCountBeforeReload} after=${historyCountAfterReload}`);

    const commandQueueSize = await withStepTimeout(
      page.evaluate((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return 0;
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.length : 0;
        } catch (_) {
          return 0;
        }
      }, "cw:tech-field:op-exception-command:v1"),
      8000,
      `${viewport.id}:command-queue-size`
    );
    addCheck("ligacao-centro-operacional", commandQueueSize >= 1, `queue=${commandQueueSize}`);

    scenarioRef.mode = "free";
    await withStepTimeout(page.goto(`${BASE_URL}/technician-field-mode?scenario=free`, { waitUntil: "domcontentloaded", timeout: 15000 }), 18000, `${viewport.id}:scenario-free`);
    await page.waitForTimeout(700);
    const freeState = await withStepTimeout(
      page.evaluate(() => {
        const buttons = [...document.querySelectorAll("#fieldHeroActions button")].filter((button) => !button.hidden);
        const routeCard = document.querySelector("#routeCard");
        const dayVisitsCard = document.querySelector("#dayVisitsCard");
        const bodyText = String(document.body.textContent || "");
        return {
          mode: document.body.dataset.fieldMode || "",
          heroText: (document.querySelector("#fieldFocusNow")?.textContent || "").trim(),
          primaryAction: buttons[0]?.dataset?.heroAction || "",
          primaryText: (buttons[0]?.textContent || "").trim(),
          routeHidden: routeCard ? routeCard.hidden : false,
          dayVisitsHidden: dayVisitsCard ? dayVisitsCard.hidden : false,
          hasRepeatedSemDados: bodyText.includes("Sem dados Sem dados Sem dados"),
        };
      }),
      8000,
      `${viewport.id}:free-state`
    );
    addCheck(
      "estado-livre-com-acao-clara",
      freeState.mode === "free"
        && freeState.primaryAction === "refresh"
        && contains(freeState.primaryText, "Atualizar")
        && (contains(freeState.heroText, "Hoje está livre") || contains(freeState.heroText, "Água aberta") || contains(freeState.heroText, "Bomba")),
      JSON.stringify(freeState)
    );
    addCheck(
      "secoes-vazias-ocultas",
      freeState.routeHidden === true && freeState.dayVisitsHidden === true && !freeState.hasRepeatedSemDados,
      JSON.stringify(freeState)
    );

    scenarioRef.mode = "scheduled";
    await withStepTimeout(page.goto(`${BASE_URL}/technician-field-mode?scenario=scheduled`, { waitUntil: "domcontentloaded", timeout: 15000 }), 18000, `${viewport.id}:scenario-scheduled`);
    await page.waitForTimeout(700);
    const scheduledState = await withStepTimeout(
      page.evaluate(() => {
        const buttons = [...document.querySelectorAll("#fieldHeroActions button")].filter((button) => !button.hidden);
        return {
          mode: document.body.dataset.fieldMode || "",
          primaryAction: buttons[0]?.dataset?.heroAction || "",
          primaryText: (buttons[0]?.textContent || "").trim(),
          secondaryActions: buttons.slice(1).map((button) => button.dataset.heroAction || ""),
        };
      }),
      8000,
      `${viewport.id}:scheduled-state`
    );
    addCheck(
      "acao-principal-proxima-visita",
      scheduledState.mode === "active" && scheduledState.primaryAction === "openVisit" && contains(scheduledState.primaryText, "Abrir visita") && scheduledState.secondaryActions.includes("map"),
      JSON.stringify(scheduledState)
    );

    scenarioRef.mode = "intervention";
    await withStepTimeout(page.goto(`${BASE_URL}/technician-field-mode?scenario=intervention`, { waitUntil: "domcontentloaded", timeout: 15000 }), 18000, `${viewport.id}:scenario-intervention`);
    await page.waitForTimeout(700);
    const interventionState = await withStepTimeout(
      page.evaluate(() => {
        const buttons = [...document.querySelectorAll("#fieldHeroActions button")].filter((button) => !button.hidden);
        return {
          mode: document.body.dataset.fieldMode || "",
          primaryAction: buttons[0]?.dataset?.heroAction || "",
          primaryText: (buttons[0]?.textContent || "").trim(),
          nowLine: (document.querySelector("#nowStateLine")?.textContent || "").trim(),
        };
      }),
      8000,
      `${viewport.id}:intervention-state`
    );
    addCheck(
      "acao-principal-intervencao",
      interventionState.mode === "active" && interventionState.primaryAction === "continue" && contains(interventionState.primaryText, "Continuar") && interventionState.nowLine.length > 0,
      JSON.stringify(interventionState)
    );

    scenarioRef.mode = "p0";
    await withStepTimeout(page.goto(`${BASE_URL}/technician-field-mode?scenario=p0`, { waitUntil: "domcontentloaded", timeout: 15000 }), 18000, `${viewport.id}:scenario-back-p0`);
    await page.waitForTimeout(600);

    addCheck("sem-erros-console", consoleErrors.length === 0, `consoleErrors=${consoleErrors.length}`);
    addCheck("sem-erros-api", apiErrors.length === 0, `apiErrors=${apiErrors.length}`);

    ensureFolder(EVIDENCE_DIR);
    const shotPath = path.join(EVIDENCE_DIR, `block2-${viewport.id}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    return {
      viewport: viewport.label,
      viewportId: viewport.id,
      checks,
      pass: checks.every((item) => item.pass),
      consoleErrors,
      pageErrors,
      apiErrors,
      apiTrace,
      screenshot: path.relative(ROOT, shotPath),
    };
  } finally {
    await context.close();
  }
}

async function main() {
  ensureDir(REPORT_JSON);
  const browser = await chromium.launch({ headless: true });
  const startedAt = Date.now();

  try {
    const results = [];
    for (const viewport of VIEWPORTS) {
      results.push(await runForViewport(browser, viewport));
    }

    const allChecks = results.flatMap((item) => item.checks);
    const passed = allChecks.filter((item) => item.pass).length;
    const report = {
      ok: allChecks.length > 0 && passed === allChecks.length,
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      runtimeMs: Date.now() - startedAt,
      totals: {
        checks: allChecks.length,
        passed,
        failed: allChecks.length - passed,
      },
      results,
    };

    fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
    console.log(`REPORT_JSON=${path.relative(ROOT, REPORT_JSON)}`);
    console.log(`RESULT=${report.ok ? "PASS" : "FAIL"}`);
    if (!report.ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("FCS_TECHNICIAN_OPERATIONS_BLOCK2_ERROR", error);
  process.exit(1);
});
