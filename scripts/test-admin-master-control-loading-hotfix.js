const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

require('../src/loadEnv')();

const BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3002';
const ROOT = path.join(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'docs', 'product', 'ADMIN_MASTER_CONTROL_LOADING_HOTFIX.json');
const EVIDENCE_ROOT = path.join(ROOT, 'docs', 'product', 'evidence', 'admin-master-control-loading-hotfix');
const RUN_ID = `HOTFIX_${Date.now()}`;
const COMMAND_CENTER_HTML_PATH = path.join(ROOT, 'frontend', 'admin-master-control.html');
const COMMAND_CENTER_HTML = fs.readFileSync(COMMAND_CENTER_HTML_PATH, 'utf8');

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    if (details) error.details = details;
    throw error;
  }
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureFolder(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactConsole(lines, max = 30) {
  return lines.slice(-max).map((row) => ({ type: row.type, text: String(row.text || '').slice(0, 400) }));
}

function attachPageDiagnostics(page, trace) {
  page.on('console', (msg) => {
    trace.console.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (error) => {
    trace.pageErrors.push(String(error?.message || error));
  });
  page.on('requestfailed', (request) => {
    trace.requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || 'request_failed',
    });
  });
}

async function collectFailureEvidence(page, scenarioName, trace, error) {
  const scenarioDir = path.join(EVIDENCE_ROOT, RUN_ID, scenarioName);
  ensureFolder(scenarioDir);

  const htmlPath = path.join(scenarioDir, 'page-content.html');
  const screenshotPath = path.join(scenarioDir, 'screenshot.png');
  const diagnosticPath = path.join(scenarioDir, 'diagnostic.json');

  const pageUrl = page.url();
  const title = await page.title().catch(() => '');
  const content = await page.content().catch(() => '');
  await fs.promises.writeFile(htmlPath, content, 'utf8');
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);

  const domState = await page.evaluate(() => ({
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    bodyDisplay: getComputedStyle(document.body || document.documentElement).display,
    htmlVisibility: getComputedStyle(document.documentElement).visibility,
    bodyVisibility: getComputedStyle(document.body || document.documentElement).visibility,
    metricsExists: Boolean(document.querySelector('#metrics')),
    metricsInnerText: (document.querySelector('#metrics')?.innerText || '').slice(0, 500),
    hasLoadingState: Boolean(document.querySelector('[data-cw-state="loading"]')),
    hasErrorState: Boolean(document.querySelector('[data-cw-state="error"]')),
  })).catch(() => ({
    readyState: 'unavailable',
    visibilityState: 'unavailable',
    bodyDisplay: 'unavailable',
    htmlVisibility: 'unavailable',
    bodyVisibility: 'unavailable',
    metricsExists: false,
    metricsInnerText: '',
    hasLoadingState: false,
    hasErrorState: false,
  }));

  const diagnostic = {
    runId: RUN_ID,
    scenario: scenarioName,
    at: nowIso(),
    url: pageUrl,
    title,
    htmlPath: path.relative(ROOT, htmlPath),
    screenshotPath: path.relative(ROOT, screenshotPath),
    document: domState,
    consoleTail: compactConsole(trace.console),
    pageErrors: trace.pageErrors.slice(-20),
    requestFailures: trace.requestFailures.slice(-20),
    failureMessage: String(error?.message || error),
  };

  await fs.promises.writeFile(diagnosticPath, JSON.stringify(diagnostic, null, 2), 'utf8');
  return diagnostic;
}

function buildFakeJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'hotfix-test-admin',
    role: 'ADMIN',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  })).toString('base64url');
  return `${header}.${payload}.x`;
}

async function primeSession(page, timeoutOverrides) {
  const token = buildFakeJwt();
  const user = { id: 'hotfix-test-admin', role: 'ADMIN', email: 'hotfix@test.local', name: 'Hotfix Test' };
  await page.addInitScript((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', payload.token);
    localStorage.setItem('cristalwater_jwt', payload.token);
    localStorage.setItem('adminToken', payload.token);
    localStorage.setItem('user', JSON.stringify(payload.user));
    localStorage.setItem('cristalwater_user', JSON.stringify(payload.user));
    window.__CW_DASHBOARD_TIMEOUTS__ = payload.timeouts;
  }, { token, user, timeouts: timeoutOverrides });
}

function buildCommandCenterHtmlForHarness() {
  return COMMAND_CENTER_HTML
    .replace('<script src="/admin-auth-guard.js"></script>', '')
    .replace('</head>', '<script>window.__CW_HOTFIX_HARNESS__=true;</script></head>');
}

function buildSummaryPayload() {
  return {
    ok: true,
    metrics: {
      clients: 12,
      pools: 18,
      technicians: 4,
      rounds: 3,
      visitsPlanned: 5,
      visitsDone: 2,
      alertsOpen: 2,
      repairsPending: 1,
      invoicesPending: 3,
      payments: 6,
    },
    pending: {
      poolsWithoutRound: [
        { id: 1, name: 'Piscina QA', client: { name: 'Cliente QA' }, zone: 'Centro' },
      ],
      visitsWithoutTechnician: [],
      clientsWithoutPools: [],
    },
  };
}

function buildCorePayload() {
  return {
    ok: true,
    counts: {
      clients: 12,
      pools: 18,
      technicians: 4,
      visitsPlanned: 5,
      visitsDone: 2,
      repairsOpen: 2,
      invoicesOpen: 3,
      messagesUnread: 0,
      notificationsUnread: 0,
      technicalSheetEvents24h: 1,
    },
    pendingPoolsWithoutRound: [
      { id: 1, name: 'Piscina QA', client: { name: 'Cliente QA' }, zone: 'Centro' },
    ],
    nextVisits: [
      {
        id: 101,
        pool: { name: 'Piscina QA' },
        client: { name: 'Cliente QA' },
        technician: { id: 1, name: 'Tecnico QA' },
        technicianId: 1,
        status: 'PLANNED',
        plannedDate: nowIso(),
        createdAt: nowIso(),
      },
    ],
    morningCheck: {
      title: 'OK',
      status: 'OK',
      message: 'Tudo pronto para o arranque.',
      counts: { ok: 4, warn: 0, bad: 0 },
      checks: [],
    },
    technicalPropagation: [
      {
        id: 201,
        poolId: 1,
        type: 'TECHNICAL_SHEET_CHANGE',
        message: 'Evento técnico QA',
        at: nowIso(),
        status: 'OPEN',
        component: 'QA',
      },
    ],
  };
}

async function installRoutes(page, scenario) {
  await page.route('**/admin-master-control', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: buildCommandCenterHtmlForHarness(),
    });
  });

  await page.route('**/admin-alerts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><head><meta charset="utf-8"><title>Admin Alerts Harness</title></head><body><main id="alerts-page">Admin Alerts Harness</main></body></html>',
    });
  });

  await page.route('**/admin-auth-guard.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "document.documentElement.style.visibility = ''; console.log('hotfix-test auth guard bypass');",
    });
  });

  await page.route('**/cw-auth.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "console.log('hotfix-test cw-auth bypass');",
    });
  });

  await page.route('**/crystal-os-v2-shell.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "console.log('hotfix-test shell bypass');",
    });
  });

  await page.route('**/crystal-os-v2-nav.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "console.log('hotfix-test nav bypass');",
    });
  });

  await page.route('**/ui/state-adapter-v2.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: "console.log('hotfix-test state adapter bypass');",
    });
  });

  await page.route('**/api/operational-flow/summary', async (route) => {
    if (scenario.summary === 'error') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Falha simulada no resumo.' }),
      });
      return;
    }

    if (scenario.summary === 'slow') {
      await wait(3500);
    }

    if (scenario.summary === 'hang') {
      await wait(5000);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildSummaryPayload()),
    });
  });

  await page.route('**/api/core/dashboard', async (route) => {
    if (scenario.core === 'error') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Falha simulada no dashboard.' }),
      });
      return;
    }

    if (scenario.core === 'slow') {
      await wait(3500);
    }

    if (scenario.core === 'hang') {
      await wait(5000);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildCorePayload()),
    });
  });

  await page.route('**/api/technicians', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ technicians: [{ id: 1, name: 'Tecnico QA' }] }),
    });
  });
}

async function assertTextContains(page, selector, expectedText, timeoutMs, message) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'attached', timeout: timeoutMs });
  await page.waitForFunction(({ selector: sel, expected }) => {
    const node = document.querySelector(sel);
    return node && String(node.textContent || '').includes(expected);
  }, { selector, expected: expectedText }, { timeout: timeoutMs });
  assert(true, message || `selector text missing: ${selector}`);
}

async function assertAttached(page, selector, timeoutMs, message) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'attached', timeout: timeoutMs });
  assert(await locator.count() > 0, message || `selector not attached: ${selector}`);
}

async function waitForCommandCenterShell(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await assertAttached(page, '#metrics', 15000, 'Centro de comando deve renderizar o bloco #metrics');
  await page.waitForFunction(() => document.readyState === 'interactive' || document.readyState === 'complete', {}, { timeout: 5000 });
}

async function scenarioSlowResponse() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const trace = { console: [], pageErrors: [], requestFailures: [] };
  attachPageDiagnostics(page, trace);

  try {
    await primeSession(page, { summary: 2000, core: 2000, technicians: 2000 });
    await installRoutes(page, { summary: 'slow', core: 'slow' });
    await page.goto(`${BASE_URL}/admin-master-control`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForCommandCenterShell(page);

    await assertTextContains(page, '#metrics', 'A carregar', 5000, 'Resumo deve começar em loading');
    await page.goto(`${BASE_URL}/admin-alerts`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForURL((url) => url.pathname.includes('/admin-alerts'), { timeout: 10000 });

    assert(true, 'Navegação continua funcional durante loading');
  } catch (error) {
    const diagnostic = await collectFailureEvidence(page, 'slow-response', trace, error);
    error.details = { ...(error.details || {}), diagnostic };
    throw error;
  } finally {
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
  }
}

async function scenarioError500() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const trace = { console: [], pageErrors: [], requestFailures: [] };
  attachPageDiagnostics(page, trace);

  try {
    await primeSession(page, { summary: 250, core: 250, technicians: 250 });
    await installRoutes(page, { summary: 'error', core: 'slow' });
    await page.goto(`${BASE_URL}/admin-master-control`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForCommandCenterShell(page);

    await assertAttached(page, '[data-dashboard-retry="summary"]', 5000, 'Botão de retry deve estar visível');
    await assertAttached(page, '[data-dashboard-continue="summary"]', 5000, 'Botão continuar sem dados deve estar visível');
    await assertTextContains(page, '#metrics', 'Não foi possível carregar os dados', 5000, 'Erro 500 deve aparecer no resumo');
    await page.goto(`${BASE_URL}/admin-alerts`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForURL((url) => url.pathname.includes('/admin-alerts'), { timeout: 10000 });
  } catch (error) {
    const diagnostic = await collectFailureEvidence(page, 'error-500', trace, error);
    error.details = { ...(error.details || {}), diagnostic };
    throw error;
  } finally {
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
  }
}

async function scenarioHangingRequestTimesOut() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const trace = { console: [], pageErrors: [], requestFailures: [] };
  attachPageDiagnostics(page, trace);

  try {
    await primeSession(page, { summary: 250, core: 250, technicians: 250 });
    await installRoutes(page, { summary: 'hang', core: 'slow' });
    await page.goto(`${BASE_URL}/admin-master-control`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForCommandCenterShell(page);

    await assertTextContains(page, '#metrics', 'A carregar', 5000, 'Resumo deve iniciar em loading');
    await assertTextContains(page, '#operationDigest', 'A carregar', 5000, 'Operação deve iniciar em loading');

    await assertTextContains(page, '#metrics', 'Não foi possível carregar os dados', 8000, 'Pedido preso deve virar erro por timeout');
    await assertAttached(page, '[data-dashboard-retry="summary"]', 2000, 'Timeout deve expor retry');
    await assertAttached(page, '[data-dashboard-continue="summary"]', 2000, 'Timeout deve expor continuar sem dados');
    assert((await page.locator('[data-cw-state="loading"]').count()) === 0, 'Nao pode existir spinner infinito');
  } catch (error) {
    const diagnostic = await collectFailureEvidence(page, 'hanging-request-timeout', trace, error);
    error.details = { ...(error.details || {}), diagnostic };
    throw error;
  } finally {
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
  }
}

async function main() {
  ensureDir(OUT_JSON);
  ensureFolder(path.join(EVIDENCE_ROOT, RUN_ID));

  const report = {
    generatedAt: nowIso(),
    runId: RUN_ID,
    ok: false,
    scenarios: [],
    evidenceRoot: path.relative(ROOT, path.join(EVIDENCE_ROOT, RUN_ID)),
  };

  try {
    await scenarioSlowResponse();
    report.scenarios.push({ name: 'slow-response', pass: true });

    await scenarioError500();
    report.scenarios.push({ name: 'error-500', pass: true });

    await scenarioHangingRequestTimesOut();
    report.scenarios.push({ name: 'hanging-request-timeout', pass: true });

    report.ok = true;
    console.log('ADMIN_MASTER_CONTROL_LOADING_HOTFIX=PASS');
  } catch (error) {
    report.ok = false;
    report.error = String(error.message || error);
    report.details = error.details || null;
    console.error('ADMIN_MASTER_CONTROL_LOADING_HOTFIX=FAIL');
    console.error(error.message || error);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  }
}

main();
