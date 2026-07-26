const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3002";
const ROOT = path.join(__dirname, "..");
const EVIDENCE_DIR = path.join(ROOT, "docs", "product", "evidence", "fcs-technician-operations-block3");
const REPORT_JSON = path.join(ROOT, "reports", `fcs-technician-operations-block3-${Date.now()}.json`);

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

function futureIso(days = 30) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pastIso(days = 3) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
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

async function domClick(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) return false;
    node.click();
    return true;
  }, selector);
}

function mockedVisits() {
  return [
    {
      id: 93001,
      status: "PLANNED",
      plannedDate: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      pool: {
        id: 7301,
        name: "Piscina Atlas",
        location: "Rua dos Documentos 42",
        zone: "Centro",
        equipment: { pumpMode: "AUTO", pumpManual: false },
      },
      client: { id: 6301, name: "Cliente Atlas" },
      technician: { id: 4201, name: "Tecnico QA" },
      photos: [],
      chemicals: [],
    },
  ];
}

function docsPayload(mode, vehicleId = "1") {
  const idNum = Number(vehicleId) || 1;
  const vehicleBase = {
    id: idNum,
    code: `V-${idNum}`,
    plate: idNum === 2 ? "22-BB-22" : "11-AA-11",
    licensePlate: idNum === 2 ? "22-BB-22" : "11-AA-11",
    manuals: [{ id: 1, type: "MANUAL", status: "VALID", validUntil: futureIso(120) }],
    safetySheets: [{ id: 2, type: "SAFETY", status: "VALID", validUntil: futureIso(120) }],
  };

  if (mode === "pending") {
    return {
      transport: {
        ok: true,
        guide: {
          id: 2100 + idNum,
          codeAT: `AT-${idNum}-PENDING`,
          status: "PENDING",
          validUntil: futureIso(10),
          vehicle: {
            ...vehicleBase,
            inspectionStatus: "PENDING",
            inspectionDueDate: futureIso(2),
            manuals: [{ id: 9, type: "MANUAL", status: "PENDING", validUntil: futureIso(2) }],
            safetySheets: [{ id: 8, type: "SAFETY", status: "PENDING", validUntil: futureIso(2) }],
          },
        },
        items: [],
      },
      work: {
        ok: true,
        workGuide: {
          id: 2200 + idNum,
          guideId: `AT-${idNum}-PENDING`,
          status: "PENDING",
          validUntil: futureIso(5),
          vehicle: {
            ...vehicleBase,
            inspectionStatus: "PENDING",
            inspectionDueDate: futureIso(2),
          },
        },
        stock: [],
        movements: [],
      },
      insurance: {
        ok: true,
        insurance: {
          id: 2300 + idNum,
          status: "PENDING",
          policyNumber: `POL-${idNum}-PENDING`,
          dueDate: futureIso(5),
        },
        vehicle: {
          ...vehicleBase,
          inspectionStatus: "PENDING",
          inspectionDueDate: futureIso(2),
        },
      },
    };
  }

  if (mode === "blocked") {
    return {
      transport: {
        ok: true,
        guide: {
          id: 1100 + idNum,
          codeAT: `AT-${idNum}-BLOCK`,
          status: "ACTIVE",
          validUntil: futureIso(10),
          vehicle: {
            ...vehicleBase,
            inspectionStatus: "EXPIRED",
            inspectionDueDate: pastIso(2),
          },
        },
        items: [],
      },
      work: {
        ok: true,
        workGuide: {
          id: 1200 + idNum,
          guideId: `AT-${idNum}-BLOCK`,
          status: "OPEN",
          validUntil: futureIso(5),
          vehicle: {
            ...vehicleBase,
            inspectionStatus: "EXPIRED",
            inspectionDueDate: pastIso(2),
          },
        },
        stock: [],
        movements: [],
      },
      insurance: {
        ok: true,
        insurance: null,
        vehicle: {
          ...vehicleBase,
          inspectionStatus: "EXPIRED",
          inspectionDueDate: pastIso(2),
        },
      },
    };
  }

  return {
    transport: {
      ok: true,
      guide: {
        id: 1100 + idNum,
        codeAT: `AT-${idNum}`,
        status: "ACTIVE",
        validUntil: futureIso(10),
        vehicle: {
          ...vehicleBase,
          inspectionStatus: "VALID",
          inspectionDueDate: futureIso(40),
        },
      },
      items: [],
    },
    work: {
      ok: true,
      workGuide: {
        id: 1200 + idNum,
        guideId: `AT-${idNum}`,
        status: "OPEN",
        validUntil: futureIso(5),
        vehicle: {
          ...vehicleBase,
          inspectionStatus: "VALID",
          inspectionDueDate: futureIso(40),
        },
      },
      stock: [],
      movements: [],
    },
    insurance: {
      ok: true,
      insurance: {
        id: 1300 + idNum,
        status: "ACTIVE",
        policyNumber: `POL-${idNum}`,
        dueDate: futureIso(50),
      },
      vehicle: {
        ...vehicleBase,
        inspectionStatus: "VALID",
        inspectionDueDate: futureIso(40),
      },
    },
  };
}

function installApiMocks(page, apiTrace, scenarioRef) {
  page.route("**/technician-auth-guard.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('BLOCK3 guard bypass active');" });
  });

  page.route("**/crystal-os-v2-shell.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('BLOCK3 shell bypass active');" });
  });

  page.route("**/crystal-os-v2-nav.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('BLOCK3 nav bypass active');" });
  });

  page.route("**/ui/design-system.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "console.log('BLOCK3 design-system bypass active');" });
  });

  page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    apiTrace.push({ method, path: url.pathname });

    function fulfill(body, status = 200) {
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    }

    if (url.pathname.startsWith("/api/technician/today")) {
      return fulfill({ ok: true, visits: mockedVisits() });
    }
    if (url.pathname.startsWith("/api/core/dashboard")) {
      return fulfill({ ok: true, nextVisits: mockedVisits() });
    }

    if (scenarioRef.mode === "offline") {
      if (url.pathname.startsWith("/api/guides/transport/latest/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "offline" }) });
      if (url.pathname.startsWith("/api/guides/stock/")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "offline" }) });
      if (url.pathname.includes("/insurance")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, error: "offline" }) });
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const vehicleFromTransport = pathParts[pathParts.length - 1] || "1";
    const vehicleFromStock = pathParts[pathParts.length - 1] || "1";
    const insuranceVehicleIdx = pathParts.findIndex((part) => part === "vehicles");
    const vehicleFromInsurance = insuranceVehicleIdx >= 0 ? (pathParts[insuranceVehicleIdx + 1] || "1") : "1";

    if (url.pathname.startsWith("/api/guides/transport/latest/")) {
      const payload = docsPayload(scenarioRef.mode, vehicleFromTransport);
      return fulfill(payload.transport);
    }
    if (url.pathname.startsWith("/api/guides/stock/")) {
      const payload = docsPayload(scenarioRef.mode, vehicleFromStock);
      return fulfill(payload.work);
    }
    if (url.pathname.includes("/insurance")) {
      const payload = docsPayload(scenarioRef.mode, vehicleFromInsurance);
      return fulfill(payload.insurance);
    }

    if (url.pathname.includes("/operational-state/visits/") && url.pathname.endsWith("/state") && method === "POST") {
      return fulfill({ ok: true, visit: { id: 93001, status: "IN_PROGRESS", startAt: new Date().toISOString() } });
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
    if (!localStorage.getItem("token")) localStorage.setItem("token", "block3-mocked-token");
    if (!localStorage.getItem("cristalwater_jwt")) localStorage.setItem("cristalwater_jwt", "block3-mocked-token");
    if (!localStorage.getItem("user")) localStorage.setItem("user", JSON.stringify(user));
    if (!localStorage.getItem("cristalwater_user")) localStorage.setItem("cristalwater_user", JSON.stringify(user));
    if (!localStorage.getItem("technicianId")) localStorage.setItem("technicianId", "4201");
  });
}

async function runForViewport(browser, viewport) {
  const context = await browser.newContext(viewport.contextOptions);
  const page = await context.newPage();
  const scenarioRef = { mode: "compliant" };
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
    const isOfflineDocFetch = scenarioRef.mode === "offline"
      && (url.includes("/api/guides/transport/latest/")
      || url.includes("/api/guides/stock/")
      || url.includes("/insurance"));
    if (response.status() >= 400 && !isOfflineDocFetch) apiErrors.push({ url, status: response.status() });
  });

  try {
    installApiMocks(page, apiTrace, scenarioRef);
    await primeSession(page);

    await page.goto(`${BASE_URL}/technician-field-mode`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(900);

    addCheck("landing-tecnico", contains(page.url(), "/technician-field-mode"), page.url());

    async function openDocsTab() {
      await domClick(page, ".field-tabs [data-field-tab-button='docs']");
      await page.waitForTimeout(250);
    }

    async function loadDocsForVehicle(vehicleId) {
      await openDocsTab();
      await page.fill("#vehicleId", String(vehicleId));
      await domClick(page, "#loadGuidesBtn");
      await page.waitForTimeout(700);
    }

    async function readDocsSnapshot() {
      return page.evaluate(() => ({
        activeTab: document.querySelector(".field-tabs [data-field-tab-button].active")?.dataset?.fieldTabButton || "",
        vehicleIdValue: String(document.querySelector("#vehicleId")?.value || "").trim(),
        centerText: String(document.querySelector("#documentCenterBox")?.textContent || "").trim(),
        transportText: String(document.querySelector("#transportGuideBox")?.textContent || "").trim(),
        workText: String(document.querySelector("#workGuideBox")?.textContent || "").trim(),
        insuranceText: String(document.querySelector("#insuranceBox")?.textContent || "").trim(),
        insurance: String(document.querySelector("#fieldInsuranceValue")?.textContent || "").trim(),
        inspection: String(document.querySelector("#fieldInspectionValue")?.textContent || "").trim(),
        safety: String(document.querySelector("#fieldSafetyValue")?.textContent || "").trim(),
      }));
    }

    await loadDocsForVehicle(1);

    const compliantState = await withStepTimeout(
      readDocsSnapshot(),
      8000,
      `${viewport.id}:compliant-state`
    );

    addCheck(
      "centro-documental-operacional",
      contains(compliantState.centerText, "Operacional") && contains(compliantState.centerText, "Fonte: online"),
      JSON.stringify(compliantState)
    );

    addCheck(
      "estados-validos-obrigatorios",
      contains(compliantState.insurance, "válido") && contains(compliantState.inspection, "válido") && contains(compliantState.safety, "válido"),
      JSON.stringify(compliantState)
    );

    addCheck(
      "documentos-ligados-a-viatura-ativa",
      contains(compliantState.transportText, "11-AA-11") && contains(compliantState.workText, "11-AA-11") && contains(compliantState.insuranceText, "11-AA-11"),
      JSON.stringify({ transport: compliantState.transportText, work: compliantState.workText, insurance: compliantState.insuranceText })
    );

    addCheck(
      "matriz-documental-completa",
      contains(compliantState.centerText, "Guia AT")
      && contains(compliantState.centerText, "Guia obra")
      && contains(compliantState.centerText, "Seguro")
      && contains(compliantState.centerText, "Inspeção")
      && contains(compliantState.centerText, "Fichas")
      && contains(compliantState.centerText, "Manuais"),
      compliantState.centerText
    );

    scenarioRef.mode = "blocked";
    await loadDocsForVehicle(1);

    const blockedState = await withStepTimeout(
      readDocsSnapshot(),
      8000,
      `${viewport.id}:blocked-state`
    );

    addCheck(
      "bloqueio-documental-ativo",
      contains(blockedState.centerText, "Bloqueado") && contains(blockedState.centerText, "insurance") && contains(blockedState.centerText, "inspection"),
      blockedState.centerText
    );

    addCheck(
      "estado-expirado-e-indisponivel",
      contains(blockedState.centerText, "Expirado") && contains(blockedState.centerText, "Indisponível"),
      blockedState.centerText
    );

    const beforePosts = apiTrace.filter((item) => item.method === "POST" && contains(item.path, "/operational-state/visits/")).length;
    await domClick(page, "#startBtn");
    await page.waitForTimeout(500);
    const afterPosts = apiTrace.filter((item) => item.method === "POST" && contains(item.path, "/operational-state/visits/")).length;

    const blockedAfterStart = await withStepTimeout(
      page.evaluate(() => {
        const activeTab = document.querySelector(".field-tabs [data-field-tab-button].active")?.dataset?.fieldTabButton || "";
        const lockReason = String(document.querySelector("[data-doc-lock-reason]")?.textContent || "").trim();
        return { activeTab, lockReason };
      }),
      8000,
      `${viewport.id}:blocked-after-start`
    );

    addCheck(
      "bloqueio-impede-start",
      afterPosts === beforePosts && blockedAfterStart.activeTab === "docs" && blockedAfterStart.lockReason.length > 0,
      JSON.stringify({ beforePosts, afterPosts, blockedAfterStart })
    );

    scenarioRef.mode = "compliant";
    await loadDocsForVehicle(1);
    const beforeUnlockPosts = apiTrace.filter((item) => item.method === "POST" && contains(item.path, "/operational-state/visits/")).length;
    await domClick(page, "#startBtn");
    await page.waitForTimeout(500);
    const afterUnlockPosts = apiTrace.filter((item) => item.method === "POST" && contains(item.path, "/operational-state/visits/")).length;
    addCheck("desbloqueio-apos-regularizacao", afterUnlockPosts > beforeUnlockPosts, JSON.stringify({ beforeUnlockPosts, afterUnlockPosts }));

    scenarioRef.mode = "pending";
    await loadDocsForVehicle(2);
    const pendingState = await withStepTimeout(readDocsSnapshot(), 8000, `${viewport.id}:pending-state`);
    addCheck(
      "estado-pendente-visivel",
      contains(pendingState.centerText, "Guia AT: Pendente")
      && contains(pendingState.centerText, "Guia obra: Pendente")
      && contains(pendingState.centerText, "Seguro: Pendente")
      && contains(pendingState.centerText, "Inspeção: Pendente"),
      pendingState.centerText
    );

    addCheck(
      "troca-viatura-troca-contexto-documental",
      pendingState.vehicleIdValue === "2" && contains(pendingState.transportText, "22-BB-22"),
      JSON.stringify({ vehicle: pendingState.vehicleIdValue, transport: pendingState.transportText })
    );

    await openDocsTab();
    await withStepTimeout(page.reload({ waitUntil: "domcontentloaded", timeout: 15000 }), 18000, `${viewport.id}:reload-context`);
    await page.waitForTimeout(700);
    const restoredState = await withStepTimeout(readDocsSnapshot(), 8000, `${viewport.id}:restored-context`);
    addCheck(
      "retorno-centro-operacional-preserva-contexto",
      restoredState.activeTab === "docs" && restoredState.vehicleIdValue === "2",
      JSON.stringify(restoredState)
    );

    scenarioRef.mode = "offline";
    await loadDocsForVehicle(1);

    const offlineState = await withStepTimeout(
      readDocsSnapshot(),
      8000,
      `${viewport.id}:offline-state`
    );

    addCheck(
      "fallback-offline-cache",
      contains(offlineState.centerText, "offline sincronizado") && contains(offlineState.centerText, "Operacional"),
      offlineState.centerText
    );

    await loadDocsForVehicle(99);
    const unsyncedOfflineState = await withStepTimeout(readDocsSnapshot(), 8000, `${viewport.id}:unsynced-offline-state`);
    addCheck(
      "cache-offline-apenas-sincronizados",
      !contains(unsyncedOfflineState.centerText, "offline sincronizado") && contains(unsyncedOfflineState.centerText, "Indisponível"),
      unsyncedOfflineState.centerText
    );

    const readOnlyState = await withStepTimeout(
      page.evaluate(() => {
        const docsPanel = document.querySelector(".field-panel-docs");
        const panelText = String(docsPanel?.textContent || "");
        const manageControls = [...(docsPanel?.querySelectorAll("button,a") || [])]
          .map((node) => String(node.textContent || "").trim())
          .filter((text) => /(gerir|gestão|criar|editar|eliminar|remover)/i.test(text));
        return { panelText, manageControls };
      }),
      8000,
      `${viewport.id}:readonly-state`
    );

    addCheck(
      "tecnico-somente-consulta-documentos",
      readOnlyState.manageControls.length === 0,
      JSON.stringify(readOnlyState)
    );

    addCheck("sem-erros-console", consoleErrors.length === 0, `consoleErrors=${consoleErrors.length}`);
    addCheck("sem-erros-api", apiErrors.length === 0, `apiErrors=${apiErrors.length}`);

    ensureFolder(EVIDENCE_DIR);
    const shotPath = path.join(EVIDENCE_DIR, `block3-${viewport.id}.png`);
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
  console.error("FCS_TECHNICIAN_OPERATIONS_BLOCK3_ERROR", error);
  process.exit(1);
});
